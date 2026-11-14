-- Sistema de control de lotificación · esquema completo (copia exacta del sistema de Lotificación San Marcos)
-- Ejecutar una sola vez en un proyecto de Supabase nuevo (SQL Editor).

-- ============ TABLAS ============
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  correo text,
  rol text not null default 'pendiente' check (rol = any (array['admin','ventas','cobros','pendiente'])),
  creado timestamptz not null default now(),
  puede_cobrar boolean not null default false
);

create table public.lotes (
  codigo text primary key,
  poligono text not null,
  numero integer not null,
  area_m2 numeric,
  area_v2 numeric,
  precio_lista numeric,
  caracteristicas text,
  a_la_venta boolean not null default true,
  observaciones text
);

create table public.clientes (
  id bigint generated always as identity primary key,
  codigo text unique,
  nombre text not null,
  dui text,
  telefono text,
  direccion text,
  correo text,
  beneficiario text,
  observaciones text,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users(id)
);

create table public.ventas (
  id bigint generated always as identity primary key,
  contrato text not null unique,
  fecha date,
  lote text references public.lotes(codigo),
  cliente_id bigint not null references public.clientes(id),
  estado text not null check (estado = any (array['Reservado','Activo','Pagado','Rescindido'])),
  tipo text not null default 'Crédito' check (tipo = any (array['Contado','Crédito'])),
  precio_pactado numeric,
  plazo integer check (plazo is null or (plazo > 0 and plazo <= 144)),
  tasa numeric,
  cuota_pactada numeric,
  fecha_primera_cuota date,
  saldo_inicial_libro numeric,
  cuotas_antes integer,
  vendedor text,
  comision numeric,
  observaciones text,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users(id),
  interes_por_pago boolean not null default false
);
comment on column public.ventas.interes_por_pago is 'Si es true, cada cuota mensual pagada cobra un mes de interés sobre el saldo que tenía, sin importar la fecha.';

create table public.pagos (
  id bigint generated always as identity primary key,
  fecha date not null,
  recibo text,
  venta_id bigint not null references public.ventas(id) on delete cascade,
  tipo text not null check (tipo = any (array['Reserva','Prima','Cuota mensual','Abono extra a capital','Pago de contado'])),
  monto numeric not null check (monto >= 0),
  forma text check (forma is null or forma = any (array['Efectivo','Transferencia','Depósito bancario','Cheque'])),
  nota text,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users(id)
);

-- ============ ÍNDICES ============
create unique index ventas_un_lote_vigente on public.ventas (lote) where estado <> 'Rescindido' and lote is not null;
create index ventas_cliente_idx on public.ventas (cliente_id);
create index ventas_creado_por_idx on public.ventas (creado_por);
create index clientes_creado_por_idx on public.clientes (creado_por);
create index pagos_venta_idx on public.pagos (venta_id);
create unique index pagos_recibo_unico on public.pagos (recibo) where recibo is not null and recibo <> '';
create index pagos_creado_por_idx on public.pagos (creado_por);

-- ============ FUNCIONES Y DISPARADOR ============
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path to 'public'
as $$ select coalesce((select rol from public.perfiles where id = auth.uid()), 'pendiente') $$;

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path to 'public'
as $$ begin
  insert into public.perfiles(id, correo, nombre) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)));
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_perfil();

-- ============ SEGURIDAD POR ROLES (RLS) ============
alter table public.perfiles enable row level security;
alter table public.lotes enable row level security;
alter table public.clientes enable row level security;
alter table public.ventas enable row level security;
alter table public.pagos enable row level security;

create policy perfiles_ver on public.perfiles for select to authenticated using ((id = (select auth.uid())) or ((select public.mi_rol()) = 'admin'));
create policy perfiles_admin on public.perfiles for update to authenticated using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');

create policy lotes_ver on public.lotes for select to authenticated using ((select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy lotes_admin_ins on public.lotes for insert to authenticated with check ((select public.mi_rol()) = 'admin');
create policy lotes_admin_upd on public.lotes for update to authenticated using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
create policy lotes_admin_del on public.lotes for delete to authenticated using ((select public.mi_rol()) = 'admin');

create policy clientes_ver on public.clientes for select to authenticated using ((select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy clientes_crear on public.clientes for insert to authenticated with check ((select public.mi_rol()) = any (array['admin','ventas']));
create policy clientes_editar on public.clientes for update to authenticated using ((select public.mi_rol()) = any (array['admin','ventas'])) with check ((select public.mi_rol()) = any (array['admin','ventas']));
create policy clientes_borrar on public.clientes for delete to authenticated using ((select public.mi_rol()) = 'admin');

create policy ventas_ver on public.ventas for select to authenticated using ((select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy ventas_crear on public.ventas for insert to authenticated with check ((select public.mi_rol()) = any (array['admin','ventas']));
create policy ventas_editar on public.ventas for update to authenticated using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
create policy ventas_borrar on public.ventas for delete to authenticated using ((select public.mi_rol()) = 'admin');

create policy pagos_ver on public.pagos for select to authenticated using ((select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy pagos_crear on public.pagos for insert to authenticated with check (((select public.mi_rol()) = any (array['admin','cobros'])) or (((select public.mi_rol()) = 'ventas') and (tipo = any (array['Reserva','Prima','Pago de contado']))));
create policy pagos_crear_cobrador on public.pagos for insert to authenticated with check (exists (select 1 from public.perfiles pf where pf.id = (select auth.uid()) and pf.puede_cobrar and pf.rol <> 'pendiente'));
create policy pagos_editar on public.pagos for update to authenticated using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
create policy pagos_borrar on public.pagos for delete to authenticated using ((select public.mi_rol()) = 'admin');

-- ============ ALMACÉN PARA LA PLANTILLA DEL EXCEL DE CONTROL ============
insert into storage.buckets (id, name, public) values ('plantillas', 'plantillas', false) on conflict (id) do nothing;
create policy plantillas_ver on storage.objects for select to authenticated using (bucket_id = 'plantillas' and (select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy plantillas_subir on storage.objects for insert to authenticated with check (bucket_id = 'plantillas' and (select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy plantillas_cambiar on storage.objects for update to authenticated using (bucket_id = 'plantillas' and (select public.mi_rol()) = any (array['admin','ventas','cobros'])) with check (bucket_id = 'plantillas' and (select public.mi_rol()) = any (array['admin','ventas','cobros']));

-- ============ TIEMPO REAL (la app se actualiza sola cuando otro usuario guarda) ============
alter publication supabase_realtime add table public.perfiles, public.lotes, public.clientes, public.ventas, public.pagos;

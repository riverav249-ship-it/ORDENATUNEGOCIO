-- Agregado: datos de la lotificación editables por el administrador (nombre, nombre corto, ubicación, teléfono)
create table public.ajustes (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'Mi Lotificación',
  nombre_corto text not null default 'Mi Lotificación',
  ubicacion text not null default '',
  telefono text not null default '',
  actualizado timestamptz not null default now()
);
insert into public.ajustes (id) values (1);
alter table public.ajustes enable row level security;
-- El nombre se muestra también en la pantalla de entrada, por eso se puede leer sin sesión.
create policy ajustes_ver on public.ajustes for select to anon, authenticated using (true);
create policy ajustes_admin on public.ajustes for update to authenticated using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
alter publication supabase_realtime add table public.ajustes;

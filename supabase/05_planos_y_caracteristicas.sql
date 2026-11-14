-- Agregado: características de la lotificación y planos (archivos en el almacén privado "planos")
alter table public.ajustes
  add column descripcion text not null default '',
  add column area_total text not null default '',
  add column servicios text not null default '',
  add column acceso text not null default '',
  add column notas text not null default '';

create table public.planos (
  id bigint generated always as identity primary key,
  titulo text not null,
  descripcion text,
  ruta text not null unique,
  nombre_archivo text,
  tipo text,
  tamano bigint,
  principal boolean not null default false,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users(id)
);
create index planos_creado_por_idx on public.planos (creado_por);
alter table public.planos enable row level security;
create policy planos_ver on public.planos for select to authenticated using ((select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy planos_crear on public.planos for insert to authenticated with check ((select public.mi_rol()) = 'admin');
create policy planos_editar on public.planos for update to authenticated using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
create policy planos_borrar on public.planos for delete to authenticated using ((select public.mi_rol()) = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planos', 'planos', false, 26214400, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy planos_archivo_ver on storage.objects for select to authenticated using (bucket_id = 'planos' and (select public.mi_rol()) = any (array['admin','ventas','cobros']));
create policy planos_archivo_subir on storage.objects for insert to authenticated with check (bucket_id = 'planos' and (select public.mi_rol()) = 'admin');
create policy planos_archivo_cambiar on storage.objects for update to authenticated using (bucket_id = 'planos' and (select public.mi_rol()) = 'admin') with check (bucket_id = 'planos' and (select public.mi_rol()) = 'admin');
create policy planos_archivo_borrar on storage.objects for delete to authenticated using (bucket_id = 'planos' and (select public.mi_rol()) = 'admin');

alter publication supabase_realtime add table public.planos;

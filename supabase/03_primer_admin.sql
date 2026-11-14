-- Después de que el dueño cree su cuenta en la aplicación ("Crear cuenta nueva"),
-- ejecutar esto con SU correo para hacerlo administrador. Los demás usuarios se aprueban desde la pestaña Usuarios.
update public.perfiles set rol = 'admin' where correo = 'CORREO_DEL_ADMINISTRADOR@gmail.com';

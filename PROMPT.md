Quiero montar una copia exacta de mi sistema de control de lotificación (lotes, ventas, reservas, cuotas, recibos y alertas de cobro) en esta cuenta. Te adjunto el paquete **sistema-lotificacion.zip**, que tiene todo el código y la base de datos del sistema original. No lo rediseñes ni lo reescribas: súbelo tal cual, igualito.

Lo que trae el paquete:
- `src/`: la aplicación web completa (index.html, app.js, app.css, calc.js, mapa.js, excel.js, control.js y config.js). Es un sitio estático: no lleva build, framework ni npm.
- `supabase/01_esquema.sql`: las 5 tablas (perfiles, lotes, clientes, ventas, pagos), índices, funciones, el disparador que crea el perfil de cada usuario nuevo, las 22 reglas de seguridad por rol, el almacén "plantillas" y el tiempo real.
- `supabase/02_lotes_san_marcos.sql`: el catálogo de 66 lotes que dibuja el mapa.
- `supabase/03_primer_admin.sql`: convierte mi usuario en administrador.

Hazlo en este orden, con los conectores de Supabase y Vercel:

1. **Supabase:** crea un proyecto nuevo llamado "[NOMBRE DEL PROYECTO]". Ejecuta `01_esquema.sql` completo y después `02_lotes_san_marcos.sql`. Confirma que quedaron 5 tablas, 66 lotes y 22 políticas.
2. **Inicio de sesión:** deja activado el acceso con correo y contraseña. Desactiva "Confirm email" para que cada usuario nuevo pueda entrar de una vez; igual queda sin permisos ("pendiente") hasta que el administrador le asigne un rol.
3. **Conexión:** saca la URL del proyecto y la llave pública (publishable, la que empieza con `sb_publishable_`) y ponlas en `src/config.js`. Nunca uses la llave service_role en la aplicación.
4. **Vercel:** crea un proyecto llamado "[NOMBRE DEL PROYECTO]" y despliega a producción el contenido de la carpeta `src/` como sitio estático, sin framework ni comando de build. `index.html` va en la raíz.
5. **Dirección del sitio:** en Supabase, Authentication › URL Configuration, pon como Site URL la dirección de producción de Vercel.
6. **Mi usuario:** pásame el enlace. Yo abro la aplicación y toco "Crear cuenta nueva". Cuando te avise, ejecuta `03_primer_admin.sql` con mi correo: [MI CORREO].
7. **Prueba:** confirma conmigo que entro, que el mapa muestra los 66 lotes a colores y que funcionan "Nueva venta" (crédito, contado y "Solo reserva"), "Registrar pago", el recibo, las Alertas y "Descargar Excel". Si haces una venta de prueba, bórrala al terminar.

Reglas:
- No cambies ningún archivo, salvo `src/config.js` (y los textos de abajo si te lo pido).
- Si algo falla, dime qué paso falló y por qué antes de cambiar el código.

Si lo quiero para OTRA lotificación (no San Marcos), cambia solo esto y avísame qué cambiaste:
- El nombre "Lotificación San Marcos", "San Marcos" y "Guacotecti, Cabañas" en `index.html`, `app.js` (mensajes de WhatsApp y recibos), `excel.js` y `control.js`.
- El teléfono `TEL_LOTIF` en `app.js`.
- Las condiciones de crédito en `calc.js` (12% anual, prima mínima 5%, plazo hasta 12 años y la tabla de factores por año), solo si la nueva lotificación usa otras.
- Los lotes: en lugar de `02_lotes_san_marcos.sql`, carga los lotes de la nueva lotificación (código "Polígono-Número", polígono, número, área en m² y v², precio de lista) y ajusta los polígonos de `mapa.js` a su plano.

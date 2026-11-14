# Sistema de control de lotificación

Lotes, ventas, reservas, cuotas, recibos y alertas de cobro. Basado en el paquete `sistema-lotificacion.zip` (sistema de Lotificación San Marcos).

- `src/`: la aplicación web (sitio estático, sin build). Vercel publica esta carpeta.
- `supabase/`: esquema de la base de datos, catálogo de lotes y script del primer administrador.
- `PROMPT.md`: instrucciones originales del paquete.

## Cambios respecto al paquete original
- `src/config.js`: conexión al proyecto de Supabase `ordenatunegocio-lotes`.
- Nombre, nombre corto, ubicación y teléfono de la lotificación ya no están fijos en el código: se guardan en la tabla `ajustes` y el administrador los cambia en la pestaña **Usuarios › Datos de la lotificación**. Archivos tocados: `src/index.html`, `src/app.js`, `src/excel.js`.
- Base de datos: se agregó la tabla `ajustes` (lectura pública, edición solo admin).
- Pestaña **Lotificación**: características generales (descripción, área, acceso, servicios, notas), planos y documentos (PDF/imágenes en el almacén privado `planos` de Supabase) y tabla editable de lotes (área, precio, características, observaciones, a la venta). Todos los usuarios con rol la ven; solo el admin edita. SQL en `supabase/05_planos_y_caracteristicas.sql`. Archivos tocados: `src/index.html`, `src/app.js`, `src/app.css`.

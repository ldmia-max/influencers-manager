# Previsualización de Emails

Este proyecto incluye dos formas de previsualizar los templates de email antes de enviarlos.

## Opción 1: Página web (Recomendado)

Visualiza todos los emails en tu navegador con la interfaz de la aplicación.

### Pasos:

1. Inicia el servidor de desarrollo:
```bash
npm run dev
```

2. Abre tu navegador y ve a:
```
http://localhost:3000/admin/emails/preview
```

3. Verás todos los templates de email con:
   - Subject (asunto del email)
   - Descripción de cuándo se envía
   - Preview visual en iframe

### Ventajas:
✅ Vista previa en tiempo real
✅ No necesitas generar archivos
✅ Fácil de compartir con tu equipo
✅ Actualización automática al cambiar templates

---

## Opción 2: Script de generación de archivos HTML

Genera archivos HTML estáticos que puedes abrir en cualquier navegador.

### Pasos:

1. Ejecuta el script:
```bash
npm run email:preview
```

2. Los archivos se generarán en la carpeta `email-previews/`:
   - `1-campaign-review.html` - Email de revisión de campaña (cliente)
   - `2-token-regenerated.html` - Email de token regenerado (cliente)
   - `3-campaign-approved.html` - Email de campaña aprobada (admin)
   - `4-campaign-rejected.html` - Email de campaña con rechazos (admin)

3. Abre cualquier archivo HTML en tu navegador favorito.

### Ventajas:
✅ Archivos portables (puedes enviarlos por email)
✅ No necesitas servidor corriendo
✅ Fácil de compartir con clientes/stakeholders
✅ Perfecto para documentación

---

## Emails disponibles

### 1. Campaña enviada a revisión (Cliente)
**Cuándo se envía:** Cuando un admin envía una campaña al cliente para aprobación.
**Destinatario:** Contacto del cliente
**Contiene:** Link de aprobación con token temporal

### 2. Token regenerado (Cliente)
**Cuándo se envía:** Cuando un admin regenera el token de aprobación.
**Destinatario:** Contacto del cliente
**Contiene:** Nuevo link de aprobación (los anteriores se invalidan)

### 3. Campaña aprobada (Admin)
**Cuándo se envía:** Cuando el cliente aprueba todos los perfiles de la campaña.
**Destinatario:** Admin creador de la campaña
**Contiene:** Resumen de aprobación y link a la campaña

### 4. Campaña con rechazos (Admin)
**Cuándo se envía:** Cuando el cliente rechaza uno o más perfiles.
**Destinatario:** Admin creador de la campaña
**Contiene:** Lista de perfiles rechazados con motivos y estadísticas

---

## Personalización

Para modificar los templates de email, edita:
```
src/lib/emails/templates.ts
```

Los cambios se reflejarán automáticamente en ambas opciones de previsualización.

### Estilos actuales:
- **Colores:** Gradiente rojo a naranja (#FF0000 → #FFA500)
- **Fuente:** System fonts (Apple, Segoe UI, Roboto)
- **Layout:** Responsive con max-width 560px
- **Compatibilidad:** HTML tables para máxima compatibilidad con clientes de email

---

## Notas importantes

⚠️ **Compatibilidad de gradientes:** Algunos clientes de email antiguos (Outlook 2010/2013) podrían no soportar `linear-gradient`. Los clientes modernos (Gmail, Outlook moderno, Apple Mail) lo mostrarán correctamente.

📧 **Datos de ejemplo:** Los emails usan datos ficticios para previsualización. Los emails reales se generarán con datos de tu base de datos.

🔒 **Acceso:** La página `/admin/emails/preview` requiere login de admin.

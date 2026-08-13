# Plan: Notificaciones por Email con Resend

## Resumen

Implementar un módulo de notificaciones por email usando [Resend](https://resend.com) para automatizar el envío de emails en los momentos clave del flujo de campañas:

1. **Campaña enviada a revisión** → Email al cliente con enlace de aprobación
2. **Token regenerado** → Email al cliente con nuevo enlace de aprobación
3. **Cliente aprueba la campaña** → Email al admin/usuario creador notificando aprobación total
4. **Cliente rechaza perfiles** → Email al admin/usuario creador notificando rechazos parciales con detalles

---

## Estado Actual del Sistema

### Flujo de estados de campaña
```
DRAFT → REVIEW → PENDING/ACTIVE → COMPLETED/CANCELLED
```

### Puntos de integración existentes

| Evento | Ruta API | Archivo |
|--------|----------|---------|
| Campaña → REVIEW | `PATCH /api/campaigns/[id]/status` | `src/app/api/campaigns/[id]/status/route.ts` |
| Regenerar token | `POST /api/campaigns/[id]/regenerate-token` | `src/app/api/campaigns/[id]/regenerate-token/route.ts` |
| Cliente envía aprobación | `POST /api/public/approve/[token]/submit` | `src/app/api/public/approve/[token]/submit/route.ts` |

### Datos ya disponibles para emails
- `sentToEmail` — Email del contacto del cliente
- `sentToName` — Nombre del contacto
- `campaign.name` — Nombre de la campaña
- `campaign.client.companyName` — Nombre de la empresa
- `approvalUrl` — Enlace de aprobación generado
- `expiresAt` — Fecha de expiración del token (7 días)
- `createdBy` — Usuario que creó la campaña (para notificar al admin)

---

## Arquitectura Propuesta

### 1. Instalación y configuración

```bash
npm install resend
```

**Variable de entorno nueva:**
```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=notificaciones@tudominio.com
```

> Resend requiere un dominio verificado para enviar emails en producción. En desarrollo se puede usar `onboarding@resend.dev`.

---

### 2. Servicio de email: `src/lib/resend.ts`

Singleton del cliente Resend + funciones de envío tipadas.

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Resend error:", err);
    return { success: false, error: err };
  }
}
```

---

### 3. Templates de email: `src/lib/email-templates.ts`

Funciones que retornan HTML para cada tipo de notificación. Usar HTML inline (no React Email por ahora para mantener simplicidad).

```typescript
// Template 1: Campaña enviada a revisión (para el cliente)
export function campaignReviewTemplate(params: {
  contactName: string;
  campaignName: string;
  companyName: string;
  approvalUrl: string;
  expiresAt: Date;
}): { subject: string; html: string }

// Template 2: Token regenerado (para el cliente)
export function tokenRegeneratedTemplate(params: {
  contactName: string;
  campaignName: string;
  approvalUrl: string;
  expiresAt: Date;
}): { subject: string; html: string }

// Template 3: Campaña aprobada (para el admin/creador)
export function campaignApprovedTemplate(params: {
  campaignName: string;
  clientName: string;
  contactName: string;
  approvedProfiles: number;
  totalProfiles: number;
  approvedServices: number;
  totalServices: number;
}): { subject: string; html: string }

// Template 4: Campaña con rechazos (para el admin/creador)
export function campaignRejectedTemplate(params: {
  campaignName: string;
  clientName: string;
  contactName: string;
  approvedProfiles: number;
  rejectedProfiles: number;
  totalProfiles: number;
  rejectionDetails: Array<{ profileName: string; reason?: string }>;
  campaignUrl: string;
}): { subject: string; html: string }
```

**Diseño de los templates:**
- Estilo limpio con colores de la marca
- Botón CTA prominente para el enlace de aprobación
- Responsive para móviles
- Texto en español (consistente con el UI)
- Footer con info de la empresa

---

### 4. Integración en rutas API

#### A. Campaña → REVIEW (`src/app/api/campaigns/[id]/status/route.ts`)

Después de crear el `CampaignApprovalToken` (línea ~152-164), agregar:

```typescript
// Enviar email al cliente con enlace de aprobación
import { sendEmail } from "@/lib/resend";
import { campaignReviewTemplate } from "@/lib/email-templates";

// ... después de crear el token ...

const approvalUrl = `${process.env.NEXTAUTH_URL}/approve/${approvalToken}`;

const emailTemplate = campaignReviewTemplate({
  contactName: `${campaign.clientContact.firstName} ${campaign.clientContact.lastName}`,
  campaignName: campaign.name,
  companyName: campaign.client.companyName,
  approvalUrl,
  expiresAt,
});

// Enviar sin bloquear la respuesta (fire and forget)
sendEmail({
  to: campaign.clientContact.email,
  ...emailTemplate,
}).catch((err) => console.error("Failed to send review email:", err));
```

#### B. Regenerar token (`src/app/api/campaigns/[id]/regenerate-token/route.ts`)

Después de crear el nuevo token, agregar:

```typescript
const emailTemplate = tokenRegeneratedTemplate({
  contactName: sentToName,
  campaignName: campaign.name,
  approvalUrl: `${process.env.NEXTAUTH_URL}/approve/${newToken}`,
  expiresAt: newExpiresAt,
});

sendEmail({
  to: sentToEmail,
  ...emailTemplate,
}).catch((err) => console.error("Failed to send regenerated token email:", err));
```

#### C. Cliente envía aprobación (`src/app/api/public/approve/[token]/submit/route.ts`)

Después de completar la transacción y determinar si fue aprobación total o parcial:

```typescript
// Obtener email del creador de la campaña
const creator = await prisma.user.findUnique({
  where: { id: campaign.createdById },
  select: { email: true, name: true },
});

const hasRejections = summary.rejectedProfiles > 0;

if (hasRejections) {
  const emailTemplate = campaignRejectedTemplate({
    campaignName: campaign.name,
    clientName: campaign.client.companyName,
    contactName: `${contact.firstName} ${contact.lastName}`,
    approvedProfiles: summary.approvedProfiles,
    rejectedProfiles: summary.rejectedProfiles,
    totalProfiles: summary.totalProfiles,
    rejectionDetails: rejectedDetails,
    campaignUrl: `${process.env.NEXTAUTH_URL}/campaigns/${campaign.id}`,
  });

  sendEmail({ to: creator.email, ...emailTemplate });
} else {
  const emailTemplate = campaignApprovedTemplate({
    campaignName: campaign.name,
    clientName: campaign.client.companyName,
    contactName: `${contact.firstName} ${contact.lastName}`,
    approvedProfiles: summary.approvedProfiles,
    totalProfiles: summary.totalProfiles,
    approvedServices: summary.approvedServices,
    totalServices: summary.totalServices,
  });

  sendEmail({ to: creator.email, ...emailTemplate });
}
```

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `src/lib/resend.ts` | Cliente Resend singleton + función `sendEmail` |
| `src/lib/email-templates.ts` | Templates HTML para los 4 tipos de notificación |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/app/api/campaigns/[id]/status/route.ts` | Agregar envío de email al transicionar a REVIEW |
| `src/app/api/campaigns/[id]/regenerate-token/route.ts` | Agregar envío de email con nuevo token |
| `src/app/api/public/approve/[token]/submit/route.ts` | Agregar notificación al admin según resultado |
| `.env.local` | Agregar `RESEND_API_KEY` y `RESEND_FROM_EMAIL` |

---

## Consideraciones

### Envío no bloqueante
Los emails se envían con `.catch()` (fire and forget) para no bloquear la respuesta de la API. Si el email falla, se logea el error pero la operación principal no se afecta.

### Manejo de errores
- Si `RESEND_API_KEY` no está configurado, `sendEmail` debe retornar silenciosamente sin error para no romper el flujo en desarrollo.
- Agregar check en `src/lib/resend.ts`:
  ```typescript
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return { success: false, error: "No API key" };
  }
  ```

### Dominio verificado en Resend
- En desarrollo: usar `onboarding@resend.dev` (solo envía al email del dueño de la cuenta)
- En producción: verificar dominio propio en el dashboard de Resend

### Futuras mejoras (fuera de este alcance)
- React Email para templates más mantenibles
- Historial de emails enviados en base de datos
- Reintentos automáticos con cola de mensajes
- Preferencias de notificación por usuario
- Email de confirmación al cliente después de enviar su aprobación

---

## Orden de implementación

1. Instalar `resend` y configurar variables de entorno
2. Crear `src/lib/resend.ts` con el cliente y función de envío
3. Crear `src/lib/email-templates.ts` con los 4 templates
4. Integrar en `status/route.ts` (campaña → REVIEW)
5. Integrar en `regenerate-token/route.ts`
6. Integrar en `submit/route.ts` (notificación al admin)
7. Probar flujo completo en desarrollo

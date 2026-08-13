# Plan: Notificaciones Push en Navegador (Web Push Notifications)

## Resumen

Implementar notificaciones push en el navegador para que los usuarios admin/gestores reciban alertas en tiempo real cuando un cliente aprueba o rechaza una campaña, incluso si no tienen la app abierta. El usuario podrá suscribirse/desuscribirse desde la interfaz.

---

## Tecnologías

| Tecnología | Propósito |
|------------|-----------|
| [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) | API del navegador para recibir push |
| [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) | Proceso en segundo plano que escucha las notificaciones |
| [`web-push`](https://www.npmjs.com/package/web-push) | Librería Node.js para enviar notificaciones con VAPID |
| Prisma | Almacenar suscripciones de cada usuario |

---

## Estado Actual

- **No existe** service worker, manifest.json, ni configuración PWA
- **No existe** modelo de suscripción en Prisma
- **No existe** ningún paquete de push notifications instalado
- El layout (`src/app/layout.tsx`) no tiene link al manifest

---

## Arquitectura Propuesta

### Flujo general

```
1. Usuario abre la app → Se registra el Service Worker
2. Usuario hace click en "Activar notificaciones" → Se pide permiso al navegador
3. Navegador genera PushSubscription (endpoint + keys) → Se envía al backend
4. Backend guarda la suscripción en BD (tabla PushSubscription)
5. Cliente aprueba/rechaza campaña → Backend envía push a todos los suscriptores relevantes
6. Service Worker recibe el push → Muestra notificación nativa del sistema
7. Usuario hace click en la notificación → Se abre la campaña en la app
```

---

## 1. Instalación y configuración

### Dependencias

```bash
npm install web-push
npm install -D @types/web-push
```

### Generar claves VAPID

```bash
npx web-push generate-vapid-keys
```

### Variables de entorno nuevas

```env
# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:admin@tudominio.com
```

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` es pública y se expone al cliente para la suscripción.
> `VAPID_PRIVATE_KEY` es secreta y solo se usa en el servidor.

---

## 2. Modelo de base de datos

### Nuevo modelo en `prisma/schema.prisma`

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String                        // Clave pública del cliente
  auth      String                        // Token de autenticación
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### Actualizar modelo User

```prisma
model User {
  // ... campos existentes ...
  pushSubscriptions PushSubscription[]
}
```

Ejecutar:
```bash
npm run db:generate
npm run db:push
```

---

## 3. Service Worker: `public/sw.js`

```javascript
// Escuchar eventos push
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title || "Nueva notificación";
  const options = {
    body: data.body || "",
    icon: "/img/logo.png",
    badge: "/img/logo.png",
    tag: data.tag || "default",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click en la notificación → abrir la URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana abierta, enfocarla y navegar
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Si no, abrir nueva ventana
      return clients.openWindow(url);
    })
  );
});
```

---

## 4. Manifest: `public/manifest.json`

```json
{
  "name": "LDM People's | Los de Marketing",
  "short_name": "LDM People's",
  "description": "Plataforma de gestión de influencers y creadores UGC",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/img/logo.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### Agregar al layout (`src/app/layout.tsx`)

```tsx
export const metadata: Metadata = {
  title: "LDM People's | Los de Marketing",
  description: "Plataforma de gestión de influencers y creadores UGC",
  manifest: "/manifest.json",
};
```

---

## 5. Servicio push del servidor: `src/lib/web-push.ts`

```typescript
import webPush from "web-push";
import { prisma } from "@/lib/prisma";

// Configurar VAPID
if (process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Enviar notificación push a un usuario específico (todas sus suscripciones/dispositivos)
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!process.env.VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured, skipping push");
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error: unknown) {
        // Si la suscripción expiró o es inválida (410 Gone / 404), eliminarla
        if (
          error instanceof webPush.WebPushError &&
          (error.statusCode === 410 || error.statusCode === 404)
        ) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        throw error;
      }
    })
  );

  return results;
}

/**
 * Enviar notificación push a múltiples usuarios
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(userId, payload))
  );
}
```

---

## 6. API Routes para suscripciones

### `src/app/api/notifications/subscribe/route.ts`

```typescript
// POST: Guardar suscripción push del usuario autenticado
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const { endpoint, keys } = await req.json();
  // keys = { p256dh, auth }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return NextResponse.json({ success: true });
}

// DELETE: Eliminar suscripción push
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const { endpoint } = await req.json();

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
```

### `src/app/api/notifications/status/route.ts`

```typescript
// GET: Verificar si el usuario tiene suscripciones activas
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const count = await prisma.pushSubscription.count({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ subscribed: count > 0, count });
}
```

---

## 7. Hook del cliente: `src/hooks/use-push-notifications.ts`

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Registrar SW y verificar estado
  useEffect(() => {
    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setIsLoading(false);
        return;
      }

      setPermission(Notification.permission);

      // Registrar service worker
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Verificar suscripción existente
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      setIsLoading(false);
    }
    init();
  }, []);

  // Suscribirse
  const subscribe = useCallback(async () => {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    // Enviar suscripción al backend
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    setIsSubscribed(true);
    return true;
  }, []);

  // Desuscribirse
  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }

    setIsSubscribed(false);
  }, []);

  return {
    isSupported: typeof window !== "undefined" && "PushManager" in window,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
```

---

## 8. Componente UI: `src/components/notifications/push-toggle.tsx`

Botón/switch en el header o sidebar del dashboard para activar/desactivar notificaciones.

```typescript
"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PushToggle() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) return null; // Navegador no soporta push

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={isLoading || permission === "denied"}
        >
          {isSubscribed ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {permission === "denied"
          ? "Notificaciones bloqueadas en el navegador"
          : isSubscribed
            ? "Desactivar notificaciones"
            : "Activar notificaciones"}
      </TooltipContent>
    </Tooltip>
  );
}
```

### Integrar en el layout del dashboard

Agregar `<PushToggle />` en el header/navbar del dashboard junto a los controles existentes del usuario.

---

## 9. Integración: Enviar push al aprobar/rechazar

### En `src/app/api/public/approve/[token]/submit/route.ts`

Después de completar la transacción de aprobación:

```typescript
import { sendPushToUser } from "@/lib/web-push";

// ... después del submit exitoso ...

const hasRejections = summary.rejectedProfiles > 0;

// Notificar al creador de la campaña
sendPushToUser(campaign.createdById, {
  title: hasRejections
    ? `Campaña con rechazos: ${campaign.name}`
    : `Campaña aprobada: ${campaign.name}`,
  body: hasRejections
    ? `${contact.firstName} rechazó ${summary.rejectedProfiles} perfil(es). Revisa los detalles.`
    : `${contact.firstName} aprobó todos los perfiles (${summary.approvedProfiles}/${summary.totalProfiles}).`,
  url: `/campaigns/${campaign.id}`,
  tag: `campaign-${campaign.id}`,
}).catch((err) => console.error("Push notification error:", err));

// Si el creador no es admin, notificar también a los admins
const admins = await prisma.user.findMany({
  where: { role: "ADMIN", id: { not: campaign.createdById } },
  select: { id: true },
});

for (const admin of admins) {
  sendPushToUser(admin.id, {
    title: hasRejections
      ? `Campaña con rechazos: ${campaign.name}`
      : `Campaña aprobada: ${campaign.name}`,
    body: hasRejections
      ? `${contact.firstName} (${clientName}) rechazó ${summary.rejectedProfiles} perfil(es).`
      : `${contact.firstName} (${clientName}) aprobó la campaña completa.`,
    url: `/campaigns/${campaign.id}`,
    tag: `campaign-${campaign.id}`,
  }).catch((err) => console.error("Push notification error:", err));
}
```

> Las notificaciones se envían con fire-and-forget para no bloquear la respuesta al cliente.

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `public/sw.js` | Service Worker que escucha push y muestra notificaciones |
| `public/manifest.json` | Web App Manifest para PWA básico |
| `src/lib/web-push.ts` | Configuración VAPID + funciones `sendPushToUser` / `sendPushToUsers` |
| `src/hooks/use-push-notifications.ts` | Hook React para registrar SW, suscribirse y desuscribirse |
| `src/components/notifications/push-toggle.tsx` | Botón campana para activar/desactivar notificaciones |
| `src/app/api/notifications/subscribe/route.ts` | API para guardar/eliminar suscripciones |
| `src/app/api/notifications/status/route.ts` | API para verificar estado de suscripción |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar modelo `PushSubscription` y relación en `User` |
| `src/app/layout.tsx` | Agregar `manifest` en metadata |
| `src/app/api/public/approve/[token]/submit/route.ts` | Enviar push al creador y admins |
| Layout/header del dashboard | Integrar `<PushToggle />` |
| `.env.local` | Agregar `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

---

## Consideraciones

### Compatibilidad de navegadores
- Chrome, Edge, Firefox: soporte completo
- Safari (macOS/iOS 16.4+): soporte con limitaciones
- El componente `PushToggle` se oculta si el navegador no soporta la API

### Suscripciones expiradas
- `web-push` retorna 410 (Gone) cuando una suscripción ya no es válida
- `sendPushToUser` elimina automáticamente esas suscripciones de la BD

### Múltiples dispositivos
- Un usuario puede tener varias suscripciones (PC, laptop, celular)
- Cada dispositivo/navegador genera su propio `endpoint`
- Se envía push a todos los dispositivos del usuario

### Seguridad
- Las rutas de suscripción requieren autenticación (`await auth()`)
- Las claves VAPID privadas nunca se exponen al cliente
- Solo `NEXT_PUBLIC_VAPID_PUBLIC_KEY` es accesible desde el frontend

### Sin VAPID configurado
- Si `VAPID_PRIVATE_KEY` no está en las env vars, `sendPushToUser` no hace nada (skip silencioso)
- En desarrollo se puede probar con claves VAPID generadas localmente

---

## Orden de implementación

1. Generar claves VAPID y agregar a `.env.local`
2. Instalar `web-push` y generar Prisma client
3. Agregar modelo `PushSubscription` en schema y ejecutar `db:push`
4. Crear `public/manifest.json` y `public/sw.js`
5. Agregar manifest al layout
6. Crear `src/lib/web-push.ts` (servicio servidor)
7. Crear API routes de suscripción (`/api/notifications/subscribe` y `/api/notifications/status`)
8. Crear hook `use-push-notifications.ts`
9. Crear componente `PushToggle` e integrar en header del dashboard
10. Integrar envío de push en `submit/route.ts` (aprobación del cliente)
11. Probar flujo completo en desarrollo (Chrome DevTools → Application → Service Workers)

---

## Relación con el plan de Resend

Este módulo es **complementario** al plan de [notificaciones por email con Resend](./notificaciones-resend.md):

| Canal | Cuándo | Para quién |
|-------|--------|------------|
| **Email (Resend)** | Campaña → REVIEW | Cliente (enlace de aprobación) |
| **Email (Resend)** | Token regenerado | Cliente (nuevo enlace) |
| **Email (Resend)** | Cliente aprueba/rechaza | Admin/creador (resumen) |
| **Push (Web Push)** | Cliente aprueba/rechaza | Admin/creador (alerta instantánea) |

Ambos se disparan en el mismo punto (`submit/route.ts`) pero sirven propósitos diferentes: el email es el registro formal, el push es la alerta inmediata.

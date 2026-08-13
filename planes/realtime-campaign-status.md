# Plan: Actualización en Tiempo Real del Estado de Campañas

## Problema

Cuando un cliente aprueba o rechaza perfiles desde la página de aprobación (`/approve/[token]`), el admin que está viendo la campaña en el dashboard no ve el cambio de estado hasta que recarga la página manualmente.

---

## Estado Actual

### Flujo actual
```
Cliente aprueba → API actualiza BD → Email al creador → Admin NO ve el cambio
Admin debe recargar manualmente para ver: REVIEW → ACTIVE o REVIEW → PENDING
```

### Arquitectura actual
- La página de detalle de campaña (`/campaigns/[id]`) es un **Server Component** que renderiza datos de Prisma
- `CampaignStatusActions` usa `router.refresh()` solo cuando el propio admin hace una acción
- **No hay polling, SSE, WebSockets ni ningún mecanismo de tiempo real**

---

## Solución: Polling con Hook Personalizado

Se elige **polling** por ser la opción más simple y sin dependencias externas. Un hook `useCampaignPolling` consulta el estado periódicamente y dispara un `router.refresh()` cuando detecta un cambio.

### ¿Por qué polling?
- No requiere infraestructura adicional (WebSockets, Pusher, etc.)
- Funciona en cualquier entorno (Vercel, VPS, local)
- Suficiente para el caso de uso (el admin espera la respuesta del cliente, no necesita latencia de milisegundos)
- Fácil de reemplazar por SSE o WebSockets a futuro si es necesario

---

## Implementación

### 1. API endpoint ligero: `GET /api/campaigns/[id]/status`

Endpoint que retorna solo el estado mínimo de la campaña (sin toda la data pesada).

**Archivo:** `src/app/api/campaigns/[id]/status/route.ts` (agregar GET al archivo existente)

```typescript
export async function GET(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      status: true,
      updatedAt: true,
      profiles: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    status: campaign.status,
    updatedAt: campaign.updatedAt,
    profileCounts: {
      total: campaign.profiles.length,
      approved: campaign.profiles.filter(p => p.status === "APPROVED").length,
      rejected: campaign.profiles.filter(p => p.status === "REJECTED").length,
      pending: campaign.profiles.filter(p => p.status === "PENDING").length,
    },
  });
}
```

**Respuesta (~200 bytes):** Solo status, updatedAt y conteos. Muy ligero.

---

### 2. Hook de polling: `src/hooks/use-campaign-polling.ts`

Hook que usa **TanStack Query** con `refetchInterval` para el polling y dispara `router.refresh()` cuando detecta un cambio de estado.

```typescript
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { apiGet } from "@/services/api";

interface CampaignStatusData {
  status: string;
  updatedAt: string;
  profileCounts: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
}

interface UseCampaignPollingOptions {
  campaignId: string;
  currentStatus: string;
  enabled?: boolean;      // Solo activar en estados donde se espera un cambio
  intervalMs?: number;    // Default: 15000 (15 segundos)
}

export function useCampaignPolling({
  campaignId,
  currentStatus,
  enabled = true,
  intervalMs = 15000,
}: UseCampaignPollingOptions) {
  const router = useRouter();
  const lastStatusRef = useRef(currentStatus);

  const { data } = useQuery<CampaignStatusData>({
    queryKey: ["campaign-status", campaignId],
    queryFn: () => apiGet<CampaignStatusData>(`/api/campaigns/${campaignId}/status`),
    refetchInterval: enabled ? intervalMs : false,
    enabled,
  });

  useEffect(() => {
    if (data && data.status !== lastStatusRef.current) {
      lastStatusRef.current = data.status;
      router.refresh();
    }
  }, [data, router]);
}
```

**Ventajas vs. `setInterval` manual:**
- TanStack Query maneja reintentos, pausa en tab oculto y deduplicación automáticamente
- El `queryKey` permite invalidar manualmente si se necesita desde otro componente
- Mismo patrón que el resto del proyecto

---

### 3. Componente wrapper: `src/components/campaigns/campaign-polling.tsx`

Componente client que usa el hook. Se monta en la página de detalle.

```typescript
"use client";

import { useCampaignPolling } from "@/hooks/use-campaign-polling";
import type { CampaignStatus } from "@prisma/client";

interface CampaignPollingProps {
  campaignId: string;
  currentStatus: CampaignStatus;
}

// Estados donde se espera un cambio externo (cliente revisando)
const POLLABLE_STATUSES: CampaignStatus[] = ["REVIEW"];

export function CampaignPolling({ campaignId, currentStatus }: CampaignPollingProps) {
  useCampaignPolling({
    campaignId,
    currentStatus,
    enabled: POLLABLE_STATUSES.includes(currentStatus),
  });

  return null; // No renderiza nada, solo el efecto
}
```

---

### 4. Integrar en la página de detalle

**Archivo:** `src/app/(dashboard)/campaigns/[id]/page.tsx`

Agregar el componente de polling en la página (server component puede montar client components).

```diff
+ import { CampaignPolling } from "@/components/campaigns/campaign-polling";

  return (
    <div className="space-y-6">
+     <CampaignPolling campaignId={id} currentStatus={campaign.status} />
      {/* Header */}
      ...
```

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `src/hooks/use-campaign-polling.ts` | Hook de polling con detección de cambios |
| `src/components/campaigns/campaign-polling.tsx` | Componente wrapper client-only |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/app/api/campaigns/[id]/status/route.ts` | Agregar handler `GET` ligero |
| `src/app/(dashboard)/campaigns/[id]/page.tsx` | Montar `<CampaignPolling />` |

---

## Comportamiento

1. Admin abre detalle de campaña en estado `REVIEW`
2. `CampaignPolling` se monta y activa el polling cada 15 segundos
3. Cliente abre enlace de aprobación y aprueba/rechaza perfiles
4. API cambia estado de `REVIEW` a `ACTIVE` o `PENDING`
5. En el próximo ciclo de polling (~15s máx), el hook detecta que el status cambió
6. Llama `router.refresh()` → Server Component se re-renderiza con datos frescos
7. Admin ve el nuevo estado sin recargar

### Cuándo se activa el polling
- **Solo en estado `REVIEW`** — es el único estado donde se espera un cambio externo del cliente
- En `DRAFT`, `PENDING`, `ACTIVE`, etc. el polling está desactivado (los cambios los hace el propio admin con `router.refresh()`)

---

## Consideraciones

### Carga del servidor
- El endpoint `GET /status` es muy ligero (1 query simple, ~200 bytes de respuesta)
- Polling cada 15 segundos es conservador (solo 4 requests/minuto por pestaña abierta)
- Solo se activa cuando la campaña está en REVIEW

### Limpieza automática
- `useEffect` con cleanup: cuando el admin sale de la página, el polling se detiene
- Si el status cambia a ACTIVE/PENDING, el polling se desactiva automáticamente

### Futuras mejoras (fuera de este alcance)
- Migrar a SSE si el polling genera mucha carga
- Agregar toast/notificación visual cuando se detecta un cambio
- Polling en la lista de campañas (no solo en detalle)
- Indicador visual "Cliente está revisando en este momento"

---

## Orden de implementación

1. Agregar handler `GET` en `src/app/api/campaigns/[id]/status/route.ts`
2. Crear `src/hooks/use-campaign-polling.ts`
3. Crear `src/components/campaigns/campaign-polling.tsx`
4. Montar en `src/app/(dashboard)/campaigns/[id]/page.tsx`
5. Probar flujo completo: abrir detalle en REVIEW → aprobar desde otra pestaña → verificar refresh automático

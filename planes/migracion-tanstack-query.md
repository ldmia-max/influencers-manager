# Plan: Migrar a TanStack Query (React Query v5)

## Contexto

Actualmente el data fetching del lado cliente usa `fetch()` + `useState` + `useEffect` manualmente en ~30 componentes. Cada componente maneja su propio estado de loading, error y data. Las mutaciones (POST/PUT/DELETE) usan `fetch()` directo con `router.refresh()` para revalidar.

Ya existe una capa de servicios en `src/services/` con helpers tipados (`apiGet`, `apiPost`, `apiPut`, `apiDelete`) que encapsulan `fetch()`. Esta capa se reutilizara como `queryFn` / `mutationFn` de TanStack Query.

**Lo que NO cambia:** Los Server Components siguen usando `src/data-access/` con Prisma directo + `"use cache"`. TanStack Query solo aplica al lado cliente.

## Beneficios esperados

- Eliminar ~65 `useState` manuales de loading/error/data
- Cache automatico + deduplicacion de requests identicos
- Reintentos automaticos en errores de red
- Invalidacion declarativa (no mas `router.refresh()` dispersos)
- Queries dependientes con `enabled` (reemplaza cascadas de `useEffect`)
- DevTools para debug visual de cache/queries
- Optimistic updates para UX instantanea

## Dependencias a instalar

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

No hay conflictos con Next.js 16, React 19, ni React Hook Form.

---

## Estructura de archivos nuevos

```
src/
  providers/
    query-provider.tsx          # QueryClientProvider wrapper
  lib/
    query-keys.ts               # Factory de query keys tipadas
  hooks/
    queries/
      use-profiles.ts           # useProfile, useProfiles
      use-campaigns.ts          # useCampaign, useCampaigns
      use-clients.ts            # useClient, useClients
      use-locations.ts          # useCountries, useDepartments, useCities
      use-categories.ts         # useCategories
      use-platforms.ts          # usePlatforms
      use-admin.ts              # useUsers, useServiceTypes, etc.
      use-approval.ts           # useApprovalData
      use-reach-ranges.ts       # useReachRanges (reemplaza context)
    mutations/
      use-profile-mutations.ts  # useCreateProfile, useUpdateProfile, useDeleteProfile
      use-campaign-mutations.ts # useCreateCampaign, useUpdateCampaign, etc.
      use-client-mutations.ts   # useCreateClient, useDeleteClient, etc.
      use-admin-mutations.ts    # CRUD de platforms, service-types, users, etc.
      use-approval-mutations.ts # useSubmitApproval
```

---

## Fase 0: Setup base

### 0.1 Instalar dependencias

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 0.2 Crear QueryClientProvider

```tsx
// src/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,       // 1 min antes de refetch
            gcTime: 5 * 60 * 1000,      // 5 min en cache
            retry: 1,
            refetchOnWindowFocus: false, // evitar refetch agresivo
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 0.3 Integrar en layout

Agregar `<QueryProvider>` en `src/app/(dashboard)/layout.tsx` envolviendo el contenido, al mismo nivel que los otros providers existentes.

### 0.4 Crear query keys factory

```tsx
// src/lib/query-keys.ts
export const queryKeys = {
  profiles: {
    all: ["profiles"] as const,
    list: (filters?: Record<string, string>) =>
      [...queryKeys.profiles.all, "list", filters] as const,
    detail: (id: string) =>
      [...queryKeys.profiles.all, "detail", id] as const,
  },
  campaigns: {
    all: ["campaigns"] as const,
    list: (filters?: Record<string, string>) =>
      [...queryKeys.campaigns.all, "list", filters] as const,
    detail: (id: string) =>
      [...queryKeys.campaigns.all, "detail", id] as const,
  },
  clients: {
    all: ["clients"] as const,
    list: (filters?: Record<string, string>) =>
      [...queryKeys.clients.all, "list", filters] as const,
    detail: (id: string) =>
      [...queryKeys.clients.all, "detail", id] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  platforms: {
    all: ["platforms"] as const,
  },
  locations: {
    countries: ["locations", "countries"] as const,
    departments: (countryId: string) =>
      ["locations", "departments", countryId] as const,
    cities: (departmentId: string) =>
      ["locations", "cities", departmentId] as const,
  },
  reachRanges: {
    all: ["reach-ranges"] as const,
  },
  genders: {
    all: ["genders"] as const,
  },
  admin: {
    users: ["admin", "users"] as const,
    platforms: ["admin", "platforms"] as const,
    serviceTypes: ["admin", "service-types"] as const,
    reachRanges: ["admin", "reach-ranges"] as const,
  },
  approval: {
    data: (token: string) => ["approval", token] as const,
  },
} as const;
```

---

## Fase 1: Queries simples (GET) - Prioridad alta

Migrar componentes que usan `useEffect` + `fetch()` para cargar datos.

### 1.1 Profile Detail Sheet

**Archivo:** `src/components/profiles/profile-detail-sheet.tsx`

**Antes:**
```tsx
const [profile, setProfile] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (profileId) {
    setLoading(true);
    fetch(`/api/profiles/${profileId}`)
      .then(res => res.json())
      .then(data => { setProfile(data); setLoading(false); });
  }
}, [profileId]);
```

**Despues:**
```tsx
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet } from "@/services/api";

const { data: profile, isLoading } = useQuery({
  queryKey: queryKeys.profiles.detail(profileId),
  queryFn: () => apiGet(`/api/profiles/${profileId}`),
  enabled: !!profileId,
});
```

### 1.2 Queries dependientes de ubicacion (ProfileForm)

**Archivo:** `src/components/forms/profile-form.tsx`

**Antes:** Dos `useEffect` encadenados (pais → departamento → ciudad)

**Despues:**
```tsx
const { data: departments } = useQuery({
  queryKey: queryKeys.locations.departments(countryId),
  queryFn: () => apiGet(`/api/admin/departments?countryId=${countryId}`),
  enabled: !!countryId,
});

const { data: cities } = useQuery({
  queryKey: queryKeys.locations.cities(departmentId),
  queryFn: () => apiGet(`/api/admin/cities?departmentId=${departmentId}`),
  enabled: !!departmentId,
});
```

### 1.3 Pagina de aprobacion

**Archivo:** `src/app/approve/[token]/page.tsx`

**Antes:** `useEffect` complejo con multiples estados

**Despues:**
```tsx
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.approval.data(token),
  queryFn: () => apiGet(`/api/public/approve/${token}`),
});
```

### 1.4 Reemplazar ReachRangesContext

**Archivo:** `src/contexts/reach-ranges-context.tsx` → `src/hooks/queries/use-reach-ranges.ts`

El context actual hace un `fetch` y guarda en estado. TanStack Query hace lo mismo con cache gratis:

```tsx
// src/hooks/queries/use-reach-ranges.ts
export function useReachRanges() {
  return useQuery({
    queryKey: queryKeys.reachRanges.all,
    queryFn: () => apiGet<ReachRangeData[]>("/api/locations/reach-ranges"),
    staleTime: Infinity, // datos de referencia, no cambian seguido
  });
}
```

Luego reemplazar `useReachRanges()` del context por el hook nuevo. Eliminar `ReachRangesProvider` del layout.

---

## Fase 2: Mutaciones simples - Prioridad alta

### 2.1 Patron base para mutaciones

```tsx
// src/hooks/mutations/use-profile-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProfilePayload) => apiPost("/api/profiles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProfilePayload }) =>
      apiPut(`/api/profiles/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}
```

### 2.2 Migrar dialogos de delete

**Archivos:**
- `src/components/profiles/delete-profile-dialog.tsx`
- `src/components/clients/delete-client-dialog.tsx`
- `src/components/campaigns/delete-campaign-dialog.tsx`

**Antes:**
```tsx
const [loading, setLoading] = useState(false);
const handleDelete = async () => {
  setLoading(true);
  try {
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    router.refresh();
    onClose();
  } finally {
    setLoading(false);
  }
};
```

**Despues:**
```tsx
const deleteMutation = useDeleteProfile();
const handleDelete = () => {
  deleteMutation.mutate(id, {
    onSuccess: () => onClose(),
  });
};
// loading = deleteMutation.isPending
// error = deleteMutation.error
```

### 2.3 Migrar formularios de creacion/edicion

**Archivos:**
- `src/components/forms/profile-form.tsx` (submit)
- `src/components/forms/client-form.tsx` (submit)
- `src/components/forms/campaign-form.tsx` (submit)

Usar `useCreateX` / `useUpdateX` segun modo. El `onSuccess` de la mutacion invalida las queries relevantes.

### 2.4 Migrar admin CRUD

**Archivos:** Todos los dialogos en `src/app/admin/` (platforms, service-types, reach-ranges, users, locations)

Crear `useAdminMutations()` con create/update/delete para cada entidad admin.

---

## Fase 3: Mutaciones complejas - Prioridad media

### 3.1 Campaign status transitions

**Archivo:** `src/app/(dashboard)/campaigns/[id]/page.tsx`

Mutaciones para cambiar status de campana (DRAFT → REVIEW → ACTIVE, etc.):

```tsx
export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch(`/api/campaigns/${id}/status`, { status }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}
```

### 3.2 Aprobacion de campana

**Archivo:** `src/app/approve/[token]/page.tsx`

```tsx
export function useSubmitApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, decisions }: ApprovalPayload) =>
      apiPost(`/api/public/approve/${token}/submit`, { decisions }),
    onSuccess: (_, { token }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approval.data(token) });
    },
  });
}
```

### 3.3 Sync de metricas sociales

**Archivo:** `src/app/(dashboard)/profiles/[id]/page.tsx`

```tsx
export function useSyncProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiPost(`/api/profiles/${id}/sync`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(id) });
    },
  });
}
```

---

## Fase 4: Optimizaciones - Prioridad baja

### 4.1 Prefetching en navegacion

Cargar datos antes de que el usuario haga click:

```tsx
// En lista de perfiles, al hacer hover sobre un perfil
const queryClient = useQueryClient();

const handlePrefetch = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: queryKeys.profiles.detail(id),
    queryFn: () => apiGet(`/api/profiles/${id}`),
    staleTime: 30_000,
  });
};
```

### 4.2 Optimistic updates para toggles

Para acciones rapidas como activar/desactivar:

```tsx
const toggleMutation = useMutation({
  mutationFn: ({ id, active }: { id: string; active: boolean }) =>
    apiPatch(`/api/admin/platforms/${id}`, { active }),
  onMutate: async ({ id, active }) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.admin.platforms });
    const previous = queryClient.getQueryData(queryKeys.admin.platforms);
    queryClient.setQueryData(queryKeys.admin.platforms, (old) =>
      old?.map((p) => (p.id === id ? { ...p, active } : p))
    );
    return { previous };
  },
  onError: (_, __, context) => {
    queryClient.setQueryData(queryKeys.admin.platforms, context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.platforms });
  },
});
```

### 4.3 Polling para campanas activas

```tsx
const { data } = useQuery({
  queryKey: queryKeys.campaigns.detail(id),
  queryFn: () => apiGet(`/api/campaigns/${id}`),
  refetchInterval: campaign?.status === "ACTIVE" ? 30_000 : false,
});
```

---

## Relacion con `src/services/`

Los servicios existentes se **mantienen**. Las funciones de `src/services/` se usan como `queryFn` y `mutationFn`:

```
src/services/api.ts       → apiGet, apiPost, apiPut, apiDelete (se usan directo)
src/services/profile.ts   → funciones especificas como queryFn/mutationFn
src/services/campaign.ts  → funciones especificas como queryFn/mutationFn
```

No se duplica logica. TanStack Query orquesta **cuando** y **como** se llaman, los servicios definen **que** se llama.

## Relacion con Server Components

```
Server Components (RSC)           Client Components
─────────────────────            ─────────────────────
src/data-access/*.ts             src/hooks/queries/*.ts
Prisma directo                   TanStack Query + fetch
"use cache" + cacheTag           queryKey + staleTime
revalidateTag()                  invalidateQueries()
```

Ambos sistemas coexisten. Los RSC cargan datos iniciales, los client components usan TanStack Query para interactividad.

## Relacion con `router.refresh()`

Despues de la migracion, `router.refresh()` se puede **eliminar** en la mayoria de mutaciones porque `invalidateQueries()` ya refresca los datos del cache cliente. Solo mantener `router.refresh()` cuando el server component padre necesita re-renderizar con datos frescos del servidor.

---

## Orden de implementacion recomendado

| # | Tarea | Archivos | Complejidad |
|---|-------|----------|-------------|
| 1 | Setup base (provider + query keys) | 3 archivos nuevos + 1 layout edit | Baja |
| 2 | Profile detail sheet (query) | 1 archivo | Baja |
| 3 | Delete dialogs (mutations) | 3 archivos | Baja |
| 4 | Location cascading queries | 1 archivo (profile-form) | Media |
| 5 | ReachRanges context → hook | 2 archivos (context + consumidores) | Baja |
| 6 | Approval page (query + mutation) | 1 archivo | Media |
| 7 | Profile form submit (mutation) | 1 archivo | Media |
| 8 | Campaign form submit (mutation) | 1 archivo | Media |
| 9 | Client form submit (mutation) | 1 archivo | Baja |
| 10 | Admin CRUD mutations | ~5 archivos admin | Media |
| 11 | Campaign status mutations | 1 archivo | Baja |
| 12 | Sync social metrics mutation | 1 archivo | Baja |
| 13 | Prefetching en navegacion | Varios | Baja |
| 14 | Optimistic updates | Varios | Media |

## Notas importantes

- **No romper nada:** Se puede migrar incrementalmente, componente por componente
- **No tocar Server Components:** Solo se migra lo que esta en `"use client"`
- **Mantener `src/services/`:** Son los building blocks que TanStack Query orquesta
- **DevTools solo en dev:** `<ReactQueryDevtools>` se auto-excluye en produccion
- **Testing:** Los hooks de TanStack Query se testean con `renderHook` + `QueryClientProvider` wrapper

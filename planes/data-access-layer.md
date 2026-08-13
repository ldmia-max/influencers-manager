# Plan: Extraer Prisma a `src/data-access/`

## Contexto

Actualmente hay **48 archivos** en `src/app/` que importan `prisma` directamente (33 API routes + 15 pages). Las queries de Prisma estan mezcladas con logica HTTP, autenticacion y formateo de respuestas. Esto dificulta reutilizacion, testing y mantenimiento.

Ya existe `src/lib/cache.ts` con funciones cacheadas (`getCachedProfiles`, `getCachedPlatforms`, etc.) que son esencialmente funciones de data-access. Se moveran a la nueva carpeta.

## Estructura propuesta

```
src/data-access/
  index.ts                  # Re-exports
  profiles.ts               # Profile CRUD + queries cacheadas
  campaigns.ts              # Campaign CRUD + status transitions
  campaign-profiles.ts      # Campaign profile/platform/service management
  campaign-approval.ts      # Approval tokens + public approval flow
  clients.ts                # Client CRUD + client access
  categories.ts             # Category CRUD
  users.ts                  # User/auth CRUD
  platforms.ts              # SocialPlatform CRUD
  service-types.ts          # ServiceType CRUD
  reach-ranges.ts           # ReachRange CRUD
  locations.ts              # Country/Department/City CRUD
  genders.ts                # Gender CRUD
```

## Decisiones de diseno

1. **Un archivo por entidad** (no queries.ts + mutations.ts) - el proyecto es mediano, un solo archivo por dominio es mas navegable
2. **`revalidateTag()` se queda en data-access** - cache.ts ya usa `"use cache"` + `cacheTag()`, es consistente mantener invalidacion junto a las mutations
3. **Funciones cacheadas de `src/lib/cache.ts` se mueven a data-access** - `cache.ts` se convierte en re-export shim para no romper imports existentes
4. **Chat route (`api/chat/campaign/route.ts`) se excluye** - tiene queries Prisma dentro de herramientas AI, refactorizarlo requiere reestructurar el dispatch de tools. Se hara despues.
5. **Las funciones lanzan errores tipados** - API routes los capturan y mapean a HTTP status codes

## Patron resultado en API routes

```typescript
// ANTES: 60+ lineas de Prisma inline
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({error: "..."}, {status: 401});
  const body = await req.json();
  // ... 50 lineas de prisma.X.create/findMany/transaction...
}

// DESPUES: route delgada
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({error: "No autorizado"}, {status: 401});
    const body = await req.json();
    const result = await createProfile({ ...body, createdById: session.user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
```

## Orden de implementacion

### Fase 1: Fundacion
1. Crear `src/data-access/` carpeta

### Fase 2: Entidades admin simples (bajo riesgo, establecer patron)
2. `genders.ts` + actualizar `api/genders/route.ts`
3. `platforms.ts` + actualizar `api/admin/platforms/` routes + `admin/platforms/page.tsx`
4. `service-types.ts` + actualizar routes + page
5. `reach-ranges.ts` + actualizar routes + page
6. `locations.ts` + actualizar routes de countries/departments/cities + `admin/locations/page.tsx`
7. `users.ts` + actualizar routes + page + `api/auth/register/route.ts`

### Fase 3: Complejidad media
8. `categories.ts` + actualizar routes + page
9. `clients.ts` + actualizar routes + pages (incluye `$transaction` para contacts y client access)

### Fase 4: Profiles (incluye mover cache.ts)
10. `profiles.ts` - mover funciones cacheadas de `cache.ts`, extraer CRUD de profile routes
11. Actualizar `src/lib/cache.ts` como re-export shim
12. Actualizar todos los profile API routes + pages

### Fase 5: Campaigns (mas complejo, mas `$transaction`)
13. `campaigns.ts` - CRUD + state machine de status
14. `campaign-profiles.ts` - asignacion de profiles a campaigns
15. `campaign-approval.ts` - tokens + flujo de aprobacion publica
16. Actualizar todos los campaign API routes + pages

### Fase 6: Indice + limpieza
17. Crear `src/data-access/index.ts` con barrel exports
18. Verificar que no quede `import { prisma }` en `src/app/` (excepto chat)

## Archivos criticos a modificar

**Nuevos (13 archivos):**
- `src/data-access/*.ts` (13 archivos listados arriba)

**Modificados - API routes (33 archivos):**
- `src/app/api/genders/route.ts`
- `src/app/api/admin/platforms/route.ts` + `[id]/route.ts`
- `src/app/api/admin/service-types/route.ts` + `[id]/route.ts`
- `src/app/api/admin/reach-ranges/route.ts` + `[id]/route.ts`
- `src/app/api/admin/countries/route.ts` + `[id]/route.ts`
- `src/app/api/admin/departments/route.ts` + `[id]/route.ts`
- `src/app/api/admin/cities/route.ts` + `[id]/route.ts`
- `src/app/api/admin/users/route.ts` + `[id]/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/categories/route.ts` + `[id]/route.ts`
- `src/app/api/clients/route.ts` + `[id]/route.ts` + `[id]/access/route.ts`
- `src/app/api/profiles/route.ts` + `[id]/route.ts` + `[id]/sync/route.ts`
- `src/app/api/campaigns/route.ts` + `[id]/route.ts` + `[id]/profiles/route.ts` + `[id]/status/route.ts` + `[id]/regenerate-token/route.ts`
- `src/app/api/public/approve/[token]/route.ts` + `submit/route.ts`
- `src/app/api/client-auth/login/route.ts`

**Modificados - Pages (15 archivos):**
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/campaigns/page.tsx` + `[id]/page.tsx` + `[id]/edit/page.tsx` + `new/page.tsx` + `new/from-cart/page.tsx`
- `src/app/(dashboard)/profiles/[id]/edit/page.tsx`
- `src/app/(dashboard)/clients/page.tsx` + `[id]/edit/page.tsx`
- `src/app/(dashboard)/categories/page.tsx`
- `src/app/admin/platforms/page.tsx`
- `src/app/admin/service-types/page.tsx`
- `src/app/admin/reach-ranges/page.tsx`
- `src/app/admin/locations/page.tsx`
- `src/app/admin/users/page.tsx`

**Modificado - Cache shim:**
- `src/lib/cache.ts` - se convierte en re-exports desde data-access

## Verificacion

- `npm run build` debe compilar sin errores despues de cada fase
- Verificar que no queden imports de `prisma` en `src/app/` (excepto chat route)
- Verificar que `src/lib/cache.ts` solo re-exporta

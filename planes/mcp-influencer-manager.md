# Plan: MCP Server — Influencer Manager

## Objetivo

Crear un servidor MCP (Model Context Protocol) standalone que exponga las operaciones del sistema de gestión de influencers a cualquier cliente compatible (Claude Desktop, Cursor, Windsurf, etc.), permitiendo consultar campañas, crear campañas, buscar y registrar perfiles de influencers directamente desde el asistente de IA.

---

## Arquitectura general

```
Cliente MCP (Claude Desktop / Cursor)
        ↓ stdio / SSE
MCP Server (Node.js + TypeScript)
        ↓ HTTP / fetch
API REST de Next.js (ya existente en localhost:3000)
        ↓ Prisma
PostgreSQL
```

El servidor MCP actúa como un cliente HTTP sobre la API existente del proyecto Next.js. **No accede a Prisma directamente** — reutiliza los endpoints ya construidos, con autenticación por API key o cookie de sesión.

---

## Decisiones técnicas

| Decisión | Opción elegida | Razón |
|---|---|---|
| SDK | `@modelcontextprotocol/sdk` (oficial) | Estándar, soporte nativo en Claude Desktop |
| Transporte | `stdio` (desarrollo) + `SSE` (producción) | stdio es lo más simple para arrancar |
| Auth con la API | API key custom en header `X-API-Key` | Evita gestionar cookies de sesión |
| Ubicación del server | `src/mcp/` dentro del mismo repo | Comparte tipos desde `src/models/` |
| Runtime | `ts-node` / `tsx` | Ya está en el proyecto |
| Formato de IDs | Strings (cuid) | Igual que el proyecto |

### API Key para el MCP

Se agrega un middleware en Next.js que acepta el header `X-API-Key: <secret>` para que el MCP server pueda autenticarse sin flujo de login. La key se define en `.env.local` como `MCP_API_KEY`.

---

## Herramientas (Tools) a implementar

### Perfil / Influencer

| Tool | Método | Endpoint | Descripción |
|---|---|---|---|
| `search_profiles` | GET | `/api/profiles` | Buscar perfiles con filtros (nombre, tipo, plataforma, país) |
| `get_profile` | GET | `/api/profiles/:id` | Ver detalle completo de un perfil |
| `create_profile` | POST | `/api/profiles` | Registrar nuevo influencer/UGC |
| `update_profile` | PUT | `/api/profiles/:id` | Actualizar datos de un perfil |
| `sync_profile` | POST | `/api/profiles/:id/sync` | Sincronizar métricas desde Instagram/TikTok vía Apify |

### Campaña

| Tool | Método | Endpoint | Descripción |
|---|---|---|---|
| `list_campaigns` | GET | `/api/campaigns` | Listar campañas con filtros opcionales |
| `get_campaign` | GET | `/api/campaigns/:id` | Ver detalle completo de una campaña |
| `create_campaign` | POST | `/api/campaigns` | Crear nueva campaña (nombre, cliente, presupuesto, fechas) |
| `update_campaign` | PUT | `/api/campaigns/:id` | Actualizar datos de una campaña |
| `update_campaign_status` | PATCH | `/api/campaigns/:id/status` | Cambiar estado (DRAFT→REVIEW→ACTIVE, etc.) |
| `add_profiles_to_campaign` | POST | `/api/campaigns/:id/profiles` | Agregar perfiles con sus plataformas y servicios |

### Referencia (solo lectura)

| Tool | Método | Endpoint | Descripción |
|---|---|---|---|
| `list_clients` | GET | `/api/clients` | Listar clientes disponibles |
| `list_platforms` | GET | `/api/admin/platforms` | Listar plataformas activas |
| `list_categories` | GET | `/api/categories` | Listar categorías de contenido |
| `list_service_types` | GET | `/api/admin/service-types` | Listar tipos de servicio por plataforma |

---

## Recursos (Resources) a implementar

Los Resources exponen datos sin parámetros, ideales para contexto estático:

| Resource | URI | Descripción |
|---|---|---|
| Plataformas activas | `influencer://platforms` | Lista de plataformas (Instagram, TikTok, etc.) |
| Categorías | `influencer://categories` | Categorías de contenido disponibles |
| Tipos de servicio | `influencer://service-types` | Servicios por plataforma |
| Estados de campaña | `influencer://campaign-statuses` | Estados posibles y transiciones válidas |

---

## Estructura de archivos

```
src/mcp/
├── index.ts              ← Punto de entrada del servidor MCP
├── server.ts             ← Configuración del McpServer (nombre, versión)
├── client.ts             ← Cliente HTTP hacia la API de Next.js (fetch + auth header)
├── tools/
│   ├── index.ts          ← Registro de todos los tools
│   ├── profiles.ts       ← search_profiles, get_profile, create_profile, update_profile, sync_profile
│   ├── campaigns.ts      ← list_campaigns, get_campaign, create_campaign, update_campaign, update_campaign_status, add_profiles_to_campaign
│   └── reference.ts      ← list_clients, list_platforms, list_categories, list_service_types
├── resources/
│   ├── index.ts          ← Registro de todos los resources
│   └── static.ts         ← platforms, categories, service-types, campaign-statuses
└── schemas/
    ├── profile.ts        ← Zod schemas para los parámetros de tools de perfil
    ├── campaign.ts       ← Zod schemas para los parámetros de tools de campaña
    └── shared.ts         ← Tipos comunes (paginación, filtros)
```

---

## Cambios en el proyecto Next.js

### 1. Variable de entorno

```env
# .env.local
MCP_API_KEY=<secret-aleatorio-32-chars>
MCP_BASE_URL=http://localhost:3000   # o la URL de producción
```

### 2. Middleware de autenticación por API key

Archivo: `src/lib/mcp-auth.ts`

```typescript
// Verifica X-API-Key en rutas de la API
export function validateMcpApiKey(req: Request): boolean {
  const key = req.headers.get("X-API-Key");
  return key === process.env.MCP_API_KEY;
}
```

Se integra en las rutas API existentes (alternativa: un middleware de Next.js en `src/proxy.ts` que intercepta `/api/*`).

### 3. Script de inicio del MCP server

```json
// package.json
{
  "scripts": {
    "mcp": "tsx src/mcp/index.ts",
    "mcp:dev": "tsx watch src/mcp/index.ts"
  }
}
```

---

## Implementación detallada de Tools

### `search_profiles`

**Input schema:**
```typescript
{
  query?: string,           // Búsqueda por nombre o username
  type?: "INFLUENCER" | "UGC" | "BOTH",
  platformId?: string,
  categoryId?: string,
  countryId?: string,
  minFollowers?: number,
  maxFollowers?: number,
  page?: number,            // default: 1
  pageSize?: number         // default: 10
}
```

**Output:** Lista de perfiles con nombre, tipo, plataformas, seguidores, categorías.

---

### `get_profile`

**Input schema:**
```typescript
{ id: string }
```

**Output:** Perfil completo: datos personales (email, teléfono), ubicación, cuentas sociales con métricas y servicios/precios, categorías.

---

### `create_profile`

**Input schema:**
```typescript
{
  name: string,
  type: "INFLUENCER" | "UGC" | "BOTH",
  email?: string,
  phone?: string,
  genderId?: string,
  countryId?: string,
  departmentId?: string,
  cityId?: string,
  categoryIds?: string[],
  socialAccounts: Array<{
    platformId: string,
    username: string,
    services?: Array<{
      serviceTypeId: string,
      price: number,
      currency?: string   // default: "COP"
    }>
  }>
}
```

---

### `create_campaign`

**Input schema:**
```typescript
{
  name: string,
  clientId: string,
  clientContactId: string,
  budget: number,
  description?: string,
  startDate?: string,   // ISO 8601
  endDate?: string
}
```

---

### `add_profiles_to_campaign`

**Input schema:**
```typescript
{
  campaignId: string,
  profiles: Array<{
    profileId: string,
    platforms: Array<{
      socialAccountId: string,
      services: Array<{
        profileServiceId: string,
        quantity: number
      }>
    }>
  }>
}
```

---

## Configuración de Claude Desktop

Agregar al archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "influencer-manager": {
      "command": "npx",
      "args": ["tsx", "C:/ruta/al/proyecto/src/mcp/index.ts"],
      "env": {
        "MCP_API_KEY": "<mismo-valor-que-env.local>",
        "MCP_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## Dependencias a instalar

```bash
npm install @modelcontextprotocol/sdk zod
```

`zod` ya está en el proyecto. Solo se necesita el SDK de MCP.

---

## Orden de ejecución

### Fase 1 — Infraestructura base
1. Instalar `@modelcontextprotocol/sdk`
2. Crear `src/mcp/client.ts` — cliente HTTP con `X-API-Key`
3. Crear `src/lib/mcp-auth.ts` — validación de API key
4. Integrar la validación en las rutas API existentes (`/api/profiles`, `/api/campaigns`, `/api/clients`)
5. Agregar `MCP_API_KEY` y `MCP_BASE_URL` a `.env.local` y `.env.example`
6. Crear `src/mcp/server.ts` y `src/mcp/index.ts` con servidor stdio básico
7. Agregar scripts `mcp` y `mcp:dev` a `package.json`

### Fase 2 — Tools de perfil
8. Crear `src/mcp/schemas/profile.ts` con schemas Zod de parámetros
9. Implementar `search_profiles` y `get_profile`
10. Implementar `create_profile` y `update_profile`
11. Implementar `sync_profile`
12. Probar con Claude Desktop o MCP inspector

### Fase 3 — Tools de campaña
13. Crear `src/mcp/schemas/campaign.ts`
14. Implementar `list_campaigns` y `get_campaign`
15. Implementar `create_campaign` y `update_campaign`
16. Implementar `update_campaign_status`
17. Implementar `add_profiles_to_campaign`

### Fase 4 — Tools de referencia y Resources
18. Implementar `list_clients`, `list_platforms`, `list_categories`, `list_service_types`
19. Implementar los Resources estáticos (`influencer://platforms`, etc.)
20. Registrar todo en `src/mcp/tools/index.ts` y `src/mcp/resources/index.ts`

### Fase 5 — Pulido
21. Formatear outputs como texto legible (no JSON crudo) para mejor UX en el chat
22. Agregar manejo de errores con mensajes claros (perfil no encontrado, presupuesto excedido, etc.)
23. Documentar en `README.md` cómo configurar Claude Desktop

---

## Verificación

```bash
# Levantar el servidor Next.js
npm run dev

# En otra terminal, correr el MCP inspector
npx @modelcontextprotocol/inspector tsx src/mcp/index.ts

# Luego abrir http://localhost:5173 para probar tools manualmente
```

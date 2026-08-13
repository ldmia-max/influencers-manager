# Arquitectura Mejorada - Separación de Responsabilidades

## Problema Actual

En el plan original, todo el código de scraping y procesamiento estaba en `lib/`, pero:
- ❌ `lib/` debe ser para **utilidades puras** y **configuraciones**
- ❌ No para **lógica de negocio compleja**
- ❌ No para **servicios que orquestan operaciones**

## Estructura Actual del Proyecto

```
src/
├── lib/                    # Utilidades y configuraciones
│   ├── apify.ts
│   ├── auth.ts
│   ├── prisma.ts
│   ├── format.ts
│   └── campaign-utils.ts
│
├── services/               # ✅ Ya existe!
│   ├── admin.ts
│   ├── campaign.ts
│   ├── profile.ts
│   ├── social-processor.ts
│   └── ...
│
└── data-access/            # ✅ Queries de Prisma
    └── clients.ts
```

## Arquitectura Propuesta - Separación Clara

### Principios

1. **`lib/`** = Utilidades puras, configuraciones, helpers
2. **`services/`** = Lógica de negocio, orquestación
3. **`data-access/`** = Solo queries de Prisma
4. **`actions/`** = Server Actions de Next.js (opcional)
5. **`hooks/`** = React hooks custom

### Estructura Completa

```
src/
├── lib/
│   ├── apify.ts                    # ✅ Cliente configurado
│   ├── prisma.ts                   # ✅ Singleton
│   ├── auth.ts                     # ✅ Configuración NextAuth
│   ├── format.ts                   # ✅ Formateo de números/fechas
│   ├── campaign-utils.ts           # ✅ Cálculos de markup/presupuesto
│   └── utils.ts                    # ✅ Utilidades generales
│
├── services/
│   ├── scraping/                   # 🆕 Servicios de scraping
│   │   ├── types.ts                # Interfaces compartidas
│   │   ├── scraper-strategy.ts     # Interface Strategy
│   │   ├── strategy-factory.ts     # Factory Pattern
│   │   ├── strategies/
│   │   │   ├── base-strategy.ts    # Estrategia base configurable
│   │   │   ├── instagram.ts        # (opcional) Estrategia específica
│   │   │   └── tiktok.ts           # (opcional) Estrategia específica
│   │   ├── engagement.ts           # Cálculos de engagement y alcance
│   │   └── index.ts                # API pública
│   │
│   ├── content/                    # 🆕 Servicios de contenido
│   │   ├── content-service.ts      # Orquesta: scrape + upload + DB
│   │   ├── uploader-service.ts     # Upload a Vercel Blob
│   │   ├── metrics-service.ts      # Procesa y calcula métricas
│   │   └── index.ts
│   │
│   ├── campaign/                   # Refactor de campaign.ts
│   │   ├── campaign-service.ts     # Lógica de campañas
│   │   ├── approval-service.ts     # Lógica de aprobaciones
│   │   └── index.ts
│   │
│   ├── admin.ts                    # ✅ Ya existe
│   ├── profile.ts                  # ✅ Ya existe
│   ├── social-processor.ts         # ✅ Ya existe
│   └── ...
│
├── data-access/
│   ├── campaign-content.ts         # 🆕 Queries de contenido
│   ├── campaigns.ts                # Queries de campañas
│   ├── clients.ts                  # ✅ Ya existe
│   ├── profiles.ts                 # Queries de perfiles
│   └── ...
│
├── jobs/                           # 🆕 Cron jobs / Scheduled tasks
│   ├── scrape-campaign-content.ts  # Job de scraping cada 6h
│   ├── cleanup-blob-storage.ts     # Limpieza de blobs huérfanos
│   └── scheduler.ts                # Configuración de cron
│
├── actions/                        # 🆕 Server Actions (opcional)
│   ├── content-actions.ts          # addContent, updateContent
│   └── campaign-actions.ts         # updateCampaign, etc
│
└── hooks/                          # 🆕 React hooks
    ├── use-campaign-content.ts     # Hook para contenido
    ├── use-content-metrics.ts      # Hook para métricas
    └── use-content-progress.ts     # Hook para progreso
```

## Comparación: Plan Original vs Mejorado

### ❌ Plan Original

```
src/lib/scraper/
├── index.ts                # ❌ Servicios en lib/
├── types.ts
├── base-strategy.ts
├── strategy-factory.ts
└── engagement.ts

src/lib/content-uploader.ts  # ❌ Servicio en lib/
```

### ✅ Plan Mejorado

```
src/services/scraping/      # ✅ Servicios en services/
├── index.ts
├── types.ts
├── scraper-strategy.ts
├── strategy-factory.ts
├── strategies/
│   └── base-strategy.ts
└── engagement.ts

src/services/content/       # ✅ Servicios en services/
├── content-service.ts
└── uploader-service.ts
```

## Responsabilidades por Carpeta

### `lib/` - Utilidades Puras

**Características:**
- ✅ Sin dependencias de DB
- ✅ Sin lógica de negocio compleja
- ✅ Funciones puras o configuraciones
- ✅ Reutilizable en cualquier contexto

**Ejemplos:**
```typescript
// ✅ BIEN - Configuración
export const apifyClient = new ApifyClient({ token: ... })

// ✅ BIEN - Utilidad pura
export function formatCurrency(amount: number): string

// ❌ MAL - Lógica de negocio
export async function scrapeAndSaveContent(url: string)
```

### `services/` - Lógica de Negocio

**Características:**
- ✅ Orquesta operaciones complejas
- ✅ Puede usar data-access
- ✅ Puede usar lib/
- ✅ Implementa reglas de negocio

**Ejemplos:**
```typescript
// ✅ BIEN - Orquesta múltiples operaciones
export class ContentService {
  async addContentToCampaign(data: AddContentData) {
    // 1. Validar
    // 2. Scrape
    // 3. Upload cover
    // 4. Guardar en DB
    // 5. Calcular métricas
  }
}

// ✅ BIEN - Implementa Strategy Pattern
export class ScraperStrategyFactory {
  static create(platform: string): ScraperStrategy
}
```

### `data-access/` - Queries de DB

**Características:**
- ✅ SOLO interactúa con Prisma
- ✅ Sin lógica de negocio
- ✅ CRUD y queries específicas
- ✅ Un solo lugar con `@prisma/client`

**Ejemplos:**
```typescript
// ✅ BIEN - Query simple
export async function getCampaignContent(id: string) {
  return prisma.campaignContent.findMany({ ... })
}

// ❌ MAL - Lógica de negocio aquí
export async function scrapeAndCreateContent(url: string) {
  const data = await scrapeFromApify(url) // ❌
  return prisma.campaignContent.create({ ... })
}
```

## Ejemplo de Flujo Completo

### Agregar Contenido a Campaña

```typescript
// ❌ ANTES (Todo mezclado en API route)
export async function POST(req: Request) {
  const { url, serviceId } = await req.json()

  // Scraping
  const strategy = await ScraperStrategyFactory.create(...)
  const scraped = await strategy.scrape(url)

  // Upload
  const coverUrl = await uploadCoverToBlob(...)

  // DB
  const content = await prisma.campaignContent.create(...)

  // Metrics
  await prisma.contentMetricsSnapshot.create(...)

  return Response.json(content)
}
```

```typescript
// ✅ DESPUÉS (Capas separadas)

// 1. API Route (delgado)
export async function POST(req: Request) {
  const data = await req.json()
  const content = await ContentService.addToCampaign(data)
  return Response.json(content)
}

// 2. Service (orquesta)
// src/services/content/content-service.ts
export class ContentService {
  async addToCampaign(data: AddContentData) {
    // Validar servicio
    const service = await getServiceById(data.serviceId)
    validateServiceCapacity(service)

    // Scraping
    const scraped = await ScrapingService.scrape(data.url)

    // Upload cover
    const coverUrl = await UploaderService.upload(
      scraped.coverUrl,
      data.platform
    )

    // Guardar en DB
    const content = await createCampaignContent({
      ...data,
      ...scraped.metadata,
      coverBlobUrl: coverUrl
    })

    // Guardar métricas
    await MetricsService.saveSnapshot(
      content.id,
      scraped.metrics
    )

    return content
  }
}

// 3. Data Access (solo queries)
// src/data-access/campaign-content.ts
export async function createCampaignContent(data) {
  return prisma.campaignContent.create({ data })
}
```

## Migración del Plan Original

### Archivos a Migrar

| Original | Nuevo | Motivo |
|----------|-------|--------|
| `lib/scraper/*` | `services/scraping/*` | Lógica de negocio |
| `lib/content-uploader.ts` | `services/content/uploader-service.ts` | Servicio |
| `lib/scraper/engagement.ts` | `services/scraping/engagement.ts` | Mantener junto al scraper |

### Archivos que Quedan en `lib/`

| Archivo | Motivo |
|---------|--------|
| `lib/apify.ts` | Cliente configurado (OK) |
| `lib/prisma.ts` | Singleton (OK) |
| `lib/auth.ts` | Configuración (OK) |
| `lib/format.ts` | Utilidades puras (OK) |
| `lib/campaign-utils.ts` | Cálculos puros (OK) |

## Ventajas de la Nueva Estructura

### ✅ Separación de Responsabilidades
- Cada capa tiene un propósito claro
- Fácil encontrar dónde va cada código
- Menos archivos "cajón de sastre"

### ✅ Testabilidad
```typescript
// Fácil mockear servicios
const mockScrapingService = {
  scrape: jest.fn().mockResolvedValue({ ... })
}
```

### ✅ Reutilización
```typescript
// Servicios usables desde:
// - API Routes
// - Server Actions
// - Cron Jobs
// - Scripts CLI
```

### ✅ Mantenibilidad
- Cambios en scraping → Solo tocar `services/scraping/`
- Cambios en DB → Solo tocar `data-access/`
- Cambios en UI → Solo tocar `components/`

## Recomendación Final

### Para el Plan de Seguimiento de Contenido:

1. **Scraping** → `services/scraping/`
   - ScraperStrategy, Factory, Engagement

2. **Upload** → `services/content/uploader-service.ts`
   - uploadCoverToBlob, deleteCover

3. **Orquestación** → `services/content/content-service.ts`
   - addToCampaign, updateMetrics

4. **Queries** → `data-access/campaign-content.ts`
   - CRUD, analytics, progress

5. **Jobs** → `jobs/scrape-campaign-content.ts`
   - Cron job cada 6 horas

6. **Hooks** → `hooks/use-campaign-content.ts`
   - React hooks para UI

### Mantener en `lib/`:
- Solo `apify.ts` (cliente)
- Utilidades de formato/cálculo puro

# Plan: Seguimiento de Contenido en Campañas

**Fecha**: 2026-02-16
**Estado**: Planificación
**Prioridad**: Alta
**Actualizado**: 2026-02-16 - Plan consolidado con arquitectura mejorada, vinculación de servicios y validación de alcance

## Resumen

Implementar un sistema de seguimiento de contenido (posts/videos) para campañas activas. El sistema debe:
- Permitir agregar URLs de contenido de Instagram y TikTok a campañas activas
- Ejecutar scrapers automáticos cada 6 horas para obtener métricas actualizadas
- Mantener un historial de métricas para analizar el comportamiento del contenido
- Descargar y almacenar covers/thumbnails automáticamente en **Vercel Blob Storage**
- Asociar el contenido al perfil y plataforma correctos
- **⭐ Vincular contenido con servicios específicos contratados** (tracking de "1 de 2 Reels")
- **⭐ Validar alcance vs vistas reales** con indicadores visuales (verde/amarillo/rojo)
- **Sistema configurable por plataforma** (evitar código hardcodeado)
- **Patrones de diseño**: Factory + Strategy para escalabilidad
- **Arquitectura mejorada**: Separación clara entre `lib/`, `services/`, `data-access/`

### Documentos Consolidados

Este plan integra la información de:
1. ✅ **Vinculación de Contenido con Servicios** - Sistema de tracking de progreso por servicio
2. ✅ **Validación de Alcance vs Vistas** - Indicadores visuales de performance
3. ✅ **Arquitectura Mejorada** - Separación de responsabilidades (services/ vs lib/)
4. ✅ **Vercel Blob Setup** - Almacenamiento persistente de imágenes

## Arquitectura - Separación de Responsabilidades

### Principios Fundamentales

1. **`lib/`** = Utilidades puras, configuraciones, helpers
   - ✅ Sin dependencias de DB
   - ✅ Sin lógica de negocio compleja
   - ✅ Funciones puras o configuraciones
   - ✅ Reutilizable en cualquier contexto

2. **`services/`** = Lógica de negocio, orquestación
   - ✅ Orquesta operaciones complejas
   - ✅ Puede usar data-access
   - ✅ Puede usar lib/
   - ✅ Implementa reglas de negocio

3. **`data-access/`** = Solo queries de Prisma
   - ✅ SOLO interactúa con Prisma
   - ✅ Sin lógica de negocio
   - ✅ CRUD y queries específicas
   - ✅ Un solo lugar con `@prisma/client`

4. **`jobs/`** = Cron jobs / Scheduled tasks

5. **`hooks/`** = React hooks custom

### Responsabilidades por Carpeta

**`lib/` - Utilidades Puras:**
```typescript
// ✅ BIEN - Configuración
export const apifyClient = new ApifyClient({ token: ... })

// ✅ BIEN - Utilidad pura
export function formatCurrency(amount: number): string

// ❌ MAL - Lógica de negocio
export async function scrapeAndSaveContent(url: string)
```

**`services/` - Lógica de Negocio:**
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
```

**`data-access/` - Queries de DB:**
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

### Estructura de Carpetas Implementada

```
src/
├── lib/                    # ✅ Solo utilidades puras
│   ├── apify.ts           # Cliente configurado
│   ├── prisma.ts          # Singleton
│   ├── auth.ts            # Configuración NextAuth
│   ├── format.ts          # Formateo puro
│   └── campaign-utils.ts  # Cálculos puros
│
├── services/              # ✅ Lógica de negocio
│   ├── scraping/          # Servicios de scraping
│   │   ├── types.ts
│   │   ├── scraper-strategy.ts
│   │   ├── strategy-factory.ts
│   │   ├── base-strategy.ts
│   │   └── engagement.ts
│   ├── content/           # Servicios de contenido
│   │   └── uploader-service.ts
│   ├── admin.ts           # Ya existe
│   ├── campaign.ts        # Ya existe
│   └── profile.ts         # Ya existe
│
├── data-access/           # ✅ Solo queries de Prisma
│   ├── campaign-content.ts
│   ├── clients.ts
│   └── profiles.ts
│
└── jobs/                  # ✅ Cron jobs
    └── scrape-campaign-content.ts
```

**Ventajas:**
- ✅ Separación clara de responsabilidades
- ✅ Fácil encontrar dónde va cada código
- ✅ Testeable (fácil mockear servicios)
- ✅ Reutilizable (servicios usables desde API, jobs, scripts)
- ✅ Mantenible (cambios en scraping → solo tocar `services/scraping/`)

## Contexto

Los influencers no suben todo el contenido al mismo tiempo, sino que lo hacen a destiempo durante la campaña. Necesitamos poder:
1. Agregar URLs de contenido cuando se publiquen
2. Hacer scraping automático para obtener métricas actualizadas
3. Mantener un historial para ver el rendimiento a lo largo del tiempo
4. Detectar automáticamente si es TikTok o Instagram y usar el scraper apropiado
5. **⭐ Vincular cada contenido al servicio específico contratado** (ej: "Reel 1 de 2")
6. **⭐ Validar que las vistas cumplan con el alcance esperado** (indicadores visuales verde/rojo)

## Actores de Apify

- **Instagram**: `apify/instagram-post-scraper`
- **TikTok**: `clockworks/tiktok-scraper`

## Patrones de Diseño

### Factory Pattern
Responsable de crear la estrategia correcta de scraping según la plataforma.

```typescript
// ScraperStrategyFactory devuelve la estrategia correcta
const strategy = ScraperStrategyFactory.create('instagram')
const data = await strategy.scrape(url)
```

### Strategy Pattern
Cada plataforma tiene su propia estrategia de scraping y mapeo de datos.

```typescript
interface ScraperStrategy {
  scrape(url: string): Promise<ScrapedContent>
  mapToMetrics(data: any): ContentMetrics
  mapToMetadata(data: any): ContentMetadata
}
```

## Arquitectura

### 1. Modelo de Datos (Prisma Schema)

```prisma
// ============ CONTENIDO DE CAMPAÑAS ============

enum ContentPlatform {
  INSTAGRAM
  TIKTOK
}

enum ContentStatus {
  PENDING    // URL agregada, esperando primer scrape
  ACTIVE     // Scraping activo cada 6 horas
  PAUSED     // Pausado manualmente
  COMPLETED  // Campaña completada, no hacer más scrapes
  ERROR      // Error en el último scrape
}

model CampaignContent {
  id        String   @id @default(cuid())
  url       String   // URL original del contenido
  shortCode String?  // shortCode de Instagram o ID de TikTok
  status    ContentStatus @default(PENDING)
  platform  ContentPlatform

  // Metadata del contenido
  caption      String?  @db.Text
  coverUrl     String?  // URL original del cover/thumbnail desde Apify
  coverBlobUrl String?  // URL del cover almacenado en Vercel Blob
  videoUrl     String?  // URL del video (si aplica)
  videoDuration Float?  // Duración en segundos

  // Dimensiones
  width  Int?
  height Int?

  // Fecha de publicación del contenido
  publishedAt DateTime?

  // Control de scraping
  lastScrapedAt DateTime?
  lastScrapedError String? @db.Text
  scrapeCount   Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relaciones
  campaignProfilePlatform   CampaignProfilePlatform @relation(fields: [campaignProfilePlatformId], references: [id], onDelete: Cascade)
  campaignProfilePlatformId String

  // ⭐ NUEVO: Vinculación con servicio específico contratado
  campaignService   CampaignService? @relation(fields: [campaignServiceId], references: [id], onDelete: SetNull)
  campaignServiceId String?

  // Historial de métricas
  metricsSnapshots ContentMetricsSnapshot[]

  @@unique([campaignProfilePlatformId, url])
  @@index([status])
  @@index([platform])
  @@index([lastScrapedAt])
  @@index([campaignServiceId]) // ⭐ Índice para búsquedas por servicio
}

model ContentMetricsSnapshot {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  // Métricas comunes
  likes      Int     @default(0)
  comments   Int     @default(0)
  shares     Int     @default(0)
  views      Int?    // videoViewCount (Instagram) o playCount (TikTok)
  plays      Int?    // videoPlayCount (Instagram)
  saves      Int?    // collectCount (TikTok)

  // Métricas calculadas
  engagementRate Float?

  // Relaciones
  content   CampaignContent @relation(fields: [contentId], references: [id], onDelete: Cascade)
  contentId String

  @@index([contentId, createdAt])
}
```

**Cambios al schema existente:**

```prisma
// ============ CONFIGURACIÓN DE SCRAPING POR PLATAFORMA ============

model SocialPlatform {
  id          String   @id @default(cuid())
  name        String   @unique
  displayName String
  icon        String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  // ===== NUEVOS CAMPOS PARA SCRAPING =====

  // Configuración de Apify
  apifyActorId    String? // "apify/instagram-post-scraper" o "clockworks/tiktok-scraper"
  apifyActorInput Json?   // Input por defecto para el actor

  // Configuración de mapeo de datos (JSON Schema)
  // Define cómo mapear la respuesta de Apify a nuestro modelo
  scrapingConfig  Json?   // { metadata: {...}, metrics: {...} }

  // Regex para extraer IDs/shortcodes de URLs
  urlPattern      String? // Regex para validar URLs de esta plataforma
  idExtractor     String? // Regex para extraer el ID/shortcode

  // Relaciones existentes
  accounts     SocialAccount[]
  serviceTypes ServiceType[]
}

// Agregar a CampaignProfilePlatform:
model CampaignProfilePlatform {
  // ... campos existentes ...

  // Contenido de esta plataforma en la campaña
  content CampaignContent[]
}
```

**Ejemplo de `scrapingConfig` para Instagram:**
```json
{
  "metadata": {
    "caption": "caption",
    "shortCode": "shortCode",
    "publishedAt": "timestamp",
    "width": "dimensionsWidth",
    "height": "dimensionsHeight",
    "coverUrl": "displayUrl",
    "videoUrl": "videoUrl",
    "videoDuration": "videoDuration"
  },
  "metrics": {
    "likes": "likesCount",
    "comments": "commentsCount",
    "views": "videoViewCount",
    "plays": "videoPlayCount"
  }
}
```

**Ejemplo de `scrapingConfig` para TikTok:**
```json
{
  "metadata": {
    "caption": "text",
    "shortCode": "id",
    "publishedAt": "createTime",
    "publishedAtTransform": "timestamp",
    "width": "videoMeta.width",
    "height": "videoMeta.height",
    "coverUrl": "videoMeta.coverUrl",
    "videoUrl": "webVideoUrl",
    "videoDuration": "videoMeta.duration"
  },
  "metrics": {
    "likes": "diggCount",
    "comments": "commentCount",
    "views": "playCount",
    "plays": "playCount",
    "shares": "shareCount",
    "saves": "collectCount"
  }
}
```

### 2. Servicios y Utilidades

#### `src/services/scraping/types.ts`

```typescript
/**
 * Tipos compartidos para el sistema de scraping
 */

export interface ContentMetadata {
  caption: string | null
  shortCode: string | null
  publishedAt: Date | null
  width: number | null
  height: number | null
  coverUrl: string | null
  videoUrl: string | null
  videoDuration: number | null
}

export interface ContentMetrics {
  likes: number
  comments: number
  views: number | null
  plays: number | null
  shares: number
  saves: number
}

export interface ScrapedContent {
  metadata: ContentMetadata
  metrics: ContentMetrics
}

/**
 * Interfaz para estrategias de scraping
 * Implementa el Strategy Pattern
 */
export interface ScraperStrategy {
  /**
   * Nombre de la plataforma
   */
  platformName: string

  /**
   * Ejecuta el scraping de un contenido
   */
  scrape(url: string): Promise<ScrapedContent>

  /**
   * Mapea datos crudos de Apify a ContentMetadata
   */
  mapToMetadata(data: any): ContentMetadata

  /**
   * Mapea datos crudos de Apify a ContentMetrics
   */
  mapToMetrics(data: any): ContentMetrics

  /**
   * Extrae el ID/shortcode de una URL
   */
  extractId(url: string): string | null

  /**
   * Valida si una URL es válida para esta plataforma
   */
  isValidUrl(url: string): boolean
}
```

#### `src/services/scraping/base-strategy.ts`

```typescript
import { SocialPlatform } from '@prisma/client'
import { ScraperStrategy, ContentMetadata, ContentMetrics, ScrapedContent } from './types'
import { scrapeWithApify } from '@/lib/apify'

/**
 * Estrategia base configurable por plataforma
 * Usa la configuración de la base de datos (scrapingConfig)
 */
export class ConfigurableScraperStrategy implements ScraperStrategy {
  constructor(private platform: SocialPlatform) {}

  get platformName(): string {
    return this.platform.name
  }

  async scrape(url: string): Promise<ScrapedContent> {
    if (!this.platform.apifyActorId) {
      throw new Error(`No Apify actor configured for platform: ${this.platformName}`)
    }

    // Ejecutar Apify
    const data = await scrapeWithApify(
      this.platform.apifyActorId,
      {
        directUrls: [url],
        ...(this.platform.apifyActorInput as object || {})
      }
    )

    if (!data || data.length === 0) {
      throw new Error('No data returned from Apify')
    }

    const rawData = data[0]

    return {
      metadata: this.mapToMetadata(rawData),
      metrics: this.mapToMetrics(rawData)
    }
  }

  mapToMetadata(data: any): ContentMetadata {
    const config = (this.platform.scrapingConfig as any)?.metadata || {}

    return {
      caption: this.getNestedValue(data, config.caption) || null,
      shortCode: this.getNestedValue(data, config.shortCode) || null,
      publishedAt: this.parseDate(
        this.getNestedValue(data, config.publishedAt),
        config.publishedAtTransform
      ),
      width: this.getNestedValue(data, config.width) || null,
      height: this.getNestedValue(data, config.height) || null,
      coverUrl: this.getNestedValue(data, config.coverUrl) || null,
      videoUrl: this.getNestedValue(data, config.videoUrl) || null,
      videoDuration: this.getNestedValue(data, config.videoDuration) || null,
    }
  }

  mapToMetrics(data: any): ContentMetrics {
    const config = (this.platform.scrapingConfig as any)?.metrics || {}

    return {
      likes: this.getNestedValue(data, config.likes) || 0,
      comments: this.getNestedValue(data, config.comments) || 0,
      views: this.getNestedValue(data, config.views) || null,
      plays: this.getNestedValue(data, config.plays) || null,
      shares: this.getNestedValue(data, config.shares) || 0,
      saves: this.getNestedValue(data, config.saves) || 0,
    }
  }

  extractId(url: string): string | null {
    if (!this.platform.idExtractor) return null

    const regex = new RegExp(this.platform.idExtractor)
    const match = url.match(regex)
    return match ? match[1] : null
  }

  isValidUrl(url: string): boolean {
    if (!this.platform.urlPattern) return false

    const regex = new RegExp(this.platform.urlPattern)
    return regex.test(url)
  }

  /**
   * Obtiene un valor anidado de un objeto usando dot notation
   * Ejemplo: getNestedValue(obj, 'videoMeta.width')
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) return undefined

    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Parsea una fecha según el tipo de dato
   */
  private parseDate(value: any, transform?: string): Date | null {
    if (!value) return null

    if (transform === 'timestamp') {
      // Unix timestamp (puede estar en segundos)
      const timestamp = typeof value === 'string' ? parseInt(value) : value
      return new Date(timestamp * 1000)
    }

    // ISO string o Date object
    return new Date(value)
  }
}
```

#### `src/services/scraping/strategy-factory.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { ScraperStrategy } from './types'
import { ConfigurableScraperStrategy } from './base-strategy'

/**
 * Factory Pattern para crear estrategias de scraping
 *
 * En lugar de tener código hardcodeado para cada plataforma,
 * obtiene la configuración de la base de datos y crea una
 * estrategia configurable.
 */
export class ScraperStrategyFactory {
  private static strategies = new Map<string, ScraperStrategy>()

  /**
   * Crea o obtiene una estrategia de scraping para una plataforma
   */
  static async create(platformName: string): Promise<ScraperStrategy> {
    // Cache de estrategias
    if (this.strategies.has(platformName)) {
      return this.strategies.get(platformName)!
    }

    // Obtener configuración de la plataforma desde DB
    const platform = await prisma.socialPlatform.findUnique({
      where: { name: platformName }
    })

    if (!platform) {
      throw new Error(`Platform not found: ${platformName}`)
    }

    if (!platform.isActive) {
      throw new Error(`Platform is not active: ${platformName}`)
    }

    // Crear estrategia configurable
    const strategy = new ConfigurableScraperStrategy(platform)

    // Guardar en cache
    this.strategies.set(platformName, strategy)

    return strategy
  }

  /**
   * Detecta la plataforma de una URL y retorna la estrategia apropiada
   */
  static async detectAndCreate(url: string): Promise<ScraperStrategy> {
    const platforms = await prisma.socialPlatform.findMany({
      where: {
        isActive: true,
        urlPattern: { not: null }
      }
    })

    for (const platform of platforms) {
      const strategy = new ConfigurableScraperStrategy(platform)
      if (strategy.isValidUrl(url)) {
        this.strategies.set(platform.name, strategy)
        return strategy
      }
    }

    throw new Error('Could not detect platform from URL')
  }

  /**
   * Limpia el cache de estrategias
   * Útil cuando se actualizan las configuraciones de plataformas
   */
  static clearCache() {
    this.strategies.clear()
  }
}
```

#### `src/services/scraping/index.ts`

```typescript
import { ScraperStrategyFactory } from './strategy-factory'
import { ScrapedContent } from './types'

/**
 * API principal del sistema de scraping
 */

/**
 * Hace scraping de un contenido detectando automáticamente la plataforma
 */
export async function scrapeContent(url: string): Promise<ScrapedContent> {
  const strategy = await ScraperStrategyFactory.detectAndCreate(url)
  return strategy.scrape(url)
}

/**
 * Hace scraping usando una plataforma específica
 */
export async function scrapeContentByPlatform(
  platformName: string,
  url: string
): Promise<ScrapedContent> {
  const strategy = await ScraperStrategyFactory.create(platformName)
  return strategy.scrape(url)
}

/**
 * Valida una URL sin hacer scraping
 */
export async function validateContentUrl(url: string): Promise<{
  isValid: boolean
  platform?: string
  contentId?: string
}> {
  try {
    const strategy = await ScraperStrategyFactory.detectAndCreate(url)
    const contentId = strategy.extractId(url)

    return {
      isValid: true,
      platform: strategy.platformName,
      contentId: contentId || undefined
    }
  } catch (error) {
    return { isValid: false }
  }
}

// Re-exports
export { ScraperStrategyFactory } from './strategy-factory'
export * from './types'
```

#### `src/services/scraping/engagement.ts`

```typescript
/**
 * Cálculos de engagement y métricas derivadas
 */

import { ContentMetrics } from './types'

/**
 * Calcula engagement rate
 */
export function calculateEngagementRate(
  metrics: ContentMetrics,
  followers: number
): number {
  if (followers === 0) return 0

  const totalEngagement = metrics.likes + metrics.comments + metrics.shares
  return (totalEngagement / followers) * 100
}

/**
 * Calcula el crecimiento de métricas entre dos snapshots
 */
export function calculateMetricsGrowth(
  current: ContentMetrics,
  previous: ContentMetrics
): Record<string, number> {
  return {
    likesGrowth: current.likes - previous.likes,
    commentsGrowth: current.comments - previous.comments,
    sharesGrowth: current.shares - previous.shares,
    viewsGrowth: (current.views || 0) - (previous.views || 0),
  }
}

/**
 * Calcula el alcance esperado basado en seguidores
 * Usa los rangos definidos en ReachRange
 */
export function calculateExpectedReach(followers: number): number {
  // Rangos basados en el modelo ReachRange de la base de datos
  // Estos valores deberían venir de la DB, aquí están hardcodeados como ejemplo

  if (followers < 10000) {
    // Nano: 40% de alcance
    return Math.round(followers * 0.40)
  } else if (followers < 100000) {
    // Micro: 35% de alcance
    return Math.round(followers * 0.35)
  } else if (followers < 500000) {
    // Mid: 30% de alcance
    return Math.round(followers * 0.30)
  } else if (followers < 1000000) {
    // Macro: 25% de alcance
    return Math.round(followers * 0.25)
  } else {
    // Mega: 20% de alcance
    return Math.round(followers * 0.20)
  }
}

/**
 * Evalúa el rendimiento de vistas vs alcance esperado
 */
export interface ReachPerformance {
  expectedReach: number
  actualViews: number
  fulfillmentPercentage: number
  status: 'excellent' | 'good' | 'warning' | 'poor'
  color: 'green' | 'yellow' | 'red'
  message: string
}

export function evaluateReachPerformance(
  actualViews: number,
  followers: number
): ReachPerformance {
  const expectedReach = calculateExpectedReach(followers)
  const fulfillmentPercentage = (actualViews / expectedReach) * 100

  let status: ReachPerformance['status']
  let color: ReachPerformance['color']
  let message: string

  if (fulfillmentPercentage >= 120) {
    status = 'excellent'
    color = 'green'
    message = '¡Excelente! Superó el alcance esperado'
  } else if (fulfillmentPercentage >= 100) {
    status = 'good'
    color = 'green'
    message = 'Cumplió con el alcance esperado'
  } else if (fulfillmentPercentage >= 80) {
    status = 'warning'
    color = 'yellow'
    message = 'Cerca del alcance esperado'
  } else {
    status = 'poor'
    color = 'red'
    message = 'Por debajo del alcance esperado'
  }

  return {
    expectedReach,
    actualViews,
    fulfillmentPercentage: Math.round(fulfillmentPercentage),
    status,
    color,
    message
  }
}
```

#### `src/services/content/uploader-service.ts`

**IMPORTANTE**: Todas las imágenes se guardan en **Vercel Blob Storage**, no en filesystem local.

```typescript
import { put } from '@vercel/blob'

/**
 * Tipos para upload de contenido
 */
export interface ContentImage {
  url: string          // URL original
  contentId: string
  platform: string
  type: 'cover' | 'thumbnail'
}

/**
 * Descarga una imagen/cover y la sube a Vercel Blob
 * Retorna la URL de Vercel Blob
 */
export async function uploadCoverToBlob(
  url: string,
  contentId: string,
  platform: 'instagram' | 'tiktok'
): Promise<string> {
  try {
    // Descargar la imagen
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const blob = await response.blob()

    // Generar nombre de archivo
    const extension = getImageExtension(url) || 'jpg'
    const filename = `campaign-content/${platform}/${contentId}.${extension}`

    // Subir a Vercel Blob
    const { url: blobUrl } = await put(filename, blob, {
      access: 'public',
      addRandomSuffix: false, // Usar el mismo nombre siempre
    })

    return blobUrl
  } catch (error) {
    console.error('Error uploading cover to blob:', error)
    throw error
  }
}

/**
 * Extrae la extensión de una URL de imagen
 */
function getImageExtension(url: string): string | null {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)
  return match ? match[1] : null
}

/**
 * Elimina una imagen de Vercel Blob
 */
export async function deleteCoverFromBlob(blobUrl: string): Promise<void> {
  try {
    const { del } = await import('@vercel/blob')
    await del(blobUrl)
  } catch (error) {
    console.error('Error deleting from blob:', error)
    // No lanzar error, solo logear
  }
}

/**
 * Sube múltiples imágenes en paralelo
 */
export async function uploadMultipleCovers(
  images: ContentImage[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  await Promise.allSettled(
    images.map(async (image) => {
      try {
        const blobUrl = await uploadCoverToBlob(
          image.url,
          image.contentId,
          image.platform as 'instagram' | 'tiktok'
        )
        results.set(image.contentId, blobUrl)
      } catch (error) {
        console.error(`Failed to upload cover for ${image.contentId}:`, error)
      }
    })
  )

  return results
}
```

### 3. Vinculación de Contenido con Servicios Específicos

#### Problema

Cuando se contrata una campaña con @maria_garcia que incluye:
- 2 Reels
- 1 Reel + Pauta
- 3 Stories

Necesitamos:
1. **Trackear** cuántos contenidos se han subido por cada servicio
2. **Validar** que no se exceda la cantidad contratada
3. **Mostrar progreso** visual de cada servicio
4. **Asociar** cada URL al servicio correcto

#### Relación CampaignContent ↔ CampaignService

El campo `campaignServiceId` en `CampaignContent` vincula cada contenido con el servicio específico contratado:

```prisma
model CampaignService {
  quantity  Int      @default(1) // ← Cantidad contratada
  contents CampaignContent[]     // ⭐ Contenidos asociados
}

model CampaignContent {
  campaignService   CampaignService? @relation(...)
  campaignServiceId String?
}
```

#### Flujo de Usuario - Vista de Progreso

```
┌─────────────────────────────────────────────────┐
│  Contenidos de la Campaña                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  @maria_garcia - Instagram                     │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 📱 Reel (2 contratados)                   │ │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │ ███████████████████░░░░░░░░░░░░  50%     │ │
│  │ 1 de 2 subidos                   ⚠️       │ │
│  │                                           │ │
│  │ [Cover 1]  instagram.com/p/abc123        │ │
│  │                                           │ │
│  │ [+ Agregar Reel]                          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 📱 Reel + Pauta (1 contratado)            │ │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%      │ │
│  │ 0 de 1 subidos                   📋       │ │
│  │                                           │ │
│  │ [+ Agregar Reel + Pauta]                  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 📱 Story (3 contratados)                  │ │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │ ████████████████████████████████  100%    │ │
│  │ 3 de 3 subidos                   ✅       │ │
│  │                                           │ │
│  │ [Cover 1]  [Cover 2]  [Cover 3]          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Validación al Agregar Contenido

```typescript
// Si intentas agregar más de lo contratado:
POST /api/campaigns/123/content
{
  "campaignServiceId": "svc_story",  // Story (3 de 3 ya subidos)
  "url": "https://instagram.com/stories/..."
}

// Response: 400 Bad Request
{
  "error": "Ya se agregaron 3 contenidos para este servicio (Story). No se pueden agregar más.",
  "service": {
    "id": "svc_story",
    "name": "Story",
    "quantityContracted": 3,
    "quantityUploaded": 3
  }
}
```

#### API Endpoint - Progreso de Servicios

**GET /api/campaigns/[id]/content-progress**

Obtiene el progreso de contenidos por servicio.

**Response:**
```json
{
  "progress": [
    {
      "campaignServiceId": "svc_1",
      "profileName": "@maria_garcia",
      "platformName": "Instagram",
      "serviceTypeName": "Reel",
      "quantityContracted": 2,
      "quantityUploaded": 1,
      "quantityRemaining": 1,
      "isComplete": false,
      "percentage": 50,
      "contents": [
        {
          "id": "cnt_1",
          "url": "https://instagram.com/p/abc123",
          "status": "ACTIVE",
          "coverBlobUrl": "https://blob.vercel...",
          "likes": 45000,
          "comments": 2800
        }
      ]
    }
  ],
  "summary": {
    "totalServices": 3,
    "completedServices": 1,
    "totalContentsContracted": 6,
    "totalContentsUploaded": 4,
    "overallPercentage": 67
  }
}
```

#### Componentes de UI

**ServiceProgressCard:**
```tsx
<ServiceProgressCard
  serviceName="Reel"
  quantityContracted={2}
  quantityUploaded={1}
  contents={[...]}
  onAddContent={() => {}}
/>
```

**AddContentFormWithService:**
```tsx
<AddContentFormWithService>
  <ProfileSelector />
  <PlatformSelector />

  {/* Muestra solo servicios del perfil+plataforma seleccionados */}
  <ServiceSelector
    services={availableServices}
    renderOption={(service) => (
      <ServiceOption
        label={service.name}
        progress={`${service.uploaded} de ${service.total}`}
        disabled={service.isComplete}
        badge={service.isComplete ? '✅' : '⚠️'}
      />
    )}
  />

  <UrlInput />
  <SubmitButton disabled={!canAdd} />
</AddContentFormWithService>
```

#### Data Access Functions para Servicios

```typescript
// src/data-access/campaign-content.ts

/**
 * Obtiene el progreso de contenidos por servicio
 */
export async function getContentProgressByService(campaignId: string)

/**
 * Valida si se puede agregar contenido a un servicio
 */
export async function canAddContentToService(serviceId: string): Promise<{
  canAdd: boolean
  reason?: string
  current: number
  limit: number
}>

/**
 * Obtiene servicios disponibles para un perfil+plataforma
 */
export async function getAvailableServicesForContent(
  campaignProfilePlatformId: string
): Promise<Array<{
  id: string
  name: string
  quantityContracted: number
  quantityUploaded: number
  canAddMore: boolean
}>>
```

### 4. Validación de Alcance vs Vistas Reales

#### Concepto

Cada cuenta tiene un **alcance esperado** basado en su número de seguidores. Esta validación compara las vistas reales del contenido contra el alcance esperado y muestra un indicador visual (verde/amarillo/rojo).

#### Cálculo del Alcance Esperado

Basado en el modelo `ReachRange` del schema:

```typescript
function calculateExpectedReach(followers: number): number {
  if (followers < 10000) {
    return followers * 0.40  // Nano: 40% de alcance
  } else if (followers < 100000) {
    return followers * 0.35  // Micro: 35%
  } else if (followers < 500000) {
    return followers * 0.30  // Mid: 30%
  } else if (followers < 1000000) {
    return followers * 0.25  // Macro: 25%
  } else {
    return followers * 0.20  // Mega: 20%
  }
}
```

**Ejemplos:**

| Seguidores | Tier | % Alcance | Alcance Esperado |
|------------|------|-----------|------------------|
| 50,000 | Micro | 35% | 17,500 vistas |
| 150,000 | Mid | 30% | 45,000 vistas |
| 750,000 | Macro | 25% | 187,500 vistas |
| 2,000,000 | Mega | 20% | 400,000 vistas |

#### Evaluación de Performance

```typescript
const fulfillmentPercentage = (actualViews / expectedReach) * 100

// Rangos:
// ✅ >= 120% → Excelente (Verde)
// ✅ >= 100% → Bueno (Verde)
// ⚠️ >= 80%  → Advertencia (Amarillo)
// ❌ < 80%   → Pobre (Rojo)
```

#### UI - Content Card con Indicador de Alcance

```
┌────────────────────────────────────────┐
│ [Cover Image]                 Instagram│
│                                         │
│ @maria_garcia                           │
│ Reel                                    │
│                                         │
│ ❤️ 45K  💬 2.8K  👁️ 120K              │
│                                         │
│ ┌─────────────────────────────────────┐│
││ ✅ ¡Excelente! Superó el alcance    ││
││    esperado                      125%││
││ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ││
││ ████████████████████████████  125%  ││
││                                     ││
││ 120K de 96K vistas esperadas        ││
│└─────────────────────────────────────┘│
│                                         │
│ 📈 Engagement: 5.2%                    │
└────────────────────────────────────────┘
```

#### UI - Tabla con Indicadores de Alcance

```
┌───────────────────────────────────────────────────────────────────────┐
│ Contenido             Perfil         Formato    Vistas    Alcance     │
├───────────────────────────────────────────────────────────────────────┤
│ [img] p/abc123       @maria_garcia  Reel       120K      ✅ 125%      │
│ [img] p/def456       @maria_garcia  Story      25K       ✅ 102%      │
│ [img] video/xyz      @juan_lopez    Video      45K       ❌ 68%       │
│ [img] p/ghi789       @ana_martinez  Reel       88K       ⚠️ 85%       │
└───────────────────────────────────────────────────────────────────────┘
```

#### Componente: ReachPerformanceIndicator

```tsx
interface ReachPerformanceIndicatorProps {
  expectedReach: number
  actualViews: number
  fulfillmentPercentage: number
  color: 'green' | 'yellow' | 'red'
  message: string
  variant?: 'compact' | 'full' | 'badge'
}

// Variante Compact (para tablas)
<ReachPerformanceIndicator variant="compact">
  <Badge variant={color}>
    {color === 'green' ? '✅' : color === 'yellow' ? '⚠️' : '❌'} {fulfillmentPercentage}%
  </Badge>
</ReachPerformanceIndicator>

// Variante Full (para cards) - ver ejemplo arriba en content-card.tsx

// Variante Badge (solo icono y %)
<ReachPerformanceIndicator variant="badge">
  {color === 'green' ? '✅' : '❌'} {fulfillmentPercentage}%
</ReachPerformanceIndicator>
```

#### Casos de Uso - Identificar Contenidos de Bajo Rendimiento

**Pregunta**: ¿Qué contenidos necesitan boost/pauta?

**Respuesta**:
```
Contenidos con ❌ por debajo del 80%:
- @juan_lopez - Video TikTok (68%)
- @ana_martinez - Reel Instagram (75%)

Recomendación: Considerar pauta para mejorar alcance
```

#### Dashboard de Resumen de Alcance

```
┌────────────────────────────────────────────────────────────┐
│  Resumen de Alcance de la Campaña                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Total de Contenidos: 12                                  │
│                                                            │
│  ✅ Cumplieron o superaron: 8 (67%)                       │
│  ⚠️ Cerca del objetivo: 2 (17%)                           │
│  ❌ Por debajo del objetivo: 2 (17%)                      │
│                                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ████████████████████████████████░░░░░░░░   83%          │
│                                                            │
│  Promedio de cumplimiento: 108%                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5. API Routes

#### `POST /api/campaigns/[id]/content`
- Agregar URL de contenido a una campaña
- Validar que la campaña esté activa
- Detectar la plataforma automáticamente
- Ejecutar el primer scrape inmediatamente
- Asociar al CampaignProfilePlatform correcto

**Request:**
```typescript
{
  campaignProfilePlatformId: string
  url: string
}
```

**Response:**
```typescript
{
  id: string
  url: string
  platform: 'INSTAGRAM' | 'TIKTOK'
  status: 'PENDING' | 'ACTIVE'
  initialMetrics: ContentMetrics
}
```

#### `GET /api/campaigns/[id]/content`
- Listar todo el contenido de una campaña
- Incluir métricas más recientes
- Filtrar por plataforma, perfil o estado

**Query params:**
```typescript
{
  platform?: 'INSTAGRAM' | 'TIKTOK'
  profileId?: string
  status?: ContentStatus
}
```

#### `GET /api/campaigns/[id]/content-progress`
- **⭐ NUEVO**: Obtiene el progreso de contenidos por servicio
- Muestra cuántos contenidos se han subido de cada servicio contratado
- Incluye resumen global de completitud

**Response:**
```typescript
{
  progress: Array<{
    campaignServiceId: string
    profileName: string
    platformName: string
    serviceTypeName: string
    quantityContracted: number
    quantityUploaded: number
    quantityRemaining: number
    isComplete: boolean
    percentage: number
    contents: Array<{...}>
  }>
  summary: {
    totalServices: number
    completedServices: number
    totalContentsContracted: number
    totalContentsUploaded: number
    overallPercentage: number
  }
}
```

#### `GET /api/campaigns/content/[contentId]`
- Obtener detalles de un contenido específico
- Incluir últimas métricas

#### `GET /api/campaigns/[id]/analytics`

**Obtiene analytics completos de una campaña con múltiples vistas**

**Query params:**
```typescript
{
  view: 'global' | 'by-profile' | 'by-format' | 'time-series'
  startDate?: string
  endDate?: string
  profileId?: string
  platform?: 'INSTAGRAM' | 'TIKTOK'
}
```

**Response para `view=global`:**
```typescript
{
  totalContents: number
  totalLikes: number
  totalComments: number
  totalViews: number
  totalShares: number
  totalSaves: number
  avgEngagementRate: number
  dateRange: { startDate: string; endDate: string }
}
```

**Response para `view=by-profile`:**
```typescript
{
  profiles: Array<{
    profileId: string
    profileName: string
    totalContents: number
    totalLikes: number
    totalComments: number
    totalViews: number
    avgEngagementRate: number
  }>
}
```

**Response para `view=by-format`:**
```typescript
{
  formats: Array<{
    serviceTypeId: string
    serviceTypeName: string
    platform: string
    totalContents: number
    totalLikes: number
    totalComments: number
    totalViews: number
    avgEngagementRate: number
  }>
}
```

**Response para `view=time-series`:**
```typescript
{
  timeSeries: Array<{
    timestamp: string
    likes: number
    comments: number
    views: number
    shares: number
    engagementRate: number
  }>
}
```

#### `POST /api/campaigns/[id]/analytics/compare-periods`

**Compara métricas entre dos rangos de fechas**

**Request:**
```typescript
{
  range1: { startDate: string; endDate: string }
  range2: { startDate: string; endDate: string }
}
```

**Response:**
```typescript
{
  range1: GlobalMetrics
  range2: GlobalMetrics
  diff: {
    likes: number
    comments: number
    views: number
    shares: number
    engagementRate: number
  }
  percentChange: {
    likes: number
    comments: number
    views: number
  }
}
```

#### `POST /api/campaigns/[id]/analytics/compare-contents`

**Compara múltiples contenidos específicos (Reel vs Reel, TikTok vs Instagram, etc.)**

**Request:**
```typescript
{
  contentIds: string[] // IDs de los contenidos a comparar (2 o más)
}
```

**Response:**
```typescript
{
  contents: Array<{
    id: string
    url: string
    caption: string
    platform: string
    profileName: string
    serviceType: string
    publishedAt: string
    coverPath: string
    currentMetrics: {
      likes: number
      comments: number
      views: number
      engagementRate: number
    }
    growth: {
      likes: number
      comments: number
      views: number
    }
    timeSeries: Array<{
      timestamp: string
      likes: number
      comments: number
      views: number
      engagementRate: number
    }>
    stats: {
      avgEngagementRate: number
      peakLikes: number
      peakViews: number
    }
  }>
  comparisons: Array<{
    content1Id: string
    content2Id: string
    content1Name: string
    content2Name: string
    diff: {
      likes: number
      comments: number
      views: number
      engagementRate: number
    }
    percentDiff: {
      likes: number
      comments: number
      views: number
    }
  }>
}
```

#### `GET /api/campaigns/[id]/analytics/search-contents`

**Busca contenidos para agregar a comparación**

**Query params:**
```typescript
{
  platform?: 'INSTAGRAM' | 'TIKTOK'
  profileId?: string
  serviceTypeId?: string
  search?: string // Buscar en caption
}
```

**Response:**
```typescript
{
  contents: Array<{
    id: string
    url: string
    caption: string // Truncado
    platform: string
    profileName: string
    serviceType: string
    publishedAt: string
    coverPath: string
    latestMetrics: {
      likes: number
      comments: number
      views: number
    }
  }>
}
```

#### `GET /api/campaigns/content/[contentId]/metrics`
- Obtener historial completo de métricas de un contenido específico
- Filtrar por rango de fechas

**Query params:**
```typescript
{
  startDate?: string
  endDate?: string
  limit?: number
}
```

**Response:**
```typescript
{
  contentId: string
  snapshots: Array<{
    timestamp: string
    likes: number
    comments: number
    shares: number
    views: number
    engagementRate: number
  }>
  summary: {
    totalGrowth: number
    avgEngagementRate: number
    peakViews: number
  }
}
```

#### `POST /api/campaigns/content/[contentId]/scrape`
- Ejecutar scraper manualmente (fuera del cron)
- Útil para obtener métricas inmediatas

#### `PATCH /api/campaigns/content/[contentId]`
- Actualizar estado del contenido (pausar/reactivar)
- Admin only

### 4. Cron Job / Scheduled Task

#### `src/jobs/scrape-campaign-content.ts`

```typescript
/**
 * Job que se ejecuta cada 6 horas
 *
 * Proceso:
 * 1. Obtener todos los CampaignContent con status ACTIVE
 * 2. Para cada contenido:
 *    - Ejecutar el scraper apropiado
 *    - Si es la primera vez y no tiene cover en Blob, descargarlo y subirlo
 *    - Crear ContentMetricsSnapshot con nuevas métricas
 *    - Actualizar lastScrapedAt
 *    - Si hay error, actualizar lastScrapedError y status
 * 3. Manejar rate limits de Apify
 * 4. Log de resultados
 *
 * Ejemplo de implementación:
 */
export async function scrapeCampaignContentJob(): Promise<void> {
  const contents = await getActiveContentForScraping()

  for (const content of contents) {
    try {
      // 1. Hacer scraping
      const strategy = await ScraperStrategyFactory.create(
        content.campaignProfilePlatform.socialAccount.platform.name
      )
      const scraped = await strategy.scrape(content.url)

      // 2. Subir cover a Vercel Blob si no existe
      let coverBlobUrl = content.coverBlobUrl
      if (!coverBlobUrl && scraped.metadata.coverUrl) {
        coverBlobUrl = await uploadCoverToBlob(
          scraped.metadata.coverUrl,
          content.id,
          content.campaignProfilePlatform.socialAccount.platform.name
        )
      }

      // 3. Guardar métricas
      await createMetricsSnapshot(content.id, {
        ...scraped.metrics,
        engagementRate: calculateEngagementRate(
          scraped.metrics,
          content.campaignProfilePlatform.socialAccount.followers || 0
        )
      })

      // 4. Actualizar metadata
      await updateContentAfterScraping(content.id, {
        caption: scraped.metadata.caption,
        coverBlobUrl,
        width: scraped.metadata.width,
        height: scraped.metadata.height,
        videoDuration: scraped.metadata.videoDuration
      })

    } catch (error) {
      console.error(`Error scraping content ${content.id}:`, error)
      await updateContentStatus(
        content.id,
        'ERROR',
        error.message
      )
    }
  }
}
```

**Configuración del Cron:**

Opción 1: Usar `node-cron` (para desarrollo/VPS simple)
```typescript
// src/jobs/scheduler.ts
import cron from 'node-cron'
import { scrapeCampaignContentJob } from './scrape-campaign-content'

// Cada 6 horas: 0 */6 * * *
cron.schedule('0 */6 * * *', async () => {
  console.log('Starting content scraping job...')
  await scrapeCampaignContentJob()
})
```

Opción 2: Usar Vercel Cron Jobs (si se despliega en Vercel)
```typescript
// src/app/api/cron/scrape-content/route.ts
export async function GET(request: Request) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  await scrapeCampaignContentJob()
  return Response.json({ success: true })
}
```

### 5. Data Access Layer

**IMPORTANTE**: Toda interacción con Prisma debe estar en `src/data-access/`. Ningún otro archivo debe importar `@prisma/client` directamente.

#### `src/data-access/campaign-content.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { ContentStatus, ContentPlatform, Prisma } from '@prisma/client'

// ========== TIPOS ==========

export interface CreateContentData {
  url: string
  platform: ContentPlatform
  campaignProfilePlatformId: string
  metadata: {
    caption?: string | null
    shortCode?: string | null
    publishedAt?: Date | null
    width?: number | null
    height?: number | null
    coverUrl?: string | null
    videoUrl?: string | null
    videoDuration?: number | null
  }
}

export interface ContentFilters {
  platform?: ContentPlatform
  profileId?: string
  serviceTypeId?: string
  status?: ContentStatus
  startDate?: Date
  endDate?: Date
}

export interface MetricsData {
  likes: number
  comments: number
  views?: number | null
  plays?: number | null
  shares: number
  saves: number
  engagementRate?: number | null
}

export interface DateRangeComparison {
  range1: { startDate: Date; endDate: Date }
  range2: { startDate: Date; endDate: Date }
}

// ========== QUERIES DE CONTENIDO ==========

/**
 * Crea un nuevo contenido de campaña
 */
export async function createCampaignContent(data: CreateContentData) {
  return prisma.campaignContent.create({
    data: {
      url: data.url,
      platform: data.platform,
      campaignProfilePlatformId: data.campaignProfilePlatformId,
      caption: data.metadata.caption,
      shortCode: data.metadata.shortCode,
      publishedAt: data.metadata.publishedAt,
      width: data.metadata.width,
      height: data.metadata.height,
      coverUrl: data.metadata.coverUrl,
      videoUrl: data.metadata.videoUrl,
      videoDuration: data.metadata.videoDuration,
      status: 'PENDING',
    },
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true,
              platform: true,
            }
          }
        }
      }
    }
  })
}

/**
 * Obtiene contenido de una campaña con filtros
 */
export async function getCampaignContent(
  campaignId: string,
  filters?: ContentFilters
) {
  const where: Prisma.CampaignContentWhereInput = {
    campaignProfilePlatform: {
      campaignProfile: {
        campaignId: campaignId
      }
    }
  }

  if (filters?.platform) {
    where.platform = filters.platform
  }

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.profileId) {
    where.campaignProfilePlatform = {
      ...where.campaignProfilePlatform,
      campaignProfile: {
        ...((where.campaignProfilePlatform as any)?.campaignProfile || {}),
        profileId: filters.profileId
      }
    }
  }

  if (filters?.startDate || filters?.endDate) {
    where.publishedAt = {}
    if (filters.startDate) {
      where.publishedAt.gte = filters.startDate
    }
    if (filters.endDate) {
      where.publishedAt.lte = filters.endDate
    }
  }

  return prisma.campaignContent.findMany({
    where,
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true,
              platform: true,
              services: {
                include: {
                  serviceType: true
                }
              }
            }
          },
          services: {
            include: {
              profileService: {
                include: {
                  serviceType: true
                }
              }
            }
          }
        }
      },
      metricsSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { publishedAt: 'desc' }
  })
}

/**
 * Obtiene un contenido por ID
 */
export async function getContentById(contentId: string) {
  return prisma.campaignContent.findUnique({
    where: { id: contentId },
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true,
              platform: true,
            }
          },
          campaignProfile: {
            include: {
              campaign: true
            }
          }
        }
      },
      metricsSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })
}

/**
 * Obtiene todos los contenidos activos para scraping
 */
export async function getActiveContentForScraping() {
  return prisma.campaignContent.findMany({
    where: {
      status: 'ACTIVE',
      campaignProfilePlatform: {
        campaignProfile: {
          campaign: {
            status: {
              in: ['ACTIVE', 'REVIEW']
            }
          }
        }
      }
    },
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              platform: true,
              profile: true
            }
          }
        }
      }
    }
  })
}

/**
 * Actualiza el estado de un contenido
 */
export async function updateContentStatus(
  contentId: string,
  status: ContentStatus,
  error?: string
) {
  return prisma.campaignContent.update({
    where: { id: contentId },
    data: {
      status,
      lastScrapedError: error || null,
      updatedAt: new Date()
    }
  })
}

/**
 * Actualiza metadata de un contenido después de scraping
 */
export async function updateContentAfterScraping(
  contentId: string,
  metadata: {
    caption?: string | null
    coverBlobUrl?: string | null  // URL de Vercel Blob
    width?: number | null
    height?: number | null
    videoDuration?: number | null
  }
) {
  return prisma.campaignContent.update({
    where: { id: contentId },
    data: {
      ...metadata,
      lastScrapedAt: new Date(),
      scrapeCount: { increment: 1 },
      status: 'ACTIVE'
    }
  })
}

// ========== QUERIES DE PROGRESO DE SERVICIOS ==========

/**
 * Obtiene el progreso de contenidos por servicio
 */
export async function getContentProgressByService(campaignId: string) {
  const campaignServices = await prisma.campaignService.findMany({
    where: {
      campaignProfilePlatform: {
        campaignProfile: {
          campaignId
        }
      }
    },
    include: {
      profileService: {
        include: {
          serviceType: true
        }
      },
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true,
              platform: true
            }
          }
        }
      },
      contents: {
        include: {
          metricsSnapshots: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }
    }
  })

  const progress = campaignServices.map(service => ({
    campaignServiceId: service.id,
    profileName: service.campaignProfilePlatform.socialAccount.profile.name,
    platformName: service.campaignProfilePlatform.socialAccount.platform.displayName,
    serviceTypeName: service.profileService.serviceType.displayName,
    quantityContracted: service.quantity,
    quantityUploaded: service.contents.length,
    quantityRemaining: service.quantity - service.contents.length,
    isComplete: service.contents.length >= service.quantity,
    percentage: Math.round((service.contents.length / service.quantity) * 100),
    contents: service.contents.map(content => ({
      id: content.id,
      url: content.url,
      status: content.status,
      coverBlobUrl: content.coverBlobUrl,
      latestMetrics: content.metricsSnapshots[0] || null
    }))
  }))

  const summary = {
    totalServices: campaignServices.length,
    completedServices: progress.filter(p => p.isComplete).length,
    totalContentsContracted: progress.reduce((sum, p) => sum + p.quantityContracted, 0),
    totalContentsUploaded: progress.reduce((sum, p) => sum + p.quantityUploaded, 0),
    overallPercentage: 0
  }

  if (summary.totalContentsContracted > 0) {
    summary.overallPercentage = Math.round(
      (summary.totalContentsUploaded / summary.totalContentsContracted) * 100
    )
  }

  return { progress, summary }
}

/**
 * Valida si se puede agregar contenido a un servicio
 */
export async function canAddContentToService(serviceId: string) {
  const service = await prisma.campaignService.findUnique({
    where: { id: serviceId },
    include: {
      contents: true,
      profileService: {
        include: {
          serviceType: true
        }
      }
    }
  })

  if (!service) {
    return {
      canAdd: false,
      reason: 'Servicio no encontrado',
      current: 0,
      limit: 0
    }
  }

  const current = service.contents.length
  const limit = service.quantity

  if (current >= limit) {
    return {
      canAdd: false,
      reason: `Ya se agregaron ${current} contenidos para este servicio (${service.profileService.serviceType.displayName}). No se pueden agregar más.`,
      current,
      limit
    }
  }

  return {
    canAdd: true,
    current,
    limit
  }
}

/**
 * Obtiene servicios disponibles para un perfil+plataforma
 */
export async function getAvailableServicesForContent(
  campaignProfilePlatformId: string
) {
  const services = await prisma.campaignService.findMany({
    where: {
      campaignProfilePlatformId
    },
    include: {
      profileService: {
        include: {
          serviceType: true
        }
      },
      contents: true
    }
  })

  return services.map(service => ({
    id: service.id,
    name: service.profileService.serviceType.displayName,
    quantityContracted: service.quantity,
    quantityUploaded: service.contents.length,
    canAddMore: service.contents.length < service.quantity
  }))
}

// ========== QUERIES DE MÉTRICAS ==========

/**
 * Crea un snapshot de métricas
 */
export async function createMetricsSnapshot(
  contentId: string,
  metrics: MetricsData
) {
  return prisma.contentMetricsSnapshot.create({
    data: {
      contentId,
      likes: metrics.likes,
      comments: metrics.comments,
      views: metrics.views,
      plays: metrics.plays,
      shares: metrics.shares,
      saves: metrics.saves,
      engagementRate: metrics.engagementRate,
    }
  })
}

/**
 * Obtiene historial de métricas de un contenido
 */
export async function getContentMetricsHistory(
  contentId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    limit?: number
  }
) {
  const where: Prisma.ContentMetricsSnapshotWhereInput = {
    contentId
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {}
    if (options.startDate) {
      where.createdAt.gte = options.startDate
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate
    }
  }

  return prisma.contentMetricsSnapshot.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: options?.limit
  })
}

/**
 * Obtiene las últimas métricas de un contenido
 */
export async function getLatestMetrics(contentId: string) {
  return prisma.contentMetricsSnapshot.findFirst({
    where: { contentId },
    orderBy: { createdAt: 'desc' }
  })
}

// ========== QUERIES DE ANALYTICS ==========

/**
 * Obtiene métricas agregadas para toda la campaña
 */
export async function getCampaignMetricsAggregated(
  campaignId: string,
  dateRange?: { startDate: Date; endDate: Date }
) {
  const where: Prisma.CampaignContentWhereInput = {
    campaignProfilePlatform: {
      campaignProfile: {
        campaignId
      }
    }
  }

  if (dateRange) {
    where.publishedAt = {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  }

  const contents = await prisma.campaignContent.findMany({
    where,
    include: {
      metricsSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  // Agregar métricas manualmente
  const aggregated = {
    totalContents: contents.length,
    totalLikes: 0,
    totalComments: 0,
    totalViews: 0,
    totalShares: 0,
    totalSaves: 0,
    avgEngagementRate: 0
  }

  let engagementRateSum = 0
  let engagementRateCount = 0

  contents.forEach(content => {
    const latest = content.metricsSnapshots[0]
    if (latest) {
      aggregated.totalLikes += latest.likes
      aggregated.totalComments += latest.comments
      aggregated.totalViews += latest.views || 0
      aggregated.totalShares += latest.shares
      aggregated.totalSaves += latest.saves || 0

      if (latest.engagementRate) {
        engagementRateSum += latest.engagementRate
        engagementRateCount++
      }
    }
  })

  if (engagementRateCount > 0) {
    aggregated.avgEngagementRate = engagementRateSum / engagementRateCount
  }

  return aggregated
}

/**
 * Obtiene métricas agregadas por perfil
 */
export async function getCampaignMetricsByProfile(
  campaignId: string,
  dateRange?: { startDate: Date; endDate: Date }
) {
  const where: Prisma.CampaignContentWhereInput = {
    campaignProfilePlatform: {
      campaignProfile: {
        campaignId
      }
    }
  }

  if (dateRange) {
    where.publishedAt = {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  }

  const contents = await prisma.campaignContent.findMany({
    where,
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true
            }
          }
        }
      },
      metricsSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  // Agrupar por perfil
  const byProfile = new Map()

  contents.forEach(content => {
    const profile = content.campaignProfilePlatform.socialAccount.profile
    const profileId = profile.id

    if (!byProfile.has(profileId)) {
      byProfile.set(profileId, {
        profileId,
        profileName: profile.name,
        totalContents: 0,
        totalLikes: 0,
        totalComments: 0,
        totalViews: 0,
        totalShares: 0,
        totalSaves: 0,
        avgEngagementRate: 0,
        engagementRateSum: 0,
        engagementRateCount: 0
      })
    }

    const metrics = byProfile.get(profileId)
    metrics.totalContents++

    const latest = content.metricsSnapshots[0]
    if (latest) {
      metrics.totalLikes += latest.likes
      metrics.totalComments += latest.comments
      metrics.totalViews += latest.views || 0
      metrics.totalShares += latest.shares
      metrics.totalSaves += latest.saves || 0

      if (latest.engagementRate) {
        metrics.engagementRateSum += latest.engagementRate
        metrics.engagementRateCount++
      }
    }
  })

  // Calcular promedios
  const result = Array.from(byProfile.values()).map(metrics => {
    if (metrics.engagementRateCount > 0) {
      metrics.avgEngagementRate = metrics.engagementRateSum / metrics.engagementRateCount
    }
    delete metrics.engagementRateSum
    delete metrics.engagementRateCount
    return metrics
  })

  return result
}

/**
 * Obtiene métricas agregadas por formato/tipo de servicio
 */
export async function getCampaignMetricsByServiceType(
  campaignId: string,
  dateRange?: { startDate: Date; endDate: Date }
) {
  const where: Prisma.CampaignContentWhereInput = {
    campaignProfilePlatform: {
      campaignProfile: {
        campaignId
      }
    }
  }

  if (dateRange) {
    where.publishedAt = {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  }

  const contents = await prisma.campaignContent.findMany({
    where,
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              platform: true
            }
          },
          services: {
            include: {
              profileService: {
                include: {
                  serviceType: true
                }
              }
            }
          }
        }
      },
      metricsSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  // Agrupar por tipo de servicio
  const byServiceType = new Map()

  contents.forEach(content => {
    const platform = content.campaignProfilePlatform.socialAccount.platform
    const services = content.campaignProfilePlatform.services

    // Si tiene servicios asociados, usar esos
    // Si no, inferir del tipo de contenido o usar un genérico
    const serviceTypes = services.length > 0
      ? services.map(s => ({
          id: s.profileService.serviceType.id,
          name: s.profileService.serviceType.name,
          displayName: s.profileService.serviceType.displayName,
          platform: platform.displayName
        }))
      : [{
          id: 'unknown',
          name: 'unknown',
          displayName: 'Sin clasificar',
          platform: platform.displayName
        }]

    serviceTypes.forEach(serviceType => {
      const key = `${serviceType.platform}-${serviceType.id}`

      if (!byServiceType.has(key)) {
        byServiceType.set(key, {
          serviceTypeId: serviceType.id,
          serviceTypeName: serviceType.displayName,
          platform: serviceType.platform,
          totalContents: 0,
          totalLikes: 0,
          totalComments: 0,
          totalViews: 0,
          totalShares: 0,
          totalSaves: 0,
          avgEngagementRate: 0,
          engagementRateSum: 0,
          engagementRateCount: 0
        })
      }

      const metrics = byServiceType.get(key)
      metrics.totalContents++

      const latest = content.metricsSnapshots[0]
      if (latest) {
        metrics.totalLikes += latest.likes
        metrics.totalComments += latest.comments
        metrics.totalViews += latest.views || 0
        metrics.totalShares += latest.shares
        metrics.totalSaves += latest.saves || 0

        if (latest.engagementRate) {
          metrics.engagementRateSum += latest.engagementRate
          metrics.engagementRateCount++
        }
      }
    })
  })

  // Calcular promedios
  const result = Array.from(byServiceType.values()).map(metrics => {
    if (metrics.engagementRateCount > 0) {
      metrics.avgEngagementRate = metrics.engagementRateSum / metrics.engagementRateCount
    }
    delete metrics.engagementRateSum
    delete metrics.engagementRateCount
    return metrics
  })

  return result
}

/**
 * Obtiene evolución temporal de métricas para la campaña
 */
export async function getCampaignMetricsTimeSeries(
  campaignId: string,
  dateRange?: { startDate: Date; endDate: Date }
) {
  const where: Prisma.CampaignContentWhereInput = {
    campaignProfilePlatform: {
      campaignProfile: {
        campaignId
      }
    }
  }

  const contents = await prisma.campaignContent.findMany({
    where,
    select: { id: true }
  })

  const contentIds = contents.map(c => c.id)

  const snapshotsWhere: Prisma.ContentMetricsSnapshotWhereInput = {
    contentId: { in: contentIds }
  }

  if (dateRange) {
    snapshotsWhere.createdAt = {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  }

  const snapshots = await prisma.contentMetricsSnapshot.findMany({
    where: snapshotsWhere,
    orderBy: { createdAt: 'asc' }
  })

  return snapshots
}

/**
 * Compara métricas entre dos rangos de fechas
 */
export async function compareCampaignMetrics(
  campaignId: string,
  comparison: DateRangeComparison
) {
  const range1Metrics = await getCampaignMetricsAggregated(
    campaignId,
    comparison.range1
  )

  const range2Metrics = await getCampaignMetricsAggregated(
    campaignId,
    comparison.range2
  )

  return {
    range1: range1Metrics,
    range2: range2Metrics,
    diff: {
      likes: range2Metrics.totalLikes - range1Metrics.totalLikes,
      comments: range2Metrics.totalComments - range1Metrics.totalComments,
      views: range2Metrics.totalViews - range1Metrics.totalViews,
      shares: range2Metrics.totalShares - range1Metrics.totalShares,
      saves: range2Metrics.totalSaves - range1Metrics.totalSaves,
      engagementRate: range2Metrics.avgEngagementRate - range1Metrics.avgEngagementRate
    },
    percentChange: {
      likes: range1Metrics.totalLikes > 0
        ? ((range2Metrics.totalLikes - range1Metrics.totalLikes) / range1Metrics.totalLikes) * 100
        : 0,
      comments: range1Metrics.totalComments > 0
        ? ((range2Metrics.totalComments - range1Metrics.totalComments) / range1Metrics.totalComments) * 100
        : 0,
      views: range1Metrics.totalViews > 0
        ? ((range2Metrics.totalViews - range1Metrics.totalViews) / range1Metrics.totalViews) * 100
        : 0
    }
  }
}

// ========== COMPARACIÓN DE CONTENIDOS INDIVIDUALES ==========

/**
 * Obtiene métricas detalladas de múltiples contenidos para comparación
 */
export async function getContentsForComparison(contentIds: string[]) {
  const contents = await prisma.campaignContent.findMany({
    where: {
      id: { in: contentIds }
    },
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true,
              platform: true
            }
          },
          services: {
            include: {
              profileService: {
                include: {
                  serviceType: true
                }
              }
            }
          }
        }
      },
      metricsSnapshots: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  return contents.map(content => {
    const latestMetrics = content.metricsSnapshots[content.metricsSnapshots.length - 1]
    const firstMetrics = content.metricsSnapshots[0]

    // Calcular crecimiento total
    const growth = latestMetrics && firstMetrics ? {
      likes: latestMetrics.likes - firstMetrics.likes,
      comments: latestMetrics.comments - firstMetrics.comments,
      views: (latestMetrics.views || 0) - (firstMetrics.views || 0),
      shares: latestMetrics.shares - firstMetrics.shares,
    } : null

    return {
      id: content.id,
      url: content.url,
      caption: content.caption,
      platform: content.campaignProfilePlatform.socialAccount.platform.displayName,
      platformName: content.campaignProfilePlatform.socialAccount.platform.name,
      profileName: content.campaignProfilePlatform.socialAccount.profile.name,
      serviceType: content.campaignProfilePlatform.services[0]?.profileService.serviceType.displayName || 'Sin clasificar',
      serviceTypeName: content.campaignProfilePlatform.services[0]?.profileService.serviceType.name || 'unknown',
      publishedAt: content.publishedAt,
      coverUrl: content.coverUrl,              // URL original
      coverBlobUrl: content.coverBlobUrl,      // URL de Vercel Blob

      // Métricas actuales (últimas)
      currentMetrics: latestMetrics ? {
        likes: latestMetrics.likes,
        comments: latestMetrics.comments,
        views: latestMetrics.views,
        plays: latestMetrics.plays,
        shares: latestMetrics.shares,
        saves: latestMetrics.saves,
        engagementRate: latestMetrics.engagementRate
      } : null,

      // ⭐ Evaluación de alcance
      reachPerformance: latestMetrics?.views ?
        evaluateReachPerformance(
          latestMetrics.views,
          content.campaignProfilePlatform.socialAccount.followers || 0
        ) : null,

      // Métricas iniciales
      initialMetrics: firstMetrics ? {
        likes: firstMetrics.likes,
        comments: firstMetrics.comments,
        views: firstMetrics.views,
      } : null,

      // Crecimiento total
      growth,

      // Series temporales para gráficos
      timeSeries: content.metricsSnapshots.map(snapshot => ({
        timestamp: snapshot.createdAt,
        likes: snapshot.likes,
        comments: snapshot.comments,
        views: snapshot.views,
        shares: snapshot.shares,
        engagementRate: snapshot.engagementRate
      })),

      // Estadísticas
      stats: {
        totalSnapshots: content.metricsSnapshots.length,
        firstScrapedAt: firstMetrics?.createdAt,
        lastScrapedAt: latestMetrics?.createdAt,
        avgEngagementRate: content.metricsSnapshots.length > 0
          ? content.metricsSnapshots.reduce((sum, s) => sum + (s.engagementRate || 0), 0) / content.metricsSnapshots.length
          : 0,
        peakLikes: Math.max(...content.metricsSnapshots.map(s => s.likes)),
        peakViews: Math.max(...content.metricsSnapshots.map(s => s.views || 0))
      }
    }
  })
}

/**
 * Compara métricas entre múltiples contenidos específicos
 */
export async function compareContents(contentIds: string[]) {
  const contents = await getContentsForComparison(contentIds)

  // Calcular comparaciones relativas
  const comparisons = []

  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const content1 = contents[i]
      const content2 = contents[j]

      if (!content1.currentMetrics || !content2.currentMetrics) continue

      comparisons.push({
        content1Id: content1.id,
        content2Id: content2.id,
        content1Name: `${content1.profileName} - ${content1.serviceType}`,
        content2Name: `${content2.profileName} - ${content2.serviceType}`,
        diff: {
          likes: content2.currentMetrics.likes - content1.currentMetrics.likes,
          comments: content2.currentMetrics.comments - content1.currentMetrics.comments,
          views: (content2.currentMetrics.views || 0) - (content1.currentMetrics.views || 0),
          engagementRate: (content2.currentMetrics.engagementRate || 0) - (content1.currentMetrics.engagementRate || 0)
        },
        percentDiff: {
          likes: content1.currentMetrics.likes > 0
            ? ((content2.currentMetrics.likes - content1.currentMetrics.likes) / content1.currentMetrics.likes) * 100
            : 0,
          comments: content1.currentMetrics.comments > 0
            ? ((content2.currentMetrics.comments - content1.currentMetrics.comments) / content1.currentMetrics.comments) * 100
            : 0,
          views: (content1.currentMetrics.views || 0) > 0
            ? (((content2.currentMetrics.views || 0) - (content1.currentMetrics.views || 0)) / (content1.currentMetrics.views || 1)) * 100
            : 0
        }
      })
    }
  }

  return {
    contents,
    comparisons
  }
}

/**
 * Busca contenidos para agregar a comparación con filtros
 */
export async function searchContentsForComparison(
  campaignId: string,
  filters?: {
    platform?: ContentPlatform
    profileId?: string
    serviceTypeId?: string
    search?: string
  }
) {
  const where: Prisma.CampaignContentWhereInput = {
    campaignProfilePlatform: {
      campaignProfile: {
        campaignId
      }
    },
    status: 'ACTIVE' // Solo contenido activo
  }

  if (filters?.platform) {
    where.platform = filters.platform
  }

  if (filters?.profileId) {
    where.campaignProfilePlatform = {
      ...where.campaignProfilePlatform,
      campaignProfile: {
        ...(where.campaignProfilePlatform as any).campaignProfile,
        profileId: filters.profileId
      }
    }
  }

  if (filters?.search) {
    where.caption = {
      contains: filters.search,
      mode: 'insensitive'
    }
  }

  const contents = await prisma.campaignContent.findMany({
    where,
    include: {
      campaignProfilePlatform: {
        include: {
          socialAccount: {
            include: {
              profile: true,
              platform: true
            }
          },
          services: {
            include: {
              profileService: {
                include: {
                  serviceType: true
                }
              }
            }
          }
        }
      },
      metricsSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { publishedAt: 'desc' },
    take: 50
  })

  return contents.map(content => ({
    id: content.id,
    url: content.url,
    caption: content.caption ? content.caption.substring(0, 100) + '...' : '',
    platform: content.campaignProfilePlatform.socialAccount.platform.displayName,
    profileName: content.campaignProfilePlatform.socialAccount.profile.name,
    serviceType: content.campaignProfilePlatform.services[0]?.profileService.serviceType.displayName || 'Sin clasificar',
    publishedAt: content.publishedAt,
    coverBlobUrl: content.coverBlobUrl,  // URL de Vercel Blob para mostrar en UI
    latestMetrics: content.metricsSnapshots[0] || null
  }))
}
```

### 6. UI Components

#### `src/components/campaigns/campaign-content-manager.tsx`
- Componente principal para gestionar contenido de una campaña
- Lista de contenido agregado
- **⭐ Vista de progreso por servicio** (ServiceProgressList)
- Formulario para agregar nuevas URLs
- Botón para scrape manual

**Features:**
- Input para URL con validación en tiempo real
- Auto-detect de plataforma
- Selector de perfil/plataforma de la campaña
- **⭐ Selector de servicio específico** (con validación de límites)
- Vista de últimas métricas
- **⭐ Indicadores de alcance** (verde/amarillo/rojo)
- Estados de carga y error

#### `src/components/campaigns/service-progress-card.tsx`
- Card que muestra el progreso de un servicio específico
- Barra de progreso visual
- Lista de contenidos asociados
- Botón para agregar contenido al servicio

#### `src/components/campaigns/service-progress-list.tsx`
- Lista todos los servicios de una campaña con su progreso
- Resumen global de completitud
- Filtros por perfil/plataforma

#### `src/components/campaigns/reach-performance-indicator.tsx`
- Componente para mostrar indicadores de alcance
- Variantes: compact, full, badge
- Colores dinámicos según performance
- Barra de progreso visual

**Props:**
```tsx
interface ReachPerformanceIndicatorProps {
  expectedReach: number
  actualViews: number
  fulfillmentPercentage: number
  color: 'green' | 'yellow' | 'red'
  message: string
  variant?: 'compact' | 'full' | 'badge'
}
```

#### `src/components/campaigns/content-metrics-chart.tsx`

**Gráfico con múltiples vistas:**

1. **Vista Global de Campaña**
   - Métricas agregadas de todo el contenido
   - Evolución temporal (línea de tiempo)
   - Filtros: rango de fechas, plataforma

2. **Vista por Perfil**
   - Comparación entre perfiles
   - Gráfico de barras por perfil
   - Top performers

3. **Vista por Formato/Servicio**
   - Comparación entre tipos de contenido (Reel, Story, Post, etc.)
   - Gráfico de barras o pie chart
   - Mejor formato por métrica

4. **Comparación Múltiple**
   - **Opción A**: Comparar rangos de fechas (períodos)
   - **Opción B**: Comparar contenidos específicos
   - Visualización lado a lado
   - % de cambio y diferencias

**Componentes:**

```typescript
// Componente principal con tabs
<ContentMetricsChart campaignId={id}>
  <MetricsChartTabs>
    <Tab value="global">Vista Global</Tab>
    <Tab value="by-profile">Por Perfil</Tab>
    <Tab value="by-format">Por Formato</Tab>
    <Tab value="comparison">Comparar</Tab>
  </MetricsChartTabs>

  <DateRangePicker />

  <TabContent value="global">
    <GlobalMetricsChart />
  </TabContent>

  <TabContent value="by-profile">
    <ProfileMetricsChart />
  </TabContent>

  <TabContent value="by-format">
    <FormatMetricsChart />
  </TabContent>

  <TabContent value="comparison">
    {/* Sub-tabs para tipos de comparación */}
    <ComparisonTabs>
      <Tab value="periods">Comparar Períodos</Tab>
      <Tab value="contents">Comparar Contenidos</Tab>
    </ComparisonTabs>

    <TabContent value="periods">
      <PeriodComparison />
    </TabContent>

    <TabContent value="contents">
      <ContentComparison campaignId={id} />
    </TabContent>
  </TabContent>
</ContentMetricsChart>
```

**Features:**
- Usar `recharts` para gráficos
- Selector de rango de fechas con presets (última semana, último mes, etc.)
- **Búsqueda y selección de contenidos** para comparar
- **Agregar múltiples contenidos** (2 o más) a la comparación
- Exportar datos a CSV/PNG
- Zoom y pan en gráficos temporales
- Tooltips con detalles de cada punto

#### `src/components/campaigns/content-list.tsx`
- Tabla con todo el contenido de la campaña
- Columnas:
  - Thumbnail/Cover
  - URL/Shortcode
  - Plataforma
  - Perfil
  - Métricas actuales (likes, comments, views)
  - Última actualización
  - Estado
  - Acciones (ver historial, scrape manual, pausar)

#### `src/components/campaigns/content-card.tsx`

**Card individual para un contenido con validación de alcance**

**Features:**
- Thumbnail con indicador de plataforma
- Métricas principales (likes, comments, shares, views)
- **⭐ Indicador de alcance**: Verde si cumple, Rojo si no cumple
- **⭐ Porcentaje de cumplimiento**: "125% del alcance esperado"
- Mini gráfico de tendencia
- Badge de estado (Activo/Pausado/Error)
- Link al contenido original

**UI Example:**
```tsx
<ContentCard content={content}>
  {/* Header */}
  <div className="relative">
    <Image src={content.coverBlobUrl} />
    <Badge className="absolute top-2 right-2">
      {content.platform}
    </Badge>
  </div>

  {/* Info */}
  <div>
    <h3>{content.profileName}</h3>
    <p className="text-sm text-muted">
      {content.serviceType}
    </p>
  </div>

  {/* Métricas */}
  <div className="grid grid-cols-3 gap-2">
    <Metric icon="❤️" value="45K" label="Likes" />
    <Metric icon="💬" value="2.8K" label="Comments" />
    <Metric icon="👁️" value="120K" label="Views" />
  </div>

  {/* ⭐ NUEVO: Indicador de Alcance */}
  {content.reachPerformance && (
    <div className={cn(
      "p-3 rounded-lg border",
      content.reachPerformance.color === 'green' && "bg-green-50 border-green-200",
      content.reachPerformance.color === 'red' && "bg-red-50 border-red-200",
      content.reachPerformance.color === 'yellow' && "bg-yellow-50 border-yellow-200"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {content.reachPerformance.message}
        </span>
        <Badge variant={content.reachPerformance.color}>
          {content.reachPerformance.fulfillmentPercentage}%
        </Badge>
      </div>

      {/* Barra de progreso */}
      <div className="mt-2">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              content.reachPerformance.color === 'green' && "bg-green-500",
              content.reachPerformance.color === 'red' && "bg-red-500",
              content.reachPerformance.color === 'yellow' && "bg-yellow-500"
            )}
            style={{
              width: `${Math.min(content.reachPerformance.fulfillmentPercentage, 100)}%`
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {content.reachPerformance.actualViews.toLocaleString()} de{' '}
          {content.reachPerformance.expectedReach.toLocaleString()} vistas esperadas
        </p>
      </div>
    </div>
  )}

  {/* Engagement Rate */}
  <div className="flex items-center gap-2">
    <span className="text-sm">Engagement</span>
    <Badge>{content.engagementRate}%</Badge>
  </div>
</ContentCard>
```

### 7. Integración en Vista de Campaña

En la vista de detalle de campaña (cuando status = ACTIVE):

```typescript
// src/app/admin/campaigns/[id]/page.tsx

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Resumen</TabsTrigger>
    <TabsTrigger value="profiles">Perfiles</TabsTrigger>
    <TabsTrigger value="content">Contenido</TabsTrigger> {/* NUEVO */}
    <TabsTrigger value="budget">Presupuesto</TabsTrigger>
  </TabsList>

  <TabsContent value="content">
    <CampaignContentManager campaignId={params.id} />
  </TabsContent>
</Tabs>
```

## Estructura de Archivos

```
src/
├── lib/
│   ├── apify.ts                    # ✅ Cliente de Apify (configuración)
│   ├── prisma.ts                   # ✅ Singleton de Prisma
│   ├── auth.ts                     # ✅ Configuración NextAuth
│   ├── format.ts                   # ✅ Formateo de números/fechas
│   ├── campaign-utils.ts           # ✅ Cálculos puros de markup/presupuesto
│   └── utils.ts                    # ✅ Utilidades generales
│
├── services/
│   ├── scraping/
│   │   ├── index.ts                # API pública del scraper
│   │   ├── types.ts                # Tipos e interfaces
│   │   ├── base-strategy.ts        # Estrategia configurable base
│   │   ├── strategy-factory.ts     # Factory para crear estrategias
│   │   └── engagement.ts           # Cálculos de engagement y alcance
│   ├── content/
│   │   └── uploader-service.ts     # Upload a Vercel Blob Storage
│   ├── admin.ts                    # ✅ Ya existe
│   ├── campaign.ts                 # ✅ Ya existe
│   ├── profile.ts                  # ✅ Ya existe
│   └── social-processor.ts         # ✅ Ya existe
│
├── data-access/
│   ├── campaign-content.ts         # CRUD de contenido (USA PRISMA)
│   ├── content-metrics.ts          # Queries de métricas (USA PRISMA)
│   └── content-analytics.ts        # Queries de analytics (USA PRISMA)
│
├── jobs/
│   ├── scrape-campaign-content.ts  # Job principal
│   └── scheduler.ts                # (opcional) Configuración de cron
│
├── app/api/
│   ├── campaigns/
│   │   └── [id]/
│   │       ├── content/
│   │       │   └── route.ts        # POST /campaigns/:id/content
│   │       │                       # GET  /campaigns/:id/content
│   │       ├── content-progress/
│   │       │   └── route.ts        # GET /campaigns/:id/content-progress ⭐
│   │       └── analytics/
│   │           ├── route.ts                    # GET /campaigns/:id/analytics
│   │           ├── compare-periods/
│   │           │   └── route.ts                # POST /campaigns/:id/analytics/compare-periods
│   │           ├── compare-contents/
│   │           │   └── route.ts                # POST /campaigns/:id/analytics/compare-contents
│   │           └── search-contents/
│   │               └── route.ts                # GET /campaigns/:id/analytics/search-contents
│   ├── cron/
│   │   └── scrape-content/
│   │       └── route.ts            # GET /cron/scrape-content (Vercel Cron)
│   └── content/
│       └── [contentId]/
│           ├── route.ts            # GET    /content/:id
│           │                       # PATCH  /content/:id
│           ├── metrics/
│           │   └── route.ts        # GET /content/:id/metrics
│           └── scrape/
│               └── route.ts        # POST /content/:id/scrape
│
└── components/
    └── campaigns/
        ├── campaign-content-manager.tsx      # Manager principal
        ├── content-list.tsx                  # Lista de contenido
        ├── content-card.tsx                  # Card individual con indicador de alcance
        ├── add-content-form.tsx              # Formulario agregar URL con selector de servicio
        ├── service-progress-card.tsx         # ⭐ Card de progreso de servicio
        ├── service-progress-list.tsx         # ⭐ Lista de progreso de servicios
        ├── reach-performance-indicator.tsx   # ⭐ Indicador de alcance (verde/rojo)
        └── analytics/
            ├── content-metrics-chart.tsx           # Componente principal con tabs
            ├── global-metrics-chart.tsx            # Vista global campaña
            ├── profile-metrics-chart.tsx           # Vista por perfil
            ├── format-metrics-chart.tsx            # Vista por formato
            ├── comparison/
            │   ├── comparison-tabs.tsx             # Tabs: Períodos vs Contenidos
            │   ├── period-comparison.tsx           # Comparar rangos de fechas
            │   ├── content-comparison.tsx          # Comparar contenidos específicos
            │   ├── content-selector.tsx            # Buscar y seleccionar contenidos
            │   ├── selected-content-card.tsx       # Card de contenido seleccionado
            │   └── comparison-chart.tsx            # Gráfico comparativo
            ├── date-range-picker.tsx               # Selector de fechas
            └── metrics-export-button.tsx           # Exportar a CSV/PNG
```

## Configuración de Plataformas en Seed

Actualizar `prisma/seed.ts` para incluir configuración de scraping:

```typescript
// ============ CREAR PLATAFORMAS SOCIALES CON CONFIGURACIÓN DE SCRAPING ============
const platforms = [
  {
    name: "instagram",
    displayName: "Instagram",
    icon: "instagram",
    apifyActorId: "apify/instagram-post-scraper",
    apifyActorInput: {
      resultsLimit: 1,
    },
    urlPattern: "^https?://(?:www\\.)?instagram\\.com/(p|reel)/([^/?]+)",
    idExtractor: "instagram\\.com/(?:p|reel)/([^/?]+)",
    scrapingConfig: {
      metadata: {
        caption: "caption",
        shortCode: "shortCode",
        publishedAt: "timestamp",
        width: "dimensionsWidth",
        height: "dimensionsHeight",
        coverUrl: "displayUrl",
        videoUrl: "videoUrl",
        videoDuration: "videoDuration"
      },
      metrics: {
        likes: "likesCount",
        comments: "commentsCount",
        views: "videoViewCount",
        plays: "videoPlayCount",
        shares: null, // Instagram no expone públicamente
        saves: null
      }
    }
  },
  {
    name: "tiktok",
    displayName: "TikTok",
    icon: "tiktok",
    apifyActorId: "clockworks/tiktok-scraper",
    apifyActorInput: {
      resultsPerPage: 1,
    },
    urlPattern: "^https?://(?:www\\.)?tiktok\\.com/@[^/]+/video/(\\d+)",
    idExtractor: "tiktok\\.com/@[^/]+/video/(\\d+)",
    scrapingConfig: {
      metadata: {
        caption: "text",
        shortCode: "id",
        publishedAt: "createTime",
        publishedAtTransform: "timestamp", // indica que es unix timestamp
        width: "videoMeta.width",
        height: "videoMeta.height",
        coverUrl: "videoMeta.coverUrl",
        videoUrl: "webVideoUrl",
        videoDuration: "videoMeta.duration"
      },
      metrics: {
        likes: "diggCount",
        comments: "commentCount",
        views: "playCount",
        plays: "playCount",
        shares: "shareCount",
        saves: "collectCount"
      }
    }
  }
];

for (const platform of platforms) {
  const created = await prisma.socialPlatform.upsert({
    where: { name: platform.name },
    update: {
      apifyActorId: platform.apifyActorId,
      apifyActorInput: platform.apifyActorInput,
      urlPattern: platform.urlPattern,
      idExtractor: platform.idExtractor,
      scrapingConfig: platform.scrapingConfig,
    },
    create: platform,
  });
  createdPlatforms[platform.name] = created;
  console.log("Platform created:", created.displayName);
}
```

## Mapeo de Datos (Automático)

El mapeo ahora es **configurable** y se realiza automáticamente basado en `scrapingConfig`:

### Ejemplo: Instagram

**Configuración en DB:**
```json
{
  "metadata": {
    "caption": "caption",
    "publishedAt": "timestamp"
  }
}
```

**Datos de Apify:**
```json
{
  "caption": "Robinson se queda con la moto...",
  "timestamp": "2025-11-27T22:11:11.000Z"
}
```

**Resultado mapeado:**
```typescript
{
  metadata: {
    caption: "Robinson se queda con la moto...",
    publishedAt: new Date("2025-11-27T22:11:11.000Z")
  }
}
```

### Ejemplo: TikTok con Nested Values

**Configuración en DB:**
```json
{
  "metadata": {
    "width": "videoMeta.width",
    "publishedAt": "createTime",
    "publishedAtTransform": "timestamp"
  }
}
```

**Datos de Apify:**
```json
{
  "createTime": 1771172931,
  "videoMeta": {
    "width": 576
  }
}
```

**Resultado mapeado:**
```typescript
{
  metadata: {
    width: 576,
    publishedAt: new Date(1771172931 * 1000) // Transformado de timestamp
  }
}
```

## Plan de Implementación

### Fase 1: Base de Datos y Modelos (Día 1)
1. ✅ Actualizar `prisma/schema.prisma` con nuevos modelos
2. ✅ Ejecutar `npm run db:generate`
3. ✅ Ejecutar `npm run db:push` (dev) o crear migración (prod)
4. ✅ Actualizar tipos TypeScript

### Fase 2: Servicios Core (Día 1-2)
1. ✅ Implementar `services/scraping/types.ts`
   - Interfaces y tipos compartidos
   - ScraperStrategy interface
2. ✅ Implementar `services/scraping/base-strategy.ts`
   - ConfigurableScraperStrategy
   - Mapeo configurable basado en scrapingConfig
   - Manejo de valores anidados (dot notation)
   - Transformaciones (timestamps, etc.)
3. ✅ Implementar `services/scraping/strategy-factory.ts`
   - Factory Pattern
   - Cache de estrategias
   - Detección automática de plataforma
4. ✅ Implementar `services/scraping/index.ts`
   - API pública simplificada
5. ✅ Implementar `services/scraping/engagement.ts`
   - Cálculo de engagement rate
   - Cálculo de alcance esperado (calculateExpectedReach)
   - Evaluación de performance de alcance (evaluateReachPerformance)
   - Métricas derivadas
6. ✅ Implementar `services/content/uploader-service.ts`
   - Descarga y upload a Vercel Blob Storage
   - Manejo de errores y reintentos
   - Upload paralelo de múltiples imágenes
7. ✅ Actualizar `prisma/seed.ts`
   - Agregar configuración de scraping a plataformas

### Fase 3: Data Access Layer (Día 2)
1. ✅ Crear `data-access/campaign-content.ts`
   - CRUD de contenido
   - Queries con filtros
   - Queries para scraping
2. ✅ Crear `data-access/content-analytics.ts`
   - Métricas agregadas globales
   - Métricas por perfil
   - Métricas por formato
   - Series temporales
   - Comparación de rangos
3. ✅ Tests unitarios (opcional)
4. ✅ **IMPORTANTE**: Validar que SOLO data-access importe Prisma

### Fase 4: API Routes (Día 2-3)
1. ✅ POST `/api/campaigns/[id]/content` - Agregar contenido
2. ✅ GET `/api/campaigns/[id]/content` - Listar contenido
3. ✅ GET `/api/campaigns/[id]/content-progress` - **⭐ Progreso por servicio**
4. ✅ GET `/api/campaigns/[id]/analytics` - Analytics (múltiples vistas)
5. ✅ POST `/api/campaigns/[id]/analytics/compare-periods` - Comparar períodos
6. ✅ POST `/api/campaigns/[id]/analytics/compare-contents` - Comparar contenidos
7. ✅ GET `/api/campaigns/[id]/analytics/search-contents` - Buscar contenidos
8. ✅ GET `/api/campaigns/content/[contentId]` - Detalle
9. ✅ GET `/api/campaigns/content/[contentId]/metrics` - Historial
10. ✅ POST `/api/campaigns/content/[contentId]/scrape` - Scrape manual
11. ✅ PATCH `/api/campaigns/content/[contentId]` - Actualizar estado

### Fase 5: Cron Job (Día 3)
1. ✅ Implementar `jobs/scrape-campaign-content.ts`
2. ✅ Configurar scheduler (node-cron o Vercel Cron)
3. ✅ Testing manual del job
4. ✅ Configurar variables de entorno

### Fase 6: UI Components (Día 4-5)
1. ✅ `campaign-content-manager.tsx` - Manager principal
2. ✅ `add-content-form.tsx` - Formulario de agregar URL con selector de servicio
3. ✅ `content-list.tsx` - Lista de contenido con indicadores de alcance
4. ✅ `content-card.tsx` - Card individual con indicador de alcance
5. ✅ `service-progress-card.tsx` - Card de progreso de servicio
6. ✅ `service-progress-list.tsx` - Lista de progreso de servicios
7. ✅ `reach-performance-indicator.tsx` - Indicador de alcance (verde/amarillo/rojo)
8. ✅ Analytics components:
   - `content-metrics-chart.tsx` - Componente principal con tabs
   - `global-metrics-chart.tsx` - Vista global
   - `profile-metrics-chart.tsx` - Por perfil
   - `format-metrics-chart.tsx` - Por formato
   - `comparison/comparison-tabs.tsx` - Tabs de comparación
   - `comparison/period-comparison.tsx` - Comparar períodos
   - `comparison/content-comparison.tsx` - Comparar contenidos específicos
   - `comparison/content-selector.tsx` - Buscador de contenidos
   - `comparison/selected-content-card.tsx` - Card seleccionado
   - `comparison/comparison-chart.tsx` - Gráfico comparativo
   - `date-range-picker.tsx` - Selector fechas
   - `metrics-export-button.tsx` - Exportar datos

### Fase 7: Integración (Día 5)
1. ✅ Integrar en vista de campaña activa
2. ✅ Testing end-to-end
3. ✅ Ajustes de UI/UX

### Fase 8: Testing y Deployment (Día 6)
1. ✅ Testing completo con URLs reales
2. ✅ Validar cron job en producción
3. ✅ Documentación
4. ✅ Deploy

## Variables de Entorno

```env
# Apify (ya existe)
APIFY_API_TOKEN=your_token_here

# Cron Job (para Vercel Cron)
CRON_SECRET=your_secret_here

# Vercel Blob Storage (para covers/imágenes)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx

# Opcional: En desarrollo local puedes usar otro provider
# NODE_ENV=development
```

## Configuración de Vercel Blob

### 1. Instalación

```bash
npm install @vercel/blob
```

### 2. Setup en Vercel Dashboard

1. Ir a tu proyecto en Vercel
2. Settings → Storage → Blob
3. Crear nuevo Blob Store
4. Copiar el token `BLOB_READ_WRITE_TOKEN`
5. Agregar a variables de entorno del proyecto

### 3. Desarrollo Local

Para desarrollo local, Vercel Blob funciona automáticamente si:
- Tienes Vercel CLI instalado (`npm i -g vercel`)
- Estás logueado (`vercel login`)
- Ejecutas con `vercel dev` en lugar de `npm run dev`

Alternativamente, puedes usar el token directamente en `.env.local`:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx
```

## Beneficios de las Nuevas Funcionalidades

### ✅ Vinculación de Contenido con Servicios

**Control Total:**
- Saber exactamente qué servicios están completos
- Validar entregas antes de finalizar campaña
- Prevenir agregar más contenido del contratado

**UX Mejorada:**
- Usuario ve progreso visual (1 de 2, 2 de 2, etc.)
- No puede agregar más de lo contratado
- Claridad sobre qué falta por entregar

**Reporting:**
- Reportes por tipo de servicio
- Comparar performance entre formatos
- Facturación más precisa

**Analytics:**
- Comparar Reels vs Stories
- Ver qué formato tiene mejor ROI
- Optimizar futuras campañas

### ✅ Validación de Alcance

**Identificación Rápida:**
- Ver de un vistazo qué contenidos están teniendo buen rendimiento
- Identificar contenidos que necesitan boost/pauta
- Detectar perfiles que consistentemente superan expectativas

**Toma de Decisiones:**
- Priorizar inversión en contenidos de bajo alcance
- Reconocer influencers que entregan valor superior
- Ajustar estrategias de pauta en tiempo real

**Transparencia con Clientes:**
- Mostrar evidencia visual de performance
- Justificar inversiones adicionales en pauta
- Demostrar ROI basado en alcance esperado vs real

## Ventajas de Factory + Strategy Pattern

### ✅ Escalabilidad
- Agregar YouTube, Twitter/X, etc. solo requiere:
  1. Agregar la plataforma en seed con su configuración
  2. NO se necesita código nuevo

### ✅ Mantenibilidad
- Cambios en estructura de datos de Apify solo requieren actualizar `scrapingConfig` en DB
- Sin despliegues de código
- Configuración centralizada

### ✅ Testabilidad
- Cada estrategia es independiente
- Fácil crear mocks
- Tests unitarios del Factory

### ✅ Flexibilidad
- Admins pueden ajustar configuraciones desde UI (futuro)
- A/B testing de diferentes mapeos
- Soporte de múltiples actors para la misma plataforma

### ✅ DRY (Don't Repeat Yourself)
- Sin código duplicado para cada plataforma
- Lógica de mapeo reutilizable
- Un solo punto de mantenimiento

## Agregar Nuevas Plataformas

Para agregar YouTube, Twitter/X, Threads, etc:

```sql
INSERT INTO "SocialPlatform" (
  "id", "name", "displayName", "icon", "isActive",
  "apifyActorId", "apifyActorInput", "urlPattern", "idExtractor",
  "scrapingConfig", "createdAt"
) VALUES (
  gen_random_uuid(),
  'youtube',
  'YouTube',
  'youtube',
  true,
  'your-actor/youtube-scraper',
  '{"resultsLimit": 1}',
  '^https?://(?:www\.)?youtube\.com/watch\?v=([^&]+)',
  'youtube\.com/watch\?v=([^&]+)',
  '{
    "metadata": {
      "caption": "title",
      "shortCode": "id",
      "publishedAt": "publishedAt",
      "coverUrl": "thumbnail",
      "videoDuration": "duration"
    },
    "metrics": {
      "likes": "likeCount",
      "comments": "commentCount",
      "views": "viewCount"
    }
  }',
  NOW()
);
```

**No se necesita código adicional!** El Factory automáticamente creará la estrategia.

## Consideraciones Técnicas

### Rate Limits de Apify
- Instagram Post Scraper: ~100 posts/run
- TikTok Scraper: ~100 videos/run
- Implementar rate limiting en el cron job
- Procesar en batches si hay muchos contenidos

### Vercel Blob Storage
- **Sin límites de filesystem**: Blob es persistente, no efímero como el filesystem de Vercel
- **Estructura**: `campaign-content/{platform}/{contentId}.{ext}`
- **Access**: Público para mostrar en UI
- **Límites**: Vercel Blob tiene límites según el plan
  - Hobby: 100GB storage, 1TB bandwidth/mes
  - Pro: 500GB storage, 5TB bandwidth/mes
- **Costos**: $0.15/GB/mes storage, $0.30/GB bandwidth
- **Limpieza automática**: Implementar job para eliminar covers de contenidos eliminados
- **CDN**: Vercel Blob usa CDN automáticamente

### Optimización de Imágenes
- Considerar usar Next.js Image Optimization con las URLs de Blob
- Vercel comprime y optimiza automáticamente
- Lazy loading en componentes

### Métricas cada 6 horas
- 4 snapshots por día
- ~120 snapshots por mes por contenido
- Considerar limpieza de snapshots antiguos (>3 meses)

### Backup de Imágenes
- Vercel Blob tiene redundancia automática
- No necesita backup manual
- Considerar mantener `coverUrl` (URL original) como fallback

### Engagement Rate
Fórmula general:
```
ER = (Likes + Comments + Shares) / Followers * 100
```

Necesitamos obtener followers del `SocialAccount` asociado.

### Error Handling
- Si un scrape falla 3 veces consecutivas → status = ERROR
- Notificar al admin por email
- Permitir reactivar manualmente

## Testing

### Manual Testing
1. Agregar URL de Instagram Reel
2. Verificar que se detecta la plataforma correctamente
3. Verificar que se hace el primer scrape
4. Verificar que se descarga el cover
5. Agregar URL de TikTok
6. Verificar métricas iniciales
7. Ejecutar cron job manualmente
8. Verificar nuevo snapshot de métricas
9. Ver gráfico de evolución

### URLs de prueba
```
Instagram:
https://www.instagram.com/reel/DRk4Ai5kVi0

TikTok:
https://www.tiktok.com/@jordiwild/video/7607129797256334595
```

## Métricas de Éxito

- ✅ Agregar contenido de Instagram y TikTok sin errores
- ✅ Scrapers ejecutándose cada 6 horas automáticamente
- ✅ Historial de métricas visible en gráficos
- ✅ Covers descargados y mostrados correctamente
- ✅ Error rate < 5% en scrapers
- ✅ Tiempo de respuesta de API < 2s

## Próximos Pasos (Futuro)

1. **YouTube, Twitter/X**: Agregar soporte para más plataformas
2. **Alertas**: Notificar cuando un contenido alcanza cierto engagement
3. **Comparación**: Comparar rendimiento entre perfiles
4. **Export**: Exportar reportes de rendimiento en PDF/Excel
5. **Predicción**: ML para predecir rendimiento futuro
6. **Stories**: Soporte para Instagram Stories (24h lifetime)

## Referencias

- [Apify Instagram Profile Scraper](https://apify.com/apify/instagram-profile-scraper)
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper)
- Prisma Schema actual: `prisma/schema.prisma`
- Datos de ejemplo: `data_json/video_instagram.json`, `data_json/video_tiktok.json`

# Plan: Vista Pública de Campaña para Clientes

**Fecha**: 2026-02-17
**Estado**: Planificación
**Prioridad**: Alta
**Relacionado con**: `seguimiento-contenido-campanas.md`

## Resumen

Implementar un sistema de URLs compartibles que permita a los clientes ver las métricas y progreso de sus campañas en tiempo real sin necesidad de autenticación en el sistema principal.

### Características Principales

- ✅ **URLs únicas y seguras** con tokens aleatorios
- ✅ **Acceso sin autenticación** mediante token en URL
- ✅ **Dashboard público** con métricas en tiempo real
- ✅ **Control de expiración** y revocación de accesos
- ✅ **Branding personalizado** (opcional: logo del cliente)
- ✅ **Modo de solo lectura** (sin acceso a edición)
- ✅ **Responsive** para visualización en móvil
- ✅ **Exportación de reportes** en PDF (opcional)

### Casos de Uso

1. **Admin genera link**: Desde el panel de campaña, clic en "Compartir con cliente"
2. **Cliente recibe link**: `https://app.com/campaign/public/abc123xyz789`
3. **Cliente visualiza**:
   - Estado general de la campaña
   - Progreso por servicio contratado (1 de 2 Reels, etc.)
   - Contenidos publicados con métricas actualizadas
   - Gráficos de engagement y alcance
   - Validación de alcance (verde/amarillo/rojo)
4. **Admin controla acceso**: Puede revocar o regenerar el link en cualquier momento

## Arquitectura

### 1. Modelo de Datos

```prisma
// ============ VISTA PÚBLICA DE CAMPAÑA ============

enum PublicViewStatus {
  ACTIVE      // Link activo y accesible
  EXPIRED     // Expirado por fecha
  REVOKED     // Revocado manualmente
}

model CampaignPublicView {
  id        String   @id @default(cuid())

  // Token único para acceso (UUID o similar)
  token     String   @unique @default(cuid())

  // Campaña asociada
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  campaignId String

  // Control de acceso
  status         PublicViewStatus @default(ACTIVE)
  expiresAt      DateTime?        // Opcional: fecha de expiración
  lastAccessedAt DateTime?        // Última vez que se accedió
  accessCount    Int @default(0)  // Contador de visualizaciones

  // Configuración de la vista
  config Json? // Configuración personalizable (logo, colores, widgets visibles)

  // Metadata
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([token])
  @@index([campaignId])
  @@index([status])
}

// Agregar a Campaign model:
model Campaign {
  // ... campos existentes ...

  publicViews CampaignPublicView[]
}

// Agregar a User model:
model User {
  // ... campos existentes ...

  createdPublicViews CampaignPublicView[]
}
```

**Ejemplo de `config` JSON:**
```json
{
  "theme": {
    "primaryColor": "#6366f1",
    "logoUrl": "https://blob.vercel.../client-logo.png"
  },
  "widgets": {
    "showEngagementChart": true,
    "showTimeSeriesChart": true,
    "showReachValidation": true,
    "showServiceProgress": true
  },
  "watermark": "Powered by InfluencerManager"
}
```

### 2. Seguridad y Validación

#### Token Generation
```typescript
// src/lib/crypto.ts

import { randomBytes } from 'crypto'

/**
 * Genera un token seguro para vista pública
 * Usa crypto.randomBytes para mayor seguridad que cuid()
 */
export function generatePublicViewToken(): string {
  // 32 bytes = 256 bits de entropía
  return randomBytes(32).toString('base64url')
}

/**
 * Valida que un token tenga el formato correcto
 */
export function isValidPublicViewToken(token: string): boolean {
  // Base64url tiene caracteres [A-Za-z0-9_-]
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}
```

#### Middleware de Validación
```typescript
// src/middleware.ts (actualizar existente)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas de campaña
  if (pathname.startsWith('/campaign/public/')) {
    const token = pathname.split('/campaign/public/')[1]

    // Validar formato del token
    if (!isValidPublicViewToken(token)) {
      return NextResponse.redirect(new URL('/invalid-link', request.url))
    }

    // Validar estado del link en API route
    // (no hacemos query aquí para no sobrecargar middleware)
    return NextResponse.next()
  }

  // ... resto del middleware existente ...
}
```

### 3. Data Access Layer

#### `src/data-access/campaign-public-view.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { PublicViewStatus } from '@prisma/client'

// ========== TIPOS ==========

export interface CreatePublicViewData {
  campaignId: string
  createdById: string
  expiresAt?: Date
  config?: {
    theme?: {
      primaryColor?: string
      logoUrl?: string
    }
    widgets?: {
      showEngagementChart?: boolean
      showTimeSeriesChart?: boolean
      showReachValidation?: boolean
      showServiceProgress?: boolean
    }
    watermark?: string
  }
}

export interface PublicViewWithCampaign {
  id: string
  token: string
  status: PublicViewStatus
  expiresAt: Date | null
  accessCount: number
  campaign: {
    id: string
    name: string
    status: string
    startDate: Date | null
    endDate: Date | null
    client: {
      id: string
      name: string
      logoUrl: string | null
    }
  }
  config: any
}

// ========== QUERIES ==========

/**
 * Crea una nueva vista pública para una campaña
 */
export async function createPublicView(data: CreatePublicViewData) {
  const { generatePublicViewToken } = await import('@/lib/crypto')

  return prisma.campaignPublicView.create({
    data: {
      token: generatePublicViewToken(),
      campaignId: data.campaignId,
      createdById: data.createdById,
      expiresAt: data.expiresAt,
      config: data.config || {},
      status: 'ACTIVE'
    },
    include: {
      campaign: {
        include: {
          client: true
        }
      }
    }
  })
}

/**
 * Obtiene una vista pública por token
 * Actualiza lastAccessedAt y accessCount
 */
export async function getPublicViewByToken(
  token: string
): Promise<PublicViewWithCampaign | null> {
  const view = await prisma.campaignPublicView.findUnique({
    where: { token },
    include: {
      campaign: {
        include: {
          client: true
        }
      }
    }
  })

  if (!view) return null

  // Actualizar estadísticas de acceso
  await prisma.campaignPublicView.update({
    where: { id: view.id },
    data: {
      lastAccessedAt: new Date(),
      accessCount: { increment: 1 }
    }
  })

  return view as PublicViewWithCampaign
}

/**
 * Obtiene todas las vistas públicas de una campaña
 */
export async function getPublicViewsByCampaign(campaignId: string) {
  return prisma.campaignPublicView.findMany({
    where: { campaignId },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
}

/**
 * Revoca una vista pública (cambia status a REVOKED)
 */
export async function revokePublicView(viewId: string) {
  return prisma.campaignPublicView.update({
    where: { id: viewId },
    data: { status: 'REVOKED' }
  })
}

/**
 * Actualiza la configuración de una vista pública
 */
export async function updatePublicViewConfig(
  viewId: string,
  config: CreatePublicViewData['config']
) {
  return prisma.campaignPublicView.update({
    where: { id: viewId },
    data: { config }
  })
}

/**
 * Verifica si una vista pública es válida y accesible
 */
export async function isPublicViewAccessible(token: string): Promise<{
  accessible: boolean
  reason?: 'not_found' | 'revoked' | 'expired' | 'campaign_inactive'
}> {
  const view = await prisma.campaignPublicView.findUnique({
    where: { token },
    include: {
      campaign: true
    }
  })

  if (!view) {
    return { accessible: false, reason: 'not_found' }
  }

  if (view.status === 'REVOKED') {
    return { accessible: false, reason: 'revoked' }
  }

  if (view.expiresAt && view.expiresAt < new Date()) {
    // Auto-expirar
    await prisma.campaignPublicView.update({
      where: { id: view.id },
      data: { status: 'EXPIRED' }
    })
    return { accessible: false, reason: 'expired' }
  }

  // Verificar que la campaña esté en estado válido
  const validStatuses = ['ACTIVE', 'REVIEW', 'COMPLETED']
  if (!validStatuses.includes(view.campaign.status)) {
    return { accessible: false, reason: 'campaign_inactive' }
  }

  return { accessible: true }
}
```

### 4. Service Layer

#### `src/services/public-view-service.ts`

```typescript
import {
  createPublicView,
  getPublicViewByToken,
  getPublicViewsByCampaign,
  revokePublicView,
  isPublicViewAccessible,
  type CreatePublicViewData
} from '@/data-access/campaign-public-view'

import {
  getContentProgressByService,
  getCampaignMetricsAggregated,
  getCampaignMetricsByProfile,
  getCampaignContent
} from '@/data-access/campaign-content'

/**
 * Servicio para gestionar vistas públicas de campañas
 */
export class PublicViewService {
  /**
   * Genera una nueva vista pública para una campaña
   */
  async generatePublicLink(data: CreatePublicViewData) {
    const view = await createPublicView(data)

    // Construir URL pública
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const publicUrl = `${baseUrl}/campaign/public/${view.token}`

    return {
      ...view,
      publicUrl
    }
  }

  /**
   * Obtiene los datos completos para la vista pública
   * Incluye toda la información que el cliente debe ver
   */
  async getPublicViewData(token: string) {
    // 1. Validar acceso
    const accessCheck = await isPublicViewAccessible(token)
    if (!accessCheck.accessible) {
      return { error: accessCheck.reason, data: null }
    }

    // 2. Obtener vista y campaña
    const view = await getPublicViewByToken(token)
    if (!view) {
      return { error: 'not_found', data: null }
    }

    const campaignId = view.campaign.id

    // 3. Obtener datos de la campaña en paralelo
    const [
      serviceProgress,
      globalMetrics,
      profileMetrics,
      contents
    ] = await Promise.all([
      getContentProgressByService(campaignId),
      getCampaignMetricsAggregated(campaignId),
      getCampaignMetricsByProfile(campaignId),
      getCampaignContent(campaignId, {})
    ])

    return {
      error: null,
      data: {
        campaign: {
          id: view.campaign.id,
          name: view.campaign.name,
          status: view.campaign.status,
          startDate: view.campaign.startDate,
          endDate: view.campaign.endDate,
          client: view.campaign.client
        },
        config: view.config,
        metrics: {
          global: globalMetrics,
          byProfile: profileMetrics
        },
        serviceProgress,
        contents: contents.map(content => ({
          id: content.id,
          url: content.url,
          platform: content.platform,
          status: content.status,
          caption: content.caption,
          coverBlobUrl: content.coverBlobUrl,
          publishedAt: content.publishedAt,
          profile: {
            name: content.campaignProfilePlatform.socialAccount.profile.name,
            username: content.campaignProfilePlatform.socialAccount.username,
            followers: content.campaignProfilePlatform.socialAccount.followers
          },
          latestMetrics: content.metricsSnapshots[0] || null,
          // Incluir evaluación de alcance
          reachPerformance: content.metricsSnapshots[0]?.views
            ? this.evaluateReach(
                content.metricsSnapshots[0].views,
                content.campaignProfilePlatform.socialAccount.followers || 0
              )
            : null
        }))
      }
    }
  }

  /**
   * Evalúa el performance de alcance (importado de engagement.ts)
   */
  private evaluateReach(actualViews: number, followers: number) {
    const { evaluateReachPerformance } = require('./scraping/engagement')
    return evaluateReachPerformance(actualViews, followers)
  }

  /**
   * Obtiene todas las vistas públicas de una campaña
   */
  async getCampaignPublicViews(campaignId: string) {
    const views = await getPublicViewsByCampaign(campaignId)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    return views.map(view => ({
      ...view,
      publicUrl: `${baseUrl}/campaign/public/${view.token}`
    }))
  }

  /**
   * Revoca una vista pública
   */
  async revokeView(viewId: string) {
    return revokePublicView(viewId)
  }
}

// Export singleton
export const publicViewService = new PublicViewService()
```

### 5. API Routes

#### `POST /api/campaigns/[id]/public-view`
Genera una nueva vista pública para una campaña.

```typescript
// src/app/api/campaigns/[id]/public-view/route.ts

import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { publicViewService } from '@/services/public-view-service'
import { z } from 'zod'

const createPublicViewSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  config: z.object({
    theme: z.object({
      primaryColor: z.string().optional(),
      logoUrl: z.string().url().optional()
    }).optional(),
    widgets: z.object({
      showEngagementChart: z.boolean().optional(),
      showTimeSeriesChart: z.boolean().optional(),
      showReachValidation: z.boolean().optional(),
      showServiceProgress: z.boolean().optional()
    }).optional()
  }).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo admins pueden crear vistas públicas
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createPublicViewSchema.parse(body)

    const result = await publicViewService.generatePublicLink({
      campaignId: params.id,
      createdById: session.user.id,
      expiresAt: validatedData.expiresAt
        ? new Date(validatedData.expiresAt)
        : undefined,
      config: validatedData.config
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error creating public view:', error)
    return NextResponse.json(
      { error: 'Failed to create public view' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const views = await publicViewService.getCampaignPublicViews(params.id)
    return NextResponse.json({ views })
  } catch (error) {
    console.error('Error fetching public views:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public views' },
      { status: 500 }
    )
  }
}
```

#### `DELETE /api/public-view/[viewId]`
Revoca una vista pública.

```typescript
// src/app/api/public-view/[viewId]/route.ts

import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { publicViewService } from '@/services/public-view-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { viewId: string } }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await publicViewService.revokeView(params.viewId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking public view:', error)
    return NextResponse.json(
      { error: 'Failed to revoke public view' },
      { status: 500 }
    )
  }
}
```

#### `GET /api/public-view/[token]`
Obtiene los datos para la vista pública (sin autenticación).

```typescript
// src/app/api/public-view/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { publicViewService } from '@/services/public-view-service'
import { isValidPublicViewToken } from '@/lib/crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Validar formato del token
    if (!isValidPublicViewToken(params.token)) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      )
    }

    const result = await publicViewService.getPublicViewData(params.token)

    if (result.error) {
      const statusCodes = {
        not_found: 404,
        revoked: 403,
        expired: 410,
        campaign_inactive: 403
      }

      return NextResponse.json(
        { error: result.error },
        { status: statusCodes[result.error] || 400 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Error fetching public view data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public view data' },
      { status: 500 }
    )
  }
}
```

### 6. Frontend - Página Pública

#### `src/app/campaign/public/[token]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { PublicCampaignDashboard } from '@/components/public-view/public-campaign-dashboard'

interface PublicCampaignPageProps {
  params: { token: string }
}

async function getPublicViewData(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const response = await fetch(`${baseUrl}/api/public-view/${token}`, {
    cache: 'no-store' // Siempre obtener datos frescos
  })

  if (!response.ok) {
    return null
  }

  return response.json()
}

export default async function PublicCampaignPage({ params }: PublicCampaignPageProps) {
  const data = await getPublicViewData(params.token)

  if (!data) {
    notFound()
  }

  return <PublicCampaignDashboard data={data} />
}
```

#### Error Pages

```tsx
// src/app/campaign/public/[token]/not-found.tsx

export default function PublicViewNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Link no válido</h1>
        <p className="mt-4 text-gray-600">
          Este link de campaña no existe o ha sido revocado.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Por favor, contacta con el administrador de la campaña.
        </p>
      </div>
    </div>
  )
}
```

```tsx
// src/app/campaign/public/[token]/error.tsx

'use client'

export default function PublicViewError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Error</h1>
        <p className="mt-4 text-gray-600">
          Ocurrió un error al cargar la campaña.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
```

### 7. Componentes de UI

#### `src/components/public-view/public-campaign-dashboard.tsx`

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CalendarIcon, TrendingUpIcon } from 'lucide-react'
import { ContentCard } from './content-card'
import { ServiceProgressCard } from './service-progress-card'
import { MetricsChart } from './metrics-chart'
import { ReachPerformanceIndicator } from './reach-performance-indicator'

interface PublicCampaignDashboardProps {
  data: {
    campaign: {
      name: string
      status: string
      startDate: Date | null
      endDate: Date | null
      client: {
        name: string
        logoUrl: string | null
      }
    }
    config: any
    metrics: {
      global: any
      byProfile: any[]
    }
    serviceProgress: any[]
    contents: any[]
  }
}

export function PublicCampaignDashboard({ data }: PublicCampaignDashboardProps) {
  const { campaign, config, metrics, serviceProgress, contents } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {campaign.name}
              </h1>
              <p className="mt-1 text-gray-600">{campaign.client.name}</p>
            </div>

            {campaign.client.logoUrl && (
              <img
                src={campaign.client.logoUrl}
                alt={campaign.client.name}
                className="h-16 w-auto"
              />
            )}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {campaign.status}
            </Badge>

            {campaign.startDate && campaign.endDate && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {new Date(campaign.startDate).toLocaleDateString('es-ES')} -{' '}
                  {new Date(campaign.endDate).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Métricas Globales */}
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">Métricas Generales</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Likes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.global.totalLikes.toLocaleString('es-ES')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Comentarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.global.totalComments.toLocaleString('es-ES')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Vistas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.global.totalViews?.toLocaleString('es-ES') || 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Engagement Promedio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">
                    {metrics.global.avgEngagementRate?.toFixed(2)}%
                  </div>
                  <TrendingUpIcon className="h-4 w-4 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Progreso por Servicio */}
        {config?.widgets?.showServiceProgress !== false && (
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">Progreso de Servicios</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {serviceProgress.map((service) => (
                <ServiceProgressCard
                  key={service.campaignServiceId}
                  service={service}
                />
              ))}
            </div>
          </section>
        )}

        {/* Gráficos */}
        {config?.widgets?.showEngagementChart !== false && (
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">Métricas por Perfil</h2>
            <Card>
              <CardContent className="pt-6">
                <MetricsChart data={metrics.byProfile} />
              </CardContent>
            </Card>
          </section>
        )}

        {/* Contenidos Publicados */}
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">Contenidos Publicados</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {contents.map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                showReachValidation={config?.widgets?.showReachValidation}
              />
            ))}
          </div>
        </section>

        {/* Footer / Watermark */}
        {config?.watermark && (
          <footer className="mt-12 border-t pt-6 text-center text-sm text-gray-500">
            {config.watermark}
          </footer>
        )}
      </main>
    </div>
  )
}
```

#### `src/components/public-view/service-progress-card.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2Icon, AlertCircleIcon } from 'lucide-react'

interface ServiceProgressCardProps {
  service: {
    serviceTypeName: string
    profileName: string
    platformName: string
    quantityContracted: number
    quantityUploaded: number
    percentage: number
    isComplete: boolean
  }
}

export function ServiceProgressCard({ service }: ServiceProgressCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{service.serviceTypeName}</CardTitle>
          {service.isComplete ? (
            <CheckCircle2Icon className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircleIcon className="h-5 w-5 text-yellow-600" />
          )}
        </div>
        <p className="text-sm text-gray-600">
          {service.profileName} • {service.platformName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {service.quantityUploaded} de {service.quantityContracted} subidos
            </span>
            <span className="font-medium">{service.percentage}%</span>
          </div>
          <Progress value={service.percentage} />
        </div>
      </CardContent>
    </Card>
  )
}
```

#### `src/components/public-view/content-card.tsx`

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HeartIcon, MessageCircleIcon, EyeIcon } from 'lucide-react'
import { ReachPerformanceIndicator } from './reach-performance-indicator'

interface ContentCardProps {
  content: {
    url: string
    platform: string
    caption: string | null
    coverBlobUrl: string | null
    publishedAt: Date | null
    profile: {
      name: string
      username: string | null
    }
    latestMetrics: {
      likes: number
      comments: number
      views: number | null
    } | null
    reachPerformance: any | null
  }
  showReachValidation?: boolean
}

export function ContentCard({ content, showReachValidation = true }: ContentCardProps) {
  return (
    <Card className="overflow-hidden">
      {/* Cover Image */}
      {content.coverBlobUrl && (
        <div className="aspect-square overflow-hidden bg-gray-100">
          <img
            src={content.coverBlobUrl}
            alt={content.caption || 'Content cover'}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <CardContent className="p-4">
        {/* Profile Info */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-medium">{content.profile.name}</p>
            {content.profile.username && (
              <p className="text-sm text-gray-600">@{content.profile.username}</p>
            )}
          </div>
          <Badge variant="outline">{content.platform}</Badge>
        </div>

        {/* Caption */}
        {content.caption && (
          <p className="mb-3 line-clamp-2 text-sm text-gray-700">
            {content.caption}
          </p>
        )}

        {/* Metrics */}
        {content.latestMetrics && (
          <div className="mb-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <HeartIcon className="h-4 w-4" />
              <span>{content.latestMetrics.likes.toLocaleString('es-ES')}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircleIcon className="h-4 w-4" />
              <span>{content.latestMetrics.comments.toLocaleString('es-ES')}</span>
            </div>
            {content.latestMetrics.views && (
              <div className="flex items-center gap-1">
                <EyeIcon className="h-4 w-4" />
                <span>{content.latestMetrics.views.toLocaleString('es-ES')}</span>
              </div>
            )}
          </div>
        )}

        {/* Reach Performance */}
        {showReachValidation && content.reachPerformance && (
          <ReachPerformanceIndicator
            performance={content.reachPerformance}
            variant="compact"
          />
        )}

        {/* Link */}
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-sm text-blue-600 hover:underline"
        >
          Ver contenido →
        </a>

        {/* Published Date */}
        {content.publishedAt && (
          <p className="mt-2 text-xs text-gray-500">
            {new Date(content.publishedAt).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### 8. Admin UI - Gestión de Links Públicos

#### `src/components/admin/campaign-public-links.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CopyIcon, LinkIcon, TrashIcon } from 'lucide-react'

interface CampaignPublicLinksProps {
  campaignId: string
}

export function CampaignPublicLinks({ campaignId }: CampaignPublicLinksProps) {
  const [links, setLinks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [expirationDate, setExpirationDate] = useState('')

  const handleGenerateLink = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/public-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: expirationDate || undefined
        })
      })

      if (!response.ok) throw new Error('Failed to generate link')

      const newLink = await response.json()
      setLinks([newLink, ...links])

      // Copiar al portapapeles
      await navigator.clipboard.writeText(newLink.publicUrl)
      toast.success('Link generado y copiado al portapapeles')

      setExpirationDate('')
    } catch (error) {
      toast.error('Error al generar el link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    toast.success('Link copiado al portapapeles')
  }

  const handleRevokeLink = async (viewId: string) => {
    if (!confirm('¿Estás seguro de revocar este link?')) return

    try {
      const response = await fetch(`/api/public-view/${viewId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to revoke link')

      setLinks(links.filter((link) => link.id !== viewId))
      toast.success('Link revocado')
    } catch (error) {
      toast.error('Error al revocar el link')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Links Públicos</CardTitle>

          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <LinkIcon className="mr-2 h-4 w-4" />
                Generar Link
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generar Link Público</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="expiration">Fecha de expiración (opcional)</Label>
                  <Input
                    id="expiration"
                    type="datetime-local"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleGenerateLink}
                  disabled={isLoading}
                  className="w-full"
                >
                  Generar y Copiar Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {links.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            No hay links públicos generados
          </p>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-mono">{link.publicUrl}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                    <span>Vistas: {link.accessCount}</span>
                    {link.expiresAt && (
                      <span>
                        Expira: {new Date(link.expiresAt).toLocaleDateString('es-ES')}
                      </span>
                    )}
                    <span className="capitalize">{link.status.toLowerCase()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyLink(link.publicUrl)}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevokeLink(link.id)}
                    disabled={link.status === 'REVOKED'}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 9. Migraciones Prisma

```prisma
// Ejecutar: npx prisma migrate dev --name add-campaign-public-view

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum PublicViewStatus {
  ACTIVE
  EXPIRED
  REVOKED
}

model CampaignPublicView {
  id              String           @id @default(cuid())
  token           String           @unique @default(cuid())
  campaign        Campaign         @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  campaignId      String
  status          PublicViewStatus @default(ACTIVE)
  expiresAt       DateTime?
  lastAccessedAt  DateTime?
  accessCount     Int              @default(0)
  config          Json?
  createdBy       User             @relation(fields: [createdById], references: [id])
  createdById     String
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([token])
  @@index([campaignId])
  @@index([status])
}
```

## Plan de Implementación

### Fase 1: Backend y Modelo de Datos (1-2 días)
1. ✅ Crear migración de Prisma para `CampaignPublicView`
2. ✅ Implementar `src/lib/crypto.ts` para generación de tokens
3. ✅ Implementar `src/data-access/campaign-public-view.ts`
4. ✅ Implementar `src/services/public-view-service.ts`
5. ✅ Crear API routes:
   - `POST /api/campaigns/[id]/public-view`
   - `GET /api/campaigns/[id]/public-view`
   - `DELETE /api/public-view/[viewId]`
   - `GET /api/public-view/[token]`

### Fase 2: Página Pública (2-3 días)
1. ✅ Crear ruta pública `src/app/campaign/public/[token]/page.tsx`
2. ✅ Implementar `PublicCampaignDashboard` con todas las secciones
3. ✅ Crear componentes:
   - `ServiceProgressCard`
   - `ContentCard`
   - `MetricsChart`
   - `ReachPerformanceIndicator`
4. ✅ Implementar páginas de error (`not-found.tsx`, `error.tsx`)
5. ✅ Actualizar middleware para validar tokens

### Fase 3: Admin UI (1-2 días)
1. ✅ Crear componente `CampaignPublicLinks`
2. ✅ Integrar en página de detalle de campaña
3. ✅ Implementar funcionalidad de copiar link
4. ✅ Implementar funcionalidad de revocar link

### Fase 4: Testing y Refinamiento (1-2 días)
1. ✅ Testing de generación de links
2. ✅ Testing de acceso público
3. ✅ Testing de expiración y revocación
4. ✅ Testing responsive (mobile)
5. ✅ Optimización de performance (caching, imágenes)

### Fase 5: Features Opcionales (1-2 días)
1. ⚠️ Exportación a PDF del reporte
2. ⚠️ Personalización de tema/branding por cliente
3. ⚠️ Analytics de visualizaciones del link
4. ⚠️ Notificaciones cuando se accede al link

## Consideraciones de Seguridad

1. **Tokens seguros**: Usar `crypto.randomBytes()` para tokens impredecibles
2. **Rate limiting**: Limitar accesos por IP a la ruta pública
3. **No exponer datos sensibles**: Solo mostrar métricas, no datos internos
4. **Validación de estado**: Verificar campaña activa antes de mostrar
5. **HTTPS obligatorio**: En producción, forzar HTTPS
6. **Headers de seguridad**: CSP, X-Frame-Options para prevenir embedding

## Mejoras Futuras

1. **Autenticación opcional**: Password-protect para links sensibles
2. **Whitelabel completo**: Subdominio personalizado por cliente
3. **Comparación de periodos**: Comparar métricas vs período anterior
4. **Descarga de imágenes**: Descargar covers en ZIP
5. **Comentarios del cliente**: Permitir feedback en contenidos específicos
6. **Integración con CRM**: Enviar link automáticamente al crear campaña
7. **Notificaciones push**: Alertas cuando se publique nuevo contenido

## Conclusión

Este sistema permitirá a los clientes tener visibilidad completa del progreso de sus campañas en tiempo real, sin necesidad de acceso al sistema principal. Los admins mantienen control total sobre qué se comparte y por cuánto tiempo.

**Ventajas:**
- ✅ Transparencia total con el cliente
- ✅ Reduce consultas manuales sobre el estado de la campaña
- ✅ Professional y moderno
- ✅ Seguro y controlable
- ✅ Fácil de compartir (solo un link)
- ✅ Sin necesidad de crear cuentas para clientes

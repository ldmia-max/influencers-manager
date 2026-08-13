# Vinculación de Contenido con Servicios Específicos

## Problema

Cuando se contrata una campaña con @maria_garcia que incluye:
- 2 Reels
- 1 Reel + Pauta

Necesitamos:
1. **Trackear** cuántos contenidos se han subido por cada servicio
2. **Validar** que no se exceda la cantidad contratada
3. **Mostrar progreso** visual de cada servicio
4. **Asociar** cada URL al servicio correcto

## Solución: Relación CampaignContent ↔ CampaignService

### Cambios en el Schema

```prisma
model CampaignService {
  id        String   @id @default(cuid())
  quantity  Int      @default(1) // ← Cantidad contratada
  basePrice Decimal  @db.Decimal(10, 2)
  // ... otros campos ...

  // ⭐ NUEVA RELACIÓN
  contents CampaignContent[]  // Contenidos asociados a este servicio

  @@unique([campaignProfilePlatformId, profileServiceId])
}

model CampaignContent {
  id        String   @id @default(cuid())
  url       String
  // ... otros campos ...

  // ⭐ NUEVA RELACIÓN
  campaignService   CampaignService? @relation(fields: [campaignServiceId], references: [id])
  campaignServiceId String?

  @@index([campaignServiceId])
}
```

## Flujo de Usuario

### 1. Ver Progreso de Servicios

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

### 2. Agregar Contenido

```
┌─────────────────────────────────────────────────┐
│  Agregar Contenido                             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Paso 1: Seleccionar Perfil                    │
│  ┌───────────────────────────────────────────┐ │
│  │ @maria_garcia                        ▼    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Paso 2: Seleccionar Plataforma               │
│  ┌───────────────────────────────────────────┐ │
│  │ Instagram                            ▼    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Paso 3: Seleccionar Formato                  │
│  ┌───────────────────────────────────────────┐ │
│  │ Reel (1 de 2 subidos) ⚠️             ▼    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Opciones disponibles:                         │
│  • Reel (1 de 2 subidos) ⚠️                    │
│  • Reel + Pauta (0 de 1 subidos) 📋           │
│  • Story (3 de 3 subidos) ✅ [Deshabilitado]  │
│                                                 │
│  Paso 4: URL del Contenido                    │
│  ┌───────────────────────────────────────────┐ │
│  │ https://instagram.com/p/xyz123            │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  📊 Vista Previa:                              │
│  ┌───────────────────────────────────────────┐ │
│  │ Subiendo Reel 2 de 2 para @maria_garcia  │ │
│  │ Después de esto: 2 de 2 subidos ✅        │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [Cancelar]              [Agregar Contenido]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3. Validación al Agregar

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

## API Endpoints

### GET /api/campaigns/[id]/content-progress

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
    },
    {
      "campaignServiceId": "svc_2",
      "profileName": "@maria_garcia",
      "platformName": "Instagram",
      "serviceTypeName": "Reel + Pauta",
      "quantityContracted": 1,
      "quantityUploaded": 0,
      "quantityRemaining": 1,
      "isComplete": false,
      "percentage": 0,
      "contents": []
    },
    {
      "campaignServiceId": "svc_3",
      "profileName": "@maria_garcia",
      "platformName": "Instagram",
      "serviceTypeName": "Story",
      "quantityContracted": 3,
      "quantityUploaded": 3,
      "quantityRemaining": 0,
      "isComplete": true,
      "percentage": 100,
      "contents": [...]
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

## Componentes

### ServiceProgressCard

```tsx
<ServiceProgressCard
  serviceName="Reel"
  quantityContracted={2}
  quantityUploaded={1}
  contents={[...]}
  onAddContent={() => {}}
/>
```

### ServiceProgressList

```tsx
<ServiceProgressList campaignId={id}>
  {progress.map(service => (
    <ServiceProgressCard
      key={service.campaignServiceId}
      {...service}
    />
  ))}
</ServiceProgressList>
```

### AddContentFormWithService

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

## Data Access Functions

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

## Beneficios

### ✅ Control Total
- Saber exactamente qué servicios están completos
- Validar entregas antes de finalizar campaña

### ✅ UX Mejorada
- Usuario ve progreso visual
- No puede agregar más de lo contratado
- Claridad sobre qué falta

### ✅ Reporting
- Reportes por tipo de servicio
- Comparar performance entre formatos
- Facturación más precisa

### ✅ Analytics
- Comparar Reels vs Stories
- Ver qué formato tiene mejor ROI
- Optimizar futuras campañas

## Ejemplo Real

**Campaña**: Verano 2026 - Cliente: Nike
**Perfil**: @maria_garcia

**Servicios Contratados**:
1. 2 Reels → $500 c/u → $1,000
2. 1 Reel + Pauta → $800 → $800
3. 3 Stories → $200 c/u → $600

**Total**: $2,400

**Progress**:
- ✅ Reels: 2/2 completos
- ⚠️ Reel + Pauta: 0/1 pendiente
- ✅ Stories: 3/3 completos

**Estado General**: 83% completo (5 de 6 contenidos)

**Siguiente Acción**: Agregar URL de Reel + Pauta

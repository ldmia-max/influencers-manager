# Setup de Vercel Blob Storage

## ¿Por qué Vercel Blob?

En Vercel, el filesystem es **efímero** - los archivos se borran después de cada deploy o después de cierto tiempo. Vercel Blob Storage es la solución oficial para almacenar archivos de forma persistente.

## Ventajas

✅ **Persistente**: Los archivos no se borran
✅ **CDN automático**: Servido desde edge network de Vercel
✅ **Escalable**: No hay límites de filesystem
✅ **Fácil integración**: SDK oficial de Vercel
✅ **Público o privado**: Control de acceso granular

## Instalación

```bash
npm install @vercel/blob
```

## Configuración

### 1. Crear Blob Store en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Settings → Storage
3. Click en "Create Store"
4. Selecciona "Blob"
5. Dale un nombre (ej: `influencer-manager-content`)
6. Click "Create"

### 2. Obtener Token

Vercel automáticamente crea la variable de entorno:
```
BLOB_READ_WRITE_TOKEN
```

Este token ya está disponible en tu proyecto.

### 3. Desarrollo Local

#### Opción A: Usar Vercel CLI (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Link al proyecto
vercel link

# Ejecutar en modo dev
vercel dev
```

Vercel CLI automáticamente provee el token en desarrollo.

#### Opción B: Token Manual

Copia el token desde Vercel Dashboard y agrégalo a `.env.local`:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

**⚠️ NUNCA commitees este token en Git!**

## Uso Básico

### Upload de Archivo

```typescript
import { put } from '@vercel/blob'

// Subir desde URL
const response = await fetch('https://example.com/image.jpg')
const blob = await response.blob()

const { url } = await put('campaign-content/instagram/abc123.jpg', blob, {
  access: 'public', // o 'private'
  addRandomSuffix: false,
})

console.log('Uploaded to:', url)
// https://xxx.public.blob.vercel-storage.com/campaign-content/instagram/abc123.jpg
```

### Upload desde Buffer

```typescript
import { put } from '@vercel/blob'
import fs from 'fs'

const buffer = fs.readFileSync('./image.jpg')

const { url } = await put('my-image.jpg', buffer, {
  access: 'public',
})
```

### Listar Archivos

```typescript
import { list } from '@vercel/blob'

const { blobs } = await list({
  prefix: 'campaign-content/', // Filtrar por prefijo
})

blobs.forEach(blob => {
  console.log(blob.url, blob.size, blob.uploadedAt)
})
```

### Eliminar Archivo

```typescript
import { del } from '@vercel/blob'

await del('https://xxx.blob.vercel-storage.com/file.jpg')
```

### Head (Metadata)

```typescript
import { head } from '@vercel/blob'

const metadata = await head('https://xxx.blob.vercel-storage.com/file.jpg')
console.log(metadata.size, metadata.contentType)
```

## Estructura de Carpetas

Para este proyecto, usaremos esta estructura:

```
campaign-content/
├── instagram/
│   ├── {contentId1}.jpg
│   ├── {contentId2}.jpg
│   └── ...
└── tiktok/
    ├── {contentId1}.jpg
    ├── {contentId2}.jpg
    └── ...
```

## Ejemplo de Implementación

### Upload de Cover

```typescript
// src/lib/content-uploader.ts
import { put } from '@vercel/blob'

export async function uploadCoverToBlob(
  originalUrl: string,
  contentId: string,
  platform: 'instagram' | 'tiktok'
): Promise<string> {
  // 1. Descargar imagen
  const response = await fetch(originalUrl)
  if (!response.ok) throw new Error('Failed to fetch image')

  const blob = await response.blob()

  // 2. Generar path
  const extension = getExtension(originalUrl) || 'jpg'
  const path = `campaign-content/${platform}/${contentId}.${extension}`

  // 3. Subir a Vercel Blob
  const { url } = await put(path, blob, {
    access: 'public',
    addRandomSuffix: false,
  })

  return url
}
```

### Uso en API Route

```typescript
// src/app/api/campaigns/[id]/content/route.ts
import { uploadCoverToBlob } from '@/lib/content-uploader'
import { scrapeContent } from '@/lib/scraper'

export async function POST(request: Request) {
  const { url, campaignProfilePlatformId } = await request.json()

  // 1. Hacer scraping
  const scraped = await scrapeContent(url)

  // 2. Subir cover a Blob
  let coverBlobUrl = null
  if (scraped.metadata.coverUrl) {
    coverBlobUrl = await uploadCoverToBlob(
      scraped.metadata.coverUrl,
      'temp-id', // Usar ID temporal o generar UUID
      platform
    )
  }

  // 3. Guardar en DB
  const content = await createCampaignContent({
    url,
    campaignProfilePlatformId,
    metadata: {
      ...scraped.metadata,
      coverBlobUrl, // ← Guardar URL de Vercel Blob
    }
  })

  return Response.json(content)
}
```

### Mostrar en UI

```tsx
// src/components/campaigns/content-card.tsx
import Image from 'next/image'

export function ContentCard({ content }) {
  return (
    <div className="content-card">
      <Image
        src={content.coverBlobUrl || '/placeholder.jpg'}
        alt={content.caption || 'Content cover'}
        width={400}
        height={400}
        className="rounded-lg"
      />
      <p>{content.caption}</p>
    </div>
  )
}
```

## Límites y Costos

### Planes de Vercel

| Plan | Storage | Bandwidth/mes | Precio Storage | Precio Bandwidth |
|------|---------|---------------|----------------|------------------|
| Hobby | 100GB | 1TB | Gratis | Gratis |
| Pro | 500GB | 5TB | $0.15/GB/mes | $0.30/GB |
| Enterprise | Custom | Custom | Custom | Custom |

### Ejemplo de Costos (Plan Pro)

Si tienes:
- 1000 contenidos
- Cada cover = 500KB
- Total storage = 500MB = ~$0.08/mes

Con 100K views/mes:
- Bandwidth = 50GB = ~$15/mes

**Total: ~$15/mes** para una campaña mediana.

## Optimización

### 1. Comprimir Imágenes antes de Subir

```typescript
import sharp from 'sharp'

const buffer = await sharp(originalBuffer)
  .resize(800, 800, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toBuffer()

await put('file.jpg', buffer, { access: 'public' })
```

### 2. Usar Next.js Image Optimization

```tsx
<Image
  src={coverBlobUrl}
  width={400}
  height={400}
  quality={75}
  placeholder="blur"
/>
```

Next.js automáticamente optimiza y cachea las imágenes.

### 3. Lazy Loading

```tsx
<Image
  src={coverBlobUrl}
  loading="lazy"
  {...props}
/>
```

## Limpieza de Archivos Antiguos

```typescript
// src/jobs/cleanup-blob-storage.ts
import { list, del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export async function cleanupOrphanedBlobs() {
  // 1. Obtener todos los contenidos activos
  const contents = await prisma.campaignContent.findMany({
    select: { coverBlobUrl: true }
  })

  const activeUrls = new Set(
    contents.map(c => c.coverBlobUrl).filter(Boolean)
  )

  // 2. Listar todos los blobs
  const { blobs } = await list({
    prefix: 'campaign-content/'
  })

  // 3. Eliminar blobs huérfanos
  for (const blob of blobs) {
    if (!activeUrls.has(blob.url)) {
      console.log('Deleting orphaned blob:', blob.url)
      await del(blob.url)
    }
  }
}
```

## Troubleshooting

### Error: "BLOB_READ_WRITE_TOKEN is not set"

**Solución**:
1. Verifica que creaste el Blob Store en Vercel
2. Redeploy el proyecto para que Vercel inyecte la variable
3. En local, usa `vercel dev` o agrega el token manualmente

### Error: "Access denied"

**Solución**:
- Verifica que el token tiene permisos de lectura/escritura
- Regenera el token en Vercel Dashboard si es necesario

### Imágenes no se cargan en producción

**Solución**:
- Verifica que `access: 'public'` está configurado
- Revisa que las URLs en la DB son correctas
- Verifica que Next.js Image está configurado para Vercel Blob:

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}
```

## Referencias

- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [Vercel Blob SDK](https://github.com/vercel/storage/tree/main/packages/blob)
- [Pricing](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing)

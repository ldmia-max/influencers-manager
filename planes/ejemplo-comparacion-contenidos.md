# Ejemplo: Comparación de Contenidos Individuales

## UI de Comparación

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Analytics de Campaña                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Global] [Por Perfil] [Por Formato] [Comparar] ◄─ Active     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Comparar Períodos] [Comparar Contenidos] ◄─ Sub-tabs        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Tab: Comparar Contenidos                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔍 Buscar Contenido                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ [Plataforma ▼] [Perfil ▼] [Formato ▼] [Buscar...]        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📋 Contenidos Seleccionados (3/10)                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │ │ 📱 Instagram │  │ 📱 TikTok    │  │ 📱 Instagram │    │ │
│  │ │ @maria       │  │ @juan        │  │ @ana         │    │ │
│  │ │ Reel         │  │ Video        │  │ Reel         │    │ │
│  │ │ [Cover img]  │  │ [Cover img]  │  │ [Cover img]  │    │ │
│  │ │ 45K likes    │  │ 68K likes    │  │ 52K likes    │    │ │
│  │ │ ER: 5.2%     │  │ ER: 4.8%     │  │ ER: 5.0%     │    │ │
│  │ │      [✕]     │  │      [✕]     │  │      [✕]     │    │ │
│  │ └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │                                                           │ │
│  │ [+ Agregar Contenido]                       [Comparar]   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📊 Comparación de Métricas                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Métrica       @maria     @juan      @ana      Mejor     │ │
│  │  ────────────────────────────────────────────────────────│ │
│  │  👍 Likes      45,000     68,000    52,000    @juan  🏆 │ │
│  │  💬 Comments    2,800      4,100     3,200    @juan  🏆 │ │
│  │  👁️ Views     120,000    180,000   135,000   @juan  🏆 │ │
│  │  📈 ER%          5.2%       4.8%      5.0%    @maria 🏆 │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📈 Evolución Temporal                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │     │                                   ╱── @juan        │ │
│  │  70K│                              ╱───╯                 │ │
│  │     │                         ╱───╯                      │ │
│  │  50K│                    ╱───╯─── @ana                  │ │
│  │     │               ╱───╯                                │ │
│  │  30K│          ╱───╯─── @maria                          │ │
│  │     │     ╱───╯                                          │ │
│  │  10K│╱───╯                                               │ │
│  │     └─────────────────────────────────────────────────  │ │
│  │     Día 1    Día 3    Día 5    Día 7    Día 9          │ │
│  │                                                           │ │
│  │  [Likes ✓] [Comments ✓] [Views] [ER %]                 │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  💡 Insights                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ • @juan tiene +51% más likes que @maria                  │ │
│  │ • @maria tiene el mejor engagement rate (+0.4%)          │ │
│  │ • Reels de Instagram tienen mejor ER que TikTok          │ │
│  │ • @ana tiene el crecimiento más constante                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Exportar CSV] [Exportar PNG] [Generar Reporte]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Flujo de Usuario

### 1. Seleccionar Contenidos para Comparar

```typescript
// Usuario hace click en "+ Agregar Contenido"
// Se abre un modal/drawer con búsqueda

┌─────────────────────────────────────────────┐
│  🔍 Buscar Contenido para Comparar          │
├─────────────────────────────────────────────┤
│                                             │
│  Filtros:                                   │
│  [Instagram ▼] [Todos los perfiles ▼]      │
│  [Reel ▼] [Buscar en descripción...]       │
│                                             │
│  Resultados:                                │
│  ┌─────────────────────────────────────┐   │
│  │ □ [📷] @maria_garcia                │   │
│  │   Instagram Reel                    │   │
│  │   "Nueva colección primavera..."    │   │
│  │   45K likes • 2.8K comments         │   │
│  │   🕐 Hace 3 días                    │   │
│  ├─────────────────────────────────────┤   │
│  │ □ [📷] @juan_lopez                  │   │
│  │   TikTok Video                      │   │
│  │   "Tutorial de maquillaje..."       │   │
│  │   68K likes • 4.1K comments         │   │
│  │   🕐 Hace 5 días                    │   │
│  ├─────────────────────────────────────┤   │
│  │ □ [📷] @ana_martinez                │   │
│  │   Instagram Reel                    │   │
│  │   "Outfit del día casual..."        │   │
│  │   52K likes • 3.2K comments         │   │
│  │   🕐 Hace 2 días                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Cancelar]              [Agregar (0)]      │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. Comparar Resultados

Una vez seleccionados, el usuario puede:
- ✅ Ver métricas lado a lado en tabla
- ✅ Ver gráficos de evolución temporal superpuestos
- ✅ Identificar el mejor performer por métrica
- ✅ Ver insights automáticos
- ✅ Exportar la comparación

## Casos de Uso

### Caso 1: Comparar Mismo Formato Diferentes Perfiles

**Pregunta**: ¿Qué influencer tiene mejor rendimiento en Reels?

**Selección**:
- @maria - Instagram Reel
- @juan - Instagram Reel
- @ana - Instagram Reel

**Resultado**:
```
Mejor Engagement: @maria (5.2%)
Más Likes: @juan (68K)
Más Vistas: @juan (180K)
Recomendación: @juan para alcance, @maria para engagement
```

### Caso 2: Comparar Plataformas

**Pregunta**: ¿Instagram Reel o TikTok funciona mejor?

**Selección**:
- @maria - Instagram Reel
- @maria - TikTok Video

**Resultado**:
```
Instagram Reel: 45K likes, 5.2% ER
TikTok Video: 38K likes, 4.1% ER
Ganador: Instagram Reel (+28% likes, +1.1% ER)
```

### Caso 3: Comparar Formatos

**Pregunta**: ¿Reel o Story genera más engagement?

**Selección**:
- @maria - Instagram Reel
- @maria - Instagram Story

**Resultado**:
```
Reel: 45K likes, 5.2% ER
Story: 12K views, 3.8% ER
Ganador: Reel (+1.4% ER más efectivo)
```

### Caso 4: Comparar Evolución Temporal

**Pregunta**: ¿Qué contenido tiene mejor crecimiento?

**Selección**:
- Reel A - Publicado hace 7 días
- Reel B - Publicado hace 7 días
- Reel C - Publicado hace 7 días

**Visualización**:
- Gráfico de líneas mostrando crecimiento día a día
- Identificar cuál tiene crecimiento más sostenido
- Detectar picos y caídas

## API Calls

### 1. Buscar Contenidos

```typescript
GET /api/campaigns/123/analytics/search-contents?platform=INSTAGRAM&profileId=abc

Response:
{
  contents: [
    {
      id: "content-1",
      caption: "Nueva colección...",
      platform: "Instagram",
      profileName: "@maria_garcia",
      serviceType: "Reel",
      latestMetrics: { likes: 45000, comments: 2800 }
    },
    // ...más contenidos
  ]
}
```

### 2. Comparar Contenidos Seleccionados

```typescript
POST /api/campaigns/123/analytics/compare-contents
{
  contentIds: ["content-1", "content-2", "content-3"]
}

Response:
{
  contents: [
    {
      id: "content-1",
      profileName: "@maria_garcia",
      serviceType: "Reel",
      currentMetrics: { likes: 45000, engagementRate: 5.2 },
      timeSeries: [...],
      stats: { avgEngagementRate: 5.1, peakLikes: 48000 }
    },
    // ...más contenidos
  ],
  comparisons: [
    {
      content1Id: "content-1",
      content2Id: "content-2",
      content1Name: "@maria - Reel",
      content2Name: "@juan - Video",
      diff: { likes: -23000, engagementRate: 0.4 },
      percentDiff: { likes: -51, engagementRate: 8.3 }
    }
  ]
}
```

## Limitaciones y Validaciones

- **Máximo 10 contenidos** en una comparación (por rendimiento)
- **Mínimo 2 contenidos** para comparar
- Solo contenido con métricas disponibles
- Advertencia si los contenidos tienen fechas de publicación muy diferentes

## Features Avanzadas (Futuro)

1. **Guardar Comparaciones**: Poder guardar sets de comparación frecuentes
2. **Comparaciones Predefinidas**:
   - "Mejor Reel del mes"
   - "Instagram vs TikTok"
   - "Top 5 contenidos"
3. **Recomendaciones AI**: Sugerir qué contenidos comparar basado en similitudes
4. **Alertas**: Notificar cuando un contenido supera a otro

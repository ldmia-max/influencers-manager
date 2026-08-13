# Validación de Alcance vs Vistas Reales

## Concepto

Cada cuenta tiene un **alcance esperado** basado en su número de seguidores. Esta validación compara las vistas reales del contenido contra el alcance esperado y muestra un indicador visual.

## Cálculo del Alcance Esperado

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

### Ejemplos

| Seguidores | Tier | % Alcance | Alcance Esperado |
|------------|------|-----------|------------------|
| 50,000 | Micro | 35% | 17,500 vistas |
| 150,000 | Mid | 30% | 45,000 vistas |
| 750,000 | Macro | 25% | 187,500 vistas |
| 2,000,000 | Mega | 20% | 400,000 vistas |

## Evaluación de Performance

```typescript
const fulfillmentPercentage = (actualViews / expectedReach) * 100

// Rangos:
// ✅ >= 120% → Excelente (Verde)
// ✅ >= 100% → Bueno (Verde)
// ⚠️ >= 80%  → Advertencia (Amarillo)
// ❌ < 80%   → Pobre (Rojo)
```

## UI Examples

### 1. Content Card con Indicador

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

### 2. Content Card - No Cumple

```
┌────────────────────────────────────────┐
│ [Cover Image]                   TikTok │
│                                         │
│ @juan_lopez                             │
│ Video                                   │
│                                         │
│ ❤️ 38K  💬 1.9K  👁️ 45K               │
│                                         │
│ ┌─────────────────────────────────────┐│
││ ❌ Por debajo del alcance esperado  ││
││                                  68% ││
││ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ││
││ ████████████████░░░░░░░░░░░░   68%  ││
││                                     ││
││ 45K de 66K vistas esperadas         ││
│└─────────────────────────────────────┘│
│                                         │
│ 📈 Engagement: 4.1%                    │
└────────────────────────────────────────┘
```

### 3. Tabla de Contenidos

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

### 4. Dashboard de Campaña

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

## Componentes

### ReachPerformanceIndicator

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
    {color === 'green' ? '✅' : '❌'} {fulfillmentPercentage}%
  </Badge>
</ReachPerformanceIndicator>

// Variante Full (para cards)
<ReachPerformanceIndicator variant="full">
  <div className="reach-indicator">
    <div className="header">
      <span>{message}</span>
      <Badge>{fulfillmentPercentage}%</Badge>
    </div>
    <ProgressBar value={fulfillmentPercentage} color={color} />
    <p className="details">
      {actualViews.toLocaleString()} de {expectedReach.toLocaleString()} vistas
    </p>
  </div>
</ReachPerformanceIndicator>

// Variante Badge (solo icono y %)
<ReachPerformanceIndicator variant="badge">
  {color === 'green' ? '✅' : '❌'} {fulfillmentPercentage}%
</ReachPerformanceIndicator>
```

## Casos de Uso

### 1. Identificar Contenidos de Bajo Rendimiento

**Pregunta**: ¿Qué contenidos necesitan boost/pauta?

**Respuesta**:
```
Contenidos con ❌ por debajo del 80%:
- @juan_lopez - Video TikTok (68%)
- @ana_martinez - Reel Instagram (75%)

Recomendación: Considerar pauta para mejorar alcance
```

### 2. Validar ROI de Influencers

**Pregunta**: ¿Qué influencers están dando buenos resultados?

**Respuesta**:
```
Top Performers (promedio de alcance):
1. @maria_garcia: 118% (3 de 3 contenidos ✅)
2. @carlos_ruiz: 105% (2 de 2 contenidos ✅)
3. @ana_martinez: 92% (1 ✅, 1 ⚠️)
4. @juan_lopez: 75% (1 ⚠️, 1 ❌)
```

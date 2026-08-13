# Plan: Adopción de Zustand para gestión de estado global

## Objetivo

Reemplazar o simplificar los Context providers más pesados del proyecto con stores de Zustand, reduciendo boilerplate, mejorando la DevX y centralizando el estado global del cliente en stores predecibles y testeables.

---

## Estado actual del cliente (diagnóstico)

El proyecto tiene **3 capas de estado cliente** que conviven:

| Capa | Herramienta | Usos actuales |
|---|---|---|
| Estado de servidor | TanStack Query | Perfiles, campañas, clientes, catálogos |
| Estado local de UI | `useState` / `useReducer` | Formularios, popovers, modales |
| Estado global cliente | React Context | Carrito, Chat, Wizard de campaña (4 contexts) |

**Problema:** Los 4 Context providers del wizard de campaña (`CampaignFormContext`, `CampaignProfilesContext`, `CampaignUIContext`, `CampaignBudgetContext`) se renderizan juntos y obligan a rerenderizar árbol completo ante cualquier cambio. El carrito y el chat tienen lógica de persistencia en `localStorage` duplicada manualmente.

---

## Regla de adopción

```
TanStack Query  → estado servidor (peticiones API, caché remota)   ← no cambia
Zustand         → estado global cliente (persistente o cross-page)
useState        → estado local efímero de componente               ← no cambia
```

---

## Secciones donde aplicar Zustand

### 1. Carrito de perfiles (`CartContext`) ★★★ Alta prioridad

**Estado actual:** `src/contexts/cart-context.tsx` — 1 Context + `useState` x4 + localStorage manual.

**Problema:** Lógica de hidratación, versionado y persistencia escrita a mano con `useEffect`. Cualquier componente que consuma el carrito rerenderiza aunque no cambie su slice.

**Con Zustand:**

```typescript
// src/stores/cart-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartStore {
  items: CartItem[];
  isCartOpen: boolean;
  isServiceModalOpen: boolean;
  selectedProfile: ProfileWithServices | null;
  // Acciones
  addToCart: (profile, platforms) => void;
  removeFromCart: (profileId) => void;
  updateCartItem: (profileId, platforms) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  // Computed (selectores)
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({ ... }),
    { name: "influencer-cart", version: 1 }   // replace manual localStorage
  )
);
```

**Ganancia:**
- Elimina hidratación manual con `useEffect`
- `persist` middleware maneja versionado y serialización
- Selectores granulares evitan rerenders innecesarios

---

### 2. Wizard de campaña (4 Contexts) ★★★ Alta prioridad

**Estado actual:** 4 Context providers anidados en `src/contexts/`:
- `CampaignFormContext` — datos del formulario
- `CampaignProfilesContext` — perfiles seleccionados + configuración
- `CampaignUIContext` — loading, error, step actual
- `CampaignBudgetContext` — presupuesto y cálculos

**Problema:** 4 providers anidados + prop-drilling entre contextos + rerenders cruzados. `CampaignEditor` tiene 12 useState propios además de consumir los 4 contexts.

**Con Zustand — 1 store unificado:**

```typescript
// src/stores/campaign-wizard-store.ts
interface CampaignWizardStore {
  // Slice: Form
  campaignId: string | undefined;
  formData: CampaignData;
  setFormData: (data: Partial<CampaignData>) => void;

  // Slice: Profiles
  selectedProfileIds: string[];
  profileConfigs: ProfileConfig[];
  toggleProfile: (id: string) => void;
  updateServiceQuantity: (profileId, platformId, serviceId, qty) => void;

  // Slice: UI
  currentStep: WizardStep;
  loading: boolean;
  error: string | null;
  success: string | null;
  goToStep: (step: WizardStep) => void;

  // Slice: Budget (computed)
  getBudget: () => number;
  getTotalServicesPrice: () => number;
  isOverBudget: () => boolean;

  // Reset completo al salir del wizard
  reset: () => void;
}

export const useCampaignWizard = create<CampaignWizardStore>()((set, get) => ({
  ...
}));
```

**Ganancia:**
- De 4 providers + `campaign-editor` con 12 useState → 1 store
- Selectores atómicos: `useCampaignWizard(s => s.currentStep)` solo rerenderiza si cambia el step
- `reset()` centralizado al montar/desmontar el wizard
- Sin el provider wrapper en el árbol de componentes

---

### 3. Chat de IA (`ChatContext`) ★★ Media prioridad

**Estado actual:** `src/components/chat/chat-provider.tsx` — Context + localStorage manual + TanStack Query mutation.

**Problema:** Los mensajes y el estado de la campaña en progreso se persisten en localStorage con `useEffect` ad-hoc. Cualquier componente que use `useChat()` se suscribe a todo el estado del chat.

**Con Zustand:**

```typescript
// src/stores/chat-store.ts
interface ChatStore {
  isOpen: boolean;
  messages: ChatMessage[];
  campaignState: CampaignState;
  error: string | null;
  // Acciones
  addMessage: (message: ChatMessage) => void;
  updateCampaignState: (state: Partial<CampaignState>) => void;
  clearChat: () => void;
  open: () => void;
  close: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({ ... }),
    { name: "campaign-chat" }   // reemplaza localStorage manual
  )
);
```

**Nota:** La mutación HTTP (`sendChatMessage`) se mantiene en TanStack Query. El store solo gestiona el historial de mensajes y el estado de la campaña en edición.

---

### 4. Filtros de perfiles (useProfileFilters hook) ★ Baja prioridad

**Estado actual:** `src/hooks/use-profile-filters.ts` — 8 `useState` + `useMemo` para filtros client-side del selector de perfiles en el wizard.

**Con Zustand (opcional):**

```typescript
// Integrado en campaign-wizard-store como slice de filtros
filters: {
  search: string,
  type: ProfileType | null,
  selectedPlatforms: string[],
  selectedCategories: string[],
  ...
},
setFilter: (key, value) => void,
clearFilters: () => void,
```

**Alternativa:** Mantenerlo como `useReducer` si los filtros son solo locales al paso 2 del wizard. Moverlo al store solo si los filtros necesitan persistir entre pasos o navegaciones.

---

## Lo que NO se mueve a Zustand

| Estado actual | Razón para dejarlo igual |
|---|---|
| TanStack Query (perfiles, campañas, clientes) | Es estado servidor — TQ es la herramienta correcta |
| `useState` en formularios (profile-form, campaign-form) | Estado efímero local — no beneficia de global store |
| `useReducer` en profile-filters (URL-driven) | Controlado por URL searchParams, no es estado global |
| `useState` de popovers y modales simples | Muy local, no tiene sentido globalizarlo |
| `ReachRangesContext` | Solo referencia estática, podría vivir en TQ |

---

## Estructura de archivos propuesta

```
src/stores/
├── cart-store.ts          ← Reemplaza CartContext
├── campaign-wizard-store.ts ← Reemplaza 4 CampaignContexts
├── chat-store.ts          ← Reemplaza ChatContext
└── index.ts               ← Barrel export
```

---

## Instalación

```bash
npm install zustand
```

Zustand no requiere Provider en la raíz. El store es un módulo singleton.

---

## Comparación de API

### Leer estado (antes vs después)

```typescript
// ANTES — Context
const { items, totalPrice } = useCart();

// DESPUÉS — Zustand (solo rerenderiza si items cambia)
const items = useCartStore(s => s.items);
const totalPrice = useCartStore(s => s.getTotalPrice());
```

### Actualizar estado

```typescript
// ANTES — Context con dispatch o setter
const { addToCart } = useCart();
addToCart(profile, platforms);

// DESPUÉS — Zustand
useCartStore.getState().addToCart(profile, platforms);
// o dentro de componente:
const addToCart = useCartStore(s => s.addToCart);
```

### Persistencia (antes vs después)

```typescript
// ANTES — useEffect manual
useEffect(() => {
  if (isHydrated) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }
}, [items, isHydrated]);

// DESPUÉS — Zustand persist middleware
create()(persist((set) => ({ ... }), { name: "influencer-cart", version: 1 }))
```

---

## Orden de ejecución

### Fase 1 — Carrito (impacto más visible, más autónomo)
1. Instalar `zustand`
2. Crear `src/stores/cart-store.ts` con `persist` middleware
3. Reemplazar `CartContext` en los componentes que lo consumen
4. Eliminar `src/contexts/cart-context.tsx`
5. Verificar persistencia en localStorage y comportamiento de modales

### Fase 2 — Wizard de campaña (mayor reducción de complejidad)
6. Crear `src/stores/campaign-wizard-store.ts` con los 4 slices
7. Migrar `CampaignFormContext` → slice form del store
8. Migrar `CampaignProfilesContext` → slice profiles del store
9. Migrar `CampaignUIContext` → slice UI del store
10. Migrar `CampaignBudgetContext` → selectores computed del store
11. Simplificar `campaign-editor.tsx` eliminando useState redundantes
12. Eliminar los 4 archivos de context del wizard
13. Verificar que el wizard sigue funcionando (crear, editar, pasos)

### Fase 3 — Chat
14. Crear `src/stores/chat-store.ts` con `persist` middleware
15. Refactorizar `chat-provider.tsx`: mantener solo la mutación TQ, delegar estado al store
16. Verificar historial persistente entre sesiones

### Fase 4 — Cleanup
17. Limpiar `src/contexts/index.ts` (solo quedaría `ReachRangesContext` o moverlo a TQ)
18. Actualizar `src/providers/` si algún provider wrapeaba los contexts eliminados
19. `npm run build` — verificar sin errores TypeScript

---

## Criterios de verificación por fase

| Fase | Verificación |
|---|---|
| Carrito | Agregar perfil → recargar página → perfil sigue en el carrito |
| Wizard | Crear campaña completa (3 pasos) → campaña guardada correctamente |
| Chat | Enviar mensaje → cerrar chat → reabrir → historial persiste |
| Build | `npm run build` sin errores |

---

## Impacto esperado

| Métrica | Antes | Después |
|---|---|---|
| Providers en el árbol | 6+ (Cart, Chat, 4 Campaign) | 0 (Zustand no necesita provider) |
| Archivos de context | 6 archivos | 0 (eliminados) |
| Archivos de store | 0 | 3 archivos |
| localStorage manual | 2 `useEffect` de persistencia | 0 (persist middleware) |
| useState en CampaignEditor | 12 | ~3 (solo UI local residual) |

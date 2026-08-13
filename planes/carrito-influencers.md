# Plan: Sistema de Carrito de Influencers

## Resumen

Implementar un sistema tipo "carrito de compras" en la sección de perfiles que permita:
1. Agregar influencers al carrito desde la lista de perfiles
2. Seleccionar servicios específicos de cada influencer
3. Ver el carrito con todos los influencers y servicios seleccionados
4. Crear una campaña directamente desde el carrito con los datos pre-cargados

---

## Arquitectura Propuesta

### Nuevo Contexto Global: `CartContext`

```typescript
// src/contexts/cart-context.tsx

interface CartItem {
  profile: ProfileWithServices;
  platforms: {
    socialAccountId: string;
    platformId: string;
    platformName: string;
    username: string;
    services: {
      profileServiceId: string;
      serviceTypeId: string;
      serviceName: string;
      quantity: number;
      basePrice: number;
    }[];
  }[];
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;

  // Acciones
  addToCart: (profile: ProfileWithServices) => void;
  removeFromCart: (profileId: string) => void;
  updateServices: (profileId: string, platforms: CartItem['platforms']) => void;
  clearCart: () => void;

  // UI
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  isServiceModalOpen: boolean;
  selectedProfile: ProfileWithServices | null;
  openServiceModal: (profile: ProfileWithServices) => void;
  closeServiceModal: () => void;
}
```

### Persistencia con LocalStorage

```typescript
// Guardar carrito en localStorage para persistencia entre sesiones
useEffect(() => {
  localStorage.setItem('influencer-cart', JSON.stringify(items));
}, [items]);

// Recuperar al iniciar
const [items, setItems] = useState<CartItem[]>(() => {
  const saved = localStorage.getItem('influencer-cart');
  return saved ? JSON.parse(saved) : [];
});
```

---

## Componentes Nuevos

### 1. `CartProvider` - Contexto Global
**Ubicación:** `src/contexts/cart-context.tsx`

- Maneja el estado global del carrito
- Persistencia en localStorage
- Cálculos de totales (items, precio con markup 20%)

### 2. `CartButton` - Botón Flotante del Carrito
**Ubicación:** `src/components/cart/cart-button.tsx`

```
┌─────────────────────────────┐
│  🛒  3  │  (badge con cantidad)
└─────────────────────────────┘
```

- Botón flotante en la esquina inferior derecha
- Muestra cantidad de items en el carrito
- Click abre el panel lateral del carrito
- Animación de "bounce" cuando se agrega un item

### 3. `CartPanel` - Panel Lateral del Carrito
**Ubicación:** `src/components/cart/cart-panel.tsx`

```
┌────────────────────────────────────────┐
│  Carrito (3 influencers)         [X]   │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 👤 María García           [🗑️]  │  │
│  │    Instagram: @mariag            │  │
│  │    • Story x2        $120.000    │  │
│  │    • Reel x1         $180.000    │  │
│  │    TikTok: @mariag_tt            │  │
│  │    • Video x1        $150.000    │  │
│  │                      ──────────  │  │
│  │    Subtotal:         $450.000    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 👤 Juan Pérez            [🗑️]   │  │
│  │    Instagram: @juanp             │  │
│  │    • Post x3         $90.000     │  │
│  └──────────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│  Total (con markup):    $540.000       │
│                                        │
│  ┌────────────────────────────────┐    │
│  │     🚀 Crear Campaña           │    │
│  └────────────────────────────────┘    │
│                                        │
│  [Vaciar carrito]                      │
└────────────────────────────────────────┘
```

- Panel deslizable desde la derecha (Sheet de shadcn)
- Lista de influencers con sus servicios seleccionados
- Botón para eliminar cada influencer
- Total calculado con markup 20%
- Botón "Crear Campaña" que redirige al wizard

### 4. `AddToCartButton` - Botón en Cards de Perfiles
**Ubicación:** `src/components/cart/add-to-cart-button.tsx`

```
┌─────────────┐
│  🛒 Agregar │  (si no está en carrito)
└─────────────┘

┌─────────────┐
│  ✓ En carrito │  (si ya está)
└─────────────┘
```

- Se integra en cada card de perfil en `/profiles`
- Cambia estado visual si el perfil ya está en el carrito
- Click abre modal de selección de servicios

### 5. `ServiceSelectionModal` - Modal de Servicios
**Ubicación:** `src/components/cart/service-selection-modal.tsx`

```
┌────────────────────────────────────────────────┐
│  Seleccionar Servicios                    [X]  │
│                                                │
│  👤 María García                               │
│     Influencer · Bogotá, Colombia              │
│                                                │
├────────────────────────────────────────────────┤
│                                                │
│  📸 Instagram (@mariag)                        │
│     70.5K seguidores · 28.2K alcance (40%)     │
│  ┌──────────────────────────────────────────┐  │
│  │ ☐ Story           $50.000    [─] 0 [+]   │  │
│  │ ☐ Reel            $150.000   [─] 0 [+]   │  │
│  │ ☐ Post            $80.000    [─] 0 [+]   │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  🎵 TikTok (@mariag_tt)                        │
│     120K seguidores · 48K alcance (40%)        │
│  ┌──────────────────────────────────────────┐  │
│  │ ☐ Video           $120.000   [─] 0 [+]   │  │
│  │ ☐ Dueto           $100.000   [─] 0 [+]   │  │
│  └──────────────────────────────────────────┘  │
│                                                │
├────────────────────────────────────────────────┤
│  Subtotal: $0                                  │
│                                                │
│  ┌────────────────────────────────────────┐    │
│  │         Agregar al Carrito             │    │
│  └────────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

- Modal con información del perfil
- Lista de plataformas con sus servicios
- Controles +/- para cantidad de cada servicio
- Precio individual y subtotal en tiempo real
- Botón "Agregar al Carrito" (disabled si no hay servicios)

---

## Integración con Sistema Existente

### Modificar `AuthenticatedLayout`
Agregar el CartProvider y los componentes globales:

```tsx
// src/components/layout/authenticated-layout.tsx

<CartProvider>
  <div className="...">
    <Sidebar />
    <main>{children}</main>

    {/* Nuevos componentes */}
    <CartButton />
    <CartPanel />
    <ServiceSelectionModal />
  </div>
</CartProvider>
```

### Modificar Página de Perfiles
Agregar botón de carrito a cada card:

```tsx
// src/app/(dashboard)/profiles/page.tsx

// En cada Card de perfil, agregar:
<AddToCartButton profile={profile} />
```

### Crear Ruta de Campaña desde Carrito
Nueva ruta que inicializa el wizard con datos del carrito:

```tsx
// src/app/(dashboard)/campaigns/new/from-cart/page.tsx

// 1. Lee el carrito del contexto
// 2. Pre-llena selectedProfileIds y profileConfigs
// 3. Inicia en Paso 1 (solo datos básicos)
// 4. Al guardar, limpia el carrito
```

---

## Flujo de Usuario

```
1. Usuario navega a /profiles
   ↓
2. Ve lista de perfiles con botón "🛒 Agregar" en cada uno
   ↓
3. Click en "Agregar" → Abre modal de servicios
   ↓
4. Selecciona servicios y cantidades
   ↓
5. Click "Agregar al Carrito" → Se agrega y cierra modal
   ↓
6. Repite para más perfiles (badge del carrito se actualiza)
   ↓
7. Click en botón flotante del carrito → Abre panel lateral
   ↓
8. Revisa selección, puede eliminar perfiles
   ↓
9. Click "Crear Campaña" → Redirige a /campaigns/new/from-cart
   ↓
10. Wizard abre en Paso 1 (datos básicos)
    - Perfiles ya seleccionados (visible en resumen)
    - Servicios ya configurados
   ↓
11. Usuario completa: nombre, cliente, contacto, presupuesto, fechas
   ↓
12. Click "Siguiente" → Paso 2 (ya tiene perfiles, puede modificar)
   ↓
13. Click "Siguiente" → Paso 3 (resumen)
   ↓
14. Guarda campaña → Carrito se limpia automáticamente
```

---

## Tareas de Implementación

### Fase 1: Contexto y Persistencia
- [ ] Crear `CartContext` con estado y acciones
- [ ] Implementar persistencia en localStorage
- [ ] Crear hook `useCart()` para acceder al contexto
- [ ] Agregar tipos en `src/models/cart.ts`

### Fase 2: Componentes del Carrito
- [ ] Crear `CartButton` (botón flotante)
- [ ] Crear `CartPanel` (panel lateral con Sheet)
- [ ] Crear `CartItem` (card de cada influencer en el panel)
- [ ] Implementar cálculos de totales con markup

### Fase 3: Selección de Servicios
- [ ] Crear `AddToCartButton` para cards de perfiles
- [ ] Crear `ServiceSelectionModal` con Dialog
- [ ] Implementar controles de cantidad (+/-)
- [ ] Calcular subtotales en tiempo real

### Fase 4: Integración
- [ ] Agregar `CartProvider` al layout
- [ ] Modificar página de perfiles para incluir botones
- [ ] Crear ruta `/campaigns/new/from-cart`
- [ ] Modificar `CampaignEditor` para aceptar datos iniciales del carrito

### Fase 5: UX y Polish
- [ ] Animaciones de agregar al carrito
- [ ] Notificaciones toast al agregar/eliminar
- [ ] Estado visual de "en carrito" en las cards
- [ ] Confirmación antes de vaciar carrito
- [ ] Responsive design para móviles

---

## Estructura de Archivos

```
src/
├── contexts/
│   ├── index.ts                    # Agregar export de cart
│   └── cart-context.tsx            # NUEVO
│
├── models/
│   └── cart.ts                     # NUEVO - tipos del carrito
│
├── components/
│   └── cart/                       # NUEVA CARPETA
│       ├── cart-button.tsx
│       ├── cart-panel.tsx
│       ├── cart-item.tsx
│       ├── add-to-cart-button.tsx
│       └── service-selection-modal.tsx
│
├── app/(dashboard)/
│   ├── profiles/
│   │   └── page.tsx                # MODIFICAR - agregar botones
│   └── campaigns/
│       └── new/
│           └── from-cart/
│               └── page.tsx        # NUEVO - crear desde carrito
│
└── components/layout/
    └── authenticated-layout.tsx    # MODIFICAR - agregar provider
```

---

## Consideraciones Técnicas

### Performance
- Usar `useMemo` para cálculos de totales
- Debounce en cambios de cantidad
- Lazy loading del modal de servicios

### Sincronización
- Si un perfil se elimina de la BD, limpiarlo del carrito
- Actualizar precios si cambian (opcional: notificar al usuario)

### Límites
- Máximo 20 perfiles en el carrito (configurable)
- Máximo 10 de cada servicio por perfil

### Accesibilidad
- Navegación por teclado en el modal
- Labels descriptivos en botones
- Anuncios de screen reader al agregar/eliminar

---

## Mockups de Referencia

### Card de Perfil con Botón de Carrito

```
┌─────────────────────────────────────────────┐
│  ┌─────┐                                    │
│  │     │  María García                      │
│  │ 👤  │  Influencer · Bogotá               │
│  └─────┘                                    │
│                                             │
│  📸 @mariag · 70.5K    🎵 @mariag_tt · 120K │
│                                             │
│  [Moda] [Lifestyle] [Viajes]                │
│                                             │
│  ┌─────────────┐  ┌───┐                     │
│  │ 🛒 Agregar  │  │ ⋮ │                     │
│  └─────────────┘  └───┘                     │
└─────────────────────────────────────────────┘
```

### Vista con Carrito Abierto

```
┌──────────────────────────────────────────────────────────────────┐
│  Header                                                          │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                       ┌──────────────┐│
│          │  Perfiles                             │   Carrito    ││
│          │                                       │              ││
│ Sidebar  │  [Filtros...]                         │ 👤 María     ││
│          │                                       │   • Story x2 ││
│          │  ┌────┐ ┌────┐ ┌────┐ ┌────┐         │   • Reel x1  ││
│          │  │Card│ │Card│ │Card│ │Card│         │              ││
│          │  └────┘ └────┘ └────┘ └────┘         │ 👤 Juan      ││
│          │                                       │   • Post x3  ││
│          │  ┌────┐ ┌────┐ ┌────┐ ┌────┐         │              ││
│          │  │Card│ │Card│ │Card│ │Card│         │ Total: $540K ││
│          │  └────┘ └────┘ └────┘ └────┘         │              ││
│          │                                       │[Crear Camp.] ││
│          │                               ┌───┐   └──────────────┘│
│          │                               │🛒3│                   │
│          │                               └───┘                   │
└──────────┴───────────────────────────────────────────────────────┘
```

---

## Próximos Pasos

1. **Revisar y aprobar** este plan
2. **Implementar Fase 1** - Contexto del carrito
3. **Implementar Fase 2** - Componentes visuales
4. **Testing** con datos reales
5. **Ajustes de UX** según feedback

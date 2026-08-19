> **OBSOLETO — funcionalidad eliminada (2026-08-19).**
> El chat de campañas se retiró: las campañas se crean a mano. El código
> vivía en `src/lib/ai.ts`, `src/app/api/chat/campaign/` y
> `src/components/chat/`, y sigue disponible en el historial de git.
> La única IA que queda en la aplicación es la búsqueda de prospectos
> (`/busqueda-ia`). Este documento se conserva como registro de lo que se
> intentó, no describe el estado actual.

# Plan: Chat Conversacional para Crear Campañas con AI

## Resumen
Crear un módulo de chat con inteligencia artificial (Anthropic Claude) que permita crear campañas de forma conversacional. El chat se activa mediante un **botón flotante** en la esquina inferior derecha. El usuario podrá escribir en lenguaje natural y el sistema extraerá la información, aplicará filtros y creará la campaña automáticamente.

## Decisiones del Usuario
- **Tipo de chat**: Con AI - Lenguaje natural
- **Selección de perfiles**: Ambas opciones (automático y manual)
- **Proveedor AI**: Anthropic (Claude)
- **UI**: Botón flotante que abre panel de chat
- **Futuro**: Integración con WhatsApp

---

## Arquitectura

### UI - Botón Flotante + Panel de Chat
```
┌─────────────────────────────────────────────────┐
│                   Dashboard                      │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │         Contenido de la página          │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│                              ┌────────────────┐  │
│                              │  Panel Chat    │  │
│                              │  (expandido)   │  │
│                              │                │  │
│                              │  [mensajes]    │  │
│                              │                │  │
│                              │  [input]       │  │
│                              └────────────────┘  │
│                                        ┌────┐   │
│                                        │ 💬 │   │ ← Botón flotante
│                                        └────┘   │
└─────────────────────────────────────────────────┘
```

### Estados del Botón
- **Cerrado**: Muestra ícono de chat (💬)
- **Abierto**: Panel expandido con historial y input
- **Con notificación**: Badge cuando hay respuesta nueva

### Flujo del Chat
```
Usuario hace click en botón flotante
       ↓
Se abre panel de chat (slide-in desde abajo/derecha)
       ↓
Usuario escribe mensaje
       ↓
API Route recibe mensaje + historial
       ↓
Claude analiza y extrae información
       ↓
Sistema ejecuta acciones (buscar clientes, filtrar perfiles, etc.)
       ↓
Claude genera respuesta con datos
       ↓
UI muestra respuesta + componentes interactivos
```

### Estructura de Datos del Chat
```typescript
interface ChatState {
  isOpen: boolean
  messages: ChatMessage[]
  campaignData: {
    name?: string
    clientId?: string
    clientContactId?: string
    budget?: number
    description?: string
    startDate?: string
    endDate?: string
  }
  filters: {
    city?: string
    country?: string
    minFollowers?: number
    maxFollowers?: number
    platforms?: string[]
    services?: string[]
    categories?: string[]
  }
  selectedProfiles: ProfileConfig[]
  status: 'idle' | 'collecting' | 'reviewing' | 'confirmed' | 'created'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    profiles?: Profile[]      // Perfiles encontrados/seleccionados
    campaign?: Campaign       // Campaña creada
    action?: string           // Acción ejecutada
  }
}
```

---

## Archivos a Crear

### 1. API Route del Chat
**Archivo**: `src/app/api/chat/campaign/route.ts`
- Recibe mensajes del usuario
- Usa Anthropic SDK para procesar
- Tools/Functions para:
  - `search_clients` - Buscar clientes por nombre
  - `search_profiles` - Filtrar perfiles
  - `select_profiles` - Seleccionar automáticamente
  - `create_campaign` - Crear la campaña final
- Retorna respuesta streaming

### 2. Servicio de AI
**Archivo**: `src/lib/ai.ts`
- Configuración del cliente Anthropic
- System prompt con contexto del negocio
- Definición de tools disponibles

### 3. Componente Botón Flotante
**Archivo**: `src/components/chat/chat-floating-button.tsx`
- Botón circular fijo en esquina inferior derecha
- Animación de apertura/cierre
- Badge de notificación
- Z-index alto para estar sobre todo

### 4. Componente Panel de Chat
**Archivo**: `src/components/chat/chat-panel.tsx`
- Panel que se expande al hacer click
- Header con título y botón cerrar
- Área de mensajes scrolleable
- Input fijo en la parte inferior
- Responsive (móvil: pantalla completa)

### 5. Componentes del Chat
**Archivos**:
- `src/components/chat/chat-message.tsx` - Mensajes individuales
- `src/components/chat/chat-input.tsx` - Input de texto con botón enviar
- `src/components/chat/profile-preview-card.tsx` - Preview de perfiles en chat
- `src/components/chat/campaign-summary-card.tsx` - Resumen de campaña

### 6. Provider del Chat
**Archivo**: `src/components/chat/chat-provider.tsx`
- Context provider para estado global del chat
- Persiste historial en localStorage
- Maneja apertura/cierre desde cualquier lugar

### 7. Hooks
**Archivo**: `src/hooks/use-campaign-chat.ts`
- Hook para usar el chat desde cualquier componente
- Estado del chat
- Historial de mensajes
- Manejo de streaming
- Acciones de confirmación

---

## Integración en el Layout

### Modificar Layout Principal
**Archivo**: `src/components/layout/authenticated-layout.tsx`

```tsx
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatFloatingButton } from "@/components/chat/chat-floating-button";

export function AuthenticatedLayout({ children }) {
  return (
    <ChatProvider>
      <div className="min-h-screen">
        <Header />
        <Sidebar />
        <main>{children}</main>

        {/* Botón flotante del chat - siempre visible */}
        <ChatFloatingButton />
      </div>
    </ChatProvider>
  );
}
```

---

## Tools de Claude (Function Calling)

### 1. search_clients
```typescript
{
  name: "search_clients",
  description: "Busca clientes por nombre",
  parameters: {
    query: string  // Texto de búsqueda
  }
}
// Retorna: Lista de clientes con contactos
```

### 2. search_profiles
```typescript
{
  name: "search_profiles",
  description: "Filtra perfiles según criterios",
  parameters: {
    city?: string
    country?: string
    minFollowers?: number
    maxFollowers?: number
    platforms?: string[]
    services?: string[]
    categories?: string[]
    limit?: number
  }
}
// Retorna: Lista de perfiles que coinciden
```

### 3. select_profiles_auto
```typescript
{
  name: "select_profiles_auto",
  description: "Selecciona automáticamente los mejores perfiles",
  parameters: {
    count: number        // Cantidad de perfiles
    budget: number       // Presupuesto disponible
    services: string[]   // Servicios requeridos
    filters: object      // Filtros adicionales
  }
}
// Retorna: Perfiles seleccionados con servicios configurados
```

### 4. create_campaign
```typescript
{
  name: "create_campaign",
  description: "Crea la campaña con los datos recolectados",
  parameters: {
    name: string
    clientId: string
    clientContactId: string
    budget: number
    profiles: ProfileConfig[]
    // ... otros campos opcionales
  }
}
// Retorna: ID de campaña creada + URL
```

---

## System Prompt para Claude

```
Eres un asistente para crear campañas de marketing con influencers.

Tu objetivo es ayudar al usuario a crear una campaña recolectando:
1. Nombre de la campaña
2. Cliente y contacto
3. Presupuesto
4. Perfiles/influencers con sus servicios

Reglas:
- Sé conciso y directo
- Pide confirmación antes de crear la campaña
- Muestra resumen con costos (precio base + 20% markup)
- Si el usuario da filtros (ciudad, alcance), usa search_profiles
- Si pide "seleccionar automáticamente", usa select_profiles_auto
- Valida que el total no exceda el presupuesto

Datos disponibles del sistema:
- Clientes: [se inyectan dinámicamente]
- Plataformas: Instagram, TikTok
- Servicios: Reel, Story, Post, Video, etc.
```

---

## Flujo de Conversación Ejemplo

```
Usuario: "Quiero crear una campaña para Nike con presupuesto de 5 millones"

Claude: [usa search_clients("Nike")]
→ "Encontré el cliente Nike Colombia. ¿Uso a Juan Pérez como contacto
   (contacto por defecto) o prefieres otro?"

Usuario: "Sí, Juan está bien. Necesito influencers de Bogotá con más
         de 50K seguidores para reels"

Claude: [usa search_profiles({city: "Bogotá", minFollowers: 50000,
        services: ["reel"]})]
→ "Encontré 8 perfiles que coinciden:
   1. @maria_fit - 120K seg - Reel $800.000
   2. @carlos_tech - 85K seg - Reel $600.000
   ...
   ¿Quieres que seleccione automáticamente los mejores según
   tu presupuesto o prefieres elegir manualmente?"

Usuario: "Selecciona automáticamente 3 perfiles"

Claude: [usa select_profiles_auto({count: 3, budget: 5000000, ...})]
→ "He seleccionado:
   - @maria_fit: 2 Reels = $1.920.000
   - @carlos_tech: 2 Reels = $1.440.000
   - @ana_lifestyle: 2 Reels = $1.200.000

   Total: $4.560.000 (91% del presupuesto)

   ¿Confirmas la creación de la campaña?"

Usuario: "Sí, crear"

Claude: [usa create_campaign({...})]
→ "¡Campaña creada exitosamente!
   Puedes verla aquí: /campaigns/abc123"
```

---

## Dependencias a Instalar

```bash
npm install @anthropic-ai/sdk
```

**Variable de entorno requerida**:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Archivos Existentes a Modificar

1. **`src/components/layout/authenticated-layout.tsx`**
   - Envolver con ChatProvider
   - Agregar ChatFloatingButton

2. **`src/services/campaign.ts`**
   - Ya tiene las funciones necesarias, solo reutilizar

---

## Verificación

1. **Configurar API Key**: Agregar `ANTHROPIC_API_KEY` en `.env`
2. **Verificar botón flotante**: Debe aparecer en todas las páginas del dashboard
3. **Probar apertura/cierre**: Click en botón abre/cierra el panel
4. **Probar chat básico**: Escribir "Hola" y verificar respuesta
5. **Probar búsqueda**: "Busca clientes que tengan Nike"
6. **Probar filtros**: "Muestra influencers de Bogotá"
7. **Probar creación completa**: Flujo completo hasta crear campaña
8. **Verificar campaña creada**: Ir a `/campaigns/[id]` y validar datos
9. **Probar en móvil**: Panel debe ser pantalla completa

---

## Estimación de Archivos

| Archivo | Líneas aprox |
|---------|-------------|
| `src/app/api/chat/campaign/route.ts` | 200 |
| `src/lib/ai.ts` | 150 |
| `src/components/chat/chat-provider.tsx` | 80 |
| `src/components/chat/chat-floating-button.tsx` | 100 |
| `src/components/chat/chat-panel.tsx` | 200 |
| `src/components/chat/chat-message.tsx` | 80 |
| `src/components/chat/chat-input.tsx` | 60 |
| `src/components/chat/profile-preview-card.tsx` | 100 |
| `src/components/chat/campaign-summary-card.tsx` | 120 |
| `src/hooks/use-campaign-chat.ts` | 150 |
| **Total** | **~1240** |

---

## Roadmap: Integración WhatsApp (Mediano Plazo)

### Fase 1: Preparación de Arquitectura
- Abstraer la lógica del chat en un servicio reutilizable
- Separar UI de la lógica de conversación
- Crear interfaz común para diferentes canales

### Fase 2: WhatsApp Business API
**Opción A - WhatsApp Business API (Meta)**
- Requiere cuenta de WhatsApp Business verificada
- Costo: ~$0.005-0.08 por mensaje según país
- Webhook para recibir mensajes entrantes

**Opción B - Proveedores terceros**
- Twilio for WhatsApp
- MessageBird
- 360dialog

### Fase 3: Estructura de Archivos para WhatsApp
```
src/
├── lib/
│   ├── ai.ts                    # Lógica AI compartida
│   └── chat-service.ts          # Servicio abstracto de chat
├── app/api/
│   ├── chat/
│   │   └── campaign/route.ts    # Chat web actual
│   └── webhooks/
│       └── whatsapp/route.ts    # Webhook para WhatsApp
```

### Fase 4: Consideraciones
- **Autenticación**: Vincular número de WhatsApp con usuario del sistema
- **Límites**: WhatsApp tiene límites de mensajes y templates
- **Templates**: Mensajes proactivos requieren templates aprobados
- **Multimedia**: Soporte para enviar imágenes de perfiles
- **Estado**: Persistir conversación entre sesiones

### Base de Datos Futura
```prisma
model ChatSession {
  id          String   @id @default(cuid())
  channel     String   // "web" | "whatsapp"
  userId      String?
  phoneNumber String?  // Para WhatsApp
  messages    Json     // Historial de mensajes
  state       Json     // Estado de la conversación
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User?    @relation(fields: [userId], references: [id])
}
```

### Notas para WhatsApp
- El mismo AI (Claude) manejará ambos canales
- La UI será diferente pero la lógica será la misma
- Se podrá iniciar conversación en web y continuar en WhatsApp (o viceversa)


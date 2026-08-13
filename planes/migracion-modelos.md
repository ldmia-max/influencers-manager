# Plan: Migración de Interfaces a `src/models/`

## Objetivo

Centralizar todas las interfaces de dominio en `src/models/` como única fuente de verdad de tipos de datos,
eliminando duplicados y aislando la lógica de negocio de las definiciones de forma.

## Estado actual

```
src/models/
  campaign.ts   ← ya tiene ClientContact, Client, ProfileWithServices, CampaignData, configs, wizard
  cart.ts       ← ya tiene CartItem, CartState, CartPlatformConfig
```

Los demás tipos de dominio están dispersos en:
- `src/services/*.ts` (7 archivos con interfaces mezcladas entre la lógica de fetch)
- `src/components/**/*.tsx` (duplicados de lookup entities como Platform, Country, etc.)
- `src/components/chat/chat-provider.tsx` (ChatMessage, CampaignState exportados desde un Provider)

---

## Archivos a crear (7 nuevos)

### 1. `src/models/admin.ts` — Entidades de referencia administrativa

Mover desde `src/services/admin.ts` y `src/services/category.ts` y `src/services/gender.ts`:

| Interface | Fuente actual |
|-----------|---------------|
| `Platform` | `services/admin.ts:32` |
| `User` | `services/admin.ts:39` |
| `ServiceType` | `services/admin.ts:46` |
| `Country` | `services/admin.ts:56` |
| `Department` | `services/admin.ts:63` |
| `City` | `services/admin.ts:70` |
| `ReachRange` | `services/admin.ts:77` |
| `Category` | `services/category.ts:15` |
| `Gender` | `services/gender.ts:9` |

**Nota**: Varios componentes definen versiones reducidas de estas entidades (solo `{id, name}` o `{id, name, displayName}`).
Tras mover, se eliminan las redefiniciones locales en:
- `components/filters/profile-filters.tsx` (Platform, Category, ServiceType, Gender, LocationItem, Department, City)
- `components/forms/profile-form.tsx` (Platform, ServiceType, Category, Gender, Country, Department, City)
- `components/forms/create-service-type-form.tsx` (Platform)
- `components/forms/create-department-form.tsx` (Country)
- `components/forms/create-city-form.tsx` (Country, Department)
- `components/admin/edit-department-dialog.tsx` (Country)
- `components/admin/edit-city-dialog.tsx` (Country, Department)

---

### 2. `src/models/profile.ts` — Tipos del dominio Perfil/Influencer

Mover desde `src/services/profile.ts`:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `ProfileSocialAccount` | `services/profile.ts:15` | Cuenta social con plataforma y servicios |
| `ProfileDetail` | `services/profile.ts:45` | Perfil completo con todas las relaciones |
| `ProfileResponse` | `services/profile.ts:87` | Respuesta de la API al crear/actualizar perfil |
| `SyncResult` | `services/profile.ts:92` | Resultado del sync con Apify |

**Nota**: `ProfileWithServices` ya está en `models/campaign.ts`. Evaluar si `ProfileDetail` lo reemplaza
o son shapes distintos (campaign usa campos subset para el editor, profile.ts tiene más detalle).

---

### 3. `src/models/client.ts` — Tipos del dominio Cliente

Mover desde `src/services/client.ts`:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `ClientResponse` | `services/client.ts:24` | Respuesta completa del cliente con contactos |
| `ClientAccessResult` | `services/client.ts:31` | Resultado de crear/actualizar acceso del cliente |

**Nota**: `ClientContact` y `ClientPayload` ya se importan desde `@/lib/schemas/client`. Solo las *response
shapes* se mueven a models/.

---

### 4. `src/models/approval.ts` — Tipos del flujo de aprobación

Mover desde `src/services/approval.ts` + dos componentes de approve:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `ApprovalProfileService` | `services/approval.ts:18` | Servicio dentro de la vista de aprobación |
| `ApprovalProfilePlatform` | `services/approval.ts:30` | Plataforma dentro de la vista de aprobación |
| `ApprovalProfile` | `services/approval.ts:45` | Perfil en el flujo de aprobación |
| `ApprovalCampaign` | `services/approval.ts:57` | Campaña en el flujo de aprobación |
| `ApprovalData` | `services/approval.ts:78` | Shape completo que retorna `GET /api/public/approve/[token]` |
| `SubmitApprovalResult` | `services/approval.ts:86` | Resultado del POST de aprobación |
| `ServiceData` | `components/approve/platform-section.tsx:12` | Servicio para renderizar en la UI de aprobación |
| `PlatformData` | `components/approve/profile-card.tsx:13` | Plataforma para renderizar en la UI de aprobación |

---

### 5. `src/models/chat.ts` — Tipos del chat de IA

Mover desde `src/services/chat.ts` + `src/components/chat/chat-provider.tsx`:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `ChatApiMessage` | `services/chat.ts:7` | Mensaje en el formato de la API (role + content) |
| `ChatRequest` | `services/chat.ts:12` | Payload del POST /api/chat/campaign |
| `ChatResponse` | `services/chat.ts:17` | Respuesta de la API del chat |
| `ChatMessage` | `components/chat/chat-provider.tsx:18` | Mensaje en la UI (con id + timestamp) |
| `CampaignState` | `components/chat/chat-provider.tsx:25` | Estado de la campaña que maneja el AI |

---

### 6. `src/models/social.ts` — Tipos del procesamiento de redes sociales

Mover desde `src/services/social-processor.ts`:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `NormalizedSocialData` | `services/social-processor.ts:8` | Datos normalizados de Instagram/TikTok |
| `AIProfileAnalysis` | `services/social-processor.ts:23` | Resultado del análisis de IA (tags, summary, tone) |
| `ProcessResult` | `services/social-processor.ts:184` | Resultado de `processAndSaveSocialProfile` |

---

### 7. `src/models/auth.ts` — Tipos de resultado de autenticación

Mover desde `src/services/auth.ts`:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `RegisterResult` | `services/auth.ts:15` | Resultado del registro de usuario |
| `ClientLoginResult` | `services/auth.ts:20` | Resultado del login del cliente |

---

## Archivo a extender (1)

### `src/models/campaign.ts` — Agregar tipos de respuesta de campaña

Mover desde `src/services/campaign.ts`:

| Interface | Fuente actual | Descripción |
|-----------|---------------|-------------|
| `CreateCampaignResponse` | `services/campaign.ts:27` | Respuesta del POST /api/campaigns |
| `UpdateStatusResponse` | `services/campaign.ts:33` | Respuesta del PATCH status |
| `RegenerateTokenResponse` | `services/campaign.ts:39` | Respuesta del POST regenerate-token |
| `CampaignFormData` | `services/campaign.ts:126` | Shape de datos del formulario de campaña |
| `ApprovalToken` | `components/campaigns/approval-tokens-card.tsx:20` | Token de aprobación con expiración |

**Nota**: Verificar que `CampaignFormData` no solape con `CampaignData` ya existente.

---

## Duplicados a resolver

Estas interfaces existen en múltiples lugares con formas ligeramente distintas.
Hay que elegir la canónica (la de models/) y eliminar o redirigir las demás:

| Interface | Canónica (en models/) | Duplicados a eliminar |
|-----------|----------------------|----------------------|
| `ProfileWithServices` | `models/campaign.ts` | `components/campaigns/profile-selector-new.tsx:40` |
| `Client` | `models/campaign.ts` | `components/forms/campaign-form.tsx:29` (mismo shape) |
| `ClientContact` | `models/campaign.ts` | `components/forms/campaign-form.tsx:35`, `components/forms/client-form.tsx:13` — revisar si los campos coinciden |
| `Platform` | `models/admin.ts` (nuevo) | `components/filters/profile-filters.tsx`, `components/forms/profile-form.tsx`, `components/forms/create-service-type-form.tsx` |
| `ServiceType` | `models/admin.ts` (nuevo) | `components/filters/profile-filters.tsx`, `components/forms/profile-form.tsx` |
| `Category` | `models/admin.ts` (nuevo) | `components/filters/profile-filters.tsx` |
| `Gender` | `models/admin.ts` (nuevo) | `components/filters/profile-filters.tsx`, `components/forms/profile-form.tsx` |
| `Country` | `models/admin.ts` (nuevo) | `components/forms/profile-form.tsx`, `components/forms/create-city-form.tsx`, `components/admin/edit-city-dialog.tsx`, `components/admin/edit-department-dialog.tsx` (formas locales: solo `{id, name}` — compatibles con Pick) |
| `Department` | `models/admin.ts` (nuevo) | `components/forms/profile-form.tsx`, `components/forms/create-city-form.tsx`, `components/admin/edit-city-dialog.tsx` |
| `City` | `models/admin.ts` (nuevo) | `components/forms/profile-form.tsx` |

---

## Tipos adicionales encontrados en hooks y lib

El análisis también detectó estos tipos en hooks y librerías que son candidatos secundarios:

| Interface | Fuente | Acción sugerida |
|-----------|--------|-----------------|
| `CampaignDetail` | `hooks/queries/use-campaigns.ts` | Mover a `models/campaign.ts` — shape anidado de respuesta de campaña |
| `ClientDetail` | `hooks/queries/use-clients.ts` | Mover a `models/client.ts` — cliente con contactos y portal |
| `FilterOptions` + `UseProfileFiltersReturn` | `hooks/queries/use-profile-filters.ts` | Dejar en hook (tipado específico del hook) |
| `AdminPlatform`, `AdminCountry` | `hooks/queries/use-admin.ts` | Mover a `models/admin.ts` o dejar en hook si son subsets |
| `ServiceSelection`, `PlatformSelection`, `ProfileSelection` | `lib/campaign-utils.ts` | Mover a `models/campaign.ts` — shapes de selección para el wizard |
| `ReachRangeData` | `lib/format.ts` | Mover a `models/admin.ts` — subset de ReachRange para cálculos |
| `InstagramProfileData`, `TikTokProfileData` | `lib/apify.ts` | Mover a `models/social.ts` — shapes crudos de Apify |
| `ProfileWithRelations` | `data-access/profiles.ts` | Dejar en data-access (tipo interno de Prisma con Decimal serializado) |
| `ProfileFilters` | `data-access/profiles.ts` | Dejar en data-access (parámetros internos de query) |
| `ChatMessage` | `lib/ai.ts` | Consolidar con el de `models/chat.ts` |

---

## Lo que NO se mueve (justificación)

| Interface | Ubicación | Razón |
|-----------|-----------|-------|
| `*Props` interfaces | Componentes respectivos | Son tipos de props, acopladas al contrato del componente |
| `SearchParams` | App pages | Tipado específico de Next.js page params |
| `PageProps` | App pages | Tipado específico de Next.js routes |
| `CartContextType` | `contexts/cart-context.tsx` | Contrato del contexto React, no es un modelo de dominio |
| `ChatContextType` | `components/chat/chat-provider.tsx` | Idem |
| `SocialAccountInput` | `forms/profile-form.tsx` | Input de formulario (controlado), no es shape de API |
| `ClientFormData` | `forms/client-form.tsx` | Input de formulario con campos extra como `id?` para manejo de array |
| `CampaignFormData` | `forms/campaign-form.tsx` | Input de formulario (si tiene campos de display, no de API) |
| `QuantityControlProps` | `cart/service-selection-modal.tsx` | Props de sub-componente interno |

---

## Orden de ejecución

1. Crear los 7 archivos nuevos (sin romper nada, solo definiendo types)
2. Extender `models/campaign.ts`
3. Actualizar imports en `services/` (reemplazar definiciones por imports desde models/)
4. Actualizar imports en `components/` (reemplazar redefiniciones locales por imports desde models/)
5. `npm run build` — verificar que no hay errores de tipos

---

## Verificación

```bash
npm run build   # Sin errores TypeScript
```

Comprobar que ningún archivo en `src/` importa tipos de dominio desde `services/` directamente
(deberían importar desde `models/`); los services solo exportan funciones async.

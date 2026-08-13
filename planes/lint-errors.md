# Errores de ESLint

**Fecha:** 2026-02-06  
**Total de problemas:** 50 (22 errores, 28 advertencias)

## Resumen

- **Errores:** 22
- **Advertencias:** 28
- **Potencialmente arreglables con --fix:** 1 advertencia

---

## Errores (22)

### scripts/backup-db.js
- **Línea 10:22** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 11:12** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 12:14** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 15:1** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)

### scripts/restore-db.js
- **Línea 10:22** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 11:12** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 12:14** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 13:18** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)
- **Línea 16:1** - A `require()` style import is forbidden (`@typescript-eslint/no-require-imports`)

### src/app/api/clients/[id]/access/route.ts
- **Línea 51:25** - Unexpected any. Specify a different type (`@typescript-eslint/no-explicit-any`)

### src/components/approve/approval-header.tsx
- **Línea 25:28** - Cannot call impure function during render: `Date.now()` is an impure function (`react-hooks/purity`)

### src/components/campaigns/campaign-step-profiles.tsx
- **Línea 109:5** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

### src/components/campaigns/platform-service-selector.tsx
- **Línea 102:7** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

### src/components/campaigns/profile-selector-new.tsx
- **Línea 266:5** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)
- **Línea 280:5** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

### src/components/campaigns/profile-selector.tsx
- **Línea 196:5** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

### src/components/cart/service-selection-modal.tsx
- **Línea 89:9** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

### src/components/forms/client-form.tsx
- **Línea 115:76** - Unexpected any. Specify a different type (`@typescript-eslint/no-explicit-any`)

### src/components/profiles/profile-detail-sheet.tsx
- **Línea 75:7** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

### src/components/profiles/sync-profile-button.tsx
- **Línea 38:31** - Unexpected any. Specify a different type (`@typescript-eslint/no-explicit-any`)
- **Línea 44:29** - Unexpected any. Specify a different type (`@typescript-eslint/no-explicit-any`)

### src/contexts/cart-context.tsx
- **Línea 133:5** - Calling setState synchronously within an effect can trigger cascading renders (`react-hooks/set-state-in-effect`)

---

## Advertencias (28)

### src/app/(auth)/login/page.tsx
- **Línea 11:29** - 'CardDescription' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/app/(dashboard)/campaigns/page.tsx
- **Línea 21:3** - 'DropdownMenuSeparator' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/app/(dashboard)/profiles/[id]/edit/page.tsx
- **Línea 17:9** - 'session' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)

### src/app/api/clients/route.ts
- **Línea 5:11** - 'SearchParams' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/app/approve/[token]/page.tsx
- **Línea 12:10** - 'Button' is defined but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 82:9** - 'router' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 147:16** - 'err' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/components/campaigns/campaign-editor.tsx
- **Línea 441:5** - React Hook useMemo has missing dependencies: 'handleActivateDirectly' and 'handleSave' (`react-hooks/exhaustive-deps`)

### src/components/campaigns/campaign-status-actions.tsx
- **Línea 66:7** - 'STATUS_ACTIONS' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 126:9** - 'validTransitions' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 169:9** - 'canResendToReview' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)

### src/components/campaigns/campaign-summary.tsx
- **Línea 26:7** - 'totalBase' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)

### src/components/campaigns/platform-service-selector.tsx
- **Línea 17:3** - 'PlatformConfig' is defined but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 18:3** - 'ServiceConfig' is defined but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 106:6** - React Hook useEffect has missing dependencies: 'config' and 'onChange' (`react-hooks/exhaustive-deps`)
- **Línea 247:17** - 'baseTotal' is assigned a value but never used (`@typescript-eslint/no-unused-vars`)

### src/components/campaigns/profile-selector-new.tsx
- **Línea 32:3** - 'Filter' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/components/cart/cart-panel.tsx
- **Línea 9:3** - 'SheetFooter' is defined but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 13:10** - 'Separator' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/components/cart/service-selection-modal.tsx
- **Línea 9:3** - 'DialogFooter' is defined but never used (`@typescript-eslint/no-unused-vars`)
- **Línea 20:35** - 'CartServiceConfig' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/components/chat/chat-panel.tsx
- **Línea 13:3** - 'X' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/components/forms/campaign-form.tsx
- **Línea 90:6** - React Hook useEffect has missing dependencies: 'availableContacts', 'formData.clientContactId', and 'selectedClient' (`react-hooks/exhaustive-deps`)

### src/components/forms/profile-form.tsx
- **Línea 258:6** - React Hook useEffect has a missing dependency: 'getAvailableServices' (`react-hooks/exhaustive-deps`)

### src/hooks/use-profile-filters.ts
- **Línea 133:5** - Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')

### src/lib/auth.config.ts
- **Línea 1:31** - 'User' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/services/admin.ts
- **Línea 5:10** - 'apiGet' is defined but never used (`@typescript-eslint/no-unused-vars`)

### src/types/index.ts
- **Línea 1:28** - 'UserRole' is defined but never used (`@typescript-eslint/no-unused-vars`)

---

## Categorías de Errores

### 1. Imports con require() (9 errores)
Archivos afectados:
- `scripts/backup-db.js`
- `scripts/restore-db.js`

### 2. Uso de `any` explícito (4 errores)
Archivos afectados:
- `src/app/api/clients/[id]/access/route.ts`
- `src/components/forms/client-form.tsx`
- `src/components/profiles/sync-profile-button.tsx`

### 3. setState en efectos (8 errores)
Archivos afectados:
- `src/components/campaigns/campaign-step-profiles.tsx`
- `src/components/campaigns/platform-service-selector.tsx`
- `src/components/campaigns/profile-selector-new.tsx`
- `src/components/campaigns/profile-selector.tsx`
- `src/components/cart/service-selection-modal.tsx`
- `src/components/profiles/profile-detail-sheet.tsx`
- `src/contexts/cart-context.tsx`

### 4. Funciones impuras en render (1 error)
Archivos afectados:
- `src/components/approve/approval-header.tsx`

## Recomendaciones

1. **Scripts con require()**: Convertir los imports de CommonJS a ES modules o agregar excepciones para archivos .js
2. **Tipos any**: Reemplazar con tipos específicos de TypeScript
3. **setState en useEffect**: Considerar usar el patrón de estado derivado o mover la lógica fuera del efecto
4. **Variables no usadas**: Eliminar imports y variables no utilizadas
5. **Dependencias de hooks**: Agregar las dependencias faltantes o usar useCallback/useMemo según corresponda

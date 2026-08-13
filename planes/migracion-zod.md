# Plan: Migrar Validaciones a Zod

## Estado Actual

### Dependencias (instaladas pero sin usar)
- `zod@^4.3.6` - **0 imports** en todo `src/`
- `@hookform/resolvers@^5.2.2` - **0 imports**
- `react-hook-form@^7.71.1` - Solo usado en `src/components/ui/form.tsx` (primitivo Shadcn, sin conectar a ningun formulario)

### Patron actual de validacion

**Data-access layer (12 archivos)** - Donde vive TODA la validacion real:
```typescript
// Patron repetido en cada archivo de src/data-access/
if (!data.name || !data.email) {
  throw new ValidationError("Nombre y email son requeridos");
}
if (data.password.length < 6) {
  throw new ValidationError("Password debe tener al menos 6 caracteres");
}
```

**API routes (38 archivos)** - Sin validacion, pasan body directo:
```typescript
const { name, email, password } = await req.json(); // sin validar
const user = await createUser({ name, email, password }); // data-access valida
```

**Formularios (11 archivos)** - Validacion manual con useState:
```typescript
const [validationError, setValidationError] = useState<string | null>(null);
if (!formData.name) { setValidationError("Nombre es requerido"); return; }
```

**Formularios simples (6 archivos)** - Solo usan HTML nativo:
```html
<Input required pattern="^[A-Za-z]{2,3}$" minLength={6} type="email" />
```

---

## Analisis: Vale la pena?

### Beneficios concretos

1. **Schemas compartidos entre frontend y backend** - Un solo schema Zod reemplaza:
   - El type de TypeScript en `services/`
   - La validacion manual en `data-access/`
   - La validacion manual en el formulario
   - Actualmente estos 3 se pueden desincronizar (y de hecho ya paso con `CreateCategoryPayload` que no tenia `description`)

2. **Validacion en la frontera de la API** - Actualmente `req.json()` se destructura sin validar. Cualquier payload malformado llega al data-access y puede causar errores de Prisma poco claros.

3. **Errores de formulario por campo** - Con `zodResolver` + `react-hook-form`, cada campo muestra su error individual, en vez del error generico actual (`validationError` string unico).

4. **Menos codigo repetitivo** - Los 12 archivos de data-access repiten el mismo patron `if (!x) throw new ValidationError(...)`.

### Riesgos y costos

1. **Volumen de cambios** - 38 rutas API + 12 data-access + 11 formularios = ~61 archivos
2. **Formularios complejos** - `profile-form.tsx` y `campaign-form.tsx` son forms con arrays dinamicos, filtros cruzados, etc. Migrar a `react-hook-form` + `useFieldArray` es un refactor grande.
3. **Validacion de negocio no se puede mover a Zod** - Checks como "rango de alcance no se superpone con existentes", "perfil en uso no se puede borrar", "transicion de status valida" dependen de queries a la DB. Estos se quedan en data-access.
4. **react-hook-form cambiaria el patron de forms** - Actualmente todos los forms usan `FormData` o `useState` controlado. Migrar a `useForm()` + `register()` cambia el patron completo.

### Veredicto

**SI vale la pena, pero con alcance limitado.** La migracion mas valiosa y menos riesgosa es:
- Crear schemas Zod compartidos
- Usarlos en API routes para validar payloads
- Usarlos en formularios SIMPLES con react-hook-form
- NO migrar los formularios complejos (profile-form, campaign-form) por ahora

---

## Plan de implementacion

### Fase 1: Schemas compartidos (`src/lib/schemas/`)

Crear schemas Zod que sirvan como fuente de verdad. Cada schema exporta el tipo inferido.

**Archivos nuevos:**

```
src/lib/schemas/
  user.ts           # registerSchema, updateUserSchema
  profile.ts        # createProfileSchema, updateProfileSchema
  campaign.ts       # createCampaignSchema, updateCampaignSchema
  client.ts         # createClientSchema, updateClientSchema, clientLoginSchema
  category.ts       # createCategorySchema, updateCategorySchema
  platform.ts       # createPlatformSchema, updatePlatformSchema
  service-type.ts   # createServiceTypeSchema
  reach-range.ts    # createReachRangeSchema
  location.ts       # countrySchema, departmentSchema, citySchema
  gender.ts         # createGenderSchema
  approval.ts       # submitApprovalSchema
```

**Ejemplo (`src/lib/schemas/user.ts`):**
```typescript
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Password debe tener al menos 6 caracteres"),
});

export type RegisterPayload = z.infer<typeof registerSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  password: z.string().min(6).optional(),
});

export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
```

**Estimacion:** ~12 archivos nuevos, solo definiciones de schemas.

### Fase 2: Validar en API routes

Crear un helper para parsear requests con Zod y usar en cada ruta.

**Helper (`src/lib/validate-request.ts`):**
```typescript
import { NextResponse } from "next/server";
import type { z } from "zod";

export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos invalidos", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 400 }
    );
  }
}
```

**Cambio en cada ruta API (ejemplo `api/auth/register/route.ts`):**
```typescript
// Antes:
const { name, email, password } = await req.json();

// Despues:
const result = await parseBody(req, registerSchema);
if (result instanceof NextResponse) return result;
const { name, email, password } = result;
```

**Archivos a modificar:** ~28 rutas con POST/PUT/PATCH (las GET y DELETE no necesitan).

### Fase 3: Actualizar types en services/

Reemplazar los tipos manuales en `src/services/` por los tipos inferidos de los schemas Zod.

```typescript
// Antes (src/services/admin.ts):
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
}

// Despues:
export type { CreateUserPayload } from "@/lib/schemas/user";
// o importar directamente en los hooks
```

**Archivos a modificar:** ~10 archivos de services.

### Fase 4: Formularios simples con react-hook-form

Migrar los 6 formularios simples de admin que actualmente solo usan HTML `required`:
- `create-category-form.tsx`
- `create-platform-form.tsx`
- `create-country-form.tsx`
- `create-user-form.tsx`
- `create-department-form.tsx`
- `create-city-form.tsx`

**Patron nuevo:**
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCategorySchema, type CreateCategoryPayload } from "@/lib/schemas/category";

export function CreateCategoryForm() {
  const createMutation = useCreateCategory();
  const form = useForm<CreateCategoryPayload>({
    resolver: zodResolver(createCategorySchema),
  });

  function onSubmit(data: CreateCategoryPayload) {
    createMutation.mutate(data, {
      onSuccess: () => form.reset(),
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register("name")} />
      {form.formState.errors.name && <p>{form.formState.errors.name.message}</p>}
    </form>
  );
}
```

**Archivos a modificar:** 6 formularios.

### Fase 5 (Opcional/Futuro): Formularios complejos

Los 5 formularios complejos se pueden migrar despues si se decide:
- `profile-form.tsx` - Arrays dinamicos de plataformas/servicios, filtros cruzados
- `campaign-form.tsx` - Wizard multi-step, validacion de presupuesto
- `client-form.tsx` - Array de contactos con campo isPrimary
- `create-service-type-form.tsx` - Multi-select de profileTypes
- `create-reach-range-form.tsx` - Validacion numerica cruzada (min < max)

Estos requieren `useFieldArray` y refactors mas grandes. Evaluar caso por caso.

### Fase 6 (Opcional/Futuro): Simplificar data-access

Una vez que la API valida con Zod, se pueden reducir los checks duplicados en data-access. Los checks de negocio (duplicados, rangos superpuestos, entidades en uso) se quedan, pero los checks de campos requeridos se pueden eliminar.

---

## Orden de ejecucion

| Fase | Archivos | Riesgo | Valor |
|------|----------|--------|-------|
| 1. Schemas | ~12 nuevos | Bajo (solo archivos nuevos) | Alto (fuente de verdad) |
| 2. API routes | ~28 modificados | Bajo (agrega validacion, no quita) | Alto (seguridad) |
| 3. Services types | ~10 modificados | Bajo (solo cambio de imports) | Medio (DRY) |
| 4. Forms simples | 6 modificados | Medio (cambia patron de forms) | Medio (UX) |
| 5. Forms complejos | 5 modificados | Alto (refactor grande) | Medio (UX) |
| 6. Data-access cleanup | 12 modificados | Medio (quita validacion redundante) | Bajo (DRY) |

**Recomendacion: Ejecutar Fases 1-3 juntas (bajo riesgo, alto valor), luego Fase 4, y evaluar Fases 5-6 despues.**

---

## Notas

- Zod v4 usa `z.string().min(1)` en vez de `.nonempty()` (deprecated en v4)
- `@hookform/resolvers@5.x` ya soporta Zod v4
- Los schemas se pueden reusar en tests para generar datos de prueba con librerias como `@anatine/zod-mock`
- La validacion de negocio (duplicados, entidades en uso, transiciones de status) NO se mueve a Zod - se queda en data-access

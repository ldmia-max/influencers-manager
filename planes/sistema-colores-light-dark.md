# Plan: Sistema de Colores con Modo Claro, Oscuro y Sistema

## Estado Actual

El proyecto **ya tiene** la infraestructura de colores parcialmente configurada:

- ✅ Variables CSS en OKLCH definidas en `src/app/globals.css` (`:root` para light, `.dark` para dark)
- ✅ Shadcn/ui con `cssVariables: true` y tokens semánticos completos
- ✅ Tailwind v4 con `@custom-variant dark (&:is(.dark *))`
- ❌ Sin `ThemeProvider` — no hay forma de cambiar el tema dinámicamente
- ❌ Sin UI toggle para cambiar tema
- ❌ Sin persistencia de preferencia del usuario
- ❌ Sin soporte para `prefers-color-scheme` del sistema
- ⚠️ Un color hardcodeado: `bg-gray-50` en `src/app/(app)/layout.tsx`

---

## Objetivo

Implementar un sistema completo de temas (claro / oscuro / sistema) que:
1. Respete la preferencia del sistema operativo por defecto
2. Permita al usuario cambiar manualmente el tema
3. Persista la preferencia en `localStorage`
4. No cause flash de contenido sin estilos (FOUC) en SSR
5. Use las variables CSS ya existentes sin romper nada

---

## Stack Elegido

- **`next-themes`** — librería estándar para Next.js, maneja SSR, FOUC y localStorage automáticamente
- Variables CSS OKLCH existentes (sin cambios al sistema de colores)
- Componente toggle con `lucide-react` (ya instalado)

---

## Pasos de Implementación

### Paso 1: Instalar `next-themes`

```bash
npm install next-themes
```

---

### Paso 2: Crear el `ThemeProvider`

**Archivo:** `src/components/providers/theme-provider.tsx`

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

---

### Paso 3: Envolver el layout raíz con el Provider

**Archivo:** `src/app/layout.tsx`

Cambios:
- Importar `ThemeProvider`
- Añadir `suppressHydrationWarning` al `<html>` (requerido por next-themes)
- Configurar `attribute="class"` (Tailwind usa clase `.dark`), `defaultTheme="system"`, `enableSystem`

```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

### Paso 4: Crear el componente Toggle de tema

**Archivo:** `src/components/theme-toggle.tsx`

Usar un `DropdownMenu` de Shadcn/ui con tres opciones: Claro, Oscuro, Sistema.

```tsx
"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### Paso 5: Integrar el Toggle en la navegación

Ubicar el `<ThemeToggle />` en el header/navbar de la app. El componente a modificar es el que contiene el header del layout de la app (identificar si es un `Navbar`, `Header` o `Sidebar` component en `src/components/`).

---

### Paso 6: Corregir el color hardcodeado

**Archivo:** `src/app/(app)/layout.tsx`

```diff
- <div className="bg-gray-50 ...">
+ <div className="bg-background ...">
```

---

### Paso 7: Revisar y documentar los tokens de color existentes

Los tokens actuales en `globals.css` ya están bien estructurados. Verificar que todos los colores usados en la app sean semánticos (variables CSS) y no estén hardcodeados.

Buscar con grep los posibles colores hardcodeados problemáticos:
```bash
grep -r "bg-gray-\|bg-white\|bg-black\|text-white\|text-black" src/app src/components --include="*.tsx"
```

Para cada caso encontrado, evaluar si debe cambiarse a un token semántico:
- `bg-white` → `bg-background` o `bg-card`
- `bg-gray-50` → `bg-muted` o `bg-background`
- `bg-gray-100` → `bg-muted`
- `text-gray-500` → `text-muted-foreground`
- `text-gray-900` → `text-foreground`

---

## Archivos a Crear/Modificar

| Acción | Archivo |
|--------|---------|
| Crear | `src/components/providers/theme-provider.tsx` |
| Crear | `src/components/theme-toggle.tsx` |
| Modificar | `src/app/layout.tsx` |
| Modificar | `src/app/(app)/layout.tsx` (fix `bg-gray-50`) |
| Modificar | Header/Navbar (añadir `<ThemeToggle />`) |

---

## Consideraciones Técnicas

### FOUC (Flash of Unstyled Content)
`next-themes` inyecta un script inline en el `<head>` para leer `localStorage` antes de que React hidrate, eliminando el flash. El atributo `suppressHydrationWarning` en `<html>` evita warnings de hidratación por la clase `.dark` añadida por el script.

### `disableTransitionOnChange`
Se usa para evitar que las transiciones CSS se disparen durante el cambio de tema, lo que puede verse mal. Si se quiere animación suave al cambiar tema, remover esta opción y añadir transiciones explícitas en CSS.

### SSR con Next.js App Router
`next-themes` es compatible con RSC. El `ThemeProvider` lleva `"use client"` pero puede envolver Server Components sin problema, ya que Next.js maneja este patrón correctamente.

---

## Tokens de Color de Referencia (ya existentes en globals.css)

| Token | Uso semántico |
|-------|--------------|
| `--background` | Fondo principal de la página |
| `--foreground` | Texto principal |
| `--card` | Fondo de tarjetas/paneles |
| `--card-foreground` | Texto en tarjetas |
| `--primary` | Color de acción principal (botones, links) |
| `--primary-foreground` | Texto sobre color primario |
| `--secondary` | Elementos secundarios |
| `--muted` | Fondos sutiles, inputs deshabilitados |
| `--muted-foreground` | Texto de ayuda, placeholders |
| `--accent` | Hover states, highlights |
| `--destructive` | Acciones destructivas (eliminar) |
| `--border` | Bordes de elementos |
| `--input` | Bordes de inputs |
| `--ring` | Focus ring |
| `--sidebar-*` | Tokens específicos del sidebar |
| `--chart-1..5` | Colores para gráficas |

---

## Criterios de Aceptación

- [ ] El usuario puede cambiar entre Claro / Oscuro / Sistema desde el header
- [ ] La preferencia persiste al recargar la página
- [ ] En modo "Sistema", sigue automáticamente `prefers-color-scheme` del SO
- [ ] No hay FOUC (flash) al cargar la página
- [ ] No hay warnings de hidratación en consola
- [ ] El color `bg-gray-50` está reemplazado por token semántico
- [ ] Todos los componentes se ven correctamente en ambos modos

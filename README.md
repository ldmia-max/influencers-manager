# Influencer Manager

Plataforma de gestión de perfiles de influencers y creadores UGC. Permite centralizar creadores de contenido, sus cuentas en redes sociales, las métricas de cada cuenta y las tarifas por tipo de servicio, además de administrar la cartera de clientes de la agencia.

Las métricas de Instagram y TikTok se obtienen automáticamente mediante scraping con Apify, de modo que los seguidores, publicaciones y foto de perfil se mantienen actualizados sin captura manual.

---

## Índice

- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Funcionalidades](#funcionalidades)
- [Arquitectura](#arquitectura)
- [Convenciones de desarrollo](#convenciones-de-desarrollo)
- [Estado actual y pendientes](#estado-actual-y-pendientes)
- [Despliegue](#despliegue)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) con React 19 |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL |
| ORM | Prisma 6 |
| Autenticación | NextAuth.js v5 (beta) con credenciales y JWT |
| Estilos | Tailwind CSS v4 |
| Componentes | Shadcn/ui (estilo New York) sobre Radix UI |
| Iconos | Lucide React |
| Scraping | Apify (`apify-client`) |
| Hashing | bcryptjs |

El compilador usado es **webpack**, no Turbopack: tanto `npm run dev` como `npm run build` incluyen el flag `--webpack`.

La interfaz está íntegramente en español.

---

## Requisitos previos

- **Node.js 20 o superior** (el proyecto se ha probado con Node 25)
- **PostgreSQL 16** instalado localmente, o accesible en red
- Un cliente de base de datos para inspeccionar los datos: **DBeaver**, **pgAdmin** o el propio `npm run db:studio`
- Opcional: una cuenta de **Apify** con token de API, si se quiere probar la sincronización de métricas

---

## Puesta en marcha local

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/LDMRepository/influencer-manager.git
cd influencer-manager
npm install
```

### 2. Crear la base de datos

Crea una base de datos vacía en tu PostgreSQL local. Desde pgAdmin o DBeaver: clic derecho sobre *Databases* → *Create* → *Database…*, con el nombre `influencer-manager`.

O desde la terminal:

```bash
createdb -U postgres influencer-manager
```

No hace falta crear ninguna tabla: de eso se encarga Prisma en el paso 4.

### 3. Configurar las variables de entorno

```bash
cp .env.example .env
```

Edita el `.env` y rellena como mínimo estos tres valores:

```bash
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/influencer-manager
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<genera uno con el comando de abajo>
```

Para generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Importante:** todas las variables van en `.env`, no en `.env.local`. Next.js lee ambos archivos, pero **el CLI de Prisma solo lee `.env`**. Si pusieras la URL de la base en `.env.local`, los comandos `db:push`, `db:seed` y `db:studio` seguirían usando la de `.env` y acabarías tocando una base que no esperabas.

> Si tu contraseña contiene caracteres especiales (`@ : / ? # & %`) debes codificarlos en formato URL. Por ejemplo, `Mi@Pass#1` se escribe `Mi%40Pass%231`.

### 4. Crear las tablas y cargar datos de prueba

```bash
npm run db:push    # crea las 11 tablas a partir de prisma/schema.prisma
npm run db:seed    # carga el usuario admin, plataformas, servicios y categorías
```

El seed deja preparado:

- Usuario administrador: **`admin@example.com`** / **`admin123`**
- Plataformas: Instagram y TikTok
- 11 tipos de servicio (Reel, Post, Story, Carrusel, Video UGC, Foto UGC, Live, etc.)
- 8 categorías (Foodie, Tecnología, Moda, Fitness, Viajes, Belleza, Gaming, Lifestyle)

### 5. Arrancar el servidor

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`. Entra con las credenciales del administrador.

### Verificar que todo está bien

Al arrancar, Next.js debe imprimir `Environments: .env`. Si entras a `/profiles` y la lista aparece vacía, la conexión a tu base local es correcta.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|:---:|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL. La lee Prisma. |
| `NEXTAUTH_URL` | Sí | URL pública de la app. En local `http://localhost:3000`, **sin barra final**. |
| `NEXTAUTH_SECRET` | Sí | Clave con la que se firman los JWT de sesión. Debe ser distinta entre local y producción. |
| `APIFY_API_TOKEN` | No | Token de Apify. Sin él, la sincronización de métricas devuelve `null` y falla en silencio. |
| `AUTH_TRUST_HOST` | No | Solo en producción tras un proxy inverso (Nginx, Traefik, Caddy). Ponlo en `true` o NextAuth construirá mal las URLs de callback. |

Estas otras están declaradas pero **ningún archivo del proyecto las lee todavía**; corresponden a funcionalidades planeadas: `ENABLE_EMAILS`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`.

El archivo [.env.example](.env.example) documenta cada variable con su valor esperado en local y en producción. El `.env` real está ignorado por git y nunca debe subirse.

---

## Scripts disponibles

```bash
npm run dev              # Servidor de desarrollo (webpack) en el puerto 3000
npm run build            # Compilación de producción
npm run start            # Sirve la compilación de producción
npm run lint             # ESLint

npm run db:push          # Sincroniza el esquema con la base, sin historial de migraciones
npm run db:migrate       # Crea y aplica migraciones (prisma migrate dev)
npm run db:generate      # Regenera el Prisma Client tras cambiar el esquema
npm run db:seed          # Carga los datos iniciales
npm run db:studio        # Interfaz web de Prisma para explorar los datos
```

El proyecto **no tiene suite de pruebas** por el momento.

### Scripts puntuales

En [scripts/](scripts/) hay utilidades de mantenimiento que se ejecutan a mano:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/update-currency.ts
```

`update-currency.ts` convierte a COP todas las tarifas que estén registradas en USD.

---

## Estructura del proyecto

```
prisma/
  schema.prisma          Definición del modelo de datos
  seed.ts                Datos iniciales

scripts/                 Utilidades de mantenimiento puntuales

src/
  app/
    (auth)/              Login y registro
    (dashboard)/         Área privada: dashboard, perfiles, categorías, clientes
    admin/               Panel de administración (solo rol ADMIN)
    client-login/        Portal de clientes: acceso
    client-dashboard/    Portal de clientes: campañas de la empresa
    api/                 Route handlers
  components/
    ui/                  Componentes base de Shadcn/ui
    forms/               Formularios de alta y edición
    profiles/            Acciones sobre perfiles: ver, sincronizar, eliminar
    clients/             Gestión de clientes y sus accesos
    admin/               Controles del panel de administración
    filters/             Filtros del listado de perfiles
    layout/              Cabecera y menú lateral
  lib/
    auth.ts              Configuración de NextAuth
    prisma.ts            Cliente de Prisma (singleton)
    cache.ts             Consultas cacheadas
    apify.ts             Integración con Apify
    format.ts            Formato de números y precios
  types/                 Tipos compartidos
  middleware.ts          Protección de rutas
```

Los paréntesis en `(auth)` y `(dashboard)` indican **grupos de rutas** de Next.js: sirven para compartir un layout sin añadir segmento a la URL. Por eso las páginas dentro de `(dashboard)` se sirven en `/profiles`, `/clients` o `/categories`, y no en `/dashboard/profiles`.

---

## Modelo de datos

```mermaid
erDiagram
    User ||--o{ Profile : crea
    User ||--o{ Category : crea
    User ||--o{ Client : crea

    Profile ||--o{ SocialAccount : tiene
    Profile }o--o{ Category : "ProfileCategory"

    SocialPlatform ||--o{ SocialAccount : "aloja"
    SocialPlatform ||--o{ ServiceType : define

    SocialAccount ||--o{ ProfileService : "tarifas"
    ServiceType   ||--o{ ProfileService : "tipo de"

    Client ||--o{ ClientContact : tiene
    Client ||--o| ClientUser : "acceso web"
```

### Entidades principales

**`Profile`** — El creador de contenido. Su campo `type` puede ser `INFLUENCER`, `UGC` o `BOTH`, e incluye país y ciudad.

**`SocialAccount`** — La cuenta del creador en una plataforma concreta. Un perfil solo puede tener una cuenta por plataforma. Aquí se guardan las métricas que trae Apify: seguidores, seguidos, publicaciones, likes promedio, tasa de interacción, biografía, verificación y la ruta de la foto de perfil.

**`SocialPlatform`** — Instagram, TikTok, etc. Es una tabla de datos, no un enum, precisamente para poder añadir plataformas sin tocar el esquema.

**`ServiceType`** — Un servicio ofertable, como «Reel» o «Video UGC». Está acotado por plataforma y además por un array `profileTypes` que indica a qué tipos de perfil aplica.

**`ProfileService`** — La tarifa. El precio se almacena como `Decimal(10,2)` para evitar errores de redondeo de coma flotante, y la moneda por defecto es `COP`.

**`Client`, `ClientContact`, `ClientUser`** — La empresa cliente, sus personas de contacto y, opcionalmente, sus credenciales para el portal de clientes.

### Dos detalles del modelo que conviene tener claros

**Las tarifas cuelgan de la cuenta social, no del perfil.** Un `ProfileService` es único por combinación de `socialAccountId` y `serviceTypeId`. Esto significa que un mismo servicio en Instagram y en TikTok son dos registros distintos, con precios independientes. Cualquier consulta que involucre precios tiene que atravesar `socialAccounts.services`.

**Un perfil de tipo `BOTH` no hereda los servicios de `INFLUENCER` y `UGC`.** El array `profileTypes` de cada `ServiceType` debe incluir `BOTH` explícitamente. Por eso [prisma/seed.ts](prisma/seed.ts) registra combinaciones como `[INFLUENCER, BOTH]` o `[UGC, BOTH]`.

### Borrados en cascada

Al eliminar un `Profile` se borran sus `SocialAccount` y, con ellas, sus `ProfileService`. Al eliminar un `Client` se borran sus `ClientContact` y su `ClientUser`.

En cambio `SocialPlatform`, `ServiceType` y `Category` nunca se borran en cascada: para eliminarlos hay que limpiar antes las referencias que apunten a ellos.

---

## Funcionalidades

### Área privada (todos los usuarios autenticados)

**Dashboard** (`/dashboard`) — Totales de perfiles, categorías y plataformas activas, más un listado de los perfiles añadidos recientemente.

**Perfiles** (`/profiles`) — El núcleo de la aplicación. Listado paginado con filtros por texto, país, ciudad, tipo de perfil, plataforma, categoría, tipo de servicio y rango de precios. Desde el menú de cada fila se puede ver el detalle en un panel lateral, editar, sincronizar métricas con Apify o eliminar (esto último solo administradores).

**Categorías** (`/categories`) — Alta, edición y borrado de las categorías temáticas que se asignan a los perfiles.

**Clientes** (`/clients`) — Cartera de empresas cliente, con NIT, email, contactos asociados y contacto principal. La columna «Estado Login» indica si esa empresa tiene credenciales activas para el portal de clientes.

### Panel de administración (solo rol `ADMIN`)

**Usuarios** (`/admin/users`) — Alta, edición y borrado de usuarios del sistema, con asignación de rol.

**Plataformas** (`/admin/platforms`) — Gestión de las redes sociales disponibles y su activación.

**Tipos de servicio** (`/admin/service-types`) — Gestión de los servicios ofertables por plataforma y tipo de perfil.

### Portal de clientes

Área independiente (`/client-login`, `/client-dashboard`) para que las empresas cliente consulten sus campañas. Los administradores generan las credenciales desde la ficha de cada cliente.

Es un **sistema de sesión aparte del de NextAuth**, que gobierna al personal interno. Un `ClientUser` no es un `User`: no tiene rol, no entra en `(app)` y solo ve lo suyo. Funciona así:

1. `POST /api/client-auth/login` valida con bcrypt contra `ClientUser` (rechaza los `isActive: false`) y emite una cookie `client-session`: un JWT `HS256` httpOnly, firmado con `NEXTAUTH_SECRET`, con emisor y audiencia propios y 30 días de vigencia.
2. `/client-dashboard` está en el matcher de [src/middleware.ts](src/middleware.ts) y lo atiende el callback `authorized`, que verifica esa cookie y redirige a `/client-login` si no vale. La página vuelve a validarla, porque de ahí sale el `clientId` con el que consulta.
3. `getCampaignsForClientPortal(clientId)` filtra por ese `clientId` y excluye los borradores. **Ese filtro es lo único que separa a un cliente de otro**, así que el `clientId` nunca debe salir de la petición, solo de la cookie firmada.
4. `POST /api/client-auth/logout` borra la cookie. Al ser httpOnly, el navegador no puede hacerlo por su cuenta.

Rotar `NEXTAUTH_SECRET` cierra también las sesiones de los clientes, no solo las del personal.

---

## Arquitectura

### Autenticación y roles

La autenticación del personal se configura en [src/lib/auth.ts](src/lib/auth.ts) mediante el proveedor de credenciales de NextAuth, con sesiones JWT. Los callbacks `jwt` y `session` inyectan el `id` y el `role` del usuario en la sesión, de forma que `session.user.role` está disponible tanto en servidor como en cliente.

Existen dos roles: `ADMIN` y `USER`. Los administradores acceden al panel de administración, pueden eliminar perfiles y gestionar los accesos de los clientes.

### Protección de rutas

La protección opera en **dos capas que no cubren las mismas rutas**:

1. [src/middleware.ts](src/middleware.ts) intercepta `/dashboard`, `/admin`, `/login` y `/register`.
2. El layout [src/app/(dashboard)/layout.tsx](src/app/(dashboard)/layout.tsx) ejecuta `await auth()` y redirige a `/login` si no hay sesión.

Como el grupo de rutas `(dashboard)` no añade segmento a la URL, páginas como `/profiles` o `/clients` **no pasan por el middleware** y dependen únicamente de la comprobación del layout. Una página nueva dentro de `(dashboard)` hereda esa protección; una página nueva en la raíz de `app/` no hereda ninguna.

El panel de administración comprueba el rol dos veces: en el middleware y en [src/app/admin/layout.tsx](src/app/admin/layout.tsx).

### Caché de consultas

[src/lib/cache.ts](src/lib/cache.ts) envuelve las consultas de lectura más frecuentes en `unstable_cache`, con una revalidación de 2 horas y etiquetas: `platforms`, `categories`, `service-types`, `profiles` y `profile`. Las páginas de servidor llaman a estas funciones en lugar de a Prisma directamente.

Las rutas que modifican datos invalidan la caché con `revalidateTag`. **Al añadir una consulta cacheada nueva hay que añadir su `revalidateTag` correspondiente en todas las rutas que escriban sobre esos datos**, o los cambios tardarán hasta 2 horas en verse.

### Integración con Apify

[src/lib/apify.ts](src/lib/apify.ts) usa los actores `apify/instagram-profile-scraper` y `clockworks/tiktok-profile-scraper`. La función `syncSocialAccountMetrics(plataforma, usuario)` normaliza las respuestas de ambos a los nombres de campo de `SocialAccount`.

Además de las métricas, **descarga la foto de perfil** y la guarda en `public/uploads/profiles/`, almacenando la ruta relativa en el campo `profilePicUrl`.

La sincronización se dispara en dos momentos: automáticamente al crear un perfil (`POST /api/profiles`, capturando los errores para que el alta no falle) y bajo demanda desde el botón de sincronizar (`POST /api/profiles/[id]/sync`).

El reparto por plataforma se hace comparando `platform.name` en minúsculas: una plataforma cuyo nombre no sea `instagram` o `tiktok` se omite silenciosamente.

### Patrón de las rutas de API

Todas siguen la misma secuencia: `await auth()` primero, `401` si no hay sesión, `403` si falla la comprobación de rol o propiedad, la operación, `revalidateTag` y la respuesta JSON.

En Next.js 16 los parámetros dinámicos son promesas, así que hay que esperarlos:

```ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

### Cliente de Prisma

[src/lib/prisma.ts](src/lib/prisma.ts) exporta una instancia única guardada en el objeto global, para que la recarga en caliente del servidor de desarrollo no agote el pool de conexiones creando clientes nuevos en cada cambio.

En [next.config.ts](next.config.ts), `@prisma/client` y `bcryptjs` están declarados como `serverExternalPackages` porque son paquetes nativos que no deben empaquetarse.

---

## Convenciones de desarrollo

### Formularios

Aunque `react-hook-form` y `zod` figuran en las dependencias y existe el componente [src/components/ui/form.tsx](src/components/ui/form.tsx), **ningún formulario del proyecto los utiliza**. Todos están construidos con `useState`, una llamada a `fetch` y `router.refresh()`. Conviene mantener ese estilo salvo que se decida migrar todos a la vez.

### Precios

Los precios circulan por los formularios como **cadenas de solo dígitos**. El componente [src/components/ui/price-input.tsx](src/components/ui/price-input.tsx) muestra el valor formateado (`1.000.000`, con punto como separador de miles según la convención colombiana) mediante `formatNumber` de [src/lib/format.ts](src/lib/format.ts), pero hacia el estado del formulario emite solo los dígitos. La conversión a número se hace al enviar.

### Estado en la URL

Los filtros, la paginación y el panel de detalle del listado de perfiles **guardan su estado en los parámetros de la URL**, no en estado local. El botón «Ver» añade `?view=<id>` y el componente `ProfileDetailSheet`, montado una sola vez en la página, lee ese parámetro y consulta `/api/profiles/[id]`.

Gracias a eso la página es un componente de servidor que lee `await searchParams`, y cualquier vista filtrada se puede compartir por enlace.

### Añadir una plataforma nueva

El sistema es dirigido por datos y no requiere cambios en el esquema:

1. Añadir la plataforma al array `platforms` de [prisma/seed.ts](prisma/seed.ts).
2. Añadir sus `ServiceType` en el mismo archivo, recordando incluir `BOTH` en `profileTypes` cuando corresponda.
3. Añadir el actor y su normalizador en [src/lib/apify.ts](src/lib/apify.ts), y la plataforma a las comprobaciones `platformName === ...` de las rutas de creación y sincronización.

---

## Estado actual y pendientes

Puntos que conviene conocer antes de trabajar sobre el código:

**El portal de clientes solo muestra campañas.** Ya tiene sesión propia y control de acceso (ver [Portal de clientes](#portal-de-clientes)), pero su alcance es deliberadamente corto: la empresa ve el listado de sus campañas que no están en borrador, y nada más. No hay detalle de campaña, ni informes, ni descarga de contenidos. Para aprobar o rechazar perfiles el cliente sigue usando el enlace con token de `/approve/[token]`, que es un flujo aparte y no requiere credenciales.

**La visibilidad de perfiles es incoherente entre la página y la API.** `getCachedProfiles()` en [src/lib/cache.ts](src/lib/cache.ts) devuelve deliberadamente **todos** los perfiles a cualquier usuario, y es la función que alimenta la página `/profiles`. En cambio `GET /api/profiles` filtra por `createdById` cuando el usuario no es administrador. Si se cambian las reglas de visibilidad hay que tocar ambos sitios o quedarán en desacuerdo.

**Las rutas de administración no invalidan su caché.** Los endpoints de plataformas, tipos de servicio, ubicaciones y géneros no llaman a `revalidateTag`, así que un cambio hecho desde el panel puede tardar hasta una hora (`cacheLife("hours")`) en reflejarse en los formularios y filtros. Reiniciar el servidor lo fuerza.

**Hay migraciones, pero el `db push` dejó secuelas.** `prisma/migrations` ya existe y el contenedor aplica `prisma migrate deploy` al arrancar. Conviene saber de dónde viene: durante un tiempo el esquema se sincronizó con `db push` y con SQL suelto en `prisma/sql/`, y eso dejó `CampaignBrief`, `Profile.email`, `Profile.phone` y `CampaignService.clientNotes` fuera del historial. Se recuperó en la migración `20260213000000_add_campaign_brief`. Si se vuelve a usar `db push` contra la base local, hay que generar la migración correspondiente antes de desplegar (ver el `migrate diff` de la sección de despliegue).

**Los archivos subidos no viven en `public/`.** Van al directorio de `UPLOADS_DIR` (`./uploads` en local, un volumen en producción) y se sirven por `/api/uploads/[...ruta]`. El motivo es que con `output: "standalone"` Next no entrega los archivos añadidos a `public/` después del build: devuelven 404 aunque estén en el disco. Vercel Blob sigue disponible como alternativa para las fotos de perfil si se define `BLOB_READ_WRITE_TOKEN`.

---

## Despliegue

La aplicación se despliega en un **servidor OVH gestionado con Dokploy**, con dos servicios: uno de PostgreSQL 17 con pgvector y otro para la app. La URL pública es `https://influencer-manager.losdemarketing.com`.

El repositorio ya trae todo lo necesario para construir la imagen:

| Archivo | Para qué sirve |
|---|---|
| `Dockerfile` | Imagen de producción en tres etapas (`deps` → `builder` → `runner`) sobre `node:22-alpine`. |
| `docker-entrypoint.sh` | Aplica `prisma migrate deploy` y luego arranca el servidor. |
| `.dockerignore` | Deja fuera del contexto los `.env`, `node_modules`, volcados SQL y notas. |
| `src/app/api/health/route.ts` | Sonda de salud pública en `/api/health`. |

### Cómo está construida la imagen

- `next.config.ts` usa `output: "standalone"`, así que la imagen final lleva `server.js` y solo las dependencias que Next rastreó, no `node_modules` entero.
- **Durante `docker build` no hay base de datos.** El `DATABASE_URL` de esa etapa es ficticio y ninguna página puede consultar la base al prerenderizarse. Si se añade una página estática que lea de la base, el build falla ahí. La solución es la de `src/app/brief/page.tsx`: aislar la consulta en un componente dentro de `<Suspense>` y llamar a `await connection()` antes de consultar. Con `cacheComponents` activado, el `<Suspense>` por sí solo **no** basta, porque Next ejecuta las funciones `"use cache"` en el build para precargarlas.
- Por la misma razón `export const dynamic = "force-dynamic"` está prohibido en este proyecto: `cacheComponents` lo rechaza y rompe el build. Se usa `connection()`.
- El CLI de Prisma se instala en una etapa aparte y viaja en `/app/prisma-cli`. No se puede copiar `node_modules/prisma` suelto: el CLI depende de paquetes que viven fuera de esa carpeta y el contenedor muere con `Cannot find module 'effect'`.
- El servidor escucha en `0.0.0.0:3000` (`HOSTNAME=0.0.0.0`). Si escuchara en `localhost`, Traefik no podría alcanzarlo.

### Migraciones

`docker-entrypoint.sh` ejecuta `prisma migrate deploy` en cada arranque, antes de levantar Next. Se puede desactivar con `RUN_MIGRATIONS=false`.

Las extensiones `vector` y `pg_trgm` las crea la primera migración, pero solo funcionan si la imagen de PostgreSQL las incluye (`pgvector/pgvector`). Con una imagen de Postgres pelada, la migración falla.

> **El historial de migraciones tiene que estar completo.** Durante un tiempo se trabajó con `db push` y con SQL suelto en `prisma/sql/`, y eso dejó `CampaignBrief`, `Profile.email`, `Profile.phone` y `CampaignService.clientNotes` fuera de las migraciones. Se corrigió en `20260213000000_add_campaign_brief`. Antes de desplegar un cambio de esquema conviene comprobar que no hay desviación:
>
> ```bash
> npx prisma migrate diff \
>   --from-migrations prisma/migrations \
>   --to-schema-datamodel prisma/schema.prisma \
>   --shadow-database-url "postgresql://postgres:devpass@localhost:5433/shadow_tmp" \
>   --exit-code
> ```
>
> Si devuelve SQL en vez de "No difference detected", falta una migración.

### Variables de entorno en Dokploy

Se cargan en el servicio de la app (**Environment**), nunca en un archivo dentro de la imagen. La lista completa y comentada está en `.env.example`.

| Variable | Valor en producción |
|---|---|
| `NEXTAUTH_URL` | `https://influencer-manager.losdemarketing.com` |
| `DATABASE_URL` | URL **interna** del servicio de Postgres en Dokploy |
| `NEXTAUTH_SECRET` | uno nuevo, distinto del de local |
| `AUTH_TRUST_HOST` | `true` — obligatorio detrás de Traefik |
| `APIFY_API_TOKEN` | el mismo que en local |
| `UPLOADS_DIR` | `/app/uploads` — ya fijado en el `Dockerfile`, solo hace falta el volumen |
| `ANTHROPIC_API_KEY` | solo si se quiere el asistente de campañas |
| `ENABLE_EMAILS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | solo si se quieren correos |

### Almacenamiento de archivos

Los archivos subidos —fotos de perfil que descarga Apify y adjuntos del formulario `/brief`— se guardan **en disco**, en el directorio que indica `UPLOADS_DIR` (`/app/uploads` en el contenedor, `./uploads` en local), y se entregan por la ruta `/api/uploads/[...ruta]`.

No se usa `public/` a propósito: con `output: "standalone"` **Next calcula el listado de `public/` durante el build**, así que un archivo escrito después responde 404 aunque esté en el disco. De ahí que haga falta una ruta propia que lo lea y lo devuelva.

Esa ruta es pública, igual que lo era el almacenamiento en Blob: las fotos de perfil se muestran en `/approve/[token]`, que el cliente abre sin sesión. Lo que protege un adjunto del brief es que su carpeta es un UUID aleatorio. La ruta normaliza el destino antes de leer y rechaza con 400 cualquier intento de salirse del directorio.

**En Dokploy hay que montar un volumen en `/app/uploads`**, o los archivos se pierden en cada redespliegue.

Queda como alternativa Vercel Blob: si se define `BLOB_READ_WRITE_TOKEN`, las fotos de perfil van allí en lugar de al disco.

### Configuración del servicio en Dokploy

1. Tipo de build: **Dockerfile** (en la raíz del repositorio).
2. Dominio: `influencer-manager.losdemarketing.com`, puerto interno **3000**, HTTPS con Let's Encrypt.
3. Sonda de salud apuntando a `/api/health`. Devuelve 503 si la base no responde, para que no entre tráfico durante un redespliegue.
4. Montar un volumen persistente en `/app/uploads`.

### Primer despliegue: datos iniciales

Las migraciones crean las tablas vacías. Falta cargar los datos de catálogo: usuario administrador, plataformas, tipos de servicio, categorías, géneros, ubicaciones y rangos de alcance.

El seed (`prisma/seed.ts`) está escrito en TypeScript y el proyecto lo ejecuta con `ts-node`, que es dependencia de desarrollo y no llega a la imagen. Por eso la imagen incluye `tsx`. Una vez desplegado, desde la consola del contenedor en Dokploy:

```bash
cd /app && SEED_DEMO=false node ./prisma-cli/node_modules/tsx/dist/cli.mjs prisma/seed.ts
```

El `cd /app` hace falta: la terminal de Dokploy abre en `/`, no en el `WORKDIR` de la imagen, y tanto la ruta de `tsx` como la de `seed.ts` son relativas. Por SSH con `docker exec` sí se entra directamente en `/app`, pero el `cd` no estorba.

**`SEED_DEMO=false` es importante:** sin esa variable el seed crea además perfiles, clientes y campañas inventados («María García», «Restaurante El Sabor»…), que son útiles en local pero no deben acabar en producción.

Se ejecuta una sola vez. Es idempotente en su mayor parte (usa `upsert`), pero no hay razón para repetirlo.

Justo después, **entrar y cambiar la contraseña del administrador sembrado** (`admin@example.com` / `admin123`).

### Flujo de trabajo con git

La rama principal es `main`, y es la que despliega Dokploy: lo que se integre ahí sale a producción. El desarrollo se hace en ramas aparte y se integra en `main` cuando está probado en local.

```bash
git checkout -b mi-funcionalidad
# ... cambios y pruebas en local ...
git add .
git commit -m "feat: descripción del cambio"
git push -u origin mi-funcionalidad
```

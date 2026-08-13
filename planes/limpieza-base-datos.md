# Plan: Limpieza de Base de Datos y Migración del Export

## Resumen

El archivo `prisma/database-export.sql` fue generado con el **esquema anterior** donde `Profile` tenía `country` y `city` como columnas de texto plano (ej: `'colombia'`, `'antioquia'`). El esquema actual usa relaciones normalizadas con tablas `Country`, `Department` y `City` mediante foreign keys (`countryId`, `departmentId`, `cityId`).

Este plan describe cómo limpiar la BD de pruebas y re-importar los datos adaptados al esquema actual.

---

## Diferencias detectadas entre el Export y el Schema Actual

### 1. Tabla `Profile` - Columnas de ubicación

| Export (viejo) | Schema actual |
|----------------|---------------|
| `country` TEXT (ej: `'colombia'`) | `countryId` FK → `Country` |
| `city` TEXT (ej: `'antioquia'`) | `departmentId` FK → `Department` |
| *(no existía)* | `cityId` FK → `City` (nullable) |

### 2. Tablas nuevas que no existen en el Export

| Tabla | Propósito | Datos |
|-------|-----------|-------|
| `Country` | Países (relación) | Colombia (CO) |
| `Department` | Departamentos de Colombia | 33 departamentos |
| `City` | Ciudades por departamento | Ciudades principales |
| `ReachRange` | Rangos de alcance por seguidores | nano, micro, mid, macro, mega |
| `ClientUser` | Login de clientes | Sin datos en export |

### 3. Columnas nuevas en `SocialAccount` (no en export)

| Columna | Tipo | Default |
|---------|------|---------|
| `embedding` | `vector(1536)` | NULL |
| `aiSummary` | `Text` | NULL |
| `aiMetadata` | `Json` | NULL |

> Estas columnas son nullable, no requieren datos en el import.

### 4. Mapeo de ubicación del export

Los valores de `city` en el export son realmente **departamentos** (slugs):

| Slug en export (`city`) | Departamento real | Código |
|-------------------------|-------------------|--------|
| `antioquia` | Antioquia | ANT |
| `valle-del-cauca` | Valle del Cauca | VAC |
| `bogota` | Bogotá D.C. | DC |
| `cesar` | Cesar | CES |
| `atlantico` | Atlántico | ATL |
| `magdalena` | Magdalena | MAG |
| `santander` | Santander | SAN |

---

## Estrategia de migración

### Opción A: Script SQL directo (Recomendada)

Crear un script `prisma/import-clean-data.sql` que:

1. Limpia todas las tablas (respetando orden de FK)
2. Inserta datos de referencia (Country, Department, City, ReachRange)
3. Inserta los datos del export con los IDs de ubicación ya mapeados
4. Verifica integridad

### Opción B: Reset completo + Seed + Import parcial

1. `npx prisma db push --force-reset` (borra todo y recrea)
2. `npx prisma db seed` (crea datos de referencia)
3. Ejecutar SQL modificado del export (sin Profile.country/city, con countryId/departmentId)

---

## Plan de implementación: Opción A

### Paso 1: Crear script de limpieza

**Archivo:** `prisma/import-clean-data.sql`

```sql
-- Desactivar FK checks
SET session_replication_role = 'replica';

-- ==========================================
-- FASE 1: Limpiar todas las tablas (en orden de dependencias)
-- ==========================================
TRUNCATE TABLE "CampaignService" CASCADE;
TRUNCATE TABLE "CampaignProfilePlatform" CASCADE;
TRUNCATE TABLE "CampaignProfile" CASCADE;
TRUNCATE TABLE "CampaignApprovalToken" CASCADE;
TRUNCATE TABLE "Campaign" CASCADE;
TRUNCATE TABLE "ProfileService" CASCADE;
TRUNCATE TABLE "ProfileCategory" CASCADE;
TRUNCATE TABLE "SocialAccount" CASCADE;
TRUNCATE TABLE "Profile" CASCADE;
TRUNCATE TABLE "ClientContact" CASCADE;
TRUNCATE TABLE "ClientUser" CASCADE;
TRUNCATE TABLE "Client" CASCADE;
TRUNCATE TABLE "ServiceType" CASCADE;
TRUNCATE TABLE "Category" CASCADE;
TRUNCATE TABLE "City" CASCADE;
TRUNCATE TABLE "Department" CASCADE;
TRUNCATE TABLE "Country" CASCADE;
TRUNCATE TABLE "ReachRange" CASCADE;
TRUNCATE TABLE "Gender" CASCADE;
TRUNCATE TABLE "User" CASCADE;
```

### Paso 2: Insertar datos de referencia

Los datos de referencia vienen del seed (`prisma/seed.ts`) pero deben estar en SQL para este script:

```sql
-- ==========================================
-- FASE 2: Datos de referencia (del seed)
-- ==========================================

-- Country
INSERT INTO "Country" (...) VALUES ('id_co', 'Colombia', 'CO', true, NOW());

-- Departments (33 departamentos de Colombia)
INSERT INTO "Department" (...) VALUES
  ('id_ant', 'Antioquia', 'ANT', true, NOW(), 'id_co'),
  ('id_dc',  'Bogotá D.C.', 'DC', true, NOW(), 'id_co'),
  ...;

-- Cities (principales)
INSERT INTO "City" (...) VALUES (...);

-- ReachRange
INSERT INTO "ReachRange" (...) VALUES
  ('rr_nano',  'nano',  'Nano Influencer',  0,      10000,   0.40, true, NOW()),
  ('rr_micro', 'micro', 'Micro Influencer', 10001,  50000,   0.35, true, NOW()),
  ('rr_mid',   'mid',   'Mid Influencer',   50001,  100000,  0.30, true, NOW()),
  ('rr_macro', 'macro', 'Macro Influencer', 100001, 500000,  0.25, true, NOW()),
  ('rr_mega',  'mega',  'Mega Influencer',  500001, NULL,    0.20, true, NOW());
```

### Paso 3: Transformar e insertar datos del export

Tomar cada INSERT del export y adaptar:

#### `Profile` — Cambio principal

**Antes (export):**
```sql
INSERT INTO "Profile" ("id", "name", "type", "country", "city", "createdAt", "updatedAt", "createdById", "genderId")
VALUES ('cmkx0gi0j...', 'Jenny Diosa', 'UGC', 'colombia', 'antioquia', ...);
```

**Después (adaptado):**
```sql
INSERT INTO "Profile" ("id", "name", "type", "countryId", "departmentId", "cityId", "createdAt", "updatedAt", "createdById", "genderId")
VALUES ('cmkx0gi0j...', 'Jenny Diosa', 'UGC', 'id_co', 'id_ant', NULL, ...);
```

#### Mapeo de slugs a IDs de departamento

```
'antioquia'      → departmentId del departamento 'Antioquia'
'valle-del-cauca' → departmentId del departamento 'Valle del Cauca'
'bogota'         → departmentId del departamento 'Bogotá D.C.'
'cesar'          → departmentId del departamento 'Cesar'
'atlantico'      → departmentId del departamento 'Atlántico'
'magdalena'      → departmentId del departamento 'Magdalena'
'santander'      → departmentId del departamento 'Santander'
```

#### Resto de tablas — Sin cambios

Las siguientes tablas del export se insertan **tal cual** (sin modificaciones):

- `User`
- `Gender`
- `SocialPlatform` (ya existe en seed, verificar conflictos)
- `Category`
- `Client`
- `ClientContact`
- `ServiceType`
- `SocialAccount` (nuevas columnas `embedding`, `aiSummary`, `aiMetadata` son NULL por default)
- `ProfileCategory`
- `ProfileService`
- `Campaign`
- `CampaignApprovalToken`
- `CampaignProfile`
- `CampaignProfilePlatform`
- `CampaignService`

### Paso 4: Reactivar FK y verificar

```sql
-- Reactivar restricciones
SET session_replication_role = 'origin';

-- Verificar integridad
SELECT 'Profiles sin country' AS check, COUNT(*) FROM "Profile" WHERE "countryId" IS NULL;
SELECT 'Profiles sin department' AS check, COUNT(*) FROM "Profile" WHERE "departmentId" IS NULL;
```

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `prisma/import-clean-data.sql` | **CREAR** - Script completo de limpieza + import |
| `prisma/database-export.sql` | **ACTUALIZAR** - Regenerar con schema actual (opcional, para futuro) |

---

## Datos del export a migrar

| Tabla | Registros | Notas |
|-------|-----------|-------|
| `User` | 3 | admin + 2 usuarios |
| `Gender` | 2 | Masculino, Femenino |
| `SocialPlatform` | 2 | Instagram, TikTok |
| `Category` | 10 | Foodie, Tecnología, Moda, etc. |
| `Client` | 1 | AUTECO TVS |
| `ClientContact` | 1 | Valeria Dominguez |
| `ServiceType` | 9 | Reel, TikTok, Story, etc. |
| `Profile` | 25 | 17 INFLUENCER, 3 UGC, 5 mixtos |
| `ProfileCategory` | 41 | Relaciones perfil-categoría |
| `SocialAccount` | 48 | Cuentas de Instagram y TikTok |
| `ProfileService` | 83 | Precios por servicio |
| `Campaign` | 3 | 1 CANCELLED, 2 DRAFT |
| `CampaignApprovalToken` | 1 | Token usado |
| `CampaignProfile` | 37 | Perfiles en campañas |
| `CampaignProfilePlatform` | 37 | Plataformas en campañas |
| `CampaignService` | 30 | Servicios en campañas |

---

## Consideraciones

### Campañas CANCELLED
La campaña `'CAMPAÑA FEBRERO'` está en estado CANCELLED. Se puede incluir o excluir según se desee una BD limpia.

### SocialPlatform duplicados
El seed y el export ambos insertan Instagram y TikTok. Usar `ON CONFLICT DO NOTHING` o insertarlos solo una vez en el script.

### Contraseñas de usuarios
Los hashes de contraseñas del export se conservan. Si se necesitan cambiar, actualizar después del import.

### Fotos de perfil (Blob URLs)
Las `profilePicUrl` apuntan a `*.public.blob.vercel-storage.com`. Estas URLs siguen siendo válidas si el blob storage no se ha limpiado.

### Datos de IA (embedding/aiSummary/aiMetadata)
Se pierden al limpiar. Si existían embeddings previos, se necesitará re-procesar con el servicio de IA.

---

## Orden de ejecución

1. Verificar que el schema actual está sincronizado: `npx prisma db push`
2. Hacer backup de la BD actual (opcional): `pg_dump`
3. Ejecutar `prisma/import-clean-data.sql` contra la BD
4. Verificar con `npx prisma studio` que los datos se ven correctos
5. Opcionalmente regenerar `database-export.sql` con el schema actual para futuros imports

---

## Script de generación automática (alternativa)

En vez de escribir el SQL a mano, crear un script en TypeScript que:

1. Lee `database-export.sql`
2. Parsea cada INSERT
3. Transforma los de `Profile` (mapea country/city → countryId/departmentId)
4. Genera un nuevo SQL compatible con el schema actual
5. Incluye las tablas de referencia (Country, Department, City, ReachRange)

**Archivo:** `prisma/scripts/transform-export.ts`

```typescript
// 1. Leer database-export.sql
// 2. Para cada INSERT de Profile:
//    - Extraer country y city
//    - Buscar en DEPT_MAP el departmentId correspondiente
//    - Reemplazar columnas country/city por countryId/departmentId/cityId
// 3. Agregar INSERTs de Country, Department, City, ReachRange
// 4. Escribir nuevo archivo import-clean-data.sql
```

Esto permitiría re-ejecutar la transformación si el export cambia en el futuro.

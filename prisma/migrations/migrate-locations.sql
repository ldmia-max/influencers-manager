-- ============================================================
-- Migración: country/city (strings) → countryId/departmentId/cityId (FK)
--
-- EJECUTAR ANTES de `npx prisma db push`
--
-- Contexto:
--   - Producción tiene columnas "country" (string: 'colombia') y "city" (string: 'antioquia')
--   - El nuevo schema usa relaciones: countryId → Country, departmentId → Department, cityId → City
--   - Lo que estaba en "city" realmente son departamentos (no ciudades)
--
-- Pasos:
--   1. Crear tablas Country, Department, City (si no existen)
--   2. Poblar con datos de Colombia
--   3. Agregar columnas FK a Profile (si no existen)
--   4. Mapear datos viejos → nuevos FK
--   5. Eliminar columnas string viejas
--
-- Después de ejecutar este script, correr:
--   npx prisma db push   (sincroniza el resto del schema)
--   npx prisma db seed   (pobla datos faltantes)
-- ============================================================

BEGIN;

-- ============================================================
-- PASO 1: Crear tablas de ubicación geográfica (si no existen)
-- ============================================================

CREATE TABLE IF NOT EXISTS "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Country_name_key" ON "Country"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Country_code_key" ON "Country"("code");

CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countryId" TEXT NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_countryId_key" ON "Department"("name", "countryId");

CREATE TABLE IF NOT EXISTS "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "City_name_departmentId_key" ON "City"("name", "departmentId");

-- FK constraints para las tablas de ubicación
DO $$ BEGIN
    ALTER TABLE "Department" ADD CONSTRAINT "Department_countryId_fkey"
        FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "City" ADD CONSTRAINT "City_departmentId_fkey"
        FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PASO 2: Poblar País Colombia y sus Departamentos
-- ============================================================

-- Insertar Colombia (si no existe)
INSERT INTO "Country" ("id", "name", "code", "isActive")
VALUES ('mig_country_co', 'Colombia', 'CO', true)
ON CONFLICT ("code") DO NOTHING;

-- Obtener el ID real de Colombia (puede ser el que ya existía)
-- Usamos una tabla temporal para almacenar el mapeo
CREATE TEMP TABLE _country_map AS
SELECT "id" AS country_id FROM "Country" WHERE "code" = 'CO';

-- Insertar departamentos de Colombia (solo los que existen en los datos de producción + los del seed)
-- Usamos ON CONFLICT para no duplicar
INSERT INTO "Department" ("id", "name", "code", "isActive", "countryId")
SELECT
    'mig_dept_' || code,
    name,
    code,
    true,
    (SELECT country_id FROM _country_map LIMIT 1)
FROM (VALUES
    ('Amazonas', 'AMA'),
    ('Antioquia', 'ANT'),
    ('Arauca', 'ARA'),
    ('Atlántico', 'ATL'),
    ('Bogotá D.C.', 'DC'),
    ('Bolívar', 'BOL'),
    ('Boyacá', 'BOY'),
    ('Caldas', 'CAL'),
    ('Caquetá', 'CAQ'),
    ('Casanare', 'CAS'),
    ('Cauca', 'CAU'),
    ('Cesar', 'CES'),
    ('Chocó', 'CHO'),
    ('Córdoba', 'COR'),
    ('Cundinamarca', 'CUN'),
    ('Guainía', 'GUA'),
    ('Guaviare', 'GUV'),
    ('Huila', 'HUI'),
    ('La Guajira', 'LAG'),
    ('Magdalena', 'MAG'),
    ('Meta', 'MET'),
    ('Nariño', 'NAR'),
    ('Norte de Santander', 'NSA'),
    ('Putumayo', 'PUT'),
    ('Quindío', 'QUI'),
    ('Risaralda', 'RIS'),
    ('San Andrés y Providencia', 'SAP'),
    ('Santander', 'SAN'),
    ('Sucre', 'SUC'),
    ('Tolima', 'TOL'),
    ('Valle del Cauca', 'VAC'),
    ('Vaupés', 'VAU'),
    ('Vichada', 'VIC')
) AS depts(name, code)
ON CONFLICT ("name", "countryId") DO NOTHING;

-- ============================================================
-- PASO 3: Crear tabla temporal de mapeo slug → departmentId
-- ============================================================

-- Mapeo de los slugs que existen en producción al nombre real del departamento
CREATE TEMP TABLE _dept_slug_map (
    slug TEXT,
    dept_name TEXT
);

INSERT INTO _dept_slug_map (slug, dept_name) VALUES
    ('antioquia', 'Antioquia'),
    ('valle-del-cauca', 'Valle del Cauca'),
    ('bogota', 'Bogotá D.C.'),
    ('cesar', 'Cesar'),
    ('atlantico', 'Atlántico'),
    ('magdalena', 'Magdalena'),
    ('santander', 'Santander');

-- ============================================================
-- PASO 4: Agregar columnas FK a Profile (si no existen)
-- ============================================================

DO $$ BEGIN
    ALTER TABLE "Profile" ADD COLUMN "countryId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Profile" ADD COLUMN "departmentId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Profile" ADD COLUMN "cityId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- PASO 5: Migrar datos - mapear strings a FK
-- ============================================================

-- 5a. Mapear country = 'colombia' → countryId
UPDATE "Profile" p
SET "countryId" = c.country_id
FROM _country_map c
WHERE LOWER(p."country") = 'colombia'
  AND p."countryId" IS NULL;

-- 5b. Mapear city (slug) → departmentId
UPDATE "Profile" p
SET "departmentId" = d."id"
FROM _dept_slug_map m
JOIN "Department" d ON d."name" = m.dept_name
    AND d."countryId" = (SELECT country_id FROM _country_map LIMIT 1)
WHERE LOWER(p."city") = m.slug
  AND p."departmentId" IS NULL;

-- 5c. cityId queda en NULL (no hay granularidad de ciudad en datos viejos)
-- (ya es NULL por default al agregar la columna)

-- ============================================================
-- PASO 6: Verificar migración antes de eliminar columnas
-- ============================================================

-- Mostrar perfiles que NO se pudieron mapear (para revisión manual)
DO $$
DECLARE
    unmapped_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmapped_count
    FROM "Profile"
    WHERE "country" IS NOT NULL
      AND "countryId" IS NULL;

    IF unmapped_count > 0 THEN
        RAISE NOTICE '⚠️  % perfiles tienen country pero NO se mapeó countryId', unmapped_count;
    ELSE
        RAISE NOTICE '✓ Todos los perfiles con country fueron mapeados a countryId';
    END IF;

    SELECT COUNT(*) INTO unmapped_count
    FROM "Profile"
    WHERE "city" IS NOT NULL
      AND "departmentId" IS NULL;

    IF unmapped_count > 0 THEN
        RAISE NOTICE '⚠️  % perfiles tienen city pero NO se mapeó departmentId', unmapped_count;
    ELSE
        RAISE NOTICE '✓ Todos los perfiles con city fueron mapeados a departmentId';
    END IF;
END $$;

-- ============================================================
-- PASO 7: Agregar FK constraints a Profile (si no existen)
-- ============================================================

DO $$ BEGIN
    ALTER TABLE "Profile" ADD CONSTRAINT "Profile_countryId_fkey"
        FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Profile" ADD CONSTRAINT "Profile_departmentId_fkey"
        FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Profile" ADD CONSTRAINT "Profile_cityId_fkey"
        FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PASO 8: Eliminar columnas string viejas
-- ============================================================

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "country";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "city";

-- Limpiar tablas temporales
DROP TABLE IF EXISTS _country_map;
DROP TABLE IF EXISTS _dept_slug_map;

COMMIT;

-- ============================================================
-- Resumen:
--   ✓ Tablas Country, Department, City creadas y pobladas
--   ✓ Perfiles migrados: country → countryId, city → departmentId
--   ✓ cityId dejado en NULL (sin granularidad en datos anteriores)
--   ✓ Columnas viejas (country, city) eliminadas
--
-- Siguiente paso:
--   npx prisma db push     (sincronizar schema completo)
--   npx prisma db seed     (poblar ciudades y datos faltantes)
-- ============================================================

/**
 * Script de migración: country/city (strings) → countryId/departmentId/cityId (FK)
 *
 * Ejecuta el SQL de migración y verifica los resultados.
 *
 * Uso:
 *   npx tsx scripts/migrate-locations.ts
 *
 * Después de ejecutar:
 *   npx prisma db push
 *   npx prisma db seed
 */

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Iniciando migración de ubicaciones...\n");

  // Verificar si las columnas viejas existen
  const oldColumnsExist = await checkOldColumnsExist();
  if (!oldColumnsExist) {
    console.log("ℹ️  Las columnas 'country' y 'city' ya no existen en Profile.");
    console.log("   La migración ya fue ejecutada o no es necesaria.");

    // Verificar estado actual
    await printCurrentState();
    return;
  }

  // Mostrar datos antes de migrar
  console.log("📊 Estado actual de la base de datos:");
  await printOldData();

  // Ejecutar SQL de migración
  console.log("\n🔧 Ejecutando migración SQL...\n");
  const sqlPath = join(__dirname, "..", "prisma", "migrations", "migrate-locations.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  // Ejecutar el SQL statement by statement (Prisma no soporta multi-statement)
  // En su lugar, ejecutamos las operaciones con Prisma directamente

  await migrateWithPrisma();

  // Verificar resultado
  console.log("\n📊 Estado después de migración:");
  await printCurrentState();

  console.log("\n✅ Migración completada exitosamente.");
  console.log("\nSiguientes pasos:");
  console.log("  1. npx prisma db push    (sincronizar schema)");
  console.log("  2. npx prisma db seed    (poblar ciudades y datos faltantes)");
}

async function checkOldColumnsExist(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'Profile'
        AND column_name IN ('country', 'city')
    `;
    return Number(result[0].count) > 0;
  } catch {
    return false;
  }
}

async function printOldData() {
  try {
    const profiles = await prisma.$queryRaw<
      { id: string; name: string; country: string | null; city: string | null }[]
    >`SELECT "id", "name", "country", "city" FROM "Profile" ORDER BY "name"`;

    console.log(`  Total perfiles: ${profiles.length}`);

    const countryCounts: Record<string, number> = {};
    const cityCounts: Record<string, number> = {};

    for (const p of profiles) {
      const country = p.country || "(null)";
      const city = p.city || "(null)";
      countryCounts[country] = (countryCounts[country] || 0) + 1;
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }

    console.log("  Valores de country:", countryCounts);
    console.log("  Valores de city:", cityCounts);
  } catch (error) {
    console.log("  (No se pudieron leer datos antiguos)");
  }
}

async function printCurrentState() {
  const profiles = await prisma.$queryRaw<
    {
      name: string;
      countryId: string | null;
      departmentId: string | null;
      cityId: string | null;
    }[]
  >`SELECT "name", "countryId", "departmentId", "cityId" FROM "Profile" ORDER BY "name"`;

  const withCountry = profiles.filter((p) => p.countryId).length;
  const withDept = profiles.filter((p) => p.departmentId).length;
  const withCity = profiles.filter((p) => p.cityId).length;

  console.log(`  Total perfiles: ${profiles.length}`);
  console.log(`  Con countryId: ${withCountry}`);
  console.log(`  Con departmentId: ${withDept}`);
  console.log(`  Con cityId: ${withCity}`);
}

// Mapeo de slugs de producción a nombres de departamento
const DEPT_SLUG_MAP: Record<string, string> = {
  antioquia: "Antioquia",
  "valle-del-cauca": "Valle del Cauca",
  bogota: "Bogotá D.C.",
  cesar: "Cesar",
  atlantico: "Atlántico",
  magdalena: "Magdalena",
  santander: "Santander",
};

// Todos los departamentos de Colombia para el seed
const COLOMBIA_DEPARTMENTS = [
  { name: "Amazonas", code: "AMA" },
  { name: "Antioquia", code: "ANT" },
  { name: "Arauca", code: "ARA" },
  { name: "Atlántico", code: "ATL" },
  { name: "Bogotá D.C.", code: "DC" },
  { name: "Bolívar", code: "BOL" },
  { name: "Boyacá", code: "BOY" },
  { name: "Caldas", code: "CAL" },
  { name: "Caquetá", code: "CAQ" },
  { name: "Casanare", code: "CAS" },
  { name: "Cauca", code: "CAU" },
  { name: "Cesar", code: "CES" },
  { name: "Chocó", code: "CHO" },
  { name: "Córdoba", code: "COR" },
  { name: "Cundinamarca", code: "CUN" },
  { name: "Guainía", code: "GUA" },
  { name: "Guaviare", code: "GUV" },
  { name: "Huila", code: "HUI" },
  { name: "La Guajira", code: "LAG" },
  { name: "Magdalena", code: "MAG" },
  { name: "Meta", code: "MET" },
  { name: "Nariño", code: "NAR" },
  { name: "Norte de Santander", code: "NSA" },
  { name: "Putumayo", code: "PUT" },
  { name: "Quindío", code: "QUI" },
  { name: "Risaralda", code: "RIS" },
  { name: "San Andrés y Providencia", code: "SAP" },
  { name: "Santander", code: "SAN" },
  { name: "Sucre", code: "SUC" },
  { name: "Tolima", code: "TOL" },
  { name: "Valle del Cauca", code: "VAC" },
  { name: "Vaupés", code: "VAU" },
  { name: "Vichada", code: "VIC" },
];

async function migrateWithPrisma() {
  // 1. Crear o encontrar Colombia
  console.log("  1/5 Creando país Colombia...");
  let colombia = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Country" WHERE "code" = 'CO'
  `;

  if (colombia.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "Country" ("id", "name", "code", "isActive")
      VALUES (gen_random_uuid()::text, 'Colombia', 'CO', true)
    `;
    colombia = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Country" WHERE "code" = 'CO'
    `;
  }
  const colombiaId = colombia[0].id;
  console.log(`    → Colombia ID: ${colombiaId}`);

  // 2. Crear departamentos
  console.log("  2/5 Creando departamentos...");
  for (const dept of COLOMBIA_DEPARTMENTS) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Department"
      WHERE "name" = ${dept.name} AND "countryId" = ${colombiaId}
    `;
    if (existing.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO "Department" ("id", "name", "code", "isActive", "countryId")
        VALUES (gen_random_uuid()::text, ${dept.name}, ${dept.code}, true, ${colombiaId})
      `;
    }
  }
  console.log(`    → ${COLOMBIA_DEPARTMENTS.length} departamentos verificados`);

  // 3. Agregar columnas FK si no existen
  console.log("  3/5 Verificando columnas FK en Profile...");
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Profile" ADD COLUMN "countryId" TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Profile" ADD COLUMN "departmentId" TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Profile" ADD COLUMN "cityId" TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);

  // 4. Mapear datos
  console.log("  4/5 Migrando datos de perfiles...");

  // 4a. country = 'colombia' → countryId
  const countryUpdated = await prisma.$executeRaw`
    UPDATE "Profile"
    SET "countryId" = ${colombiaId}
    WHERE LOWER("country") = 'colombia'
      AND "countryId" IS NULL
  `;
  console.log(`    → ${countryUpdated} perfiles mapeados country → countryId`);

  // 4b. city (slug) → departmentId
  let deptUpdated = 0;
  for (const [slug, deptName] of Object.entries(DEPT_SLUG_MAP)) {
    const dept = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Department"
      WHERE "name" = ${deptName} AND "countryId" = ${colombiaId}
    `;
    if (dept.length > 0) {
      const count = await prisma.$executeRaw`
        UPDATE "Profile"
        SET "departmentId" = ${dept[0].id}
        WHERE LOWER("city") = ${slug}
          AND "departmentId" IS NULL
      `;
      if (Number(count) > 0) {
        console.log(`    → ${count} perfiles: '${slug}' → ${deptName}`);
        deptUpdated += Number(count);
      }
    }
  }
  console.log(`    → Total: ${deptUpdated} perfiles mapeados city → departmentId`);

  // 5. Verificar no mapeados
  const unmappedCountry = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Profile"
    WHERE "country" IS NOT NULL AND "countryId" IS NULL
  `;
  const unmappedCity = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Profile"
    WHERE "city" IS NOT NULL AND "departmentId" IS NULL
  `;

  if (Number(unmappedCountry[0].count) > 0) {
    console.log(`\n  ⚠️  ${unmappedCountry[0].count} perfiles con country sin mapear:`);
    const unmapped = await prisma.$queryRaw<{ name: string; country: string }[]>`
      SELECT "name", "country" FROM "Profile"
      WHERE "country" IS NOT NULL AND "countryId" IS NULL
    `;
    for (const p of unmapped) {
      console.log(`    - ${p.name}: country='${p.country}'`);
    }
  }

  if (Number(unmappedCity[0].count) > 0) {
    console.log(`\n  ⚠️  ${unmappedCity[0].count} perfiles con city sin mapear:`);
    const unmapped = await prisma.$queryRaw<{ name: string; city: string }[]>`
      SELECT "name", "city" FROM "Profile"
      WHERE "city" IS NOT NULL AND "departmentId" IS NULL
    `;
    for (const p of unmapped) {
      console.log(`    - ${p.name}: city='${p.city}'`);
    }
    console.log("\n  Agrega los mapeos faltantes en DEPT_SLUG_MAP y vuelve a ejecutar.");
    throw new Error("Hay perfiles sin mapear. Revisa los slugs faltantes.");
  }

  // 6. Agregar FK constraints
  console.log("  5/5 Agregando constraints y eliminando columnas viejas...");
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Profile" ADD CONSTRAINT "Profile_countryId_fkey"
        FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Profile" ADD CONSTRAINT "Profile_departmentId_fkey"
        FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Profile" ADD CONSTRAINT "Profile_cityId_fkey"
        FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // 7. Eliminar columnas viejas
  await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" DROP COLUMN IF EXISTS "country"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" DROP COLUMN IF EXISTS "city"`);
  console.log("    → Columnas 'country' y 'city' eliminadas");
}

main()
  .catch((e) => {
    console.error("\n❌ Error en la migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

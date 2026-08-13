import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

/**
 * Divide SQL en statements individuales respetando strings con comillas simples.
 * 1. Elimina líneas de comentario (-- ...) fuera de strings
 * 2. Divide por ; fuera de strings
 */
function splitSqlStatements(sql: string): string[] {
  // Paso 1: Eliminar líneas que son solo comentarios (fuera de strings)
  // Procesamos línea por línea rastreando si estamos dentro de un string
  const lines = sql.split("\n");
  const cleanLines: string[] = [];
  let inString = false;

  for (const line of lines) {
    if (!inString && line.trim().startsWith("--")) {
      // Línea de comentario fuera de string → saltar
      continue;
    }
    cleanLines.push(line);
    // Rastrear si terminamos dentro de un string
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "'" ) {
        if (inString && i + 1 < line.length && line[i + 1] === "'") {
          i++; // Comilla escapada ''
        } else {
          inString = !inString;
        }
      }
    }
  }

  const cleanSql = cleanLines.join("\n");

  // Paso 2: Dividir por ; fuera de strings
  const statements: string[] = [];
  let current = "";
  inString = false;

  for (let i = 0; i < cleanSql.length; i++) {
    const ch = cleanSql[i];

    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      if (i + 1 < cleanSql.length && cleanSql[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (ch === ";" && !inString) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

async function main() {
  const sqlPath = path.join(__dirname, "..", "import-clean-data.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Separar las verificaciones SELECT del resto
  const importSql = sql.split("SET session_replication_role = 'origin'")[0];

  const statements = splitSqlStatements(importSql);

  console.log(`Ejecutando import de datos (${statements.length} statements)...\n`);

  // Ejecutar dentro de una transacción
  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.substring(0, 90).replace(/\n/g, " ");
        try {
          await tx.$executeRawUnsafe(stmt);
          // Progreso cada 50 statements
          if ((i + 1) % 50 === 0) {
            console.log(`  ... ${i + 1}/${statements.length} completados`);
          }
        } catch (e: any) {
          console.error(`\nError en statement ${i + 1}/${statements.length}:`);
          console.error(`  SQL: ${preview}...`);
          console.error(`  Error: ${e.message}`);
          throw e;
        }
      }
    },
    { timeout: 300000, maxWait: 10000 }
  );

  console.log("Datos importados correctamente\n");

  // Reactivar FK
  await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin'`);

  // Ejecutar verificaciones
  console.log("Verificacion de integridad:\n");

  const checks = [
    { label: "Profiles sin country", query: `SELECT COUNT(*) as count FROM "Profile" WHERE "countryId" IS NULL` },
    { label: "Profiles sin department", query: `SELECT COUNT(*) as count FROM "Profile" WHERE "departmentId" IS NULL` },
    { label: "Total profiles", query: `SELECT COUNT(*) as count FROM "Profile"` },
    { label: "Total social accounts", query: `SELECT COUNT(*) as count FROM "SocialAccount"` },
    { label: "Total profile services", query: `SELECT COUNT(*) as count FROM "ProfileService"` },
    { label: "Total campaigns", query: `SELECT COUNT(*) as count FROM "Campaign"` },
    { label: "Total campaign profiles", query: `SELECT COUNT(*) as count FROM "CampaignProfile"` },
    { label: "Total departments", query: `SELECT COUNT(*) as count FROM "Department"` },
    { label: "Total cities", query: `SELECT COUNT(*) as count FROM "City"` },
    { label: "Total countries", query: `SELECT COUNT(*) as count FROM "Country"` },
    { label: "Total reach ranges", query: `SELECT COUNT(*) as count FROM "ReachRange"` },
  ];

  for (const check of checks) {
    const result: any[] = await prisma.$queryRawUnsafe(check.query);
    const count = Number(result[0].count);
    const icon = check.label.includes("sin") ? (count === 0 ? "OK" : "FAIL") : "-";
    console.log(`  [${icon}] ${check.label}: ${count}`);
  }

  console.log("\nImport completado exitosamente!");
}

main()
  .catch((e) => {
    console.error("Error durante el import:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

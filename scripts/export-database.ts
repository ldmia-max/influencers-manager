import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  if (typeof value === "object") {
    // Handle Decimal and arrays
    if (Array.isArray(value)) {
      return `ARRAY[${value.map((v) => `'${v}'`).join(", ")}]`;
    }
    // Prisma Decimal
    return `'${value.toString()}'`;
  }
  // String - escape single quotes
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function generateInsert(tableName: string, records: Record<string, unknown>[]): string {
  if (records.length === 0) return "";

  let sql = `-- ${tableName}\n`;

  for (const record of records) {
    const columns = Object.keys(record);
    const values = columns.map((col) => escapeValue(record[col]));
    sql += `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});\n`;
  }

  return sql + "\n";
}

async function exportDatabase() {
  console.log("Exportando base de datos...\n");

  let sql = `-- Exportación de base de datos
-- Fecha: ${new Date().toISOString()}
-- Generado por: export-database.ts

-- Desactivar restricciones de foreign key temporalmente
SET session_replication_role = 'replica';

`;

  // Exportar en orden de dependencias (tablas sin FK primero)

  // 1. Users
  console.log("Exportando Users...");
  const users = await prisma.user.findMany();
  sql += generateInsert("User", users as unknown as Record<string, unknown>[]);

  // 2. Genders
  console.log("Exportando Genders...");
  const genders = await prisma.gender.findMany();
  sql += generateInsert("Gender", genders as unknown as Record<string, unknown>[]);

  // 3. Countries
  console.log("Exportando Countries...");
  const countries = await prisma.country.findMany();
  sql += generateInsert("Country", countries as unknown as Record<string, unknown>[]);

  // 4. Departments
  console.log("Exportando Departments...");
  const departments = await prisma.department.findMany();
  sql += generateInsert("Department", departments as unknown as Record<string, unknown>[]);

  // 5. Cities
  console.log("Exportando Cities...");
  const cities = await prisma.city.findMany();
  sql += generateInsert("City", cities as unknown as Record<string, unknown>[]);

  // 6. ReachRanges
  console.log("Exportando ReachRanges...");
  const reachRanges = await prisma.reachRange.findMany();
  sql += generateInsert("ReachRange", reachRanges as unknown as Record<string, unknown>[]);

  // 7. SocialPlatforms
  console.log("Exportando SocialPlatforms...");
  const platforms = await prisma.socialPlatform.findMany();
  sql += generateInsert("SocialPlatform", platforms as unknown as Record<string, unknown>[]);

  // 8. Categories
  console.log("Exportando Categories...");
  const categories = await prisma.category.findMany();
  sql += generateInsert("Category", categories as unknown as Record<string, unknown>[]);

  // 9. Clients
  console.log("Exportando Clients...");
  const clients = await prisma.client.findMany();
  sql += generateInsert("Client", clients as unknown as Record<string, unknown>[]);

  // 10. ClientContacts
  console.log("Exportando ClientContacts...");
  const clientContacts = await prisma.clientContact.findMany();
  sql += generateInsert("ClientContact", clientContacts as unknown as Record<string, unknown>[]);

  // 11. ClientUsers
  console.log("Exportando ClientUsers...");
  const clientUsers = await prisma.clientUser.findMany();
  sql += generateInsert("ClientUser", clientUsers as unknown as Record<string, unknown>[]);

  // 12. ServiceTypes
  console.log("Exportando ServiceTypes...");
  const serviceTypes = await prisma.serviceType.findMany();
  sql += generateInsert("ServiceType", serviceTypes as unknown as Record<string, unknown>[]);

  // 13. Profiles
  console.log("Exportando Profiles...");
  const profiles = await prisma.profile.findMany({ omit: { email: true } });
  sql += generateInsert("Profile", profiles as unknown as Record<string, unknown>[]);

  // 14. ProfileCategories
  console.log("Exportando ProfileCategories...");
  const profileCategories = await prisma.profileCategory.findMany();
  sql += generateInsert("ProfileCategory", profileCategories as unknown as Record<string, unknown>[]);

  // 15. SocialAccounts
  console.log("Exportando SocialAccounts...");
  const socialAccounts = await prisma.socialAccount.findMany();
  sql += generateInsert("SocialAccount", socialAccounts as unknown as Record<string, unknown>[]);

  // 16. ProfileServices
  console.log("Exportando ProfileServices...");
  const profileServices = await prisma.profileService.findMany();
  sql += generateInsert("ProfileService", profileServices as unknown as Record<string, unknown>[]);

  // 17. Campaigns
  console.log("Exportando Campaigns...");
  const campaigns = await prisma.campaign.findMany();
  sql += generateInsert("Campaign", campaigns as unknown as Record<string, unknown>[]);

  // 18. CampaignApprovalTokens
  console.log("Exportando CampaignApprovalTokens...");
  const approvalTokens = await prisma.campaignApprovalToken.findMany();
  sql += generateInsert("CampaignApprovalToken", approvalTokens as unknown as Record<string, unknown>[]);

  // 19. CampaignProfiles
  console.log("Exportando CampaignProfiles...");
  const campaignProfiles = await prisma.campaignProfile.findMany();
  sql += generateInsert("CampaignProfile", campaignProfiles as unknown as Record<string, unknown>[]);

  // 20. CampaignProfilePlatforms
  console.log("Exportando CampaignProfilePlatforms...");
  const campaignProfilePlatforms = await prisma.campaignProfilePlatform.findMany();
  sql += generateInsert("CampaignProfilePlatform", campaignProfilePlatforms as unknown as Record<string, unknown>[]);

  // 21. CampaignServices
  console.log("Exportando CampaignServices...");
  const campaignServices = await prisma.campaignService.findMany();
  sql += generateInsert("CampaignService", campaignServices as unknown as Record<string, unknown>[]);

  // Reactivar restricciones
  sql += `
-- Reactivar restricciones de foreign key
SET session_replication_role = 'origin';
`;

  // Guardar archivo
  const outputPath = path.join(process.cwd(), "database-export.sql");
  fs.writeFileSync(outputPath, sql, "utf-8");

  console.log(`\n✓ Exportación completada: ${outputPath}`);

  // Mostrar resumen
  console.log("\nResumen:");
  console.log(`  Users: ${users.length}`);
  console.log(`  Genders: ${genders.length}`);
  console.log(`  Countries: ${countries.length}`);
  console.log(`  Departments: ${departments.length}`);
  console.log(`  Cities: ${cities.length}`);
  console.log(`  ReachRanges: ${reachRanges.length}`);
  console.log(`  SocialPlatforms: ${platforms.length}`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Clients: ${clients.length}`);
  console.log(`  ClientContacts: ${clientContacts.length}`);
  console.log(`  ClientUsers: ${clientUsers.length}`);
  console.log(`  ServiceTypes: ${serviceTypes.length}`);
  console.log(`  Profiles: ${profiles.length}`);
  console.log(`  ProfileCategories: ${profileCategories.length}`);
  console.log(`  SocialAccounts: ${socialAccounts.length}`);
  console.log(`  ProfileServices: ${profileServices.length}`);
  console.log(`  Campaigns: ${campaigns.length}`);
  console.log(`  CampaignApprovalTokens: ${approvalTokens.length}`);
  console.log(`  CampaignProfiles: ${campaignProfiles.length}`);
  console.log(`  CampaignProfilePlatforms: ${campaignProfilePlatforms.length}`);
  console.log(`  CampaignServices: ${campaignServices.length}`);
}

exportDatabase()
  .catch((e) => {
    console.error("Error al exportar:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

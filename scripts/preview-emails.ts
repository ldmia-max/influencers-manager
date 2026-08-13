/**
 * Script para generar archivos HTML de previsualización de emails
 * Uso: npx tsx scripts/preview-emails.ts
 */

import fs from "fs";
import path from "path";
import {
  campaignReviewTemplate,
  tokenRegeneratedTemplate,
  campaignApprovedTemplate,
  campaignRejectedTemplate,
} from "../src/lib/emails/templates";

const OUTPUT_DIR = path.join(process.cwd(), "email-previews");

// Crear directorio de salida si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const baseUrl = "http://localhost:3000";

// Datos de ejemplo
const exampleData = {
  contactName: "María García",
  campaignName: "Campaña Navideña 2026",
  companyName: "Tech Solutions S.A.",
  approvalUrl: `${baseUrl}/client/campaigns/preview/example-token`,
  campaignUrl: `${baseUrl}/admin/campaigns/example-id`,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

// Generar templates
const templates = [
  {
    name: "1-campaign-review",
    ...campaignReviewTemplate({
      contactName: exampleData.contactName,
      campaignName: exampleData.campaignName,
      companyName: exampleData.companyName,
      approvalUrl: exampleData.approvalUrl,
      expiresAt: exampleData.expiresAt,
    }),
  },
  {
    name: "2-token-regenerated",
    ...tokenRegeneratedTemplate({
      contactName: exampleData.contactName,
      campaignName: exampleData.campaignName,
      approvalUrl: exampleData.approvalUrl,
      expiresAt: exampleData.expiresAt,
    }),
  },
  {
    name: "3-campaign-approved",
    ...campaignApprovedTemplate({
      campaignName: exampleData.campaignName,
      clientName: exampleData.companyName,
      contactName: exampleData.contactName,
      approvedProfiles: 5,
      totalProfiles: 5,
      campaignUrl: exampleData.campaignUrl,
    }),
  },
  {
    name: "4-campaign-rejected",
    ...campaignRejectedTemplate({
      campaignName: exampleData.campaignName,
      clientName: exampleData.companyName,
      contactName: exampleData.contactName,
      approvedProfiles: 3,
      rejectedProfiles: 2,
      totalProfiles: 5,
      rejectionDetails: [
        {
          profileName: "Ana Martínez (@anamartinez)",
          reason: "El contenido no se alinea con nuestra marca",
        },
        {
          profileName: "Carlos López (@carloslopez)",
          reason: "Preferimos influencers con más seguidores",
        },
      ],
      campaignUrl: exampleData.campaignUrl,
    }),
  },
];

// Generar archivos HTML
console.log("Generando archivos de previsualización de emails...\n");

templates.forEach((template) => {
  const filename = `${template.name}.html`;
  const filepath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(filepath, template.html, "utf-8");

  console.log(`✓ ${filename}`);
  console.log(`  Subject: ${template.subject}`);
  console.log(`  Path: ${filepath}\n`);
});

console.log(`\n✅ ${templates.length} archivos generados en: ${OUTPUT_DIR}`);
console.log("\nPuedes abrir los archivos HTML en tu navegador para verlos.");

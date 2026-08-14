/**
 * Diagnostico del servicio de correo.
 *
 *   npx tsx scripts/check-email.ts                    solo comprueba
 *   npx tsx scripts/check-email.ts alguien@dominio.com  ademas envia una prueba
 *
 * En el contenedor de produccion:
 *   cd /app && node ./prisma-cli/node_modules/tsx/dist/cli.mjs \
 *     scripts/check-email.ts alguien@dominio.com
 *
 * Existe porque el modo de fallo tipico del correo es silencioso: la
 * campana se marca "enviada a revision" y el cliente no recibe nada.
 * Esto separa los tres culpables posibles (configuracion, clave,
 * dominio sin verificar) antes de tocar una campana real.
 */
import { config } from "dotenv";
import { revisarConfiguracionEmail, sendEmail } from "../src/lib/emails/resend";

config();

async function main() {
  console.log("\n=== Configuracion ===");

  const revision = revisarConfiguracionEmail();

  if (!revision.ok) {
    console.log(`  ✗ ${revision.error}`);
    console.log(`\n  Codigo: ${revision.reason}`);
    process.exit(1);
  }

  console.log(`  ✓ ENABLE_EMAILS = "true"`);
  console.log(`  ✓ RESEND_API_KEY con formato correcto (re_...)`);
  console.log(`  ✓ Remitente: ${revision.from}`);

  // --- Clave y dominios, contra la API de Resend ---
  console.log("\n=== Cuenta de Resend ===");

  const respuesta = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${revision.apiKey}` },
  });
  const cuerpo = await respuesta.json();

  if (!respuesta.ok) {
    console.log(`  ✗ La API rechazo la clave: ${cuerpo.message ?? respuesta.status}`);
    process.exit(1);
  }

  const dominios: { name: string; status: string }[] = cuerpo.data ?? [];

  if (dominios.length === 0) {
    console.log("  ✗ No hay ningun dominio dado de alta en la cuenta.");
    console.log("    Sin dominio verificado solo se puede enviar desde");
    console.log("    onboarding@resend.dev, y eso SOLO llega al dueno de la");
    console.log("    cuenta: los clientes no recibirian nada.");
    process.exit(1);
  }

  for (const d of dominios) {
    const marca = d.status === "verified" ? "✓" : "✗";
    console.log(`  ${marca} ${d.name}: ${d.status}`);
  }

  const dominioRemitente = revision.from.split("@")[1]?.toLowerCase();
  const suyo = dominios.find((d) => d.name.toLowerCase() === dominioRemitente);

  if (!suyo) {
    console.log(`\n  ✗ El dominio del remitente (${dominioRemitente}) no esta en la cuenta.`);
    process.exit(1);
  }
  if (suyo.status !== "verified") {
    console.log(`\n  ✗ ${dominioRemitente} esta en estado "${suyo.status}", no "verified".`);
    console.log("    Faltan los registros DNS (DKIM/SPF) o aun no han propagado.");
    process.exit(1);
  }

  console.log(`\n  ✓ ${dominioRemitente} verificado: se puede enviar a cualquier destinatario.`);

  // --- Envio de prueba, solo si se pide ---
  const destino = process.argv[2];
  if (!destino) {
    console.log("\n(Para enviar una prueba real: npx tsx scripts/check-email.ts tu@correo.com)\n");
    return;
  }

  console.log(`\n=== Envio de prueba a ${destino} ===`);

  const resultado = await sendEmail({
    to: destino,
    subject: "Prueba de configuracion - Influencer Manager",
    html: "<p>Si lees esto, el servicio de correo funciona.</p>",
  });

  if (resultado.success) {
    console.log(`  ✓ Aceptado por Resend (id: ${resultado.id})`);
    console.log("    Comprueba la bandeja, incluida la carpeta de spam.");
  } else {
    console.log(`  ✗ ${resultado.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

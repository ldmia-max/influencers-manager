import { sendEmail } from "./resend";

/**
 * Aviso al equipo de cuenta cuando llega un brief desde /brief.
 *
 * Los destinatarios son los que figuran en la plantilla original del
 * brief. Se puede sobrescribir con la variable BRIEF_NOTIFICATION_EMAILS
 * (separada por comas) sin tocar el codigo.
 *
 * Recuerda que sendEmail() no hace nada si ENABLE_EMAILS no es "true".
 */
const DESTINATARIOS_POR_DEFECTO = [
  "nayibe.gomez@losdemarketing.com",
  "sofia.mendoza@losdemarketing.com",
  "ldm.ia@losdemarketing.com",
];

function destinatarios(): string[] {
  const config = process.env.BRIEF_NOTIFICATION_EMAILS;
  if (!config) return DESTINATARIOS_POR_DEFECTO;
  return config
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

const formatoCOP = (valor: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(d);

export interface NuevoBriefParams {
  briefId: string;
  empresa: string;
  responsable: string;
  cargo: string;
  correo: string;
  telefono: string;
  nombreCampana: string;
  objetivoPrincipal: string;
  presupuestoTotal: number;
  fechaInicio: Date;
  fechaFinal: Date;
  fechaPublicacion: Date;
  nichos: string[];
  totalDocumentos: number;
}

export async function notifyNewBrief(params: NuevoBriefParams) {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  const enlace = `${base}/briefs/${params.briefId}`;

  const fila = (etiqueta: string, valor: string) => `
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;width:190px;vertical-align:top">${etiqueta}</td>
      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500">${valor}</td>
    </tr>`;

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;background:#faf9f5">
    <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#C1104F;font-weight:600">Los De Marketing</p>
    <h1 style="margin:12px 0 4px;font-size:22px;color:#111827">Nuevo brief de campaña</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
      ${params.empresa} envió un brief a través del formulario público.
    </p>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px">
      <table style="width:100%;border-collapse:collapse">
        ${fila("Campaña", params.nombreCampana)}
        ${fila("Empresa / Marca", params.empresa)}
        ${fila("Responsable", `${params.responsable} — ${params.cargo}`)}
        ${fila("Contacto", `${params.correo} · ${params.telefono}`)}
        ${fila("Objetivo", params.objetivoPrincipal)}
        ${fila("Presupuesto", formatoCOP(params.presupuestoTotal))}
        ${fila("Vigencia", `${fecha(params.fechaInicio)} — ${fecha(params.fechaFinal)}`)}
        ${fila("Publicación", fecha(params.fechaPublicacion))}
        ${fila("Nichos", params.nichos.join(", ") || "—")}
        ${fila("Documentos adjuntos", String(params.totalDocumentos))}
      </table>
    </div>

    <p style="margin:28px 0">
      <a href="${enlace}" style="display:inline-block;background:#C1104F;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
        Ver el brief completo
      </a>
    </p>

    <p style="margin:0;color:#9ca3af;font-size:12px">
      Aviso automático. Para responder, escribe directamente a ${params.correo}.
    </p>
  </div>`;

  const asunto = `Nuevo brief: ${params.nombreCampana} — ${params.empresa}`;

  const envios = await Promise.allSettled(
    destinatarios().map((to) => sendEmail({ to, subject: asunto, html }))
  );

  const fallidos = envios.filter(
    (e) => e.status === "rejected" || (e.status === "fulfilled" && !e.value.success)
  ).length;

  if (fallidos > 0) {
    console.warn(
      `Aviso de brief ${params.briefId}: ${fallidos} de ${envios.length} envios no salieron`
    );
  }

  return { enviados: envios.length - fallidos, total: envios.length };
}

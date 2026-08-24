/**
 * Email templates for campaign notifications
 */

/**
 * Color del logo de Los de Marketing, tomado del propio archivo
 * (public/img/logo.png). Es plano y no un degradado: muchos clientes de
 * correo —Outlook de escritorio entre ellos— ignoran background-image,
 * y con un degradado la cabecera se quedaba en blanco con el texto
 * blanco encima, es decir, ilegible. Con background-color eso no pasa.
 */
const BRAND_COLOR = "#DE3163";
const BRAND_NAME = "Influencer Manager";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${BRAND_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;background-color:#fafafa;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
                Este es un email automático de ${BRAND_NAME}. Por favor no responda a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${BRAND_COLOR};border-radius:8px;padding:12px 28px;">
      <a href="${url}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">${text}</a>
    </td>
  </tr>
</table>`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// Template 1: Campaña enviada a revisión (para el cliente)
// =============================================================================

export function campaignReviewTemplate(params: {
  contactName: string;
  campaignName: string;
  companyName: string;
  approvalUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const subject = `Revisión de campaña: ${params.campaignName}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Hola ${params.contactName},</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Se ha preparado la campaña <strong>${params.campaignName}</strong> para
      <strong>${params.companyName}</strong> y está lista para su revisión.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Puede revisar los perfiles seleccionados y aprobar o rechazar cada uno individualmente.
    </p>
    ${ctaButton("Revisar Campaña", params.approvalUrl)}
    <p style="margin:0;font-size:12px;color:#a1a1aa;">
      Este enlace expira el ${formatDate(params.expiresAt)}.
    </p>
  `);

  return { subject, html };
}

// =============================================================================
// Template 2: Token regenerado (para el cliente)
// =============================================================================

export function tokenRegeneratedTemplate(params: {
  contactName: string;
  campaignName: string;
  approvalUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const subject = `Nuevo enlace de revisión: ${params.campaignName}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Hola ${params.contactName},</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Se ha generado un nuevo enlace de revisión para la campaña <strong>${params.campaignName}</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Utilice el siguiente enlace para revisar y aprobar los perfiles de la campaña.
      Los enlaces anteriores han sido reemplazados por este nuevo.
    </p>
    ${ctaButton("Revisar Campaña", params.approvalUrl)}
    <p style="margin:0;font-size:12px;color:#a1a1aa;">
      Este enlace expira el ${formatDate(params.expiresAt)}.
    </p>
  `);

  return { subject, html };
}

// =============================================================================
// Template 3: Campaña aprobada (para el admin/creador)
// =============================================================================

export function campaignApprovedTemplate(params: {
  campaignName: string;
  clientName: string;
  contactName: string;
  approvedProfiles: number;
  totalProfiles: number;
  campaignUrl: string;
}): { subject: string; html: string } {
  const subject = `Campaña aprobada: ${params.campaignName}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Campaña Aprobada</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">
      <strong>${params.contactName}</strong> de <strong>${params.clientName}</strong>
      ha aprobado todos los perfiles de la campaña <strong>${params.campaignName}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 16px;background-color:#f0fdf4;border-bottom:1px solid #e4e4e7;">
          <span style="font-size:13px;color:#166534;font-weight:600;">Resumen</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0 0 4px;font-size:13px;color:#3f3f46;">
            Perfiles aprobados: <strong>${params.approvedProfiles}/${params.totalProfiles}</strong>
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;line-height:1.6;">
      La campaña está lista para ser activada.
    </p>
    ${ctaButton("Ver Campaña", params.campaignUrl)}
  `);

  return { subject, html };
}

// =============================================================================
// Template 4: Campaña con rechazos (para el admin/creador)
// =============================================================================

export function campaignRejectedTemplate(params: {
  campaignName: string;
  clientName: string;
  contactName: string;
  approvedProfiles: number;
  rejectedProfiles: number;
  totalProfiles: number;
  rejectionDetails: Array<{ profileName: string; reason?: string }>;
  campaignUrl: string;
}): { subject: string; html: string } {
  const subject = `Campaña con rechazos: ${params.campaignName}`;

  const rejectionRows = params.rejectionDetails
    .map(
      (d) => `
      <tr>
        <td style="padding:8px 16px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#3f3f46;">
          <strong>${d.profileName}</strong>
          ${d.reason ? `<br><span style="color:#a1a1aa;font-style:italic;">"${d.reason}"</span>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Campaña con Rechazos</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">
      <strong>${params.contactName}</strong> de <strong>${params.clientName}</strong>
      ha revisado la campaña <strong>${params.campaignName}</strong> y ha rechazado algunos perfiles.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:12px 16px;background-color:#fef2f2;border-bottom:1px solid #e4e4e7;">
          <span style="font-size:13px;color:#991b1b;font-weight:600;">Resumen</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <p style="margin:0 0 4px;font-size:13px;color:#166534;">
            Aprobados: <strong>${params.approvedProfiles}/${params.totalProfiles}</strong>
          </p>
          <p style="margin:0;font-size:13px;color:#991b1b;">
            Rechazados: <strong>${params.rejectedProfiles}/${params.totalProfiles}</strong>
          </p>
        </td>
      </tr>
    </table>
    ${
      params.rejectionDetails.length > 0
        ? `
    <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;font-weight:600;">Perfiles rechazados:</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
      ${rejectionRows}
    </table>`
        : ""
    }
    <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;line-height:1.6;">
      La campaña ha pasado a estado <strong>Pendiente</strong>. Revisa los rechazos y realiza los ajustes necesarios.
    </p>
    ${ctaButton("Ver Campaña", params.campaignUrl)}
  `);

  return { subject, html };
}

/**
 * Codigo de un solo uso para entrar al portal de aprobacion.
 *
 * No lleva enlaces ni botones a proposito: el destinatario ya tiene el
 * enlace en el correo anterior, y un correo con codigo y enlace juntos
 * es la forma clasica de que el phishing se cuele imitandolo.
 */
export function codigoAprobacionTemplate(params: {
  contactName: string | null;
  campaignName: string;
  codigo: string;
  minutos: number;
}): { subject: string; html: string } {
  const subject = `Tu código de acceso: ${params.codigo}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">Hola${
      params.contactName ? ` ${params.contactName}` : ""
    },</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Para revisar la campaña <strong>${params.campaignName}</strong> introduce
      este código en la página que acabas de abrir:
    </p>
    <p style="margin:24px 0;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;font-family:monospace;font-size:30px;letter-spacing:8px;color:#18181b;">
        ${params.codigo}
      </span>
    </p>
    <p style="margin:0 0 12px;font-size:13px;color:#71717a;line-height:1.6;">
      Caduca en ${params.minutos} minutos y solo puede usarse una vez.
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
      Si no has sido tú, ignora este mensaje: sin el código nadie puede
      acceder a la campaña.
    </p>
  `);

  return { subject, html };
}

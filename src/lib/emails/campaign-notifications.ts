import { getUserEmailById } from "@/data-access/users";
import { getRejectedProfileDetails } from "@/data-access/campaign-approval";
import { sendEmail, type ResultadoEmail } from "./resend";
import {
  campaignReviewTemplate,
  tokenRegeneratedTemplate,
  campaignApprovedTemplate,
  campaignRejectedTemplate,
  codigoAprobacionTemplate,
} from "./templates";
import { CODIGO_MINUTOS } from "@/lib/approval-session";

function getBaseUrl() {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

/**
 * Envia al cliente el correo de revision de campana.
 *
 * Devuelve el resultado en vez de lanzar y olvidar. Antes se llamaba
 * sin await y con un .catch() que solo escribia en consola: si el envio
 * fallaba, la interfaz seguia diciendo "campana enviada a revision" y
 * nadie se enteraba hasta que el cliente decia que no habia recibido
 * nada. Quien llama decide que hacer con el fallo.
 */
export async function notifyCampaignSentToReview(params: {
  contactEmail: string;
  contactName: string;
  campaignName: string;
  companyName: string;
  approvalToken: string;
  expiresAt: Date;
}): Promise<ResultadoEmail> {
  const template = campaignReviewTemplate({
    contactName: params.contactName,
    campaignName: params.campaignName,
    companyName: params.companyName,
    approvalUrl: `${getBaseUrl()}/approve/${params.approvalToken}`,
    expiresAt: params.expiresAt,
  });

  return sendEmail({ to: params.contactEmail, ...template });
}

/**
 * Envia al cliente el enlace de aprobacion regenerado.
 *
 * Devuelve el resultado, igual que notifyCampaignSentToReview y por el
 * mismo motivo: antes se llamaba sin await y con un .catch() que solo
 * escribia en consola. El boton decia "enlace generado", el correo no
 * salia, y nadie se enteraba hasta que el cliente avisaba de que no
 * habia recibido nada. Ademas, una promesa sin await puede quedarse a
 * medias cuando la respuesta ya se devolvio.
 */
export async function notifyTokenRegenerated(params: {
  contactEmail: string;
  contactName: string;
  campaignName: string;
  approvalToken: string;
  expiresAt: Date;
}): Promise<ResultadoEmail> {
  const template = tokenRegeneratedTemplate({
    contactName: params.contactName,
    campaignName: params.campaignName,
    approvalUrl: `${getBaseUrl()}/approve/${params.approvalToken}`,
    expiresAt: params.expiresAt,
  });

  return sendEmail({ to: params.contactEmail, ...template });
}

/**
 * Avisa a quien creo la campana de lo que decidio el cliente.
 *
 * Espera al envio, como el resto. Un sendEmail sin await puede quedarse
 * a medias cuando la peticion ya devolvio, y el .catch() que habia solo
 * escribia en consola: el fallo no llegaba a ninguna parte.
 */
export async function notifyApprovalResult(params: {
  campaignId: string;
  campaignName: string;
  clientName: string;
  contactName: string;
  createdById: string;
  summary: {
    totalProfiles: number;
    approvedProfiles: number;
    rejectedProfiles: number;
  };
  rejectedProfileIds: string[];
}) {
  const creatorEmail = await getUserEmailById(params.createdById);

  if (!creatorEmail) return;

  const campaignUrl = `${getBaseUrl()}/campaigns/${params.campaignId}`;
  const hasRejections = params.summary.rejectedProfiles > 0;

  if (hasRejections) {
    const rejectedProfiles = await getRejectedProfileDetails(params.rejectedProfileIds);

    const rejectionDetails = rejectedProfiles.map((p) => ({
      profileName: p.profile.name,
      reason: p.rejectionReason || undefined,
    }));

    const template = campaignRejectedTemplate({
      campaignName: params.campaignName,
      clientName: params.clientName,
      contactName: params.contactName,
      approvedProfiles: params.summary.approvedProfiles,
      rejectedProfiles: params.summary.rejectedProfiles,
      totalProfiles: params.summary.totalProfiles,
      rejectionDetails,
      campaignUrl,
    });

    const envio = await sendEmail({ to: creatorEmail, ...template });
    if (!envio.success) {
      console.error("[email] Aviso de rechazo no enviado:", envio.reason, envio.error);
    }
  } else {
    const template = campaignApprovedTemplate({
      campaignName: params.campaignName,
      clientName: params.clientName,
      contactName: params.contactName,
      approvedProfiles: params.summary.approvedProfiles,
      totalProfiles: params.summary.totalProfiles,
      campaignUrl,
    });

    const envio = await sendEmail({ to: creatorEmail, ...template });
    if (!envio.success) {
      console.error("[email] Aviso de aprobación no enviado:", envio.reason, envio.error);
    }
  }
}

/**
 * Envia el codigo de un solo uso al correo registrado en la campana.
 *
 * Se espera el resultado (no es lanzar y olvidar) porque si el correo
 * no sale, el cliente se queda mirando una pantalla pidiendole un
 * codigo que nunca va a llegar.
 */
export async function notifyCodigoAprobacion(params: {
  destino: string;
  nombre: string | null;
  campaignName: string;
  codigo: string;
}): Promise<ResultadoEmail> {
  const template = codigoAprobacionTemplate({
    contactName: params.nombre,
    campaignName: params.campaignName,
    codigo: params.codigo,
    minutos: CODIGO_MINUTOS,
  });

  return sendEmail({ to: params.destino, ...template });
}

import { getUserEmailById } from "@/data-access/users";
import { getRejectedProfileDetails } from "@/data-access/campaign-approval";
import { sendEmail, type ResultadoEmail } from "./resend";
import {
  campaignReviewTemplate,
  tokenRegeneratedTemplate,
  campaignApprovedTemplate,
  campaignRejectedTemplate,
} from "./templates";

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
 * Envía email al cliente cuando se regenera el token de aprobación
 */
export function notifyTokenRegenerated(params: {
  contactEmail: string;
  contactName: string;
  campaignName: string;
  approvalToken: string;
  expiresAt: Date;
}) {
  const template = tokenRegeneratedTemplate({
    contactName: params.contactName,
    campaignName: params.campaignName,
    approvalUrl: `${getBaseUrl()}/approve/${params.approvalToken}`,
    expiresAt: params.expiresAt,
  });

  sendEmail({ to: params.contactEmail, ...template })
    .catch((err) => console.error("Failed to send regenerated token email:", err));
}

/**
 * Notifica al creador de la campaña sobre el resultado de la aprobación del cliente
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

    sendEmail({ to: creatorEmail, ...template })
      .catch((err) => console.error("Failed to send rejection email:", err));
  } else {
    const template = campaignApprovedTemplate({
      campaignName: params.campaignName,
      clientName: params.clientName,
      contactName: params.contactName,
      approvedProfiles: params.summary.approvedProfiles,
      totalProfiles: params.summary.totalProfiles,
      campaignUrl,
    });

    sendEmail({ to: creatorEmail, ...template })
      .catch((err) => console.error("Failed to send approval email:", err));
  }
}

import { NextResponse } from "next/server";
import { regenerateApprovalToken, getCampaignById } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { notifyTokenRegenerated } from "@/lib/emails/campaign-notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id: campaignId } = await params;
    const existing = await getCampaignById(campaignId);

    const sinPermiso = exigirPropiedad(sesion, "campanas", existing.createdById);
    if (sinPermiso) return sinPermiso;

    const result = await regenerateApprovalToken(campaignId);

    // Con await, y devolviendo si salio o no. Sin esperarlo, la promesa
    // podia quedarse a medias al devolver la respuesta y el cliente no
    // recibia nada mientras el boton decia que si.
    const envio = await notifyTokenRegenerated({
      contactEmail: result.contactEmail,
      contactName: result.contactName,
      campaignName: result.campaignName,
      approvalToken: result.token.token,
      expiresAt: result.expiresAt,
    });

    return NextResponse.json({
      token: result.token,
      approvalUrl: result.approvalUrl,
      message: envio.success
        ? `Enlace enviado a ${result.contactEmail}`
        : "Enlace generado, pero el correo no se pudo enviar",
      email: envio.success
        ? { sent: true }
        : { sent: false, reason: envio.reason, error: envio.error },
      emailRecipient: result.contactEmail,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error regenerating token:", error);
    return NextResponse.json(
      { error: "Error al regenerar el token" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { transitionCampaignStatus, getCampaignById } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { notifyCampaignSentToReview } from "@/lib/emails/campaign-notifications";
import { parseBody } from "@/lib/validate-request";
import { transitionStatusSchema } from "@/lib/schemas/campaign";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id: campaignId } = await params;
    const existing = await getCampaignById(campaignId);

    const sinPermiso = exigirPropiedad(sesion, "campanas", existing.createdById);
    if (sinPermiso) return sinPermiso;

    const body = await parseBody(req, transitionStatusSchema);
    if (body instanceof NextResponse) return body;

    const estadoAnterior = existing.status;
    const result = await transitionCampaignStatus(campaignId, body.status, body.reason);

    await auditar({
      action: ACCIONES.campanaEstado,
      entity: "Campaign",
      entityId: campaignId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Cambió "${existing.name}" de ${estadoAnterior} a ${body.status}`,
      metadata: {
        de: estadoAnterior,
        a: body.status,
        motivo: body.reason ?? null,
        destinatarios:
          result.emailData?.destinatarios.map((d) => d.contactEmail) ?? null,
      },
      req,
    });

    // Envio del correo a CADA contacto de la campana al pasar a REVIEW.
    //
    // Cada uno con su enlace: el codigo de verificacion viaja al correo
    // al que se emitio, asi que un enlace comun solo lo podria abrir
    // uno. Se ESPERAN todos y se informa en la respuesta. El cambio de
    // estado ya esta hecho y no se deshace porque falle un correo: la
    // campana queda en revision y los enlaces siguen siendo validos,
    // asi que el equipo puede pasarlos a mano. Pero tiene que saber
    // cuales no salieron, y antes no se enteraba.
    let email: { sent: boolean; reason?: string; error?: string } | undefined;
    let enviados: { email: string; sent: boolean; error?: string }[] = [];

    if (result.emailData) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      enviados = await Promise.all(
        result.emailData.destinatarios.map(async (destinatario) => {
          const envio = await notifyCampaignSentToReview({
            contactEmail: destinatario.contactEmail,
            contactName: destinatario.contactName,
            campaignName: result.emailData!.campaignName,
            companyName: result.emailData!.companyName,
            approvalToken: destinatario.token,
            expiresAt,
          });
          return {
            email: destinatario.contactEmail,
            sent: envio.success,
            error: envio.success ? undefined : envio.error ?? envio.reason,
          };
        })
      );

      // Un solo fallo basta para avisar: el aviso nombra a quien se
      // quedo sin correo, y decir "enviado" porque tres de cuatro
      // salieron es como no decir nada.
      const fallidos = enviados.filter((e) => !e.sent);
      email =
        fallidos.length === 0
          ? { sent: true }
          : {
              sent: false,
              reason: fallidos[0].error,
              error: `No salió el correo a ${fallidos.map((f) => f.email).join(", ")}`,
            };
    }

    // Build response
    const response: {
      campaign: typeof result.campaign;
      message: string;
      approvalToken?: string;
      approvalUrl?: string;
      email?: { sent: boolean; reason?: string; error?: string };
      emailRecipient?: string;
      destinatarios?: { email: string; sent: boolean; error?: string }[];
    } = {
      campaign: result.campaign,
      message: result.message,
      email,
      emailRecipient: result.emailData?.destinatarios
        .map((d) => d.contactEmail)
        .join(", "),
      destinatarios: enviados.length > 0 ? enviados : undefined,
    };

    if (result.approvalToken) {
      response.approvalToken = result.approvalToken;
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      response.approvalUrl = `${baseUrl}/approve/${result.approvalToken}`;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Check if it's a JSON-encoded error with details (ACTIVE transition)
      try {
        const parsed = JSON.parse(error.message);
        return NextResponse.json(parsed, { status: 400 });
      } catch {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error updating campaign status:", error);
    return NextResponse.json(
      { error: "Error al actualizar el estado de la campaña" },
      { status: 500 }
    );
  }
}

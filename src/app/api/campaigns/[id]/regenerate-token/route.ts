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

    // Un correo por contacto, cada uno con SU enlace, y con await.
    // Sin esperarlo, la promesa podia quedarse a medias al devolver la
    // respuesta y el cliente no recibia nada mientras el boton decia
    // que si.
    const envios = await Promise.all(
      result.destinatarios.map(async (d) => {
        const envio = await notifyTokenRegenerated({
          contactEmail: d.contactEmail,
          contactName: d.contactName,
          campaignName: result.campaignName,
          approvalToken: d.token,
          expiresAt: result.expiresAt,
        });
        return {
          email: d.contactEmail,
          sent: envio.success,
          error: envio.success ? undefined : envio.error ?? envio.reason,
        };
      })
    );

    // Uno que falle basta para avisar, y se nombra a quien se quedo sin
    // correo: decir "enviado" porque dos de tres salieron es no decir
    // nada util.
    const fallidos = envios.filter((e) => !e.sent);
    const destinos = envios.map((e) => e.email).join(", ");

    return NextResponse.json({
      token: result.token,
      approvalUrl: result.approvalUrl,
      message:
        fallidos.length === 0
          ? `Enlace enviado a ${destinos}`
          : `Enlaces generados, pero el correo a ${fallidos
              .map((f) => f.email)
              .join(", ")} no se pudo enviar`,
      email:
        fallidos.length === 0
          ? { sent: true }
          : {
              sent: false,
              reason: fallidos[0].error,
              error: `No salió el correo a ${fallidos.map((f) => f.email).join(", ")}`,
            },
      emailRecipient: destinos,
      destinatarios: envios,
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

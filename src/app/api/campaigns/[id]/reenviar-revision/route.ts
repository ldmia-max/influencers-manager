import { NextResponse } from "next/server";
import { reenviarEnlacesDeRevision, getCampaignById } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { notifyReenvioRevision } from "@/lib/emails/campaign-notifications";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/reenviar-revision
 *
 * Vuelve a mandar los enlaces que ya existen, sin emitir ninguno.
 *
 * Ruta propia y no un parametro de regenerate-token porque hacen cosas
 * opuestas: aquella emite y mata los anteriores, esta repite el envio y
 * no toca nada. Mezclarlas en una sola con una bandera acabaria, el dia
 * que alguien se equivoque de valor, invalidando el enlace que el
 * cliente tenia abierto.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id: campaignId } = await params;
    const existing = await getCampaignById(campaignId);

    const sinPermiso = exigirPropiedad(sesion, "campanas", existing.createdById);
    if (sinPermiso) return sinPermiso;

    const result = await reenviarEnlacesDeRevision(campaignId);

    // Con await, como el resto: una promesa suelta puede quedarse a
    // medias al devolver la respuesta, y entonces el boton diria
    // "reenviado" sin que haya salido nada — que es exactamente el
    // fallo que este boton existe para resolver.
    const envios = await Promise.all(
      result.destinatarios.map(async (d) => {
        const envio = await notifyReenvioRevision({
          contactEmail: d.contactEmail,
          contactName: d.contactName,
          campaignName: result.campaignName,
          approvalToken: d.token,
          expiresAt: d.expiresAt,
        });
        return {
          email: d.contactEmail,
          sent: envio.success,
          error: envio.success ? undefined : envio.error ?? envio.reason,
        };
      })
    );

    const fallidos = envios.filter((e) => !e.sent);
    const destinos = envios.map((e) => e.email).join(", ");

    await auditar({
      action: ACCIONES.enlaceRevisionReenviado,
      entity: "Campaign",
      entityId: campaignId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary:
        `Reenvió el enlace de revisión de "${existing.name}" a ${destinos}` +
        (fallidos.length > 0
          ? ` — no salió el de ${fallidos.map((f) => f.email).join(", ")}`
          : ""),
      metadata: {
        campanaId: campaignId,
        estadoCampana: existing.status,
        destinatarios: envios,
      },
      req,
    });

    return NextResponse.json({
      message:
        fallidos.length === 0
          ? `Enlace reenviado a ${destinos}`
          : `No se pudo reenviar a ${fallidos.map((f) => f.email).join(", ")}`,
      email:
        fallidos.length === 0
          ? { sent: true }
          : {
              sent: false,
              reason: fallidos[0].error,
              error: `No salió el correo a ${fallidos.map((f) => f.email).join(", ")}`,
            },
      destinatarios: envios,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error reenviando el enlace de revisión:", error);
    return NextResponse.json(
      { error: "No se pudo reenviar el enlace" },
      { status: 500 }
    );
  }
}

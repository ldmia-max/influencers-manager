import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  aprobarInfluencerDeCampana,
  descartarInfluencerPendiente,
} from "@/data-access/campaign-profiles";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; perfilId: string }>;
}

/**
 * PATCH /api/campaigns/[id]/influencers/[perfilId]
 *
 * Aprueba un influencer sin pasar por el cliente, para cuando la agencia
 * tiene delegada esa decision.
 *
 * Se audita con mas motivo que el resto: se aprueba en nombre del cliente
 * un gasto que el no ha visto, y meses despues hay que poder reconstruir
 * quien lo decidio.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { perfilId } = await params;
    const resultado = await aprobarInfluencerDeCampana(perfilId);

    await auditar({
      action: ACCIONES.influencerAprobadoPorAgencia,
      entity: "CampaignProfile",
      entityId: perfilId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Aprobó directamente a ${resultado.influencer.name} en "${resultado.campana.name}", sin pasar por el cliente`,
      metadata: {
        campanaId: resultado.campana.id,
        influencerId: resultado.influencer.id,
      },
      req,
    });

    revalidateTag("campaigns", "hours");
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error aprobando influencer:", error);
    return NextResponse.json(
      { error: "No se pudo aprobar el influencer" },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/campaigns/[id]/influencers/[perfilId]
 *
 * Quita a un influencer que todavia espera aprobacion.
 *
 * No pide motivo, a diferencia del retiro: este no llego a estar
 * contratado —se anadio como tentativa y el cliente no lo ha visto—, asi
 * que no hay acuerdo que documentar. La capa de datos comprueba que sea
 * asi de verdad antes de borrar nada.
 *
 * Se audita igualmente porque es el unico borrado real de un influencer
 * en una campana: despues no queda fila que consultar.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { perfilId } = await params;
    const resultado = await descartarInfluencerPendiente(perfilId);

    await auditar({
      action: ACCIONES.influencerDescartado,
      entity: "CampaignProfile",
      entityId: perfilId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Quitó a ${resultado.influencer.name} de "${resultado.campana.name}" antes de que el cliente lo viera`,
      metadata: {
        campanaId: resultado.campana.id,
        influencerId: resultado.influencer.id,
      },
      req,
    });

    revalidateTag("campaigns", "hours");
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error quitando influencer:", error);
    return NextResponse.json(
      { error: "No se pudo quitar el influencer" },
      { status: 500 }
    );
  }
}

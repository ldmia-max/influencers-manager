import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { aprobarInfluencerDeCampana } from "@/data-access/campaign-profiles";
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

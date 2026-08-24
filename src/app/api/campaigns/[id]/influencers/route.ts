import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { agregarInfluencerACampana } from "@/data-access/campaign-profiles";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { agregarInfluencerSchema } from "@/lib/schemas/campaign";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/influencers
 *
 * Suma un influencer a una campana ya en marcha, normalmente para
 * reemplazar a uno que se retiro.
 *
 * Entra PENDIENTE de aprobacion. Queda auditado porque cambia lo que
 * cuesta la campana, igual que el retiro.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const body = await parseBody(req, agregarInfluencerSchema);
    if (body instanceof NextResponse) return body;

    const resultado = await agregarInfluencerACampana(id, {
      profileId: body.profileId,
      platforms: body.platforms,
    });

    await auditar({
      action: ACCIONES.influencerAnadido,
      entity: "CampaignProfile",
      entityId: resultado.campaignProfileId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Añadió a ${resultado.influencer.name} a la campaña activa "${resultado.campana.name}"`,
      metadata: {
        campanaId: resultado.campana.id,
        influencerId: resultado.influencer.id,
      },
      req,
    });

    revalidateTag("campaigns", "hours");
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error añadiendo influencer:", error);
    return NextResponse.json(
      { error: "No se pudo añadir el influencer" },
      { status: 500 }
    );
  }
}

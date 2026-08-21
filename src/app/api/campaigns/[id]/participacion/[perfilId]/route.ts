import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  retirarInfluencer,
  reactivarInfluencer,
} from "@/data-access/entregas";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { participacionSchema } from "@/lib/schemas/entrega";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; perfilId: string }>;
}

const ORIGEN_LEGIBLE: Record<string, string> = {
  INFLUENCER: "decisión del influencer",
  CLIENTE: "petición del cliente",
  AGENCIA: "decisión interna",
};

/**
 * PATCH /api/campaigns/[id]/participacion/[perfilId]
 *
 * Retira a un influencer de la campana o lo devuelve a ella.
 *
 * Queda auditado porque cambia lo que cuesta la campana: un retiro
 * libera presupuesto, y meses despues hay que poder reconstruir quien
 * lo decidio y cuando.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { perfilId } = await params;
    const body = await parseBody(req, participacionSchema);
    if (body instanceof NextResponse) return body;

    if (body.accion === "retirar") {
      const resultado = await retirarInfluencer(perfilId, {
        origen: body.origen,
        motivo: body.motivo ?? null,
      });

      await auditar({
        action: ACCIONES.influencerRetirado,
        entity: "CampaignProfile",
        entityId: perfilId,
        actorType: "USER",
        actorId: sesion.userId,
        actorEmail: sesion.email,
        summary: `Retiró a ${resultado.influencer.name} de "${resultado.campana.name}" por ${ORIGEN_LEGIBLE[body.origen]}`,
        metadata: {
          campanaId: resultado.campana.id,
          influencerId: resultado.influencer.id,
          origen: body.origen,
          motivo: body.motivo ?? null,
        },
        req,
      });

      revalidateTag("campaigns", "hours");
      return NextResponse.json(resultado);
    }

    const resultado = await reactivarInfluencer(perfilId);

    await auditar({
      action: ACCIONES.influencerReactivado,
      entity: "CampaignProfile",
      entityId: perfilId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Devolvió a ${resultado.influencer.name} a "${resultado.campana.name}"`,
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
    console.error("Error cambiando la participación:", error);
    return NextResponse.json(
      { error: "No se pudo cambiar la participación" },
      { status: 500 }
    );
  }
}

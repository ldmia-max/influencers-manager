import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { actualizarCifrasDeEntrega } from "@/data-access/entregas";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { cifrasDePublicacionSchema } from "@/lib/schemas/entrega";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; entregaId: string }>;
}

/**
 * PATCH /api/campaigns/[id]/entregas/[entregaId]/cifras
 *
 * Anota el alcance, los compartidos y los reposteos de una publicacion:
 * las cifras que Apify no puede leer y solo ve el creador en su panel.
 *
 * Es PATCH y no POST, al reves que las cifras de una historia: aquello
 * anade una captura mas de una publicacion que sigue viva, y esto
 * corrige el mismo dato, mejor sabido.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { entregaId } = await params;
    const body = await parseBody(req, cifrasDePublicacionSchema);
    if (body instanceof NextResponse) return body;

    const { cifras, campana, influencer } = await actualizarCifrasDeEntrega(
      entregaId,
      body
    );

    await auditar({
      action: ACCIONES.cifrasDePublicacionAnotadas,
      entity: "CampaignEntrega",
      entityId: entregaId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Anotó cifras de una publicación de ${influencer} en "${campana.name}"`,
      metadata: {
        campanaId: campana.id,
        alcance: cifras.alcance,
        compartidos: cifras.compartidosReportados,
        reposteos: cifras.reposteosReportados,
      },
      req,
    });

    revalidateTag("campaigns", "hours");
    return NextResponse.json(cifras);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error anotando cifras de la publicación:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar las cifras" },
      { status: 500 }
    );
  }
}

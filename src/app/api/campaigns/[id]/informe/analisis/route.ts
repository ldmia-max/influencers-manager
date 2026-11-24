import { NextResponse } from "next/server";
import { getCampaignById } from "@/data-access/campaigns";
import { guardarAnalisis } from "@/data-access/informes";
import { NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { analisisInformeSchema } from "@/lib/schemas/informe";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/campaigns/[id]/informe/analisis
 *
 * Guarda el analisis general reescrito por mercadeo. Lo que llega vacio
 * vuelve a la propuesta calculada.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const campana = await getCampaignById(id);
    const sinPermiso = exigirPropiedad(sesion, "campanas", campana.createdById);
    if (sinPermiso) return sinPermiso;

    const body = await parseBody(req, analisisInformeSchema);
    if (body instanceof NextResponse) return body;

    const guardado = await guardarAnalisis(id, body, sesion.userId);
    return NextResponse.json({ analisis: guardado });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error guardando el análisis del informe:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el análisis" },
      { status: 500 }
    );
  }
}

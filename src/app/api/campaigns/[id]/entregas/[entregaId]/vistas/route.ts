import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { registrarCifrasReportadas } from "@/data-access/entregas";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { cifrasReportadasSchema } from "@/lib/schemas/entrega";

interface RouteParams {
  params: Promise<{ id: string; entregaId: string }>;
}

/**
 * POST /api/campaigns/[id]/entregas/[entregaId]/vistas
 *
 * Anota las cifras que reporto el creador de una historia o un directo:
 * sus vistas, sus interacciones, o las dos.
 *
 * Es POST y no PATCH porque no corrige nada: anade una captura mas, igual
 * que hace el refresco automatico. Una historia se mira durante horas, y
 * la cifra del primer dia y la del tercero son dos datos, no uno
 * rectificado.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { entregaId } = await params;
    const body = await parseBody(req, cifrasReportadasSchema);
    if (body instanceof NextResponse) return body;

    const metrica = await registrarCifrasReportadas(
      entregaId,
      { vistas: body.vistas, interacciones: body.interacciones },
      sesion.userId
    );

    revalidateTag("campaigns", "hours");
    return NextResponse.json(metrica, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error anotando cifras reportadas:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar las cifras" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { quitarOtroDocumento } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";

interface RouteParams {
  params: Promise<{ campaignProfileId: string; documentoId: string }>;
}

/**
 * DELETE /api/pagos/[campaignProfileId]/documentos/otros/[documentoId]
 *
 * Quita un papel suelto. La capa de datos comprueba que sea de ESTE
 * influencer: con el id a secas, quien pueda editar una campana podria
 * borrar la documentacion de otra.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { campaignProfileId, documentoId } = await params;
    const pago = await quitarOtroDocumento(campaignProfileId, documentoId);
    return NextResponse.json(pago);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error quitando el documento:", error);
    return NextResponse.json(
      { error: "No se pudo quitar el documento" },
      { status: 500 }
    );
  }
}

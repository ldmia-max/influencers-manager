import { NextResponse } from "next/server";
import { agregarOtroDocumento } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { otroDocumentoSchema } from "@/lib/schemas/pago";

interface RouteParams {
  params: Promise<{ campaignProfileId: string }>;
}

/**
 * POST /api/pagos/[campaignProfileId]/documentos/otros
 *
 * Suma un papel suelto a la documentacion de un influencer.
 *
 * Es un POST y no el PATCH de al lado porque aqui se anade: de estos
 * caben varios, y mandarlos por el PATCH obligaria a enviar la lista
 * entera y a confiar en que el navegador no se deje ninguno.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { campaignProfileId } = await params;
    const body = await parseBody(req, otroDocumentoSchema);
    if (body instanceof NextResponse) return body;

    const pago = await agregarOtroDocumento(campaignProfileId, body);
    return NextResponse.json(pago, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error añadiendo el documento:", error);
    return NextResponse.json(
      { error: "No se pudo añadir el documento" },
      { status: 500 }
    );
  }
}

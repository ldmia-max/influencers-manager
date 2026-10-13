import { NextResponse } from "next/server";
import { guardarDocumentacionDePago } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { documentacionPagoSchema } from "@/lib/schemas/pago";

interface RouteParams {
  params: Promise<{ campaignProfileId: string }>;
}

/**
 * PATCH /api/pagos/[campaignProfileId]/documentos
 *
 * La parte de mercadeo: la cuenta de cobro, el certificado bancario y
 * la fecha desde la que corren los 60 dias.
 *
 * Va por su propia ruta y no por una generica de pagos para que lo que
 * registra contabilidad no se pueda tocar desde aqui: la separacion es
 * por campo, y eso no cabe en la tabla de permisos.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { campaignProfileId } = await params;
    const body = await parseBody(req, documentacionPagoSchema);
    if (body instanceof NextResponse) return body;

    const pago = await guardarDocumentacionDePago(campaignProfileId, body);
    return NextResponse.json(pago);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error guardando la documentación del pago:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la documentación" },
      { status: 500 }
    );
  }
}

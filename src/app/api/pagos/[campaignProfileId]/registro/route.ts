import { NextResponse } from "next/server";
import { registrarPagoEnContabilidad } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { registroPagoSchema } from "@/lib/schemas/pago";

interface RouteParams {
  params: Promise<{ campaignProfileId: string }>;
}

/**
 * PATCH /api/pagos/[campaignProfileId]/registro
 *
 * La parte de contabilidad: el consecutivo de su sistema y, si hace
 * falta, corregir la fecha de la cuenta de cobro.
 *
 * Pide "borrar" a proposito, que es la accion que solo tienen ADMIN y
 * CONTABILIDAD: mercadeo entra a los pagos con "actualizar" para la
 * documentacion, y asi no alcanza esta ruta.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "borrar");
    if (sesion instanceof NextResponse) return sesion;

    const { campaignProfileId } = await params;
    const body = await parseBody(req, registroPagoSchema);
    if (body instanceof NextResponse) return body;

    const pago = await registrarPagoEnContabilidad(campaignProfileId, body);
    return NextResponse.json(pago);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error registrando el pago:", error);
    return NextResponse.json(
      { error: "No se pudo registrar el pago" },
      { status: 500 }
    );
  }
}

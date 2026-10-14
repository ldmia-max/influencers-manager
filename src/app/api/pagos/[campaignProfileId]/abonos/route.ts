import { NextResponse } from "next/server";
import { registrarAbono } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { abonoSchema } from "@/lib/schemas/pago";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ campaignProfileId: string }>;
}

/**
 * POST /api/pagos/[campaignProfileId]/abonos
 *
 * Anota un pago parcial. El saldo baja con cada uno y llega a cero
 * cuando se termino de pagar.
 *
 * Pide "borrar", que es la accion que solo tienen ADMIN y CONTABILIDAD:
 * mercadeo entra a los pagos con "actualizar" para la documentacion, y
 * asi no alcanza esta ruta. Quien paga es contabilidad.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "borrar");
    if (sesion instanceof NextResponse) return sesion;

    const { campaignProfileId } = await params;
    const body = await parseBody(req, abonoSchema);
    if (body instanceof NextResponse) return body;

    const pago = await registrarAbono(
      campaignProfileId,
      { fecha: body.fecha, valor: body.valor, observacion: body.observacion },
      sesion.userId
    );

    await auditar({
      action: ACCIONES.abonoRegistrado,
      entity: "PagoInfluencer",
      entityId: campaignProfileId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Anotó un pago de $${body.valor} a ${pago.influencer} en "${pago.campana}"`,
      metadata: {
        campanaId: pago.campanaId,
        valor: body.valor,
        saldo: pago.saldo,
      },
      req,
    });

    return NextResponse.json(pago, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error anotando el abono:", error);
    return NextResponse.json({ error: "No se pudo anotar el pago" }, { status: 500 });
  }
}

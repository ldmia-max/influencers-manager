import { NextResponse } from "next/server";
import { eliminarAbono } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ campaignProfileId: string; abonoId: string }>;
}

/** DELETE: deshace un abono mal anotado. */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "borrar");
    if (sesion instanceof NextResponse) return sesion;

    const { campaignProfileId, abonoId } = await params;
    const pago = await eliminarAbono(campaignProfileId, abonoId);

    await auditar({
      action: ACCIONES.abonoEliminado,
      entity: "PagoInfluencer",
      entityId: campaignProfileId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Quitó un pago anotado a ${pago.influencer} en "${pago.campana}"`,
      metadata: { campanaId: pago.campanaId, abonoId, saldo: pago.saldo },
      req,
    });

    return NextResponse.json(pago);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error quitando el abono:", error);
    return NextResponse.json({ error: "No se pudo quitar el pago" }, { status: 500 });
  }
}

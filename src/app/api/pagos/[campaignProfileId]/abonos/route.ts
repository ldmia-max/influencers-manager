import { NextResponse } from "next/server";
import { registrarAbono } from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { abonoSchema } from "@/lib/schemas/pago";
import { auditar, ACCIONES } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { ResultadoEmail } from "@/lib/emails/resend";
import {
  destinoDelPagoRealizado,
  notifyPagoRealizado,
} from "@/lib/emails/pago-notifications";

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
      {
        fecha: body.fecha,
        valor: body.valor,
        observacion: body.observacion,
        comprobante: body.comprobante ?? null,
      },
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

    // Pagado del todo: se avisa por correo. Contabilidad no hace pagos
    // parciales, asi que en la practica es cada pago que se anota; la
    // condicion sobre el estado evita avisar de un pago a medias si
    // alguna vez se anota uno.
    //
    // El pago ya esta guardado: si el correo falla se responde igual con
    // 201 y el motivo en `email`, para que la pantalla diga que se pago
    // pero el aviso no salio, en vez de hacer creer que el pago fallo.
    let email:
      | { sent: true }
      | { sent: false; reason: string; error: string }
      | null = null;
    if (pago.estado === "PAGADO") {
      const destino = destinoDelPagoRealizado();
      if (!destino) {
        email = {
          sent: false,
          reason: "sin_destino",
          error: "falta la variable CORREO_PAGO_REALIZADO",
        };
      } else {
        const usuario = await prisma.user.findUnique({
          where: { id: sesion.userId },
          select: { name: true, email: true },
        });
        const resultado: ResultadoEmail = await notifyPagoRealizado({
          destino,
          pago,
          valorPagado: body.valor,
          fechaPago: body.fecha,
          registradoPor: usuario?.name || usuario?.email || sesion.email || "contabilidad",
        });
        email = resultado.success
          ? { sent: true }
          : { sent: false, reason: resultado.reason, error: resultado.error };
        if (resultado.success) {
          await auditar({
            action: ACCIONES.pagoRealizadoNotificado,
            entity: "PagoInfluencer",
            entityId: campaignProfileId,
            actorType: "USER",
            actorId: sesion.userId,
            actorEmail: sesion.email,
            summary: `Avisó a ${destino} del pago a ${pago.influencer} en "${pago.campana}"`,
            metadata: { campanaId: pago.campanaId, destino, emailId: resultado.id ?? null },
            req,
          });
        }
      }
    }

    return NextResponse.json({ ...pago, email }, { status: 201 });
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

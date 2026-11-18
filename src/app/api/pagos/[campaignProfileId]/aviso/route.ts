import { NextResponse } from "next/server";
import {
  marcarAvisoDePagoEnviado,
  pagoListoParaAvisar,
} from "@/data-access/pagos";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { auditar, ACCIONES } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  destinoDelAvisoDePago,
  notifyAvisoDePago,
} from "@/lib/emails/pago-notifications";

interface RouteParams {
  params: Promise<{ campaignProfileId: string }>;
}

/**
 * POST /api/pagos/[campaignProfileId]/aviso
 *
 * Avisa por correo a contabilidad de que los documentos obligatorios de
 * un influencer estan y se puede pagar.
 *
 * Se puede repetir cuantas veces haga falta —el correo puede no llegar—
 * y cada envio que sale bien pisa la fecha. Si el correo falla, la fecha
 * se queda como estaba y se responde el motivo: anotar un aviso que
 * nadie recibio es justo lo que el boton intenta evitar.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("pagos", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const destino = destinoDelAvisoDePago();
    if (!destino) {
      return NextResponse.json(
        {
          error:
            "No está configurado a qué correo se avisa: falta la variable CORREO_AVISO_PAGOS.",
        },
        { status: 503 }
      );
    }

    const { campaignProfileId } = await params;
    const pago = await pagoListoParaAvisar(campaignProfileId);

    const usuario = await prisma.user.findUnique({
      where: { id: sesion.userId },
      select: { name: true, email: true },
    });
    const enviadoPor = usuario?.name || usuario?.email || sesion.email || "la agencia";

    const resultado = await notifyAvisoDePago({ destino, pago, enviadoPor });
    if (!resultado.success) {
      return NextResponse.json(
        {
          error: `No se pudo enviar el correo: ${resultado.error}`,
          email: { sent: false, reason: resultado.reason, error: resultado.error },
        },
        { status: 502 }
      );
    }

    const enviadoEn = await marcarAvisoDePagoEnviado(campaignProfileId);

    await auditar({
      action: ACCIONES.avisoDePagoEnviado,
      entity: "PagoInfluencer",
      entityId: campaignProfileId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Avisó a ${destino} de que se puede pagar a ${pago.influencer} en "${pago.campana}"`,
      metadata: { campanaId: pago.campanaId, destino },
      req,
    });

    return NextResponse.json({
      avisoPagoEnviadoEn: enviadoEn.toISOString(),
      email: { sent: true },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error enviando el aviso de pago:", error);
    return NextResponse.json(
      { error: "No se pudo enviar el aviso" },
      { status: 500 }
    );
  }
}

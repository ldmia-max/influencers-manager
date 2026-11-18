import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  decidirFormatoPorElCliente,
  decidirInfluencerPorElCliente,
} from "@/data-access/campaign-approval";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { decisionPorElClienteSchema } from "@/lib/schemas/approval";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/decision-cliente
 *
 * Mercadeo o un administrador aprueba o rechaza, en nombre del cliente,
 * a un influencer pendiente o uno de sus formatos. Para cuando el
 * cliente contesta por correo, por WhatsApp o en una reunion y no va a
 * abrir su enlace.
 *
 * Siempre auditado: es una respuesta que el cliente no dio con su
 * propia firma, y meses despues hay que saber quien la anoto.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const body = await parseBody(req, decisionPorElClienteSchema);
    if (body instanceof NextResponse) return body;

    if (body.tipo === "formato") {
      const r = await decidirFormatoPorElCliente(id, body.servicioId, body);
      await auditar({
        action: ACCIONES.formatoDecididoPorAgencia,
        entity: "CampaignService",
        entityId: r.id,
        actorType: "USER",
        actorId: sesion.userId,
        actorEmail: sesion.email,
        summary:
          `${body.aprobado ? "Aprobó" : "Rechazó"} por el cliente ${r.formato}` +
          ` de ${r.influencer.name} en "${r.campana.name}"`,
        metadata: {
          campanaId: r.campana.id,
          influencerId: r.influencer.id,
          aprobado: body.aprobado,
          motivo: body.motivo ?? null,
        },
        req,
      });
      revalidateTag("campaigns", "hours");
      return NextResponse.json(r);
    }

    const r = await decidirInfluencerPorElCliente(
      id,
      body.campaignProfileId,
      body,
      sesion.userId
    );
    await auditar({
      action: body.aprobado
        ? ACCIONES.influencerAprobadoPorAgencia
        : ACCIONES.influencerRechazadoPorAgencia,
      entity: "CampaignProfile",
      entityId: r.id,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary:
        `${body.aprobado ? "Aprobó" : "Rechazó"} por el cliente a ${r.influencer.name}` +
        ` en "${r.campana.name}"` +
        (r.campana.estadoFinal !== r.campana.status
          ? `; la campaña pasa de ${r.campana.status} a ${r.campana.estadoFinal}`
          : ""),
      metadata: {
        campanaId: r.campana.id,
        influencerId: r.influencer.id,
        aprobado: body.aprobado,
        motivo: body.motivo ?? null,
        estadoAnterior: r.campana.status,
        estadoFinal: r.campana.estadoFinal,
      },
      req,
    });
    revalidateTag("campaigns", "hours");
    return NextResponse.json(r);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error decidiendo por el cliente:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la decisión" },
      { status: 500 }
    );
  }
}

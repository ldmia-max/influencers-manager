import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { cambiarPrecioDeFormato } from "@/data-access/campaign-profiles";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { precioDeFormatoSchema } from "@/lib/schemas/campaign";
import { auditar, ACCIONES } from "@/lib/audit";
import { formatNumber } from "@/lib/format";

interface RouteParams {
  params: Promise<{ id: string; servicioId: string }>;
}

/**
 * PATCH /api/campaigns/[id]/formatos/[servicioId]/precio
 *
 * Reprecia un formato concreto, incluso con la campana ya aprobada.
 *
 * Va por su propia ruta y no por la del plazo de entrega, que vive un
 * nivel mas arriba, porque cambian cosas distintas: una mueve una
 * fecha y la otra mueve dinero ya acordado. Mezclarlas haria que el
 * mismo permiso valiera para las dos.
 *
 * Queda auditado siempre. No es un ajuste cualquiera: el cliente
 * aprobo un importe, el que queda es otro, y es el nuevo el que
 * contabilidad acabara pagandole al influencer.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id, servicioId } = await params;
    const body = await parseBody(req, precioDeFormatoSchema);
    if (body instanceof NextResponse) return body;

    const r = await cambiarPrecioDeFormato(id, servicioId, body.basePrice);
    revalidateTag("campaigns", "hours");

    await auditar({
      action: ACCIONES.formatoRepreciado,
      entity: "CampaignService",
      entityId: servicioId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary:
        `Cambió el precio de ${r.formato} (${r.red}) de ${r.influencer}` +
        ` en "${r.campana.name}": de $${formatNumber(Math.round(r.anterior))}` +
        ` a $${formatNumber(Math.round(r.nuevo))}` +
        (r.yaAprobado ? " — el cliente ya lo había aprobado" : ""),
      metadata: {
        campanaId: r.campana.id,
        estadoCampana: r.campana.status,
        influencer: r.influencer,
        red: r.red,
        formato: r.formato,
        cantidad: r.cantidad,
        de: r.anterior,
        a: r.nuevo,
        yaAprobadoPorElCliente: r.yaAprobado,
      },
      req,
    });

    return NextResponse.json(r);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error cambiando el precio del formato:", error);
    return NextResponse.json(
      { error: "No se pudo cambiar el precio" },
      { status: 500 }
    );
  }
}

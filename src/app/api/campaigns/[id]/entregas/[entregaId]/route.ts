import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { actualizarEntrega, eliminarEntrega } from "@/data-access/entregas";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { actualizarEntregaSchema } from "@/lib/schemas/entrega";

interface RouteParams {
  params: Promise<{ id: string; entregaId: string }>;
}

/** PATCH /api/campaigns/[id]/entregas/[entregaId] — corrige un link. */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { entregaId } = await params;
    const body = await parseBody(req, actualizarEntregaSchema);
    if (body instanceof NextResponse) return body;

    const entrega = await actualizarEntrega(entregaId, {
      url: body.url,
      publicadoEn: body.publicadoEn,
      notas: body.notas,
    });

    revalidateTag("campaigns", "hours");
    return NextResponse.json(entrega);
  } catch (error) {
    return manejar(error, "No se pudo actualizar el link");
  }
}

/**
 * DELETE /api/campaigns/[id]/entregas/[entregaId]
 *
 * Borra el link y con el su historico de metricas, que sin el link no
 * significa nada.
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { entregaId } = await params;
    const entrega = await eliminarEntrega(entregaId);

    revalidateTag("campaigns", "hours");
    return NextResponse.json({ eliminado: entrega.id });
  } catch (error) {
    return manejar(error, "No se pudo eliminar el link");
  }
}

function manejar(error: unknown, mensaje: string) {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(mensaje, error);
  return NextResponse.json({ error: mensaje }, { status: 500 });
}

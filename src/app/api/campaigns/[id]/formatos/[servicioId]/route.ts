import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  fijarFechaLimite,
  fijarFechaLimiteDeCampana,
} from "@/data-access/entregas";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { fechaLimiteSchema } from "@/lib/schemas/entrega";

interface RouteParams {
  params: Promise<{ id: string; servicioId: string }>;
}

/**
 * PATCH /api/campaigns/[id]/formatos/[servicioId]
 *
 * Pone la fecha tope de entrega de un formato. Con `aplicarATodos`
 * la extiende a toda la campana, que es lo normal al arrancar; despues
 * se afinan los formatos que tengan otro plazo.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id, servicioId } = await params;
    const body = await parseBody(req, fechaLimiteSchema);
    if (body instanceof NextResponse) return body;

    const resultado = body.aplicarATodos
      ? await fijarFechaLimiteDeCampana(id, body.fechaLimite)
      : await fijarFechaLimite(servicioId, body.fechaLimite);

    revalidateTag("campaigns", "hours");
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error fijando fecha límite:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la fecha límite" },
      { status: 500 }
    );
  }
}

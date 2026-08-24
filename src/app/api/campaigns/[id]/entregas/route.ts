import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { registrarEntrega } from "@/data-access/entregas";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { registrarEntregaSchema } from "@/lib/schemas/entrega";

/**
 * POST /api/campaigns/[id]/entregas
 *
 * Registra el link de un contenido ya publicado.
 *
 * Pide permiso de ACTUALIZAR campanas, que tienen USER y ADMIN: los
 * influencers no entran a la aplicacion, asi que los links los pega
 * siempre alguien de la agencia.
 */
export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, registrarEntregaSchema);
    if (body instanceof NextResponse) return body;

    const entrega = await registrarEntrega({
      campaignServiceId: body.campaignServiceId,
      url: body.url ?? null,
      publicadoEn: body.publicadoEn ?? null,
      notas: body.notas ?? null,
      usuarioId: sesion.userId,
    });

    revalidateTag("campaigns", "hours");
    return NextResponse.json(entrega, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error registrando entrega:", error);
    return NextResponse.json(
      { error: "No se pudo registrar el link" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { setCampaignMarkup } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { setMarkupSchema } from "@/lib/schemas/campaign";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/campaigns/[id]/markup
 *
 * Ajusta el margen de una campana concreta. Reservado a ADMIN via el
 * permiso de administracion: cambiarlo en una campana ya aprobada
 * altera cifras que el cliente acepto.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const body = await parseBody(req, setMarkupSchema);
    if (body instanceof NextResponse) return body;

    const campaign = await setCampaignMarkup(id, body.markupPercentage);
    revalidateTag("campaigns", "hours");

    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating campaign markup:", error);
    return NextResponse.json(
      { error: "Error al actualizar el margen" },
      { status: 500 }
    );
  }
}

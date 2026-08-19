import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { setCampaignArchivada } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { archivarCampanaSchema } from "@/lib/schemas/campaign";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/campaigns/[id]/archivar
 *
 * Retira la campana de los listados sin borrar nada, o la devuelve.
 *
 * Reservado a ADMIN mediante el permiso de borrar campanas, que es el
 * unico que ese rol tiene en exclusiva: archivar es la version
 * reversible de eliminar, y no tendria sentido que exigiera menos.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "borrar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const body = await parseBody(req, archivarCampanaSchema);
    if (body instanceof NextResponse) return body;

    const { actual } = await setCampaignArchivada(id, body.archivada);
    revalidateTag("campaigns", "hours");

    await auditar({
      action: body.archivada ? ACCIONES.campanaArchivada : ACCIONES.campanaRestaurada,
      entity: "Campaign",
      entityId: id,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: body.archivada
        ? `Archivó la campaña "${actual.name}" (${actual.status}); sigue en la base de datos`
        : `Restauró la campaña "${actual.name}" a los listados`,
      metadata: { estado: actual.status },
      req,
    });

    return NextResponse.json({
      id: actual.id,
      archivedAt: actual.archivedAt,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error archiving campaign:", error);
    return NextResponse.json(
      { error: "Error al archivar la campaña" },
      { status: 500 }
    );
  }
}

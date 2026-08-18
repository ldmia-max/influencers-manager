import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { createOrUpdateClientAccess, deleteClientAccess } from "@/data-access/clients";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { clientAccessSchema } from "@/lib/schemas/client";
import { auditar, ACCIONES } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Dar o quitar acceso al portal es administracion, no gestion de
    // clientes: crea credenciales que ven datos de campanas.
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const body = await parseBody(req, clientAccessSchema);
    if (body instanceof NextResponse) return body;

    const clientUser = await createOrUpdateClientAccess(id, { email: body.email ?? "", password: body.password, isActive: body.isActive });

    await auditar({
      action: ACCIONES.accesoPortalConcedido,
      entity: "Client",
      entityId: id,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Concedió acceso al portal a ${clientUser.email}`,
      metadata: { emailPortal: clientUser.email, activo: clientUser.isActive },
      req,
    });

    return NextResponse.json(clientUser, {
      status: clientUser.clientId ? 201 : 200,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error managing client access:", error);
    return NextResponse.json(
      { error: "Error al gestionar acceso del cliente" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    await deleteClientAccess(id);

    await auditar({
      action: ACCIONES.accesoPortalRevocado,
      entity: "Client",
      entityId: id,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: "Revocó el acceso al portal de este cliente",
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error removing client access:", error);
    return NextResponse.json(
      { error: "Error al eliminar acceso del cliente" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import {
  createOrUpdateContactAccess,
  deleteContactAccess,
} from "@/data-access/clients";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { clientAccessSchema } from "@/lib/schemas/client";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; contactoId: string }>;
}

/**
 * Acceso al portal de UN contacto del cliente.
 *
 * Antes colgaba del cliente —`/api/clients/[id]/access`— y habia una
 * sola cuenta por empresa. Con ella entraba quien tuviera la
 * contrasena, y lo que quedaba escrito en una campana aprobada era que
 * "el cliente" habia dicho que si, sin nombre. Ahora la credencial es
 * de una persona, y el contacto va en la URL.
 *
 * El id del contacto se comprueba contra el del cliente dentro de
 * `createOrUpdateContactAccess`: el permiso de la ruta dice quien puede
 * dar accesos, no sobre quien.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    // Dar o quitar acceso al portal es administracion, no gestion de
    // clientes: crea credenciales que ven datos de campanas.
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id, contactoId } = await params;
    const body = await parseBody(req, clientAccessSchema);
    if (body instanceof NextResponse) return body;

    const clientUser = await createOrUpdateContactAccess(id, contactoId, {
      email: body.email,
      password: body.password,
      isActive: body.isActive,
    });

    await auditar({
      action: ACCIONES.accesoPortalConcedido,
      entity: "ClientContact",
      entityId: contactoId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Concedió acceso al portal a ${clientUser.email}`,
      metadata: {
        clienteId: id,
        emailPortal: clientUser.email,
        activo: clientUser.isActive,
      },
      req,
    });

    return NextResponse.json(clientUser, { status: 201 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error managing contact access:", error);
    return NextResponse.json(
      { error: "Error al gestionar el acceso del contacto" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id, contactoId } = await params;
    const { email } = await deleteContactAccess(id, contactoId);

    await auditar({
      action: ACCIONES.accesoPortalRevocado,
      entity: "ClientContact",
      entityId: contactoId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Revocó el acceso al portal de ${email}`,
      metadata: { clienteId: id, emailPortal: email },
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
    console.error("Error removing contact access:", error);
    return NextResponse.json(
      { error: "Error al eliminar el acceso del contacto" },
      { status: 500 }
    );
  }
}

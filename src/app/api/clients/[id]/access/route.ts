import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOrUpdateClientAccess, deleteClientAccess } from "@/data-access/clients";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { clientAccessSchema } from "@/lib/schemas/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo administradores pueden gestionar accesos de clientes" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await parseBody(req, clientAccessSchema);
    if (body instanceof NextResponse) return body;

    const clientUser = await createOrUpdateClientAccess(id, { email: body.email ?? "", password: body.password, isActive: body.isActive });

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo administradores pueden gestionar accesos de clientes" },
        { status: 403 }
      );
    }

    const { id } = await params;
    await deleteClientAccess(id);
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

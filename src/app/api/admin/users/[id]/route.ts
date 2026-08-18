import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { updateUser, deleteUser } from "@/data-access/users";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { updateUserSchema } from "@/lib/schemas/user";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    const body = await parseBody(req, updateUserSchema);
    if (body instanceof NextResponse) return body;
    const user = await updateUser(id, { name: body.name, email: body.email, role: body.role, password: body.password });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "borrar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    await deleteUser(id, sesion.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    );
  }
}

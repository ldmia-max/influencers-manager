import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { getAllUsersForAdmin, createUserAdmin } from "@/data-access/users";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createUserSchema } from "@/lib/schemas/user";
import { auditar, ACCIONES } from "@/lib/audit";

export async function GET() {
  try {
    const sesion = await exigirPermiso("administracion", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const users = await getAllUsersForAdmin();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("administracion", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, createUserSchema);
    if (body instanceof NextResponse) return body;
    const user = await createUserAdmin({ name: body.name, email: body.email, password: body.password, role: body.role });

    await auditar({
      action: ACCIONES.usuarioCreado,
      entity: "User",
      entityId: user.id,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: `Creó la cuenta ${user.email} con rol ${user.role}`,
      metadata: { email: user.email, rol: user.role },
      req,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}

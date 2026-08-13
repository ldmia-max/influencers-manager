import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllUsersForAdmin, createUserAdmin } from "@/data-access/users";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createUserSchema } from "@/lib/schemas/user";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createUserSchema);
    if (body instanceof NextResponse) return body;
    const user = await createUserAdmin({ name: body.name, email: body.email, password: body.password, role: body.role });
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

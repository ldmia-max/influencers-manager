import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { patchDepartment, updateDepartment, deleteDepartment } from "@/data-access/locations";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createDepartmentSchema, patchDepartmentSchema } from "@/lib/schemas/location";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, patchDepartmentSchema);
    if (body instanceof NextResponse) return body;
    const department = await patchDepartment(id, { isActive: body.isActive, name: body.name, countryId: body.countryId });
    return NextResponse.json(department);
  } catch (error) {
    console.error("Error updating department:", error);
    return NextResponse.json(
      { error: "Error al actualizar departamento" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createDepartmentSchema);
    if (body instanceof NextResponse) return body;
    const department = await updateDepartment(id, { name: body.name, countryId: body.countryId });
    return NextResponse.json(department);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating department:", error);
    return NextResponse.json(
      { error: "Error al actualizar departamento" },
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
    const { id } = await params;

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await deleteDepartment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error deleting department:", error);
    return NextResponse.json(
      { error: "Error al eliminar departamento" },
      { status: 500 }
    );
  }
}

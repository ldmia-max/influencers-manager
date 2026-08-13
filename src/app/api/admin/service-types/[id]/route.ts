import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateServiceType, deleteServiceType } from "@/data-access/service-types";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { updateServiceTypeSchema } from "@/lib/schemas/service-type";

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

    const body = await parseBody(req, updateServiceTypeSchema);
    if (body instanceof NextResponse) return body;
    const serviceType = await updateServiceType(id, { isActive: body.isActive, displayName: body.displayName, profileTypes: body.profileTypes });
    return NextResponse.json(serviceType);
  } catch (error) {
    console.error("Error updating service type:", error);
    return NextResponse.json(
      { error: "Error al actualizar formato" },
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

    await deleteServiceType(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error deleting service type:", error);
    return NextResponse.json(
      { error: "Error al eliminar formato" },
      { status: 500 }
    );
  }
}

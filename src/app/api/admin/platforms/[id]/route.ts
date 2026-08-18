import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { updatePlatform, deletePlatform } from "@/data-access/platforms";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { updatePlatformSchema } from "@/lib/schemas/platform";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    const body = await parseBody(req, updatePlatformSchema);
    if (body instanceof NextResponse) return body;
    const platform = await updatePlatform(id, { isActive: body.isActive, displayName: body.displayName });
    return NextResponse.json(platform);
  } catch (error) {
    console.error("Error updating platform:", error);
    return NextResponse.json(
      { error: "Error al actualizar plataforma" },
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

    await deletePlatform(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error deleting platform:", error);
    return NextResponse.json(
      { error: "Error al eliminar plataforma" },
      { status: 500 }
    );
  }
}

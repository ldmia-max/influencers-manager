import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { patchCity, updateCity, deleteCity } from "@/data-access/locations";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createCitySchema, patchCitySchema } from "@/lib/schemas/location";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    const body = await parseBody(req, patchCitySchema);
    if (body instanceof NextResponse) return body;
    const city = await patchCity(id, { isActive: body.isActive, name: body.name, departmentId: body.departmentId });
    return NextResponse.json(city);
  } catch (error) {
    console.error("Error updating city:", error);
    return NextResponse.json(
      { error: "Error al actualizar ciudad" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    const body = await parseBody(req, createCitySchema);
    if (body instanceof NextResponse) return body;
    const city = await updateCity(id, { name: body.name, departmentId: body.departmentId });
    return NextResponse.json(city);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating city:", error);
    return NextResponse.json(
      { error: "Error al actualizar ciudad" },
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

    await deleteCity(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting city:", error);
    return NextResponse.json(
      { error: "Error al eliminar ciudad" },
      { status: 500 }
    );
  }
}

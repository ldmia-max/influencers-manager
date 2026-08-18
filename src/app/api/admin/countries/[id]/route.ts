import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { patchCountry, updateCountry, deleteCountry } from "@/data-access/locations";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createCountrySchema, patchCountrySchema } from "@/lib/schemas/location";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    const body = await parseBody(req, patchCountrySchema);
    if (body instanceof NextResponse) return body;
    const country = await patchCountry(id, { isActive: body.isActive, name: body.name, code: body.code });
    return NextResponse.json(country);
  } catch (error) {
    console.error("Error updating country:", error);
    return NextResponse.json(
      { error: "Error al actualizar país" },
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

    const body = await parseBody(req, createCountrySchema);
    if (body instanceof NextResponse) return body;
    const country = await updateCountry(id, { name: body.name, code: body.code });
    return NextResponse.json(country);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating country:", error);
    return NextResponse.json(
      { error: "Error al actualizar país" },
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

    await deleteCountry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error deleting country:", error);
    return NextResponse.json(
      { error: "Error al eliminar país" },
      { status: 500 }
    );
  }
}

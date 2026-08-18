import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { updateReachRange, patchReachRange, deleteReachRange } from "@/data-access/reach-ranges";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { patchReachRangeSchema, createReachRangeSchema } from "@/lib/schemas/reach-range";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;
    const { id } = await params;

    const body = await parseBody(req, patchReachRangeSchema);
    if (body instanceof NextResponse) return body;
    const reachRange = await patchReachRange(id, body);
    return NextResponse.json(reachRange);
  } catch (error) {
    console.error("Error updating reach range:", error);
    return NextResponse.json(
      { error: "Error al actualizar rango de alcance" },
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

    const body = await parseBody(req, createReachRangeSchema);
    if (body instanceof NextResponse) return body;
    const reachRange = await updateReachRange(id, { name: body.name, displayName: body.displayName, minFollowers: body.minFollowers, maxFollowers: body.maxFollowers, reachPercentage: body.reachPercentage });
    return NextResponse.json(reachRange);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating reach range:", error);
    return NextResponse.json(
      { error: "Error al actualizar rango de alcance" },
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

    await deleteReachRange(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reach range:", error);
    return NextResponse.json(
      { error: "Error al eliminar rango de alcance" },
      { status: 500 }
    );
  }
}

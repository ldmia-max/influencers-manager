import { NextResponse } from "next/server";
import { getCategoryById, updateCategory, deleteCategory } from "@/data-access/categories";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { exigirPermiso } from "@/lib/api-guard";
import { updateCategorySchema } from "@/lib/schemas/category";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("categorias", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const category = await getCategoryById(id);
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Error al obtener categoría" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("categorias", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const body = await parseBody(req, updateCategorySchema);
    if (body instanceof NextResponse) return body;
    const category = await updateCategory(id, { name: body.name, description: body.description, isActive: body.isActive });
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Error al actualizar categoría" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("categorias", "borrar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    await deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Error al eliminar categoría" },
      { status: 500 }
    );
  }
}

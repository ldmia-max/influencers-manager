import { NextResponse } from "next/server";
import { getActiveCategories, createCategory } from "@/data-access/categories";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { exigirPermiso } from "@/lib/api-guard";
import { createCategorySchema } from "@/lib/schemas/category";

export async function GET() {
  try {
    const sesion = await exigirPermiso("categorias", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const categories = await getActiveCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Error al obtener categorías" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("categorias", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, createCategorySchema);
    if (body instanceof NextResponse) return body;
    const category = await createCategory({
      name: body.name,
      description: body.description,
      createdById: sesion.userId,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Error al crear categoría" },
      { status: 500 }
    );
  }
}

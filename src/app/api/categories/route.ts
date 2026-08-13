import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveCategories, createCategory } from "@/data-access/categories";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createCategorySchema } from "@/lib/schemas/category";

export async function GET() {
  try {
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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createCategorySchema);
    if (body instanceof NextResponse) return body;
    const category = await createCategory({
      name: body.name,
      description: body.description,
      createdById: session.user.id,
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

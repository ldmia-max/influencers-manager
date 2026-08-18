import { NextResponse } from "next/server";
import { getActiveGenders, createGender } from "@/data-access/genders";
import { ValidationError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { createGenderSchema } from "@/lib/schemas/gender";

export async function GET() {
  try {
    const sesion = await exigirPermiso("perfiles", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const genders = await getActiveGenders();
    return NextResponse.json(genders);
  } catch (error) {
    console.error("Error fetching genders:", error);
    return NextResponse.json(
      { error: "Error al obtener géneros" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Los generos se crean desde el formulario de perfiles.
    const sesion = await exigirPermiso("perfiles", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, createGenderSchema);
    if (body instanceof NextResponse) return body;
    const gender = await createGender(body.name);
    return NextResponse.json(gender, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating gender:", error);
    return NextResponse.json(
      { error: "Error al crear género" },
      { status: 500 }
    );
  }
}

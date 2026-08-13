import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveGenders, createGender } from "@/data-access/genders";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createGenderSchema } from "@/lib/schemas/gender";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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

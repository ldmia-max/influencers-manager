import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { getAllCountriesWithCounts, createCountry } from "@/data-access/locations";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createCountrySchema } from "@/lib/schemas/location";

export async function GET() {
  try {
    const sesion = await exigirPermiso("administracion", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const countries = await getAllCountriesWithCounts();
    return NextResponse.json(countries);
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json(
      { error: "Error al obtener países" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("administracion", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, createCountrySchema);
    if (body instanceof NextResponse) return body;
    const country = await createCountry(body.name, body.code);
    return NextResponse.json(country, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating country:", error);
    return NextResponse.json(
      { error: "Error al crear país" },
      { status: 500 }
    );
  }
}

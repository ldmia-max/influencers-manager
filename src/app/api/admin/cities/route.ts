import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllCitiesWithDepartments, createCity } from "@/data-access/locations";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createCitySchema } from "@/lib/schemas/location";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const countryId = searchParams.get("countryId") || undefined;

    const cities = await getAllCitiesWithDepartments({ departmentId, countryId });
    return NextResponse.json(cities);
  } catch (error) {
    console.error("Error fetching cities:", error);
    return NextResponse.json(
      { error: "Error al obtener ciudades" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createCitySchema);
    if (body instanceof NextResponse) return body;
    const city = await createCity(body.name, body.departmentId);
    return NextResponse.json(city, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating city:", error);
    return NextResponse.json(
      { error: "Error al crear ciudad" },
      { status: 500 }
    );
  }
}

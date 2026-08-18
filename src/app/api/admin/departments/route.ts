import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { getAllDepartmentsWithCountries, createDepartment } from "@/data-access/locations";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createDepartmentSchema } from "@/lib/schemas/location";

export async function GET(req: Request) {
  try {
    const sesion = await exigirPermiso("administracion", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("countryId") || undefined;

    const departments = await getAllDepartmentsWithCountries(countryId);
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: "Error al obtener departamentos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("administracion", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, createDepartmentSchema);
    if (body instanceof NextResponse) return body;
    const department = await createDepartment(body.name, body.countryId);
    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: "Error al crear departamento" },
      { status: 500 }
    );
  }
}

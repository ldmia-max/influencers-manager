import { NextResponse } from "next/server";
import { getClientsPaginated, createClient } from "@/data-access/clients";
import { ValidationError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { createClientSchema } from "@/lib/schemas/client";

export async function GET(req: Request) {
  try {
    const sesion = await exigirPermiso("clientes", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const result = await getClientsPaginated({ search, page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("clientes", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, createClientSchema);
    if (body instanceof NextResponse) return body;

    const client = await createClient({
      companyName: body.companyName,
      nit: body.nit,
      email: body.email,
      contacts: body.contacts,
      createdById: sesion.userId,
    });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    );
  }
}

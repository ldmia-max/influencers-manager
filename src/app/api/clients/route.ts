import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientsPaginated, createClient } from "@/data-access/clients";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createClientSchema } from "@/lib/schemas/client";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createClientSchema);
    if (body instanceof NextResponse) return body;

    const client = await createClient({
      companyName: body.companyName,
      nit: body.nit,
      email: body.email,
      contacts: body.contacts,
      createdById: session.user.id,
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

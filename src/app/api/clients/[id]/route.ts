import { NextResponse } from "next/server";
import { getClientById, updateClient } from "@/data-access/clients";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { updateClientSchema } from "@/lib/schemas/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("clientes", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const client = await getClientById(id);
    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Error al obtener cliente" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("clientes", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;

    // Los clientes los modifica quien los creo (o un ADMIN). La LECTURA
    // sigue siendo global: crear una campana obliga a elegir cliente y
    // filtrarla dejaria fuera las cuentas de los companeros.
    const actual = await getClientById(id);
    const sinPermiso = exigirPropiedad(sesion, "clientes", actual.createdById);
    if (sinPermiso) return sinPermiso;

    const body = await parseBody(req, updateClientSchema);
    if (body instanceof NextResponse) return body;

    const client = await updateClient(id, {
      companyName: body.companyName,
      nit: body.nit,
      email: body.email,
      contacts: body.contacts,
    });
    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    );
  }
}

/**
 * El borrado de clientes NO se expone por la API.
 *
 * Un cliente con campanas ya lo impedia la base de datos (la clave
 * foranea es RESTRICT) y devolvia un 500 opaco. Ahora la decision es
 * explicita: eliminar un cliente se hace desde el gestor de base de
 * datos, porque arrastra sus contactos y su acceso al portal.
 */

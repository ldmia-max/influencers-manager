import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { convertirBriefACampana, cambiarEstadoBrief } from "@/services/brief-conversion";
import { ValidationError, NotFoundError } from "@/data-access/errors";

/**
 * Rutas PRIVADAS de gestion de briefs. Requieren sesion.
 *
 * Ojo: el middleware solo intercepta /api/admin, asi que la comprobacion
 * de sesion se hace aqui explicitamente.
 */

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: convertir el brief en campana
export async function POST(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const resultado = await convertirBriefACampana(id, session.user.id);

    return NextResponse.json({
      message: "Campaña creada a partir del brief",
      ...resultado,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error al convertir el brief:", error);
    return NextResponse.json(
      { error: "No se pudo convertir el brief" },
      { status: 500 }
    );
  }
}

// PATCH: cambiar el estado del brief
export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!["PENDIENTE", "REVISADO", "DESCARTADO"].includes(status)) {
      return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
    }

    const brief = await cambiarEstadoBrief(id, status);
    return NextResponse.json(brief);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error al cambiar el estado del brief:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el brief" },
      { status: 500 }
    );
  }
}

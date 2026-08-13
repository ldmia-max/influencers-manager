import { NextResponse } from "next/server";
import {
  getApprovalData,
  saveApprovalDecisions,
} from "@/data-access/campaign-approval";
import { ValidationError, NotFoundError } from "@/data-access/errors";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET: Obtener datos de campaña para aprobación (público)
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const data = await getApprovalData(token);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "Token no válido", code: "INVALID_TOKEN" },
        { status: 404 }
      );
    }
    if (error instanceof ValidationError) {
      const codeMap: Record<string, { message: string; status: number }> = {
        EXPIRED_TOKEN: { message: "El enlace de aprobación ha expirado", status: 410 },
        USED_TOKEN: { message: "Este enlace ya fue utilizado", status: 410 },
        INVALID_STATUS: { message: "La campaña ya no está disponible para revisión", status: 400 },
      };
      const mapped = codeMap[error.message];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.message, code: error.message },
          { status: mapped.status }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error fetching approval data:", error);
    return NextResponse.json(
      { error: "Error al obtener los datos de la campaña" },
      { status: 500 }
    );
  }
}

// PATCH: Guardar decisiones de aprobación parciales
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const body = await req.json();
    await saveApprovalDecisions(token, body.decisions);

    return NextResponse.json({
      message: "Decisiones guardadas correctamente",
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "Token no válido", code: "INVALID_TOKEN" },
        { status: 404 }
      );
    }
    if (error instanceof ValidationError) {
      const codeMap: Record<string, { message: string; status: number }> = {
        EXPIRED_TOKEN: { message: "El enlace de aprobación ha expirado", status: 410 },
        USED_TOKEN: { message: "Este enlace ya fue utilizado", status: 410 },
        INVALID_STATUS: { message: "La campaña ya no está disponible para revisión", status: 400 },
      };
      const mapped = codeMap[error.message];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.message, code: error.message },
          { status: mapped.status }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error saving approval decisions:", error);
    return NextResponse.json(
      { error: "Error al guardar las decisiones" },
      { status: 500 }
    );
  }
}

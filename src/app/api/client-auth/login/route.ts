import { NextResponse } from "next/server";
import { loginClient } from "@/data-access/clients";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { clientLoginSchema } from "@/lib/schemas/auth";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, clientLoginSchema);
    if (body instanceof NextResponse) return body;
    const client = await loginClient(body.email, body.password);
    return NextResponse.json({ success: true, client });
  } catch (error) {
    if (error instanceof ValidationError) {
      const message = error.message;
      const status = message === "Credenciales inválidas" ? 401
        : message.includes("inactiva") ? 403
        : 400;
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error in client login:", error);
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}

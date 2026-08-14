import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginClient } from "@/data-access/clients";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { clientLoginSchema } from "@/lib/schemas/auth";
import {
  COOKIE_SESION_CLIENTE,
  MAX_AGE_SESION,
  firmarSesionCliente,
  opcionesCookie,
} from "@/lib/client-session";

/**
 * POST /api/client-auth/login
 *
 * Autentica a un ClientUser y abre su sesion. Es PUBLICA: el middleware
 * no cubre /api/client-auth.
 *
 * La sesion va en una cookie httpOnly firmada, no en la respuesta: el
 * navegador no debe poder leerla ni fabricarla. Antes esta ruta se
 * limitaba a verificar la contraseña y devolver los datos del cliente,
 * con lo que /client-dashboard quedaba abierto a cualquiera.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, clientLoginSchema);
    if (body instanceof NextResponse) return body;

    const client = await loginClient(body.email, body.password);

    const token = await firmarSesionCliente({
      clientId: client.id,
      companyName: client.companyName,
      email: client.email,
    });

    const almacen = await cookies();
    almacen.set(COOKIE_SESION_CLIENTE, token, opcionesCookie(MAX_AGE_SESION));

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

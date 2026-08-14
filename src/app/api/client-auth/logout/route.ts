import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION_CLIENTE, opcionesCookie } from "@/lib/client-session";

/**
 * POST /api/client-auth/logout
 *
 * Cierra la sesion del portal de clientes borrando la cookie.
 *
 * Se sobrescribe con maxAge 0 en vez de usar delete() para que las
 * opciones (path, secure, sameSite) coincidan exactamente con las del
 * login: si no cuadran, el navegador conserva la cookie original y la
 * sesion sobrevive al cierre.
 */
export async function POST() {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION_CLIENTE, "", opcionesCookie(0));

  return NextResponse.json({ success: true });
}

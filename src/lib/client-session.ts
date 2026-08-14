import { SignJWT, jwtVerify } from "jose";

/**
 * Sesion del PORTAL DE CLIENTES.
 *
 * Es un sistema aparte del de NextAuth, que gobierna al personal
 * interno (ver src/lib/auth.ts). Un ClientUser no es un User: no tiene
 * rol, no entra en (app) y solo ve lo suyo. Mezclarlos en el mismo
 * proveedor de NextAuth obligaria a que la sesion del personal
 * distinguiera dos tipos de sujeto, y es justo lo que no interesa.
 *
 * Este archivo lo importa el middleware, asi que corre en el runtime
 * Edge: NO puede importar Prisma ni bcryptjs. Solo firma y verifica.
 * jose funciona en Edge, que es la razon de usarlo en vez de
 * node:crypto.
 */

export const COOKIE_SESION_CLIENTE = "client-session";

/** Duracion de la sesion. Coincide con la del personal (30 dias). */
const DURACION_SEGUNDOS = 60 * 60 * 24 * 30;

export interface SesionCliente {
  /** ID del Client (la empresa), no del ClientUser. */
  clientId: string;
  companyName: string;
  email: string;
}

/**
 * Reutiliza NEXTAUTH_SECRET en vez de pedir otra variable: ya es
 * obligatoria, ya esta puesta en produccion y tiene la entropia
 * necesaria. El precio es que rotarla cierra tambien las sesiones de
 * los clientes, no solo las del personal.
 */
function clave(): Uint8Array {
  const secreto = process.env.NEXTAUTH_SECRET;
  if (!secreto) {
    throw new Error(
      "Falta NEXTAUTH_SECRET: sin el no se pueden firmar las sesiones de cliente"
    );
  }
  return new TextEncoder().encode(secreto);
}

export async function firmarSesionCliente(datos: SesionCliente): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("influencer-manager")
    .setAudience("client-portal")
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(clave());
}

/**
 * Verifica el token y devuelve la sesion, o null si no vale.
 *
 * Comprueba emisor y audiencia ademas de la firma: sin eso, un JWT
 * emitido para otra cosa pero firmado con el mismo secreto valdria
 * como sesion de cliente.
 */
export async function verificarSesionCliente(
  token: string | undefined
): Promise<SesionCliente | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, clave(), {
      issuer: "influencer-manager",
      audience: "client-portal",
    });

    const { clientId, companyName, email } = payload as unknown as SesionCliente;
    if (!clientId || !email) return null;

    return { clientId, companyName, email };
  } catch {
    // Firma invalida, expirado, emisor distinto... todo es lo mismo
    // desde fuera: no hay sesion.
    return null;
  }
}

/** Opciones de la cookie, compartidas entre el login y el logout. */
export function opcionesCookie(maxAge: number) {
  return {
    httpOnly: true,
    // En local se sirve por http y una cookie Secure no viajaria.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export const MAX_AGE_SESION = DURACION_SEGUNDOS;

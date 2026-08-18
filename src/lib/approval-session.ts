import { SignJWT, jwtVerify } from "jose";
import { randomInt, createHash, timingSafeEqual } from "crypto";

/**
 * Verificacion de acceso al portal de aprobacion de campanas.
 *
 * El problema que resuelve: el enlace /approve/<token> era la
 * credencial completa. El token no es adivinable, pero SI es
 * transferible: reenviar el correo daba a cualquiera la capacidad de
 * aprobar en nombre del cliente, y no quedaba constancia de quien
 * habia decidido.
 *
 * Ahora el enlace solo identifica la campana. Para entrar hay que
 * demostrar que se controla el correo al que se envio (sentToEmail),
 * introduciendo un codigo de 6 digitos que llega a esa direccion. Al
 * superarlo se emite una sesion corta atada a ESE token.
 *
 * Este archivo no toca la base de datos ni Prisma: solo cripto y JWT.
 */

export const COOKIE_APROBACION = "approval-session";

/** Vigencia de la sesion una vez verificado. Suficiente para revisar una campana. */
const SESION_SEGUNDOS = 60 * 60 * 2;

/** Vigencia del codigo de un solo uso. */
export const CODIGO_MINUTOS = 10;

/** Intentos antes de invalidar el codigo. Frena la fuerza bruta sobre 6 digitos. */
export const MAX_INTENTOS = 5;

/** Espera minima entre reenvios, para que el boton no sirva de altavoz de spam. */
export const REENVIO_SEGUNDOS = 60;

function clave(): Uint8Array {
  const secreto = process.env.NEXTAUTH_SECRET;
  if (!secreto) {
    throw new Error(
      "Falta NEXTAUTH_SECRET: sin el no se pueden firmar las sesiones de aprobacion"
    );
  }
  return new TextEncoder().encode(secreto);
}

export interface SesionAprobacion {
  /** Token de la campana al que esta atada la sesion. */
  token: string;
  /** Correo verificado. Es la traza de quien aprueba. */
  email: string;
}

export async function firmarSesionAprobacion(
  datos: SesionAprobacion
): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("influencer-manager")
    .setAudience("campaign-approval")
    .setExpirationTime(`${SESION_SEGUNDOS}s`)
    .sign(clave());
}

/**
 * Verifica la sesion y que corresponda al token de la URL.
 *
 * Comprobar el token es imprescindible: sin ello, quien verificara su
 * correo para una campana propia podria reutilizar la cookie para
 * abrir la aprobacion de OTRA campana distinta.
 */
export async function verificarSesionAprobacion(
  cookie: string | undefined,
  tokenDeLaUrl: string
): Promise<SesionAprobacion | null> {
  if (!cookie) return null;

  try {
    const { payload } = await jwtVerify(cookie, clave(), {
      issuer: "influencer-manager",
      audience: "campaign-approval",
    });

    const { token, email } = payload as unknown as SesionAprobacion;
    if (!token || !email || token !== tokenDeLaUrl) return null;

    return { token, email };
  } catch {
    return null;
  }
}

export function opcionesCookieAprobacion(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export const MAX_AGE_SESION_APROBACION = SESION_SEGUNDOS;

// ---------------------------------------------------------------------
// Codigo de un solo uso
// ---------------------------------------------------------------------

/** Codigo de 6 digitos con randomInt, que usa el generador criptografico. */
export function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Hash del codigo. SHA-256 basta y es lo deseable aqui: el codigo dura
 * 10 minutos y tiene los intentos limitados, asi que no hace falta un
 * hash lento como bcrypt, que ademas encarece cada comprobacion.
 */
export function hashearCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

/** Comparacion en tiempo constante, para no filtrar el codigo por la latencia. */
export function codigoCoincide(codigo: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashearCodigo(codigo), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Normaliza correos para compararlos: sin espacios y en minusculas. */
export function normalizarCorreo(valor: string): string {
  return valor.trim().toLowerCase();
}

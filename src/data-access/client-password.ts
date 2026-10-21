import { randomBytes, createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "./errors";

/**
 * Cuanto dura el enlace.
 *
 * Mas que el clasico de una hora de un "olvide mi contrasena", porque
 * este enlace tambien es el alta: la agencia crea el acceso y se lo
 * manda al cliente, que puede abrir el correo al dia siguiente. Un
 * enlace de una hora obligaria a reenviarlo casi siempre.
 *
 * Mas de un dia tampoco: el correo se queda en la bandeja del cliente y
 * mientras siga vivo es una llave de su cuenta.
 */
export const HORAS_DE_VALIDEZ = 24;

/** Freno al reenvio, como el del codigo de aprobacion. */
const SEGUNDOS_ENTRE_ENVIOS = 60;

/**
 * SHA-256 del token.
 *
 * Basta y es lo deseable: el token son 32 bytes aleatorios, no hay nada
 * que adivinar por fuerza bruta, asi que un hash lento como bcrypt solo
 * encareceria cada comprobacion. Es la misma eleccion que hace
 * `hashearCodigo` en approval-session.
 */
function hashearToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparacion en tiempo constante, para no filtrar el token por la latencia. */
function tokenCoincide(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export type ResultadoSolicitud =
  | {
      ok: true;
      token: string;
      expiresAt: Date;
      clientUserId: string;
      email: string;
      companyName: string;
    }
  | { ok: false; motivo: "SIN_CUENTA" | "INACTIVO" | "RECIENTE" };

/**
 * Pide un enlace para poner contrasena.
 *
 * Dice por que no se pudo, pero **el formulario publico no debe repetir
 * ese motivo**: tiene que contestar exactamente lo mismo exista el
 * correo o no, porque la diferencia revelaria que empresas son clientes
 * de la agencia. El motivo esta aqui para la auditoria y para la
 * pantalla de administracion, donde quien mira ya conoce al cliente. Es
 * la misma razon por la que `loginClient` da "credenciales invalidas"
 * tanto si el correo no existe como si la contrasena esta mal.
 *
 * `RECIENTE` frena el reenvio durante un minuto: sin eso, cualquiera
 * puede llenarle la bandeja de entrada a un cliente desde un formulario
 * publico. La agencia se lo salta con `saltarFreno`, porque llamar a esa
 * ruta exige sesion y permiso de administracion.
 *
 * Al emitir uno nuevo se invalidan los anteriores. Si no, un correo
 * viejo seguiria sirviendo para entrar despues de que el cliente pidiera
 * otro precisamente porque sospechaba del primero.
 */
export async function solicitarEnlaceDeContrasena(
  email: string,
  origen: "PORTAL" | "AGENCIA" = "PORTAL",
  saltarFreno = false
): Promise<ResultadoSolicitud> {
  const correo = email.trim().toLowerCase();

  const clientUser = await prisma.clientUser.findUnique({
    where: { email: correo },
    select: {
      id: true,
      email: true,
      isActive: true,
      client: { select: { companyName: true } },
    },
  });

  if (!clientUser) return { ok: false, motivo: "SIN_CUENTA" };
  if (!clientUser.isActive) return { ok: false, motivo: "INACTIVO" };

  if (!saltarFreno) {
    const reciente = await prisma.clientPasswordReset.findFirst({
      where: {
        clientUserId: clientUser.id,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - SEGUNDOS_ENTRE_ENVIOS * 1000) },
      },
      select: { id: true },
    });

    if (reciente) return { ok: false, motivo: "RECIENTE" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + HORAS_DE_VALIDEZ * 60 * 60 * 1000);

  // Los anteriores dejan de servir. Se marcan como usados en vez de
  // borrarse para que la auditoria conserve cuantos se pidieron.
  await prisma.clientPasswordReset.updateMany({
    where: { clientUserId: clientUser.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.clientPasswordReset.create({
    data: {
      tokenHash: hashearToken(token),
      expiresAt,
      origen,
      clientUserId: clientUser.id,
    },
  });

  return {
    ok: true,
    token,
    expiresAt,
    clientUserId: clientUser.id,
    email: clientUser.email,
    companyName: clientUser.client.companyName,
  };
}

/**
 * Comprueba un enlace sin gastarlo.
 *
 * La pagina lo llama al abrirse para saber si puede pintar el
 * formulario. Lanza con un codigo que la interfaz traduce, en vez de un
 * texto, porque "caducado" y "ya usado" se explican distinto.
 */
export async function clienteDelEnlace(token: string) {
  const registro = await prisma.clientPasswordReset.findUnique({
    where: { tokenHash: hashearToken(token) },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      tokenHash: true,
      clientUser: {
        select: {
          id: true,
          email: true,
          isActive: true,
          client: { select: { companyName: true } },
        },
      },
    },
  });

  if (!registro) throw new ValidationError("ENLACE_INVALIDO");
  // La busqueda ya fue por el hash, pero compararlo otra vez en tiempo
  // constante no cuesta nada y cierra el canal lateral.
  if (!tokenCoincide(registro.tokenHash, hashearToken(token))) {
    throw new ValidationError("ENLACE_INVALIDO");
  }
  if (registro.usedAt) throw new ValidationError("ENLACE_USADO");
  if (registro.expiresAt < new Date()) throw new ValidationError("ENLACE_CADUCADO");
  if (!registro.clientUser.isActive) throw new ValidationError("ACCESO_INACTIVO");

  return {
    registroId: registro.id,
    clientUserId: registro.clientUser.id,
    email: registro.clientUser.email,
    companyName: registro.clientUser.client.companyName,
  };
}

/**
 * Pone la contrasena y gasta el enlace.
 *
 * Tambien levanta el bloqueo por intentos fallidos. Quien no recuerda su
 * contrasena suele probar hasta quedarse bloqueado y solo entonces pide
 * el enlace: dejarle elegir una nueva y seguir sin poder entrar media
 * hora seria no haber resuelto nada.
 *
 * Las dos escrituras van en una transaccion. Si se marcara el enlace
 * como usado y fallara el cambio de contrasena, el cliente se quedaria
 * sin enlace y sin contrasena nueva.
 */
export async function establecerContrasenaConEnlace(
  token: string,
  password: string
) {
  const datos = await clienteDelEnlace(token);

  if (!password || password.length < 6) {
    throw new ValidationError("La contraseña debe tener al menos 6 caracteres");
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.clientUser.update({
      where: { id: datos.clientUserId },
      data: { password: hash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.clientPasswordReset.update({
      where: { id: datos.registroId },
      data: { usedAt: new Date() },
    }),
  ]);

  return datos;
}

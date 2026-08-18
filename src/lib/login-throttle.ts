/**
 * Freno a la fuerza bruta en los formularios de acceso.
 *
 * Antes no habia ninguno: con el dominio publico, probar contrasenas
 * contra /api/auth/callback/credentials no encontraba resistencia
 * alguna. bcrypt hace lento cada intento, pero lento no es imposible.
 *
 * La cuenta se lleva POR CUENTA y no por IP. Dos motivos: NextAuth no
 * expone la IP dentro de authorize(), y la IP es lo primero que rota
 * quien ataca en serio, asi que limitar por IP da una sensacion de
 * proteccion mayor que la real.
 *
 * El bloqueo es TEMPORAL a proposito. Uno permanente convertiria el
 * formulario en un arma: cualquiera podria dejar fuera a un companero
 * fallando cinco veces con su correo, y haria falta un administrador
 * para desbloquearlo.
 */

export const MAX_INTENTOS_LOGIN = 5;
export const BLOQUEO_MINUTOS = 15;

/** Mensaje generico. NUNCA distingue "no existe" de "contrasena mala". */
export const CREDENCIALES_INVALIDAS = "Email o contraseña incorrectos";

export interface EstadoIntentos {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/** Minutos que faltan para que expire el bloqueo, redondeados hacia arriba. */
export function minutosRestantes(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
}

export function estaBloqueado(estado: EstadoIntentos): boolean {
  return Boolean(estado.lockedUntil && estado.lockedUntil.getTime() > Date.now());
}

/**
 * Mensaje del bloqueo.
 *
 * Revela que la cuenta existe, si. Es un intercambio aceptado: quien ha
 * fallado cinco veces contra ese correo concreto ya lo sospechaba, y la
 * alternativa es dejar a un usuario legitimo sin entender por que no
 * entra.
 */
export function mensajeBloqueo(lockedUntil: Date): string {
  return `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutosRestantes(
    lockedUntil
  )} minutos.`;
}

/**
 * Calcula como queda la cuenta tras un intento fallido.
 *
 * Al alcanzar el maximo se bloquea y el contador vuelve a cero, de modo
 * que tras cumplir el castigo se dispone de otra tanda completa en vez
 * de quedar bloqueado a perpetuidad al primer fallo siguiente.
 */
export function trasFalloDeLogin(intentosPrevios: number): EstadoIntentos {
  const intentos = intentosPrevios + 1;

  if (intentos >= MAX_INTENTOS_LOGIN) {
    return {
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000),
    };
  }

  return { failedLoginAttempts: intentos, lockedUntil: null };
}

/** Estado limpio tras un acceso correcto. */
export const TRAS_LOGIN_CORRECTO: EstadoIntentos = {
  failedLoginAttempts: 0,
  lockedUntil: null,
};

/**
 * Authentication API services
 */

import { apiGet, apiPost } from "./api";
import type { ClientLoginPayload } from "@/lib/schemas/auth";

// Re-export types from schemas
export type { ClientLoginPayload };

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type { ClientLoginResult } from "@/models/auth";
import type { ClientLoginResult } from "@/models/auth";

// =============================================================================
// Auth Operations
// =============================================================================

/**
 * Client portal login
 */
export async function clientLogin(payload: ClientLoginPayload): Promise<ClientLoginResult> {
  return apiPost<ClientLoginResult>("/api/client-auth/login", payload);
}

/**
 * Pide por correo un enlace para elegir contrasena en el portal.
 *
 * La respuesta es siempre la misma exista el correo o no, asi que no
 * hay nada que comprobar: lo unico que se puede decirle a quien lo
 * rellena es "si ese correo tiene acceso, le hemos escrito".
 */
export async function pedirEnlaceDeContrasena(
  email: string
): Promise<{ ok: boolean; mensaje: string }> {
  return apiPost("/api/client-auth/recuperar", { email });
}

/** Comprueba un enlace sin gastarlo, para saber si pintar el formulario. */
export async function comprobarEnlaceDeContrasena(
  token: string
): Promise<{ email: string; companyName: string }> {
  return apiGet(`/api/client-auth/restablecer/${token}`);
}

/** Pone la contrasena y gasta el enlace. */
export async function establecerContrasenaDelPortal(
  token: string,
  password: string
): Promise<{ ok: boolean }> {
  return apiPost(`/api/client-auth/restablecer/${token}`, { password });
}

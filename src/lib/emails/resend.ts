import { Resend } from "resend";

/**
 * Envio de correo transaccional con Resend.
 *
 * Antes este modulo fallaba en silencio de tres maneras distintas y las
 * tres eran indistinguibles desde fuera: devolvia { success: false } sin
 * decir por que, creaba el cliente al cargar el modulo (una clave
 * anadida despues no se veia hasta reiniciar) y, si faltaba el
 * remitente, usaba onboarding@resend.dev, que Resend SOLO entrega al
 * dueno de la cuenta: la API responde 200, el log queda limpio y el
 * cliente nunca recibe nada.
 *
 * Ahora cada salida dice su motivo con un codigo estable, para que
 * quien llama pueda avisar al usuario en vez de dar por hecho que se
 * envio.
 */

export type MotivoFalloEmail =
  | "deshabilitado"
  | "sin_clave"
  | "clave_con_formato_invalido"
  | "sin_remitente"
  | "error_del_proveedor";

export type ResultadoEmail =
  | { success: true; id?: string }
  | { success: false; reason: MotivoFalloEmail; error: string };

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Comprueba la configuracion SIN enviar nada.
 *
 * Se expone aparte para que el script de diagnostico y el propio envio
 * usen exactamente la misma logica, y no puedan discrepar.
 */
export function revisarConfiguracionEmail():
  | { ok: true; from: string; apiKey: string }
  | { ok: false; reason: MotivoFalloEmail; error: string } {
  if (process.env.ENABLE_EMAILS !== "true") {
    return {
      ok: false,
      reason: "deshabilitado",
      error:
        'Los envios estan apagados: ENABLE_EMAILS debe valer exactamente "true" (no "1", ni "True", ni vacia)',
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      reason: "sin_clave",
      error: "Falta RESEND_API_KEY",
    };
  }

  // Las claves de Resend empiezan por "re_". Comprobarlo aqui convierte
  // un 400 "API key is invalid" del proveedor, que no dice donde mirar,
  // en un mensaje que senala la variable exacta.
  if (!apiKey.startsWith("re_")) {
    return {
      ok: false,
      reason: "clave_con_formato_invalido",
      error: `RESEND_API_KEY no parece una clave de Resend: empieza por "${apiKey.slice(0, 3)}" y deberia empezar por "re_"`,
    };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    return {
      ok: false,
      reason: "sin_remitente",
      error:
        "Falta RESEND_FROM_EMAIL. No se usa un remitente por defecto a proposito: onboarding@resend.dev solo entrega al dueno de la cuenta y el destinatario real no recibiria nada",
    };
  }

  return { ok: true, from, apiKey };
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<ResultadoEmail> {
  const config = revisarConfiguracionEmail();

  if (!config.ok) {
    // "deshabilitado" es una decision, no una averia: no ensucia el log.
    if (config.reason !== "deshabilitado") {
      console.warn(`[email] No se envia a ${to}: ${config.error}`);
    }
    return { success: false, reason: config.reason, error: config.error };
  }

  try {
    // El cliente se crea aqui, no al cargar el modulo, para que lea
    // siempre la configuracion vigente.
    const resend = new Resend(config.apiKey);

    const { data, error } = await resend.emails.send({
      from: config.from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`[email] Resend rechazo el envio a ${to}:`, error);
      return {
        success: false,
        reason: "error_del_proveedor",
        error: error.message || JSON.stringify(error),
      };
    }

    console.log(`[email] Enviado a ${to} (id: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error(`[email] Fallo inesperado enviando a ${to}:`, err);
    return {
      success: false,
      reason: "error_del_proveedor",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

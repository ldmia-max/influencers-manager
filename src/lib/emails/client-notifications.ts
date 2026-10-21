import { sendEmail, type ResultadoEmail } from "./resend";
import { enlaceContrasenaPortalTemplate } from "./templates";

/**
 * Manda el enlace para elegir contrasena en el portal.
 *
 * Como el resto de notificaciones, hace `await` y DEVUELVE el resultado
 * a quien la llama. Un `sendEmail(...).catch(console.error)` falla por
 * partida doble: la promesa puede cortarse al responder la peticion, y
 * el fallo no llega a nadie —el boton diria "enviado" sin que haya
 * salido nada—.
 */
export async function notifyEnlaceContrasena(params: {
  destino: string;
  companyName: string;
  url: string;
  expiresAt: Date;
  esAlta: boolean;
}): Promise<ResultadoEmail> {
  const template = enlaceContrasenaPortalTemplate({
    companyName: params.companyName,
    url: params.url,
    expiresAt: params.expiresAt,
    esAlta: params.esAlta,
  });

  return sendEmail({ to: params.destino, ...template });
}

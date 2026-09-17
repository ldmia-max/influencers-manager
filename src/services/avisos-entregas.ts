import {
  avisosDelDia,
  registrarAvisos,
  DIAS_DE_AVISO,
} from "@/data-access/avisos-entregas";
import { notifyVencimientos } from "@/lib/emails/campaign-notifications";

/**
 * El envio de los avisos de vencimiento.
 *
 * Vive aqui y no dentro de la ruta para que /api/cron/diario pueda
 * reutilizarlo: una ruta importando de otra ruta funciona, pero ata dos
 * archivos que Next trata como puntos de entrada independientes.
 */
export interface ResumenDeAvisos {
  destinatarios: number;
  enviados: number;
  fallidos: { email: string; motivo: string }[];
  proximos: number;
  vencidos: number;
  recordados: number;
}

/**
 * El trabajo en si, separado de la ruta para que /api/cron/diario pueda
 * reutilizarlo sin hacerse una peticion HTTP a si mismo.
 *
 * El registro se escribe DESPUES de que el correo salga: si el envio
 * falla, manana se vuelve a intentar. Al reves —marcar y luego enviar—
 * un fallo de Resend dejaria el aviso por enviado para siempre.
 */
export async function enviarAvisosDeEntregas(): Promise<ResumenDeAvisos> {
  const ahora = new Date();
  const personas = await avisosDelDia(ahora);

  const resumen: ResumenDeAvisos = {
    destinatarios: personas.length,
    enviados: 0,
    fallidos: [],
    proximos: 0,
    vencidos: 0,
    recordados: 0,
  };

  for (const persona of personas) {
    const envio = await notifyVencimientos({
      email: persona.email,
      nombre: persona.nombre,
      proximos: persona.proximos,
      vencidos: persona.vencidos,
      resumen: persona.resumen,
      sinFecha: persona.sinFecha,
      diasDeAviso: DIAS_DE_AVISO,
    });

    if (!envio.success) {
      resumen.fallidos.push({ email: persona.email, motivo: envio.error });
      continue;
    }

    await registrarAvisos(persona, ahora);
    resumen.enviados++;
    resumen.proximos += persona.proximos.length;
    resumen.vencidos += persona.vencidos.length;
    resumen.recordados += persona.resumen.length;
  }

  console.log(
    `[cron/entregas] ${resumen.enviados} de ${resumen.destinatarios} correos ·` +
      ` ${resumen.vencidos} vencidas, ${resumen.proximos} por vencer,` +
      ` ${resumen.recordados} recordadas`
  );
  return resumen;
}

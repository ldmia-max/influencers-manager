import { sendEmail, type ResultadoEmail } from "./resend";
import { avisoDePagoTemplate, pagoRealizadoTemplate } from "./templates";
import { periodoLegible } from "@/lib/campaign-utils";
import type { PagoVista } from "@/data-access/pagos";

/**
 * A donde va el aviso de que un pago tiene sus papeles.
 *
 * Sale de una variable de entorno y no del codigo: el buzon es una
 * decision de la agencia, y cambiarlo no deberia pedir un despliegue
 * nuevo, solo editar la variable en Dokploy y reiniciar.
 */
export function destinoDelAvisoDePago(): string | null {
  return process.env.CORREO_AVISO_PAGOS?.trim() || null;
}

/**
 * Avisa a contabilidad de que ya se puede pagar a un influencer.
 *
 * Hace `await` y devuelve el resultado, como todas las notificaciones:
 * la fecha de "Envió" solo se escribe si el correo salio de verdad.
 */
export async function notifyAvisoDePago(params: {
  destino: string;
  pago: PagoVista;
  enviadoPor: string;
}): Promise<ResultadoEmail> {
  const { pago } = params;
  const [anio, mes] = pago.mesCampana.split("-").map(Number);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const template = avisoDePagoTemplate({
    influencer: pago.influencer,
    nombreCompleto: pago.nombreCompleto,
    documentoIdentidad: pago.documentoIdentidad,
    campana: pago.campana,
    cliente: pago.cliente,
    periodo: periodoLegible(anio, mes),
    base: pago.base,
    fechaCuentaCobro: pago.fechaCuentaCobro,
    documentos: [
      { etiqueta: "Cuenta de cobro", nombre: pago.cuentaCobroNombre },
      { etiqueta: "Certificado bancario", nombre: pago.certificadoNombre },
      { etiqueta: "Contrato", nombre: pago.contratoNombre },
      ...(pago.rutUrl ? [{ etiqueta: "RUT", nombre: pago.rutNombre }] : []),
      ...(pago.arlUrl ? [{ etiqueta: "ARL", nombre: pago.arlNombre }] : []),
      ...pago.otros.map((o) => ({ etiqueta: "Otro", nombre: o.nombre })),
    ],
    enviadoPor: params.enviadoPor,
    url: `${baseUrl}/pagos`,
  });

  return sendEmail({ to: params.destino, ...template });
}

/**
 * A donde va el aviso de que un influencer ya quedo pagado.
 *
 * Variable de entorno por la misma razon que el aviso de documentos:
 * cambiar quien lo recibe es editar la variable y reiniciar.
 */
export function destinoDelPagoRealizado(): string | null {
  return process.env.CORREO_PAGO_REALIZADO?.trim() || null;
}

/**
 * Avisa de que contabilidad pago a un influencer.
 *
 * Devuelve el resultado en vez de lanzar: el pago ya esta guardado
 * cuando esto corre, y un correo caido no debe hacer creer que el pago
 * fallo. Quien llama decide como contarlo.
 */
export async function notifyPagoRealizado(params: {
  destino: string;
  pago: PagoVista;
  valorPagado: number;
  fechaPago: Date;
  registradoPor: string;
}): Promise<ResultadoEmail> {
  const { pago } = params;
  const [anio, mes] = pago.mesCampana.split("-").map(Number);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const template = pagoRealizadoTemplate({
    influencer: pago.influencer,
    nombreCompleto: pago.nombreCompleto,
    documentoIdentidad: pago.documentoIdentidad,
    campana: pago.campana,
    cliente: pago.cliente,
    periodo: periodoLegible(anio, mes),
    valorPagado: params.valorPagado,
    fechaPago: params.fechaPago.toISOString(),
    documentoDian: pago.documento,
    registradoPor: params.registradoPor,
    url: `${baseUrl}/pagos`,
  });

  return sendEmail({ to: params.destino, ...template });
}

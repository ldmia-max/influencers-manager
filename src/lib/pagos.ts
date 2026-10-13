/**
 * Estado y plazo de un pago a un influencer.
 *
 * Nada de esto se guarda: se deduce de los hechos —que documentos hay y
 * desde cuando corre la cuenta de cobro—. Un estado en columna obliga a
 * que alguien lo mantenga al dia, y el dia que no lo haga dira que algo
 * esta pendiente cuando ya se pago, sin que nadie se entere. Es la misma
 * razon por la que el estado de una entrega tampoco se guarda
 * (src/lib/entregas.ts).
 *
 * Modulo PURO: lo usan el servidor y el navegador, asi que no importa
 * Prisma ni nada de Node.
 */

import { diaEnAgencia } from "./fechas-agencia";

/** Dias de plazo desde la cuenta de cobro. Acordado con contabilidad. */
export const DIAS_DE_PLAZO = 60;

export type EstadoPago =
  /** Mercadeo todavia no aporto la cuenta de cobro o el certificado. */
  | "PENDIENTE_DOCUMENTOS"
  /** Estan los dos documentos; contabilidad aun no lo registro. */
  | "DOCUMENTOS_RECIBIDOS"
  /** Contabilidad le asigno documento: a partir de aqui corre el plazo. */
  | "REGISTRADO";

export const ETIQUETA_PAGO: Record<EstadoPago, string> = {
  PENDIENTE_DOCUMENTOS: "Faltan documentos",
  DOCUMENTOS_RECIBIDOS: "Documentos recibidos",
  REGISTRADO: "Registrado",
};

export const COLOR_PAGO: Record<EstadoPago, string> = {
  PENDIENTE_DOCUMENTOS: "bg-gray-100 text-gray-700",
  DOCUMENTOS_RECIBIDOS: "bg-amber-100 text-amber-800",
  REGISTRADO: "bg-green-100 text-green-800",
};

export interface DatosDePago {
  cuentaCobroUrl: string | null;
  certificadoUrl: string | null;
  fechaCuentaCobro: string | null;
  documento: string | null;
}

/**
 * En que punto esta el pago.
 *
 * El orden importa: registrado manda sobre todo lo demas, porque si
 * contabilidad ya lo tomo, que falte un adjunto es un problema de
 * archivo, no del pago.
 */
export function estadoDePago(pago: DatosDePago | null): EstadoPago {
  if (!pago) return "PENDIENTE_DOCUMENTOS";
  if (pago.documento?.trim()) return "REGISTRADO";
  if (pago.cuentaCobroUrl && pago.certificadoUrl) return "DOCUMENTOS_RECIBIDOS";
  return "PENDIENTE_DOCUMENTOS";
}

export interface Plazo {
  /** El dia en que vence, "YYYY-MM-DD" en la zona de la agencia. */
  vence: string;
  /**
   * Dias que faltan. Negativo si ya paso.
   *
   * La hoja de calculo mostraba en esta columna los dias TRANSCURRIDOS
   * desde la cuenta de cobro, que con un plazo de 60 dias no dice lo
   * que hace falta saber.
   */
  diasRestantes: number;
  vencido: boolean;
}

/**
 * El plazo de un pago. Null mientras no haya cuenta de cobro: sin ella
 * no hay desde cuando contar.
 *
 * Los dias se cuentan en la zona de la agencia. El contenedor corre en
 * UTC y el equipo trabaja en Colombia; comparar instantes crudos
 * desplaza un dia justo en el borde.
 */
export function plazoDePago(
  fechaCuentaCobro: string | Date | null,
  ahora: Date = new Date()
): Plazo | null {
  if (!fechaCuentaCobro) return null;

  const desde = new Date(fechaCuentaCobro);
  if (Number.isNaN(desde.getTime())) return null;

  const vencimiento = new Date(desde);
  vencimiento.setDate(vencimiento.getDate() + DIAS_DE_PLAZO);

  const vence = diaEnAgencia(vencimiento);
  const hoy = diaEnAgencia(ahora);

  // Diferencia en dias entre dos fechas ya reducidas a "YYYY-MM-DD":
  // asi no quedan horas sueltas que conviertan 24h en 2 dias.
  const aUtc = (dia: string) => Date.UTC(...(dia.split("-").map(Number) as [number, number, number]));
  const diasRestantes = Math.round(
    (aUtc(vence) - aUtc(hoy)) / (24 * 60 * 60 * 1000)
  );

  return { vence, diasRestantes, vencido: diasRestantes < 0 };
}

/** El mes al que pertenece el pago, "YYYY-MM". Null sin cuenta de cobro. */
export function mesDelPago(fechaCuentaCobro: string | Date | null): string | null {
  if (!fechaCuentaCobro) return null;
  const f = new Date(fechaCuentaCobro);
  if (Number.isNaN(f.getTime())) return null;
  return diaEnAgencia(f).slice(0, 7);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-08" -> "agosto 2026". */
export function mesLegible(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m} ${ano}`;
}

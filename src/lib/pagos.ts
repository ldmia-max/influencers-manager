/**
 * Impuestos, plazo y estado de un pago a un influencer.
 *
 * Casi nada de esto se guarda: se calcula de los hechos —la base
 * contratada, el tipo de persona, la fecha de la cuenta de cobro y los
 * abonos—. Un importe en columna obliga a que alguien lo mantenga al
 * dia, y en las hojas de calculo eso ya fallo: hay filas con la
 * retencion en blanco no porque no aplique, sino porque se olvido
 * teclearla. Calculado, no se puede olvidar.
 *
 * Modulo PURO: lo usan el servidor y el navegador, asi que no importa
 * Prisma ni nada de Node.
 */

import { diaEnAgencia } from "./fechas-agencia";

/** Dias de plazo desde la cuenta de cobro. Acordado con contabilidad. */
export const DIAS_DE_PLAZO = 60;

/**
 * Desde que dia se avisa.
 *
 * En la hoja lo pintaban a mano a partir del 50 y se les escapaban
 * filas: estaban marcados el 51, 63, 64, 66 y 72, pero no el 65, el 71
 * ni el 73. Calculado, no se escapa ninguno.
 */
export const DIAS_PARA_AVISAR = 50;

export type TipoPersona = "NATURAL" | "JURIDICA";

/**
 * Lo que aplica a cada tipo.
 *
 * La retencion se calcula sobre la BASE, no sobre la factura con IVA.
 * Comprobado contra las dos filas juridicas de la hoja: Fly Pasion sas
 * (5.000.000 → IVA 950.000, retencion 550.000, a pagar 5.400.000) y Oh
 * mai kat (10.730.337 → IVA 2.038.764, retencion 1.180.337, a pagar
 * 11.588.764).
 *
 * El reteiva no figura: solo lo practica un gran contribuyente y la
 * agencia no lo es, asi que es cero siempre. La columna se pinta igual,
 * en cero, porque el equipo la tiene en su hoja.
 */
export const TARIFAS: Record<TipoPersona, { iva: number; retencion: number }> = {
  NATURAL: { iva: 0, retencion: 0.1 },
  JURIDICA: { iva: 0.19, retencion: 0.11 },
};

export const ETIQUETA_TIPO_PERSONA: Record<TipoPersona, string> = {
  NATURAL: "Persona natural",
  JURIDICA: "Persona jurídica",
};

export interface Impuestos {
  base: number;
  iva: number;
  valorFactura: number;
  retencion: number;
  /** Siempre cero: la agencia no es gran contribuyente. */
  reteiva: number;
  valorAPagar: number;
}

export function calcularImpuestos(base: number, tipo: TipoPersona): Impuestos {
  const { iva: tarifaIva, retencion: tarifaRetencion } = TARIFAS[tipo];
  const iva = Math.round(base * tarifaIva);
  const retencion = Math.round(base * tarifaRetencion);
  const valorFactura = base + iva;
  return {
    base,
    iva,
    valorFactura,
    retencion,
    reteiva: 0,
    valorAPagar: valorFactura - retencion,
  };
}

/**
 * Lo que costaria con cada tipo, mientras no se sepa cual es.
 *
 * El influencer a veces firma sin saber como factura, y solo al llegar
 * el RUT se confirma. Hasta entonces se ensenian las dos cifras en vez
 * de prometer una: es lo que mercadeo hace hoy calculando IVA y
 * retencion de una vez.
 */
export function hipotesis(base: number): Record<TipoPersona, Impuestos> {
  return {
    NATURAL: calcularImpuestos(base, "NATURAL"),
    JURIDICA: calcularImpuestos(base, "JURIDICA"),
  };
}

/**
 * Lo que hay que reservar de presupuesto cuando no se sabe el tipo.
 *
 * Es `base + IVA`, el peor caso. La retencion no entra: se le descuenta
 * al influencer pero se le paga a la DIAN, asi que no cambia cuanto
 * sale de caja.
 */
export function reservaMaxima(base: number): number {
  return calcularImpuestos(base, "JURIDICA").valorFactura;
}

/**
 * Lo que la agencia se queda de ese influencer.
 *
 * Del 40% que se le carga al cliente, 10 puntos son utilidad; los otros
 * 30 cubren el IVA y la retefuente. Si el influencer factura como
 * natural no cobra IVA, asi que esos 19 puntos tampoco salen y se
 * quedan tambien como utilidad.
 *
 * Mientras no se sabe como factura se devuelve el 10%, que es lo
 * prudente: contar con los 19 puntos de alguien que puede resultar
 * juridico seria prometer un margen que quiza no exista.
 */
export function utilidadDe(base: number, tipo: TipoPersona | null): number {
  const utilidad = base * 0.1;
  return tipo === "NATURAL" ? utilidad + base * TARIFAS.JURIDICA.iva : utilidad;
}

export type EstadoPago =
  /** Mercadeo todavia no aporto la documentacion. */
  | "PENDIENTE_DOCUMENTOS"
  /** Estan los documentos; contabilidad aun no lo registro. */
  | "DOCUMENTOS_RECIBIDOS"
  /** Registrado en la DIAN: corre el plazo y falta pagarlo. */
  | "REGISTRADO"
  /** Hay abonos pero todavia queda saldo. */
  | "PAGO_PARCIAL"
  /** Saldo en cero: esta campana ya no pide mas dinero por el. */
  | "PAGADO";

export const ETIQUETA_PAGO: Record<EstadoPago, string> = {
  PENDIENTE_DOCUMENTOS: "Faltan documentos",
  DOCUMENTOS_RECIBIDOS: "Documentos recibidos",
  REGISTRADO: "Registrado",
  PAGO_PARCIAL: "Pago parcial",
  PAGADO: "Pagado",
};

export const COLOR_PAGO: Record<EstadoPago, string> = {
  PENDIENTE_DOCUMENTOS: "bg-gray-100 text-gray-700",
  DOCUMENTOS_RECIBIDOS: "bg-amber-100 text-amber-800",
  REGISTRADO: "bg-violet-100 text-violet-800",
  PAGO_PARCIAL: "bg-sky-100 text-sky-800",
  PAGADO: "bg-green-100 text-green-800",
};

export interface DatosDePago {
  cuentaCobroUrl: string | null;
  certificadoUrl: string | null;
  documento: string | null;
  loPagaElCliente: boolean;
  /** Cuanto falta por pagar. */
  saldo: number;
  /** Cuanto se lleva abonado. */
  abonado: number;
}

/**
 * En que punto esta el pago.
 *
 * El orden importa y va de lo mas avanzado a lo menos: una vez pagado,
 * que falte un adjunto es un problema de archivo, no del pago.
 */
export function estadoDePago(pago: DatosDePago | null): EstadoPago {
  if (!pago) return "PENDIENTE_DOCUMENTOS";
  if (pago.abonado > 0 && pago.saldo <= 0) return "PAGADO";
  if (pago.abonado > 0) return "PAGO_PARCIAL";
  if (pago.documento?.trim()) return "REGISTRADO";

  // Lo que paga el cliente no pasa por la documentacion: la agencia no
  // le pide cuenta de cobro a nadie, solo espera la confirmacion.
  if (pago.loPagaElCliente) return "REGISTRADO";

  // Solo la cuenta de cobro y el certificado son imprescindibles. El
  // RUT y la ARL son opcionales: ayudan a confirmar como factura, pero
  // su ausencia no impide registrar ni pagar.
  if (pago.cuentaCobroUrl && pago.certificadoUrl) return "DOCUMENTOS_RECIBIDOS";
  return "PENDIENTE_DOCUMENTOS";
}

export interface Plazo {
  /**
   * Dias transcurridos desde la cuenta de cobro, de 1 en 1 hasta 60.
   *
   * Cuenta hacia arriba, como en la hoja: el equipo lee "va por 51" y
   * sabe que le quedan nueve. Lo comprobe contra sus 17 filas.
   */
  dias: number;
  /** El dia en que se cumplen los 60, "YYYY-MM-DD". */
  vence: string;
  /** Desde el dia 50: hay que pagar pronto. */
  avisar: boolean;
  /** Pasados los 60. */
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

  const dias = diasEntre(diaEnAgencia(desde), diaEnAgencia(ahora));

  return {
    dias,
    vence: diaEnAgencia(vencimiento),
    avisar: dias >= DIAS_PARA_AVISAR,
    vencido: dias > DIAS_DE_PLAZO,
  };
}

/**
 * Dias entre dos fechas ya reducidas a "YYYY-MM-DD".
 *
 * Sobre los dias, no sobre los instantes: asi no quedan horas sueltas
 * que conviertan 24h en 2 dias segun a que hora se mire.
 */
function diasEntre(desde: string, hasta: string): number {
  const aUtc = (dia: string) =>
    Date.UTC(...(dia.split("-").map(Number) as [number, number, number]));
  return Math.round((aUtc(hasta) - aUtc(desde)) / (24 * 60 * 60 * 1000));
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

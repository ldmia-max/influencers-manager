import { z } from "zod";

const adjunto = z.object({
  url: z.string().min(1),
  nombre: z.string().min(1).max(200),
});

const tipoPersona = z.enum(["NATURAL", "JURIDICA"]);

/**
 * Un dia de calendario escrito en un formulario, guardado a mediodia UTC.
 *
 * `new Date("2026-11-01")` da la medianoche UTC, que en Bogota son las
 * 19:00 del 31 de octubre: se guardaba bien y se leia un dia antes en
 * todas partes, el plazo incluido. A mediodia queda margen a los dos
 * lados y no cambia de dia en ninguna zona.
 */
const dia = z.preprocess(
  (v) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? `${v}T12:00:00.000Z`
      : v,
  z.coerce.date()
);

/**
 * Lo que aporta mercadeo: los documentos, la fecha desde la que corre el
 * plazo y el tipo de persona que se pactó al negociar.
 *
 * Imprescindibles son tres: la cuenta de cobro, el certificado bancario
 * y el contrato. El RUT y la ARL son opcionales —ayudan a confirmar cómo
 * factura—, así que su ausencia no frena el registro.
 *
 * `null` retira un adjunto o deja el tipo en "todavía no se sabe";
 * ausente lo deja como estaba.
 */
export const documentacionPagoSchema = z
  .object({
    cuentaCobro: adjunto.nullish(),
    certificado: adjunto.nullish(),
    rut: adjunto.nullish(),
    arl: adjunto.nullish(),
    contrato: adjunto.nullish(),
    fechaCuentaCobro: dia.nullish(),
    tipoPersona: tipoPersona.nullish(),
    observaciones: z.string().max(1000).nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que cambiar",
  });

/**
 * Un papel suelto que se suma a la documentación.
 *
 * Sin `null`, al revés que los de arriba: aquí no se reemplaza nada, se
 * añade. Para quitar uno está el DELETE con su id.
 */
export const otroDocumentoSchema = adjunto;

/** Lo que anota contabilidad. */
export const registroPagoSchema = z
  .object({
    documento: z.string().max(100).nullish(),
    fechaDocumento: dia.nullish(),
    fechaCuentaCobro: dia.nullish(),
    tipoPersona: tipoPersona.nullish(),
    /** Positivo o negativo. La capa de datos exige motivo si no es cero. */
    ajuste: z.coerce.number().nullish(),
    motivoAjuste: z.string().max(300).nullish(),
    loPagaElCliente: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que cambiar",
  });

/** Un pago parcial contra el saldo. */
export const abonoSchema = z.object({
  fecha: dia,
  valor: z.coerce
    .number({ message: "Escribe un número" })
    .positive("El valor debe ser mayor que cero"),
  observacion: z.string().max(300).nullish(),
});

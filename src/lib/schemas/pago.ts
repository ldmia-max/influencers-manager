import { z } from "zod";

const adjunto = z.object({
  url: z.string().min(1),
  nombre: z.string().min(1).max(200),
});

const tipoPersona = z.enum(["NATURAL", "JURIDICA"]);

/**
 * Lo que aporta mercadeo: los documentos, la fecha desde la que corre el
 * plazo y el tipo de persona que se pactó al negociar.
 *
 * Imprescindibles son dos, la cuenta de cobro y el certificado bancario.
 * El RUT y la ARL son opcionales —la ARL además solo se le pide a quien
 * factura como jurídica—, así que su ausencia no frena el registro.
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
    fechaCuentaCobro: z.coerce.date().nullish(),
    tipoPersona: tipoPersona.nullish(),
    observaciones: z.string().max(1000).nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que cambiar",
  });

/** Lo que anota contabilidad. */
export const registroPagoSchema = z
  .object({
    documento: z.string().max(100).nullish(),
    fechaDocumento: z.coerce.date().nullish(),
    fechaCuentaCobro: z.coerce.date().nullish(),
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
  fecha: z.coerce.date(),
  valor: z.coerce
    .number({ message: "Escribe un número" })
    .positive("El valor debe ser mayor que cero"),
  observacion: z.string().max(300).nullish(),
});

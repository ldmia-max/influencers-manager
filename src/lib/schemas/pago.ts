import { z } from "zod";

/**
 * Lo que aporta mercadeo: los documentos y la fecha desde la que corre
 * el plazo. `null` retira un adjunto; ausente lo deja como estaba.
 */
const adjunto = z.object({
  url: z.string().min(1),
  nombre: z.string().min(1).max(200),
});

export const documentacionPagoSchema = z
  .object({
    cuentaCobro: adjunto.nullish(),
    certificado: adjunto.nullish(),
    fechaCuentaCobro: z.coerce.date().nullish(),
    observaciones: z.string().max(1000).nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que cambiar",
  });

/** Lo que anota contabilidad. */
export const registroPagoSchema = z
  .object({
    documento: z.string().max(100).nullish(),
    fechaCuentaCobro: z.coerce.date().nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que cambiar",
  });

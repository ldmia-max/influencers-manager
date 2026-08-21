import { z } from "zod";

/**
 * La URL se valida a fondo en la capa de datos (`validarUrl`), que
 * ademas comprueba que el dominio sea de una red conocida. Aqui solo se
 * exige que venga algo con forma de texto: repetir la regla en dos
 * sitios garantiza que un dia dejen de coincidir.
 */
export const registrarEntregaSchema = z.object({
  campaignServiceId: z.string().min(1, "Falta el formato"),
  url: z.string().min(1, "Pega el link de la publicación"),
  publicadoEn: z.coerce.date().nullish(),
  notas: z.string().max(500, "Máximo 500 caracteres").nullish(),
});

export const actualizarEntregaSchema = z
  .object({
    url: z.string().min(1).optional(),
    publicadoEn: z.coerce.date().nullish(),
    notas: z.string().max(500).nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No hay nada que cambiar",
  });

export const fechaLimiteSchema = z.object({
  /** Null quita el plazo, dejando el formato «sin plazo». */
  fechaLimite: z.coerce.date().nullable(),
  /**
   * Aplica la misma fecha a todos los formatos de la campana. Es lo
   * habitual al arrancar; despues se afinan los que difieran.
   */
  aplicarATodos: z.boolean().optional(),
});

export const participacionSchema = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("retirar"),
    origen: z.enum(["INFLUENCER", "CLIENTE", "AGENCIA"], {
      message: "Indica quién decidió el retiro",
    }),
    motivo: z.string().max(500, "Máximo 500 caracteres").nullish(),
  }),
  z.object({ accion: z.literal("reactivar") }),
]);

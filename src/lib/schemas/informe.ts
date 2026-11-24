import { z } from "zod";

/**
 * El analisis general reescrito. Cada apartado es texto o null: null
 * (o vacio) devuelve ese apartado a la propuesta calculada.
 */
const apartado = z.string().max(1500).nullish();

export const analisisInformeSchema = z.object({
  alcance: apartado,
  visibilidad: apartado,
  interaccion: apartado,
  desempeno: apartado,
  eficiencia: apartado,
});

export type AnalisisInformeInput = z.infer<typeof analisisInformeSchema>;

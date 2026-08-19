import { z } from "zod";

export const busquedaIaSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Describe qué tipo de creador buscas")
    .max(500, "La descripción es demasiado larga"),
});

export type BusquedaIaPayload = z.infer<typeof busquedaIaSchema>;

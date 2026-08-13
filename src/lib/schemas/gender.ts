import { z } from "zod";

export const createGenderSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
});

export type CreateGenderPayload = z.infer<typeof createGenderSchema>;

import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().optional(),
});

export type CreateCategoryPayload = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().nullable().optional().transform(v => v ?? undefined),
  isActive: z.boolean().optional(),
});

export type UpdateCategoryPayload = z.infer<typeof updateCategorySchema>;

import { z } from "zod";

export const createPlatformSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  displayName: z.string().trim().min(1, "El nombre de display es requerido"),
});

export type CreatePlatformPayload = z.infer<typeof createPlatformSchema>;

export const updatePlatformSchema = z.object({
  isActive: z.boolean().optional(),
  displayName: z.string().trim().min(1).optional(),
});

export type UpdatePlatformPayload = z.infer<typeof updatePlatformSchema>;

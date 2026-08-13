import { z } from "zod";

export const createServiceTypeSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  displayName: z.string().trim().min(1, "El nombre de display es requerido"),
  platformId: z.string().min(1, "La plataforma es requerida"),
  profileTypes: z
    .array(z.enum(["INFLUENCER", "UGC", "BOTH"]))
    .min(1, "Al menos un tipo de perfil es requerido"),
});

export type CreateServiceTypePayload = z.infer<typeof createServiceTypeSchema>;

export const updateServiceTypeSchema = z.object({
  isActive: z.boolean().optional(),
  displayName: z.string().trim().min(1).optional(),
  profileTypes: z
    .array(z.enum(["INFLUENCER", "UGC", "BOTH"]))
    .min(1)
    .optional(),
});

export type UpdateServiceTypePayload = z.infer<typeof updateServiceTypeSchema>;

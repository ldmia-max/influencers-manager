import { z } from "zod";

export const createReachRangeSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es requerido"),
    displayName: z.string().trim().min(1, "El nombre de display es requerido"),
    minFollowers: z.number().int().min(0, "Mínimo de seguidores debe ser >= 0"),
    maxFollowers: z.number().int().positive().nullable(),
    reachPercentage: z
      .number()
      .min(0, "El porcentaje debe ser >= 0")
      .max(100, "El porcentaje debe ser <= 100"),
  })
  .refine(
    (data) => data.maxFollowers === null || data.maxFollowers > data.minFollowers,
    { message: "El máximo debe ser mayor que el mínimo", path: ["maxFollowers"] }
  );

export type CreateReachRangePayload = z.infer<typeof createReachRangeSchema>;

export const patchReachRangeSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1).optional(),
  minFollowers: z.number().int().min(0).optional(),
  maxFollowers: z.number().int().positive().nullable().optional(),
  reachPercentage: z.number().min(0).max(100).optional(),
});

export type PatchReachRangePayload = z.infer<typeof patchReachRangeSchema>;

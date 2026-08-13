import { z } from "zod";

const profileServiceSchema = z.object({
  serviceTypeId: z.string().min(1, "El tipo de servicio es requerido"),
  price: z.number().min(0, "El precio debe ser >= 0"),
  currency: z.string().default("COP"),
});

const socialAccountSchema = z.object({
  platformId: z.string().min(1, "La plataforma es requerida"),
  username: z.string().trim().min(1, "El usuario es requerido"),
  services: z.array(profileServiceSchema).default([]),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido").nullable().optional(),
  phone: z.string().nullable().optional(),
  type: z.enum(["INFLUENCER", "UGC", "BOTH"]),
  countryId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  cityId: z.string().nullable().optional(),
  genderId: z.string().nullable().optional(),
  socialAccounts: z
    .array(socialAccountSchema)
    .min(1, "Al menos una cuenta social es requerida"),
  categoryIds: z.array(z.string()).default([]),
});

export type ProfilePayload = z.infer<typeof profileSchema>;

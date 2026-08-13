import { z } from "zod";

const campaignProfileServiceSchema = z.object({
  profileServiceId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const campaignProfilePlatformSchema = z.object({
  socialAccountId: z.string().min(1),
  services: z.array(campaignProfileServiceSchema),
});

const campaignProfileSchema = z.object({
  profileId: z.string().min(1),
  platforms: z.array(campaignProfilePlatformSchema),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().nullable().optional().transform(v => v ?? undefined),
  clientId: z.string().min(1, "El cliente es requerido"),
  clientContactId: z.string().min(1, "El contacto del cliente es requerido"),
  budget: z.number().positive("El presupuesto debe ser mayor a 0"),
  currency: z.string().optional(),
  startDate: z.string().nullable().optional().transform(v => v ?? undefined),
  endDate: z.string().nullable().optional().transform(v => v ?? undefined),
});

export type CreateCampaignPayload = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").optional(),
  description: z.string().optional(),
  clientId: z.string().min(1, "El cliente es requerido").optional(),
  clientContactId: z.string().min(1, "El contacto del cliente es requerido").optional(),
  budget: z.number().positive("El presupuesto debe ser mayor a 0").optional(),
  currency: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export type UpdateCampaignPayload = z.infer<typeof updateCampaignSchema>;

export const transitionStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "REVIEW",
    "PENDING",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
  ]),
  reason: z.string().optional(),
});

export type TransitionStatusPayload = z.infer<typeof transitionStatusSchema>;

export const setCampaignProfilesSchema = z.object({
  profiles: z.array(campaignProfileSchema).default([]),
});

export type SetCampaignProfilesPayload = z.infer<typeof setCampaignProfilesSchema>;

export const removeCampaignProfilesSchema = z.object({
  profileIds: z.array(z.string()).min(1, "Al menos un perfil es requerido"),
});

export type RemoveCampaignProfilesPayload = z.infer<typeof removeCampaignProfilesSchema>;

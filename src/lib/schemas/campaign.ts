import { z } from "zod";

/**
 * Una linea de servicio dentro de una campana.
 *
 * Dos formas posibles:
 *  - Formato del tarifario: profileServiceId + cantidad.
 *  - Combo: precio escrito a mano y sin cantidad, porque es un acuerdo
 *    puntual que no vive en el tarifario del influencer.
 *
 * El refine obliga a que sea una cosa o la otra, para que no llegue un
 * combo sin precio ni un formato sin origen.
 */
const campaignProfileServiceSchema = z
  .object({
    profileServiceId: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    esCombo: z.boolean().default(false),
    comboPrecio: z.number().nonnegative().optional(),
    comboDescripcion: z.string().trim().max(200).optional(),
  })
  .refine(
    (s) =>
      s.esCombo
        ? typeof s.comboPrecio === "number"
        : Boolean(s.profileServiceId),
    { message: "Un combo necesita precio; un formato necesita su tarifa de origen" }
  );

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

export const setMarkupSchema = z.object({
  // Se recibe en tanto por uno (0.4 = 40%), igual que se guarda.
  markupPercentage: z
    .number()
    .min(0, "El margen no puede ser negativo")
    .max(5, "El margen no puede superar el 500%"),
});

export type SetMarkupPayload = z.infer<typeof setMarkupSchema>;

export const archivarCampanaSchema = z.object({
  /** true archiva, false devuelve la campana a los listados. */
  archivada: z.boolean(),
});

export type ArchivarCampanaPayload = z.infer<typeof archivarCampanaSchema>;

import { z } from "zod";

const campaignProfileStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const profileDecisionSchema = z.object({
  id: z.string().min(1),
  status: campaignProfileStatus,
  rejectionReason: z.string().optional(),
});

const platformDecisionSchema = z.object({
  id: z.string().min(1),
  status: campaignProfileStatus,
  rejectionReason: z.string().optional(),
});

const serviceDecisionSchema = z.object({
  id: z.string().min(1),
  isApproved: z.boolean(),
  rejectionReason: z.string().optional(),
  clientNotes: z.string().optional(),
});

export const submitApprovalSchema = z.object({
  profiles: z.array(profileDecisionSchema),
  platforms: z.array(platformDecisionSchema),
  services: z.array(serviceDecisionSchema),
});

export type SubmitApprovalPayload = z.infer<typeof submitApprovalSchema>;

export const submitApprovalBodySchema = z.object({
  finalDecisions: submitApprovalSchema,
});

export type SubmitApprovalBody = z.infer<typeof submitApprovalBodySchema>;

/**
 * La agencia decide por el cliente desde Perfiles y formatos: un
 * influencer entero o uno de sus formatos. El motivo solo se exige al
 * rechazar a un influencer; eso lo comprueba la capa de datos.
 */
export const decisionPorElClienteSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("influencer"),
    campaignProfileId: z.string().min(1),
    aprobado: z.boolean(),
    motivo: z.string().max(1000).nullish(),
  }),
  z.object({
    tipo: z.literal("formato"),
    servicioId: z.string().min(1),
    aprobado: z.boolean(),
    motivo: z.string().max(1000).nullish(),
  }),
]);

export type DecisionPorElCliente = z.infer<typeof decisionPorElClienteSchema>;

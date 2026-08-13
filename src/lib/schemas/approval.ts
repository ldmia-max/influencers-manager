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

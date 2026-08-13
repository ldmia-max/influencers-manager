import { z } from "zod";

export const clientContactSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().trim().min(1, "El nombre es requerido"),
  lastName: z.string().trim().min(1, "El apellido es requerido"),
  phone: z.string().optional().default(""),
  email: z.string().trim().email("Email inválido"),
  position: z.string().optional().default(""),
  isPrimary: z.boolean().default(false),
});

export type ClientContactPayload = z.infer<typeof clientContactSchema>;

export const createClientSchema = z.object({
  companyName: z.string().trim().min(1, "El nombre de la empresa es requerido"),
  nit: z.string().optional().default(""),
  email: z.string().trim().email("Email inválido"),
  contacts: z.array(clientContactSchema).default([]),
});

export type CreateClientPayload = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  companyName: z.string().trim().min(1, "El nombre de la empresa es requerido"),
  nit: z.string().optional().default(""),
  email: z.string().trim().email("Email inválido"),
  contacts: z.array(clientContactSchema).default([]),
});

export type UpdateClientPayload = z.infer<typeof updateClientSchema>;

export const clientAccessSchema = z.object({
  email: z.string().trim().email("Email inválido").optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  isActive: z.boolean().optional(),
});

export type ClientAccessPayload = z.infer<typeof clientAccessSchema>;

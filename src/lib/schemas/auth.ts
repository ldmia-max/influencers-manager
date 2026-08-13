import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type RegisterPayload = z.infer<typeof registerSchema>;

export const clientLoginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type ClientLoginPayload = z.infer<typeof clientLoginSchema>;

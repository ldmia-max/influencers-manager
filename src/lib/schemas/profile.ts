import { z } from "zod";

const profileServiceSchema = z.object({
  serviceTypeId: z.string().min(1, "El tipo de servicio es requerido"),
  price: z.number().min(0, "El precio debe ser >= 0"),
  currency: z.string().default("COP"),
});

const socialAccountSchema = z.object({
  platformId: z.string().min(1, "La plataforma es requerida"),
  // El identificador se guarda limpio venga como venga: suelto, con
  // arroba o pegado como URL desde la propia plataforma, que es lo que
  // hace en la practica quien da de alta un creador. Sin esto, una URL
  // rompia la sincronizacion en silencio y ademas dejaba enlaces rotos
  // en el portal que ve el cliente.
  username: z.string().trim().min(1, "El usuario es requerido"),
  services: z.array(profileServiceSchema).default([]),
});

/** Documentos de identificación admitidos, en el orden en que se ofrecen. */
export const TIPOS_DE_DOCUMENTO = [
  "CC",
  "CE",
  "TI",
  "NIT",
  "PASAPORTE",
  "PEP",
  "PPT",
] as const;

export const ETIQUETA_TIPO_DOCUMENTO: Record<
  (typeof TIPOS_DE_DOCUMENTO)[number],
  string
> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  TI: "Tarjeta de identidad",
  NIT: "NIT",
  PASAPORTE: "Pasaporte",
  PEP: "Permiso especial de permanencia",
  PPT: "Permiso por protección temporal",
};

export const profileSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido").nullable().optional(),
  phone: z.string().nullable().optional(),
  /**
   * Identidad de quien firma y cobra. Los tres campos son opcionales:
   * al dar de alta a un creador rara vez se tienen a mano, y exigirlos
   * bloquearía el alta por un dato que llega con el contrato.
   *
   * No salen de la agencia: ninguna consulta de los portales del cliente
   * los selecciona.
   */
  nombreCompleto: z.string().trim().max(150).nullable().optional(),
  tipoDocumento: z.enum(TIPOS_DE_DOCUMENTO).nullable().optional(),
  numeroDocumento: z.string().trim().max(40).nullable().optional(),
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

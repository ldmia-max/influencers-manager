import { z } from "zod";

// El autorregistro se elimino: cualquiera podia crearse una cuenta de
// personal desde /register y ver el catalogo completo de creadores,
// clientes y campanas. Las cuentas se crean solo desde /admin/users,
// que exige rol ADMIN y permite elegir el rol (ver createUserSchema en
// schemas/user.ts).

export const clientLoginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type ClientLoginPayload = z.infer<typeof clientLoginSchema>;

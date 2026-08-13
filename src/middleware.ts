import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

// El matcher debe cubrir TODAS las rutas privadas: lo que no pase por
// aqui nunca llega al callback "authorized" de auth.config.ts.
// Mantener sincronizado con RUTAS_PRIVADAS de ese archivo.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/profiles/:path*",
    "/clients/:path*",
    "/campaigns/:path*",
    "/categories/:path*",
    "/briefs/:path*",
    "/login",
    "/register",
  ],
};

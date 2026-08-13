import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Definido localmente para evitar importar @prisma/client en Edge runtime
type UserRole = "ADMIN" | "USER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  }
}

/**
 * Rutas que exigen sesion. Antes solo se protegian /dashboard y /admin,
 * por lo que /clients, /campaigns, /profiles y /categories entregaban
 * sus datos a cualquiera sin sesion: el layout hace el redirect dentro
 * de un <Suspense> y, con Cache Components, el contenido de la pagina se
 * transmite igualmente al cliente.
 *
 * La comparacion es por segmento completo, no por prefijo suelto, para
 * que "/brief" (formulario publico) no quede atrapado por "/briefs".
 *
 * PUBLICAS a proposito: /, /brief, /approve/[token], /client-login,
 * /client-dashboard, /login, /register y /api/public/*
 */
const RUTAS_PRIVADAS = [
  "/dashboard",
  "/admin",
  "/profiles",
  "/clients",
  "/campaigns",
  "/categories",
  "/briefs",
];

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize se define en auth.ts, aquí solo es placeholder para tipos
      authorize: async () => null,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Coincidencia por segmento completo: "/briefs" queda protegido
      // pero "/brief" (el formulario publico) NO, pese al prefijo comun.
      const esPrivada = RUTAS_PRIVADAS.some(
        (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
      );
      const isOnAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
      const isOnAuth =
        pathname.startsWith("/login") || pathname.startsWith("/register");

      if (esPrivada) {
        if (!isLoggedIn) return false;
        if (isOnAdmin && auth?.user?.role !== "ADMIN") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isOnAuth && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

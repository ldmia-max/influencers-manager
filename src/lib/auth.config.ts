import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "./client-session";

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
 * /login y /api/public/*
 *
 * NO existe autorregistro: /register y POST /api/auth/register se
 * eliminaron porque no exigian nada y creaban cuentas con rol USER, es
 * decir, acceso al catalogo completo de creadores con tarifas, a los
 * clientes y a las campanas. Las cuentas se crean desde /admin/users.
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

/**
 * Area del portal de clientes. Va aparte de RUTAS_PRIVADAS porque no la
 * protege la sesion del personal sino la del cliente, y su login es
 * otro. Tambien debe figurar en el matcher de src/middleware.ts.
 */
const RUTA_CLIENTE = "/client-dashboard";

export const authConfig: NextAuthConfig = {
  /**
   * La app corre SIEMPRE detras de un proxy inverso (Traefik en
   * Dokploy), asi que hay que confiar en la cabecera Host que este
   * reenvia. Sin esto, NextAuth rechaza cada peticion con
   * "UntrustedHost: Host must be trusted" y el login queda inservible.
   *
   * Va fijado aqui y no via AUTH_TRUST_HOST porque esa variable es un
   * campo de minas: NextAuth resuelve
   *   trustHost ??= !!(AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? ...)
   * es decir, mira AUTH_URL y NO NEXTAUTH_URL, y como usa ?? antes del
   * !!, dejar AUTH_TRUST_HOST declarada pero VACIA la resuelve como
   * false. Declarada-en-blanco rompe igual que no declararla.
   *
   * Es seguro porque quien fija el Host es el proxy segun su regla de
   * enrutado, no el cliente. Dejaria de serlo si el contenedor se
   * expusiera directamente a internet sin proxy delante.
   */
  trustHost: true,
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
    async authorized({ auth, request }) {
      const { nextUrl } = request;
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // --- Portal de clientes ---
      // Sistema de sesion aparte del personal: un ClientUser no tiene
      // sesion de NextAuth, asi que aqui no sirve `auth`. Se valida su
      // cookie firmada y se le manda a SU login, no al del personal.
      if (
        pathname === RUTA_CLIENTE ||
        pathname.startsWith(`${RUTA_CLIENTE}/`)
      ) {
        const sesion = await verificarSesionCliente(
          request.cookies.get(COOKIE_SESION_CLIENTE)?.value
        );
        if (!sesion) {
          return Response.redirect(new URL("/client-login", nextUrl));
        }
        return true;
      }

      // Coincidencia por segmento completo: "/briefs" queda protegido
      // pero "/brief" (el formulario publico) NO, pese al prefijo comun.
      const esPrivada = RUTAS_PRIVADAS.some(
        (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
      );
      const isOnAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
      const isOnAuth = pathname.startsWith("/login");

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

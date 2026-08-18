import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  CREDENCIALES_INVALIDAS,
  TRAS_LOGIN_CORRECTO,
  estaBloqueado,
  mensajeBloqueo,
  trasFalloDeLogin,
} from "./login-throttle";
import { authConfig } from "./auth.config";

/**
 * Errores de acceso con codigo propagable.
 *
 * Un Error corriente lanzado en authorize() llega al navegador como
 * "Configuration", indistinguible de un fallo de configuracion del
 * servidor. NextAuth solo propaga el motivo si el error extiende
 * CredentialsSignin, y lo hace a traves de su propiedad `code`.
 *
 * El codigo viaja en la URL, asi que no debe describir nada sensible:
 * por eso son dos etiquetas escuetas y el texto vive en la interfaz.
 */
class CredencialesInvalidas extends CredentialsSignin {
  code = "credenciales";
}

class CuentaBloqueada extends CredentialsSignin {
  code = "bloqueado";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          // Sin usuario no hay donde contar intentos. Se responde igual
          // que con contrasena incorrecta para no revelar que correos
          // estan dados de alta.
          throw new CredencialesInvalidas();
        }

        // El bloqueo se comprueba ANTES de la contrasena: si no, una
        // cuenta bloqueada seguiria admitiendo intentos y el limite no
        // frenaria nada.
        if (estaBloqueado(user)) {
          throw new CuentaBloqueada();
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          await prisma.user.update({
            where: { id: user.id },
            data: trasFalloDeLogin(user.failedLoginAttempts),
          });
          throw new CredencialesInvalidas();
        }

        // Acierto: se limpia el contador para que fallos sueltos a lo
        // largo del tiempo no acaben bloqueando a quien si sabe entrar.
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: TRAS_LOGIN_CORRECTO,
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});

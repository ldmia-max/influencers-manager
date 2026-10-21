import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import {
  COOKIE_APROBACION,
  firmarSesionAprobacion,
  opcionesCookieAprobacion,
  MAX_AGE_SESION_APROBACION,
} from "@/lib/approval-session";
import { tokenDeRevisionParaCliente } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

/**
 * GET /api/client-portal/revisar/[campaignId]
 *
 * Lleva a un cliente ya identificado en el portal a la revision de una
 * campana suya, sin pasar por el correo.
 *
 * Esta ruta NO figura en el matcher de src/middleware.ts, igual que
 * /api/client-auth/*: se protege sola leyendo la cookie firmada del
 * portal. El clientId sale de ahi y entra en el where de la consulta,
 * que es lo unico que impide abrir la campana de otro cliente.
 *
 * Deja dos cookies en juego: la del portal, que ya venia, y la de
 * aprobacion, que se firma aqui atada al token recien resuelto. La
 * pagina /approve/[token] exige esa segunda y asi la encuentra puesta,
 * sin pedir el codigo que normalmente llega por correo —ese codigo
 * demuestra que quien abre el enlace es el destinatario, y la sesion
 * del portal ya lo demostro con usuario y contrasena.
 *
 * Es un GET porque es navegacion: el boton "Revisar" es un enlace. Crear
 * el token no lo hace destructivo —se reutiliza el vigente si lo hay, de
 * modo que volver a pulsar continua la misma revision en vez de abrir
 * otra.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;

    const almacen = await cookies();
    const sesion = await verificarSesionCliente(
      almacen.get(COOKIE_SESION_CLIENTE)?.value
    );

    if (!sesion) {
      return NextResponse.redirect(new URL("/client-login", req.url));
    }

    const token = await tokenDeRevisionParaCliente(
      sesion.clientId,
      campaignId,
      sesion.email
    );

    const respuesta = NextResponse.redirect(new URL(`/approve/${token}`, req.url));
    respuesta.cookies.set(
      COOKIE_APROBACION,
      await firmarSesionAprobacion({ token, email: sesion.email }),
      opcionesCookieAprobacion(MAX_AGE_SESION_APROBACION)
    );

    return respuesta;
  } catch (error) {
    // Nada que revisar o campana ajena: se devuelve al listado en vez de
    // dejar una pagina de error. El cliente llego aqui pulsando un boton
    // que el portal le ofrecio, asi que el fallo es del portal, no suyo.
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return NextResponse.redirect(
        new URL("/client-dashboard/revisiones?aviso=sin-pendientes", req.url)
      );
    }
    console.error("Error abriendo la revisión desde el portal:", error);
    return NextResponse.redirect(
      new URL("/client-dashboard/revisiones?aviso=error", req.url)
    );
  }
}

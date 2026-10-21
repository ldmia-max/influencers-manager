import { NextResponse } from "next/server";
import { solicitarEnlaceDeContrasena } from "@/data-access/client-password";
import { notifyEnlaceContrasena } from "@/lib/emails/client-notifications";
import { auditar, ACCIONES } from "@/lib/audit";

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * POST /api/client-auth/recuperar
 *
 * Pide por correo un enlace para elegir contrasena en el portal.
 *
 * Publica a proposito: quien ha olvidado su contrasena no puede
 * identificarse de ninguna otra forma. Hasta ahora no existia, y la
 * unica manera de entrar al portal era que un administrador se
 * inventara una contrasena y se la hiciera llegar al cliente por fuera
 * de la aplicacion.
 *
 * **Contesta siempre lo mismo**, exista el correo o no, este el acceso
 * desactivado o se haya pedido otro enlace hace diez segundos. Si la
 * respuesta cambiara, este formulario seria una forma comoda de
 * averiguar que empresas son clientes: se prueban correos y se mira
 * cual contesta distinto. Por eso tampoco se devuelve si el correo
 * salio: decirlo es decir que la cuenta existe.
 *
 * Lo que si deja rastro es el intento, en la auditoria, donde solo mira
 * la agencia.
 */
export async function POST(req: Request) {
  const generica = NextResponse.json({
    ok: true,
    mensaje:
      "Si ese correo tiene acceso al portal, te hemos enviado un enlace para elegir contraseña.",
  });

  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email.trim()) return generica;

    const solicitud = await solicitarEnlaceDeContrasena(email, "PORTAL");

    // Se sabe por que no se pudo, pero la respuesta al navegador es la
    // misma en todos los casos. El motivo solo baja a la auditoria.
    if (!solicitud.ok) {
      await auditar({
        action: ACCIONES.contrasenaPortalSolicitada,
        entity: "ClientUser",
        entityId: "desconocido",
        actorType: "CLIENT",
        actorEmail: email.trim().toLowerCase(),
        summary: `Se pidió un enlace de contraseña del portal y no se envió (${solicitud.motivo})`,
        metadata: { motivo: solicitud.motivo },
        req,
      });
      return generica;
    }

    const resultado = await notifyEnlaceContrasena({
      destino: solicitud.email,
      companyName: solicitud.companyName,
      url: `${baseUrl()}/client-login/nueva/${solicitud.token}`,
      expiresAt: solicitud.expiresAt,
      esAlta: false,
    });

    await auditar({
      action: ACCIONES.contrasenaPortalSolicitada,
      entity: "ClientUser",
      entityId: solicitud.clientUserId,
      actorType: "CLIENT",
      actorId: solicitud.clientUserId,
      actorEmail: solicitud.email,
      summary: resultado.success
        ? `Se envió un enlace de contraseña del portal a ${solicitud.email}`
        : `No se pudo enviar el enlace de contraseña a ${solicitud.email}: ${resultado.reason}`,
      metadata: {
        empresa: solicitud.companyName,
        correoEnviado: resultado.success,
      },
      req,
    });

    return generica;
  } catch (error) {
    // Tampoco aqui se distingue: un 500 en unos correos y un 200 en
    // otros volveria a decir cuales existen.
    console.error("Error pidiendo el enlace de contraseña del portal:", error);
    return generica;
  }
}

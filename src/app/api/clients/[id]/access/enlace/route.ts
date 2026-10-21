import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/api-guard";
import { solicitarEnlaceDeContrasena } from "@/data-access/client-password";
import { notifyEnlaceContrasena } from "@/lib/emails/client-notifications";
import { auditar, ACCIONES } from "@/lib/audit";

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

const MOTIVOS: Record<string, string> = {
  SIN_CUENTA: "Este cliente todavía no tiene acceso al portal.",
  INACTIVO: "El acceso de este cliente está desactivado.",
  RECIENTE: "Se envió un enlace hace menos de un minuto.",
};

/**
 * POST /api/clients/[id]/access/enlace
 *
 * Manda al cliente el enlace para que elija su contrasena.
 *
 * Existe para que dar de alta a un cliente no obligue a nadie a
 * inventarse una contrasena y hacersela llegar por WhatsApp o de viva
 * voz, que es donde una contrasena no debe viajar. El administrador
 * crea el acceso con el correo y pulsa esto; la contrasena la elige su
 * dueno y no la conoce nadie mas.
 *
 * Al reves que la ruta publica /api/client-auth/recuperar, **esta si
 * dice por que no se pudo**: quien la llama tiene sesion y permiso de
 * administracion, y ya sabe quien es el cliente, asi que callarlo no
 * protegeria nada y solo dejaria el boton sin explicar su silencio.
 *
 * Devuelve el resultado del correo tal cual. Si Resend esta apagado o
 * falla, la interfaz debe poder decir que el enlace no salio en vez de
 * dar por hecho que si.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;

    const cliente = await prisma.client.findUnique({
      where: { id },
      select: {
        companyName: true,
        clientUser: { select: { email: true } },
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (!cliente.clientUser) {
      return NextResponse.json(
        { error: MOTIVOS.SIN_CUENTA, code: "SIN_CUENTA" },
        { status: 400 }
      );
    }

    const solicitud = await solicitarEnlaceDeContrasena(
      cliente.clientUser.email,
      "AGENCIA",
      // Sin freno: llamar aqui exige sesion y permiso, asi que no es la
      // via por la que alguien inundaria una bandeja de entrada.
      true
    );

    if (!solicitud.ok) {
      return NextResponse.json(
        {
          error: MOTIVOS[solicitud.motivo] ?? "No se pudo generar el enlace",
          code: solicitud.motivo,
        },
        { status: 400 }
      );
    }

    const resultado = await notifyEnlaceContrasena({
      destino: solicitud.email,
      companyName: solicitud.companyName,
      url: `${baseUrl()}/client-login/nueva/${solicitud.token}`,
      expiresAt: solicitud.expiresAt,
      esAlta: true,
    });

    await auditar({
      action: ACCIONES.contrasenaPortalSolicitada,
      entity: "Client",
      entityId: id,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: resultado.success
        ? `Envió a ${solicitud.email} el enlace para elegir contraseña del portal`
        : `No se pudo enviar a ${solicitud.email} el enlace de contraseña: ${resultado.reason}`,
      metadata: {
        empresa: solicitud.companyName,
        emailPortal: solicitud.email,
        correoEnviado: resultado.success,
      },
      req,
    });

    return NextResponse.json({
      destino: solicitud.email,
      expiresAt: solicitud.expiresAt,
      email: resultado.success
        ? { sent: true }
        : { sent: false, reason: resultado.reason, error: resultado.error },
    });
  } catch (error) {
    console.error("Error enviando el enlace de contraseña del portal:", error);
    return NextResponse.json(
      { error: "No se pudo enviar el enlace" },
      { status: 500 }
    );
  }
}

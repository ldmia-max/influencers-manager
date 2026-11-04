import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { accesoDeContacto } from "@/data-access/clients";
import { NotFoundError } from "@/data-access/errors";
import { solicitarEnlaceDeContrasena } from "@/data-access/client-password";
import { notifyEnlaceContrasena } from "@/lib/emails/client-notifications";
import { auditar, ACCIONES } from "@/lib/audit";

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

const MOTIVOS: Record<string, string> = {
  SIN_CUENTA: "Este contacto todavía no tiene acceso al portal.",
  INACTIVO: "El acceso de este contacto está desactivado.",
  RECIENTE: "Se envió un enlace hace menos de un minuto.",
};

/**
 * POST /api/clients/[id]/contactos/[contactoId]/acceso/enlace
 *
 * Manda a ese contacto el enlace para que elija su contrasena.
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
  { params }: { params: Promise<{ id: string; contactoId: string }> }
) {
  try {
    const sesion = await exigirPermiso("administracion", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id, contactoId } = await params;

    const contacto = await accesoDeContacto(id, contactoId);

    if (!contacto.acceso) {
      return NextResponse.json(
        { error: MOTIVOS.SIN_CUENTA, code: "SIN_CUENTA" },
        { status: 400 }
      );
    }

    const solicitud = await solicitarEnlaceDeContrasena(
      contacto.acceso.email,
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
      entity: "ClientContact",
      entityId: contactoId,
      actorType: "USER",
      actorId: sesion.userId,
      actorEmail: sesion.email,
      summary: resultado.success
        ? `Envió a ${solicitud.email} el enlace para elegir contraseña del portal`
        : `No se pudo enviar a ${solicitud.email} el enlace de contraseña: ${resultado.reason}`,
      metadata: {
        empresa: solicitud.companyName,
        contacto: contacto.nombre,
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
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error enviando el enlace de contraseña del portal:", error);
    return NextResponse.json(
      { error: "No se pudo enviar el enlace" },
      { status: 500 }
    );
  }
}

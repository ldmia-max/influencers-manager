import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  estadoDelToken,
  prepararCodigo,
  validarCodigo,
} from "@/data-access/campaign-approval";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import {
  COOKIE_APROBACION,
  MAX_AGE_SESION_APROBACION,
  firmarSesionAprobacion,
  opcionesCookieAprobacion,
  verificarSesionAprobacion,
} from "@/lib/approval-session";
import { notifyCodigoAprobacion } from "@/lib/emails/campaign-notifications";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * Verificacion de acceso al portal de aprobacion.
 *
 * GET   estado del enlace y si ya hay sesion
 * POST  { email }  -> envia el codigo al correo registrado
 *       { codigo } -> valida y abre la sesion
 *
 * Es publica por necesidad: el cliente no tiene cuenta. Lo que la
 * protege es que el codigo llega SOLO a sentToEmail.
 */
function mapearError(error: unknown) {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: "Enlace no valido", code: "INVALID_TOKEN" },
      { status: 404 }
    );
  }
  if (error instanceof ValidationError) {
    const mapa: Record<string, { message: string; status: number }> = {
      EXPIRED_TOKEN: { message: "El enlace de aprobacion ha expirado", status: 410 },
      USED_TOKEN: { message: "Este enlace ya fue utilizado", status: 410 },
      INVALID_STATUS: { message: "La campana ya no esta disponible para revision", status: 400 },
      REENVIO_DEMASIADO_PRONTO: { message: "Espera un momento antes de pedir otro codigo", status: 429 },
      SIN_CODIGO: { message: "Solicita un codigo antes de continuar", status: 400 },
      CODIGO_EXPIRADO: { message: "El codigo ha caducado, pide uno nuevo", status: 410 },
      DEMASIADOS_INTENTOS: { message: "Demasiados intentos fallidos, pide un codigo nuevo", status: 429 },
      CODIGO_INCORRECTO: { message: "El codigo no es correcto", status: 401 },
    };
    const m = mapa[error.message];
    if (m) {
      return NextResponse.json({ error: m.message, code: error.message }, { status: m.status });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Error en la verificacion de aprobacion:", error);
  return NextResponse.json({ error: "Error al verificar el acceso" }, { status: 500 });
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const almacen = await cookies();
    const sesion = await verificarSesionAprobacion(
      almacen.get(COOKIE_APROBACION)?.value,
      token
    );

    const estado = await estadoDelToken(token);
    return NextResponse.json({ ...estado, verificado: Boolean(sesion) });
  } catch (error) {
    return mapearError(error);
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const cuerpo = await req.json().catch(() => null);

    if (!cuerpo || typeof cuerpo !== "object") {
      return NextResponse.json({ error: "Peticion no valida" }, { status: 400 });
    }

    // --- Paso 1: pedir el codigo ---
    if (typeof cuerpo.email === "string") {
      const datos = await prepararCodigo(token, cuerpo.email);

      if (datos) {
        await notifyCodigoAprobacion({
          destino: datos.destino,
          nombre: datos.nombre,
          campaignName: datos.campaignName,
          codigo: datos.codigo,
        });
      }

      // Misma respuesta coincida o no: de lo contrario este endpoint
      // serviria para averiguar a que direccion se mando la campana.
      return NextResponse.json({
        message: "Si el correo coincide con el de la campana, recibiras un codigo",
      });
    }

    // --- Paso 2: validar el codigo y abrir sesion ---
    if (typeof cuerpo.codigo === "string") {
      const { email } = await validarCodigo(token, cuerpo.codigo.trim());

      await auditar({
        action: ACCIONES.aprobacionVerificada,
        entity: "CampaignApprovalToken",
        entityId: token,
        actorType: "APPROVAL",
        actorEmail: email,
        summary: `${email} verificó su correo y accedió al portal de aprobación`,
        req,
      });

      const jwt = await firmarSesionAprobacion({ token, email });
      const almacen = await cookies();
      almacen.set(
        COOKIE_APROBACION,
        jwt,
        opcionesCookieAprobacion(MAX_AGE_SESION_APROBACION)
      );

      return NextResponse.json({ verificado: true });
    }

    return NextResponse.json({ error: "Peticion no valida" }, { status: 400 });
  } catch (error) {
    return mapearError(error);
  }
}

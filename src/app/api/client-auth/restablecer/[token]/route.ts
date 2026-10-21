import { NextResponse } from "next/server";
import {
  clienteDelEnlace,
  establecerContrasenaConEnlace,
} from "@/data-access/client-password";
import { ValidationError } from "@/data-access/errors";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * Los motivos por los que un enlace no sirve, cada uno con su estado y
 * su texto.
 *
 * Se distinguen a proposito, al reves que en /recuperar: alli callar
 * protegia de decir que cuentas existen, pero aqui quien tiene el enlace
 * ya tiene esa informacion, y lo que necesita es saber si ha de pedir
 * otro, usar el ultimo que le llego, o hablar con la agencia. Un
 * "enlace no valido" para los tres casos le deja sin saber que hacer.
 */
const MOTIVOS: Record<string, { estado: number; mensaje: string }> = {
  ENLACE_INVALIDO: {
    estado: 404,
    mensaje: "Este enlace no es válido. Pide uno nuevo desde la página de acceso.",
  },
  ENLACE_USADO: {
    estado: 410,
    mensaje:
      "Este enlace ya se usó. Si pediste otro después, usa el último correo que recibiste.",
  },
  ENLACE_CADUCADO: {
    estado: 410,
    mensaje: "Este enlace caducó. Pide uno nuevo desde la página de acceso.",
  },
  ACCESO_INACTIVO: {
    estado: 403,
    mensaje:
      "Tu acceso al portal está desactivado. Contacta con tu equipo de cuenta.",
  },
};

function mapear(error: unknown) {
  if (error instanceof ValidationError) {
    const motivo = MOTIVOS[error.message];
    if (motivo) {
      return NextResponse.json(
        { error: motivo.mensaje, code: error.message },
        { status: motivo.estado }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Error en el enlace de contraseña del portal:", error);
  return NextResponse.json(
    { error: "No se pudo completar la operación" },
    { status: 500 }
  );
}

/**
 * GET: comprueba el enlace SIN gastarlo.
 *
 * La pagina lo llama al abrirse para decidir si pinta el formulario o el
 * motivo por el que no puede. Gastarlo aqui seria quemarlo con solo
 * abrir el correo —algunos clientes de correo precargan los enlaces—.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const datos = await clienteDelEnlace(token);
    // El correo se devuelve para poder mostrarlo en el formulario; el id
    // interno no, que no le dice nada a nadie fuera de la agencia.
    return NextResponse.json({
      email: datos.email,
      companyName: datos.companyName,
    });
  } catch (error) {
    return mapear(error);
  }
}

/** POST: pone la contrasena y gasta el enlace. */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";

    const datos = await establecerContrasenaConEnlace(token, password);

    await auditar({
      action: ACCIONES.contrasenaPortalCambiada,
      entity: "ClientUser",
      entityId: datos.clientUserId,
      actorType: "CLIENT",
      actorId: datos.clientUserId,
      actorEmail: datos.email,
      summary: `${datos.email} eligió contraseña en el portal con un enlace por correo`,
      metadata: { empresa: datos.companyName },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapear(error);
  }
}

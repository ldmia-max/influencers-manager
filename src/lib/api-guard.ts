import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  puede,
  exigePropiedadParaEscribir,
  exigePropiedadParaLeer,
  type Accion,
  type Recurso,
  type Rol,
} from "@/lib/permissions";

/**
 * Aplicacion de la tabla de permisos en las rutas de API.
 *
 * Se usa igual que parseBody, que es el patron que ya tenia el
 * proyecto: si devuelve un NextResponse, la ruta lo retorna tal cual.
 *
 *   const sesion = await exigirPermiso("campanas", "borrar");
 *   if (sesion instanceof NextResponse) return sesion;
 *   // a partir de aqui sesion.userId y sesion.rol son fiables
 *
 * Distingue 401 de 403 a proposito: 401 es "no se quien eres" y 403 es
 * "se quien eres y no puedes". Mezclarlos complica depurar y filtra
 * menos informacion de la que parece, porque el atacante ya sabe si
 * tiene sesion.
 */

export interface SesionPermitida {
  userId: string;
  rol: Rol;
  email: string;
}

export async function exigirPermiso(
  recurso: Recurso,
  accion: Accion
): Promise<SesionPermitida | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rol = session.user.role as Rol;

  if (!puede(rol, recurso, accion)) {
    return NextResponse.json(
      { error: "No tienes permiso para realizar esta accion" },
      { status: 403 }
    );
  }

  return { userId: session.user.id, rol, email: session.user.email };
}

/**
 * Comprueba la propiedad de un registro concreto.
 *
 * Va aparte de exigirPermiso porque para saber quien creo algo hay que
 * ir a la base de datos, y eso solo puede hacerlo la ruta: el permiso
 * se resuelve antes y evita la consulta cuando el rol ya no alcanza.
 *
 * Devuelve null si puede seguir, o el NextResponse de error.
 */
export function exigirPropiedad(
  sesion: SesionPermitida,
  recurso: Recurso,
  creadoPor: string
): NextResponse | null {
  if (!exigePropiedadParaEscribir(sesion.rol, recurso)) return null;
  if (creadoPor === sesion.userId) return null;

  return NextResponse.json(
    { error: "Solo puedes modificar los registros que has creado" },
    { status: 403 }
  );
}

/**
 * Filtro de creador para los listados, o undefined si ve todo.
 * Se pasa tal cual al `where` de Prisma.
 */
export function filtroDePropiedad(
  sesion: SesionPermitida,
  recurso: Recurso
): { createdById: string } | undefined {
  return exigePropiedadParaLeer(sesion.rol, recurso)
    ? { createdById: sesion.userId }
    : undefined;
}

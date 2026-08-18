/**
 * Tabla central de permisos.
 *
 * Antes cada ruta decidia por su cuenta con un `if (role !== "ADMIN")`
 * escrito a mano, y eso produjo incoherencias reales: un Usuario podia
 * borrar campanas pero no categorias, y editar un perfil no comprobaba
 * absolutamente nada. Cuarenta comprobaciones dispersas no se pueden
 * revisar de un vistazo; una tabla si.
 *
 * Este archivo es PURO: no importa Prisma, ni auth, ni next/server, para
 * que pueda usarse tambien en el navegador y ocultar lo que el usuario
 * no puede hacer. Quien aplica la tabla en las rutas es
 * src/lib/api-guard.ts.
 *
 * El portal de clientes NO se rige por esta tabla: ClientUser es otro
 * sistema de sesion (ver src/lib/client-session.ts) con una superficie
 * propia y mucho mas pequena.
 */

export type Rol = "ADMIN" | "USER";

export type Recurso =
  | "perfiles"
  | "categorias"
  | "clientes"
  | "campanas"
  | "briefs"
  | "informes"
  | "aprobacion"
  | "administracion";

export type Accion = "crear" | "leer" | "actualizar" | "borrar";

const TODAS: Accion[] = ["crear", "leer", "actualizar", "borrar"];

/**
 * Que puede hacer cada rol con cada recurso.
 *
 * ADMIN: acceso total.
 * USER:  CRUD perfiles, CRUD categorias, CRU clientes, CRU campanas,
 *        CR informes, U aprobacion. Sin acceso a administracion.
 *
 * "administracion" cubre /admin: usuarios, plataformas, tipos de
 * servicio, ubicaciones y rangos de alcance.
 */
const MATRIZ: Record<Rol, Record<Recurso, Accion[]>> = {
  ADMIN: {
    perfiles: TODAS,
    categorias: TODAS,
    clientes: TODAS,
    campanas: TODAS,
    briefs: TODAS,
    informes: TODAS,
    aprobacion: TODAS,
    administracion: TODAS,
  },
  USER: {
    perfiles: TODAS,
    categorias: TODAS,
    clientes: ["crear", "leer", "actualizar"],
    campanas: ["crear", "leer", "actualizar"],
    // Convertir un brief en campana es, en la practica, crear una
    // campana; se concede lo mismo que en campanas menos el borrado.
    briefs: ["crear", "leer", "actualizar"],
    informes: ["crear", "leer"],
    aprobacion: ["actualizar"],
    administracion: [],
  },
};

/**
 * Recursos en los que un USER solo puede ESCRIBIR sobre lo que creo el.
 *
 * Perfiles y categorias quedan fuera a proposito: son el catalogo comun
 * de la agencia y cualquiera trabaja sobre el.
 *
 * Clientes esta dentro, pero solo para escritura: la LECTURA sigue
 * siendo global porque crear una campana obliga a elegir un cliente, y
 * filtrarla dejaria a un usuario sin poder trabajar con las cuentas que
 * registro un companero.
 */
const PROPIEDAD_PARA_ESCRIBIR: Record<Recurso, boolean> = {
  perfiles: false,
  categorias: false,
  clientes: true,
  campanas: true,
  briefs: false,
  informes: false,
  aprobacion: false,
  administracion: false,
};

/** Recursos cuyo LISTADO se limita a lo propio cuando el rol no es ADMIN. */
const PROPIEDAD_PARA_LEER: Record<Recurso, boolean> = {
  perfiles: false,
  categorias: false,
  clientes: false,
  campanas: true,
  briefs: false,
  informes: false,
  aprobacion: false,
  administracion: false,
};

export function puede(rol: Rol, recurso: Recurso, accion: Accion): boolean {
  return MATRIZ[rol][recurso].includes(accion);
}

/** true si hay que comprobar que el registro le pertenece antes de escribir. */
export function exigePropiedadParaEscribir(rol: Rol, recurso: Recurso): boolean {
  return rol !== "ADMIN" && PROPIEDAD_PARA_ESCRIBIR[recurso];
}

/** true si el listado debe filtrarse por creador. */
export function exigePropiedadParaLeer(rol: Rol, recurso: Recurso): boolean {
  return rol !== "ADMIN" && PROPIEDAD_PARA_LEER[recurso];
}

/** Acciones permitidas, util para ocultar botones en la interfaz. */
export function accionesDe(rol: Rol, recurso: Recurso): Accion[] {
  return MATRIZ[rol][recurso];
}

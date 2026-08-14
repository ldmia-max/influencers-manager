import "server-only";
import { join, normalize, sep } from "path";

/**
 * Almacenamiento de archivos subidos EN DISCO.
 *
 * Los archivos NO viven en public/. Con output: "standalone" Next
 * calcula el listado de public/ durante el build, asi que cualquier
 * archivo escrito despues devuelve 404 aunque este en el disco. Por eso
 * se guardan fuera y se sirven por /api/uploads/[...ruta].
 *
 * En produccion UPLOADS_DIR apunta al volumen montado en el contenedor;
 * si no esta definida se usa ./uploads en la raiz del proyecto, que es
 * lo que se usa en local.
 */

/** Prefijo publico con el que se construyen las URL guardadas en la BD. */
export const RUTA_PUBLICA_UPLOADS = "/api/uploads";

export function directorioUploads(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
}

/**
 * Resuelve una ruta relativa dentro del directorio de subidas.
 *
 * Devuelve null si el resultado se sale de ese directorio, que es lo
 * que pasaria con "../../etc/passwd" o con un segmento codificado. No
 * basta con mirar si la cadena contiene "..": hay que normalizar
 * primero y comprobar el resultado.
 */
export function resolverRutaSegura(relativa: string): string | null {
  const base = normalize(directorioUploads());
  const destino = normalize(join(base, relativa));

  if (destino !== base && !destino.startsWith(base + sep)) {
    return null;
  }
  return destino;
}

/** Tipo MIME por extension, para servir el archivo con la cabecera correcta. */
const TIPOS_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

export function tipoPorExtension(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS_POR_EXTENSION[ext] ?? "application/octet-stream";
}

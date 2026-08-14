import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { directorioUploads, RUTA_PUBLICA_UPLOADS } from "@/lib/uploads";
import {
  MAX_ARCHIVOS,
  MAX_BYTES,
  MAX_BYTES_TOTAL,
  EXTENSIONES_VISIBLES,
  formatearPeso,
  tipoPermitido,
  nombreSeguro,
  type DocumentoAdjunto,
} from "@/lib/brief-documentos";

/**
 * Guardado de adjuntos EN EL SERVIDOR, para desarrollo local y OVH.
 *
 * En Vercel NO se usa esta via: alli los archivos se suben directamente
 * desde el navegador a Blob (ver /api/public/brief/upload), porque el
 * limite de 4.5 MB por peticion serverless hace inviable mandarlos
 * dentro del formulario.
 *
 * Escribe en el directorio de subidas (UPLOADS_DIR), que en el
 * contenedor es un volumen montado. NO escribe en public/: con
 * output: "standalone" Next no sirve lo que aparezca ahi despues del
 * build. Los archivos se entregan por /api/uploads/[...ruta].
 */

export { MAX_ARCHIVOS, MAX_BYTES, MAX_BYTES_TOTAL, EXTENSIONES_VISIBLES };
export type { DocumentoAdjunto };

export class UploadError extends Error {}

export async function guardarDocumentosBrief(
  archivos: File[]
): Promise<DocumentoAdjunto[]> {
  const validos = archivos.filter((a) => a && a.size > 0);
  if (validos.length === 0) return [];

  if (validos.length > MAX_ARCHIVOS) {
    throw new UploadError(`Puedes adjuntar como maximo ${MAX_ARCHIVOS} archivos`);
  }

  for (const archivo of validos) {
    if (archivo.size > MAX_BYTES) {
      throw new UploadError(
        `"${archivo.name}" supera el limite de ${MAX_BYTES / 1024 / 1024} MB`
      );
    }
    if (archivo.type && !tipoPermitido(archivo.type)) {
      throw new UploadError(
        `El tipo de "${archivo.name}" no esta permitido. Se aceptan ${EXTENSIONES_VISIBLES}`
      );
    }
  }

  const total = validos.reduce((suma, a) => suma + a.size, 0);
  if (total > MAX_BYTES_TOTAL) {
    throw new UploadError(
      `Los adjuntos suman ${formatearPeso(total)} y el maximo permitido entre todos es ${formatearPeso(MAX_BYTES_TOTAL)}`
    );
  }

  const carpeta = randomUUID();
  const destino = join(directorioUploads(), "briefs", carpeta);
  await mkdir(destino, { recursive: true });

  const guardados: DocumentoAdjunto[] = [];

  for (const archivo of validos) {
    const nombre = nombreSeguro(archivo.name);
    await writeFile(
      join(destino, nombre),
      Buffer.from(await archivo.arrayBuffer())
    );

    guardados.push({
      nombre: archivo.name,
      url: `${RUTA_PUBLICA_UPLOADS}/briefs/${carpeta}/${nombre}`,
      tamano: archivo.size,
      tipo: archivo.type || "desconocido",
    });
  }

  return guardados;
}

/**
 * Valida la metadata de archivos que el navegador ya subio a Blob.
 * No se confia en lo que manda el cliente: se comprueban limites y que
 * las URL apunten realmente al almacenamiento de Blob.
 */
export function validarDocumentosSubidos(datos: unknown): DocumentoAdjunto[] {
  if (!Array.isArray(datos)) return [];
  if (datos.length > MAX_ARCHIVOS) {
    throw new UploadError(`Puedes adjuntar como maximo ${MAX_ARCHIVOS} archivos`);
  }

  const total = datos.reduce(
    (suma, d) => suma + (Number((d as Partial<DocumentoAdjunto>).tamano) || 0),
    0
  );
  if (total > MAX_BYTES_TOTAL) {
    throw new UploadError(
      `Los adjuntos suman ${formatearPeso(total)} y el maximo permitido entre todos es ${formatearPeso(MAX_BYTES_TOTAL)}`
    );
  }

  return datos.map((d) => {
    const doc = d as Partial<DocumentoAdjunto>;
    if (
      typeof doc.url !== "string" ||
      !/^https:\/\/[a-z0-9-]+\.(public\.)?blob\.vercel-storage\.com\//i.test(doc.url)
    ) {
      throw new UploadError("Una de las URL de los adjuntos no es valida");
    }
    if (typeof doc.tamano === "number" && doc.tamano > MAX_BYTES) {
      throw new UploadError(`"${doc.nombre}" supera el limite permitido`);
    }
    return {
      nombre: String(doc.nombre ?? "archivo").slice(0, 200),
      url: doc.url,
      tamano: Number(doc.tamano ?? 0),
      tipo: String(doc.tipo ?? "desconocido").slice(0, 120),
    };
  });
}

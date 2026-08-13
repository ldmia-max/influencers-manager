/**
 * Reglas de los documentos adjuntos del brief.
 *
 * Vive en lib/ porque son constantes puras sin efectos: las usan tanto
 * el navegador (validacion previa y subida directa a Blob) como el
 * servidor (services/brief-uploads.ts y la ruta de subida).
 * No importar aqui nada de "fs" o el bundle del cliente se rompe.
 */

export const MAX_ARCHIVOS = 10;
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por archivo

/**
 * Tope acumulado de todos los adjuntos juntos.
 *
 * Sin el, el maximo real serian 100 MB (10 archivos x 10 MB), que nadie
 * habia decidido. 25 MB es holgado para brochures, manuales de marca y
 * fotos, que es lo que se adjunta a un brief.
 *
 * Ojo en OVH: si hay un proxy inverso delante, su limite de cuerpo debe
 * ser mayor que esto o cortara la peticion antes de llegar al codigo.
 * En Nginx el valor por defecto es 1 MB: client_max_body_size 30m;
 */
export const MAX_BYTES_TOTAL = 25 * 1024 * 1024; // 25 MB en total

/** Formatea bytes para mensajes al usuario: 1258291 -> "1,2 MB" */
export function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Limite de cuerpo de peticion de las funciones serverless de Vercel.
 * Si los archivos viajan dentro del POST del formulario y la suma
 * supera esto, la peticion muere con HTTP 413 ANTES de llegar al codigo.
 * Por eso en Vercel se sube directamente a Blob desde el navegador.
 */
export const LIMITE_CUERPO_VERCEL = 4.5 * 1024 * 1024;

export const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const EXTENSIONES_VISIBLES =
  "PDF, JPG, PNG, WEBP, GIF, DOC, DOCX, XLS, XLSX, PPT, PPTX y ZIP";

export function tipoPermitido(tipo: string): boolean {
  return (TIPOS_PERMITIDOS as readonly string[]).includes(tipo);
}

/** Evita path traversal y nombres problematicos en Windows y Linux */
export function nombreSeguro(original: string): string {
  const limpio = original
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(-120);
  return limpio || "archivo";
}

export interface DocumentoAdjunto {
  nombre: string;
  url: string;
  tamano: number;
  tipo: string;
}

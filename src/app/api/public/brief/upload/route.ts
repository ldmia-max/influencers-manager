import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import {
  TIPOS_PERMITIDOS,
  MAX_BYTES,
} from "@/lib/brief-documentos";

/**
 * POST /api/public/brief/upload
 *
 * Emite los permisos para que el NAVEGADOR suba los adjuntos del brief
 * directamente a Vercel Blob, sin pasar por esta funcion.
 *
 * Existe por el limite de 4.5 MB de cuerpo de peticion de las funciones
 * serverless de Vercel: mandar los archivos dentro del POST del
 * formulario devuelve HTTP 413 antes de ejecutar nada.
 *
 * Es PUBLICA a proposito, como el propio formulario. La proteccion no es
 * la sesion sino el alcance del permiso: solo la carpeta "briefs/", solo
 * los tipos de archivo admitidos y con un tamano maximo.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const respuesta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("briefs/")) {
          throw new Error("Ruta de subida no permitida");
        }
        return {
          allowedContentTypes: [...TIPOS_PERMITIDOS],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // El brief se guarda cuando se envia el formulario, no aqui.
        // Si alguien sube y no envia, queda un huerfano en Blob: es
        // preferible a perder adjuntos por el limite de tamano.
      },
    });

    return NextResponse.json(respuesta);
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "No se pudo subir el archivo";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}

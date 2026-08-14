import { NextResponse, connection } from "next/server";
import { readFile, stat } from "fs/promises";
import { resolverRutaSegura, tipoPorExtension } from "@/lib/uploads";

/**
 * GET /api/uploads/[...ruta]
 *
 * Sirve los archivos subidos desde el disco (volumen del contenedor).
 * Existe porque con output: "standalone" Next no entrega los archivos
 * que se escriben en public/ despues del build: el listado se calcula
 * al construir la imagen y todo lo posterior responde 404.
 *
 * Es PUBLICA a proposito, igual que lo era el almacenamiento en Blob:
 * las fotos de perfil se muestran en /approve/[token], que el cliente
 * abre sin sesion. La proteccion de los adjuntos del brief es que su
 * carpeta es un UUID aleatorio, no que haya sesion.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ruta: string[] }> }
) {
  await connection();

  const { ruta } = await params;

  // decodeURIComponent porque los nombres pueden llevar %20 y demas.
  // Si viniera un %2e%2e, aqui se convierte en ".." y lo caza
  // resolverRutaSegura, que normaliza antes de comparar.
  let relativa: string;
  try {
    relativa = ruta.map((segmento) => decodeURIComponent(segmento)).join("/");
  } catch {
    return NextResponse.json({ error: "Ruta no valida" }, { status: 400 });
  }

  const destino = resolverRutaSegura(relativa);
  if (!destino) {
    return NextResponse.json({ error: "Ruta no valida" }, { status: 400 });
  }

  try {
    const info = await stat(destino);
    if (!info.isFile()) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const contenido = await readFile(destino);
    const cuerpo = new Uint8Array(contenido);

    return new NextResponse(cuerpo, {
      headers: {
        "Content-Type": tipoPorExtension(destino),
        "Content-Length": String(info.size),
        // Los nombres ya son unicos (UUID de carpeta o marca de tiempo),
        // asi que el contenido de una URL nunca cambia.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}

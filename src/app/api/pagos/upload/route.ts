import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { directorioUploads, RUTA_PUBLICA_UPLOADS } from "@/lib/uploads";
import {
  MAX_BYTES,
  EXTENSIONES_VISIBLES,
  formatearPeso,
  tipoPermitido,
  nombreSeguro,
} from "@/lib/brief-documentos";
import { exigirPermiso } from "@/lib/api-guard";

/**
 * POST /api/pagos/upload
 *
 * Sube la cuenta de cobro o el certificado bancario de un pago.
 *
 * Los archivos van al directorio de subidas (UPLOADS_DIR, un volumen
 * montado en el contenedor) y se sirven por /api/uploads/[...ruta].
 * NO a public/: con output "standalone" Next no sirve lo que aparezca
 * ahi despues del build.
 *
 * A diferencia de los adjuntos del brief, esto SI exige sesion: un
 * soporte de pago no lo sube un desconocido.
 */
export async function POST(req: Request) {
  const sesion = await exigirPermiso("pagos", "actualizar");
  if (sesion instanceof NextResponse) return sesion;

  const form = await req.formData();
  const archivo = form.get("archivo");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: "No llegó ningún archivo" }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera el límite de ${formatearPeso(MAX_BYTES)}` },
      { status: 400 }
    );
  }
  if (archivo.type && !tipoPermitido(archivo.type)) {
    return NextResponse.json(
      { error: `Tipo no permitido. Se aceptan ${EXTENSIONES_VISIBLES}` },
      { status: 400 }
    );
  }

  try {
    // Una carpeta por archivo: dos personas pueden subir "cuenta.pdf"
    // el mismo dia y ninguna debe pisar a la otra.
    const carpeta = randomUUID();
    const destino = join(directorioUploads(), "pagos", carpeta);
    await mkdir(destino, { recursive: true });

    const nombre = nombreSeguro(archivo.name);
    await writeFile(join(destino, nombre), Buffer.from(await archivo.arrayBuffer()));

    return NextResponse.json({
      url: `${RUTA_PUBLICA_UPLOADS}/pagos/${carpeta}/${nombre}`,
      nombre: archivo.name,
    });
  } catch (error) {
    console.error("Error subiendo el documento del pago:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el archivo" },
      { status: 500 }
    );
  }
}

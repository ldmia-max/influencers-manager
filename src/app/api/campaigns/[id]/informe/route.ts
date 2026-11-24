import { NextResponse } from "next/server";
import { getCampaignById } from "@/data-access/campaigns";
import { analisisGuardado, datosDelInforme } from "@/data-access/informes";
import { NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { analisisPropuesto } from "@/lib/informe/calculos";
import { construirInforme } from "@/lib/informe/pptx";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/campaigns/[id]/informe
 *
 * El informe de resultados en PowerPoint, armado en el momento con las
 * cifras de hoy. Es solo de la agencia: el portal del cliente tiene su
 * propia sesion y no llega a esta ruta.
 *
 * No consume Apify: las portadas salen de lo que ya guardo el refresco
 * diario, y si falta alguna se piden a YouTube o al oEmbed de TikTok,
 * que son gratuitos.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const campana = await getCampaignById(id);
    // La misma regla que la ficha: quien solo ve lo suyo no descarga lo
    // de otros.
    const sinPermiso = exigirPropiedad(sesion, "campanas", campana.createdById);
    if (sinPermiso) return sinPermiso;

    const datos = await datosDelInforme(id);
    const analisis = { ...analisisPropuesto(datos), ...(await analisisGuardado(id)) };
    const archivo = await construirInforme(datos, analisis);

    const nombre = `Informe - ${datos.campana.nombre}.pptx`;
    const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "");
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error generando el informe:", error);
    return NextResponse.json(
      { error: "No se pudo generar el informe" },
      { status: 500 }
    );
  }
}

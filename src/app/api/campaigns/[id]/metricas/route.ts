import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refrescarMetricasDeCampana } from "@/data-access/metricas";
import { exigirPermiso } from "@/lib/api-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/metricas
 *
 * Refresca ya las metricas de una campana, sin esperar a la tarea
 * diaria. Sirve para el momento en que se prepara el informe del
 * cliente y se quieren las cifras del dia.
 *
 * Consume credito de Apify: una consulta por publicacion.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: "Falta APIFY_API_TOKEN: no se pueden leer métricas" },
        { status: 503 }
      );
    }

    const resultado = await refrescarMetricasDeCampana(id);
    revalidateTag("campaigns", "hours");
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error refrescando métricas:", error);
    return NextResponse.json(
      { error: "No se pudieron refrescar las métricas" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { connection } from "next/server";
import { entregasParaRefrescar, refrescarMetricas } from "@/data-access/metricas";
import { enviarAvisosDeEntregas } from "@/services/avisos-entregas";

/**
 * POST /api/cron/diario
 *
 * Las dos tareas diarias en una sola llamada: refrescar las metricas de
 * lo publicado y avisar de los vencimientos de entrega.
 *
 * Existe porque cada tarea que hay que programar aparte es una tarea que
 * alguien puede olvidar. Con una sola entrada en el programador no queda
 * la mitad del sistema funcionando a medias.
 *
 * Programacion en Dokploy (o cron del sistema), una vez al dia:
 *   curl -X POST https://<host>/api/cron/diario \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Las dos partes se ejecutan por separado y un fallo en una no impide la
 * otra: que Apify este caido no es motivo para que nadie se entere de
 * que hoy vence una entrega.
 */
export async function POST(req: Request) {
  await connection();

  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("[cron/diario] Falta CRON_SECRET: la ruta queda deshabilitada");
    return NextResponse.json(
      { error: "La tarea programada no está configurada" },
      { status: 503 }
    );
  }

  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado: Record<string, unknown> = {};

  try {
    const entregas = await entregasParaRefrescar();
    resultado.metricas =
      entregas.length === 0
        ? { mensaje: "Nada que refrescar", consultadas: 0 }
        : await refrescarMetricas(entregas);
  } catch (error) {
    console.error("[cron/diario] Falló el refresco de métricas:", error);
    resultado.metricas = { error: "No se pudieron refrescar las métricas" };
  }

  try {
    resultado.avisos = await enviarAvisosDeEntregas();
  } catch (error) {
    console.error("[cron/diario] Fallaron los avisos de entregas:", error);
    resultado.avisos = { error: "No se pudieron enviar los avisos" };
  }

  return NextResponse.json(resultado);
}

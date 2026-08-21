import { NextResponse } from "next/server";
import { connection } from "next/server";
import { entregasParaRefrescar, refrescarMetricas } from "@/data-access/metricas";

/**
 * POST /api/cron/metricas
 *
 * Refresca las metricas de los contenidos publicados en el ultimo mes.
 * Pensado para una tarea programada diaria, no para el navegador.
 *
 * No usa la sesion de NextAuth porque quien llama es una maquina: se
 * autentica con CRON_SECRET en la cabecera Authorization. Sin ese
 * secreto configurado la ruta se niega a funcionar, en vez de quedarse
 * abierta —un endpoint que dispara scraping de pago no puede estar al
 * alcance de cualquiera que adivine la URL—.
 *
 * Programacion en Dokploy (o cron del sistema), una vez al dia:
 *   curl -X POST https://<host>/api/cron/metricas \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: Request) {
  // cacheComponents rechaza `export const dynamic`, asi que la ruta se
  // marca como dinamica con connection().
  await connection();

  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("[cron/metricas] Falta CRON_SECRET: la ruta queda deshabilitada");
    return NextResponse.json(
      { error: "La tarea programada no está configurada" },
      { status: 503 }
    );
  }

  const cabecera = req.headers.get("authorization") ?? "";
  if (cabecera !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const entregas = await entregasParaRefrescar();
    if (entregas.length === 0) {
      return NextResponse.json({ mensaje: "Nada que refrescar", consultadas: 0 });
    }

    const resultado = await refrescarMetricas(entregas);
    console.log(
      `[cron/metricas] ${resultado.guardadas} de ${resultado.consultadas} actualizadas`,
      resultado.porPlataforma
    );
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[cron/metricas] Falló el refresco:", error);
    return NextResponse.json(
      { error: "No se pudieron refrescar las métricas" },
      { status: 500 }
    );
  }
}

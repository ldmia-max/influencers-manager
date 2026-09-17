import { NextResponse } from "next/server";
import { connection } from "next/server";
import { enviarAvisosDeEntregas } from "@/services/avisos-entregas";

/**
 * POST /api/cron/entregas
 *
 * Avisa por correo de las entregas que vencen pronto y de las que ya
 * vencieron. Un correo al dia por persona, con todas sus campanas
 * dentro; si no hay nada que reclamar, no sale ninguno.
 *
 * Como el cron de metricas: quien llama es una maquina, asi que se
 * autentica con CRON_SECRET y sin ese secreto la ruta se niega a
 * funcionar en vez de quedarse abierta.
 *
 * Lo normal es programar /api/cron/diario, que hace esto y ademas
 * refresca las metricas. Esta ruta existe aparte para poder dispararla
 * sola al probar, sin gastar credito de Apify.
 */
export async function POST(req: Request) {
  await connection();

  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("[cron/entregas] Falta CRON_SECRET: la ruta queda deshabilitada");
    return NextResponse.json(
      { error: "La tarea programada no está configurada" },
      { status: 503 }
    );
  }

  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json(await enviarAvisosDeEntregas());
}

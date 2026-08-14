import { NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health
 *
 * Sonda de salud para Dokploy y Traefik. Es PUBLICA a proposito: el
 * matcher de src/middleware.ts no cubre /api/health, asi que responde
 * sin sesion. No expone nada sensible, solo si el proceso vive y si la
 * base de datos contesta.
 *
 * Devuelve 503 (no 500) cuando la base de datos no responde, para que
 * el orquestador lo lea como "no listo" y no mande trafico a este
 * contenedor durante un redespliegue.
 *
 * Se usa connection() y no "export const dynamic": con cacheComponents
 * activado en next.config.ts esa opcion de segmento esta prohibida y
 * rompe el build.
 */
export async function GET() {
  // Fuera del try: connection() rechaza a proposito cuando Next aborta
  // el prerender durante el build, y ese rechazo tiene que propagarse.
  // Capturarlo aqui ensucia el log del build con un fallo que no existe.
  await connection();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", database: "down" },
      { status: 503 }
    );
  }
}

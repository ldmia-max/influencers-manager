import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import { refrescarMetricasPendientesDeCampana } from "@/data-access/metricas";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

/**
 * POST /api/client-portal/metricas/[campaignId]
 *
 * Relee las cifras de las publicaciones de una campana, pedido desde el
 * portal del cliente.
 *
 * Esta ruta NO figura en el matcher de src/middleware.ts, igual que
 * /api/client-auth/* y /api/client-portal/revisar: se protege sola
 * leyendo la cookie firmada del portal. **El clientId sale de ahi y
 * entra en el where**, que es lo unico que impide refrescar —y por
 * tanto confirmar que existe— la campana de otro cliente. Nunca se
 * acepta del cuerpo ni de la URL.
 *
 * Se excluye DRAFT por lo mismo que `getCampaignsForClientPortal`: una
 * campana en montaje no es suya todavia.
 *
 * **Gasta credito de Apify**, y aqui el boton lo tiene cualquiera que
 * entre al portal, no un empleado que sabe lo que cuesta. Por eso llama
 * a `refrescarMetricasPendientesDeCampana` y no a la version de la
 * agencia: aquella relee todas las publicaciones en cada pulsacion;
 * esta solo las que llevan mas de 20 h sin leerse, que es la misma
 * regla de la tarea nocturna. Pulsar diez veces seguidas cuesta lo
 * mismo que pulsar una.
 *
 * No invalida ninguna etiqueta de cache: las lecturas de campana no
 * estan cacheadas —ver el aviso sobre `revalidateTag("campaigns")` en
 * CLAUDE.md— y la pagina del portal vuelve a consultarlas al recargar.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;

    const almacen = await cookies();
    const sesion = await verificarSesionCliente(
      almacen.get(COOKIE_SESION_CLIENTE)?.value
    );

    if (!sesion) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const campana = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        clientId: sesion.clientId,
        status: { not: "DRAFT" },
      },
      select: { id: true },
    });

    if (!campana) {
      return NextResponse.json(
        { error: "Campaña no encontrada" },
        { status: 404 }
      );
    }

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: "Las métricas no están disponibles en este momento." },
        { status: 503 }
      );
    }

    const resultado = await refrescarMetricasPendientesDeCampana(campaignId);

    return NextResponse.json({
      consultadas: resultado.consultadas,
      guardadas: resultado.guardadas,
      yaAlDia: resultado.yaAlDia,
      seguidas: resultado.seguidas,
    });
  } catch (error) {
    console.error("Error refrescando métricas desde el portal:", error);
    return NextResponse.json(
      { error: "No se pudieron actualizar las cifras" },
      { status: 500 }
    );
  }
}

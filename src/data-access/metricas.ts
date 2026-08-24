import { prisma } from "@/lib/prisma";
import {
  obtenerMetricasDePublicaciones,
  plataformaDeUrl,
} from "@/lib/apify";

/**
 * Refresco de las metricas de los contenidos entregados.
 *
 * Se persigue un mes desde que se publico el contenido. Pasado ese
 * plazo una publicacion apenas se mueve, y seguir consultandola gasta
 * credito de Apify para dibujar una linea plana.
 */

/** Cuanto tiempo se sigue una publicacion desde que se publico. */
export const DIAS_DE_SEGUIMIENTO = 30;

/**
 * Margen entre capturas.
 *
 * Algo menos de 24 h para que una tarea diaria no se salte un dia por
 * arrancar unos minutos antes que la vispera.
 */
const HORAS_ENTRE_CAPTURAS = 20;

/**
 * Que entregas toca refrescar.
 *
 * `publicadoEn` puede venir vacio —no siempre se sabe cuando se publico—
 * y entonces cuenta la fecha en que se registro el link. Es una
 * aproximacion, pero preferible a no seguir nunca esa publicacion.
 */
export async function entregasParaRefrescar(limite = 200) {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - DIAS_DE_SEGUIMIENTO * 24 * 60 * 60 * 1000);
  const corte = new Date(ahora.getTime() - HORAS_ENTRE_CAPTURAS * 60 * 60 * 1000);

  const candidatas = await prisma.campaignEntrega.findMany({
    where: {
      // Sin URL no hay nada que consultar: los formatos efimeros se
      // confirman a mano y sus cifras solo las ve el creador.
      url: { not: null },
      OR: [{ publicadoEn: { gte: desde } }, { publicadoEn: null, entregadoEn: { gte: desde } }],
    },
    orderBy: { entregadoEn: "desc" },
    take: limite,
    select: {
      id: true,
      url: true,
      metricas: {
        orderBy: { capturadoEn: "desc" },
        take: 1,
        select: { capturadoEn: true },
      },
    },
  });

  // La ultima captura se filtra aqui y no en la consulta porque Prisma no
  // sabe comparar contra el maximo de una relacion.
  return candidatas.filter(
    (e) => !e.metricas[0] || e.metricas[0].capturadoEn < corte
  );
}

/**
 * Lee y guarda las metricas de las entregas indicadas.
 *
 * Agrupa por plataforma para mandar una sola llamada por red en lugar de
 * una por link: cada arranque de actor tiene coste fijo.
 *
 * Lo que no se consiga leer no se guarda. Una publicacion borrada, o una
 * cuenta que se hizo privada, dejaria ceros en el historico que luego se
 * leerian como una caida real de audiencia.
 */
export async function refrescarMetricas(
  entregas: { id: string; url: string | null }[]
): Promise<{ consultadas: number; guardadas: number; porPlataforma: Record<string, number> }> {
  const porPlataforma = new Map<string, { id: string; url: string }[]>();

  for (const entrega of entregas) {
    if (!entrega.url) continue;
    const plataforma = plataformaDeUrl(entrega.url);
    if (!plataforma || plataforma === "kick") continue;
    const lista = porPlataforma.get(plataforma) ?? [];
    lista.push({ id: entrega.id, url: entrega.url });
    porPlataforma.set(plataforma, lista);
  }

  let guardadas = 0;
  const resumen: Record<string, number> = {};

  for (const [plataforma, lista] of porPlataforma) {
    const metricas = await obtenerMetricasDePublicaciones(
      plataforma,
      lista.map((e) => e.url)
    );

    const filas = lista
      .map((entrega) => {
        const m = metricas.get(entrega.url);
        if (!m) return null;
        return {
          entregaId: entrega.id,
          vistas: m.vistas,
          meGusta: m.meGusta,
          comentarios: m.comentarios,
          compartidos: m.compartidos,
          guardados: m.guardados,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    if (filas.length > 0) {
      await prisma.campaignEntregaMetrica.createMany({ data: filas });
      guardadas += filas.length;
    }
    resumen[plataforma] = filas.length;
  }

  return { consultadas: entregas.length, guardadas, porPlataforma: resumen };
}

/** Refresca ahora mismo todas las entregas de una campana. */
export async function refrescarMetricasDeCampana(campaignId: string) {
  const entregas = await prisma.campaignEntrega.findMany({
    where: {
      url: { not: null },
      campaignService: {
        campaignProfilePlatform: {
          campaignProfile: { campaignId, participacion: "ACTIVO" },
        },
      },
    },
    select: { id: true, url: true },
  });

  if (entregas.length === 0) {
    return { consultadas: 0, guardadas: 0, porPlataforma: {} };
  }
  return refrescarMetricas(entregas);
}

/**
 * Historico de metricas de una campana, para los graficos.
 *
 * Devuelve una fila por captura y entrega. Agregar por dia se hace
 * arriba, en el componente, porque quien pinta la grafica es quien sabe
 * si quiere el total de la campana o el desglose por influencer.
 */
export async function historicoDeCampana(campaignId: string) {
  return prisma.campaignEntregaMetrica.findMany({
    where: {
      entrega: {
        campaignService: {
          campaignProfilePlatform: {
            campaignProfile: { campaignId, participacion: "ACTIVO" },
          },
        },
      },
    },
    orderBy: { capturadoEn: "asc" },
    select: {
      capturadoEn: true,
      vistas: true,
      meGusta: true,
      comentarios: true,
      compartidos: true,
      guardados: true,
      entrega: {
        select: {
          id: true,
          url: true,
          campaignService: {
            select: {
              campaignProfilePlatform: {
                select: {
                  socialAccount: {
                    select: {
                      username: true,
                      platform: { select: { name: true, displayName: true } },
                    },
                  },
                  campaignProfile: {
                    select: { profile: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

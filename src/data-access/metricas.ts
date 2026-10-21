import { prisma } from "@/lib/prisma";
import { obtenerMetricasDePublicaciones, plataformaDeUrl } from "@/lib/apify";
import { idDePublicacion } from "@/lib/social-handles";

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
function ventanaDeSeguimiento() {
  const ahora = Date.now();
  return {
    /** Publicado dentro del mes que se persigue. */
    desde: new Date(ahora - DIAS_DE_SEGUIMIENTO * 24 * 60 * 60 * 1000),
    /** Capturado antes de esto: toca volver a leerlo. */
    corte: new Date(ahora - HORAS_ENTRE_CAPTURAS * 60 * 60 * 1000),
  };
}

const SELECCION_CANDIDATA = {
  id: true,
  url: true,
  metricas: {
    orderBy: { capturadoEn: "desc" as const },
    take: 1,
    select: { capturadoEn: true },
  },
} as const;

/**
 * La ultima captura se filtra en memoria y no en la consulta porque
 * Prisma no sabe comparar contra el maximo de una relacion.
 */
function sinCapturaReciente(
  candidatas: { id: string; url: string | null; metricas: { capturadoEn: Date }[] }[],
  corte: Date
) {
  return candidatas.filter((e) => !e.metricas[0] || e.metricas[0].capturadoEn < corte);
}

export async function entregasParaRefrescar(limite = 200) {
  const { desde, corte } = ventanaDeSeguimiento();

  const candidatas = await prisma.campaignEntrega.findMany({
    where: {
      // Sin URL no hay nada que consultar: los formatos efimeros se
      // confirman a mano y sus cifras solo las ve el creador.
      url: { not: null },
      OR: [{ publicadoEn: { gte: desde } }, { publicadoEn: null, entregadoEn: { gte: desde } }],
    },
    orderBy: { entregadoEn: "desc" },
    take: limite,
    select: SELECCION_CANDIDATA,
  });

  return sinCapturaReciente(candidatas, corte);
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
        // Primero por identificador de publicacion, que sobrevive a los
        // parametros que anaden las apps al copiar el enlace; la URL
        // exacta queda como respaldo.
        const id = idDePublicacion(entrega.url);
        const m = (id ? metricas.get(id) : undefined) ?? metricas.get(entrega.url);
        if (!m) return null;
        return {
          entregaId: entrega.id,
          vistas: m.vistas,
          meGusta: m.meGusta,
          comentarios: m.comentarios,
          compartidos: m.compartidos,
          guardados: m.guardados,
          reposteos: m.reposteos,
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
 * Refresca una campana, pero solo lo que de verdad toca.
 *
 * Es la hermana frenada de `refrescarMetricasDeCampana`, que relee
 * TODAS las publicaciones cada vez que se la llama. Eso vale para un
 * boton de la agencia, donde quien lo pulsa sabe lo que cuesta y lo
 * pulsa antes de preparar un informe. No vale para el portal del
 * cliente: ahi el boton lo tiene cualquiera que entre, y diez clics
 * seguidos serian diez consultas a Apify por publicacion para redibujar
 * exactamente el mismo numero.
 *
 * Aplica la misma regla que la tarea diaria —un mes de seguimiento, una
 * captura cada 20 h— de modo que el gasto maximo que puede provocar un
 * cliente pulsando sin parar es el que la tarea nocturna iba a hacer de
 * todas formas. Si no hay nada vencido devuelve `yaAlDia` y no llama a
 * nadie, para que la interfaz pueda decirlo en vez de fingir un
 * refresco.
 */
export async function refrescarMetricasPendientesDeCampana(campaignId: string) {
  const { desde, corte } = ventanaDeSeguimiento();

  const candidatas = await prisma.campaignEntrega.findMany({
    where: {
      url: { not: null },
      campaignService: {
        campaignProfilePlatform: {
          campaignProfile: { campaignId, participacion: "ACTIVO" },
        },
      },
      OR: [
        { publicadoEn: { gte: desde } },
        { publicadoEn: null, entregadoEn: { gte: desde } },
      ],
    },
    select: SELECCION_CANDIDATA,
  });

  const entregas = sinCapturaReciente(candidatas, corte);

  if (entregas.length === 0) {
    return {
      consultadas: 0,
      guardadas: 0,
      porPlataforma: {},
      yaAlDia: true,
      seguidas: candidatas.length,
    };
  }

  const resultado = await refrescarMetricas(entregas);
  return { ...resultado, yaAlDia: false, seguidas: candidatas.length };
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
      origen: true,
      vistas: true,
      interacciones: true,
      meGusta: true,
      comentarios: true,
      compartidos: true,
      guardados: true,
      reposteos: true,
      entrega: {
        select: {
          id: true,
          url: true,
          // Que pieza es, para poder nombrarla en el desglose por
          // publicacion: "Reel", "Story"... Nulo en las entregas
          // anteriores a ese campo.
          serviceType: { select: { displayName: true } },
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

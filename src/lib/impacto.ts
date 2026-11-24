import { redAdmiteAlcance } from "@/lib/campaign-utils";

/**
 * Lo medido y lo anotado a mano de cada publicacion, fundido en una sola
 * pieza.
 *
 * Vive aqui, sin "use client", porque lo usan dos sitios que no pueden
 * discrepar: Impacto del contenido, que lo pinta en el navegador, y el
 * informe de resultados, que lo arma en el servidor. Dos copias de esta
 * regla acabarian dando dos totales distintos de la misma campana.
 */

export interface CapturaMetrica {
  capturadoEn: string;
  /** MEDIDA la leyó Apify; REPORTADA la dijo el creador. */
  origen: string;
  vistas: number | null;
  /**
   * Interacciones en un solo numero, cuando la cifra la anoto una
   * persona. Nulo en lo que mide el scraper, que si trae el desglose.
   */
  interacciones?: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  guardados: number | null;
  /** Solo TikTok: publicar el contenido en el perfil propio. */
  reposteos?: number | null;
  entregaId: string;
  /** Enlace de la publicación. Vacío en formatos sin enlace permanente. */
  url?: string | null;
  /** "Reel", "Story"… Nulo en entregas anteriores a que se señalara. */
  formato?: string | null;
  influencer: string;
  plataforma: string;
  username: string;
}

/**
 * Una publicacion registrada, con las cifras que se escriben a mano.
 *
 * Llega aparte de las capturas porque una entrega de hoy todavia no
 * tiene medicion y aun asi hay que poder anotarle el alcance.
 */
export interface Publicacion {
  entregaId: string;
  influencer: string;
  plataforma: string;
  username: string;
  url: string | null;
  formato: string | null;
  /**
   * Si esta red reporta alcance. Instagram lo llama así y TikTok
   * «Total espectadores»: lo mismo con otro nombre, y las dos solo se
   * lo enseñan a su autor en su panel, que es por lo que esta cifra se
   * teclea en vez de leerse.
   */
  admiteAlcance: boolean;
  esEfimero: boolean;
  alcance: number | null;
  /**
   * Si en esta red se cuentan reposteos. Solo Instagram.
   *
   * Es una decision de la agencia, no de las redes: TikTok publica un
   * repostCount y se sigue guardando, pero aqui no se muestra ni se
   * suma. En YouTube y Kick no existe el concepto.
   */
  admiteReposteos: boolean;
  compartidosReportados: number | null;
  reposteosReportados: number | null;
  /**
   * Contenido que el creador publico por su cuenta, fuera del contrato.
   *
   * Cuenta igual —son vistas reales— pero no es lo contratado, asi que
   * se puede mirar aparte: la campana sola, lo extra solo, o todo junto.
   */
  esExtra: boolean;
}

/** Lo medido y lo anotado, ya fundidos: es lo que se pinta y lo que se suma. */
export interface Pieza {
  entregaId: string;
  influencer: string;
  plataforma: string;
  username: string;
  url: string | null;
  formato: string | null;
  admiteAlcance: boolean;
  esEfimero: boolean;
  admiteReposteos: boolean;
  esExtra: boolean;
  origen: string;
  vistas: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  reposteos: number | null;
  guardados: number | null;
  interacciones: number | null;
  alcance: number | null;
  /** Que cifras de esta fila las escribio una persona, no el scraper. */
  aMano: { compartidos: boolean; reposteos: boolean };
}

/** Lo que el modal puede cambiar de una publicacion. */
export type CifrasAMano = {
  alcance: number | null;
  compartidosReportados: number | null;
  reposteosReportados: number | null;
  /**
   * Solo en los efimeros, y solo si se acaban de anotar.
   *
   * `undefined` es "no se tocó" y deja mandar a la ultima captura;
   * `null` seria "sin dato", que aqui no se usa porque una casilla
   * vacia significa dejar la cifra como estaba.
   */
  vistas?: number | null;
  interacciones?: number | null;
};

/**
 * Las interacciones de una publicacion.
 *
 * Una historia trae un unico numero porque su autor no ve mas: no se
 * puede sumar un desglose que la plataforma no da. Cuando existe manda
 * sobre la suma, que ahi valdria cero.
 *
 * Vive aqui y no dentro de un bucle porque ahora la usan dos calculos
 * —el aporte por influencer y el engagement— y dos copias de esta regla
 * acabarian dando dos numeros distintos para lo mismo.
 */
export function interaccionesDe(c: {
  interacciones: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  reposteos: number | null;
}): number {
  return (
    c.interacciones ??
    (c.meGusta ?? 0) +
      (c.comentarios ?? 0) +
      (c.compartidos ?? 0) +
      (c.reposteos ?? 0)
  );
}

/**
 * Las piezas de la vista elegida, con lo medido y lo anotado fundidos.
 *
 * `cifrasLocales` es lo que el navegador acaba de anotar y el servidor
 * aun no ha devuelto; el informe no lo usa.
 */
export function fundirPiezas(
  capturas: CapturaMetrica[],
  publicaciones: Publicacion[],
  entra: (esExtra: boolean) => boolean,
  cifrasLocales: Record<string, CifrasAMano> = {},
): { capturasDeLaVista: CapturaMetrica[]; actuales: Pieza[] } {
  const extraPorEntrega = new Map(
    publicaciones.map((pub) => [pub.entregaId, pub.esExtra])
  );
  const capturasDeLaVista = capturas.filter((c) =>
    entra(extraPorEntrega.get(c.entregaId) ?? false)
  );

  const ultimaPorEntrega = new Map<string, CapturaMetrica>();
  for (const c of capturasDeLaVista) {
    const previa = ultimaPorEntrega.get(c.entregaId);
    if (!previa || c.capturadoEn > previa.capturadoEn) {
      ultimaPorEntrega.set(c.entregaId, c);
    }
  }

  // Una fila por publicacion registrada, no por captura: una entrega
  // de hoy todavia no tiene medicion y aun asi tiene que poder
  // anotarse. Lo medido y lo escrito a mano se funden aqui, antes de
  // sumar nada, para que las tarjetas, los totales por red, el aporte
  // por influencer y las filas de abajo salgan del mismo sitio y no
  // puedan discrepar.
  const actuales: Pieza[] = [];
  const vistos = new Set<string>();
  for (const pub of publicaciones) {
    if (!entra(pub.esExtra)) continue;
    const local = cifrasLocales[pub.entregaId];
    const alcance = local ? local.alcance : pub.alcance;
    const compartidosAMano = local
      ? local.compartidosReportados
      : pub.compartidosReportados;
    const reposteosAMano = local
      ? local.reposteosReportados
      : pub.reposteosReportados;
    const c = ultimaPorEntrega.get(pub.entregaId);
    vistos.add(pub.entregaId);
    actuales.push({
      entregaId: pub.entregaId,
      influencer: pub.influencer,
      plataforma: pub.plataforma,
      username: pub.username,
      url: pub.url,
      formato: pub.formato,
      admiteAlcance: pub.admiteAlcance,
      esEfimero: pub.esEfimero,
      admiteReposteos: pub.admiteReposteos,
      esExtra: pub.esExtra,
      origen: c?.origen ?? "MEDIDA",
      // Lo que se acaba de anotar manda sobre la ultima captura: la
      // captura nueva ya esta en la base, pero el servidor no repinta
      // de forma fiable en produccion.
      vistas: local?.vistas !== undefined ? local.vistas : (c?.vistas ?? null),
      meGusta: c?.meGusta ?? null,
      comentarios: c?.comentarios ?? null,
      interacciones:
        local?.interacciones !== undefined
          ? local.interacciones
          : (c?.interacciones ?? null),
      guardados: c?.guardados ?? null,
      // Lo escrito a mano manda sobre lo medido: alguien miro el panel
      // del creador —la unica fuente donde Instagram publica estas dos
      // cifras— y corrigio lo que habia.
      compartidos: compartidosAMano ?? c?.compartidos ?? null,
      reposteos: pub.admiteReposteos
        ? (reposteosAMano ?? c?.reposteos ?? null)
        : null,
      alcance,
      aMano: {
        compartidos: compartidosAMano !== null,
        reposteos: pub.admiteReposteos && reposteosAMano !== null,
      },
    });
  }
  // Una medicion de una entrega que no llego en la lista no deberia
  // existir, pero perderla en silencio seria peor que pintarla.
  for (const c of ultimaPorEntrega.values()) {
    if (vistos.has(c.entregaId)) continue;
    actuales.push({
      entregaId: c.entregaId,
      influencer: c.influencer,
      plataforma: c.plataforma,
      username: c.username,
      url: c.url ?? null,
      formato: c.formato ?? null,
      admiteAlcance: redAdmiteAlcance(c.plataforma),
      esEfimero: false,
      admiteReposteos: c.plataforma.toLowerCase() === "instagram",
      esExtra: false,
      origen: c.origen,
      vistas: c.vistas,
      meGusta: c.meGusta,
      comentarios: c.comentarios,
      interacciones: c.interacciones ?? null,
      guardados: c.guardados,
      compartidos: c.compartidos,
      reposteos:
        c.plataforma.toLowerCase() === "instagram" ? (c.reposteos ?? null) : null,
      alcance: null,
      aMano: { compartidos: false, reposteos: false },
    });
  }

  return { capturasDeLaVista, actuales };
}

/**
 * Engagement sobre el alcance de un conjunto de piezas.
 */
export function engagementSobreAlcance(actuales: Pieza[]): {
  engagement: number | null;
  piezasConAlcance: number;
} {
  let alcanceTotal = 0;
  let interaccionesDelAlcance = 0;
  let piezasConAlcance = 0;
  for (const c of actuales) {
    const vieron = c.alcance ?? c.vistas;
    if (vieron === null || vieron <= 0) continue;
    alcanceTotal += vieron;
    interaccionesDelAlcance += interaccionesDe(c);
    piezasConAlcance += 1;
  }
  const engagement =
    alcanceTotal > 0 ? (interaccionesDelAlcance / alcanceTotal) * 100 : null;

  return { engagement, piezasConAlcance };
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Repeat2,
  Share2,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import { apiPatch, apiPost } from "@/services/api";
import { Barra } from "./prevision-campana";
import { VISUALIZACIONES_POR_SEGUIDOR } from "@/lib/campaign-utils";
import { registrarCifras } from "@/services/entregas";

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
  esInstagram: boolean;
  esEfimero: boolean;
  /** Solo Instagram lo mide y solo lo ve su autor. */
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
interface Pieza {
  entregaId: string;
  influencer: string;
  plataforma: string;
  username: string;
  url: string | null;
  formato: string | null;
  esInstagram: boolean;
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
type CifrasAMano = {
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

interface Props {
  campaignId: string;
  capturas: CapturaMetrica[];
  /** Una por entrega registrada, haya sido medida o no. */
  publicaciones?: Publicacion[];
  /** El portal del cliente solo mira: no refresca ni gasta crédito. */
  puedeRefrescar?: boolean;
  /**
   * Cerrada la campana sus cifras son historia comercial: lo que se le
   * entrego al cliente, y no se reescribe.
   */
  puedeEditarCifras?: boolean;
  /**
   * Seguidores sumados de los creadores contratados. De aqui sale el
   * estimado de visualizaciones, que es el 25%.
   *
   * Opcional: sin el, la barra no se pinta. Una campana sin seguidores
   * daria un estimado de cero y una barra que no diria nada.
   */
  seguidores?: number;
}

/**
 * General primero y por defecto: es lo que de verdad vio la gente, y
 * quien abre Impacto viene a eso. Campana y Extra estan detras para
 * separar lo contratado de lo que el creador regalo.
 */
const VISTAS = [
  {
    clave: "general" as const,
    nombre: "General",
    explica: "Todo junto: lo contratado y lo extra",
  },
  {
    clave: "campana" as const,
    nombre: "Campaña",
    explica: "Solo el contenido contratado",
  },
  {
    clave: "extra" as const,
    nombre: "Extra",
    explica: "Solo lo que el creador publicó por su cuenta",
  },
];

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
/**
 * El engagement, escrito como se lee en voz alta.
 *
 * Un decimal solo cuando aporta: "5 %" y no "5,0 %", pero "0,8 %" y no
 * "1 %", que redondeando a entero perderia justo donde la cifra es
 * pequena y la diferencia importa.
 */
function porcentajeLegible(valor: number): string {
  const uno = Math.round(valor * 10) / 10;
  const texto = Number.isInteger(uno)
    ? String(uno)
    : uno.toFixed(1).replace(".", ",");
  return `${texto} %`;
}

function interaccionesDe(c: {
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

const SERIES = [
  { clave: "vistas" as const, nombre: "Vistas", color: "#7c3aed", icono: Eye },
  { clave: "meGusta" as const, nombre: "Me gusta", color: "#ec4899", icono: Heart },
  { clave: "comentarios" as const, nombre: "Comentarios", color: "#0ea5e9", icono: MessageCircle },
  { clave: "compartidos" as const, nombre: "Compartidos", color: "#22c55e", icono: Share2 },
  { clave: "reposteos" as const, nombre: "Reposteos", color: "#f97316", icono: Repeat2 },
];

/**
 * Una cifra agregada, o una raya cuando ninguna de las publicaciones que
 * la componen la publica.
 *
 * `cuantasLaDan` es el numero de publicaciones del grupo que traen ese
 * dato. Si es cero no se ha medido un cero: es que esa red no lo da para
 * ese tipo de contenido —un carrusel de Instagram no tiene vistas—, y
 * escribir 0 seria afirmar que nadie lo vio. La misma regla que ya usan
 * las tarjetas de arriba con `disponible`.
 */
function Cifra({
  valor,
  cuantasLaDan,
  titulo,
}: {
  valor: number;
  cuantasLaDan: number;
  titulo: string;
}) {
  if (cuantasLaDan === 0) {
    return (
      <span className="text-gray-400" title={titulo}>
        —
      </span>
    );
  }
  return <>{formatNumber(valor)}</>;
}

function dia(iso: string): string {
  return iso.slice(0, 10);
}

export function MetricasCampana({
  campaignId,
  capturas,
  publicaciones = [],
  puedeRefrescar = false,
  puedeEditarCifras = false,
  seguidores = 0,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Lo que se acaba de anotar, dibujado por el propio componente.
   *
   * `router.refresh()` no repinta en la compilacion de produccion, asi
   * que esperar al servidor dejaria la tabla congelada hasta recargar.
   * Cuando el servidor vuelve a mandar la publicacion con esas cifras,
   * el valor de aqui y el de alli ya coinciden y no se duplica nada.
   */
  const [cifrasLocales, setCifrasLocales] = useState<Record<string, CifrasAMano>>({});
  const [editando, setEditando] = useState<Pieza | null>(null);
  /**
   * Que contenido se esta mirando.
   *
   * Lo contratado y lo que el creador publico de mas responden a
   * preguntas distintas —si la campana cumplio, y cuanto regalo el
   * creador— y sumarlos siempre las confunde. Tambien hace falta el
   * total, que es lo que de verdad vio la gente.
   */
  const [vista, setVista] = useState<"campana" | "extra" | "general">("general");
  const hayExtra = publicaciones.some((p) => p.esExtra);

  /**
   * Si la columna de alcance tiene algo que decir.
   *
   * En el portal del cliente no se puede escribir y no llegan cifras
   * anotadas, asi que seria una columna entera de rayas: ruido que
   * ademas insinua que falta un dato.
   */
  const hayAlcance =
    puedeEditarCifras || publicaciones.some((pub) => pub.alcance !== null);

  const datos = useMemo(() => {
    // Ultima captura de cada entrega. Sumar todas las capturas contaria
    // varias veces la misma publicacion: las metricas son acumuladas, no
    // incrementos.
    // Que publicaciones entran. Se filtra aqui, antes de cualquier
    // cuenta, para que las tarjetas, los totales por red, el aporte por
    // influencer, la evolucion y las filas hablen todas del mismo
    // conjunto y no puedan discrepar.
    const entra = (extra: boolean) =>
      vista === "general" ? true : vista === "extra" ? extra : !extra;
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
        esInstagram: pub.esInstagram,
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
        esInstagram: c.plataforma.toLowerCase() === "instagram",
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

    const totales = SERIES.map((s) => {
      // Si ninguna publicacion da el dato, no se muestra la tarjeta: un
      // cero se leeria como "nadie lo compartio", que es distinto de
      // "esta red no lo publica".
      const conDato = actuales.filter((c) => c[s.clave] !== null);
      return {
        ...s,
        valor: conDato.reduce((suma, c) => suma + (c[s.clave] ?? 0), 0),
        disponible: conDato.length > 0,
        cobertura: conDato.length,
      };
    });

    /**
     * Engagement sobre el alcance: de cuanta gente que vio la
     * publicacion salio una interaccion.
     *
     * El denominador es el alcance cuando la red lo da —solo Instagram,
     * y solo si alguien lo anoto— y las vistas cuando no: son las dos
     * maneras que tiene cada red de decir cuanta gente lo vio.
     *
     * Una pieza que no da ninguna de las dos queda fuera ENTERA, tambien
     * sus interacciones. Sumar los likes de un carrusel —que no publica
     * vistas— sobre el alcance de las demas inflaria el porcentaje con
     * un numerador que el denominador no cubre.
     */
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

    // Evolucion: total de la campana por dia, con la ultima captura de
    // cada entrega hasta ese dia.
    const dias = [...new Set(capturasDeLaVista.map((c) => dia(c.capturadoEn)))].sort();
    const evolucion = dias.map((d) => {
      const hasta = new Map<string, CapturaMetrica>();
      for (const c of capturasDeLaVista) {
        if (dia(c.capturadoEn) > d) continue;
        const previa = hasta.get(c.entregaId);
        if (!previa || c.capturadoEn > previa.capturadoEn) hasta.set(c.entregaId, c);
      }
      const vivas = [...hasta.values()];
      const fila: Record<string, string | number> = { dia: d.slice(5) };
      for (const s of SERIES) {
        fila[s.nombre] = vivas.reduce((suma, c) => suma + (c[s.clave] ?? 0), 0);
      }
      return fila;
    });

    // Reparto por influencer, para ver quien aporta que.
    const porInfluencer = new Map<
      string,
      { nombre: string; vistas: number; interacciones: number; reportadas: number }
    >();
    for (const c of actuales) {
      const fila = porInfluencer.get(c.influencer) ?? {
        nombre: c.influencer,
        vistas: 0,
        interacciones: 0,
        reportadas: 0,
      };
      fila.vistas += c.vistas ?? 0;
      fila.interacciones +=
        (c.meGusta ?? 0) + (c.comentarios ?? 0) + (c.compartidos ?? 0);
      // El asterisco del nombre avisa de que parte de su cifra la dijo él.
      if (c.origen === "REPORTADA") fila.reportadas++;
      porInfluencer.set(c.influencer, fila);
    }

    // Detalle de cada influencer, abierto por plataforma. La misma
    // persona suele entregar en dos redes y sus numeros no son
    // comparables entre si —un Reel y un video de TikTok no se miden
    // igual—, asi que se suman para saber quien aporta mas, pero se
    // muestran separados para saber de donde sale ese aporte.
    const detalle = new Map<
      string,
      {
        nombre: string;
        vistas: number;
        interacciones: number;
        publicaciones: number;
        reportadas: number;
        conVistas: number;
        conInteracciones: number;
        comentarios: number;
        conComentarios: number;
        plataformas: Map<
          string,
          {
            plataforma: string;
            username: string;
            vistas: number;
            interacciones: number;
            comentarios: number;
            conComentarios: number;
            publicaciones: number;
            reportadas: number;
            conVistas: number;
            conInteracciones: number;
            /**
             * Una fila por publicacion. Es el nivel al que se pregunta
             * "¿cuantos comentarios tuvo ESTA?", y ademas hace cuadrable
             * el total de arriba: sumando esta lista se llega al mismo
             * numero, porque las dos salen de la misma ultima captura de
             * cada entrega.
             */
            piezas: Pieza[];
          }
        >;
      }
    >();
    // Y el total de cada red, sumando a todos los influencers.
    const plataformas = new Map<
      string,
      {
        plataforma: string;
        vistas: number;
        interacciones: number;
        comentarios: number;
        conComentarios: number;
        publicaciones: number;
        reportadas: number;
        conVistas: number;
        conInteracciones: number;
      }
    >();

    for (const c of actuales) {
      // Una story trae un unico numero de interacciones porque su autor
      // no ve mas: no se puede sumar un desglose que la plataforma no da.
      // Cuando existe manda sobre la suma, que ahi valdria cero.
      const interacciones = interaccionesDe(c);
      const esReportada = c.origen === "REPORTADA" ? 1 : 0;
      // Cuantas publicaciones aportan cada cifra. Sin esto no se puede
      // distinguir "no tuvo vistas" de "esta red no las publica": un
      // carrusel de Instagram no da numero de vistas, y pintar un 0 seria
      // decir que nadie lo vio.
      const daVistas = c.vistas !== null ? 1 : 0;
      const daInteracciones =
        c.interacciones != null ||
        c.meGusta !== null ||
        c.comentarios !== null ||
        c.compartidos !== null ||
        c.reposteos != null
          ? 1
          : 0;
      const daComentarios = c.comentarios !== null ? 1 : 0;

      const persona =
        detalle.get(c.influencer) ??
        {
          nombre: c.influencer,
          vistas: 0,
          interacciones: 0,
          comentarios: 0,
          conComentarios: 0,
          publicaciones: 0,
          reportadas: 0,
          conVistas: 0,
          conInteracciones: 0,
          plataformas: new Map(),
        };
      persona.vistas += c.vistas ?? 0;
      persona.interacciones += interacciones;
      persona.publicaciones += 1;
      persona.reportadas += esReportada;
      persona.conVistas += daVistas;
      persona.conInteracciones += daInteracciones;
      persona.comentarios += c.comentarios ?? 0;
      persona.conComentarios += daComentarios;

      const cuenta =
        persona.plataformas.get(c.plataforma) ??
        {
          plataforma: c.plataforma,
          username: c.username,
          vistas: 0,
          interacciones: 0,
          comentarios: 0,
          conComentarios: 0,
          publicaciones: 0,
          reportadas: 0,
          conVistas: 0,
          conInteracciones: 0,
          piezas: [],
        };
      cuenta.piezas.push(c);
      cuenta.vistas += c.vistas ?? 0;
      cuenta.interacciones += interacciones;
      cuenta.publicaciones += 1;
      cuenta.reportadas += esReportada;
      cuenta.conVistas += daVistas;
      cuenta.conInteracciones += daInteracciones;
      cuenta.comentarios += c.comentarios ?? 0;
      cuenta.conComentarios += daComentarios;
      persona.plataformas.set(c.plataforma, cuenta);
      detalle.set(c.influencer, persona);

      const red =
        plataformas.get(c.plataforma) ??
        {
          plataforma: c.plataforma,
          vistas: 0,
          interacciones: 0,
          comentarios: 0,
          conComentarios: 0,
          publicaciones: 0,
          reportadas: 0,
          conVistas: 0,
          conInteracciones: 0,
        };
      red.vistas += c.vistas ?? 0;
      red.interacciones += interacciones;
      red.publicaciones += 1;
      red.reportadas += esReportada;
      red.conVistas += daVistas;
      red.conInteracciones += daInteracciones;
      red.comentarios += c.comentarios ?? 0;
      red.conComentarios += daComentarios;
      plataformas.set(c.plataforma, red);
    }

    // Cuantas publicaciones traen cifras que dijo el creador en vez de
    // leerse de la plataforma. Van en el mismo total —son vistas reales—
    // pero se dice cuantas son: sin eso el cliente no puede distinguir un
    // dato verificado de una palabra.
    const reportadas = actuales.filter((c) => c.origen === "REPORTADA").length;

    return {
      totales,
      engagement,
      piezasConAlcance,
      evolucion,
      porInfluencer: [...porInfluencer.values()]
        .map((f) => ({ ...f, nombre: f.reportadas > 0 ? `${f.nombre} *` : f.nombre }))
        .sort((a, b) => b.vistas - a.vistas),
      // De mayor a menor aporte: la pregunta que se hace siempre ante
      // esta seccion es quien rindio mas.
      detalle: [...detalle.values()]
        .map((d) => ({
          ...d,
          plataformas: [...d.plataformas.values()].sort((a, b) => b.vistas - a.vistas),
        }))
        .sort((a, b) => b.vistas - a.vistas),
      plataformas: [...plataformas.values()].sort((a, b) => b.vistas - a.vistas),
      publicaciones: actuales.length,
      reportadas,
      // Cuando se midio por ultima vez. Sale de las capturas y no de
      // las piezas: una cifra escrita a mano no es una medicion.
      capturadoEn: capturasDeLaVista.length
        ? capturasDeLaVista.reduce(
            (m, c) => (c.capturadoEn > m ? c.capturadoEn : m),
            ""
          )
        : null,
    };
  }, [capturas, publicaciones, cifrasLocales, vista]);

  /**
   * El estimado de visualizaciones y lo que se lleva conseguido.
   *
   * El 0,25 es el mismo factor que usa el modelo hipotetico al final de
   * la pestana: se saca de aqui para que las dos barras digan lo mismo
   * y no se puedan desincronizar al tocar una.
   */
  const estimado = (() => {
    if (seguidores <= 0) return null;
    const previsto = seguidores * VISUALIZACIONES_POR_SEGUIDOR;
    const vistas = datos.totales.find((t) => t.clave === "vistas");
    // `disponible` en falso no es un cero medido: es que ninguna de las
    // publicaciones de esta campana da numero de vistas.
    const logrado = vistas?.disponible ? vistas.valor : null;
    return {
      previsto,
      logrado,
      escala: Math.max(previsto, logrado ?? 0, 1),
      veces: logrado === null || previsto <= 0 ? null : logrado / previsto,
    };
  })();

  const refrescar = async () => {
    setRefrescando(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/metricas`, {});
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron refrescar");
    } finally {
      setRefrescando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Impacto del contenido
          </CardTitle>
          {datos.capturadoEn && (
            <p className="mt-1 text-xs text-gray-500">
              {datos.publicaciones} publicaciones · última lectura{" "}
              {new Date(datos.capturadoEn).toLocaleString("es-CO", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        {puedeRefrescar && (
          <Button size="sm" variant="outline" onClick={refrescar} disabled={refrescando}>
            {refrescando ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Lo contratado y lo que el creador publico de mas responden a
            preguntas distintas —si la campana cumplio, y cuanto regalo
            el creador— y sumarlos siempre las confunde. El selector solo
            aparece cuando hay algo extra: sin ello, las tres vistas
            dirian lo mismo. */}
        {hayExtra && (
          <div className="inline-flex rounded-lg bg-gray-100 p-[3px] text-xs">
            {VISTAS.map((v) => (
              <button
                key={v.clave}
                type="button"
                onClick={() => setVista(v.clave)}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  vista === v.clave
                    ? "bg-marca text-white"
                    : "text-gray-600 hover:bg-accent/10"
                }`}
                title={v.explica}
              >
                {v.nombre}
              </button>
            ))}
          </div>
        )}

        {datos.publicaciones === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              {vista === "extra"
                ? "No hay contenido extra registrado."
                : "Todavía no hay métricas de los contenidos entregados."}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {vista === "extra"
                ? "Es el que el creador publica por su cuenta, fuera del contrato; se marca al registrarlo."
                : "Se actualizan solas a diario durante el primer mes desde que se publica cada contenido."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {/* El engagement abre la fila y ocupa dos altos: no es una
                  cifra mas, es la que relaciona a las otras dos —cuanta
                  gente lo vio y cuanta reacciono—, y en blanco se
                  distingue de los totales en bruto.

                  Solo en General. En Campaña o Extra compararia las
                  interacciones de un subconjunto con un alcance que no
                  es el suyo. */}
              {vista === "general" && datos.engagement !== null && (
                <div className="col-span-2 flex flex-col items-center justify-center rounded-2xl border-2 border-marca bg-white p-4 lg:col-span-1 lg:row-span-2">
                  <p className="text-5xl font-light tracking-tight text-marca">
                    {porcentajeLegible(datos.engagement)}
                  </p>
                  <p className="mt-2 text-sm text-marca">Engagement Alcance</p>
                  {datos.piezasConAlcance < datos.publicaciones && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      de {datos.piezasConAlcance} de {datos.publicaciones}{" "}
                      publicaciones
                    </p>
                  )}
                </div>
              )}

              {datos.totales
                .filter((t) => t.disponible)
                .map((t) => (
                  <div key={t.clave} className="rounded-lg bg-marca p-3 text-white">
                    {/* El icono va en blanco y no en el color de su serie:
                        sobre el rosa, el violeta o el verde de las
                        graficas quedarian ilegibles. El color de cada
                        serie sigue estando donde hace falta, que es en
                        las graficas. */}
                    <div className="flex items-center gap-1.5 text-xs text-white/80">
                      <t.icono className="h-3.5 w-3.5" />
                      {t.nombre}
                    </div>
                    <p className="mt-1 text-xl font-semibold">
                      {formatNumber(t.valor)}
                    </p>
                    {t.cobertura < datos.publicaciones && (
                      <p className="text-[11px] text-white/70">
                        de {t.cobertura} de {datos.publicaciones} publicaciones
                      </p>
                    )}
                  </div>
                ))}
            </div>

            {/* El progreso contra lo estimado.
                De las cuatro cifras del modelo hipotetico esta es la
                que de verdad se mide en todas las redes, asi que vive
                tambien aqui, pegada a los totales que la componen, y no
                solo al final de la pestana.

                Solo en General: el estimado sale de los seguidores
                contratados, que no se reparten entre lo de campana y lo
                extra. */}
            {vista === "general" && estimado !== null && (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="text-sm font-semibold">Visualizaciones</p>
                    <p className="text-xs text-gray-500">
                      Estimado: el 25% de los {formatNumber(seguidores)}{" "}
                      seguidores sumados de los creadores
                    </p>
                  </div>
                  <span
                    className={`text-2xl font-bold tabular-nums ${
                      estimado.veces === null
                        ? "text-gray-300"
                        : estimado.veces >= 1
                          ? "text-marca"
                          : "text-gray-400"
                    }`}
                  >
                    {estimado.veces === null
                      ? "—"
                      : `${estimado.veces.toLocaleString("es-CO", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}x`}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {/* Lo conseguido arriba y el estimado debajo, como en
                      el modelo hipotetico: lo que se viene a mirar es lo
                      primero que se lee. */}
                  {estimado.logrado === null ? (
                    <div className="flex h-4 items-center text-xs text-gray-400">
                      Todavía no hay visualizaciones medidas
                    </div>
                  ) : (
                    <Barra
                      valor={estimado.logrado}
                      escala={estimado.escala}
                      className="bg-marca"
                    />
                  )}
                  <Barra
                    valor={estimado.previsto}
                    escala={estimado.escala}
                    className="bg-gray-300"
                    tenue
                  />
                </div>
              </div>
            )}

            {datos.reportadas > 0 && (
              <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                <strong>
                  {datos.reportadas === 1
                    ? "1 publicación"
                    : `${datos.reportadas} publicaciones`}
                </strong>{" "}
                {datos.reportadas === 1 ? "aporta" : "aportan"} cifras reportadas
                por el creador, no leídas de la plataforma: son historias o
                directos, cuyas vistas solo ve su autor. Cuentan en los totales,
                pero no están verificadas.
              </p>
            )}

            {datos.totales.some((t) => !t.disponible) && (
              <p className="text-xs text-gray-400">
                {datos.totales
                  .filter((t) => !t.disponible)
                  .map((t) => t.nombre)
                  .join(" y ")}
                : ninguna de las redes de esta campaña publica ese dato.
              </p>
            )}

            {datos.evolucion.length > 1 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Evolución</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={datos.evolucion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompactNumber} />
                    <Tooltip formatter={(v) => formatNumber(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {datos.totales
                      .filter((t) => t.disponible)
                      .map((t) => (
                        <Line
                          key={t.clave}
                          type="monotone"
                          dataKey={t.nombre}
                          stroke={t.color}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Totales de cada red. Van antes del reparto por persona
                porque responden a otra pregunta: no quien rindio mas,
                sino donde rindio la campana. */}
            {datos.plataformas.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Total por plataforma
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {datos.plataformas.map((r) => (
                    <div
                      key={r.plataforma}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">
                          {r.plataforma}
                        </span>
                        <span className="text-xs text-gray-500">
                          {r.publicaciones}{" "}
                          {r.publicaciones === 1 ? "publicación" : "publicaciones"}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4">
                        <span className="flex items-center gap-1 text-sm">
                          <Eye className="h-3.5 w-3.5 text-violet-600" />
                          <span className="font-semibold text-gray-900">
                            <Cifra
                              valor={r.vistas}
                              cuantasLaDan={r.conVistas}
                              titulo="Esta red no publica el número de vistas para este tipo de contenido"
                            />
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-sm">
                          <Heart className="h-3.5 w-3.5 text-pink-600" />
                          <span className="font-semibold text-gray-900">
                            <Cifra
                              valor={r.interacciones}
                              cuantasLaDan={r.conInteracciones}
                              titulo="Ninguna de estas publicaciones expone interacciones"
                            />
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-sm">
                          <MessageCircle className="h-3.5 w-3.5 text-sky-600" />
                          <span className="font-semibold text-gray-900">
                            <Cifra
                              valor={r.comentarios}
                              cuantasLaDan={r.conComentarios}
                              titulo="Esta red no publica el número de comentarios para este contenido"
                            />
                          </span>
                        </span>
                      </div>
                      {r.reportadas > 0 && (
                        <p className="mt-1 text-[11px] text-sky-800">
                          {r.reportadas} con cifras reportadas por el creador
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cada influencer, y de donde sale su aporte. La suma sirve
                para ordenarlos; el desglose, para saber que red le
                funciono, que es lo que decide la proxima campana. */}
            {datos.detalle.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Resultado por influencer
                </p>
                <div className="space-y-2">
                  {datos.detalle.map((persona, i) => (
                    <div
                      key={persona.nombre}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-marca text-[11px] font-semibold text-white">
                            {i + 1}
                          </span>
                          <span className="font-medium text-gray-900">
                            {persona.nombre}
                          </span>
                          <span className="text-xs text-gray-500">
                            {persona.publicaciones}{" "}
                            {persona.publicaciones === 1
                              ? "publicación"
                              : "publicaciones"}
                          </span>
                        </span>
                        <span className="flex gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 text-violet-600" />
                            <span className="font-semibold text-gray-900">
                              <Cifra
                                valor={persona.vistas}
                                cuantasLaDan={persona.conVistas}
                                titulo="Esta red no publica el número de vistas para este tipo de contenido"
                              />
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5 text-pink-600" />
                            <span className="font-semibold text-gray-900">
                              <Cifra
                                valor={persona.interacciones}
                                cuantasLaDan={persona.conInteracciones}
                                titulo="Ninguna de estas publicaciones expone interacciones"
                              />
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5 text-sky-600" />
                            <span className="font-semibold text-gray-900">
                              <Cifra
                                valor={persona.comentarios}
                                cuantasLaDan={persona.conComentarios}
                                titulo="Esta red no publica el número de comentarios para este contenido"
                              />
                            </span>
                          </span>
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 border-t border-dashed border-gray-200 pt-2">
                        {/* El desglose por cuenta se quito: repetia la
                            red y el usuario encima de una tabla que ya
                            trae la red en su propia columna, publicacion
                            a publicacion. Las cifras de cada red siguen
                            en "Total por plataforma", mas arriba. */}

                        {/* Publicacion a publicacion, en tabla.
                            En lista, el enlace quedaba pegado al borde
                            izquierdo y sus cifras al derecho, y relacionar
                            los dos extremos de una fila a otra era el
                            trabajo del que leia. En columnas cada dato
                            cae bajo su titulo y el sombreado alterno
                            mantiene unida la fila. */}
                        {persona.plataformas.flatMap((c) => c.piezas).length > 0 && (
                          <div className="mt-3 overflow-x-auto border-t border-dashed border-gray-200 pt-2">
                            <table className="w-full min-w-[46rem] text-[11px]">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="px-2 py-1 text-left font-medium">Red</th>
                                  <th className="px-2 py-1 text-left font-medium">Formato</th>
                                  <th className="px-2 py-1 text-left font-medium">Publicación</th>
                                  <th className="px-2 py-1 text-right font-medium">Vistas</th>
                                  <th className="px-2 py-1 text-right font-medium">Coment.</th>
                                  <th className="px-2 py-1 text-right font-medium">Me gusta</th>
                                  <th className="px-2 py-1 text-right font-medium">Compart.</th>
                                  <th className="px-2 py-1 text-right font-medium">Repost.</th>
                                  {hayAlcance && (
                                    <th className="px-2 py-1 text-right font-medium">Alcance</th>
                                  )}
                                  {puedeEditarCifras && <th className="w-8 px-2 py-1" />}
                                </tr>
                              </thead>
                              <tbody>
                                {persona.plataformas.flatMap((cuenta) =>
                                  cuenta.piezas.map((pieza) => (
                                    <tr
                                      key={pieza.entregaId}
                                      className="border-t border-gray-100 text-gray-600 odd:bg-marca/5"
                                    >
                                      <td className="px-2 py-1 whitespace-nowrap text-gray-500">
                                        {cuenta.plataforma}
                                      </td>
                                      <td className="px-2 py-1 whitespace-nowrap">
                                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                                          {pieza.formato ?? cuenta.plataforma}
                                        </span>
                                      </td>
                                      <td className="max-w-[16rem] px-2 py-1">
                                        {pieza.url ? (
                                          <a
                                            href={pieza.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block truncate text-violet-700 hover:underline"
                                          >
                                            {pieza.url.replace(/^https?:\/\/(www\.)?/, "")}
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">sin enlace</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1 text-right tabular-nums">
                                        {pieza.vistas !== null ? formatNumber(pieza.vistas) : "—"}
                                      </td>
                                      <td className="px-2 py-1 text-right font-medium tabular-nums text-gray-800">
                                        {pieza.comentarios !== null
                                          ? formatNumber(pieza.comentarios)
                                          : "—"}
                                      </td>
                                      <td
                                        className="px-2 py-1 text-right tabular-nums"
                                        title={
                                          pieza.interacciones != null
                                            ? "Interacciones (respuestas y reacciones)"
                                            : "Me gusta"
                                        }
                                      >
                                        {pieza.interacciones != null
                                          ? formatNumber(pieza.interacciones)
                                          : pieza.meGusta !== null
                                            ? formatNumber(pieza.meGusta)
                                            : "—"}
                                      </td>
                                      <CeldaCifra
                                        valor={pieza.compartidos}
                                        aMano={pieza.aMano.compartidos}
                                      />
                                      <CeldaCifra
                                        valor={pieza.reposteos}
                                        aMano={pieza.aMano.reposteos}
                                        noAplica={!pieza.admiteReposteos}
                                        porQue={`No se cuentan reposteos en ${pieza.plataforma}`}
                                      />
                                      {hayAlcance && (
                                        <CeldaAlcance
                                          pieza={pieza}
                                          editable={puedeEditarCifras}
                                          onEditar={() => setEditando(pieza)}
                                        />
                                      )}
                                      {puedeEditarCifras && (
                                        <td className="px-2 py-1 text-right">
                                          <button
                                            type="button"
                                            onClick={() => setEditando(pieza)}
                                            title={
                                              pieza.esEfimero
                                                ? "Anotar vistas e interacciones"
                                                : "Anotar alcance, compartidos y reposteos"
                                            }
                                            className="rounded p-1 text-gray-400 hover:bg-accent/10 hover:text-gray-700"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {datos.porInfluencer.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Aporte por influencer
                  {datos.porInfluencer.some((f) => f.reportadas > 0) && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      (* incluye cifras reportadas por el creador)
                    </span>
                  )}
                </p>
                <ResponsiveContainer width="100%" height={Math.max(160, datos.porInfluencer.length * 46)}>
                  <BarChart data={datos.porInfluencer} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatCompactNumber} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={140}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v) => formatNumber(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="vistas" name="Vistas" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                    <Bar
                      dataKey="interacciones"
                      name="Interacciones"
                      fill="#ec4899"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ModalCifras
        campaignId={campaignId}
        pieza={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={(entregaId, cifras) =>
          setCifrasLocales((previas) => ({ ...previas, [entregaId]: cifras }))
        }
      />
    </Card>
  );
}

/**
 * Una cifra de la tabla, marcada cuando la escribio una persona.
 *
 * "NA" y la raya dicen cosas distintas: la raya es "no hay dato
 * todavia", NA es "en esta red no se cuenta". Pintar un cero en
 * cualquiera de los dos casos seria afirmar que nadie lo hizo.
 */
function CeldaCifra({
  valor,
  aMano,
  noAplica,
  porQue,
}: {
  valor: number | null;
  aMano: boolean;
  noAplica?: boolean;
  porQue?: string;
}) {
  if (noAplica) {
    return (
      <td className="px-2 py-1 text-right text-gray-300" title={porQue}>
        NA
      </td>
    );
  }
  return (
    <td
      className={`px-2 py-1 text-right tabular-nums ${aMano ? "text-sky-700" : ""}`}
      title={aMano ? "Anotado a mano" : undefined}
    >
      {valor !== null ? formatNumber(valor) : "—"}
    </td>
  );
}

/**
 * La casilla del alcance.
 *
 * Solo Instagram lo mide, y una historia ni eso: lo que su autor ve ahi
 * es un recuento de vistas, que se anota por otro camino. En el resto de
 * las filas se pinta una raya en vez de una casilla vacia, que invitaria
 * a escribir algo que no existe.
 */
function CeldaAlcance({
  pieza,
  editable,
  onEditar,
}: {
  pieza: Pieza;
  editable: boolean;
  onEditar: () => void;
}) {
  if (!pieza.esInstagram || pieza.esEfimero) {
    return (
      <td
        className="px-2 py-1 text-right text-gray-300"
        title={
          pieza.esEfimero
            ? "Una historia no reporta alcance"
            : "El alcance solo existe en Instagram"
        }
      >
        —
      </td>
    );
  }

  if (pieza.alcance === null && !editable) {
    return <td className="px-2 py-1 text-right text-gray-300">—</td>;
  }

  const contenido =
    pieza.alcance !== null ? (
      <span className="font-medium tabular-nums text-sky-700">
        {formatNumber(pieza.alcance)}
      </span>
    ) : (
      <span className="text-gray-400">Anotar</span>
    );

  return (
    <td className="px-2 py-1 text-right">
      {editable ? (
        <button
          type="button"
          onClick={onEditar}
          className="rounded border border-dashed border-gray-300 px-2 py-0.5 hover:border-gray-400 hover:bg-accent/10"
        >
          {contenido}
        </button>
      ) : (
        contenido
      )}
    </td>
  );
}

/**
 * Anotar lo que ningun scraper lee.
 *
 * Las cifras juntas en un modal y no sueltas en la tabla: se consultan
 * de una vez en el panel del creador, y escribirlas de una vez es una
 * sola visita.
 *
 * En una historia o un directo tambien se anotan las vistas y las
 * interacciones. Ahi no hay nada que medir —su autor es el unico que ve
 * esas cifras— y antes solo se podian escribir al registrar la pieza:
 * si al dia siguiente habia mas vistas, el informe al cliente se
 * quedaba con las primeras.
 *
 * Cada cambio anade una captura en vez de corregir la anterior, que es
 * como funciona todo el historico: una historia se ve durante horas, y
 * el dia uno y el dia tres son dos datos, no una rectificacion. Manda
 * la ultima, que es la que se pinta.
 */
function ModalCifras({
  campaignId,
  pieza,
  onCerrar,
  onGuardado,
}: {
  campaignId: string;
  pieza: Pieza | null;
  onCerrar: () => void;
  onGuardado: (entregaId: string, cifras: CifrasAMano) => void;
}) {
  const [alcance, setAlcance] = useState("");
  const [compartidos, setCompartidos] = useState("");
  const [reposteos, setReposteos] = useState("");
  const [vistas, setVistas] = useState("");
  const [interacciones, setInteracciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abiertaPara, setAbiertaPara] = useState<string | null>(null);

  // Al abrir con otra publicacion, las casillas parten de lo que esa
  // publicacion tiene ahora.
  if (pieza && abiertaPara !== pieza.entregaId) {
    setAbiertaPara(pieza.entregaId);
    setAlcance(pieza.alcance !== null ? String(pieza.alcance) : "");
    setCompartidos(pieza.compartidos !== null ? String(pieza.compartidos) : "");
    setReposteos(pieza.reposteos !== null ? String(pieza.reposteos) : "");
    setVistas(pieza.vistas !== null ? String(pieza.vistas) : "");
    setInteracciones(
      pieza.interacciones !== null ? String(pieza.interacciones) : ""
    );
    setError(null);
  }

  const admiteAlcance = !!pieza && pieza.esInstagram && !pieza.esEfimero;
  const admiteReposteos = !!pieza && pieza.admiteReposteos;
  // Vistas e interacciones a mano solo donde no hay scraper que las lea.
  // En una publicacion con enlace las mide Apify, y escribirlas aqui
  // crearia dos verdades para el mismo contenido.
  const admiteCifrasPropias = !!pieza && pieza.esEfimero;

  // Vacio significa "sin dato", que es distinto de cero: borrar la
  // casilla retira la cifra en vez de afirmar que nadie lo compartio.
  const aNumero = (texto: string) => {
    const limpio = texto.trim();
    if (limpio === "") return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? Math.round(n) : NaN;
  };

  const guardar = async () => {
    if (!pieza) return;
    const cuerpo = {
      ...(admiteAlcance ? { alcance: aNumero(alcance) } : {}),
      compartidos: aNumero(compartidos),
      ...(admiteReposteos ? { reposteos: aNumero(reposteos) } : {}),
    };

    // Vistas e interacciones van por otro camino: no corrigen la
    // captura anterior, anaden una. Vacio aqui no retira la cifra, la
    // deja como estaba, porque una historia se mira varios dias y
    // borrarla al anotar solo la otra seria perder lo que ya se sabia.
    const vistasNuevas = admiteCifrasPropias ? aNumero(vistas) : null;
    const interNuevas = admiteCifrasPropias ? aNumero(interacciones) : null;
    const cambioVistas = admiteCifrasPropias && vistasNuevas !== pieza.vistas;
    const cambioInter =
      admiteCifrasPropias && interNuevas !== pieza.interacciones;

    if (
      Object.values(cuerpo).some((v) => Number.isNaN(v)) ||
      Number.isNaN(vistasNuevas) ||
      Number.isNaN(interNuevas)
    ) {
      setError("Escribe números enteros, o deja la casilla vacía.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const guardada = await apiPatch<{
        alcance: number | null;
        compartidosReportados: number | null;
        reposteosReportados: number | null;
      }>(`/api/campaigns/${campaignId}/entregas/${pieza.entregaId}/cifras`, cuerpo);

      let anotadas: Pick<CifrasAMano, "vistas" | "interacciones"> = {};
      if (cambioVistas || cambioInter) {
        const captura = await registrarCifras(campaignId, pieza.entregaId, {
          ...(cambioVistas ? { vistas: vistasNuevas } : {}),
          ...(cambioInter ? { interacciones: interNuevas } : {}),
        });
        // La captura responde con las dos cifras ya fundidas: la que no
        // se tocó viene arrastrada de la anterior.
        anotadas = {
          vistas: captura.vistas,
          interacciones: captura.interacciones,
        };
      }

      onGuardado(pieza.entregaId, {
        alcance: guardada.alcance,
        compartidosReportados: guardada.compartidosReportados,
        reposteosReportados: guardada.reposteosReportados,
        ...anotadas,
      });
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar las cifras");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!pieza} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Cifras de la publicación
          </DialogTitle>
          <DialogDescription>
            {pieza?.formato ?? pieza?.plataforma} de {pieza?.influencer}. Son las
            cifras que la red no publica y solo aparecen en el panel del creador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* En una historia o un directo, estas dos son LAS cifras: no
              hay enlace que medir, solo lo que ve su autor en su panel. */}
          {admiteCifrasPropias && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="vistas">Vistas</Label>
                <Input
                  id="vistas"
                  inputMode="numeric"
                  value={vistas}
                  onChange={(e) => setVistas(e.target.value)}
                  placeholder="Las que muestra el panel del creador"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interacciones">Interacciones</Label>
                <Input
                  id="interacciones"
                  inputMode="numeric"
                  value={interacciones}
                  onChange={(e) => setInteracciones(e.target.value)}
                  placeholder="Respuestas y reacciones, en un solo número"
                />
                <p className="text-xs text-gray-500">
                  Una historia no se desglosa: su autor ve respuestas y
                  reacciones en una sola cifra.
                </p>
              </div>
            </>
          )}
          {admiteAlcance && (
            <div className="space-y-1.5">
              <Label htmlFor="alcance">Alcance</Label>
              <Input
                id="alcance"
                inputMode="numeric"
                value={alcance}
                onChange={(e) => setAlcance(e.target.value)}
                placeholder="Cuántas cuentas distintas lo vieron"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="compartidos">Compartidos</Label>
            <Input
              id="compartidos"
              inputMode="numeric"
              value={compartidos}
              onChange={(e) => setCompartidos(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reposteos">Reposteos</Label>
            <Input
              id="reposteos"
              inputMode="numeric"
              value={admiteReposteos ? reposteos : "NA"}
              onChange={(e) => setReposteos(e.target.value)}
              disabled={!admiteReposteos}
            />
            {!admiteReposteos && (
              <p className="text-xs text-gray-500">
                No se cuentan reposteos en {pieza?.plataforma}.
              </p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Deja vacíos compartidos o reposteos para retirar su cifra. Lo que
            escribas aquí manda sobre lo que mida el refresco automático.
          </p>
          {admiteCifrasPropias && (
            <p className="text-xs text-gray-500">
              Las vistas y las interacciones se guardan como una medición nueva,
              no corrigen la anterior: una historia se ve durante horas y cada
              consulta es un dato más. Manda la última. Si dejas una vacía,
              conserva el valor que ya tenía.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

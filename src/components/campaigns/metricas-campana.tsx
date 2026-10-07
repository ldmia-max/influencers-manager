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
  compartidosReportados: number | null;
  reposteosReportados: number | null;
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
    const ultimaPorEntrega = new Map<string, CapturaMetrica>();
    for (const c of capturas) {
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
        origen: c?.origen ?? "MEDIDA",
        vistas: c?.vistas ?? null,
        meGusta: c?.meGusta ?? null,
        comentarios: c?.comentarios ?? null,
        interacciones: c?.interacciones ?? null,
        guardados: c?.guardados ?? null,
        // Lo escrito a mano manda sobre lo medido: alguien miro el panel
        // del creador —la unica fuente donde Instagram publica estas dos
        // cifras— y corrigio lo que habia.
        compartidos: compartidosAMano ?? c?.compartidos ?? null,
        reposteos: reposteosAMano ?? c?.reposteos ?? null,
        alcance,
        aMano: {
          compartidos: compartidosAMano !== null,
          reposteos: reposteosAMano !== null,
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
        origen: c.origen,
        vistas: c.vistas,
        meGusta: c.meGusta,
        comentarios: c.comentarios,
        interacciones: c.interacciones ?? null,
        guardados: c.guardados,
        compartidos: c.compartidos,
        reposteos: c.reposteos ?? null,
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

    // Evolucion: total de la campana por dia, con la ultima captura de
    // cada entrega hasta ese dia.
    const dias = [...new Set(capturas.map((c) => dia(c.capturadoEn)))].sort();
    const evolucion = dias.map((d) => {
      const hasta = new Map<string, CapturaMetrica>();
      for (const c of capturas) {
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
      const interacciones =
        c.interacciones ??
        (c.meGusta ?? 0) +
          (c.comentarios ?? 0) +
          (c.compartidos ?? 0) +
          (c.reposteos ?? 0);
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
      capturadoEn: capturas.length
        ? capturas.reduce((m, c) => (c.capturadoEn > m ? c.capturadoEn : m), "")
        : null,
    };
  }, [capturas, publicaciones, cifrasLocales]);

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

        {capturas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              Todavía no hay métricas de los contenidos entregados.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Se actualizan solas a diario durante el primer mes desde que se
              publica cada contenido.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {datos.totales
                .filter((t) => t.disponible)
                .map((t) => (
                  <div key={t.clave} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <t.icono className="h-3.5 w-3.5" style={{ color: t.color }} />
                      {t.nombre}
                    </div>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {formatNumber(t.valor)}
                    </p>
                    {t.cobertura < datos.publicaciones && (
                      <p className="text-[11px] text-gray-400">
                        de {t.cobertura} de {datos.publicaciones} publicaciones
                      </p>
                    )}
                  </div>
                ))}
            </div>

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
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
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
                        {persona.plataformas.map((cuenta) => (
                          <div
                            key={cuenta.plataforma}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-gray-600">
                              {cuenta.plataforma}
                              <span className="ml-1 text-gray-400">
                                @{cuenta.username}
                              </span>
                              {cuenta.reportadas > 0 && (
                                <span className="ml-1 text-sky-700">
                                  · {cuenta.reportadas} reportada
                                  {cuenta.reportadas === 1 ? "" : "s"}
                                </span>
                              )}
                            </span>
                            <span className="flex gap-4 text-gray-700">
                              <span>
                                <Cifra
                                  valor={cuenta.vistas}
                                  cuantasLaDan={cuenta.conVistas}
                                  titulo="Esta red no publica el número de vistas para este tipo de contenido"
                                />{" "}
                                vistas
                              </span>
                              <span>
                                <Cifra
                                  valor={cuenta.comentarios}
                                  cuantasLaDan={cuenta.conComentarios}
                                  titulo="Esta red no publica el número de comentarios para este contenido"
                                />{" "}
                                comentarios
                              </span>
                              <span>
                                <Cifra
                                  valor={cuenta.interacciones}
                                  cuantasLaDan={cuenta.conInteracciones}
                                  titulo="Ninguna de estas publicaciones expone interacciones"
                                />{" "}
                                interacciones
                              </span>
                            </span>
                          </div>
                        ))}

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
                                      className="border-t border-gray-100 text-gray-600 odd:bg-gray-50/80"
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
                                            title="Anotar alcance, compartidos y reposteos"
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

/** Una cifra de la tabla, marcada cuando la escribio una persona. */
function CeldaCifra({ valor, aMano }: { valor: number | null; aMano: boolean }) {
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
 * Las tres cifras juntas en un modal y no tres casillas sueltas en la
 * tabla: se consultan de una vez en el panel del creador, y escribirlas
 * de una vez es una sola visita y una sola peticion.
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
    setError(null);
  }

  const admiteAlcance = !!pieza && pieza.esInstagram && !pieza.esEfimero;

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
      reposteos: aNumero(reposteos),
    };
    if (Object.values(cuerpo).some((v) => Number.isNaN(v))) {
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
      onGuardado(pieza.entregaId, {
        alcance: guardada.alcance,
        compartidosReportados: guardada.compartidosReportados,
        reposteosReportados: guardada.reposteosReportados,
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
              value={reposteos}
              onChange={(e) => setReposteos(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500">
            Deja una casilla vacía para retirar su cifra. Lo que escribas aquí
            manda sobre lo que mida el refresco automático.
          </p>
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

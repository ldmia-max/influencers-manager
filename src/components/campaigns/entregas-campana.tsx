"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Plus,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Eye,
  Heart,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { redDeUrl } from "@/lib/social-handles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  estadoDeFormato,
  resumirEntregas,
  ETIQUETA_ENTREGA,
  COLOR_ENTREGA,
  ORIGEN_LEGIBLE,
} from "@/lib/entregas";
import {
  registrarEntrega,
  registrarCifras,
  actualizarEntrega,
  eliminarEntrega,
  fijarFechaLimite,
} from "@/services/entregas";

// -----------------------------------------------------------------------------
// Tipos: la forma que devuelve getEntregasDeCampana, ya serializada.
// -----------------------------------------------------------------------------

export interface EntregaVista {
  id: string;
  /** Vacia en los formatos efímeros: ahí la prueba es la fecha. */
  url: string | null;
  /**
   * Qué se publicó de verdad. En un combo es lo único que lo dice, y de
   * ello depende si la pieza lleva enlace o vistas escritas a mano.
   * Nulo en las entregas registradas antes de que se señalara.
   */
  formato: { nombre: string; esEfimero: boolean } | null;
  /** La red de la publicacion, que sale del formato senalado. */
  red: string;
  platformId: string;
  /** Contenido de mas, fuera de lo contratado. */
  esExtra: boolean;
  entregadoEn: string;
  publicadoEn: string | null;
  notas: string | null;
  registradoPor: { id: string; name: string } | null;
  metricas: {
    capturadoEn: string;
    origen: string;
    vistas: number | null;
    /** Respuestas y reacciones juntas, en las cifras reportadas. */
    interacciones: number | null;
    meGusta: number | null;
    comentarios: number | null;
    compartidos: number | null;
    guardados: number | null;
  }[];
}

export interface FormatoVista {
  id: string;
  quantity: number;
  esCombo: boolean;
  comboDescripcion: string | null;
  fechaLimite: string | null;
  /** Story, directo o mención en directo: no deja enlace que pegar. */
  esEfimero: boolean;
  nombre: string;
  /** Con qué formato abre el selector. Nulo en los combos. */
  formatoContratadoId: string | null;
  entregas: EntregaVista[];
}

export interface FormatoDisponible {
  id: string;
  displayName: string;
  esEfimero: boolean;
}

export interface PlataformaVista {
  id: string;
  platformId: string;
  plataforma: string;
  username: string;
  /** Catálogo de la red: lo que se puede señalar al registrar una pieza. */
  formatosDisponibles: FormatoDisponible[];
  formatos: FormatoVista[];
}

export interface PerfilVista {
  id: string;
  nombre: string;
  participacion: "ACTIVO" | "RETIRADO";
  origenRetiro: string | null;
  motivoRetiro: string | null;
  retiradoEn: string | null;
  /**
   * Todas las redes del creador, no solo las contratadas aqui.
   *
   * Puede publicar una pieza en una cuenta suya que esta campana no
   * compro —y hasta ahora no habia donde registrarla—. La entrega sigue
   * contando contra el formato contratado bajo el que se anota; lo que
   * cambia es de que red se dice que es.
   */
  redesDelPerfil: {
    platformId: string;
    nombre: string;
    formatos: FormatoDisponible[];
  }[];
  plataformas: PlataformaVista[];
}

interface Props {
  campaignId: string;
  perfiles: PerfilVista[];
  /** Solo se registran entregas en campañas ya activas. */
  puedeEditar: boolean;
}

function soloFecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * Un "YYYY-MM-DD" del formulario convertido a instante.
 *
 * A mediodia UTC, no a medianoche. `new Date("2026-10-12")` da las
 * 00:00 UTC, que en Bogota —UTC-5— son las 19:00 del 11: la fecha se
 * guardaba bien y se pintaba un dia antes. Y no es solo cosmetico, que
 * los avisos de vencimiento reducen la fecha al dia de la agencia y
 * reclamaban un dia antes de tiempo.
 *
 * Mediodia deja doce horas de margen a cada lado, asi que ninguna zona
 * horaria del mundo cambia el dia.
 */
function instanteDelDia(dia: string): string {
  return new Date(`${dia}T12:00:00.000Z`).toISOString();
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Aviso cuando el link pegado no es de la red elegida.
 *
 * No impide guardar: hay casos en los que la pieza vive en una red y
 * conviene anotarla bajo otra, y cerrar la puerta impedia registrar
 * contenido real. Pero es casi siempre un descuido —y uno caro: de la
 * red sale como se cuenta la publicacion en Impacto del contenido—,
 * asi que se dice en el momento, no despues.
 */
function avisoDeRed(url: string, nombreDeLaRed: string | undefined) {
  if (!url.trim() || !nombreDeLaRed) return null;
  const deLaUrl = redDeUrl(url);
  if (!deLaUrl || deLaUrl === nombreDeLaRed.toLowerCase()) return null;
  const bonito = deLaUrl.charAt(0).toUpperCase() + deLaUrl.slice(1);
  return `El link es de ${bonito} y la red elegida es ${nombreDeLaRed}.`;
}

/** Clave de ocupacion mientras se guarda el enlace de una entrega. */
const URL_OCUPADO = (id: string) => "url-" + id;

/** Las redes que tiene el creador, contratadas aqui o no. */
function SelectorRed({
  perfil,
  valor,
  onCambio,
}: {
  perfil: PerfilVista;
  valor: string;
  onCambio: (v: string) => void;
}) {
  return (
    <Select value={valor} onValueChange={onCambio}>
      <SelectTrigger className="h-7 w-32 text-xs">
        <SelectValue placeholder="Red" />
      </SelectTrigger>
      <SelectContent>
        {perfil.redesDelPerfil.map((r) => (
          <SelectItem key={r.platformId} value={r.platformId}>
            {r.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Los formatos de la red elegida, no los del tarifario del creador. */
function SelectorFormato({
  formatos,
  valor,
  onCambio,
}: {
  formatos: FormatoDisponible[];
  valor: string;
  onCambio: (v: string) => void;
}) {
  return (
    <Select value={valor} onValueChange={onCambio}>
      <SelectTrigger className="h-7 w-44 text-xs">
        <SelectValue placeholder="¿Qué formato es?" />
      </SelectTrigger>
      <SelectContent>
        {formatos.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.displayName}
            {f.esEfimero ? " · sin enlace" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EntregasCampana({ campaignId, perfiles, puedeEditar }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevoLink, setNuevoLink] = useState<Record<string, string>>({});
  const [fechaEmision, setFechaEmision] = useState<Record<string, string>>({});
  const [vistasNuevas, setVistasNuevas] = useState<Record<string, string>>({});
  const [interNuevas, setInterNuevas] = useState<Record<string, string>>({});
  // Observaciones sobre el contenido: por formato mientras se registra,
  // por entrega cuando ya existe.
  const [notaNueva, setNotaNueva] = useState<Record<string, string>>({});
  /**
   * Que formatos tienen abierta la casilla para registrar otra pieza.
   *
   * Cerrada por defecto en cuanto el formato ya tiene una entrega: una
   * casilla vacia debajo de cada formato entregado llenaba la pagina de
   * sitios donde escribir que nadie habia pedido. Se abre con el mas que
   * hay junto a la papelera, y se cierra sola al guardar.
   */
  const [anadiendo, setAnadiendo] = useState<Record<string, boolean>>({});
  /**
   * Que fila se esta corrigiendo y lo que se escribe en ella.
   *
   * Una sola a la vez: el lapiz abre la fila entera —red, formato,
   * enlace y descripcion— y hasta cerrarla no hay otra. Antes la
   * descripcion tenia su propio editor y la red no se podia tocar, que
   * es como un link de TikTok acabo anotado bajo un Reel de Instagram.
   */
  const [editandoFila, setEditandoFila] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({
    redId: "",
    tipoId: "",
    url: "",
    notas: "",
    esExtra: false,
    /** Solo en los efimeros: la fecha en que se emitio. */
    publicadoEn: "",
    /** Solo en los efimeros: lo que reporto el creador. */
    vistas: "",
    interacciones: "",
  });
  /** La casilla Extra de la proxima pieza de cada formato. */
  const [extraNueva, setExtraNueva] = useState<Record<string, boolean>>({});
  /** Red elegida para la proxima pieza de cada formato contratado. */
  const [redElegida, setRedElegida] = useState<Record<string, string>>({});
  /**
   * Enlaces ya corregidos, dibujados por el propio componente.
   *
   * `router.refresh()` no repinta en la compilacion de produccion, asi
   * que la fila se quedaria con el enlace viejo hasta recargar.
   */
  const [urlsGuardadas, setUrlsGuardadas] = useState<Record<string, string>>({});
  const [formatosGuardados, setFormatosGuardados] = useState<
    Record<string, { nombre: string; esEfimero: boolean }>
  >({});
  const [redesGuardadas, setRedesGuardadas] = useState<Record<string, string>>({});
  const [extrasGuardados, setExtrasGuardados] = useState<Record<string, boolean>>({});
  const [notasGuardadas, setNotasGuardadas] = useState<Record<string, string>>({});
  // Formato señalado para la próxima pieza de cada bloque.
  const [tipoElegido, setTipoElegido] = useState<Record<string, string>>({});

  // El reloj se lee una vez y se pasa a todos los cálculos, para que dos
  // formatos que vencen al mismo tiempo no se pinten distinto por unos
  // milisegundos de diferencia entre llamadas.
  const ahora = new Date();

  /**
   * Lo que se acaba de hacer, encima de lo que dice el servidor.
   *
   * La pantalla NO puede depender de router.refresh() para mostrarlo. Se
   * comprobo en el navegador contra el build de produccion: al registrar
   * un enlace la peticion se guarda (201), el refresco se pide, el
   * servidor devuelve el arbol nuevo con el enlace dentro... y React no
   * lo aplica. La lista y el contador seguian igual hasta recargar con
   * F5. En desarrollo si se aplica, que es por lo que no se habia visto.
   *
   * Asi que lo registrado se pinta desde aqui, al instante y sin esperar
   * al servidor. Es una capa que se disuelve sola: en cuanto el servidor
   * manda la entrega en sus props, la copia local se descarta por id, asi
   * que no puede quedar un duplicado ni una linea fantasma.
   */
  const [anadidas, setAnadidas] = useState<Record<string, EntregaVista[]>>({});
  const [quitadas, setQuitadas] = useState<string[]>([]);
  /** Vistas recien anotadas, mientras el servidor no las devuelva. */
  const [vistasAnotadas, setVistasAnotadas] = useState<Record<string, number>>({});
  const [interAnotadas, setInterAnotadas] = useState<Record<string, number>>({});
  /** Fechas de emision corregidas, por lo mismo. */
  const [fechasGuardadas, setFechasGuardadas] = useState<Record<string, string>>({});

  /** Mete una entrega recien creada en la lista, sin esperar al servidor. */
  const pintarYa = (formatoId: string, entrega: EntregaVista) =>
    setAnadidas((a) => ({ ...a, [formatoId]: [...(a[formatoId] ?? []), entrega] }));

  /** Las entregas de un formato: las del servidor mas lo recien hecho. */
  const entregasDe = (formato: FormatoVista): EntregaVista[] => {
    const idsDelServidor = new Set(formato.entregas.map((e) => e.id));
    return [
      ...formato.entregas,
      ...(anadidas[formato.id] ?? []).filter((e) => !idsDelServidor.has(e.id)),
    ].filter((e) => !quitadas.includes(e.id));
  };

  /** Si una pieza es contenido de mas, contando lo recien editado. */
  const esExtraLa = (e: EntregaVista) => extrasGuardados[e.id] ?? e.esExtra;

  /**
   * Las piezas de un formato que cuentan para cumplirlo.
   *
   * Las extras se ven en la tabla —se publicaron— pero no cumplen nada:
   * son contenido fuera de lo contratado. Contarlas dejaria cerrar la
   * campana con el trabajo encargado sin hacer.
   */
  const entregasQueCuentan = (formato: FormatoVista) =>
    entregasDe(formato).filter((e) => !esExtraLa(e));

  /**
   * A que formato contratado se engancha una pieza nueva.
   *
   * Toda entrega cuelga de un CampaignService: de ahi salen el plazo, el
   * "X de Y" y el gate que impide cerrar la campana. Con una sola tabla
   * por creador ya no lo elige la persona escribiendo bajo un recuadro,
   * asi que hay que deducirlo de la red y el formato que senala.
   *
   * Se prefiere lo mas parecido a lo contratado y que ademas siga
   * faltando, para que el contador siga diciendo algo: si alguien tiene
   * dos Reels contratados y entrega el primero, el segundo va al que
   * queda libre y no al que ya estaba cubierto.
   *
   * Si en esa red no hay nada contratado, la pieza entra igual —se
   * publico y hay que poder registrarla— pero marcada como extra y
   * colgada del primer formato del creador. Asi no infla el "X de Y" de
   * un formato que nadie encargo en esa red.
   */
  const formatoDestino = (
    perfil: PerfilVista,
    redId: string,
    tipoId: string
  ): { formato: FormatoVista; forzarExtra: boolean } | null => {
    const falta = (f: FormatoVista) => {
      const { entregados, esperados } = estadoDeFormato(
        {
          quantity: f.quantity,
          esCombo: f.esCombo,
          fechaLimite: f.fechaLimite,
          entregas: entregasQueCuentan(f).map((e) => ({
            entregadoEn: e.entregadoEn,
          })),
        },
        ahora
      );
      return entregados < esperados;
    };

    const enEsaRed = perfil.plataformas
      .filter((pl) => pl.platformId === redId)
      .flatMap((pl) => pl.formatos);

    const mismoTipo = enEsaRed.filter((f) => f.formatoContratadoId === tipoId);
    const candidato =
      mismoTipo.find(falta) ??
      mismoTipo[0] ??
      // Un combo acepta cualquier cosa: su contenido es texto libre.
      enEsaRed.filter((f) => f.esCombo).find(falta) ??
      enEsaRed.find(falta) ??
      enEsaRed[0];

    if (candidato) return { formato: candidato, forzarExtra: false };

    const cualquiera = perfil.plataformas.flatMap((pl) => pl.formatos)[0];
    return cualquiera ? { formato: cualquiera, forzarExtra: true } : null;
  };

  /**
   * Se sigue pidiendo al servidor: cuando el refresco si llega, trae lo
   * que la copia local no sabe —quien registro la entrega, las metricas
   * medidas— y ademas es lo que deja la pagina correcta al navegar.
   */
  const refrescar = () => router.refresh();

  const conError = async (clave: string, accion: () => Promise<unknown>) => {
    setOcupado(clave);
    setError(null);
    try {
      await accion();
      refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setOcupado(null);
    }
  };

  const todosLosFormatos = perfiles
    .filter((p) => p.participacion === "ACTIVO")
    .flatMap((p) => p.plataformas.flatMap((pl) => pl.formatos))
    .map((f) => ({
      ...f,
      entregas: entregasQueCuentan(f).map((e) => ({
        entregadoEn: e.entregadoEn,
      })),
    }));
  const resumen = resumirEntregas(todosLosFormatos, ahora);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Contenido
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            {resumen.completos} de {resumen.total} formatos
          </Badge>
          {resumen.incumplidos > 0 && (
            <Badge variant="secondary" className={COLOR_ENTREGA.INCUMPLIDO}>
              {resumen.incumplidos} incumplidos
            </Badge>
          )}
          {resumen.conRetraso > 0 && (
            <Badge variant="secondary" className={COLOR_ENTREGA.CON_RETRASO}>
              {resumen.conRetraso} con retraso
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {perfiles.length > 0 && !resumen.todoEntregado && (
          <p className="text-xs text-gray-500">
            La campaña no se puede completar mientras falten links por registrar.
          </p>
        )}

        {/* La pestana se pinta aunque no haya nadie todavia, asi que
            tiene que decir por si sola por que esta vacia. */}
        {perfiles.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              Todavía no hay influencers en esta campaña.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Añádelos desde «Perfiles y formatos» y aquí aparecerá lo que
              tengan que entregar.
            </p>
          </div>
        )}

        {perfiles.length > 0 && !puedeEditar && (
          <p className="text-xs text-gray-500">
            El contenido se registra con la campaña en proceso. Mientras tanto
            esto solo muestra lo contratado.
          </p>
        )}

        {perfiles.map((perfil) => {
          const retirado = perfil.participacion === "RETIRADO";

          // Todas las piezas del creador en una sola lista, vengan del
          // formato contratado que vengan. Cada una lleva el suyo al
          // lado: de ahi salen el nombre de respaldo y la red cuando la
          // entrega no los senala.
          const piezas = perfil.plataformas.flatMap((plataforma) =>
            plataforma.formatos.flatMap((formato) =>
              entregasDe(formato).map((entrega) => ({
                entrega,
                formato,
                plataforma,
              }))
            )
          );

          const formatosDelPerfil = perfil.plataformas.flatMap((pl) =>
            pl.formatos.map((formato) => ({ formato, plataforma: pl }))
          );
          const resumenPerfil = resumirEntregas(
            formatosDelPerfil.map(({ formato }) => ({
              ...formato,
              entregas: entregasQueCuentan(formato).map((e) => ({
                entregadoEn: e.entregadoEn,
              })),
            })),
            ahora
          );

          // El alta es una sola por creador, no una por formato: por eso
          // su estado cuelga del perfil y no del formato contratado.
          const redId =
            redElegida[perfil.id] ??
            perfil.plataformas[0]?.platformId ??
            perfil.redesDelPerfil[0]?.platformId ??
            "";
          const red =
            perfil.redesDelPerfil.find((r) => r.platformId === redId) ?? null;
          const catalogo = red?.formatos ?? [];
          const nombreRed = red?.nombre ?? "";
          const tipoId = tipoElegido[perfil.id] ?? "";
          const tipoNuevo = catalogo.find((f) => f.id === tipoId);
          const nuevaEsEfimera = tipoNuevo?.esEfimero ?? false;
          const mostrarAlta =
            puedeEditar && (piezas.length === 0 || anadiendo[perfil.id]);
          const destino = formatoDestino(perfil, redId, tipoId);

          return (
            <div
              key={perfil.id}
              className={`rounded-xl border p-4 ${
                retirado
                  ? "border-dashed border-gray-300 bg-gray-50"
                  : "border-gray-200"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p
                    className={`font-medium ${
                      retirado ? "text-gray-500 line-through" : "text-gray-900"
                    }`}
                  >
                    {perfil.nombre}
                  </p>
                  {retirado && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Retirado
                      {perfil.retiradoEn && ` el ${fechaCorta(perfil.retiradoEn)}`}
                      {perfil.origenRetiro &&
                        ` · ${ORIGEN_LEGIBLE[perfil.origenRetiro]}`}
                      {perfil.motivoRetiro && ` · ${perfil.motivoRetiro}`}
                    </p>
                  )}
                </div>

                {!retirado && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {resumenPerfil.completos} de {resumenPerfil.total} formatos
                    </Badge>
                    {puedeEditar && !mostrarAlta && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          setAnadiendo((a) => ({ ...a, [perfil.id]: true }))
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Añadir contenido
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {retirado ? (
                <p className="text-xs text-gray-500">
                  Sus importes ya no cuentan en el total de la campaña.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Lo contratado, con su plazo. Ya no es un recuadro por
                      formato con su propia tabla debajo, pero el plazo
                      sigue siendo de cada formato y aqui es donde se fija. */}
                  {formatosDelPerfil.length > 0 && (
                    <div className="rounded-lg bg-marca/5 p-3">
                      <p className="mb-2 text-xs font-medium text-gray-700">
                        Formatos contratados
                      </p>
                      <div className="space-y-1.5">
                        {formatosDelPerfil.map(({ formato }) => {
                          const estado = estadoDeFormato(
                            {
                              quantity: formato.quantity,
                              esCombo: formato.esCombo,
                              fechaLimite: formato.fechaLimite,
                              entregas: entregasQueCuentan(formato).map((e) => ({
                                entregadoEn: e.entregadoEn,
                              })),
                            },
                            ahora
                          );
                          return (
                            <div
                              key={formato.id}
                              className="flex flex-wrap items-center justify-between gap-2"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-gray-800">
                                  {formato.nombre}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className={COLOR_ENTREGA[estado.estado]}
                                >
                                  {ETIQUETA_ENTREGA[estado.estado]}
                                </Badge>
                                {formato.esEfimero && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-sky-100 text-sky-800"
                                  >
                                    Sin enlace
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                  {estado.entregados} de {estado.esperados}
                                </span>
                                {formato.esCombo && formato.comboDescripcion && (
                                  <span className="text-xs italic text-gray-500">
                                    Incluye: {formato.comboDescripcion}
                                  </span>
                                )}
                              </div>

                              {puedeEditar && (
                                <div className="flex items-center gap-1">
                                  <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
                                  <Label
                                    htmlFor={`fecha-${formato.id}`}
                                    className="text-xs font-normal text-gray-500"
                                  >
                                    Fecha límite
                                  </Label>
                                  <Input
                                    id={`fecha-${formato.id}`}
                                    type="date"
                                    defaultValue={soloFecha(formato.fechaLimite)}
                                    className="h-7 w-36 text-xs"
                                    onChange={(e) =>
                                      conError(`fecha-${formato.id}`, () =>
                                        fijarFechaLimite(campaignId, formato.id, {
                                          fechaLimite: e.target.value
                                            ? instanteDelDia(e.target.value)
                                            : null,
                                        })
                                      )
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* El contenido, todo en una tabla. Cada pieza se
                      describe sola —su red y su formato van en la fila—,
                      asi que repartirlas en un recuadro por formato
                      contratado solo obligaba a adivinar bajo cual
                      escribir. */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[52rem] text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="px-2 py-1 font-medium">Red</th>
                          <th className="px-2 py-1 font-medium">Formato</th>
                          <th className="px-2 py-1 font-medium">Publicación</th>
                          <th className="px-2 py-1 text-center font-medium">Extra</th>
                          <th className="px-2 py-1 font-medium">Descripción</th>
                          {puedeEditar && (
                            <th className="w-24 px-2 py-1 text-right font-medium">
                              Acciones
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {piezas.length === 0 && !mostrarAlta && (
                          <tr>
                            <td
                              colSpan={puedeEditar ? 6 : 5}
                              className="px-2 py-3 text-center text-gray-400"
                            >
                              Todavía no hay contenido registrado.
                            </td>
                          </tr>
                        )}

                        {piezas.map(({ entrega, formato, plataforma }) => {
                          // Lo efímero se decide por PIEZA, no por el
                          // formato contratado: un combo puede llevar un
                          // Reel con enlace y una Story sin él.
                          const nombreFormato =
                            formatosGuardados[entrega.id]?.nombre ??
                            entrega.formato?.nombre ??
                            formato.nombre;
                          const piezaEfimera =
                            formatosGuardados[entrega.id]?.esEfimero ??
                            entrega.formato?.esEfimero ??
                            formato.esEfimero;
                          const enlace = urlsGuardadas[entrega.id] ?? entrega.url;
                          const nota =
                            notasGuardadas[entrega.id] ?? entrega.notas ?? "";

                          if (editandoFila === entrega.id) {
                            const catalogoFila =
                              perfil.redesDelPerfil.find(
                                (r) => r.platformId === borrador.redId
                              )?.formatos ?? plataforma.formatosDisponibles;
                            const tipoFila = catalogoFila.find(
                              (f) => f.id === borrador.tipoId
                            );
                            return (
                              <tr
                                key={entrega.id}
                                className="border-t border-gray-200/70 bg-white/70"
                              >
                                <td className="px-2 py-1">
                                  <SelectorRed
                                    perfil={perfil}
                                    valor={borrador.redId}
                                    onCambio={(v) =>
                                      setBorrador((b) => ({
                                        ...b,
                                        redId: v,
                                        tipoId: "",
                                      }))
                                    }
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <SelectorFormato
                                    formatos={catalogoFila}
                                    valor={borrador.tipoId}
                                    onCambio={(v) =>
                                      setBorrador((b) => ({ ...b, tipoId: v }))
                                    }
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  {tipoFila?.esEfimero ? (
                                    // Un efimero no deja enlace: lo que se
                                    // edita es su fecha y las cifras que
                                    // reporto el creador, que es todo lo que
                                    // hay de el.
                                    <div className="flex flex-wrap items-center gap-1">
                                      <Input
                                        type="date"
                                        value={borrador.publicadoEn}
                                        onChange={(e) =>
                                          setBorrador((b) => ({
                                            ...b,
                                            publicadoEn: e.target.value,
                                          }))
                                        }
                                        className="h-7 w-36 text-xs"
                                      />
                                      <Input
                                        type="number"
                                        min={0}
                                        placeholder="Vistas"
                                        value={borrador.vistas}
                                        onChange={(e) =>
                                          setBorrador((b) => ({
                                            ...b,
                                            vistas: e.target.value,
                                          }))
                                        }
                                        className="h-7 w-24 text-xs"
                                      />
                                      <Input
                                        type="number"
                                        min={0}
                                        placeholder="Interacc."
                                        value={borrador.interacciones}
                                        onChange={(e) =>
                                          setBorrador((b) => ({
                                            ...b,
                                            interacciones: e.target.value,
                                          }))
                                        }
                                        className="h-7 w-28 text-xs"
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <Input
                                        autoFocus
                                        placeholder="https://… link de la publicación"
                                        value={borrador.url}
                                        onChange={(e) =>
                                          setBorrador((b) => ({
                                            ...b,
                                            url: e.target.value,
                                          }))
                                        }
                                        className="h-7 min-w-56 text-xs"
                                      />
                                      {(() => {
                                        const aviso = avisoDeRed(
                                          borrador.url,
                                          perfil.redesDelPerfil.find(
                                            (r) => r.platformId === borrador.redId
                                          )?.nombre
                                        );
                                        return aviso ? (
                                          <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
                                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                            {aviso}
                                          </p>
                                        ) : null;
                                      })()}
                                    </>
                                  )}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Checkbox
                                    checked={borrador.esExtra}
                                    onCheckedChange={(v) =>
                                      setBorrador((b) => ({
                                        ...b,
                                        esExtra: v === true,
                                      }))
                                    }
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <Input
                                    placeholder="Descripción u observaciones"
                                    value={borrador.notas}
                                    onChange={(e) =>
                                      setBorrador((b) => ({
                                        ...b,
                                        notas: e.target.value,
                                      }))
                                    }
                                    maxLength={500}
                                    className="h-7 min-w-40 text-xs"
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      title="Guardar"
                                      className="text-violet-700 hover:text-violet-900 disabled:opacity-40"
                                      disabled={
                                        ocupado === URL_OCUPADO(entrega.id) ||
                                        !borrador.tipoId ||
                                        (!tipoFila?.esEfimero && !borrador.url.trim())
                                      }
                                      onClick={() =>
                                        conError(URL_OCUPADO(entrega.id), async () => {
                                          const esEfimera = !!tipoFila?.esEfimero;
                                          const guardada = await actualizarEntrega(
                                            campaignId,
                                            entrega.id,
                                            {
                                              ...(esEfimera
                                                ? {
                                                    publicadoEn: borrador.publicadoEn
                                                      ? instanteDelDia(
                                                          borrador.publicadoEn
                                                        )
                                                      : null,
                                                  }
                                                : { url: borrador.url.trim() }),
                                              notas: borrador.notas.trim() || null,
                                              serviceTypeId: borrador.tipoId,
                                              esExtra: borrador.esExtra,
                                            }
                                          );

                                          // Las cifras van por su propia ruta:
                                          // no corrigen la captura anterior,
                                          // anaden una. Solo si cambiaron,
                                          // para no sembrar capturas iguales
                                          // cada vez que se abre el lapiz.
                                          const antesV =
                                            vistasAnotadas[entrega.id] ??
                                            entrega.metricas[0]?.vistas ??
                                            null;
                                          const antesI =
                                            interAnotadas[entrega.id] ??
                                            entrega.metricas[0]?.interacciones ??
                                            null;
                                          const aNum = (t: string) =>
                                            t.trim() === "" ? null : Number(t);
                                          const v = aNum(borrador.vistas);
                                          const i = aNum(borrador.interacciones);

                                          if (esEfimera && (v !== antesV || i !== antesI)) {
                                            await registrarCifras(
                                              campaignId,
                                              entrega.id,
                                              {
                                                ...(v !== antesV ? { vistas: v } : {}),
                                                ...(i !== antesI
                                                  ? { interacciones: i }
                                                  : {}),
                                              }
                                            );
                                            if (v !== null)
                                              setVistasAnotadas((a) => ({
                                                ...a,
                                                [entrega.id]: v,
                                              }));
                                            if (i !== null)
                                              setInterAnotadas((a) => ({
                                                ...a,
                                                [entrega.id]: i,
                                              }));
                                          }
                                          if (esEfimera) {
                                            // El mismo instante que se
                                            // mando, no la fecha cruda:
                                            // fechaCorta leeria un
                                            // "2026-10-12" suelto como
                                            // medianoche UTC y lo pintaria
                                            // un dia antes.
                                            setFechasGuardadas((f) => ({
                                              ...f,
                                              [entrega.id]: borrador.publicadoEn
                                                ? instanteDelDia(borrador.publicadoEn)
                                                : "",
                                            }));
                                          }
                                          setUrlsGuardadas((u) => ({
                                            ...u,
                                            [entrega.id]: guardada.url,
                                          }));
                                          setExtrasGuardados((x) => ({
                                            ...x,
                                            [entrega.id]: borrador.esExtra,
                                          }));
                                          setRedesGuardadas((r) => ({
                                            ...r,
                                            [entrega.id]:
                                              perfil.redesDelPerfil.find(
                                                (x) => x.platformId === borrador.redId
                                              )?.nombre ?? entrega.red,
                                          }));
                                          setNotasGuardadas((n) => ({
                                            ...n,
                                            [entrega.id]: borrador.notas.trim(),
                                          }));
                                          setFormatosGuardados((f) => ({
                                            ...f,
                                            [entrega.id]: {
                                              nombre: tipoFila!.displayName,
                                              esEfimero: tipoFila!.esEfimero,
                                            },
                                          }));
                                          setEditandoFila(null);
                                        })
                                      }
                                    >
                                      {ocupado === URL_OCUPADO(entrega.id) ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      title="Cancelar"
                                      className="text-gray-400 hover:text-gray-700"
                                      onClick={() => setEditandoFila(null)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr
                              key={entrega.id}
                              className="border-t border-gray-200/70 text-gray-600 odd:bg-white/50"
                            >
                              <td className="px-2 py-1 whitespace-nowrap text-gray-500">
                                {redesGuardadas[entrega.id] ?? entrega.red}
                              </td>
                              <td className="px-2 py-1 whitespace-nowrap">
                                <span className="rounded bg-white px-1.5 py-0.5 font-medium text-gray-600 ring-1 ring-gray-200">
                                  {nombreFormato}
                                </span>
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {enlace ? (
                                    <a
                                      href={enlace}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex min-w-0 max-w-[18rem] items-center gap-1 truncate text-violet-700 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{enlace}</span>
                                    </a>
                                  ) : (
                                    // Sin enlace, lo que respalda la entrega
                                    // es quien la confirmó.
                                    <span className="flex items-center gap-1 text-gray-700">
                                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                                      Emitido
                                      {(fechasGuardadas[entrega.id] ||
                                        entrega.publicadoEn)
                                        ? ` el ${fechaCorta(
                                            fechasGuardadas[entrega.id] ||
                                              entrega.publicadoEn!
                                          )}`
                                        : ""}
                                      {entrega.registradoPor
                                        ? ` · confirmado por ${entrega.registradoPor.name}`
                                        : ""}
                                    </span>
                                  )}

                                  {/* Vistas que reportó el creador. Solo en
                                      los efímeros: en el resto las lee Apify
                                      y escribirlas a mano crearía dos
                                      verdades. */}
                                  {piezaEfimera && (
                                    <span className="flex items-center gap-1 text-gray-500">
                                      <Eye className="h-3 w-3 text-gray-400" />
                                      {(vistasAnotadas[entrega.id] ??
                                        entrega.metricas[0]?.vistas) != null ? (
                                        <span className="text-gray-700">
                                          {formatNumber(
                                            vistasAnotadas[entrega.id] ??
                                              entrega.metricas[0]!.vistas!
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">sin vistas</span>
                                      )}
                                      <Heart className="ml-1 h-3 w-3 text-gray-400" />
                                      {(interAnotadas[entrega.id] ??
                                        entrega.metricas[0]?.interacciones) != null ? (
                                        <span className="text-gray-700">
                                          {formatNumber(
                                            interAnotadas[entrega.id] ??
                                              entrega.metricas[0]!.interacciones!
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">
                                          sin interacciones
                                        </span>
                                      )}
                                    </span>
                                  )}

                                </div>
                              </td>
                              <td className="px-2 py-1 text-center">
                                <Checkbox
                                  checked={extrasGuardados[entrega.id] ?? entrega.esExtra}
                                  disabled
                                  aria-label="Entrega extra"
                                />
                              </td>
                              <td className="max-w-[16rem] px-2 py-1">
                                {nota ? (
                                  <span className="line-clamp-2 text-gray-600">
                                    {nota}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Sin descripción</span>
                                )}
                              </td>
                              {puedeEditar && (
                                <td className="px-2 py-1">
                                  <div className="flex items-center justify-end gap-1">
                                    {/* El lápiz edita la fila entera: red,
                                        formato, enlace y descripción. */}
                                    <button
                                      type="button"
                                      title="Editar la entrega"
                                      className="text-gray-400 hover:text-violet-700"
                                      onClick={() => {
                                        const platformId = entrega.platformId;
                                        const cat =
                                          perfil.redesDelPerfil.find(
                                            (r) => r.platformId === platformId
                                          )?.formatos ?? plataforma.formatosDisponibles;
                                        const vistasAhora =
                                          vistasAnotadas[entrega.id] ??
                                          entrega.metricas[0]?.vistas ??
                                          null;
                                        const interAhora =
                                          interAnotadas[entrega.id] ??
                                          entrega.metricas[0]?.interacciones ??
                                          null;
                                        setBorrador({
                                          redId: platformId,
                                          tipoId:
                                            cat.find(
                                              (f) => f.displayName === nombreFormato
                                            )?.id ??
                                            formato.formatoContratadoId ??
                                            "",
                                          url: enlace ?? "",
                                          notas: nota,
                                          esExtra:
                                            extrasGuardados[entrega.id] ??
                                            entrega.esExtra,
                                          publicadoEn: soloFecha(
                                            fechasGuardadas[entrega.id] ||
                                              entrega.publicadoEn
                                          ),
                                          vistas:
                                            vistasAhora !== null
                                              ? String(vistasAhora)
                                              : "",
                                          interacciones:
                                            interAhora !== null
                                              ? String(interAhora)
                                              : "",
                                        });
                                        setEditandoFila(entrega.id);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Eliminar la entrega"
                                      className="text-gray-400 hover:text-red-600"
                                      disabled={ocupado === entrega.id}
                                      onClick={() =>
                                        conError(entrega.id, async () => {
                                          await eliminarEntrega(campaignId, entrega.id);
                                          setQuitadas((q) => [...q, entrega.id]);
                                        })
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {mostrarAlta && (
                          <tr className="border-t border-gray-200/70 bg-white/70">
                            <td className="px-2 py-1">
                              <SelectorRed
                                perfil={perfil}
                                valor={redId}
                                onCambio={(v) => {
                                  setRedElegida((r) => ({ ...r, [perfil.id]: v }));
                                  // Los formatos son de la red: el que
                                  // estuviera elegido ya no vale.
                                  setTipoElegido((t) => ({ ...t, [perfil.id]: "" }));
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <SelectorFormato
                                formatos={catalogo}
                                valor={tipoId}
                                onCambio={(v) =>
                                  setTipoElegido((t) => ({ ...t, [perfil.id]: v }))
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              {!tipoNuevo ? (
                                <span className="text-[11px] text-gray-500">
                                  Elige la red y el formato para registrar el
                                  contenido.
                                </span>
                              ) : nuevaEsEfimera ? (
                                // Stories y directos no dejan enlace: la
                                // entrega la sostienen la fecha de emisión y
                                // quien la confirma.
                                <div className="flex flex-wrap items-center gap-1">
                                  <Input
                                    type="date"
                                    value={fechaEmision[perfil.id] ?? ""}
                                    onChange={(e) =>
                                      setFechaEmision((v) => ({
                                        ...v,
                                        [perfil.id]: e.target.value,
                                      }))
                                    }
                                    className="h-7 w-36 text-xs"
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder="Vistas"
                                    value={vistasNuevas[perfil.id] ?? ""}
                                    onChange={(e) =>
                                      setVistasNuevas((v) => ({
                                        ...v,
                                        [perfil.id]: e.target.value,
                                      }))
                                    }
                                    className="h-7 w-24 text-xs"
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder="Interacc."
                                    value={interNuevas[perfil.id] ?? ""}
                                    onChange={(e) =>
                                      setInterNuevas((v) => ({
                                        ...v,
                                        [perfil.id]: e.target.value,
                                      }))
                                    }
                                    className="h-7 w-28 text-xs"
                                  />
                                </div>
                              ) : (
                                <>
                                  <Input
                                    placeholder="https://… link de la publicación"
                                    value={nuevoLink[perfil.id] ?? ""}
                                    onChange={(e) =>
                                      setNuevoLink((v) => ({
                                        ...v,
                                        [perfil.id]: e.target.value,
                                      }))
                                    }
                                    className="h-7 min-w-56 text-xs"
                                  />
                                  {(() => {
                                    const aviso = avisoDeRed(
                                      nuevoLink[perfil.id] ?? "",
                                      nombreRed
                                    );
                                    return aviso ? (
                                      <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
                                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                        {aviso}
                                      </p>
                                    ) : null;
                                  })()}
                                </>
                              )}
                            </td>
                            <td className="px-2 py-1 text-center">
                              <Checkbox
                                checked={
                                  destino?.forzarExtra || (extraNueva[perfil.id] ?? false)
                                }
                                disabled={destino?.forzarExtra}
                                onCheckedChange={(v) =>
                                  setExtraNueva((x) => ({
                                    ...x,
                                    [perfil.id]: v === true,
                                  }))
                                }
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                placeholder="Descripción u observaciones (opcional)"
                                value={notaNueva[perfil.id] ?? ""}
                                onChange={(e) =>
                                  setNotaNueva((v) => ({
                                    ...v,
                                    [perfil.id]: e.target.value,
                                  }))
                                }
                                maxLength={500}
                                className="h-7 min-w-40 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 shrink-0 text-xs"
                                  disabled={
                                    ocupado === perfil.id ||
                                    !tipoNuevo ||
                                    !destino ||
                                    (nuevaEsEfimera
                                      ? !(fechaEmision[perfil.id] ?? "")
                                      : !(nuevoLink[perfil.id] ?? "").trim())
                                  }
                                  onClick={() =>
                                    conError(perfil.id, async () => {
                                      if (!destino) return;
                                      const nota =
                                        (notaNueva[perfil.id] ?? "").trim() || null;
                                      const vistas = (
                                        vistasNuevas[perfil.id] ?? ""
                                      ).trim();
                                      const inter = (
                                        interNuevas[perfil.id] ?? ""
                                      ).trim();
                                      const publicadoEn = nuevaEsEfimera
                                        ? instanteDelDia(fechaEmision[perfil.id])
                                        : null;
                                      const esExtra =
                                        destino.forzarExtra ||
                                        (extraNueva[perfil.id] ?? false);
                                      const creada = await registrarEntrega(
                                        campaignId,
                                        {
                                          // El formato contratado al que se
                                          // engancha lo decide formatoDestino,
                                          // a partir de la red y el formato
                                          // señalados.
                                          campaignServiceId: destino.formato.id,
                                          serviceTypeId: tipoId,
                                          esExtra,
                                          ...(nuevaEsEfimera
                                            ? {
                                                publicadoEn,
                                                vistasReportadas: vistas
                                                  ? Number(vistas)
                                                  : null,
                                                interaccionesReportadas: inter
                                                  ? Number(inter)
                                                  : null,
                                              }
                                            : { url: nuevoLink[perfil.id] }),
                                          notas: nota,
                                        }
                                      );
                                      // Limpiar el formulario pase lo que
                                      // pase con el repintado.
                                      for (const limpiar of [
                                        setNuevoLink,
                                        setFechaEmision,
                                        setVistasNuevas,
                                        setInterNuevas,
                                        setNotaNueva,
                                      ]) {
                                        limpiar((v) => ({ ...v, [perfil.id]: "" }));
                                      }
                                      setAnadiendo((a) => ({
                                        ...a,
                                        [perfil.id]: false,
                                      }));
                                      setExtraNueva((v) => ({
                                        ...v,
                                        [perfil.id]: false,
                                      }));
                                      setTipoElegido((t) => ({
                                        ...t,
                                        [perfil.id]: "",
                                      }));
                                      pintarYa(destino.formato.id, {
                                        id: creada.id,
                                        url: creada.url,
                                        formato: {
                                          nombre: tipoNuevo!.displayName,
                                          esEfimero: nuevaEsEfimera,
                                        },
                                        red: nombreRed,
                                        platformId: redId,
                                        esExtra,
                                        entregadoEn: creada.entregadoEn,
                                        publicadoEn,
                                        notas: nota,
                                        registradoPor: null,
                                        metricas:
                                          nuevaEsEfimera && (vistas || inter)
                                            ? [
                                                {
                                                  capturadoEn: creada.entregadoEn,
                                                  origen: "REPORTADA",
                                                  vistas: vistas
                                                    ? Number(vistas)
                                                    : null,
                                                  interacciones: inter
                                                    ? Number(inter)
                                                    : null,
                                                  meGusta: null,
                                                  comentarios: null,
                                                  compartidos: null,
                                                  guardados: null,
                                                },
                                              ]
                                            : [],
                                      });
                                    })
                                  }
                                >
                                  {ocupado === perfil.id ? (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Save className="mr-1 h-3.5 w-3.5" />
                                  )}
                                  Guardar
                                </Button>
                                {piezas.length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 shrink-0 text-xs text-gray-500"
                                    disabled={ocupado === perfil.id}
                                    onClick={() =>
                                      setAnadiendo((a) => ({
                                        ...a,
                                        [perfil.id]: false,
                                      }))
                                    }
                                  >
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {mostrarAlta && nuevaEsEfimera && (
                    <p className="text-[11px] text-gray-500">
                      Este formato no deja enlace: confirma la fecha en que se
                      emitió y, si el creador te las pasa, sus vistas. Puedes
                      anotarlas o corregirlas después.
                    </p>
                  )}

                  {mostrarAlta && destino?.forzarExtra && (
                    <p className="flex items-start gap-1 text-[11px] text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      En {nombreRed} no hay nada contratado para {perfil.nombre}, así
                      que esta pieza se guarda como contenido extra y no cuenta para
                      cerrar la campaña.
                    </p>
                  )}

                  {mostrarAlta && formatosDelPerfil.length === 0 && (
                    <p className="flex items-start gap-1 text-[11px] text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {perfil.nombre} no tiene formatos contratados en esta campaña,
                      así que no hay dónde registrar su contenido.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

      </CardContent>

    </Card>
  );
}

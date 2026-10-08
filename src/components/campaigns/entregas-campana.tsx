"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
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

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Clave de ocupacion mientras se guarda el enlace de una entrega. */
const URL_OCUPADO = (id: string) => "url-" + id;

/**
 * A que formato contratado cuenta una entrega de la red elegida.
 *
 * Se prefiere el contratado que coincide con lo publicado; si no hay
 * ninguno —una Story dentro de un combo— el combo; y en ultimo caso el
 * primero contratado en esa red. Null cuando esa red no tiene nada
 * contratado, y entonces no se puede registrar nada en ella: no seria
 * trabajo encargado a nadie.
 */
function servicioDestino(
  perfil: PerfilVista,
  redId: string,
  tipoId: string
): FormatoVista | null {
  const red = perfil.plataformas.find((p) => p.id === redId);
  if (!red) return null;
  return (
    red.formatos.find((f) => f.formatoContratadoId === tipoId) ??
    red.formatos.find((f) => f.esCombo) ??
    red.formatos[0] ??
    null
  );
}

/** Las redes donde este influencer tiene algo contratado en la campana. */
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
        {perfil.plataformas.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.plataforma}
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
  });
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
  const [notasGuardadas, setNotasGuardadas] = useState<Record<string, string>>({});
  // Formato señalado para la próxima pieza de cada bloque.
  const [tipoElegido, setTipoElegido] = useState<Record<string, string>>({});
  const [vistasEntrega, setVistasEntrega] = useState<Record<string, string>>({});
  const [interEntrega, setInterEntrega] = useState<Record<string, string>>({});

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
      entregas: entregasDe(f).map((e) => ({ entregadoEn: e.entregadoEn })),
    }));
  const resumen = resumirEntregas(todosLosFormatos, ahora);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Entregas de contenido
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

        {!resumen.todoEntregado && (
          <p className="text-xs text-gray-500">
            La campaña no se puede completar mientras falten links por registrar.
          </p>
        )}

        {perfiles.map((perfil) => {
          const retirado = perfil.participacion === "RETIRADO";
          return (
            <div
              key={perfil.id}
              className={`rounded-xl border p-4 ${
                retirado ? "border-dashed border-gray-300 bg-gray-50" : "border-gray-200"
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
                      {perfil.origenRetiro && ` · ${ORIGEN_LEGIBLE[perfil.origenRetiro]}`}
                      {perfil.motivoRetiro && ` · ${perfil.motivoRetiro}`}
                    </p>
                  )}
                </div>

                {/* Retirar y devolver viven en Perfiles y formatos: son
                    decisiones sobre a quien se tiene contratado, no sobre
                    el contenido ya publicado, que es de lo que trata
                    esta seccion. */}
              </div>

              {retirado ? (
                <p className="text-xs text-gray-500">
                  Sus importes ya no cuentan en el total de la campaña.
                </p>
              ) : (
                <div className="space-y-3">
                  {perfil.plataformas.map((plataforma) =>
                    plataforma.formatos.map((formato) => {
                      const estado = estadoDeFormato(
                        {
                          quantity: formato.quantity,
                          esCombo: formato.esCombo,
                          fechaLimite: formato.fechaLimite,
                          entregas: entregasDe(formato).map((e) => ({
                            entregadoEn: e.entregadoEn,
                          })),
                        },
                        ahora
                      );

                      // Red y formato de la proxima pieza. Abren con lo
                      // contratado, que es lo normal; cambiar la red
                      // recarga los formatos de esa otra y manda la
                      // entrega a lo que alli este contratado.
                      const redId = redElegida[formato.id] ?? plataforma.id;
                      const red =
                        perfil.plataformas.find((p) => p.id === redId) ?? plataforma;
                      const tipoId =
                        tipoElegido[formato.id] ??
                        (redId === plataforma.id ? formato.formatoContratadoId : null) ??
                        "";
                      const tipoNuevo = red.formatosDisponibles.find(
                        (f) => f.id === tipoId
                      );
                      // De lo señalado depende qué se pide: un enlace, o
                      // la fecha de emisión y las vistas.
                      const nuevaEsEfimera = tipoNuevo?.esEfimero ?? false;
                      const destino = servicioDestino(perfil, redId, tipoId);
                      const mostrarAlta =
                        puedeEditar &&
                        (entregasDe(formato).length === 0 || anadiendo[formato.id]);

                      return (
                        <div
                          key={formato.id}
                          className="rounded-lg bg-marca/5 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">
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
                            </div>

                            {puedeEditar && (
                              // El campo iba suelto, sin decir que fecha
                              // era: al lado del formulario de registro se
                              // confundia con la fecha de la entrega que se
                              // esta anotando, cuando es el plazo pactado.
                              <div className="flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
                                <Label
                                  htmlFor={`fecha-${formato.id}`}
                                  className="text-xs font-normal text-gray-500"
                                >
                                  Fecha límite de entrega de contenido
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
                                          ? new Date(e.target.value).toISOString()
                                          : null,
                                      })
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>

                          {formato.esCombo && formato.comboDescripcion && (
                            <p className="mt-1 text-xs italic text-gray-500">
                              Incluye: {formato.comboDescripcion}
                            </p>
                          )}

                          {/* El contenido entregado, en tabla.
                              Cada dato bajo su titulo, y la red a la vista:
                              era lo unico que no se decia, y por eso un link
                              de TikTok pegado aqui pasaba por contenido de
                              Instagram hasta que Impacto del contenido lo
                              contaba mal. */}
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full min-w-[52rem] text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="px-2 py-1 font-medium">Red</th>
                                  <th className="px-2 py-1 font-medium">Formato</th>
                                  <th className="px-2 py-1 font-medium">Publicación</th>
                                  <th className="px-2 py-1 font-medium">Descripción</th>
                                  {puedeEditar && (
                                    <th className="w-24 px-2 py-1 text-right font-medium">
                                      Acciones
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {entregasDe(formato).map((entrega) => {
                                  // Lo efímero se decide por PIEZA, no por el
                                  // formato contratado: un combo puede llevar
                                  // un Reel con enlace y una Story sin él.
                                  const nombreFormato =
                                    formatosGuardados[entrega.id]?.nombre ??
                                    entrega.formato?.nombre ??
                                    formato.nombre;
                                  const piezaEfimera =
                                    formatosGuardados[entrega.id]?.esEfimero ??
                                    entrega.formato?.esEfimero ??
                                    formato.esEfimero;
                                  const enlace =
                                    urlsGuardadas[entrega.id] ?? entrega.url;
                                  const nota =
                                    notasGuardadas[entrega.id] ?? entrega.notas ?? "";

                                  if (editandoFila === entrega.id) {
                                    const redFila =
                                      perfil.plataformas.find(
                                        (p) => p.id === borrador.redId
                                      ) ?? plataforma;
                                    const tipoFila = redFila.formatosDisponibles.find(
                                      (f) => f.id === borrador.tipoId
                                    );
                                    const destinoFila = servicioDestino(
                                      perfil,
                                      borrador.redId,
                                      borrador.tipoId
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
                                            formatos={redFila.formatosDisponibles}
                                            valor={borrador.tipoId}
                                            onCambio={(v) =>
                                              setBorrador((b) => ({ ...b, tipoId: v }))
                                            }
                                          />
                                        </td>
                                        <td className="px-2 py-1">
                                          {tipoFila?.esEfimero ? (
                                            <span className="text-[11px] text-gray-500">
                                              Sin enlace: la sostienen su fecha de
                                              emisión y quien la confirmó.
                                            </span>
                                          ) : (
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
                                          )}
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
                                                !destinoFila ||
                                                !borrador.tipoId ||
                                                (!tipoFila?.esEfimero &&
                                                  !borrador.url.trim())
                                              }
                                              onClick={() =>
                                                conError(
                                                  URL_OCUPADO(entrega.id),
                                                  async () => {
                                                    const cambiaDeFormato =
                                                      destinoFila!.id !== formato.id;
                                                    const guardada =
                                                      await actualizarEntrega(
                                                        campaignId,
                                                        entrega.id,
                                                        {
                                                          ...(tipoFila?.esEfimero
                                                            ? {}
                                                            : {
                                                                url: borrador.url.trim(),
                                                              }),
                                                          notas:
                                                            borrador.notas.trim() || null,
                                                          serviceTypeId: borrador.tipoId,
                                                          campaignServiceId:
                                                            destinoFila!.id,
                                                        }
                                                      );
                                                    // Si cambia de formato
                                                    // contratado, la fila se
                                                    // va a otro recuadro y los
                                                    // contadores cambian:
                                                    // adivinarlo aqui seria
                                                    // adivinar mal.
                                                    if (cambiaDeFormato) {
                                                      window.location.reload();
                                                      return;
                                                    }
                                                    setUrlsGuardadas((u) => ({
                                                      ...u,
                                                      [entrega.id]: guardada.url,
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
                                                  }
                                                )
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
                                        {plataforma.plataforma}
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
                                            // Sin enlace, lo que respalda la
                                            // entrega es quien la confirmó.
                                            <span className="flex items-center gap-1 text-gray-700">
                                              <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                                              Emitido
                                              {entrega.publicadoEn
                                                ? ` el ${fechaCorta(entrega.publicadoEn)}`
                                                : ""}
                                              {entrega.registradoPor
                                                ? ` · confirmado por ${entrega.registradoPor.name}`
                                                : ""}
                                            </span>
                                          )}

                                          {/* Vistas que reportó el creador.
                                              Solo en los efímeros: en el resto
                                              las lee Apify y escribirlas a mano
                                              crearía dos verdades. */}
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
                                                <span className="text-gray-400">
                                                  sin vistas
                                                </span>
                                              )}
                                              <Heart className="ml-1 h-3 w-3 text-gray-400" />
                                              {(interAnotadas[entrega.id] ??
                                                entrega.metricas[0]?.interacciones) !=
                                              null ? (
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

                                          {piezaEfimera && puedeEditar && (
                                            <span className="flex items-center gap-1">
                                              <Input
                                                type="number"
                                                min={0}
                                                placeholder="vistas"
                                                value={vistasEntrega[entrega.id] ?? ""}
                                                onChange={(e) =>
                                                  setVistasEntrega((v) => ({
                                                    ...v,
                                                    [entrega.id]: e.target.value,
                                                  }))
                                                }
                                                className="h-6 w-20 text-xs"
                                              />
                                              <Input
                                                type="number"
                                                min={0}
                                                placeholder="interacc."
                                                value={interEntrega[entrega.id] ?? ""}
                                                onChange={(e) =>
                                                  setInterEntrega((v) => ({
                                                    ...v,
                                                    [entrega.id]: e.target.value,
                                                  }))
                                                }
                                                className="h-6 w-24 text-xs"
                                              />
                                              <button
                                                type="button"
                                                className="text-violet-700 hover:underline disabled:opacity-40"
                                                disabled={
                                                  ocupado === `cifras-${entrega.id}` ||
                                                  (!(
                                                    vistasEntrega[entrega.id] ?? ""
                                                  ).trim() &&
                                                    !(
                                                      interEntrega[entrega.id] ?? ""
                                                    ).trim())
                                                }
                                                onClick={() =>
                                                  conError(
                                                    `cifras-${entrega.id}`,
                                                    async () => {
                                                      const v = (
                                                        vistasEntrega[entrega.id] ?? ""
                                                      ).trim();
                                                      const i = (
                                                        interEntrega[entrega.id] ?? ""
                                                      ).trim();
                                                      await registrarCifras(
                                                        campaignId,
                                                        entrega.id,
                                                        {
                                                          vistas: v ? Number(v) : null,
                                                          interacciones: i
                                                            ? Number(i)
                                                            : null,
                                                        }
                                                      );
                                                      // Solo se pinta lo que se
                                                      // acaba de anotar: lo otro
                                                      // conserva su valor.
                                                      if (v)
                                                        setVistasAnotadas((a) => ({
                                                          ...a,
                                                          [entrega.id]: Number(v),
                                                        }));
                                                      if (i)
                                                        setInterAnotadas((a) => ({
                                                          ...a,
                                                          [entrega.id]: Number(i),
                                                        }));
                                                      setVistasEntrega((x) => ({
                                                        ...x,
                                                        [entrega.id]: "",
                                                      }));
                                                      setInterEntrega((x) => ({
                                                        ...x,
                                                        [entrega.id]: "",
                                                      }));
                                                    }
                                                  )
                                                }
                                              >
                                                Guardar
                                              </button>
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="max-w-[16rem] px-2 py-1">
                                        {nota ? (
                                          <span className="line-clamp-2 text-gray-600">
                                            {nota}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">
                                            Sin descripción
                                          </span>
                                        )}
                                      </td>
                                      {puedeEditar && (
                                        <td className="px-2 py-1">
                                          <div className="flex items-center justify-end gap-1">
                                            {/* El lápiz edita la fila entera:
                                                red, formato, enlace y
                                                descripción. Antes la
                                                descripción tenía su propio
                                                editor y la red no se podía
                                                tocar en absoluto. */}
                                            <button
                                              type="button"
                                              title="Editar la entrega"
                                              className="text-gray-400 hover:text-violet-700"
                                              onClick={() => {
                                                setBorrador({
                                                  redId: plataforma.id,
                                                  tipoId:
                                                    plataforma.formatosDisponibles.find(
                                                      (f) => f.displayName === nombreFormato
                                                    )?.id ??
                                                    formato.formatoContratadoId ??
                                                    "",
                                                  url: enlace ?? "",
                                                  notas: nota,
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
                                                  await eliminarEntrega(
                                                    campaignId,
                                                    entrega.id
                                                  );
                                                  setQuitadas((q) => [...q, entrega.id]);
                                                })
                                              }
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                            {!anadiendo[formato.id] && (
                                              <button
                                                type="button"
                                                title="Añadir otra entrega a este formato"
                                                className="text-gray-400 hover:text-violet-700"
                                                onClick={() =>
                                                  setAnadiendo((a) => ({
                                                    ...a,
                                                    [formato.id]: true,
                                                  }))
                                                }
                                              >
                                                <Plus className="h-3.5 w-3.5" />
                                              </button>
                                            )}
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
                                          setRedElegida((r) => ({
                                            ...r,
                                            [formato.id]: v,
                                          }));
                                          // Los formatos son de la red: el
                                          // que estuviera elegido ya no vale.
                                          setTipoElegido((t) => ({
                                            ...t,
                                            [formato.id]: "",
                                          }));
                                        }}
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <SelectorFormato
                                        formatos={red.formatosDisponibles}
                                        valor={tipoId}
                                        onCambio={(v) =>
                                          setTipoElegido((t) => ({
                                            ...t,
                                            [formato.id]: v,
                                          }))
                                        }
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      {!tipoNuevo ? (
                                        <span className="text-[11px] text-gray-500">
                                          Elige el formato para registrar la entrega.
                                        </span>
                                      ) : nuevaEsEfimera ? (
                                        // Stories y directos no dejan enlace:
                                        // la entrega la sostienen la fecha de
                                        // emisión y quien la confirma.
                                        <div className="flex flex-wrap items-center gap-1">
                                          <Input
                                            type="date"
                                            value={fechaEmision[formato.id] ?? ""}
                                            onChange={(e) =>
                                              setFechaEmision((v) => ({
                                                ...v,
                                                [formato.id]: e.target.value,
                                              }))
                                            }
                                            className="h-7 w-36 text-xs"
                                          />
                                          <Input
                                            type="number"
                                            min={0}
                                            placeholder="Vistas"
                                            value={vistasNuevas[formato.id] ?? ""}
                                            onChange={(e) =>
                                              setVistasNuevas((v) => ({
                                                ...v,
                                                [formato.id]: e.target.value,
                                              }))
                                            }
                                            className="h-7 w-24 text-xs"
                                          />
                                          <Input
                                            type="number"
                                            min={0}
                                            placeholder="Interacc."
                                            value={interNuevas[formato.id] ?? ""}
                                            onChange={(e) =>
                                              setInterNuevas((v) => ({
                                                ...v,
                                                [formato.id]: e.target.value,
                                              }))
                                            }
                                            className="h-7 w-28 text-xs"
                                          />
                                        </div>
                                      ) : (
                                        <Input
                                          placeholder="https://… link de la publicación"
                                          value={nuevoLink[formato.id] ?? ""}
                                          onChange={(e) =>
                                            setNuevoLink((v) => ({
                                              ...v,
                                              [formato.id]: e.target.value,
                                            }))
                                          }
                                          className="h-7 min-w-56 text-xs"
                                        />
                                      )}
                                    </td>
                                    <td className="px-2 py-1">
                                      <Input
                                        placeholder="Descripción u observaciones (opcional)"
                                        value={notaNueva[formato.id] ?? ""}
                                        onChange={(e) =>
                                          setNotaNueva((v) => ({
                                            ...v,
                                            [formato.id]: e.target.value,
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
                                            ocupado === formato.id ||
                                            !destino ||
                                            !tipoNuevo ||
                                            (nuevaEsEfimera
                                              ? !(fechaEmision[formato.id] ?? "")
                                              : !(nuevoLink[formato.id] ?? "").trim())
                                          }
                                          onClick={() =>
                                            conError(formato.id, async () => {
                                              const nota =
                                                (notaNueva[formato.id] ?? "").trim() ||
                                                null;
                                              const vistas = (
                                                vistasNuevas[formato.id] ?? ""
                                              ).trim();
                                              const inter = (
                                                interNuevas[formato.id] ?? ""
                                              ).trim();
                                              const publicadoEn = nuevaEsEfimera
                                                ? new Date(
                                                    fechaEmision[formato.id]
                                                  ).toISOString()
                                                : null;
                                              const creada = await registrarEntrega(
                                                campaignId,
                                                {
                                                  campaignServiceId: destino!.id,
                                                  serviceTypeId: tipoId,
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
                                                    : { url: nuevoLink[formato.id] }),
                                                  notas: nota,
                                                }
                                              );
                                              // Limpiar el formulario pase lo
                                              // que pase con el repintado.
                                              for (const limpiar of [
                                                setNuevoLink,
                                                setFechaEmision,
                                                setVistasNuevas,
                                                setInterNuevas,
                                                setNotaNueva,
                                              ]) {
                                                limpiar((v) => ({
                                                  ...v,
                                                  [formato.id]: "",
                                                }));
                                              }
                                              setAnadiendo((a) => ({
                                                ...a,
                                                [formato.id]: false,
                                              }));
                                              // En otra red la fila nace en
                                              // otro recuadro y cambia sus
                                              // contadores: se recarga.
                                              if (destino!.id !== formato.id) {
                                                window.location.reload();
                                                return;
                                              }
                                              pintarYa(formato.id, {
                                                id: creada.id,
                                                url: creada.url,
                                                formato: {
                                                  nombre: tipoNuevo!.displayName,
                                                  esEfimero: nuevaEsEfimera,
                                                },
                                                entregadoEn: creada.entregadoEn,
                                                publicadoEn,
                                                notas: nota,
                                                registradoPor: null,
                                                metricas:
                                                  nuevaEsEfimera && (vistas || inter)
                                                    ? [
                                                        {
                                                          capturadoEn:
                                                            creada.entregadoEn,
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
                                          {ocupado === formato.id ? (
                                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Save className="mr-1 h-3.5 w-3.5" />
                                          )}
                                          Guardar
                                        </Button>
                                        {entregasDe(formato).length > 0 && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 shrink-0 text-xs text-gray-500"
                                            disabled={ocupado === formato.id}
                                            onClick={() =>
                                              setAnadiendo((a) => ({
                                                ...a,
                                                [formato.id]: false,
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
                            <p className="mt-1 text-[11px] text-gray-500">
                              Este formato no deja enlace: confirma la fecha en que
                              se emitió y, si el creador te las pasa, sus vistas.
                              Puedes anotarlas o corregirlas después.
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {perfiles.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">
            Esta campaña todavía no tiene influencers.
          </p>
        )}
      </CardContent>

    </Card>
  );
}

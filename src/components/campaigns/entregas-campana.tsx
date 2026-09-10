"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Eye,
  Heart,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/lib/entregas";
import {
  registrarEntrega,
  registrarCifras,
  eliminarEntrega,
  fijarFechaLimite,
  cambiarParticipacion,
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

const ORIGEN_LEGIBLE: Record<string, string> = {
  INFLUENCER: "Decisión del influencer",
  CLIENTE: "Petición del cliente",
  AGENCIA: "Decisión interna",
};

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

export function EntregasCampana({ campaignId, perfiles, puedeEditar }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevoLink, setNuevoLink] = useState<Record<string, string>>({});
  const [fechaEmision, setFechaEmision] = useState<Record<string, string>>({});
  const [vistasNuevas, setVistasNuevas] = useState<Record<string, string>>({});
  const [interNuevas, setInterNuevas] = useState<Record<string, string>>({});
  // Formato señalado para la próxima pieza de cada bloque.
  const [tipoElegido, setTipoElegido] = useState<Record<string, string>>({});
  const [vistasEntrega, setVistasEntrega] = useState<Record<string, string>>({});
  const [interEntrega, setInterEntrega] = useState<Record<string, string>>({});
  const [retirando, setRetirando] = useState<PerfilVista | null>(null);
  const [origen, setOrigen] = useState<string>("");
  const [motivo, setMotivo] = useState("");

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

                {puedeEditar &&
                  (retirado ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ocupado === perfil.id}
                      onClick={() =>
                        conError(perfil.id, () =>
                          cambiarParticipacion(campaignId, perfil.id, {
                            accion: "reactivar",
                          })
                        )
                      }
                    >
                      {ocupado === perfil.id ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="mr-2 h-3.5 w-3.5" />
                      )}
                      Devolver a la campaña
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-500 hover:text-red-600"
                      onClick={() => {
                        setRetirando(perfil);
                        setOrigen("");
                        setMotivo("");
                      }}
                    >
                      <UserMinus className="mr-2 h-3.5 w-3.5" />
                      Retirar
                    </Button>
                  ))}
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

                      // Formato señalado para la próxima pieza. En un
                      // formato simple abre con el contratado; en un combo
                      // no hay ninguno que suponer y hay que elegirlo.
                      const tipoId =
                        tipoElegido[formato.id] ??
                        formato.formatoContratadoId ??
                        "";
                      const tipoNuevo = plataforma.formatosDisponibles.find(
                        (f) => f.id === tipoId
                      );
                      // De lo señalado depende qué se pide: un enlace, o
                      // la fecha de emisión y las vistas.
                      const nuevaEsEfimera = tipoNuevo?.esEfimero ?? false;

                      return (
                        <div
                          key={formato.id}
                          className="rounded-lg bg-gray-50 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">
                                {formato.nombre}
                              </span>
                              <span className="text-xs text-gray-500">
                                @{plataforma.username} · {plataforma.plataforma}
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
                                  Fecha de entrega de contenido
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

                          {entregasDe(formato).length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {entregasDe(formato).map((entrega) => {
                                // Lo efímero se decide por PIEZA, no por el
                                // formato contratado: un combo puede llevar
                                // un Reel con enlace y una Story sin él.
                                const piezaEfimera =
                                  entrega.formato?.esEfimero ?? formato.esEfimero;

                                return (
                                <li
                                  key={entrega.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  {entrega.formato && (
                                    <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-medium text-gray-600 ring-1 ring-gray-200">
                                      {entrega.formato.nombre}
                                    </span>
                                  )}
                                  {entrega.url ? (
                                    <a
                                      href={entrega.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex min-w-0 flex-1 items-center gap-1 truncate text-violet-700 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{entrega.url}</span>
                                    </a>
                                  ) : (
                                    // Sin enlace, lo que respalda la entrega es
                                    // quien la confirmó: se dice su nombre.
                                    <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-gray-700">
                                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                                      <span className="truncate">
                                        Emitido
                                        {entrega.publicadoEn
                                          ? ` el ${fechaCorta(entrega.publicadoEn)}`
                                          : ""}
                                        {entrega.registradoPor
                                          ? ` · confirmado por ${entrega.registradoPor.name}`
                                          : ""}
                                      </span>
                                    </span>
                                  )}
                                  {/* Vistas que reportó el creador. Solo en los
                                      efímeros: en el resto las lee Apify y
                                      escribirlas a mano crearía dos verdades
                                      para el mismo contenido. */}
                                  {piezaEfimera && (
                                    <span className="flex shrink-0 items-center gap-1">
                                      <Eye className="h-3 w-3 text-gray-400" />
                                      {(vistasAnotadas[entrega.id] ??
                                        entrega.metricas[0]?.vistas) != null ? (
                                        <span className="font-medium text-gray-700">
                                          {formatNumber(
                                            vistasAnotadas[entrega.id] ??
                                              entrega.metricas[0]!.vistas!
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">sin vistas</span>
                                      )}
                                    </span>
                                  )}

                                  {/* Interacciones: respuestas y reacciones
                                      juntas, tal y como las ve el creador
                                      en su panel. */}
                                  {piezaEfimera && (
                                    <span className="flex shrink-0 items-center gap-1">
                                      <Heart className="h-3 w-3 text-gray-400" />
                                      {(interAnotadas[entrega.id] ??
                                        entrega.metricas[0]?.interacciones) != null ? (
                                        <span className="font-medium text-gray-700">
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
                                    <span className="flex shrink-0 items-center gap-1">
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
                                          (!(vistasEntrega[entrega.id] ?? "").trim() &&
                                            !(interEntrega[entrega.id] ?? "").trim())
                                        }
                                        onClick={() =>
                                          conError(`cifras-${entrega.id}`, async () => {
                                            const v = (
                                              vistasEntrega[entrega.id] ?? ""
                                            ).trim();
                                            const i = (
                                              interEntrega[entrega.id] ?? ""
                                            ).trim();
                                            await registrarCifras(campaignId, entrega.id, {
                                              vistas: v ? Number(v) : null,
                                              interacciones: i ? Number(i) : null,
                                            });
                                            // Solo se pinta lo que se acaba
                                            // de anotar: lo otro conserva su
                                            // valor, no se pone a cero.
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
                                          })
                                        }
                                      >
                                        Guardar
                                      </button>
                                    </span>
                                  )}
                                  <span className="shrink-0 text-gray-400">
                                    {fechaCorta(entrega.entregadoEn)}
                                  </span>
                                  {puedeEditar && (
                                    <button
                                      type="button"
                                      className="shrink-0 text-gray-400 hover:text-red-600"
                                      disabled={ocupado === entrega.id}
                                      onClick={() =>
                                        conError(entrega.id, async () => {
                                          await eliminarEntrega(
                                            campaignId,
                                            entrega.id
                                          );
                                          // Desaparece de la lista ya, sin
                                          // esperar al servidor.
                                          setQuitadas((q) => [...q, entrega.id]);
                                        })
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </li>
                                );
                              })}
                            </ul>
                          )}

                          {puedeEditar && (
                            // Un solo formulario para todo: se señala qué
                            // formato es la pieza y el campo se adapta.
                            // Antes había dos caminos y el que le tocaba a
                            // un combo solo sabía pedir enlaces, así que su
                            // Story no había forma de registrarla.
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={tipoId}
                                  onValueChange={(v) =>
                                    setTipoElegido((t) => ({ ...t, [formato.id]: v }))
                                  }
                                >
                                  <SelectTrigger className="h-8 w-56 text-xs">
                                    <SelectValue placeholder="¿Qué formato es?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {plataforma.formatosDisponibles.map((f) => (
                                      <SelectItem key={f.id} value={f.id}>
                                        {f.displayName}
                                        {f.esEfimero ? " · sin enlace" : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {!tipoNuevo ? (
                                  <span className="text-[11px] text-gray-500">
                                    Elige el formato para registrar la entrega.
                                  </span>
                                ) : nuevaEsEfimera ? (
                                  // Stories y directos no dejan enlace: la
                                  // entrega la sostienen la fecha de emisión
                                  // y quien la confirma. Las vistas solo las
                                  // ve el creador, así que se escriben.
                                  <>
                                    <Input
                                      type="date"
                                      value={fechaEmision[formato.id] ?? ""}
                                      onChange={(e) =>
                                        setFechaEmision((v) => ({
                                          ...v,
                                          [formato.id]: e.target.value,
                                        }))
                                      }
                                      className="h-8 w-40 text-xs"
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Vistas (opcional)"
                                      value={vistasNuevas[formato.id] ?? ""}
                                      onChange={(e) =>
                                        setVistasNuevas((v) => ({
                                          ...v,
                                          [formato.id]: e.target.value,
                                        }))
                                      }
                                      className="h-8 w-36 text-xs"
                                    />
                                    {/* Un solo numero: en una story el
                                        creador ve un total de respuestas y
                                        reacciones, sin desglosar. */}
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Interacciones (opcional)"
                                      value={interNuevas[formato.id] ?? ""}
                                      onChange={(e) =>
                                        setInterNuevas((v) => ({
                                          ...v,
                                          [formato.id]: e.target.value,
                                        }))
                                      }
                                      className="h-8 w-44 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 shrink-0"
                                      disabled={
                                        ocupado === formato.id ||
                                        !(fechaEmision[formato.id] ?? "")
                                      }
                                      onClick={() =>
                                        conError(formato.id, async () => {
                                          const vistas = (
                                            vistasNuevas[formato.id] ?? ""
                                          ).trim();
                                          const inter = (
                                            interNuevas[formato.id] ?? ""
                                          ).trim();
                                          const publicadoEn = new Date(
                                            fechaEmision[formato.id]
                                          ).toISOString();
                                          const creada = await registrarEntrega(
                                            campaignId,
                                            {
                                              campaignServiceId: formato.id,
                                              serviceTypeId: tipoId,
                                              publicadoEn,
                                              vistasReportadas: vistas
                                                ? Number(vistas)
                                                : null,
                                              interaccionesReportadas: inter
                                                ? Number(inter)
                                                : null,
                                            }
                                          );
                                          pintarYa(formato.id, {
                                            id: creada.id,
                                            url: null,
                                            formato: {
                                              nombre: tipoNuevo.displayName,
                                              esEfimero: true,
                                            },
                                            entregadoEn: creada.entregadoEn,
                                            publicadoEn,
                                            notas: null,
                                            registradoPor: null,
                                            metricas: vistas || inter
                                              ? [
                                                  {
                                                    capturadoEn: creada.entregadoEn,
                                                    origen: "REPORTADA",
                                                    vistas: vistas ? Number(vistas) : null,
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
                                          setFechaEmision((v) => ({
                                            ...v,
                                            [formato.id]: "",
                                          }));
                                          setVistasNuevas((v) => ({
                                            ...v,
                                            [formato.id]: "",
                                          }));
                                          setInterNuevas((v) => ({
                                            ...v,
                                            [formato.id]: "",
                                          }));
                                        })
                                      }
                                    >
                                      {ocupado === formato.id ? (
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                      )}
                                      Confirmar emisión
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Input
                                      placeholder="https://… link de la publicación"
                                      value={nuevoLink[formato.id] ?? ""}
                                      onChange={(e) =>
                                        setNuevoLink((v) => ({
                                          ...v,
                                          [formato.id]: e.target.value,
                                        }))
                                      }
                                      className="h-8 min-w-56 flex-1 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 shrink-0"
                                      disabled={
                                        ocupado === formato.id ||
                                        !(nuevoLink[formato.id] ?? "").trim()
                                      }
                                      onClick={() =>
                                        conError(formato.id, async () => {
                                          const creada = await registrarEntrega(
                                            campaignId,
                                            {
                                              campaignServiceId: formato.id,
                                              serviceTypeId: tipoId,
                                              url: nuevoLink[formato.id],
                                            }
                                          );
                                          pintarYa(formato.id, {
                                            id: creada.id,
                                            url: creada.url,
                                            formato: {
                                              nombre: tipoNuevo.displayName,
                                              esEfimero: false,
                                            },
                                            entregadoEn: creada.entregadoEn,
                                            publicadoEn: null,
                                            notas: null,
                                            registradoPor: null,
                                            metricas: [],
                                          });
                                          setNuevoLink((v) => ({
                                            ...v,
                                            [formato.id]: "",
                                          }));
                                        })
                                      }
                                    >
                                      {ocupado === formato.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Plus className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </>
                                )}
                              </div>

                              {nuevaEsEfimera && (
                                <p className="text-[11px] text-gray-500">
                                  «{tipoNuevo?.displayName}» no deja enlace:
                                  confirma la fecha en que se emitió y, si el
                                  creador te las pasa, sus vistas. Puedes
                                  anotarlas o corregirlas después.
                                </p>
                              )}
                            </div>
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

      {/* Retiro */}
      <Dialog open={!!retirando} onOpenChange={(v) => !v && setRetirando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar a {retirando?.nombre}</DialogTitle>
            <DialogDescription>
              Sus importes dejarán de contar en el total, liberando ese
              presupuesto. El registro no se borra y el cliente no ve el motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>¿Quién lo decidió?</Label>
              <Select value={origen} onValueChange={setOrigen}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGEN_LEGIBLE).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo (interno, opcional)</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: no llegó a acuerdo de fechas"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRetirando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!origen || ocupado === retirando?.id}
              onClick={() => {
                const perfil = retirando;
                if (!perfil) return;
                conError(perfil.id, async () => {
                  await cambiarParticipacion(campaignId, perfil.id, {
                    accion: "retirar",
                    origen: origen as "INFLUENCER" | "CLIENTE" | "AGENCIA",
                    motivo: motivo || null,
                  });
                  setRetirando(null);
                });
              }}
            >
              {ocupado === retirando?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Retirar de la campaña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

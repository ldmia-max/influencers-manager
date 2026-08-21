"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  eliminarEntrega,
  fijarFechaLimite,
  cambiarParticipacion,
} from "@/services/entregas";

// -----------------------------------------------------------------------------
// Tipos: la forma que devuelve getEntregasDeCampana, ya serializada.
// -----------------------------------------------------------------------------

export interface EntregaVista {
  id: string;
  url: string;
  entregadoEn: string;
  publicadoEn: string | null;
  notas: string | null;
  registradoPor: { id: string; name: string } | null;
  metricas: {
    capturadoEn: string;
    vistas: number | null;
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
  nombre: string;
  entregas: EntregaVista[];
}

export interface PlataformaVista {
  id: string;
  plataforma: string;
  username: string;
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
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nuevoLink, setNuevoLink] = useState<Record<string, string>>({});
  const [retirando, setRetirando] = useState<PerfilVista | null>(null);
  const [origen, setOrigen] = useState<string>("");
  const [motivo, setMotivo] = useState("");

  // El reloj se lee una vez y se pasa a todos los cálculos, para que dos
  // formatos que vencen al mismo tiempo no se pinten distinto por unos
  // milisegundos de diferencia entre llamadas.
  const ahora = new Date();

  const refrescar = () => startTransition(() => router.refresh());

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
    .map((f) => ({ ...f, entregas: f.entregas.map((e) => ({ entregadoEn: e.entregadoEn })) }));
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
                          entregas: formato.entregas.map((e) => ({
                            entregadoEn: e.entregadoEn,
                          })),
                        },
                        ahora
                      );

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
                              <span className="text-xs text-gray-500">
                                {estado.entregados} de {estado.esperados}
                              </span>
                            </div>

                            {puedeEditar && (
                              <div className="flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
                                <Input
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

                          {formato.entregas.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {formato.entregas.map((entrega) => (
                                <li
                                  key={entrega.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <a
                                    href={entrega.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex min-w-0 flex-1 items-center gap-1 truncate text-violet-700 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{entrega.url}</span>
                                  </a>
                                  <span className="shrink-0 text-gray-400">
                                    {fechaCorta(entrega.entregadoEn)}
                                  </span>
                                  {puedeEditar && (
                                    <button
                                      type="button"
                                      className="shrink-0 text-gray-400 hover:text-red-600"
                                      disabled={ocupado === entrega.id}
                                      onClick={() =>
                                        conError(entrega.id, () =>
                                          eliminarEntrega(campaignId, entrega.id)
                                        )
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {puedeEditar && (
                            <div className="mt-2 flex gap-2">
                              <Input
                                placeholder="https://… link de la publicación"
                                value={nuevoLink[formato.id] ?? ""}
                                onChange={(e) =>
                                  setNuevoLink((v) => ({
                                    ...v,
                                    [formato.id]: e.target.value,
                                  }))
                                }
                                className="h-8 text-xs"
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
                                    await registrarEntrega(campaignId, {
                                      campaignServiceId: formato.id,
                                      url: nuevoLink[formato.id],
                                    });
                                    setNuevoLink((v) => ({ ...v, [formato.id]: "" }));
                                  })
                                }
                              >
                                {ocupado === formato.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5" />
                                )}
                              </Button>
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

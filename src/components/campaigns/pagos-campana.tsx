"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { ETIQUETA_PAGO, COLOR_PAGO, type EstadoPago } from "@/lib/pagos";
import { apiPatch } from "@/services/api";

export interface PagoVista {
  campaignProfileId: string;
  influencer: string;
  nombreCompleto: string | null;
  documentoIdentidad: string | null;
  campanaId: string;
  campana: string;
  clienteId: string;
  cliente: string;
  base: number;
  estado: EstadoPago;
  cuentaCobroUrl: string | null;
  cuentaCobroNombre: string | null;
  certificadoUrl: string | null;
  certificadoNombre: string | null;
  fechaCuentaCobro: string | null;
  documento: string | null;
  observaciones: string | null;
  mes: string | null;
  vence: string | null;
  diasRestantes: number | null;
  vencido: boolean;
}

/** El plazo, dicho como se lee: lo que falta, no lo transcurrido. */
export function Vencimiento({ pago }: { pago: PagoVista }) {
  if (pago.diasRestantes === null) {
    return <span className="text-gray-400">sin cuenta de cobro</span>;
  }
  if (pago.vencido) {
    return (
      <span className="flex items-center gap-1 font-medium text-red-600">
        <AlertTriangle className="h-3 w-3" />
        vencido hace {Math.abs(pago.diasRestantes)} d
        {Math.abs(pago.diasRestantes) === 1 ? "ía" : "ías"}
      </span>
    );
  }
  return (
    <span className={pago.diasRestantes <= 7 ? "font-medium text-amber-700" : ""}>
      {pago.diasRestantes} día{pago.diasRestantes === 1 ? "" : "s"}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoPago }) {
  return (
    <Badge variant="secondary" className={COLOR_PAGO[estado]}>
      {ETIQUETA_PAGO[estado]}
    </Badge>
  );
}

/** Un adjunto: el enlace si ya está, o el botón para subirlo. */
export function Adjunto({
  url,
  nombre,
  etiqueta,
  puedeSubir,
  onSubido,
}: {
  url: string | null;
  nombre: string | null;
  etiqueta: string;
  puedeSubir?: boolean;
  /**
   * Opcional a proposito: la pagina de contabilidad es de servidor y no
   * puede pasar funciones a un componente cliente. Alli solo se mira.
   */
  onSubido?: (doc: { url: string; nombre: string }) => Promise<void>;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subir = async (archivo: File) => {
    setSubiendo(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch("/api/pagos/upload", { method: "POST", body: form });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo subir");
      await onSubido?.(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-1">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-violet-700 hover:underline"
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="max-w-[12rem] truncate">{nombre ?? etiqueta}</span>
        </a>
      ) : (
        <span className="text-gray-400">sin {etiqueta}</span>
      )}

      {puedeSubir && onSubido && (
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-violet-700 hover:underline">
          {subiendo ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Paperclip className="h-3 w-3" />
          )}
          {url ? "Reemplazar" : "Subir"}
          <input
            type="file"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const a = e.target.files?.[0];
              if (a) subir(a);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Los pagos de una campana, desde la pestana de la campana.
 *
 * Es la vista de mercadeo: a quien hay que pagar, cuanto segun lo
 * contratado, y que documentos faltan. Lo que registra contabilidad se
 * ve, pero no se toca desde aqui.
 *
 * Tras guardar se recarga la pagina entera en vez de refrescar: el
 * estado y el plazo son calculados y cambian con cada dato que entra,
 * y `router.refresh()` no repinta en la compilacion de produccion.
 */
export function PagosCampana({
  pagos,
  puedeEditar,
}: {
  pagos: PagoVista[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({ fecha: "", observaciones: "" });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (id: string, datos: Record<string, unknown>) => {
    setOcupado(id);
    setError(null);
    try {
      await apiPatch(`/api/pagos/${id}/documentos`, datos);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
      setOcupado(null);
    }
  };

  const total = pagos.reduce((s, p) => s + p.base, 0);
  const pendientes = pagos.filter((p) => p.estado === "PENDIENTE_DOCUMENTOS").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Pagos a influencers</CardTitle>
        <span className="text-xs text-gray-500">
          {pagos.length} por pagar · total contratado{" "}
          <span className="font-semibold text-gray-900">
            ${formatNumber(total.toFixed(0))}
          </span>
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {pagos.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No hay influencers aprobados y contratados en esta campaña.
          </p>
        ) : (
          <>
            {pendientes > 0 && (
              <p className="text-xs text-amber-700">
                Faltan documentos de {pendientes} influencer
                {pendientes === 1 ? "" : "s"}: contabilidad no puede registrar el
                pago hasta que estén.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-2 py-1 font-medium">Influencer</th>
                    <th className="px-2 py-1 text-right font-medium">Contratado</th>
                    <th className="px-2 py-1 font-medium">Cuenta de cobro</th>
                    <th className="px-2 py-1 font-medium">Certificado</th>
                    <th className="px-2 py-1 font-medium">Fecha cuenta</th>
                    <th className="px-2 py-1 font-medium">Vence en</th>
                    <th className="px-2 py-1 font-medium">Estado</th>
                    {puedeEditar && <th className="w-20 px-2 py-1" />}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr
                      key={p.campaignProfileId}
                      className="border-t border-gray-200/70 align-top text-gray-600 odd:bg-marca/5"
                    >
                      <td className="px-2 py-2">
                        <p className="font-medium text-gray-900">{p.influencer}</p>
                        {p.nombreCompleto && (
                          <p className="text-[11px] text-gray-500">
                            {p.nombreCompleto}
                          </p>
                        )}
                        {p.documentoIdentidad && (
                          <p className="text-[11px] text-gray-400">
                            {p.documentoIdentidad}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums text-gray-900">
                        ${formatNumber(p.base.toFixed(0))}
                      </td>
                      <td className="px-2 py-2">
                        <Adjunto
                          url={p.cuentaCobroUrl}
                          nombre={p.cuentaCobroNombre}
                          etiqueta="cuenta de cobro"
                          puedeSubir={puedeEditar}
                          onSubido={(doc) =>
                            guardar(p.campaignProfileId, { cuentaCobro: doc })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Adjunto
                          url={p.certificadoUrl}
                          nombre={p.certificadoNombre}
                          etiqueta="certificado"
                          puedeSubir={puedeEditar}
                          onSubido={(doc) =>
                            guardar(p.campaignProfileId, { certificado: doc })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        {editando === p.campaignProfileId ? (
                          <div className="space-y-1">
                            <Input
                              type="date"
                              value={borrador.fecha}
                              onChange={(e) =>
                                setBorrador((b) => ({ ...b, fecha: e.target.value }))
                              }
                              className="h-7 w-36 text-xs"
                            />
                            <Input
                              placeholder="Observaciones"
                              value={borrador.observaciones}
                              onChange={(e) =>
                                setBorrador((b) => ({
                                  ...b,
                                  observaciones: e.target.value,
                                }))
                              }
                              maxLength={1000}
                              className="h-7 w-48 text-xs"
                            />
                          </div>
                        ) : (
                          <>
                            {p.fechaCuentaCobro ? (
                              new Date(p.fechaCuentaCobro).toLocaleDateString("es-CO")
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                            {p.observaciones && (
                              <p className="mt-0.5 max-w-[14rem] text-[11px] text-gray-500">
                                {p.observaciones}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Vencimiento pago={p} />
                      </td>
                      <td className="px-2 py-2">
                        <EstadoBadge estado={p.estado} />
                        {p.documento && (
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            doc. {p.documento}
                          </p>
                        )}
                      </td>
                      {puedeEditar && (
                        <td className="px-2 py-2">
                          {editando === p.campaignProfileId ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Guardar"
                                className="text-violet-700 hover:text-violet-900 disabled:opacity-40"
                                disabled={ocupado === p.campaignProfileId}
                                onClick={() =>
                                  guardar(p.campaignProfileId, {
                                    fechaCuentaCobro: borrador.fecha || null,
                                    observaciones: borrador.observaciones || null,
                                  })
                                }
                              >
                                {ocupado === p.campaignProfileId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Cancelar"
                                className="text-gray-400 hover:text-gray-700"
                                onClick={() => setEditando(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              title="Editar fecha y observaciones"
                              className="text-gray-400 hover:text-violet-700"
                              onClick={() => {
                                setBorrador({
                                  fecha: p.fechaCuentaCobro
                                    ? p.fechaCuentaCobro.slice(0, 10)
                                    : "",
                                  observaciones: p.observaciones ?? "",
                                });
                                setEditando(p.campaignProfileId);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-500">
              El importe sale de lo contratado en la campaña, sin el margen del
              cliente. Los impuestos y el valor final a pagar llegarán cuando
              mercadeo y contabilidad acuerden la fórmula.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

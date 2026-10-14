"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { ETIQUETA_TIPO_PERSONA } from "@/lib/pagos";
import type { PagoVista } from "@/data-access/pagos";
import { apiPatch } from "@/services/api";
import { Adjunto, Dinero, EstadoBadge, Vencimiento } from "@/components/pagos/piezas";

const SIN_TIPO = "__sin__";

/**
 * Los pagos de una campana, desde su pestana.
 *
 * Es la vista de mercadeo: a quien hay que pagar, cuanto segun lo
 * contratado, que documentos faltan y con que tipo de persona se
 * negocio. Lo que registra contabilidad se ve, pero no se toca.
 *
 * Tras guardar se recarga la pagina entera en vez de refrescar: el
 * estado, los impuestos, el plazo y el saldo son calculados y cambian
 * con cada dato que entra, y `router.refresh()` no repinta en la
 * compilacion de produccion.
 */
export function PagosCampana({
  pagos,
  puedeEditar,
}: {
  pagos: PagoVista[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({
    fecha: "",
    tipo: SIN_TIPO,
    observaciones: "",
  });
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

  const coste = pagos.reduce((s, p) => s + p.base, 0);
  const reserva = pagos.reduce((s, p) => s + p.reserva, 0);
  const saldo = pagos.reduce((s, p) => s + p.saldo, 0);
  const sinDocumentos = pagos.filter(
    (p) => p.estado === "PENDIENTE_DOCUMENTOS"
  ).length;
  const sinTipo = pagos.filter((p) => !p.tipoPersona).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Pagos a influencers</CardTitle>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
          <span>
            Contratado <Dinero valor={coste} destacado />
          </span>
          <span title="Lo que hay que tener reservado, con IVA donde aplica">
            A reservar <Dinero valor={reserva} destacado />
          </span>
          <span>
            Falta pagar <Dinero valor={saldo} destacado />
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
            {sinDocumentos > 0 && (
              <p className="text-xs text-amber-700">
                Faltan documentos de {sinDocumentos} influencer
                {sinDocumentos === 1 ? "" : "s"}: contabilidad no puede registrar
                el pago hasta que estén.
              </p>
            )}
            {sinTipo > 0 && (
              <p className="text-xs text-gray-500">
                De {sinTipo} {sinTipo === 1 ? "influencer" : "influencers"} no se
                sabe cómo factura, así que se reserva el peor caso —con IVA—
                hasta que llegue su RUT.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[68rem] text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-2 py-1 font-medium">Influencer</th>
                    <th className="px-2 py-1 font-medium">Nombre completo</th>
                    <th className="px-2 py-1 font-medium">Cómo factura</th>
                    <th className="px-2 py-1 text-right font-medium">Contratado</th>
                    <th className="px-2 py-1 text-right font-medium">A reservar</th>
                    <th className="px-2 py-1 font-medium">Documentos</th>
                    <th className="px-2 py-1 font-medium">Cuenta de cobro</th>
                    <th className="px-2 py-1 text-center font-medium">Días</th>
                    <th className="px-2 py-1 font-medium">Estado</th>
                    {puedeEditar && <th className="w-16 px-2 py-1" />}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr
                      key={p.campaignProfileId}
                      className={`border-t border-gray-200/70 align-top text-gray-600 ${
                        p.estado === "PAGADO" ? "bg-sky-50" : "odd:bg-marca/5"
                      }`}
                    >
                      <td className="px-2 py-2">
                        <p className="font-medium text-gray-900">{p.influencer}</p>
                      </td>
                      <td className="px-2 py-2">
                        {p.nombreCompleto ? (
                          <p className="text-gray-900">{p.nombreCompleto}</p>
                        ) : (
                          <p className="text-gray-400">sin registrar</p>
                        )}
                        {p.documentoIdentidad && (
                          <p className="text-[11px] text-gray-400">
                            {p.documentoIdentidad}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {editando === p.campaignProfileId ? (
                          <Select
                            value={borrador.tipo}
                            onValueChange={(v) =>
                              setBorrador((b) => ({ ...b, tipo: v }))
                            }
                          >
                            <SelectTrigger className="h-7 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SIN_TIPO}>
                                Todavía no se sabe
                              </SelectItem>
                              <SelectItem value="NATURAL">
                                Persona natural
                              </SelectItem>
                              <SelectItem value="JURIDICA">
                                Persona jurídica
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : p.tipoPersona ? (
                          <>
                            <p className="text-gray-900">
                              {ETIQUETA_TIPO_PERSONA[p.tipoPersona]}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {p.tipoVerificado
                                ? "confirmado con el RUT"
                                : "pactado al negociar"}
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-400">sin confirmar</p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <Dinero valor={p.base} destacado />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <Dinero valor={p.reserva} />
                        {!p.tipoPersona && (
                          <p className="text-[11px] text-gray-400">peor caso</p>
                        )}
                      </td>
                      <td className="space-y-1 px-2 py-2">
                        <Adjunto
                          url={p.cuentaCobroUrl}
                          nombre={p.cuentaCobroNombre}
                          etiqueta="cuenta de cobro"
                          puedeSubir={puedeEditar}
                          onSubido={(doc) =>
                            guardar(p.campaignProfileId, { cuentaCobro: doc })
                          }
                        />
                        <Adjunto
                          url={p.certificadoUrl}
                          nombre={p.certificadoNombre}
                          etiqueta="certificado"
                          puedeSubir={puedeEditar}
                          onSubido={(doc) =>
                            guardar(p.campaignProfileId, { certificado: doc })
                          }
                        />
                        {p.tipoVerificado && !p.rutUrl ? (
                          <p className="text-[11px] text-gray-400">
                            RUT ya verificado
                          </p>
                        ) : (
                          <Adjunto
                            url={p.rutUrl}
                            nombre={p.rutNombre}
                            etiqueta="RUT"
                            puedeSubir={puedeEditar}
                            onSubido={(doc) =>
                              guardar(p.campaignProfileId, { rut: doc })
                            }
                          />
                        )}
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
                              className="h-7 w-44 text-xs"
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
                              <p className="mt-0.5 max-w-[12rem] text-[11px] text-gray-500">
                                {p.observaciones}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Vencimiento
                          dias={p.dias}
                          avisar={p.avisar}
                          vencido={p.vencido}
                          pagado={p.estado === "PAGADO"}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <EstadoBadge
                          estado={p.estado}
                          loPagaElCliente={p.loPagaElCliente}
                        />
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
                                    tipoPersona:
                                      borrador.tipo === SIN_TIPO
                                        ? null
                                        : borrador.tipo,
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
                              title="Editar fecha, tipo y observaciones"
                              className="text-gray-400 hover:text-violet-700"
                              onClick={() => {
                                setBorrador({
                                  fecha: p.fechaCuentaCobro
                                    ? p.fechaCuentaCobro.slice(0, 10)
                                    : "",
                                  tipo: p.tipoPersona ?? SIN_TIPO,
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
                <tfoot>
                  <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                    <td className="px-2 py-2" colSpan={3}>
                      Total
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      ${formatNumber(Math.round(coste))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      ${formatNumber(Math.round(reserva))}
                    </td>
                    <td className="px-2 py-2" colSpan={puedeEditar ? 5 : 4} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-[11px] text-gray-500">
              El contratado sale de los formatos de la campaña, sin el margen del
              cliente. Los impuestos y el valor final los calcula y los registra
              contabilidad en su pantalla de Pagos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

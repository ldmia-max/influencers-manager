"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { mesLegible } from "@/lib/pagos";
import type { GrupoDeCampana, PagoVista } from "@/data-access/pagos";
import { apiDelete, apiPatch, apiPost } from "@/services/api";
import { Adjunto, Dinero, EstadoBadge, Vencimiento } from "@/components/pagos/piezas";

const SIN_TIPO = "__sin__";

/** Las columnas de la hoja de contabilidad, en su orden. */
const COLUMNAS = [
  { etiqueta: "Nombre", alineacion: "left" },
  { etiqueta: "Nombre completo", alineacion: "left" },
  { etiqueta: "Cómo factura", alineacion: "left" },
  { etiqueta: "Precio", alineacion: "right" },
  { etiqueta: "IVA", alineacion: "right" },
  { etiqueta: "Valor factura", alineacion: "right" },
  { etiqueta: "Retención", alineacion: "right" },
  { etiqueta: "Reteiva", alineacion: "right" },
  { etiqueta: "Valor a pagar", alineacion: "right" },
  { etiqueta: "Cuenta de cobro", alineacion: "left" },
  { etiqueta: "Venc.", alineacion: "center" },
  { etiqueta: "Documento", alineacion: "left" },
  { etiqueta: "Fecha de doc.", alineacion: "left" },
  { etiqueta: "Pagado", alineacion: "right" },
  { etiqueta: "Saldo", alineacion: "right" },
  { etiqueta: "Documentos", alineacion: "left" },
  { etiqueta: "Estado", alineacion: "left" },
] as const;

/**
 * El cuadro de contabilidad: una tarjeta por campana, con las mismas
 * columnas de su hoja de calculo y su fila de totales.
 *
 * Se parece al Excel a proposito. El equipo lleva anios leyendo ese
 * cuadro y lo que se gana aqui —que los impuestos no se puedan olvidar,
 * que el aviso de los 50 dias no se escape, que el saldo cuadre solo—
 * no vale nada si ademas hay que aprender a leerlo de nuevo.
 */
export function TablaContabilidad({
  grupos,
  puedeRegistrar,
}: {
  grupos: GrupoDeCampana[];
  puedeRegistrar: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  if (grupos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          No hay pagos con esos filtros.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {grupos.map((g) => (
        <Card key={g.campanaId}>
          <CardHeader className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <Link
                  href={`/campaigns/${g.campanaId}`}
                  prefetch={false}
                  className="hover:underline"
                >
                  {g.campana}
                </Link>
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {g.cliente}
                </span>
              </CardTitle>
              {g.mes && (
                <span className="text-xs capitalize text-gray-500">
                  {mesLegible(g.mes)}
                </span>
              )}
            </div>

            {/* El control que hacen hoy: el total de saldos contra el
                presupuesto de la campana. La utilidad es interna. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>
                Presupuesto <Dinero valor={g.presupuesto} destacado />
              </span>
              <span>
                Coste influencers <Dinero valor={g.coste} destacado />
              </span>
              <span title="Lo que se le cobra al cliente. No sale de la agencia.">
                Cobrado <Dinero valor={g.cobradoAlCliente} destacado />
              </span>
              <span title="Cobrado menos coste. No sale de la agencia.">
                Utilidad{" "}
                <span
                  className={
                    g.utilidad >= 0
                      ? "font-semibold text-green-700"
                      : "font-semibold text-red-600"
                  }
                >
                  ${formatNumber(Math.round(Math.abs(g.utilidad)))}
                </span>
              </span>
              <span title="Lo que esta campaña todavía pide para terminar de pagar">
                Falta pagar{" "}
                <span
                  className={
                    g.saldo === 0
                      ? "font-semibold text-green-700"
                      : "font-semibold text-gray-900"
                  }
                >
                  ${formatNumber(Math.round(g.saldo))}
                </span>
              </span>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[104rem] text-xs">
                <thead>
                  <tr className="text-gray-500">
                    {COLUMNAS.map((c) => (
                      <th
                        key={c.etiqueta}
                        className={`px-2 py-1 font-medium text-${c.alineacion}`}
                      >
                        {c.etiqueta}
                      </th>
                    ))}
                    {puedeRegistrar && <th className="w-10 px-2 py-1" />}
                  </tr>
                </thead>
                <tbody>
                  {g.pagos.map((p) => (
                    <Fila
                      key={p.campaignProfileId}
                      pago={p}
                      puedeRegistrar={puedeRegistrar}
                      onError={setError}
                    />
                  ))}
                </tbody>
                <Totales pagos={g.pagos} puedeRegistrar={puedeRegistrar} />
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Totales({
  pagos,
  puedeRegistrar,
}: {
  pagos: PagoVista[];
  puedeRegistrar: boolean;
}) {
  const sumar = (f: (p: PagoVista) => number) => pagos.reduce((s, p) => s + f(p), 0);
  const celda = (v: number) => (
    <td className="px-2 py-2 text-right tabular-nums">
      ${formatNumber(Math.round(v))}
    </td>
  );

  return (
    <tfoot>
      <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
        <td className="px-2 py-2" colSpan={3}>
          Total
        </td>
        {celda(sumar((p) => p.base))}
        {celda(sumar((p) => p.impuestos?.iva ?? 0))}
        {/* Las columnas fiscales suman solo lo confirmado: mezclar una
            factura real con la reserva de alguien cuyo tipo no se sabe
            daria un total que no es ninguna de las dos cosas. El saldo
            si las incluye, porque es el dinero que hay que tener. */}
        {celda(sumar((p) => p.impuestos?.valorFactura ?? 0))}
        {celda(sumar((p) => p.impuestos?.retencion ?? 0))}
        {celda(0)}
        {celda(sumar((p) => (p.impuestos?.valorAPagar ?? 0) + p.ajuste))}
        <td className="px-2 py-2" colSpan={4} />
        {celda(sumar((p) => p.abonado))}
        {celda(sumar((p) => p.saldo))}
        <td className="px-2 py-2" colSpan={puedeRegistrar ? 3 : 2} />
      </tr>
    </tfoot>
  );
}

function Fila({
  pago: p,
  puedeRegistrar,
  onError,
}: {
  pago: PagoVista;
  puedeRegistrar: boolean;
  onError: (e: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [abonando, setAbonando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState({
    documento: "",
    fechaDocumento: "",
    fechaCuentaCobro: "",
    tipo: SIN_TIPO,
    ajuste: "",
    motivoAjuste: "",
    loPagaElCliente: false,
  });
  const [abono, setAbono] = useState({ fecha: "", valor: "", observacion: "" });

  const pagado = p.estado === "PAGADO";

  const correr = async (accion: () => Promise<unknown>) => {
    setGuardando(true);
    onError(null);
    try {
      await accion();
      window.location.reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Algo falló");
      setGuardando(false);
    }
  };

  const abrir = () => {
    setBorrador({
      documento: p.documento ?? "",
      fechaDocumento: p.fechaDocumento?.slice(0, 10) ?? "",
      fechaCuentaCobro: p.fechaCuentaCobro?.slice(0, 10) ?? "",
      tipo: p.tipoPersona ?? SIN_TIPO,
      ajuste: p.ajuste ? String(p.ajuste) : "",
      motivoAjuste: p.motivoAjuste ?? "",
      loPagaElCliente: p.loPagaElCliente,
    });
    setEditando(true);
  };

  const i = p.impuestos;

  return (
    <>
      <tr
        className={`border-t border-gray-200/70 align-top text-gray-600 ${
          pagado ? "bg-sky-50" : "odd:bg-marca/5"
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
            <p className="text-[11px] text-gray-400">{p.documentoIdentidad}</p>
          )}
        </td>
        <td className="px-2 py-2">
          {p.tipoPersona ? (
            <>
              <p className="whitespace-nowrap text-gray-900">
                {p.tipoPersona === "NATURAL" ? "Natural" : "Jurídica"}
              </p>
              {!p.tipoVerificado && (
                <p className="text-[11px] text-amber-700">sin RUT</p>
              )}
            </>
          ) : (
            <p className="whitespace-nowrap text-amber-700">sin confirmar</p>
          )}
        </td>

        <td className="px-2 py-2 text-right tabular-nums">
          <Dinero valor={p.base} destacado />
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {i ? <Dinero valor={i.iva} /> : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {i ? (
            <Dinero valor={i.valorFactura} />
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {i ? (
            <Dinero valor={i.retencion} />
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-gray-400">0</td>
        <td className="px-2 py-2 text-right tabular-nums">
          {i ? (
            <Dinero valor={i.valorAPagar} destacado />
          ) : (
            // Mientras no se sepa como factura, las dos cifras posibles
            // en vez de prometer una.
            <span className="whitespace-nowrap text-[11px] text-gray-500">
              nat. ${formatNumber(p.hipotesis!.NATURAL.valorAPagar)}
              <br />
              jur. ${formatNumber(p.hipotesis!.JURIDICA.valorAPagar)}
            </span>
          )}
        </td>

        <td className="px-2 py-2 whitespace-nowrap">
          {p.fechaCuentaCobro ? (
            new Date(p.fechaCuentaCobro).toLocaleDateString("es-CO")
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-center">
          <Vencimiento
            dias={p.dias}
            avisar={p.avisar}
            vencido={p.vencido}
            pagado={pagado}
          />
        </td>
        <td className="px-2 py-2">
          {p.documento || <span className="text-gray-400">—</span>}
        </td>
        <td className="px-2 py-2 whitespace-nowrap">
          {p.fechaDocumento ? (
            new Date(p.fechaDocumento).toLocaleDateString("es-CO")
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>

        <td className="px-2 py-2 text-right tabular-nums">
          <Dinero valor={p.abonado} />
          {p.abonos.length > 0 && (
            <p className="text-[11px] text-gray-400">
              {p.abonos.length} abono{p.abonos.length === 1 ? "" : "s"} ·{" "}
              {new Date(p.abonos[p.abonos.length - 1].fecha).toLocaleDateString(
                "es-CO"
              )}
            </p>
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          <span
            className={
              p.saldo === 0 ? "font-semibold text-green-700" : "font-semibold"
            }
          >
            ${formatNumber(Math.round(p.saldo))}
          </span>
          {p.ajuste !== 0 && (
            <p className="max-w-[13rem] text-right text-[11px] text-red-600">
              {p.ajuste > 0 ? "+" : "−"}$
              {formatNumber(Math.round(Math.abs(p.ajuste)))}
              {p.motivoAjuste ? ` · ${p.motivoAjuste}` : ""}
            </p>
          )}
        </td>

        <td className="space-y-1 px-2 py-2">
          <Adjunto
            url={p.cuentaCobroUrl}
            nombre={p.cuentaCobroNombre}
            etiqueta="cuenta de cobro"
          />
          <Adjunto
            url={p.certificadoUrl}
            nombre={p.certificadoNombre}
            etiqueta="certificado"
          />
          <Adjunto url={p.rutUrl} nombre={p.rutNombre} etiqueta="RUT" />
        </td>
        <td className="px-2 py-2">
          <EstadoBadge estado={p.estado} loPagaElCliente={p.loPagaElCliente} />
        </td>

        {puedeRegistrar && (
          <td className="px-2 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Registrar"
                className="text-gray-400 hover:text-violet-700"
                onClick={abrir}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Anotar un pago"
                className="text-gray-400 hover:text-violet-700"
                onClick={() => {
                  setAbono({
                    fecha: new Date().toISOString().slice(0, 10),
                    valor: String(Math.round(p.saldo)),
                    observacion: "",
                  });
                  setAbonando(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        )}
      </tr>

      {/* Los abonos anotados, bajo su fila */}
      {p.abonos.length > 0 && (
        <tr className={pagado ? "bg-sky-50" : "odd:bg-marca/5"}>
          <td className="px-2 pb-2 text-[11px] text-gray-500" colSpan={18}>
            {p.abonos.map((a) => (
              <span key={a.id} className="mr-4 inline-flex items-center gap-1">
                {new Date(a.fecha).toLocaleDateString("es-CO")} · $
                {formatNumber(Math.round(a.valor))}
                {a.observacion ? ` · ${a.observacion}` : ""}
                {a.registradoPor ? ` · ${a.registradoPor}` : ""}
                {puedeRegistrar && (
                  <button
                    type="button"
                    title="Quitar este pago"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() =>
                      correr(() =>
                        apiDelete(`/api/pagos/${p.campaignProfileId}/abonos/${a.id}`)
                      )
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </td>
        </tr>
      )}

      {/* Registrar: documento, fecha, tipo y ajuste */}
      {editando && (
        <tr className="bg-white">
          <td className="px-2 py-3" colSpan={18}>
            <div className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Documento (DIAN)">
                <Input
                  autoFocus
                  value={borrador.documento}
                  onChange={(e) =>
                    setBorrador((b) => ({ ...b, documento: e.target.value }))
                  }
                  maxLength={100}
                  className="h-7 w-32 text-xs"
                />
              </Campo>
              <Campo etiqueta="Fecha del documento">
                <Input
                  type="date"
                  value={borrador.fechaDocumento}
                  onChange={(e) =>
                    setBorrador((b) => ({ ...b, fechaDocumento: e.target.value }))
                  }
                  className="h-7 w-36 text-xs"
                />
              </Campo>
              <Campo etiqueta="Fecha cuenta de cobro">
                <Input
                  type="date"
                  value={borrador.fechaCuentaCobro}
                  onChange={(e) =>
                    setBorrador((b) => ({ ...b, fechaCuentaCobro: e.target.value }))
                  }
                  className="h-7 w-36 text-xs"
                />
              </Campo>
              <Campo etiqueta="Cómo factura (según el RUT)">
                <Select
                  value={borrador.tipo}
                  onValueChange={(v) => setBorrador((b) => ({ ...b, tipo: v }))}
                >
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_TIPO}>Todavía no se sabe</SelectItem>
                    <SelectItem value="NATURAL">Persona natural</SelectItem>
                    <SelectItem value="JURIDICA">Persona jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo etiqueta="Ajuste (+/−)">
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={borrador.ajuste}
                  onChange={(e) =>
                    setBorrador((b) => ({ ...b, ajuste: e.target.value }))
                  }
                  className="h-7 w-28 text-xs"
                />
              </Campo>
              <Campo etiqueta="Motivo del ajuste">
                <Input
                  placeholder="Ej: sumar transporte"
                  value={borrador.motivoAjuste}
                  onChange={(e) =>
                    setBorrador((b) => ({ ...b, motivoAjuste: e.target.value }))
                  }
                  maxLength={300}
                  className="h-7 w-56 text-xs"
                />
              </Campo>
              <label className="flex items-center gap-1 pb-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={borrador.loPagaElCliente}
                  onChange={(e) =>
                    setBorrador((b) => ({
                      ...b,
                      loPagaElCliente: e.target.checked,
                    }))
                  }
                />
                Lo paga el cliente
              </label>

              <div className="flex items-center gap-1 pb-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={guardando}
                  onClick={() =>
                    correr(() =>
                      apiPatch(`/api/pagos/${p.campaignProfileId}/registro`, {
                        documento: borrador.documento.trim() || null,
                        fechaDocumento: borrador.fechaDocumento || null,
                        fechaCuentaCobro: borrador.fechaCuentaCobro || null,
                        tipoPersona:
                          borrador.tipo === SIN_TIPO ? null : borrador.tipo,
                        ajuste: borrador.ajuste.trim()
                          ? Number(borrador.ajuste)
                          : null,
                        motivoAjuste: borrador.motivoAjuste.trim() || null,
                        loPagaElCliente: borrador.loPagaElCliente,
                      })
                    )
                  }
                >
                  {guardando ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  )}
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-gray-500"
                  onClick={() => setEditando(false)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Anotar un pago */}
      {abonando && (
        <tr className="bg-white">
          <td className="px-2 py-3" colSpan={18}>
            <div className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Fecha de pago">
                <Input
                  type="date"
                  value={abono.fecha}
                  onChange={(e) => setAbono((a) => ({ ...a, fecha: e.target.value }))}
                  className="h-7 w-36 text-xs"
                />
              </Campo>
              <Campo etiqueta="Valor">
                <Input
                  inputMode="numeric"
                  value={abono.valor}
                  onChange={(e) => setAbono((a) => ({ ...a, valor: e.target.value }))}
                  className="h-7 w-32 text-xs"
                />
              </Campo>
              <Campo etiqueta="Observación">
                <Input
                  value={abono.observacion}
                  onChange={(e) =>
                    setAbono((a) => ({ ...a, observacion: e.target.value }))
                  }
                  maxLength={300}
                  className="h-7 w-56 text-xs"
                />
              </Campo>
              <div className="flex items-center gap-1 pb-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={guardando || !abono.fecha || !abono.valor.trim()}
                  onClick={() =>
                    correr(() =>
                      apiPost(`/api/pagos/${p.campaignProfileId}/abonos`, {
                        fecha: abono.fecha,
                        valor: Number(abono.valor),
                        observacion: abono.observacion.trim() || null,
                      })
                    )
                  }
                >
                  {guardando ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  )}
                  Anotar pago
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-gray-500"
                  onClick={() => setAbonando(false)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-[11px] text-gray-500">{etiqueta}</span>
      {children}
    </label>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FileText, Loader2, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
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
import {
  calcularImpuestos,
  documentosObligatoriosCompletos,
  type TipoPersona,
} from "@/lib/pagos";
import type { PagoVista } from "@/data-access/pagos";
import { apiDelete, apiPatch, apiPost } from "@/services/api";
import { Dinero, EstadoBadge, Vencimiento } from "@/components/pagos/piezas";
import { PanelDocumentos } from "@/components/pagos/panel-documentos";

const SIN_TIPO = "__sin__";

/** Las columnas de la hoja de contabilidad, en su orden. */
const COLUMNAS = [
  { etiqueta: "Nombre", alineacion: "left" },
  { etiqueta: "Campaña", alineacion: "left" },
  { etiqueta: "Nombre completo", alineacion: "left" },
  { etiqueta: "Cómo factura", alineacion: "left" },
  { etiqueta: "Precio", alineacion: "right" },
  { etiqueta: "IVA", alineacion: "right" },
  { etiqueta: "Valor factura", alineacion: "right" },
  { etiqueta: "Retención", alineacion: "right" },
  { etiqueta: "Reteiva", alineacion: "right" },
  { etiqueta: "Valor a pagar", alineacion: "right" },
  { etiqueta: "Cuenta de cobro", alineacion: "left" },
  { etiqueta: "Vence en", alineacion: "center" },
  { etiqueta: "Documento", alineacion: "left" },
  { etiqueta: "Fecha de doc.", alineacion: "left" },
  { etiqueta: "Pagado", alineacion: "right" },
  { etiqueta: "Saldo", alineacion: "right" },
  { etiqueta: "Documentos", alineacion: "center" },
  { etiqueta: "Estado", alineacion: "left" },
] as const;

/**
 * Las filas de pago, con las mismas columnas de la hoja de contabilidad.
 *
 * Se parece al Excel a proposito. El equipo lleva anios leyendo ese
 * cuadro y lo que se gana aqui —que los impuestos no se puedan olvidar,
 * que el vencimiento no se escape, que el saldo cuadre solo— no vale
 * nada si ademas hay que aprender a leerlo de nuevo.
 *
 * La usan las tres pestanas de /pagos. `conCampana` anade la columna de
 * la campana, que hace falta en la lista suelta de influencers —uno
 * puede estar en varias— y sobra dentro de una campana desplegada.
 *
 * Todas las filas en blanco: el color lo lleva el dato que importa —el
 * vencimiento, el contador de documentos, el estado—, no la fila.
 */
export function TablaPagos({
  pagos,
  puedeRegistrar,
  puedeEditarDocumentos,
  conCampana = false,
  conTotales = true,
}: {
  pagos: PagoVista[];
  puedeRegistrar: boolean;
  puedeEditarDocumentos: boolean;
  conCampana?: boolean;
  conTotales?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const columnas = COLUMNAS.filter(
    (c) => conCampana || c.etiqueta !== "Campaña",
  );
  const ancho = columnas.length + (puedeRegistrar ? 1 : 0);

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[104rem] bg-white text-xs">
          <thead>
            <tr className="text-gray-500">
              {columnas.map((c) => (
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
            {pagos.map((p) => (
              <Fila
                key={p.campaignProfileId}
                pago={p}
                puedeRegistrar={puedeRegistrar}
                puedeEditarDocumentos={puedeEditarDocumentos}
                conCampana={conCampana}
                ancho={ancho}
                onError={setError}
              />
            ))}
          </tbody>
          {conTotales && (
            <Totales
              pagos={pagos}
              puedeRegistrar={puedeRegistrar}
              conCampana={conCampana}
            />
          )}
        </table>
      </div>
    </div>
  );
}

function Totales({
  pagos,
  puedeRegistrar,
  conCampana,
}: {
  pagos: PagoVista[];
  puedeRegistrar: boolean;
  conCampana: boolean;
}) {
  const sumar = (f: (p: PagoVista) => number) =>
    pagos.reduce((s, p) => s + f(p), 0);
  // El signo va a mano: formatNumber borra todo lo que no sea digito.
  const celda = (v: number) => (
    <td className="px-2 py-2 text-right tabular-nums">
      {Math.round(v) < 0 ? "−" : ""}${formatNumber(Math.abs(Math.round(v)))}
    </td>
  );

  return (
    <tfoot>
      <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
        <td className="px-2 py-2" colSpan={conCampana ? 4 : 3}>
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
  puedeEditarDocumentos,
  conCampana,
  ancho,
  onError,
}: {
  pago: PagoVista;
  puedeRegistrar: boolean;
  puedeEditarDocumentos: boolean;
  conCampana: boolean;
  ancho: number;
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
  /** El comprobante ya subido, listo para ir con el pago. */
  const [comprobante, setComprobante] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  /**
   * Sube el archivo en cuanto se elige, antes de anotar el pago: asi el
   * boton de anotar solo manda la referencia y, si la subida falla, se
   * sabe antes de dar el pago por hecho.
   */
  const subirComprobante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendo(true);
    onError(null);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch("/api/pagos/upload", { method: "POST", body: form });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo subir el comprobante");
      setComprobante({ url: datos.url, nombre: datos.nombre });
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo subir el comprobante");
    } finally {
      setSubiendo(false);
    }
  };

  const pagado = p.estado === "PAGADO";
  // Sin los cuatro obligatorios no se gira; el servidor lo vuelve a mirar.
  const documentosCompletos = documentosObligatoriosCompletos(p);

  const correr = async (accion: () => Promise<unknown>) => {
    setGuardando(true);
    onError(null);
    try {
      const resultado = await accion();
      // El pago quedo guardado; si el aviso por correo no salio, se dice
      // antes de recargar para que nadie crea que el pago fallo ni que
      // el aviso llego.
      const email = (resultado as { email?: { sent: boolean; error?: string } } | undefined)
        ?.email;
      if (email && !email.sent) {
        window.alert(
          `El pago quedó registrado, pero no se pudo enviar el correo de aviso: ${email.error ?? "error desconocido"}.`
        );
      }
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

  // El valor a pagar con lo que dice el formulario ahora mismo: el del
  // tipo elegido, mas o menos el ajuste. Solo se muestra: registrar ya no
  // paga, eso lo hace el boton Pagar. Sin tipo no hay cifra: el IVA y la
  // retencion dependen de el.
  const ajusteBorrador = Number(borrador.ajuste.trim() || 0);
  const valorAPagarBorrador =
    borrador.tipo === SIN_TIPO || !Number.isFinite(ajusteBorrador)
      ? null
      : Math.max(
          Math.round(
            calcularImpuestos(p.base, borrador.tipo as TipoPersona)
              .valorAPagar + ajusteBorrador,
          ),
          0,
        );

  const i = p.impuestos;

  return (
    <>
      <tr className="border-t border-gray-200/70 bg-white align-top text-gray-600">
        <td className="px-2 py-2">
          <p className="font-medium text-gray-900">{p.influencer}</p>
        </td>
        {conCampana && (
          <td className="px-2 py-2">
            <Link
              href={`/campaigns/${p.campanaId}`}
              prefetch={false}
              className="font-medium text-gray-900 hover:underline"
            >
              {p.campana}
            </Link>
            <p className="text-[11px] text-gray-400">{p.cliente}</p>
          </td>
        )}
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
                <p
                  className="text-[11px] text-gray-400"
                  title="Pactado al negociar; nadie lo ha confirmado contra el RUT"
                >
                  sin confirmar con el RUT
                </p>
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
          {i ? (
            <Dinero valor={i.iva} />
          ) : (
            <span className="text-gray-300">—</span>
          )}
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
          <Vencimiento dias={p.dias} pagado={pagado} />
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
                "es-CO",
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

        <td className="px-2 py-2 text-center">
          <PanelDocumentos pago={p} puedeEditar={puedeEditarDocumentos} />
        </td>
        <td className="px-2 py-2">
          <EstadoBadge estado={p.estado} loPagaElCliente={p.loPagaElCliente} />
        </td>

        {puedeRegistrar && (
          <td className="px-2 py-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={abrir}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Registrar
              </Button>
              {!pagado && !p.loPagaElCliente && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!p.tipoPersona || !documentosCompletos}
                  title={
                    !documentosCompletos
                      ? "Faltan documentos obligatorios: cuenta de cobro, certificado bancario, contrato y RUT"
                      : p.tipoPersona
                        ? "Anotar lo que se le giró"
                        : "Primero registra cómo factura: de eso sale el valor a pagar"
                  }
                  onClick={() => {
                    setAbono({
                      fecha: new Date().toISOString().slice(0, 10),
                      valor: String(Math.round(p.saldo)),
                      observacion: "",
                    });
                    setComprobante(null);
                    setAbonando(true);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Pagar
                </Button>
              )}
            </div>
          </td>
        )}
      </tr>

      {/* Los abonos anotados, bajo su fila */}
      {p.abonos.length > 0 && (
        <tr className="bg-white">
          <td className="px-2 pb-2 text-[11px] text-gray-500" colSpan={ancho}>
            {p.abonos.map((a) => (
              <span key={a.id} className="mr-4 inline-flex items-center gap-1">
                {new Date(a.fecha).toLocaleDateString("es-CO")} · $
                {formatNumber(Math.round(a.valor))}
                {a.observacion ? ` · ${a.observacion}` : ""}
                {a.registradoPor ? ` · ${a.registradoPor}` : ""}
                {a.comprobante && (
                  <a
                    href={a.comprobante.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Comprobante: ${a.comprobante.nombre}`}
                    className="ml-1 inline-flex items-center gap-0.5 text-violet-700 hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    comprobante
                  </a>
                )}
                {puedeRegistrar && (
                  <button
                    type="button"
                    title="Quitar este pago"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() =>
                      correr(() =>
                        apiDelete(
                          `/api/pagos/${p.campaignProfileId}/abonos/${a.id}`,
                        ),
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
          <td className="px-2 py-3" colSpan={ancho}>
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
                    setBorrador((b) => ({
                      ...b,
                      fechaDocumento: e.target.value,
                    }))
                  }
                  className="h-7 w-36 text-xs"
                />
              </Campo>
              <Campo etiqueta="Fecha cuenta de cobro">
                <Input
                  type="date"
                  value={borrador.fechaCuentaCobro}
                  onChange={(e) =>
                    setBorrador((b) => ({
                      ...b,
                      fechaCuentaCobro: e.target.value,
                    }))
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
            </div>

            {/* Lo que se le pagara, segun el tipo y el ajuste elegidos.
                Solo se lee: la fecha y el valor pagado se anotan con el
                boton Pagar, que es el unico que registra el pago. */}
            {!borrador.loPagaElCliente && (
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3">
                <div className="space-y-1">
                  <span className="block text-[11px] text-gray-500">
                    Valor a pagar
                  </span>
                  <p className="text-sm font-semibold tabular-nums text-gray-900">
                    {valorAPagarBorrador === null
                      ? "—"
                      : `$${formatNumber(valorAPagarBorrador)}`}
                  </p>
                </div>
                <p className="pb-0.5 text-[11px] text-gray-500">
                  {valorAPagarBorrador === null
                    ? "Elige cómo factura para calcular el valor."
                    : `${
                        borrador.tipo === "NATURAL"
                          ? "Natural: sin IVA, 10% de retención"
                          : "Jurídica: IVA 19%, 11% de retención"
                      }${
                        ajusteBorrador
                          ? `, ajuste ${ajusteBorrador > 0 ? "+" : "−"}$${formatNumber(Math.abs(ajusteBorrador))}`
                          : ""
                      }. El pago se anota con el botón Pagar.`}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-1 pb-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={guardando}
                  onClick={() =>
                    correr(() =>
                      apiPatch(
                        `/api/pagos/${p.campaignProfileId}/registro`,
                        {
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
                        },
                      ),
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
          <td className="px-2 py-3" colSpan={ancho}>
            <div className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Fecha de pago">
                <Input
                  type="date"
                  value={abono.fecha}
                  onChange={(e) =>
                    setAbono((a) => ({ ...a, fecha: e.target.value }))
                  }
                  className="h-7 w-36 text-xs"
                />
              </Campo>
              <Campo etiqueta="Valor pagado">
                <Input
                  inputMode="numeric"
                  value={abono.valor}
                  onChange={(e) =>
                    setAbono((a) => ({ ...a, valor: e.target.value }))
                  }
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
              <div className="space-y-1">
                <span className="block text-[11px] text-gray-500">
                  Comprobante de pago
                </span>
                <div className="flex h-7 items-center gap-2">
                  {comprobante && (
                    <a
                      href={comprobante.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[14rem] items-center gap-1 truncate text-xs text-violet-700 hover:underline"
                      title={comprobante.nombre}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{comprobante.nombre}</span>
                    </a>
                  )}
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-xs"
                  >
                    <label>
                      {subiendo ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Paperclip className="mr-1 h-3 w-3" />
                      )}
                      {comprobante ? "Reemplazar" : "Subir comprobante"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={subiendo || guardando}
                        onChange={subirComprobante}
                      />
                    </label>
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1 pb-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={
                    guardando || subiendo || !abono.fecha || !abono.valor.trim()
                  }
                  onClick={() =>
                    correr(() =>
                      apiPost(`/api/pagos/${p.campaignProfileId}/abonos`, {
                        fecha: abono.fecha,
                        valor: Number(abono.valor),
                        observacion: abono.observacion.trim() || null,
                        comprobante,
                      }),
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

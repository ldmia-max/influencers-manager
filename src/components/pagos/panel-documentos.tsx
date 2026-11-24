"use client";

import { useState } from "react";
import { Download, Eye, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PagoVista } from "@/data-access/pagos";
import { apiDelete, apiPatch, apiPost } from "@/services/api";

type Hueco = "cuentaCobro" | "certificado" | "contrato" | "rut" | "arl";

const HUECOS: { clave: Hueco; etiqueta: string; obligatorio: boolean }[] = [
  { clave: "cuentaCobro", etiqueta: "Cuenta de cobro", obligatorio: true },
  { clave: "certificado", etiqueta: "Certificado bancario", obligatorio: true },
  { clave: "contrato", etiqueta: "Contrato", obligatorio: true },
  { clave: "rut", etiqueta: "RUT", obligatorio: true },
  { clave: "arl", etiqueta: "ARL", obligatorio: false },
];

function archivoDe(p: PagoVista, clave: Hueco) {
  const url = p[`${clave}Url` as `${Hueco}Url`];
  return url ? { url, nombre: p[`${clave}Nombre` as `${Hueco}Nombre`] ?? "" } : null;
}

/**
 * Cuantos de los seis hay: los cinco huecos con nombre, y "Otros", que
 * cuenta uno si tiene al menos un papel.
 *
 * `completo` mira solo los cuatro que frenan el pago —cuenta de cobro,
 * certificado, contrato y RUT—: 4/6 con esos cuatro esta listo para
 * pagar, 5/6 sin RUT no.
 */
export function conteoDeDocumentos(p: PagoVista) {
  const presentes =
    HUECOS.filter((h) => archivoDe(p, h.clave)).length + (p.otros.length > 0 ? 1 : 0);
  const completo = HUECOS.filter((h) => h.obligatorio).every((h) => archivoDe(p, h.clave));
  return { presentes, total: HUECOS.length + 1, completo };
}

async function subirArchivo(archivo: File): Promise<{ url: string; nombre: string }> {
  const form = new FormData();
  form.append("archivo", archivo);
  const res = await fetch("/api/pagos/upload", { method: "POST", body: form });
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error ?? "No se pudo subir");
  return datos;
}

/**
 * Los documentos de un pago, en una barra lateral.
 *
 * Viven aqui y no en la fila para que la fila tenga una sola altura: con
 * seis enlaces y el comentario apilados, cada influencer ocupaba media
 * pantalla. En la fila queda el contador; aqui se ven, se descargan, se
 * suben y se lee o corrige el comentario de mercadeo.
 *
 * Cada ruta devuelve el pago ya recalculado —estado, contador, si se
 * puede avisar—, y con `onActualizado` se le entrega al padre para que
 * lo pinte sin recargar: la pagina no parpadea, la pestana no vuelve a
 * General y esta barra sigue abierta para subir el siguiente papel.
 * `router.refresh()` no sirve aqui porque no repinta en produccion.
 *
 * Lo usan Campana › Pagos y /pagos. Sin `onActualizado` se recarga la
 * pagina entera, como ultimo recurso.
 */
export function PanelDocumentos({
  pago: p,
  puedeEditar,
  onActualizado,
}: {
  pago: PagoVista;
  puedeEditar: boolean;
  onActualizado?: (pago: PagoVista) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comentario, setComentario] = useState(p.observaciones ?? "");

  const { presentes, total, completo } = conteoDeDocumentos(p);
  const base = `/api/pagos/${p.campaignProfileId}/documentos`;

  const correr = async (clave: string, accion: () => Promise<PagoVista>) => {
    setOcupado(clave);
    setError(null);
    try {
      const actualizado = await accion();
      if (!onActualizado) {
        window.location.reload();
        return;
      }
      onActualizado(actualizado);
      setOcupado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
      setOcupado(null);
    }
  };

  const elegir = (clave: string, alElegir: (doc: { url: string; nombre: string }) => Promise<PagoVista>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const archivo = e.target.files?.[0];
      e.target.value = "";
      if (archivo) correr(clave, async () => alElegir(await subirArchivo(archivo)));
    };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={
          completo
            ? "Están los cuatro obligatorios. Clic para ver los documentos."
            : "Falta la cuenta de cobro, el certificado, el contrato o el RUT. Clic para verlos."
        }
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold tabular-nums transition-colors ${
          completo
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
      >
        <FileText className="h-3 w-3" />
        {presentes}/{total}
      </button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Documentos de {p.influencer}</SheetTitle>
            <SheetDescription>
              {p.campana} · {p.cliente}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6">
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <ul className="divide-y rounded-lg border">
              {HUECOS.map((h) => {
                const archivo = archivoDe(p, h.clave);
                return (
                  <li key={h.clave} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {h.etiqueta}
                        {h.obligatorio && (
                          <span className="ml-1.5 text-[11px] font-normal text-gray-500">
                            obligatorio
                          </span>
                        )}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          archivo
                            ? "text-gray-500"
                            : h.obligatorio
                              ? "text-amber-700"
                              : "text-gray-400"
                        }`}
                        title={archivo?.nombre}
                      >
                        {archivo ? archivo.nombre || "Archivo subido" : "Sin subir"}
                      </p>
                    </div>
                    <Acciones
                      archivo={archivo}
                      ocupado={ocupado === h.clave}
                      puedeSubir={puedeEditar}
                      onElegir={elegir(h.clave, (doc) =>
                        apiPatch<PagoVista>(base, { [h.clave]: doc })
                      )}
                    />
                  </li>
                );
              })}

              <li className="space-y-2 p-3">
                <p className="text-sm font-medium text-gray-900">Otros</p>
                {p.otros.length === 0 && (
                  <p className="text-xs text-gray-400">Ninguno</p>
                )}
                {p.otros.map((d) => (
                  <div key={d.id} className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-xs text-gray-600" title={d.nombre}>
                      {d.nombre}
                    </p>
                    <Acciones archivo={d} ocupado={false} puedeSubir={false} />
                    {puedeEditar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-red-600"
                        title="Quitar este documento"
                        disabled={ocupado !== null}
                        onClick={() =>
                          correr(d.id, () => apiDelete<PagoVista>(`${base}/otros/${d.id}`))
                        }
                      >
                        {ocupado === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
                {puedeEditar && (
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-violet-700 hover:underline">
                    {ocupado === "otros" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Paperclip className="h-3 w-3" />
                    )}
                    Añadir otro documento
                    <input
                      type="file"
                      className="hidden"
                      disabled={ocupado !== null}
                      onChange={elegir("otros", (doc) =>
                        apiPost<PagoVista>(`${base}/otros`, doc)
                      )}
                    />
                  </label>
                )}
              </li>
            </ul>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Comentario de mercadeo</p>
              {puedeEditar ? (
                <>
                  <Textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Sin comentarios"
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={
                      ocupado !== null || comentario.trim() === (p.observaciones ?? "").trim()
                    }
                    onClick={() =>
                      correr("comentario", () =>
                        apiPatch<PagoVista>(base, {
                          observaciones: comentario.trim() || null,
                        })
                      )
                    }
                  >
                    {ocupado === "comentario" && (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    )}
                    Guardar comentario
                  </Button>
                </>
              ) : (
                <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                  {p.observaciones || <span className="text-gray-400">Sin comentarios</span>}
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Acciones({
  archivo,
  ocupado,
  puedeSubir,
  onElegir,
}: {
  archivo: { url: string; nombre: string } | null;
  ocupado: boolean;
  puedeSubir: boolean;
  onElegir?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {archivo && (
        <>
          <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="Ver">
            <a href={archivo.url} target="_blank" rel="noopener noreferrer">
              <Eye className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="Descargar">
            <a href={archivo.url} download={archivo.nombre || true}>
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
        </>
      )}
      {puedeSubir && onElegir && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 cursor-pointer px-2 text-xs"
        >
          <label>
            {ocupado ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Paperclip className="mr-1 h-3 w-3" />
            )}
            {archivo ? "Reemplazar" : "Subir"}
            <input type="file" className="hidden" disabled={ocupado} onChange={onElegir} />
          </label>
        </Button>
      )}
    </div>
  );
}

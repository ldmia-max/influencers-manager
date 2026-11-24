"use client";

import { useState } from "react";
import { Check, Download, FileText, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  APARTADOS_ANALISIS,
  type Analisis,
  type ClaveAnalisis,
} from "@/lib/informe/tipos";
import { descargarInforme, guardarAnalisisInforme } from "@/services/informes";

/** Una linea de "que va a salir en el informe". */
export interface ApartadoDelInforme {
  titulo: string;
  detalle: string;
  incluido: boolean;
}

/**
 * La pestana Informes: que lleva el informe, el analisis editable y la
 * descarga en PowerPoint.
 *
 * El analisis llega propuesto con las cifras reales. Lo que mercadeo
 * reescribe se guarda; lo que no toca sigue saliendo de la propuesta,
 * que se recalcula en cada descarga con las cifras del dia.
 */
export function InformeCampana({
  campaignId,
  apartados,
  propuesta,
  guardado,
  puedeEditar,
}: {
  campaignId: string;
  apartados: ApartadoDelInforme[];
  propuesta: Analisis;
  guardado: Partial<Analisis>;
  puedeEditar: boolean;
}) {
  const [textos, setTextos] = useState<Analisis>({ ...propuesta, ...guardado });
  // Lo guardado en el servidor, para saber que hay sin guardar y que es
  // propio frente a propuesto. Se actualiza con la respuesta del PUT:
  // router.refresh() no repinta en produccion.
  const [enServidor, setEnServidor] = useState<Partial<Analisis>>(guardado);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const efectivo = (k: ClaveAnalisis) => enServidor[k] ?? propuesta[k];
  const sinGuardar = APARTADOS_ANALISIS.some(
    ({ clave }) => textos[clave].trim() !== efectivo(clave),
  );

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      // Lo que coincide con la propuesta no se guarda: asi sigue
      // moviendose con las cifras del dia.
      const cuerpo = Object.fromEntries(
        APARTADOS_ANALISIS.map(({ clave }) => {
          const t = textos[clave].trim();
          return [clave, t && t !== propuesta[clave] ? t : null];
        }),
      ) as Record<ClaveAnalisis, string | null>;
      const { analisis } = await guardarAnalisisInforme(campaignId, cuerpo);
      setEnServidor(analisis);
      setTextos({ ...propuesta, ...analisis });
      setAviso("Análisis guardado.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el análisis");
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const descargar = async () => {
    setError(null);
    setAviso(null);
    // Lo que esta en pantalla es lo que se espera ver en el archivo.
    if (sinGuardar && puedeEditar && !(await guardar())) return;
    setDescargando(true);
    try {
      const { archivo, nombre } = await descargarInforme(campaignId);
      const url = URL.createObjectURL(archivo);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAviso(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el informe");
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-marca" />
              Informe de resultados
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Se arma al descargar, con las cifras de hoy. Se abre en
              PowerPoint y se puede editar.
            </p>
          </div>
          <Button onClick={descargar} disabled={descargando || guardando}>
            {descargando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {descargando ? "Generando…" : "Descargar PowerPoint"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {aviso && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {aviso}
            </div>
          )}
          <ul className="divide-y divide-gray-100 text-sm">
            {apartados.map((a) => (
              <li key={a.titulo} className="flex items-start gap-3 py-2">
                {a.incluido ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                )}
                <div>
                  <p className={a.incluido ? "font-medium text-gray-900" : "font-medium text-gray-400"}>
                    {a.titulo}
                  </p>
                  <p className="text-xs text-gray-500">{a.detalle}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Análisis general</CardTitle>
          <p className="text-sm text-gray-500">
            La app propone cada párrafo con las cifras reales y sin
            valoraciones. Corrígelo o añade la lectura de la campaña; lo
            que no cambies se recalcula en cada descarga.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {APARTADOS_ANALISIS.map(({ clave, titulo }) => {
            const propio = enServidor[clave] !== undefined;
            return (
              <div key={clave} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`analisis-${clave}`}
                    className="text-sm font-medium text-gray-900"
                  >
                    {titulo}
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={propio ? "text-marca" : "text-gray-400"}>
                      {propio ? "Editado" : "Propuesta"}
                    </span>
                    {puedeEditar && textos[clave] !== propuesta[clave] && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"
                        title="Volver al texto propuesto con las cifras de hoy"
                        onClick={() =>
                          setTextos((t) => ({ ...t, [clave]: propuesta[clave] }))
                        }
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restablecer
                      </button>
                    )}
                  </div>
                </div>
                <Textarea
                  id={`analisis-${clave}`}
                  value={textos[clave]}
                  disabled={!puedeEditar}
                  maxLength={1500}
                  rows={3}
                  onChange={(e) =>
                    setTextos((t) => ({ ...t, [clave]: e.target.value }))
                  }
                />
              </div>
            );
          })}
          {puedeEditar && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={guardar}
                disabled={!sinGuardar || guardando}
              >
                {guardando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Guardar análisis
              </Button>
              {sinGuardar && (
                <span className="text-xs text-amber-700">
                  Hay cambios sin guardar: se guardan al descargar.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

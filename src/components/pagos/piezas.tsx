"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Loader2, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import {
  COLOR_PAGO,
  DIAS_DE_PLAZO,
  ETIQUETA_PAGO,
  type EstadoPago,
} from "@/lib/pagos";

/**
 * Un importe. Cero se pinta en gris: no es lo mismo que una cifra.
 *
 * El signo se escribe aqui a mano porque formatNumber borra todo lo que
 * no sea digito —el menos incluido—, y un negativo pintado en positivo
 * no es un numero feo: es un numero que dice lo contrario. Un
 * presupuesto pasado se veria como presupuesto de sobra.
 */
export function Dinero({
  valor,
  destacado,
}: {
  valor: number;
  destacado?: boolean;
}) {
  const redondeado = Math.round(valor);
  return (
    <span
      className={
        redondeado === 0
          ? "text-gray-400"
          : redondeado < 0
            ? "font-semibold text-red-600"
            : destacado
              ? "font-semibold text-gray-900"
              : "text-gray-700"
      }
    >
      {redondeado < 0 ? "−" : ""}${formatNumber(Math.abs(redondeado))}
    </span>
  );
}

/**
 * El vencimiento: dias transcurridos desde la cuenta de cobro, de 1 en
 * 1 hasta 60, como en la hoja.
 *
 * Rojo desde el dia 50 y hasta que se pague, que es la regla que
 * llevaban a mano —y se les escapaban filas: tenian marcados el 51, 63,
 * 64, 66 y 72, pero no el 65, el 71 ni el 73.
 */
export function Vencimiento({
  dias,
  avisar,
  vencido,
  pagado,
}: {
  dias: number | null;
  avisar: boolean;
  vencido: boolean;
  pagado: boolean;
}) {
  if (dias === null) return <span className="text-gray-300">—</span>;

  if (pagado) {
    return <span className="tabular-nums text-gray-500">{dias}</span>;
  }
  if (avisar) {
    return (
      <span
        className="flex items-center gap-1 font-semibold tabular-nums text-red-600"
        title={
          vencido
            ? `Pasaron ${dias - DIAS_DE_PLAZO} días del plazo`
            : `Quedan ${DIAS_DE_PLAZO - dias} días para pagar`
        }
      >
        {vencido && <AlertTriangle className="h-3 w-3 shrink-0" />}
        {dias}
      </span>
    );
  }
  return <span className="tabular-nums text-gray-700">{dias}</span>;
}

export function EstadoBadge({
  estado,
  loPagaElCliente,
}: {
  estado: EstadoPago;
  loPagaElCliente?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant="secondary" className={COLOR_PAGO[estado]}>
        {ETIQUETA_PAGO[estado]}
      </Badge>
      {loPagaElCliente && (
        <Badge variant="secondary" className="bg-sky-100 text-sky-800">
          Lo paga el cliente
        </Badge>
      )}
    </span>
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
   * Opcional a propósito: la página de contabilidad es de servidor y no
   * puede pasar funciones a un componente cliente. Allí solo se mira.
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
    <div className="space-y-0.5">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-violet-700 hover:underline"
          title={nombre ?? etiqueta}
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="max-w-[9rem] truncate">{etiqueta}</span>
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

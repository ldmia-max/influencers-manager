"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
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
 * El vencimiento: los dias que faltan para cumplir los 60 desde la
 * cuenta de cobro. Cuenta hacia abajo; la hoja contaba hacia arriba y
 * obligaba a restar de cabeza.
 *
 * Rojo desde que quedan 10 y hasta que se pague, que es la regla que
 * llevaban a mano —y se les escapaban filas.
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

  // Pagado, la cuenta atras ya no dice nada.
  if (pagado) return <span className="text-gray-300">—</span>;

  const restantes = DIAS_DE_PLAZO - dias;
  const texto = vencido
    ? `Vencida hace ${-restantes} ${-restantes === 1 ? "día" : "días"}`
    : restantes === 0
      ? "Vence hoy"
      : `${restantes} ${restantes === 1 ? "día" : "días"}`;

  if (avisar) {
    return (
      <span className="flex items-center gap-1 whitespace-nowrap font-semibold tabular-nums text-red-600">
        {vencido && <AlertTriangle className="h-3 w-3 shrink-0" />}
        {texto}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap tabular-nums text-gray-700">{texto}</span>
  );
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

/**
 * Los papeles sueltos de un pago: los que no tienen hueco propio.
 *
 * A diferencia de `Adjunto`, aquí se suman en vez de reemplazarse, así
 * que cada uno necesita su propio enlace y su propia papelera. El
 * nombre del archivo es lo único que dice qué es —no se pide una
 * descripción—, de modo que se muestra entero en vez de una etiqueta
 * fija: "ARL" o "RUT" se entienden solos, "otro" no.
 */
export function Otros({
  documentos,
  puedeEditar,
  onAnadir,
  onQuitar,
}: {
  documentos: { id: string; url: string; nombre: string }[];
  puedeEditar?: boolean;
  /** Ausentes en la vista de contabilidad, que solo mira. */
  onAnadir?: (doc: { url: string; nombre: string }) => Promise<void>;
  onQuitar?: (id: string) => Promise<void>;
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
      await onAnadir?.(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-0.5">
      {documentos.length === 0 ? (
        <span className="text-gray-400">sin otros</span>
      ) : (
        documentos.map((d) => (
          <span key={d.id} className="flex items-center gap-1">
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1 text-violet-700 hover:underline"
              title={d.nombre}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="max-w-[9rem] truncate">{d.nombre}</span>
            </a>
            {puedeEditar && onQuitar && (
              <button
                type="button"
                title="Quitar este documento"
                className="shrink-0 text-gray-300 hover:text-red-600"
                onClick={() => onQuitar(d.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </span>
        ))
      )}

      {puedeEditar && onAnadir && (
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-violet-700 hover:underline">
          {subiendo ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Paperclip className="h-3 w-3" />
          )}
          Añadir otro
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

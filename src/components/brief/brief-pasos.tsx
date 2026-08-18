"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasoBrief {
  numero: string;
  titulo: string;
  /** Titulo corto para el indicador; el largo no cabe en nueve vagones. */
  corto: string;
  /** Campos del esquema que valida este paso antes de dejar avanzar. */
  campos: string[];
}

interface Props {
  pasos: PasoBrief[];
  actual: number;
  /** Hasta donde ha llegado, para permitir volver sin repetir validaciones. */
  maxVisitado: number;
  onIr: (indice: number) => void;
}

/**
 * Indicador de progreso del brief.
 *
 * Sustituye al scroll continuo de nueve secciones, que hacia parecer el
 * formulario mas largo de lo que es y desanimaba a rellenarlo.
 *
 * Solo se puede saltar a pasos ya visitados. Hacia adelante hay que
 * pasar por la validacion de cada paso, o el indicador serviria para
 * esquivarla.
 *
 * En movil no caben nueve vagones: se muestra la barra de avance y el
 * paso actual con su titulo, que es la informacion que importa.
 */
export function BriefPasos({ pasos, actual, maxVisitado, onIr }: Props) {
  const porcentaje = (actual / (pasos.length - 1)) * 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:px-6">
      {/* --- Movil --- */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-gray-900">
            <span className="text-[#E1145F]">{pasos[actual].numero}</span>{" "}
            {pasos[actual].titulo}
          </span>
          <span className="text-xs text-gray-500">
            {actual + 1} de {pasos.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#E1145F] transition-all duration-300"
            style={{ width: `${((actual + 1) / pasos.length) * 100}%` }}
          />
        </div>
      </div>

      {/* --- Escritorio --- */}
      <div className="relative hidden items-start justify-between sm:flex">
        <div className="absolute left-0 top-3.5 h-0.5 w-full bg-gray-200" />
        <div
          className="absolute left-0 top-3.5 h-0.5 bg-[#E1145F] transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />

        {pasos.map((paso, i) => {
          const completado = i < actual;
          const alcanzable = i <= maxVisitado;

          return (
            <button
              key={paso.numero}
              type="button"
              disabled={!alcanzable}
              onClick={() => alcanzable && onIr(i)}
              className={cn(
                "relative z-10 flex flex-1 flex-col items-center gap-1.5",
                alcanzable ? "cursor-pointer" : "cursor-not-allowed"
              )}
              title={paso.titulo}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                  i === actual
                    ? "bg-[#E1145F] text-white shadow-sm shadow-[#E1145F]/40"
                    : completado
                    ? "bg-[#E1145F]/85 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {completado ? <Check className="size-3.5" /> : paso.numero}
              </span>
              <span
                className={cn(
                  "px-1 text-center text-[11px] font-medium leading-tight",
                  i === actual
                    ? "text-[#E1145F]"
                    : completado
                    ? "text-gray-600"
                    : "text-gray-400"
                )}
              >
                {paso.corto}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Check, X } from "lucide-react";

/**
 * El par de botones con el que el cliente decide: Aprobar o Rechazar.
 *
 * Sustituye al interruptor que habia antes. Un interruptor verde
 * obliga a deducir que significa cada posicion —y, apagado, no dice si
 * esta rechazado o simplemente sin mirar—, mientras que dos botones
 * nombran las dos decisiones y el color solo las acompana.
 *
 * El que esta elegido se pinta relleno; el otro queda tenue, de modo
 * que el estado se lee de un vistazo sin tener que recordar el codigo
 * de colores.
 *
 * Vive aparte porque lo usan los tres niveles que el cliente aprueba
 * —el creador, su red y cada formato— y tres copias de esto acabarian
 * comportandose distinto.
 */
export function AprobarRechazar({
  aprobado,
  onCambio,
  disabled = false,
  tamano = "normal",
  etiqueta,
}: {
  aprobado: boolean;
  onCambio: (aprobado: boolean) => void;
  disabled?: boolean;
  /** "pequeno" para los formatos, que van anidados y en lista. */
  tamano?: "normal" | "pequeno";
  /** Que se esta decidiendo, para quien navega con lector de pantalla. */
  etiqueta: string;
}) {
  const pequeno = tamano === "pequeno";
  const base = `inline-flex items-center gap-1 rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
    pequeno ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
  }`;
  const icono = pequeno ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    // Los botones viven dentro de cabeceras que se pliegan al pulsarlas,
    // asi que el clic no debe llegar al contenedor.
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={etiqueta}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={aprobado}
        onClick={() => onCambio(true)}
        className={`${base} ${
          aprobado
            ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
            : "border-gray-300 bg-white text-gray-500 hover:border-green-300 hover:text-green-700"
        }`}
      >
        <Check className={icono} />
        Aprobar
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={!aprobado}
        onClick={() => onCambio(false)}
        className={`${base} ${
          !aprobado
            ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
            : "border-gray-300 bg-white text-gray-500 hover:border-red-300 hover:text-red-700"
        }`}
      >
        <X className={icono} />
        Rechazar
      </button>
    </div>
  );
}

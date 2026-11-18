"use client";

import { Loader2, Mail } from "lucide-react";
import { ZONA_AGENCIA } from "@/lib/fechas-agencia";

/**
 * El boton que avisa a contabilidad de que se puede pagar.
 *
 * Apagado hasta que estan los tres documentos obligatorios. Se puede
 * pulsar las veces que haga falta: si el correo no llega, se vuelve a
 * mandar, y la fecha de "Envió" se mueve con cada envio que sale bien.
 */
export function BotonAvisoDePago({
  completo,
  puedeAvisar,
  enviando,
  yaEnviado,
  onEnviar,
}: {
  /** Cuenta de cobro, certificado y contrato subidos. */
  completo: boolean;
  puedeAvisar: boolean;
  enviando: boolean;
  yaEnviado: boolean;
  onEnviar: () => void;
}) {
  const titulo = !puedeAvisar
    ? "No tienes permiso para avisar a contabilidad"
    : !completo
      ? "Faltan documentos obligatorios: cuenta de cobro, certificado bancario y contrato"
      : yaEnviado
        ? "Volver a avisar a contabilidad de que se puede pagar"
        : "Avisar a contabilidad de que se puede pagar";

  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={!completo || !puedeAvisar || enviando}
      onClick={onEnviar}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-marca/40 text-marca transition-colors hover:bg-marca hover:text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent"
    >
      {enviando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/**
 * Cuando se aviso por ultima vez, con la hora: si se reenvia el mismo
 * dia, solo la hora dice que el segundo envio se hizo.
 *
 * La zona se fija a la de la agencia para que servidor y navegador
 * escriban la misma hora al hidratar.
 */
export function FechaAvisoDePago({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="text-gray-400">—</span>;
  const d = new Date(fecha);
  return (
    <>
      <p className="text-gray-900">
        {d.toLocaleDateString("es-CO", { timeZone: ZONA_AGENCIA })}
      </p>
      <p className="text-[11px] text-gray-400">
        {d.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: ZONA_AGENCIA,
        })}
      </p>
    </>
  );
}

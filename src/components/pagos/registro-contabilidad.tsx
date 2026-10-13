"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiPatch } from "@/services/api";

/**
 * Lo que anota contabilidad sobre un pago: el consecutivo de su sistema
 * y, si hace falta, la fecha de la cuenta de cobro.
 *
 * Va por su propia ruta de API, no por la de la documentacion, para que
 * la separacion entre las dos areas la haga el servidor y no la
 * pantalla.
 *
 * Al guardar recarga: el estado y el plazo son calculados y cambian con
 * el dato que acaba de entrar, y `router.refresh()` no repinta en la
 * compilacion de produccion.
 */
export function RegistroContabilidad({
  campaignProfileId,
  documento,
  fechaCuentaCobro,
}: {
  campaignProfileId: string;
  documento: string | null;
  fechaCuentaCobro: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [doc, setDoc] = useState(documento ?? "");
  const [fecha, setFecha] = useState(fechaCuentaCobro?.slice(0, 10) ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await apiPatch(`/api/pagos/${campaignProfileId}/registro`, {
        documento: doc.trim() || null,
        fechaCuentaCobro: fecha || null,
      });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar");
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <div className="flex items-start gap-1">
        <span className={documento ? "" : "text-gray-400"}>
          {documento || "sin registrar"}
        </span>
        <button
          type="button"
          title="Registrar"
          className="text-gray-400 hover:text-violet-700"
          onClick={() => {
            setDoc(documento ?? "");
            setFecha(fechaCuentaCobro?.slice(0, 10) ?? "");
            setError(null);
            setEditando(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        autoFocus
        placeholder="Documento"
        value={doc}
        onChange={(e) => setDoc(e.target.value)}
        maxLength={100}
        className="h-7 w-32 text-xs"
      />
      <Input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        className="h-7 w-36 text-xs"
        title="Fecha de la cuenta de cobro"
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Guardar"
          className="text-violet-700 hover:text-violet-900 disabled:opacity-40"
          disabled={guardando}
          onClick={guardar}
        >
          {guardando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          title="Cancelar"
          className="text-gray-400 hover:text-gray-700"
          onClick={() => setEditando(false)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="max-w-[14rem] text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Rocket, CheckCheck, XCircle, AlertCircle } from "lucide-react";

/**
 * Acciones sobre un brief: convertirlo en campana o cambiar su estado.
 * Al convertir se navega directamente a la campana creada.
 */
export function BriefActions({
  briefId,
  status,
  campaignId,
}: {
  briefId: string;
  status: string;
  campaignId: string | null;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function convertir() {
    setCargando("convertir");
    setError("");
    try {
      const res = await fetch(`/api/briefs/${briefId}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo convertir el brief");
        return;
      }
      router.push(`/campaigns/${json.campaignId}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(null);
    }
  }

  async function cambiarEstado(nuevo: string) {
    setCargando(nuevo);
    setError("");
    try {
      const res = await fetch(`/api/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nuevo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo actualizar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(null);
    }
  }

  if (status === "CONVERTIDO" && campaignId) {
    return (
      <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}`)}>
        <Rocket className="mr-2 h-4 w-4" />
        Ver campaña creada
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={convertir} disabled={cargando !== null}>
          <Rocket className="mr-2 h-4 w-4" />
          {cargando === "convertir" ? "Creando campaña…" : "Crear campaña"}
        </Button>

        {status !== "REVISADO" && (
          <Button variant="outline" disabled={cargando !== null}
            onClick={() => cambiarEstado("REVISADO")}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar revisado
          </Button>
        )}

        {status !== "DESCARTADO" && (
          <Button variant="outline" disabled={cargando !== null}
            onClick={() => cambiarEstado("DESCARTADO")}>
            <XCircle className="mr-2 h-4 w-4" />
            Descartar
          </Button>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { decidirPorElCliente } from "@/services/campaign";

/**
 * Aprobar o rechazar a un influencer pendiente en nombre del cliente.
 *
 * Para cuando el cliente contesta por otra via —correo, WhatsApp, una
 * reunion— y no va a abrir su enlace. Hace lo mismo que el portal con
 * ese influencer: si era el ultimo pendiente de una campana en Revision,
 * la campana avanza como si hubiera contestado el cliente.
 *
 * Pide confirmacion tambien al aprobar: es comprometer un gasto que el
 * cliente no ha firmado, y queda auditado con el nombre de quien pulso.
 *
 * Recarga la pagina al terminar: cambia el estado del influencer, el
 * total, y puede cambiar la etapa de la campana. `router.refresh()` no
 * repinta en produccion.
 */
export function DecidirInfluencer({
  campaignId,
  perfilId,
  nombre,
  esElUltimo,
  enRevision,
}: {
  campaignId: string;
  perfilId: string;
  nombre: string;
  /** No queda nadie mas pendiente: decidirlo mueve la etapa. */
  esElUltimo: boolean;
  enRevision: boolean;
}) {
  const [modo, setModo] = useState<"aprobar" | "rechazar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    if (ocupado) return;
    setModo(null);
    setMotivo("");
    setError(null);
  };

  const confirmar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await decidirPorElCliente(campaignId, {
        tipo: "influencer",
        campaignProfileId: perfilId,
        aprobado: modo === "aprobar",
        motivo: modo === "rechazar" ? motivo : null,
      });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
      setOcupado(false);
    }
  };

  // Lo que pasara con la campana, dicho antes de pulsar.
  const consecuencia =
    enRevision && esElUltimo
      ? modo === "aprobar"
        ? "Es el último pendiente: la campaña pasará a En proceso."
        : "Es el último pendiente: si no queda nadie aprobado, la campaña vuelve a Abierta; si hay alguno, pasa a En proceso."
      : null;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-green-300 text-green-700 hover:bg-green-50"
          onClick={() => setModo("aprobar")}
        >
          <Check className="mr-1 h-4 w-4" />
          Aprobar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => setModo("rechazar")}
        >
          <X className="mr-1 h-4 w-4" />
          Rechazar
        </Button>
      </div>

      <Dialog open={modo !== null} onOpenChange={(o) => !o && cerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modo === "aprobar" ? "Aprobar" : "Rechazar"} a {nombre} por el
              cliente
            </DialogTitle>
            <DialogDescription>
              {modo === "aprobar"
                ? "Se aprueba con los formatos que estén marcados como aprobados. Queda registrado que lo aprobaste tú, en nombre del cliente."
                : "Queda registrado que lo rechazaste tú, en nombre del cliente, con el motivo que escribas."}
            </DialogDescription>
          </DialogHeader>

          {modo === "rechazar" && (
            <div className="space-y-2">
              <Label htmlFor={`motivo-${perfilId}`}>Motivo del rechazo</Label>
              <Textarea
                id={`motivo-${perfilId}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Lo que dijo el cliente"
                rows={3}
              />
            </div>
          )}

          {consecuencia && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {consecuencia}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={ocupado || (modo === "rechazar" && !motivo.trim())}
              className={
                modo === "aprobar"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {modo === "aprobar" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Aprobar o rechazar un formato de un influencer pendiente.
 *
 * Se guarda al pulsar y se pinta desde el estado local: no hace falta
 * recargar, porque marcar un formato no cambia nada mas de la ficha
 * hasta que se decide al influencer. Los formatos nacen aprobados —es lo
 * que se propuso—, igual que en el portal.
 */
export function DecidirFormato({
  campaignId,
  servicioId,
  aprobadoInicial,
}: {
  campaignId: string;
  servicioId: string;
  aprobadoInicial: boolean;
}) {
  const [aprobado, setAprobado] = useState(aprobadoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marcar = async (valor: boolean) => {
    if (valor === aprobado || ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      await decidirPorElCliente(campaignId, {
        tipo: "formato",
        servicioId,
        aprobado: valor,
      });
      setAprobado(valor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="group"
        aria-label="Aprobar o rechazar el formato"
        className="inline-flex items-center gap-1"
      >
        <Button
          size="sm"
          variant="outline"
          aria-pressed={aprobado}
          disabled={ocupado}
          onClick={() => marcar(true)}
          className={cn(
            "h-7 px-2 text-xs",
            aprobado && "border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white"
          )}
        >
          <Check className="mr-1 h-3 w-3" />
          Aprobar
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={!aprobado}
          disabled={ocupado}
          onClick={() => marcar(false)}
          className={cn(
            "h-7 px-2 text-xs",
            !aprobado && "border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white"
          )}
        >
          <X className="mr-1 h-3 w-3" />
          Rechazar
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

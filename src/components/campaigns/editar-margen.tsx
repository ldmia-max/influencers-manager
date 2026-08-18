"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiPatch } from "@/services/api";

interface Props {
  campaignId: string;
  /** Margen actual en tanto por uno (0.4 = 40%). */
  markupActual: number;
  /** Si la campana ya fue enviada al cliente, se avisa al cambiarlo. */
  yaEnviadaAlCliente: boolean;
}

/**
 * Ajuste del margen de UNA campana. Solo se pinta para ADMIN.
 *
 * El margen queda congelado al crear la campana; esto permite
 * repreciarla despues, que es el caso de una renegociacion. Se muestra
 * en porcentaje porque es como se habla de el, pero viaja en tanto por
 * uno, que es como se guarda.
 */
export function EditarMargen({
  campaignId,
  markupActual,
  yaEnviadaAlCliente,
}: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [porcentaje, setPorcentaje] = useState(
    String(Math.round(markupActual * 1000) / 10)
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valor = Number(porcentaje.replace(",", "."));
  const valido = Number.isFinite(valor) && valor >= 0 && valor <= 500;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await apiPatch(`/api/campaigns/${campaignId}/markup`, {
        markupPercentage: valor / 100,
      });
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-0.5 text-xs"
        onClick={() => setAbierto(true)}
      >
        <Pencil className="mr-1 h-3 w-3" />
        Ajustar
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Margen de esta campaña</DialogTitle>
            <DialogDescription>
              Solo afecta a esta campaña. El margen general de la aplicación no
              cambia, y las demás campañas conservan el suyo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="margen">Porcentaje</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="margen"
                  inputMode="decimal"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  className="w-32"
                  disabled={guardando}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              {!valido && porcentaje !== "" && (
                <p className="text-xs text-red-600">
                  Debe ser un número entre 0 y 500.
                </p>
              )}
            </div>

            {yaEnviadaAlCliente && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Esta campaña ya se envió al cliente. Si cambias el margen, las
                cifras que verá al abrir su enlace no serán las que aprobó.
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAbierto(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!valido || guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

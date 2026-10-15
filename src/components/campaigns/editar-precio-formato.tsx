"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PriceInput } from "@/components/ui/price-input";
import { formatNumber } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import { apiPatch } from "@/services/api";

/**
 * Repreciar un formato ya contratado.
 *
 * La campana en marcha no se edita, pero el precio de un formato si se
 * renegocia: el cliente comenta el importe, o el influencer sube su
 * tarifa. Antes la unica salida era cancelar la campana y rehacerla.
 *
 * Se piden los dos precios y van enlazados, porque las dos
 * conversaciones que llevan aqui hablan de numeros distintos: con el
 * influencer se habla de lo que el cobra —la base— y con el cliente,
 * de lo que paga. Dejar solo uno obligaria a dividir a mano por el
 * margen, y esa division hecha a ojo acaba en un precio descuadrado.
 *
 * Lo que viaja al servidor es siempre la base: es lo que cobra el
 * influencer y lo que contabilidad le paga.
 */
export function EditarPrecioFormato({
  campaignId,
  servicioId,
  nombre,
  basePriceActual,
  cantidad,
  markup,
  yaAprobado,
}: {
  campaignId: string;
  servicioId: string;
  nombre: string;
  basePriceActual: number;
  cantidad: number;
  markup: number;
  /** El cliente ya dijo que si a este importe. */
  yaAprobado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [base, setBase] = useState(String(Math.round(basePriceActual)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PriceInput emite digitos pelados, sin separadores.
  const valor = Number(base || "0");
  const valido = Number.isFinite(valor) && valor > 0;
  const alCliente = valido ? calculateMarkupPrice(valor, markup) : 0;

  const alEditarCliente = (digitos: string) => {
    const n = Number(digitos || "0");
    // Al reves: del precio del cliente se baja a la base quitando el
    // margen. Se redondea aqui para que lo que se guarda sea un importe
    // limpio y no arrastre decimales de la division.
    setBase(n > 0 ? String(Math.round(n / (1 + markup))) : "");
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await apiPatch(
        `/api/campaigns/${campaignId}/formatos/${servicioId}/precio`,
        { basePrice: valor }
      );
      // Recarga entera, no router.refresh(): el precio mueve el
      // subtotal del influencer, el total de la campana, la barra de
      // presupuesto y lo que vera contabilidad. Repintar solo esta fila
      // dejaria el resto diciendo lo anterior.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el precio");
      setGuardando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Cambiar el precio de este formato"
        className="rounded p-1 text-gray-400 hover:bg-accent/10 hover:text-gray-700"
        onClick={() => {
          setBase(String(Math.round(basePriceActual)));
          setError(null);
          setAbierto(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <Dialog open={abierto} onOpenChange={(v) => !guardando && setAbierto(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Precio de {nombre}</DialogTitle>
            <DialogDescription>
              Escribe cualquiera de los dos: el otro se recalcula con el margen
              del {Math.round(markup * 1000) / 10}% de esta campaña.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="precio-base">
                Precio base{" "}
                <span className="font-normal text-gray-500">
                  — lo que cobra el influencer
                </span>
              </Label>
              <PriceInput
                id="precio-base"
                value={base}
                onChange={setBase}
                disabled={guardando}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="precio-cliente">
                Precio al cliente{" "}
                <span className="font-normal text-gray-500">
                  — con el margen incluido
                </span>
              </Label>
              <PriceInput
                id="precio-cliente"
                value={valido ? String(Math.round(alCliente)) : ""}
                onChange={alEditarCliente}
                disabled={guardando}
              />
            </div>

            {cantidad > 1 && valido && (
              <p className="text-xs text-gray-500">
                Son {cantidad} unidades: el subtotal del cliente pasa a $
                {formatNumber(Math.round(alCliente * cantidad))}.
              </p>
            )}

            {/* Cambiar un importe que el cliente ya acepto no es lo
                mismo que ajustar un borrador: conviene decirlo antes,
                no despues. */}
            {yaAprobado && (
              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                El cliente ya aprobó este formato a $
                {formatNumber(Math.round(calculateMarkupPrice(basePriceActual, markup)))}
                . El cambio queda registrado con tu nombre.
              </p>
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
            <Button onClick={guardar} disabled={guardando || !valido}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

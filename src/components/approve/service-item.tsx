"use client";

import { Input } from "@/components/ui/input";
import { AprobarRechazar } from "./aprobar-rechazar";
import { formatNumber } from "@/lib/format";

interface ServiceItemProps {
  id: string;
  serviceName: string;
  quantity: number;
  /**
   * Importe unitario que paga el cliente, con el margen ya aplicado.
   *
   * Llega hecho desde el servidor. Antes bajaban el precio base y el
   * margen de la campana y la multiplicacion se hacia aqui, de modo que
   * el navegador del cliente tenia delante los dos numeros que revelan
   * cuanto carga la agencia encima.
   */
  precio: number;
  currency: string;
  isApproved: boolean;
  clientNotes?: string;
  onToggle: (id: string, isApproved: boolean) => void;
  onNotesChange?: (id: string, notes: string) => void;
  disabled?: boolean;
}

export function ServiceItem({
  id,
  serviceName,
  quantity,
  precio,
  currency,
  isApproved,
  clientNotes,
  onToggle,
  onNotesChange,
  disabled = false,
}: ServiceItemProps) {
  const total = precio * quantity;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between py-2 px-3 rounded-md transition-colors ${
          isApproved ? "bg-white" : "bg-red-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <AprobarRechazar
            aprobado={isApproved}
            onCambio={(v) => onToggle(id, v)}
            disabled={disabled}
            tamano="pequeno"
            etiqueta={`Aprobar o rechazar ${serviceName}`}
          />
          {/* El nombre ya no alterna nada al pulsarlo: la decision esta
              en los dos botones y tenerla tambien aqui haria que un
              clic para leer el formato lo rechazara sin querer. */}
          <span
            className={`text-sm ${
              !isApproved ? "line-through text-muted-foreground" : ""
            }`}
          >
            {serviceName}
            {quantity > 1 && (
              <span className="text-muted-foreground"> x{quantity}</span>
            )}
          </span>
        </div>
        <span
          className={`text-sm font-medium ${
            !isApproved ? "line-through text-muted-foreground" : ""
          }`}
        >
          ${formatNumber(Math.round(total))} {currency}
        </span>
      </div>
      {isApproved && onNotesChange && (
        <div className="px-3 pb-1">
          <Input
            placeholder="Describe de qué tratará este formato (opcional)"
            value={clientNotes ?? ""}
            onChange={(e) => onNotesChange(id, e.target.value)}
            disabled={disabled}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

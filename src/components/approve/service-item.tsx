"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";

interface ServiceItemProps {
  id: string;
  serviceName: string;
  quantity: number;
  basePrice: number;
  currency: string;
  /**
   * Margen congelado de la campana. Se propaga desde el portal en vez
   * de leer la constante global: una campana antigua debe seguir
   * mostrando el margen con el que se aprobo.
   */
  markup: number;
  isApproved: boolean;
  clientNotes?: string;
  onToggle: (id: string, isApproved: boolean) => void;
  onNotesChange?: (id: string, notes: string) => void;
  disabled?: boolean;
}

export function ServiceItem({
  markup,
  id,
  serviceName,
  quantity,
  basePrice,
  currency,
  isApproved,
  clientNotes,
  onToggle,
  onNotesChange,
  disabled = false,
}: ServiceItemProps) {
  const markupPrice = calculateMarkupPrice(basePrice, markup);
  const total = markupPrice * quantity;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between py-2 px-3 rounded-md transition-colors ${
          isApproved ? "bg-white" : "bg-red-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            id={`service-${id}`}
            checked={isApproved}
            onCheckedChange={(checked) => onToggle(id, checked === true)}
            disabled={disabled}
          />
          <label
            htmlFor={`service-${id}`}
            className={`text-sm cursor-pointer ${
              !isApproved ? "line-through text-muted-foreground" : ""
            }`}
          >
            {serviceName}
            {quantity > 1 && (
              <span className="text-muted-foreground"> x{quantity}</span>
            )}
          </label>
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

import { cn } from "@/lib/utils";

/**
 * La barra de uso del presupuesto.
 *
 * Nacio dentro del asistente de creacion y la ficha la repetia de
 * memoria, asi que los umbrales podian separarse sin que nadie lo
 * notara: la misma campana se veria verde en una pantalla y amarilla
 * en la otra. Vive aqui para que ambas digan lo mismo.
 */
export function colorDeBarra(porcentaje: number) {
  if (porcentaje <= 50) return "bg-green-500";
  if (porcentaje <= 80) return "bg-yellow-500";
  return "bg-red-500";
}

export function colorDeTexto(porcentaje: number) {
  if (porcentaje <= 50) return "text-green-600";
  if (porcentaje <= 80) return "text-yellow-600";
  return "text-red-600";
}

/** Sin presupuesto no hay porcentaje que calcular, ni division por cero. */
export function porcentajeUsado(total: number, presupuesto: number) {
  return presupuesto > 0 ? (total / presupuesto) * 100 : 0;
}

export function BarraPresupuesto({
  porcentaje,
  className,
}: {
  porcentaje: number;
  className?: string;
}) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-gray-200", className)}>
      {/* El relleno se corta en el 100%: pasado el presupuesto la barra
          ya no puede crecer mas, y cuanto se excedio lo dice la cifra
          de Excedente, no un rectangulo que se saliera de su carril. */}
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          colorDeBarra(porcentaje)
        )}
        style={{ width: `${Math.min(porcentaje, 100)}%` }}
      />
    </div>
  );
}

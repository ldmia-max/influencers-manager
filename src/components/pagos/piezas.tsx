"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import {
  COLOR_PAGO,
  DIAS_DE_PLAZO,
  ETIQUETA_PAGO,
  type EstadoPago,
} from "@/lib/pagos";

/**
 * Un importe. Cero se pinta en gris: no es lo mismo que una cifra.
 *
 * El signo se escribe aqui a mano porque formatNumber borra todo lo que
 * no sea digito —el menos incluido—, y un negativo pintado en positivo
 * no es un numero feo: es un numero que dice lo contrario. Un
 * presupuesto pasado se veria como presupuesto de sobra.
 */
export function Dinero({
  valor,
  destacado,
}: {
  valor: number;
  destacado?: boolean;
}) {
  const redondeado = Math.round(valor);
  return (
    <span
      className={
        redondeado === 0
          ? "text-gray-400"
          : redondeado < 0
            ? "font-semibold text-red-600"
            : destacado
              ? "font-semibold text-gray-900"
              : "text-gray-700"
      }
    >
      {redondeado < 0 ? "−" : ""}${formatNumber(Math.abs(redondeado))}
    </span>
  );
}

/**
 * Los dias que faltan para cumplir los 60 desde la cuenta de cobro.
 * Cuenta hacia abajo; la hoja contaba hacia arriba y obligaba a restar
 * de cabeza.
 *
 * Verde con mas de 10, naranja con 10 o menos, rojo con 1 o menos, y
 * pasado el plazo rojo y en negativo: "-3 días" son los que lleva
 * vencida.
 */
export function Vencimiento({
  dias,
  pagado,
}: {
  dias: number | null;
  pagado: boolean;
}) {
  if (dias === null) return <span className="text-gray-300">—</span>;

  // Pagado, la cuenta atras ya no dice nada.
  if (pagado) return <span className="text-gray-300">—</span>;

  const restantes = DIAS_DE_PLAZO - dias;
  const texto =
    restantes === 0
      ? "Vence hoy"
      : `${restantes < 0 ? "−" : ""}${Math.abs(restantes)} ${
          Math.abs(restantes) === 1 ? "día" : "días"
        }`;

  const color =
    restantes <= 1
      ? "font-semibold text-red-600"
      : restantes <= 10
        ? "font-semibold text-orange-600"
        : "text-green-700";

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${color}`}
      title={restantes < 0 ? `Vencida hace ${-restantes} días` : undefined}
    >
      {restantes < 0 && <AlertTriangle className="h-3 w-3 shrink-0" />}
      {texto}
    </span>
  );
}

export function EstadoBadge({
  estado,
  loPagaElCliente,
}: {
  estado: EstadoPago;
  loPagaElCliente?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge variant="secondary" className={COLOR_PAGO[estado]}>
        {ETIQUETA_PAGO[estado]}
      </Badge>
      {loPagaElCliente && (
        <Badge variant="secondary" className="bg-sky-100 text-sky-800">
          Lo paga el cliente
        </Badge>
      )}
    </span>
  );
}

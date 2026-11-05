"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodoLegible } from "@/lib/campaign-utils";

/**
 * Filtra la lista de campanas por el mes al que se imputan.
 *
 * En la URL y no en estado, como los filtros de /pagos: asi "las de
 * noviembre" se puede guardar en favoritos o mandar por chat, y la
 * pagina sigue siendo un componente de servidor que lee searchParams.
 *
 * Los meses que ofrece son los que de verdad existen en las campanas
 * que esa persona puede ver, no un calendario entero: un desplegable
 * con cuarenta meses vacios no ayuda a nadie.
 */
const TODOS = "__todos__";

export function FiltroMesCampana({
  periodos,
}: {
  /** "YYYY-MM", ya ordenados de mas reciente a mas antiguo. */
  periodos: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const poner = (valor: string) => {
    const siguiente = new URLSearchParams(params.toString());
    if (!valor || valor === TODOS) siguiente.delete("periodo");
    else siguiente.set("periodo", valor);
    // Cambiar de mes rehace la lista entera, asi que la pagina en la
    // que estuvieras ya no significa nada.
    siguiente.delete("page");
    router.push(`/campaigns?${siguiente.toString()}`);
  };

  const actual = params.get("periodo");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">Mes:</span>
      <Select value={actual ?? TODOS} onValueChange={poner}>
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los meses</SelectItem>
          {periodos.map((p) => {
            const [anio, mes] = p.split("-");
            return (
              <SelectItem key={p} value={p}>
                {periodoLegible(Number(anio), Number(mes))}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {actual && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-gray-500"
          onClick={() => poner(TODOS)}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Quitar
        </Button>
      )}
    </div>
  );
}

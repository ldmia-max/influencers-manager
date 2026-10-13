"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETIQUETA_PAGO, mesLegible } from "@/lib/pagos";

/**
 * Los filtros de la lista de pagos, en la URL.
 *
 * En searchParams y no en estado: asi un filtro se puede guardar en
 * favoritos o mandar por chat —"mirate los vencidos de agosto"— y la
 * pagina sigue siendo un componente de servidor que lee la URL, como
 * ya hace el listado de perfiles.
 */
const TODOS = "__todos__";

export function FiltrosPagos({
  clientes,
  meses,
}: {
  clientes: { id: string; nombre: string }[];
  meses: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const poner = (clave: string, valor: string | null) => {
    const siguiente = new URLSearchParams(params.toString());
    if (!valor || valor === TODOS) siguiente.delete(clave);
    else siguiente.set(clave, valor);
    router.push(`/pagos?${siguiente.toString()}`);
  };

  const hayFiltros = [...params.keys()].length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const campo = e.currentTarget.elements.namedItem(
            "texto"
          ) as HTMLInputElement;
          poner("texto", campo.value.trim() || null);
        }}
      >
        <Input
          name="texto"
          defaultValue={params.get("texto") ?? ""}
          placeholder="Influencer, campaña o cliente"
          className="h-8 w-60 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="h-8">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </form>

      <Select
        value={params.get("cliente") ?? TODOS}
        onValueChange={(v) => poner("cliente", v)}
      >
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los clientes</SelectItem>
          {clientes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("mes") ?? TODOS} onValueChange={(v) => poner("mes", v)}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los meses</SelectItem>
          {meses.map((m) => (
            <SelectItem key={m} value={m}>
              {mesLegible(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("estado") ?? TODOS}
        onValueChange={(v) => poner("estado", v)}
      >
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los estados</SelectItem>
          {Object.entries(ETIQUETA_PAGO).map(([clave, etiqueta]) => (
            <SelectItem key={clave} value={clave}>
              {etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant={params.get("vencidos") ? "default" : "outline"}
        className="h-8 text-xs"
        onClick={() => poner("vencidos", params.get("vencidos") ? null : "1")}
      >
        Solo vencidos
      </Button>

      {hayFiltros && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-gray-500"
          onClick={() => router.push("/pagos")}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Las secciones de la ficha de campana, repartidas en pestanas.
 *
 * Antes iban una debajo de otra y la pagina crecia sin parar: con los
 * formatos, las sustituciones, las entregas y el impacto, mirar el
 * presupuesto obligaba a subir por delante de todo lo demas.
 *
 * Los paneles llegan ya renderizados desde el servidor: este componente
 * solo decide cual se ve. Asi la ficha sigue siendo una sola peticion y
 * cambiar de pestana no vuelve a consultar la base de datos.
 *
 * Las pestanas que no aplican no se pintan: una campana que todavia no
 * arranco no tiene nada que entregar ni que medir, y una pestana vacia
 * invita a pulsarla para no encontrar nada.
 */
export interface PestanaCampana {
  valor: string;
  etiqueta: string;
  contenido: ReactNode;
}

export function CampaignTabs({ pestanas }: { pestanas: PestanaCampana[] }) {
  if (pestanas.length === 0) return null;

  return (
    <Tabs defaultValue={pestanas[0].valor} className="gap-4">
      {/* Las pestanas ocupan todo el ancho y se reparten en partes
          iguales: w-full en la lista mas el flex-1 que el boton ya
          trae. Sin barra de desplazamiento -- en pantallas estrechas
          la etiqueta parte en dos lineas (whitespace-normal) y la
          lista crece con ella (h-auto), en vez de esconder pestanas
          detras de un deslizamiento que no se ve que este ahi. */}
      <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto w-full">
        {pestanas.map((p) => (
          <TabsTrigger
            key={p.valor}
            value={p.valor}
            className="h-auto py-1.5 text-center whitespace-normal data-[state=active]:bg-marca data-[state=active]:text-white data-[state=inactive]:hover:bg-accent/10"
          >
            {p.etiqueta}
          </TabsTrigger>
        ))}
      </TabsList>

      {pestanas.map((p) => (
        <TabsContent key={p.valor} value={p.valor} className="space-y-6">
          {p.contenido}
        </TabsContent>
      ))}
    </Tabs>
  );
}

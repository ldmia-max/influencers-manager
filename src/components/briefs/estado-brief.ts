/** Presentacion de los estados de un brief, compartida entre pantallas. */
export const ESTADO_BRIEF: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  PENDIENTE: { label: "Pendiente", variant: "default" },
  REVISADO: { label: "Revisado", variant: "secondary" },
  CONVERTIDO: { label: "Convertido en campaña", variant: "outline" },
  DESCARTADO: { label: "Descartado", variant: "destructive" },
};

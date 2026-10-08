"use client";

import { useState } from "react";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cambiarParticipacion } from "@/services/entregas";
import { ORIGEN_LEGIBLE } from "@/lib/entregas";

/**
 * Retirar a un influencer de la campana, o devolverlo.
 *
 * Vive junto al perfil, en Perfiles y formatos, porque es una decision
 * sobre a quien se tiene contratado. Estaba en Entregas de contenido,
 * donde lo unico que se hace es anotar links de lo ya publicado.
 *
 * Al terminar recarga la pagina entera en vez de refrescar: retirar a
 * alguien cambia el total contratado, el presupuesto liberado y lo que
 * falta por entregar, repartido por media ficha. Adivinar cada pieza y
 * acertar en todas no sale a cuenta para una accion contada, y
 * `router.refresh()` ademas no repinta en la compilacion de produccion.
 */
export function RetirarInfluencer({
  campaignId,
  perfilId,
  nombre,
  retirado,
}: {
  campaignId: string;
  perfilId: string;
  nombre: string;
  retirado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
      setOcupado(false);
    }
  };

  if (retirado) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={ocupado}
          onClick={() =>
            ejecutar(() =>
              cambiarParticipacion(campaignId, perfilId, { accion: "reactivar" })
            )
          }
        >
          {ocupado ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-3.5 w-3.5" />
          )}
          Devolver a la campaña
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-gray-500 hover:text-red-600"
        onClick={() => {
          setOrigen("");
          setMotivo("");
          setError(null);
          setAbierto(true);
        }}
      >
        <UserMinus className="mr-2 h-3.5 w-3.5" />
        Retirar
      </Button>

      <Dialog open={abierto} onOpenChange={(v) => !v && setAbierto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar a {nombre}</DialogTitle>
            <DialogDescription>
              Sus importes dejarán de contar en el total, liberando ese
              presupuesto. El registro no se borra y el cliente no ve el motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>¿Quién lo decidió?</Label>
              <Select value={origen} onValueChange={setOrigen}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGEN_LEGIBLE).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo (interno, opcional)</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: no llegó a acuerdo de fechas"
                maxLength={500}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAbierto(false)}
              disabled={ocupado}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!origen || ocupado}
              onClick={() =>
                ejecutar(() =>
                  cambiarParticipacion(campaignId, perfilId, {
                    accion: "retirar",
                    origen: origen as "INFLUENCER" | "CLIENTE" | "AGENCIA",
                    motivo: motivo || null,
                  })
                )
              }
            >
              {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retirar de la campaña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

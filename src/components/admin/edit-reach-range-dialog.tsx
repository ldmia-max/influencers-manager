"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateReachRange } from "@/services/admin";

interface EditReachRangeDialogProps {
  reachRange: {
    id: string;
    name: string;
    displayName: string;
    minFollowers: number;
    maxFollowers: number | null;
    reachPercentage: number;
  };
}

export function EditReachRangeDialog({ reachRange }: EditReachRangeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(reachRange.name);
  const [displayName, setDisplayName] = useState(reachRange.displayName);
  const [minFollowers, setMinFollowers] = useState(reachRange.minFollowers.toString());
  const [maxFollowers, setMaxFollowers] = useState(reachRange.maxFollowers?.toString() || "");
  const [noMaxLimit, setNoMaxLimit] = useState(reachRange.maxFollowers === null);
  const [reachPercentage, setReachPercentage] = useState(reachRange.reachPercentage.toString());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const minVal = parseInt(minFollowers, 10);
    const maxVal = noMaxLimit ? null : parseInt(maxFollowers, 10);
    const percentVal = parseInt(reachPercentage, 10);

    if (isNaN(minVal) || isNaN(percentVal)) {
      setError("Valores numéricos inválidos");
      setLoading(false);
      return;
    }

    if (!noMaxLimit && (isNaN(maxVal as number) || (maxVal as number) <= minVal)) {
      setError("Los seguidores máximos deben ser mayor que los mínimos");
      setLoading(false);
      return;
    }

    try {
      await updateReachRange(reachRange.id, {
        name,
        displayName,
        minFollowers: minVal,
        maxFollowers: maxVal,
        reachPercentage: percentVal,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar rango");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Rango de Alcance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre (slug)</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Nombre visible</Label>
              <Input
                id="edit-displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-minFollowers">Seguidores Min</Label>
              <Input
                id="edit-minFollowers"
                type="number"
                min="0"
                value={minFollowers}
                onChange={(e) => setMinFollowers(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-maxFollowers">Seguidores Max</Label>
              <Input
                id="edit-maxFollowers"
                type="number"
                min="1"
                value={maxFollowers}
                onChange={(e) => setMaxFollowers(e.target.value)}
                disabled={noMaxLimit}
                required={!noMaxLimit}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-noMaxLimit"
              checked={noMaxLimit}
              onCheckedChange={(checked) => {
                setNoMaxLimit(checked === true);
                if (checked) setMaxFollowers("");
              }}
            />
            <Label htmlFor="edit-noMaxLimit" className="text-sm cursor-pointer">
              Sin limite maximo (infinito)
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-reachPercentage">% de Alcance</Label>
            <Input
              id="edit-reachPercentage"
              type="number"
              min="1"
              max="100"
              value={reachPercentage}
              onChange={(e) => setReachPercentage(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

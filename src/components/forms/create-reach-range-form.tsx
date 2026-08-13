"use client";

import { useState, useRef } from "react";
import { useCreateReachRange } from "@/hooks/mutations/use-admin-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function CreateReachRangeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [noMaxLimit, setNoMaxLimit] = useState(false);

  const createMutation = useCreateReachRange();
  const loading = createMutation.isPending;
  const error = validationError || createMutation.error?.message || null;
  const success = createMutation.isSuccess;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const displayName = formData.get("displayName") as string;
    const minFollowers = parseInt(formData.get("minFollowers") as string, 10);
    const maxFollowersStr = formData.get("maxFollowers") as string;
    const maxFollowers = noMaxLimit ? null : parseInt(maxFollowersStr, 10);
    const reachPercentage = parseInt(formData.get("reachPercentage") as string, 10);

    if (isNaN(minFollowers) || isNaN(reachPercentage)) {
      setValidationError("Valores numéricos inválidos");
      return;
    }

    if (!noMaxLimit && (isNaN(maxFollowers as number) || (maxFollowers as number) <= minFollowers)) {
      setValidationError("Los seguidores máximos deben ser mayor que los mínimos");
      return;
    }

    createMutation.mutate(
      { name, displayName, minFollowers, maxFollowers, reachPercentage },
      {
        onSuccess: () => {
          formRef.current?.reset();
          setNoMaxLimit(false);
        },
      },
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm">
          Rango de alcance creado exitosamente
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre (slug)</Label>
          <Input
            id="name"
            name="name"
            placeholder="Ej: nano, micro"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Nombre visible</Label>
          <Input
            id="displayName"
            name="displayName"
            placeholder="Ej: Nano Influencer"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="minFollowers">Seguidores Min</Label>
          <Input
            id="minFollowers"
            name="minFollowers"
            type="number"
            min="0"
            placeholder="0"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxFollowers">Seguidores Max</Label>
          <Input
            id="maxFollowers"
            name="maxFollowers"
            type="number"
            min="1"
            placeholder="100000"
            disabled={noMaxLimit}
            required={!noMaxLimit}
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="noMaxLimit"
          checked={noMaxLimit}
          onCheckedChange={(checked) => setNoMaxLimit(checked === true)}
        />
        <Label htmlFor="noMaxLimit" className="text-sm cursor-pointer">
          Sin limite maximo (infinito)
        </Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reachPercentage">% de Alcance</Label>
        <Input
          id="reachPercentage"
          name="reachPercentage"
          type="number"
          min="1"
          max="100"
          placeholder="40"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando..." : "Crear Rango"}
      </Button>
    </form>
  );
}

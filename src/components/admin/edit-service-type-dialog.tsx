"use client";

import { useState } from "react";
import { useEditServiceType } from "@/hooks/mutations/use-service-type-mutations";
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

interface EditServiceTypeDialogProps {
  serviceType: {
    id: string;
    name: string;
    displayName: string;
    profileTypes: string[];
    platformName: string;
  };
}

const PROFILE_TYPE_OPTIONS: { value: "INFLUENCER" | "UGC" | "BOTH"; label: string }[] = [
  { value: "INFLUENCER", label: "Influencer" },
  { value: "UGC", label: "UGC" },
];

export function EditServiceTypeDialog({ serviceType }: EditServiceTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(serviceType.displayName);
  const [profileTypes, setProfileTypes] = useState<("INFLUENCER" | "UGC" | "BOTH")[]>(serviceType.profileTypes as ("INFLUENCER" | "UGC" | "BOTH")[]);

  const updateMutation = useEditServiceType(serviceType.id);

  function handleProfileTypeChange(value: "INFLUENCER" | "UGC" | "BOTH", checked: boolean) {
    if (checked) {
      setProfileTypes([...profileTypes, value]);
    } else {
      setProfileTypes(profileTypes.filter((pt) => pt !== value));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (profileTypes.length === 0) {
      setValidationError("Debe seleccionar al menos un tipo de perfil");
      return;
    }

    updateMutation.mutate({ displayName, profileTypes }, {
      onSuccess: () => setOpen(false),
    });
  }

  const error = validationError || updateMutation.error?.message || null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Formato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Identificador</Label>
            <Input value={serviceType.name} disabled className="bg-gray-100" />
            <p className="text-xs text-gray-500">
              El identificador no se puede modificar
            </p>
          </div>
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Input value={serviceType.platformName} disabled className="bg-gray-100" />
            <p className="text-xs text-gray-500">
              La plataforma no se puede modificar
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-displayName">Nombre para Mostrar</Label>
            <Input
              id="edit-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Tipos de Perfil</Label>
            <div className="flex gap-4">
              {PROFILE_TYPE_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`edit-pt-${option.value}`}
                    checked={profileTypes.includes(option.value)}
                    onCheckedChange={(checked) =>
                      handleProfileTypeChange(option.value, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`edit-pt-${option.value}`}
                    className="font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

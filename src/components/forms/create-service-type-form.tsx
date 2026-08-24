"use client";

import { useState, useRef } from "react";
import { useCreateServiceType } from "@/hooks/mutations/use-admin-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Platform } from "@/models/admin";

interface CreateServiceTypeFormProps {
  platforms: Platform[];
}

export function CreateServiceTypeForm({ platforms }: CreateServiceTypeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [profileTypes, setProfileTypes] = useState<("INFLUENCER" | "UGC" | "BOTH")[]>(["INFLUENCER"]);
  const [esEfimero, setEsEfimero] = useState(false);

  const createMutation = useCreateServiceType();
  const loading = createMutation.isPending;
  const error = validationError || createMutation.error?.message || null;
  const success = createMutation.isSuccess;

  const toggleProfileType = (type: "INFLUENCER" | "UGC" | "BOTH") => {
    setProfileTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get("displayName") as string;
    const name = formData.get("name") as string;
    const platformId = formData.get("platformId") as string;

    if (profileTypes.length === 0) {
      setValidationError("Selecciona al menos un tipo de perfil");
      return;
    }

    createMutation.mutate(
      { displayName, name, platformId, profileTypes, esEfimero },
      {
        onSuccess: () => {
          formRef.current?.reset();
          setProfileTypes(["INFLUENCER"]);
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
          Formato creado exitosamente
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="displayName">Nombre para Mostrar</Label>
        <Input
          id="displayName"
          name="displayName"
          placeholder="Ej: Reel - Colaboración"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Identificador (slug)</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ej: reel_colaboracion"
          pattern="^[a-z0-9_]+$"
          title="Solo letras minúsculas, números y guion bajo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="platformId">Plataforma</Label>
        <Select name="platformId" required>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar plataforma" />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((platform) => (
              <SelectItem key={platform.id} value={platform.id}>
                {platform.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Tipos de Perfil</Label>
        <div className="flex flex-col gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="type-influencer"
              checked={profileTypes.includes("INFLUENCER")}
              onCheckedChange={() => toggleProfileType("INFLUENCER")}
            />
            <Label htmlFor="type-influencer" className="cursor-pointer">
              Influencer
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="type-ugc"
              checked={profileTypes.includes("UGC")}
              onCheckedChange={() => toggleProfileType("UGC")}
            />
            <Label htmlFor="type-ugc" className="cursor-pointer">
              UGC Creator
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="type-both"
              checked={profileTypes.includes("BOTH")}
              onCheckedChange={() => toggleProfileType("BOTH")}
            />
            <Label htmlFor="type-both" className="cursor-pointer">
              Ambos
            </Label>
          </div>
        </div>
      </div>

      {/* Sin esta marca, un formato como una story pediria un link que la
          plataforma no publica, y la campana no se podria cerrar nunca. */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="es-efimero"
            checked={esEfimero}
            onCheckedChange={(v) => setEsEfimero(v === true)}
          />
          <div>
            <Label htmlFor="es-efimero" className="cursor-pointer">
              No deja enlace permanente
            </Label>
            <p className="mt-0.5 text-xs text-gray-500">
              Márcalo en stories, directos y menciones en directo. La entrega se
              confirmará con la fecha de emisión en lugar de con un link, y no
              se le podrán leer métricas.
            </p>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando..." : "Crear Formato"}
      </Button>
    </form>
  );
}

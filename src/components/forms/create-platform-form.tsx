"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreatePlatform } from "@/hooks/mutations/use-admin-mutations";
import { createPlatformSchema, type CreatePlatformPayload } from "@/lib/schemas/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreatePlatformForm() {
  const createMutation = useCreatePlatform();

  const form = useForm<CreatePlatformPayload>({
    resolver: zodResolver(createPlatformSchema),
    defaultValues: { displayName: "", name: "" },
  });

  function onSubmit(data: CreatePlatformPayload) {
    createMutation.mutate(data, {
      onSuccess: () => form.reset(),
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {createMutation.error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {createMutation.error.message}
        </div>
      )}
      {createMutation.isSuccess && (
        <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm">
          Plataforma creada exitosamente
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="displayName">Nombre para Mostrar</Label>
        <Input
          id="displayName"
          placeholder="Ej: YouTube"
          {...form.register("displayName")}
        />
        {form.formState.errors.displayName && (
          <p className="text-xs text-red-500">{form.formState.errors.displayName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Identificador (slug)</Label>
        <Input
          id="name"
          placeholder="Ej: youtube"
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
        ) : (
          <p className="text-xs text-gray-500">Solo letras minúsculas, números y guion bajo</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creando..." : "Crear Plataforma"}
      </Button>
    </form>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCountry } from "@/hooks/mutations/use-admin-mutations";
import { createCountrySchema, type CreateCountryPayload } from "@/lib/schemas/location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCountryForm() {
  const createMutation = useCreateCountry();

  const form = useForm<CreateCountryPayload>({
    resolver: zodResolver(createCountrySchema),
    defaultValues: { name: "", code: "" },
  });

  function onSubmit(data: CreateCountryPayload) {
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
          País creado exitosamente
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del País</Label>
        <Input
          id="name"
          placeholder="Ej: Colombia"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">Código ISO</Label>
        <Input
          id="code"
          placeholder="Ej: CO"
          maxLength={3}
          {...form.register("code")}
        />
        {form.formState.errors.code ? (
          <p className="text-xs text-red-500">{form.formState.errors.code.message}</p>
        ) : (
          <p className="text-xs text-gray-500">Código ISO de 2 o 3 letras (ej: CO, ARG, MX)</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creando..." : "Crear País"}
      </Button>
    </form>
  );
}

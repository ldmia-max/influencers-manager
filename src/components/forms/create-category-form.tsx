"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCategory } from "@/hooks/mutations/use-category-mutations";
import { createCategorySchema, type CreateCategoryPayload } from "@/lib/schemas/category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCategoryForm() {
  const createMutation = useCreateCategory();

  const form = useForm<CreateCategoryPayload>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", description: "" },
  });

  function onSubmit(data: CreateCategoryPayload) {
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
          Categoría creada exitosamente
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          placeholder="Ej: Tecnología"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Input
          id="description"
          placeholder="Descripción de la categoría"
          {...form.register("description")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creando..." : "Crear Categoría"}
      </Button>
    </form>
  );
}

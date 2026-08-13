"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateDepartment } from "@/hooks/mutations/use-admin-mutations";
import { createDepartmentSchema, type CreateDepartmentPayload } from "@/lib/schemas/location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Country } from "@/models/admin";

interface CreateDepartmentFormProps {
  countries: Country[];
}

export function CreateDepartmentForm({ countries }: CreateDepartmentFormProps) {
  const createMutation = useCreateDepartment();

  const form = useForm<CreateDepartmentPayload>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: { name: "", countryId: "" },
  });

  function onSubmit(data: CreateDepartmentPayload) {
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
          Departamento creado exitosamente
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="countryId">País</Label>
        <Controller
          control={form.control}
          name="countryId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un país" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.name} ({country.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {form.formState.errors.countryId && (
          <p className="text-xs text-red-500">{form.formState.errors.countryId.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del Departamento</Label>
        <Input
          id="name"
          placeholder="Ej: Cundinamarca"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending || countries.length === 0}>
        {createMutation.isPending ? "Creando..." : "Crear Departamento"}
      </Button>
      {countries.length === 0 && (
        <p className="text-xs text-amber-600">
          Primero debes crear al menos un país
        </p>
      )}
    </form>
  );
}

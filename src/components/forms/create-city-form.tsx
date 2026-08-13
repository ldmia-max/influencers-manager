"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCity } from "@/hooks/mutations/use-admin-mutations";
import { createCitySchema, type CreateCityPayload } from "@/lib/schemas/location";
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
import type { Country, Department } from "@/models/admin";

interface CreateCityFormProps {
  countries: Country[];
  departments: Department[];
}

export function CreateCityForm({ countries, departments }: CreateCityFormProps) {
  const [countryId, setCountryId] = useState("");
  const createMutation = useCreateCity();

  const form = useForm<CreateCityPayload>({
    resolver: zodResolver(createCitySchema),
    defaultValues: { name: "", departmentId: "" },
  });

  const filteredDepartments = countryId
    ? departments.filter((d) => d.countryId === countryId)
    : [];

  function onSubmit(data: CreateCityPayload) {
    createMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        setCountryId("");
      },
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
          Ciudad creada exitosamente
        </div>
      )}
      <div className="space-y-2">
        <Label>País</Label>
        <Select
          value={countryId}
          onValueChange={(value) => {
            setCountryId(value);
            form.setValue("departmentId", "");
          }}
        >
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="departmentId">Departamento</Label>
        <Controller
          control={form.control}
          name="departmentId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!countryId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    countryId
                      ? "Selecciona un departamento"
                      : "Primero selecciona un país"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {form.formState.errors.departmentId && (
          <p className="text-xs text-red-500">{form.formState.errors.departmentId.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la Ciudad</Label>
        <Input
          id="name"
          placeholder="Ej: Bogotá"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending || departments.length === 0}>
        {createMutation.isPending ? "Creando..." : "Crear Ciudad"}
      </Button>
      {departments.length === 0 && (
        <p className="text-xs text-amber-600">
          Primero debes crear al menos un departamento
        </p>
      )}
    </form>
  );
}

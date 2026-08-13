import { z } from "zod";

// === Countries ===

export const createCountrySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  code: z.string().trim().min(1, "El código es requerido"),
});

export type CreateCountryPayload = z.infer<typeof createCountrySchema>;

export const patchCountrySchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
});

export type PatchCountryPayload = z.infer<typeof patchCountrySchema>;

// === Departments ===

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  countryId: z.string().min(1, "El país es requerido"),
});

export type CreateDepartmentPayload = z.infer<typeof createDepartmentSchema>;

export const patchDepartmentSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  countryId: z.string().min(1).optional(),
});

export type PatchDepartmentPayload = z.infer<typeof patchDepartmentSchema>;

// === Cities ===

export const createCitySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  departmentId: z.string().min(1, "El departamento es requerido"),
});

export type CreateCityPayload = z.infer<typeof createCitySchema>;

export const patchCitySchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  departmentId: z.string().min(1).optional(),
});

export type PatchCityPayload = z.infer<typeof patchCitySchema>;

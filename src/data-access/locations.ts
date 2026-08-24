import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { ValidationError } from "./errors";

// === Cached functions ===

export async function getCachedCountries() {
  "use cache";
  cacheLife("hours");
  cacheTag("countries");

  return prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getCachedDepartments(countryId?: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("departments");

  return prisma.department.findMany({
    where: {
      isActive: true,
      ...(countryId ? { countryId } : {}),
    },
    include: { country: true },
    orderBy: { name: "asc" },
  });
}

export async function getCachedCities(departmentId?: string, countryId?: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("cities");

  return prisma.city.findMany({
    where: {
      isActive: true,
      ...(departmentId ? { departmentId } : {}),
      ...(countryId ? { department: { countryId } } : {}),
    },
    include: {
      department: {
        include: { country: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

// === Countries ===

export async function getAllCountriesWithCounts() {
  return prisma.country.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { departments: true },
      },
    },
  });
}

export async function createCountry(name: string, code: string) {
  const existing = await prisma.country.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (existing) {
    throw new ValidationError("Ya existe un país con ese código");
  }

  const resultado = await prisma.country.create({
    data: {
      name,
      code: code.toUpperCase(),
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("countries", "hours");
  return resultado;
}

export async function patchCountry(
  id: string,
  data: { isActive?: boolean; name?: string; code?: string }
) {
  const resultado = await prisma.country.update({
    where: { id },
    data: {
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
      ...(data.name && { name: data.name }),
      ...(data.code && { code: data.code.toUpperCase() }),
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("countries", "hours");
  return resultado;
}

export async function updateCountry(
  id: string,
  data: { name: string; code: string }
) {
  const resultado = await prisma.country.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("countries", "hours");
  return resultado;
}

export async function deleteCountry(id: string) {
  const country = await prisma.country.findUnique({
    where: { id },
    include: {
      _count: {
        select: { departments: true },
      },
    },
  });

  if (country?._count.departments && country._count.departments > 0) {
    throw new ValidationError(
      "No se puede eliminar un país con departamentos asociados"
    );
  }

  await prisma.country.delete({ where: { id } });
  // Sin esto el borrado tarda hasta una hora en reflejarse en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("countries", "hours");
}

// === Departments ===

export async function getAllDepartmentsWithCountries(countryId?: string) {
  return prisma.department.findMany({
    where: countryId ? { countryId } : undefined,
    orderBy: { name: "asc" },
    include: {
      country: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: { cities: true },
      },
    },
  });
}

export async function createDepartment(name: string, countryId: string) {
  const existing = await prisma.department.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      countryId,
    },
  });

  if (existing) {
    throw new ValidationError(
      "Ya existe un departamento con ese nombre en este país"
    );
  }

  const resultado = await prisma.department.create({
    data: {
      name,
      countryId,
    },
    include: {
      country: {
        select: { id: true, name: true, code: true },
      },
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("departments", "hours");
  return resultado;
}

export async function patchDepartment(
  id: string,
  data: { isActive?: boolean; name?: string; countryId?: string }
) {
  const resultado = await prisma.department.update({
    where: { id },
    data: {
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
      ...(data.name && { name: data.name }),
      ...(data.countryId && { countryId: data.countryId }),
    },
    include: {
      country: {
        select: { id: true, name: true, code: true },
      },
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("departments", "hours");
  return resultado;
}

export async function updateDepartment(
  id: string,
  data: { name: string; countryId: string }
) {
  const resultado = await prisma.department.update({
    where: { id },
    data: {
      name: data.name,
      countryId: data.countryId,
    },
    include: {
      country: {
        select: { id: true, name: true, code: true },
      },
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("departments", "hours");
  return resultado;
}

export async function deleteDepartment(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: {
        select: { cities: true },
      },
    },
  });

  if (department?._count.cities && department._count.cities > 0) {
    throw new ValidationError(
      "No se puede eliminar un departamento con ciudades asociadas"
    );
  }

  await prisma.department.delete({ where: { id } });
  // Sin esto el borrado tarda hasta una hora en reflejarse en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("departments", "hours");
}

// === Cities ===

export async function getAllCitiesWithDepartments(filters?: {
  departmentId?: string;
  countryId?: string;
}) {
  return prisma.city.findMany({
    where: {
      ...(filters?.departmentId && { departmentId: filters.departmentId }),
      ...(filters?.countryId && {
        department: { countryId: filters.countryId },
      }),
    },
    orderBy: { name: "asc" },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          country: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });
}

export async function createCity(name: string, departmentId: string) {
  const existing = await prisma.city.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      departmentId,
    },
  });

  if (existing) {
    throw new ValidationError(
      "Ya existe una ciudad con ese nombre en este departamento"
    );
  }

  const resultado = await prisma.city.create({
    data: {
      name,
      departmentId,
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          country: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("cities", "hours");
  return resultado;
}

export async function patchCity(
  id: string,
  data: { isActive?: boolean; name?: string; departmentId?: string }
) {
  const resultado = await prisma.city.update({
    where: { id },
    data: {
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
      ...(data.name && { name: data.name }),
      ...(data.departmentId && { departmentId: data.departmentId }),
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          country: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("cities", "hours");
  return resultado;
}

export async function updateCity(
  id: string,
  data: { name: string; departmentId: string }
) {
  const resultado = await prisma.city.update({
    where: { id },
    data: {
      name: data.name,
      departmentId: data.departmentId,
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          country: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });
  // Sin esto el cambio tarda hasta una hora en aparecer en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("cities", "hours");
  return resultado;
}

export async function deleteCity(id: string) {
  await prisma.city.delete({ where: { id } });
  // Sin esto el borrado tarda hasta una hora en reflejarse en los
  // formularios, que leen la version cacheada de esta tabla.
  revalidateTag("cities", "hours");
}

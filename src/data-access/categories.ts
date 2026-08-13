import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { ValidationError, NotFoundError } from "./errors";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getCachedCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");

  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { profiles: true },
      },
    },
  });
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { profiles: true },
      },
      createdBy: {
        select: { name: true },
      },
    },
  });

  if (!category) {
    throw new NotFoundError("Categoría no encontrada");
  }

  return category;
}

export async function getCategoriesPaginated(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { profiles: true },
        },
        createdBy: {
          select: { name: true },
        },
      },
    }),
    prisma.category.count(),
  ]);

  return { categories, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createCategory(data: {
  name: string;
  description?: string;
  createdById: string;
}) {
  const slug = slugify(data.name);

  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ name: data.name }, { slug }],
    },
  });

  if (existing) {
    throw new ValidationError("Ya existe una categoría con ese nombre");
  }

  return prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      createdById: data.createdById,
    },
  });
}

export async function updateCategory(
  id: string,
  data: { name: string; description?: string; isActive?: boolean }
) {
  const slug = slugify(data.name);

  const existing = await prisma.category.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError("Categoría no encontrada");
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      AND: [
        { id: { not: id } },
        { OR: [{ name: data.name }, { slug }] },
      ],
    },
  });

  if (duplicate) {
    throw new ValidationError("Ya existe otra categoría con ese nombre");
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    },
  });

  revalidateTag("categories", "hours");
  return category;
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { profiles: true },
      },
    },
  });

  if (!category) {
    throw new NotFoundError("Categoría no encontrada");
  }

  if (category._count.profiles > 0) {
    throw new ValidationError(
      `No se puede eliminar la categoría porque tiene ${category._count.profiles} perfil${category._count.profiles !== 1 ? "es" : ""} asociado${category._count.profiles !== 1 ? "s" : ""}`
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidateTag("categories", "hours");
}

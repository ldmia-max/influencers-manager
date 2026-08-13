import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { ValidationError } from "./errors";

export async function getCachedPlatforms() {
  "use cache";
  cacheLife("hours");
  cacheTag("platforms");

  return prisma.socialPlatform.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });
}

export async function getAllPlatformsWithCounts() {
  return prisma.socialPlatform.findMany({
    orderBy: { displayName: "asc" },
    include: {
      _count: {
        select: { accounts: true, serviceTypes: true },
      },
    },
  });
}

export async function getActivePlatforms() {
  return prisma.socialPlatform.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });
}

export async function createPlatform(name: string, displayName: string) {
  const existing = await prisma.socialPlatform.findUnique({
    where: { name },
  });

  if (existing) {
    throw new ValidationError("Ya existe una plataforma con ese identificador");
  }

  return prisma.socialPlatform.create({
    data: {
      name: name.toLowerCase(),
      displayName,
    },
  });
}

export async function updatePlatform(
  id: string,
  data: { isActive?: boolean; displayName?: string }
) {
  return prisma.socialPlatform.update({
    where: { id },
    data: {
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
      ...(data.displayName && { displayName: data.displayName }),
    },
  });
}

export async function deletePlatform(id: string) {
  const platform = await prisma.socialPlatform.findUnique({
    where: { id },
    include: {
      _count: {
        select: { accounts: true },
      },
    },
  });

  if (platform?._count.accounts && platform._count.accounts > 0) {
    throw new ValidationError(
      "No se puede eliminar una plataforma con cuentas asociadas"
    );
  }

  await prisma.socialPlatform.delete({ where: { id } });
}

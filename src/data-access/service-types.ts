import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag } from "next/cache";
import type { ProfileType } from "@prisma/client";
import { ValidationError } from "./errors";

export async function getCachedServiceTypes() {
  "use cache";
  cacheLife("hours");
  cacheTag("service-types");

  return prisma.serviceType.findMany({
    orderBy: { displayName: "asc" },
  });
}

export async function getAllServiceTypesWithCounts() {
  return prisma.serviceType.findMany({
    orderBy: [{ platform: { displayName: "asc" } }, { displayName: "asc" }],
    include: {
      platform: true,
      _count: {
        select: { profileServices: true },
      },
    },
  });
}

export async function createServiceType(data: {
  name: string;
  displayName: string;
  platformId: string;
  profileTypes: ProfileType[];
}) {
  const existing = await prisma.serviceType.findUnique({
    where: {
      name_platformId: {
        name: data.name,
        platformId: data.platformId,
      },
    },
  });

  if (existing) {
    throw new ValidationError(
      "Ya existe un formato con ese nombre para esta plataforma"
    );
  }

  return prisma.serviceType.create({
    data: {
      name: data.name.toLowerCase(),
      displayName: data.displayName,
      platformId: data.platformId,
      profileTypes: data.profileTypes,
    },
    include: {
      platform: true,
    },
  });
}

export async function updateServiceType(
  id: string,
  data: { isActive?: boolean; displayName?: string; profileTypes?: ProfileType[] }
) {
  return prisma.serviceType.update({
    where: { id },
    data: {
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
      ...(data.displayName && { displayName: data.displayName }),
      ...(data.profileTypes && { profileTypes: data.profileTypes }),
    },
  });
}

export async function deleteServiceType(id: string) {
  const serviceType = await prisma.serviceType.findUnique({
    where: { id },
    include: {
      _count: {
        select: { profileServices: true },
      },
    },
  });

  if (
    serviceType?._count.profileServices &&
    serviceType._count.profileServices > 0
  ) {
    throw new ValidationError("No se puede eliminar un formato en uso");
  }

  await prisma.serviceType.delete({ where: { id } });
}

import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { ValidationError } from "./errors";

export async function getCachedReachRanges() {
  "use cache";
  cacheLife("hours");
  cacheTag("reach-ranges");

  return prisma.reachRange.findMany({
    where: { isActive: true },
    orderBy: { minFollowers: "asc" },
  });
}

export async function getAllReachRanges() {
  return prisma.reachRange.findMany({
    orderBy: { minFollowers: "asc" },
  });
}

export async function createReachRange(data: {
  name: string;
  displayName: string;
  minFollowers: number;
  maxFollowers: number | null;
  reachPercentage: number;
}) {
  if (data.reachPercentage < 0 || data.reachPercentage > 100) {
    throw new ValidationError("El porcentaje debe estar entre 0 y 100");
  }

  if (data.minFollowers < 0) {
    throw new ValidationError(
      "Los seguidores minimos deben ser mayor o igual a 0"
    );
  }

  if (data.maxFollowers !== null && data.maxFollowers <= data.minFollowers) {
    throw new ValidationError(
      "Los seguidores maximos deben ser mayor que los minimos"
    );
  }

  const existingRanges = await prisma.reachRange.findMany({
    where: { isActive: true },
  });

  for (const range of existingRanges) {
    const existingMin = range.minFollowers;
    const existingMax = range.maxFollowers;
    const newMin = data.minFollowers;
    const newMax = data.maxFollowers;

    const overlaps =
      (newMax === null && existingMax === null) ||
      (newMax === null && existingMax !== null && newMin <= existingMax) ||
      (existingMax === null && newMax !== null && existingMin <= newMax) ||
      (newMax !== null &&
        existingMax !== null &&
        newMin <= existingMax &&
        newMax >= existingMin);

    if (overlaps) {
      throw new ValidationError(
        `El rango se superpone con "${range.name}" (${range.minFollowers.toLocaleString()} - ${range.maxFollowers?.toLocaleString() || "∞"})`
      );
    }
  }

  const reachRange = await prisma.reachRange.create({
    data: {
      name: data.name,
      displayName: data.displayName,
      minFollowers: data.minFollowers,
      maxFollowers: data.maxFollowers || null,
      reachPercentage: data.reachPercentage,
    },
  });

  revalidateTag("reach-ranges", "hours");
  return reachRange;
}

export async function updateReachRange(
  id: string,
  data: {
    name: string;
    displayName: string;
    minFollowers: number;
    maxFollowers: number | null;
    reachPercentage: number;
  }
) {
  if (data.reachPercentage < 0 || data.reachPercentage > 100) {
    throw new ValidationError("El porcentaje debe estar entre 0 y 100");
  }

  const existingRanges = await prisma.reachRange.findMany({
    where: {
      isActive: true,
      id: { not: id },
    },
  });

  for (const range of existingRanges) {
    const existingMin = range.minFollowers;
    const existingMax = range.maxFollowers;
    const newMin = data.minFollowers;
    const newMax = data.maxFollowers;

    const overlaps =
      (newMax === null && existingMax === null) ||
      (newMax === null && existingMax !== null && newMin <= existingMax) ||
      (existingMax === null && newMax !== null && existingMin <= newMax) ||
      (newMax !== null &&
        existingMax !== null &&
        newMin <= existingMax &&
        newMax >= existingMin);

    if (overlaps) {
      throw new ValidationError(
        `El rango se superpone con "${range.name}"`
      );
    }
  }

  const reachRange = await prisma.reachRange.update({
    where: { id },
    data: {
      name: data.name,
      displayName: data.displayName,
      minFollowers: data.minFollowers,
      maxFollowers: data.maxFollowers || null,
      reachPercentage: data.reachPercentage,
    },
  });

  revalidateTag("reach-ranges", "hours");
  return reachRange;
}

export async function patchReachRange(
  id: string,
  data: {
    isActive?: boolean;
    name?: string;
    displayName?: string;
    minFollowers?: number;
    maxFollowers?: number | null;
    reachPercentage?: number;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;
  if (data.name) updateData.name = data.name;
  if (data.displayName) updateData.displayName = data.displayName;
  if (data.minFollowers !== undefined)
    updateData.minFollowers = data.minFollowers;
  if (data.maxFollowers !== undefined)
    updateData.maxFollowers = data.maxFollowers;
  if (data.reachPercentage !== undefined)
    updateData.reachPercentage = data.reachPercentage;

  const reachRange = await prisma.reachRange.update({
    where: { id },
    data: updateData,
  });

  revalidateTag("reach-ranges", "hours");
  return reachRange;
}

export async function deleteReachRange(id: string) {
  await prisma.reachRange.delete({ where: { id } });
  revalidateTag("reach-ranges", "hours");
}

import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { ValidationError } from "./errors";

export async function getCachedGenders() {
  "use cache";
  cacheLife("hours");
  cacheTag("genders");

  return prisma.gender.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });
}

export async function getActiveGenders() {
  return prisma.gender.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });
}

export async function createGender(name: string) {
  const normalizedName = name.trim().toLowerCase();
  const displayName = name.trim();

  const existing = await prisma.gender.findUnique({
    where: { name: normalizedName },
  });

  if (existing) {
    throw new ValidationError("Este género ya existe");
  }

  return prisma.gender.create({
    data: {
      name: normalizedName,
      displayName,
    },
  });
}

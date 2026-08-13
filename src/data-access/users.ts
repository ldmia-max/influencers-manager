import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { ValidationError } from "./errors";

export async function getUserEmailById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });
  return user?.email ?? null;
}

export async function getAllUsersForAdmin() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: { profiles: true },
      },
    },
  });
}

export async function createUserAdmin(data: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new ValidationError("El email ya esta registrado");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role || "USER",
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: UserRole;
    password?: string;
  }
) {
  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id },
      },
    });

    if (existing) {
      throw new ValidationError("El email ya esta en uso");
    }
  }

  const updateData: {
    name?: string;
    email?: string;
    role?: UserRole;
    password?: string;
  } = {};

  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function deleteUser(id: string, currentUserId: string) {
  if (currentUserId === id) {
    throw new ValidationError("No puedes eliminarte a ti mismo");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: { profiles: true },
      },
    },
  });

  if (user?._count.profiles && user._count.profiles > 0) {
    throw new ValidationError(
      "No se puede eliminar un usuario con perfiles asociados"
    );
  }

  await prisma.user.delete({ where: { id } });
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ValidationError("El email ya esta registrado");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: "USER",
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

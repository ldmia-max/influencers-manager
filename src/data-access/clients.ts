import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ValidationError, NotFoundError } from "./errors";
import {
  TRAS_LOGIN_CORRECTO,
  estaBloqueado,
  mensajeBloqueo,
  trasFalloDeLogin,
} from "@/lib/login-throttle";
import { auditar, ACCIONES } from "@/lib/audit";

interface ClientContact {
  id?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  position?: string;
  isPrimary?: boolean;
}

export async function getClientsWithContacts() {
  return prisma.client.findMany({
    orderBy: { companyName: "asc" },
    include: {
      contacts: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

// For API route
export async function getClientsPaginated(filters: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const skip = (page - 1) * pageSize;

  const where = filters.search
    ? {
        OR: [
          { companyName: { contains: filters.search, mode: "insensitive" as const } },
          { email: { contains: filters.search, mode: "insensitive" as const } },
          { nit: { contains: filters.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        contacts: true,
        clientUser: {
          select: { id: true, email: true, isActive: true },
        },
        createdBy: {
          select: { name: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return { clients, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// For page (different include shape)
export async function getClientsForPage(filters: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const skip = (page - 1) * pageSize;

  const where = filters.search
    ? {
        OR: [
          { companyName: { contains: filters.search, mode: "insensitive" as const } },
          { email: { contains: filters.search, mode: "insensitive" as const } },
          { nit: { contains: filters.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1,
        },
        _count: {
          select: { contacts: true },
        },
        clientUser: {
          select: { email: true, isActive: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return { clients, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getClientById(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { isPrimary: "desc" },
      },
      clientUser: {
        select: { id: true, email: true, isActive: true },
      },
      createdBy: {
        select: { name: true },
      },
    },
  });

  if (!client) {
    throw new NotFoundError("Cliente no encontrado");
  }

  return client;
}

export async function getClientForEdit(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { isPrimary: "desc" },
      },
    },
  });

  if (!client) {
    return null;
  }

  return client;
}

export async function createClient(data: {
  companyName: string;
  nit?: string;
  email: string;
  contacts: ClientContact[];
  createdById: string;
}) {
  const existingClient = await prisma.client.findUnique({
    where: { email: data.email },
  });

  if (existingClient) {
    throw new ValidationError("Ya existe un cliente con ese email");
  }

  return prisma.client.create({
    data: {
      companyName: data.companyName,
      nit: data.nit,
      email: data.email,
      createdById: data.createdById,
      contacts: {
        create: data.contacts || [],
      },
    },
    include: {
      contacts: true,
      createdBy: {
        select: { name: true },
      },
    },
  });
}

export async function updateClient(
  id: string,
  data: {
    companyName: string;
    nit?: string;
    email: string;
    contacts: ClientContact[];
  }
) {
  const existingClient = await prisma.client.findUnique({ where: { id } });

  if (!existingClient) {
    throw new NotFoundError("Cliente no encontrado");
  }

  const duplicateEmail = await prisma.client.findFirst({
    where: {
      AND: [{ id: { not: id } }, { email: data.email }],
    },
  });

  if (duplicateEmail) {
    throw new ValidationError("Ya existe otro cliente con ese email");
  }

  return prisma.$transaction(async (tx) => {
    // Obtener contactos actuales del cliente
    const currentContacts = await tx.clientContact.findMany({
      where: { clientId: id },
    });

    const incomingContactIds = new Set(
      data.contacts.filter(c => c.id).map(c => c.id!)
    );

    // Identificar contactos a eliminar (que no están en la lista nueva)
    const contactsToDelete = currentContacts.filter(
      c => !incomingContactIds.has(c.id)
    );

    // Eliminar solo contactos que no están referenciados por campañas
    for (const contact of contactsToDelete) {
      const campaignsUsingContact = await tx.campaign.count({
        where: { clientContactId: contact.id },
      });

      if (campaignsUsingContact === 0) {
        await tx.clientContact.delete({ where: { id: contact.id } });
      }
      // Si está en uso, simplemente no lo eliminamos
    }

    // Separar contactos a actualizar vs. crear
    const contactsToUpdate = data.contacts.filter(c => c.id);
    const contactsToCreate = data.contacts.filter(c => !c.id);

    // Actualizar contactos existentes
    await Promise.all(
      contactsToUpdate.map(contact =>
        tx.clientContact.update({
          where: { id: contact.id! },
          data: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            email: contact.email,
            position: contact.position,
            isPrimary: contact.isPrimary,
          },
        })
      )
    );

    // Crear nuevos contactos
    if (contactsToCreate.length > 0) {
      await tx.clientContact.createMany({
        data: contactsToCreate.map(contact => ({
          clientId: id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          position: contact.position,
          isPrimary: contact.isPrimary,
        })),
      });
    }

    // Actualizar datos del cliente
    return tx.client.update({
      where: { id },
      data: {
        companyName: data.companyName,
        nit: data.nit,
        email: data.email,
      },
      include: {
        contacts: {
          orderBy: { isPrimary: "desc" },
        },
        clientUser: {
          select: { id: true, email: true, isActive: true },
        },
        createdBy: {
          select: { name: true },
        },
      },
    });
  });
}

export async function deleteClient(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });

  if (!client) {
    throw new NotFoundError("Cliente no encontrado");
  }

  await prisma.client.delete({ where: { id } });
}

// === Client Access ===

export async function createOrUpdateClientAccess(
  clientId: string,
  data: { email: string; password?: string; isActive?: boolean }
) {
  if (!data.email) {
    throw new ValidationError("El email es requerido");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { clientUser: true },
  });

  if (!client) {
    throw new NotFoundError("Cliente no encontrado");
  }

  if (client.clientUser) {
    const updateData: { email: string; isActive: boolean; password?: string } = {
      email: data.email,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };

    if (data.password && data.password.trim() !== "") {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return prisma.clientUser.update({
      where: { id: client.clientUser.id },
      data: updateData,
    });
  } else {
    if (!data.password) {
      throw new ValidationError(
        "La contraseña es requerida para crear un nuevo acceso"
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return prisma.clientUser.create({
      data: {
        email: data.email,
        password: hashedPassword,
        isActive: data.isActive !== undefined ? data.isActive : true,
        clientId,
      },
    });
  }
}

export async function deleteClientAccess(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { clientUser: true },
  });

  if (!client) {
    throw new NotFoundError("Cliente no encontrado");
  }

  if (!client.clientUser) {
    throw new ValidationError("El cliente no tiene acceso configurado");
  }

  await prisma.clientUser.delete({
    where: { id: client.clientUser.id },
  });
}

// === Client Auth ===

export async function loginClient(email: string, password: string) {
  const clientUser = await prisma.clientUser.findUnique({
    where: { email },
    include: {
      client: {
        select: { id: true, companyName: true, email: true },
      },
    },
  });

  if (!clientUser) {
    // Misma respuesta que con contrasena mala: no se revela que
    // correos tienen acceso al portal.
    throw new ValidationError("Credenciales inválidas");
  }

  if (!clientUser.isActive) {
    throw new ValidationError("Tu cuenta está inactiva. Contacta con soporte.");
  }

  // Antes de comparar la contrasena, o el limite no frenaria nada.
  if (estaBloqueado(clientUser)) {
    throw new ValidationError(mensajeBloqueo(clientUser.lockedUntil!));
  }

  const isValidPassword = await bcrypt.compare(password, clientUser.password);

  if (!isValidPassword) {
    const estado = trasFalloDeLogin(clientUser.failedLoginAttempts);
    await prisma.clientUser.update({ where: { id: clientUser.id }, data: estado });

    await auditar({
      action: estado.lockedUntil ? ACCIONES.cuentaBloqueada : ACCIONES.loginFallido,
      entity: "ClientUser",
      entityId: clientUser.id,
      actorType: "CLIENT",
      actorId: clientUser.id,
      actorEmail: clientUser.email,
      summary: estado.lockedUntil
        ? "Cuenta del portal bloqueada tras agotar los intentos"
        : `Contraseña incorrecta en el portal (intento ${estado.failedLoginAttempts})`,
    });

    throw new ValidationError("Credenciales inválidas");
  }

  if (clientUser.failedLoginAttempts > 0 || clientUser.lockedUntil) {
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: TRAS_LOGIN_CORRECTO,
    });
  }

  await auditar({
    action: ACCIONES.loginOk,
    entity: "ClientUser",
    entityId: clientUser.id,
    actorType: "CLIENT",
    actorId: clientUser.id,
    actorEmail: clientUser.email,
    summary: `Inició sesión en el portal (${clientUser.client.companyName})`,
  });

  return {
    id: clientUser.client.id,
    companyName: clientUser.client.companyName,
    email: clientUser.email,
  };
}

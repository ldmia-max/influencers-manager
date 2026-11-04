import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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
  isActive?: boolean;
}

/** Un contacto sin el campo es uno activo: es lo que eran todos antes. */
const sigueActivo = (c: ClientContact) => c.isActive !== false;

/**
 * Deja exactamente un contacto principal, y que siga en la empresa.
 *
 * El formulario ya desmarca a los demas al marcar uno, pero no cubre ni
 * borrar al principal ni desactivarlo: en ambos casos el cliente se
 * quedaba sin ninguno —o con uno que ya no trabaja ahi— y el listado de
 * clientes, que lee `where: { isPrimary: true }`, mostraba la empresa
 * sin contacto aunque tuviera tres.
 *
 * Si no hay ninguno marcado se toma el primero de los activos. No es una
 * eleccion con criterio, pero "alguien" es mejor que "nadie" en una
 * columna cuyo unico trabajo es decir a quien llamar.
 */
function conUnPrincipal(contacts: ClientContact[]): ClientContact[] {
  if (contacts.length === 0) return contacts;

  const candidatos = contacts.some(sigueActivo)
    ? contacts.filter(sigueActivo)
    : contacts;
  const principal = candidatos.find((c) => c.isPrimary) ?? candidatos[0];

  return contacts.map((c) => ({ ...c, isPrimary: c === principal }));
}

/**
 * Desactivar al ultimo que quedaba dejaria a la empresa sin nadie a quien
 * elegir al crear una campana —un formulario que no se puede completar—
 * y el listado senalando como principal a alguien que ya se fue. Si la
 * empresa entera deja de trabajar con la agencia, lo que se retira es la
 * empresa, no sus contactos uno a uno.
 */
function exigirAlgunoActivo(contacts: ClientContact[]) {
  if (contacts.length === 0) return;
  if (contacts.some(sigueActivo)) return;

  throw new ValidationError(
    "La empresa debe conservar al menos un contacto activo: es a quien se " +
      "elige al crear una campaña."
  );
}

export async function getClientsWithContacts() {
  return prisma.client.findMany({
    orderBy: { companyName: "asc" },
    include: {
      contacts: {
        // Los inactivos tambien viajan, y el selector de campana los
        // esconde. Tienen que estar porque una campana ya guardada puede
        // apuntar a uno de ellos: si no llegara, el editor abriria esa
        // campana sin contacto y el primer guardado lo perderia.
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
        orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }],
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
        clientUsers: {
          select: { id: true, email: true, isActive: true, clientContactId: true },
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
        clientUsers: {
          select: { email: true, isActive: true, clientContactId: true },
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
        orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }],
      },
      clientUsers: {
        select: { id: true, email: true, isActive: true, clientContactId: true },
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
        orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }],
        // El acceso al portal se gestiona aqui, contacto a contacto, y
        // el formulario necesita saber quien ya lo tiene para no
        // ofrecer "Crear acceso" a quien entra desde hace meses.
        include: {
          acceso: { select: { id: true, email: true, isActive: true } },
        },
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

  exigirAlgunoActivo(data.contacts || []);

  return prisma.client.create({
    data: {
      companyName: data.companyName,
      nit: data.nit,
      email: data.email,
      createdById: data.createdById,
      contacts: {
        create: conUnPrincipal(data.contacts || []),
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

  exigirAlgunoActivo(data.contacts);

  // Una sola normalizacion para los dos caminos: los que se actualizan
  // y los que se crean salen de la misma lista.
  const contactos = conUnPrincipal(data.contacts);

  return prisma.$transaction(async (tx) => {
    // Obtener contactos actuales del cliente
    const currentContacts = await tx.clientContact.findMany({
      where: { clientId: id },
    });

    const incomingContactIds = new Set(
      contactos.filter(c => c.id).map(c => c.id!)
    );

    // Identificar contactos a eliminar (que no están en la lista nueva)
    const contactsToDelete = currentContacts.filter(
      c => !incomingContactIds.has(c.id)
    );

    // Un contacto con campañas no se borra, y hay que DECIRLO.
    //
    // Antes se saltaba el borrado en silencio: quien lo quitaba de la
    // lista guardaba, volvía a entrar y se lo encontraba otra vez, sin
    // una sola explicación. Un cambio que no se aplica y no se avisa es
    // peor que uno que se rechaza.
    //
    // Y se rechaza porque esa campaña registra QUIÉN la aprobó. Es la
    // misma razón por la que una campaña no se borra desde la
    // aplicación: es historia comercial, no una fila que estorba.
    for (const contact of contactsToDelete) {
      // Principal de la campana o invitado a aprobarla: las dos cosas
      // dejan rastro. Mirar solo la primera dejaba borrar a quien habia
      // aprobado media campana sin ser su contacto principal.
      const dondeAparece = {
        OR: [
          { clientContactId: contact.id },
          { contacts: { some: { clientContactId: contact.id } } },
        ],
      };

      const enUso = await tx.campaign.findMany({
        where: dondeAparece,
        select: { name: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      });

      if (enUso.length > 0) {
        const total = await tx.campaign.count({ where: dondeAparece });
        const nombres = enUso.map((c) => `«${c.name}»`).join(", ");
        const resto = total > enUso.length ? ` y ${total - enUso.length} más` : "";

        throw new ValidationError(
          `No se puede eliminar a ${contact.firstName} ${contact.lastName}: ` +
            `es el contacto de ${nombres}${resto}, que guardan quién las aprobó. ` +
            `Si ya no trabaja en la empresa, desactívalo: dejará de aparecer ` +
            `al crear campañas y esas campañas conservan su nombre.`
        );
      }

      await tx.clientContact.delete({ where: { id: contact.id } });
    }

    // Separar contactos a actualizar vs. crear
    const contactsToUpdate = contactos.filter(c => c.id);
    const contactsToCreate = contactos.filter(c => !c.id);

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
            isActive: contact.isActive ?? true,
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
          isActive: contact.isActive ?? true,
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
          orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }],
        },
        clientUsers: {
          select: { id: true, email: true, isActive: true, clientContactId: true },
        },
        createdBy: {
          select: { name: true },
        },
      },
    });
  });
}


// === Client Access ===

/**
 * Comprueba que el contacto es de esa empresa y devuelve sus datos.
 *
 * El id del contacto llega por la URL, asi que sin esta comprobacion
 * bastaria pegar el id de un contacto de otra empresa para crearle
 * credenciales desde la ficha de la propia. El permiso de la ruta dice
 * quien puede dar accesos; esto dice sobre quien.
 */
async function contactoDeLaEmpresa(clientId: string, contactoId: string) {
  const contacto = await prisma.clientContact.findFirst({
    where: { id: contactoId, clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      client: { select: { id: true, companyName: true } },
      acceso: { select: { id: true, email: true, isActive: true } },
    },
  });

  if (!contacto) {
    throw new NotFoundError("Contacto no encontrado en esta empresa");
  }

  return contacto;
}

/**
 * Da o actualiza el acceso al portal de UN contacto.
 *
 * Antes era uno por empresa, con un correo que podia no ser el de
 * nadie: la campana registraba que "el cliente" habia aprobado y no
 * quien, y la contrasena circulaba por la oficina del cliente. Ahora
 * cada persona entra con lo suyo y cada decision queda a su nombre.
 *
 * El correo por defecto es el del contacto. Se admite otro —hay quien
 * tiene una direccion distinta para estas cosas— pero no uno que ya use
 * otra cuenta del portal, porque es con lo que se entra.
 */
export async function createOrUpdateContactAccess(
  clientId: string,
  contactoId: string,
  data: { email?: string; password?: string; isActive?: boolean }
) {
  const contacto = await contactoDeLaEmpresa(clientId, contactoId);

  if (!contacto.isActive && !contacto.acceso) {
    throw new ValidationError(
      `${contacto.firstName} ${contacto.lastName} está inactivo: reactívalo antes de darle acceso al portal.`
    );
  }

  const email = (data.email?.trim() || contacto.email).toLowerCase();

  const ocupado = await prisma.clientUser.findFirst({
    where: { email, NOT: { clientContactId: contactoId } },
    select: { id: true },
  });

  if (ocupado) {
    throw new ValidationError(
      `Ya hay otra cuenta del portal con el correo ${email}.`
    );
  }

  if (contacto.acceso) {
    const cambios: { email: string; isActive: boolean; password?: string } = {
      email,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };

    if (data.password && data.password.trim() !== "") {
      cambios.password = await bcrypt.hash(data.password, 10);
    }

    return prisma.clientUser.update({
      where: { id: contacto.acceso.id },
      data: cambios,
      select: { id: true, email: true, isActive: true, clientContactId: true },
    });
  }

  // Sin contrasena tambien se crea: la elegira el contacto con el
  // enlace que se le manda por correo.
  //
  // Antes era obligatoria, y eso dejaba al administrador inventandose
  // una y haciendosela llegar por fuera de la aplicacion —por WhatsApp,
  // de viva voz—, que es exactamente donde no debe viajar una
  // contrasena. La cuenta nace con una cadena aleatoria que nadie
  // conoce ni puede adivinar: existe y no se puede entrar en ella hasta
  // que su dueno elija la suya.
  const hash = await bcrypt.hash(
    data.password && data.password.trim() !== ""
      ? data.password
      : randomBytes(32).toString("base64url"),
    10
  );

  return prisma.clientUser.create({
    data: {
      email,
      password: hash,
      isActive: data.isActive !== undefined ? data.isActive : true,
      clientId,
      clientContactId: contactoId,
    },
    select: { id: true, email: true, isActive: true, clientContactId: true },
  });
}

export async function deleteContactAccess(clientId: string, contactoId: string) {
  const contacto = await contactoDeLaEmpresa(clientId, contactoId);

  if (!contacto.acceso) {
    throw new ValidationError("Este contacto no tiene acceso al portal");
  }

  await prisma.clientUser.delete({ where: { id: contacto.acceso.id } });

  return { email: contacto.acceso.email };
}

/** El acceso de un contacto, para mandarle el enlace de contrasena. */
export async function accesoDeContacto(clientId: string, contactoId: string) {
  const contacto = await contactoDeLaEmpresa(clientId, contactoId);
  return {
    nombre: `${contacto.firstName} ${contacto.lastName}`,
    companyName: contacto.client.companyName,
    acceso: contacto.acceso,
  };
}

// === Client Auth ===

export async function loginClient(email: string, password: string) {
  const clientUser = await prisma.clientUser.findUnique({
    where: { email },
    include: {
      client: {
        select: { id: true, companyName: true, email: true },
      },
      clientContact: {
        select: { id: true, firstName: true, lastName: true, isActive: true },
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

  // Desactivar a alguien en la ficha del cliente es decir que ya no
  // trabaja alli. Si su cuenta siguiera entrando, el interruptor no
  // significaria nada: seguiria viendo campanas y aprobando costes.
  if (!clientUser.clientContact.isActive) {
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
    contactId: clientUser.clientContact.id,
    contactName: `${clientUser.clientContact.firstName} ${clientUser.clientContact.lastName}`,
  };
}

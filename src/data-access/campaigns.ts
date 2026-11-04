import { prisma } from "@/lib/prisma";
import { CampaignStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { ValidationError, NotFoundError } from "./errors";
import { entregasPendientesDeCampana } from "./entregas";
import {
  calcularTotalCampana,
  calculateMarkupPrice,
  MARKUP_PERCENTAGE,
} from "@/lib/campaign-utils";

function generateApprovalToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Transiciones que acepta el servidor.
 *
 * REVIEW conserva las salidas a DRAFT y ACTIVE porque son las que aplica
 * la propia respuesta del cliente: a Abierta si no aprobo a nadie, a En
 * proceso si aprobo a alguno. Lo que el usuario puede pulsar es un
 * subconjunto mas estrecho, declarado en USER_VALID_TRANSITIONS.
 */
const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["REVIEW", "ACTIVE", "CANCELLED"],
  REVIEW: ["DRAFT", "ACTIVE", "CANCELLED"],
  PENDING: ["REVIEW", "DRAFT", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function getStatusMessage(status: CampaignStatus): string {
  const messages: Record<CampaignStatus, string> = {
    DRAFT: "Campaña abierta. Ya se puede editar y ajustar los influencers",
    REVIEW: "Campaña enviada al cliente. En revisión",
    PENDING: "Campaña abierta",
    ACTIVE: "Campaña en proceso. Ya se pueden registrar las entregas",
    COMPLETED: "Campaña cerrada",
    CANCELLED: "Campaña cancelada",
  };
  return messages[status];
}

// --- API Queries ---

export async function getCampaignsPaginated(params: {
  userId: string;
  /**
   * Si el usuario ve todas o solo las suyas. Lo decide la tabla de
   * permisos (exigePropiedadParaLeer), no el rol: antes se llamaba
   * isAdmin y ataba el alcance a ser administrador, asi que ampliar la
   * visibilidad obligaba a tocar cada consulta.
   */
  verTodas: boolean;
  search?: string;
  clientId?: string;
  status?: CampaignStatus;
  page: number;
  pageSize: number;
}) {
  const skip = (params.page - 1) * params.pageSize;

  const where = {
    AND: [
      !params.verTodas ? { createdById: params.userId } : {},
      params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { client: { companyName: { contains: params.search, mode: "insensitive" as const } } },
            ],
          }
        : {},
      params.clientId ? { clientId: params.clientId } : {},
      params.status ? { status: params.status } : {},
    ],
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
      include: {
        client: { select: { id: true, companyName: true } },
        clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        profiles: {
          select: {
            id: true,
            participacion: true,
            profile: { select: { id: true, name: true } },
            platforms: {
              select: {
                services: { select: { basePrice: true, quantity: true } },
              },
            },
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  // El total lo calcula calcularTotalCampana y no un reduce local: es la
  // unica que sabe que los retirados no suman, y esa regla tiene que ser
  // la misma aqui, en la ficha y en el portal del cliente.
  const campaignsWithTotals = campaigns.map((campaign) => {
    const totales = calcularTotalCampana(campaign.profiles, campaign.markupPercentage);
    return {
      ...campaign,
      totalBase: totales.base,
      totalWithMarkup: totales.conMargen,
      presupuestoLiberado: totales.liberado,
      profileCount: totales.perfilesActivos,
      perfilesRetirados: totales.perfilesRetirados,
    };
  });

  return {
    campaigns: campaignsWithTotals,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

export async function getCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, email: true } },
      clientContact: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, position: true },
      },
      createdBy: { select: { id: true, name: true } },
      profiles: {
        include: {
          profile: { select: { id: true, name: true, type: true, country: true, city: true } },
          platforms: {
            include: {
              socialAccount: { include: { platform: true } },
              services: {
                include: { profileService: { include: { serviceType: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  return campaign;
}

// --- Page Queries ---

export async function getCampaignsForPage(params: {
  userId?: string;
  /** Ver todas o solo las propias. Lo decide la tabla de permisos. */
  verTodas: boolean;
  search?: string;
  clientId?: string;
  status?: CampaignStatus;
  page: number;
  pageSize: number;
}) {
  const skip = (params.page - 1) * params.pageSize;

  const where = {
    AND: [
      !params.verTodas ? { createdById: params.userId } : {},
      params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { client: { companyName: { contains: params.search, mode: "insensitive" as const } } },
            ],
          }
        : {},
      params.clientId ? { clientId: params.clientId } : {},
      params.status ? { status: params.status } : {},
    ],
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
      include: {
        client: { select: { id: true, companyName: true } },
        clientContact: { select: { id: true, firstName: true, lastName: true } },
        profiles: {
          include: {
            platforms: {
              include: {
                socialAccount: { select: { followers: true } },
                services: true,
              },
            },
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return { campaigns, total, totalPages: Math.ceil(total / params.pageSize) };
}

export async function getCampaignDetail(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, email: true } },
      clientContact: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, position: true },
      },
      createdBy: { select: { id: true, name: true } },
      // Los contactos que pueden aprobar, para que la pestaña Revisiones
      // diga a quién se mandó y quién falta por contestar.
      contacts: {
        select: {
          clientContact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      approvalTokens: {
        select: {
          id: true,
          token: true,
          expiresAt: true,
          usedAt: true,
          createdAt: true,
          sentToEmail: true,
          sentToName: true,
          verifiedAt: true,
          clientContactId: true,
        },
        orderBy: { createdAt: "desc" },
      },
      profiles: {
        include: {
          // Quien lo aprobó o rechazó. `reviewedAt` decía cuándo y
          // nunca quién: con varios contactos aprobando la misma
          // campaña, es la pregunta que hay que poder responder.
          revisadoPor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          profile: {
            select: {
              id: true,
              name: true,
              type: true,
              gender: { select: { displayName: true } },
              department: { select: { name: true } },
              // Todas sus redes, no solo las contratadas en esta
              // campana: una pieza puede publicarse en una cuenta que el
              // creador tiene y que aqui no se contrato.
              socialAccounts: {
                select: {
                  id: true,
                  username: true,
                  platform: {
                    select: { id: true, name: true, displayName: true },
                  },
                },
              },
            },
          },
          platforms: {
            include: {
              socialAccount: {
                select: {
                  id: true,
                  username: true,
                  followers: true,
                  platform: true,
                },
              },
              services: {
                include: {
                  profileService: { include: { serviceType: true } },
                  // Los links entregados y su ultima captura de metricas:
                  // la ficha los pinta junto a cada formato.
                  entregas: {
                    orderBy: { entregadoEn: "asc" },
                    include: {
                      // Que formato es la pieza. En un combo es lo unico
                      // que lo dice: el contratado agrupa varios. Su red
                      // es la de la publicacion, que no tiene por que ser
                      // la de la cuenta contratada.
                      serviceType: {
                        select: {
                          id: true,
                          displayName: true,
                          esEfimero: true,
                          platform: {
                            select: { id: true, name: true, displayName: true },
                          },
                        },
                      },
                      registradoPor: { select: { id: true, name: true } },
                      metricas: {
                        orderBy: { capturadoEn: "desc" },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  return campaign;
}

export async function getCampaignForEdit(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true } },
      clientContact: { select: { id: true, firstName: true, lastName: true } },
      contacts: { select: { clientContactId: true } },
      profiles: {
        include: {
          profile: { select: { id: true, name: true } },
          platforms: {
            include: {
              socialAccount: { select: { id: true } },
              services: {
                select: { id: true, quantity: true, basePrice: true, profileServiceId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  return campaign;
}

export async function getDashboardCampaigns(userId: string, verTodas: boolean) {
  const [activeCampaigns, draftCampaigns] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: "ACTIVE", ...(verTodas ? {} : { createdById: userId }) },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { companyName: true } },
        _count: { select: { profiles: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { status: "DRAFT", ...(verTodas ? {} : { createdById: userId }) },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { companyName: true } },
        _count: { select: { profiles: true } },
      },
    }),
  ]);

  return { activeCampaigns, draftCampaigns };
}

// --- Mutations ---

/**
 * La lista definitiva de quienes pueden aprobar una campana.
 *
 * El principal entra siempre, lo pidan o no: encabeza la ficha, firma
 * los correos y seria absurdo que no pudiera revisar lo que lleva su
 * nombre. Los demas tienen que ser contactos de la misma empresa —el id
 * llega del navegador— y activos, porque invitar a aprobar a alguien
 * que ya no trabaja alli es mandar un correo a una direccion muerta.
 */
function contactosDeLaCampana(
  contactosDelCliente: { id: string; isActive: boolean }[],
  principalId: string,
  otrosIds: string[] | undefined
): string[] {
  const validos = new Map(contactosDelCliente.map((c) => [c.id, c]));
  const elegidos = new Set<string>([principalId]);

  for (const id of otrosIds ?? []) {
    const contacto = validos.get(id);
    if (!contacto) {
      throw new ValidationError(
        "Alguno de los contactos seleccionados no pertenece a este cliente"
      );
    }
    if (!contacto.isActive && id !== principalId) {
      throw new ValidationError(
        "No se puede invitar a aprobar a un contacto inactivo"
      );
    }
    elegidos.add(id);
  }

  return [...elegidos];
}

export async function createCampaign(data: {
  name: string;
  description?: string;
  clientId: string;
  clientContactId: string;
  /** Los demas que tambien pueden aprobar. El principal entra solo. */
  clientContactIds?: string[];
  budget: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  createdById: string;
}) {
  if (data.budget <= 0) {
    throw new ValidationError("El presupuesto debe ser mayor a 0");
  }

  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
    include: { contacts: true },
  });

  if (!client) {
    throw new NotFoundError("Cliente no encontrado");
  }

  const contactBelongsToClient = client.contacts.some((c) => c.id === data.clientContactId);
  if (!contactBelongsToClient) {
    throw new ValidationError("El contacto no pertenece al cliente seleccionado");
  }

  const contactos = contactosDeLaCampana(
    client.contacts,
    data.clientContactId,
    data.clientContactIds
  );

  return prisma.campaign.create({
    data: {
      name: data.name,
      description: data.description,
      clientId: data.clientId,
      clientContactId: data.clientContactId,
      budget: data.budget,
      currency: data.currency || "COP",
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdById: data.createdById,
      // Congela el margen vigente. A partir de aqui esta campana ya no
      // depende de la constante global: subirla el ano que viene no le
      // cambiara los precios.
      markupPercentage: MARKUP_PERCENTAGE,
      contacts: { create: contactos.map((id) => ({ clientContactId: id })) },
    },
    include: {
      client: { select: { id: true, companyName: true } },
      clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function updateCampaign(
  id: string,
  data: {
    name?: string;
    description?: string;
    clientId?: string;
    clientContactId?: string;
    clientContactIds?: string[];
    budget?: number;
    currency?: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: CampaignStatus;
  }
) {
  const existing = await prisma.campaign.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError("Campaña no encontrada");
  }

  if (existing.status !== "DRAFT" && existing.status !== "PENDING") {
    throw new ValidationError("Solo se pueden editar campañas en estado borrador o pendiente");
  }

  // La lista de contactos se rehace cuando llega, y para eso hace falta
  // saber quien es el principal: puede venir en esta misma llamada o
  // seguir siendo el que ya tenia la campana.
  const principalId = data.clientContactId ?? existing.clientContactId;
  const clientId = data.clientId ?? existing.clientId;
  let contactos: string[] | null = null;

  if ((data.clientId && data.clientContactId) || data.clientContactIds) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { contacts: true },
    });

    if (!client) {
      throw new NotFoundError("Cliente no encontrado");
    }

    const contactBelongsToClient = client.contacts.some((c) => c.id === principalId);
    if (!contactBelongsToClient) {
      throw new ValidationError("El contacto no pertenece al cliente seleccionado");
    }

    if (data.clientContactIds) {
      contactos = contactosDeLaCampana(
        client.contacts,
        principalId,
        data.clientContactIds
      );
    }
  }

  if (contactos) {
    // Se rehace entera en vez de calcular altas y bajas: la lista es
    // corta y lo que manda el formulario es el estado completo. Borrar
    // una fila no borra nada mas —CampaignContact solo dice quien puede
    // revisar—, asi que el unico efecto de quitar a alguien es que deja
    // de ver la campana.
    const lista = contactos;
    await prisma.$transaction([
      prisma.campaignContact.deleteMany({
        where: { campaignId: id, clientContactId: { notIn: lista } },
      }),
      ...lista.map((clientContactId) =>
        prisma.campaignContact.upsert({
          where: {
            campaignId_clientContactId: { campaignId: id, clientContactId },
          },
          create: { campaignId: id, clientContactId },
          update: {},
        })
      ),
    ]);
  }

  return prisma.campaign.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.clientId && { clientId: data.clientId }),
      ...(data.clientContactId && { clientContactId: data.clientContactId }),
      ...(data.budget !== undefined && { budget: data.budget }),
      ...(data.currency && { currency: data.currency }),
      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null,
      }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.status && { status: data.status }),
    },
    include: {
      client: { select: { id: true, companyName: true } },
      clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}


// --- Status Machine ---

export async function transitionCampaignStatus(
  campaignId: string,
  newStatus: CampaignStatus,
  reason?: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: { select: { companyName: true } },
      clientContact: { select: { firstName: true, lastName: true, email: true } },
      contacts: {
        select: {
          clientContact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
      profiles: {
        select: {
          id: true,
          status: true,
          platforms: { select: { id: true } },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  const validTransitions = VALID_TRANSITIONS[campaign.status];
  if (!validTransitions.includes(newStatus)) {
    throw new ValidationError(
      `No se puede cambiar de ${campaign.status} a ${newStatus}`
    );
  }

  // Ni al cliente ni a produccion se va con la campana vacia.
  //
  // Una campana SI se crea sin nadie —el presupuesto suele cerrarse antes
  // que el reparto— y se queda Abierta hasta que se llena. Pero una
  // "En proceso" sin nadie contratado no describe ningun trabajo, y
  // ademas se daria por entregada al instante: entregasPendientes no
  // encuentra formatos que reclamar, asi que podria cerrarse sin que
  // nadie hubiera publicado nada.
  if (
    (newStatus === "REVIEW" || newStatus === "ACTIVE") &&
    campaign.profiles.length === 0
  ) {
    throw new ValidationError(
      newStatus === "REVIEW"
        ? "La campaña debe tener al menos un perfil para enviar a revisión"
        : "La campaña debe tener al menos un perfil para ponerla en proceso"
    );
  }

  let approvalToken: string | null = null;

  // REVIEW transition: reset statuses + generate token
  if (newStatus === "REVIEW") {

    await prisma.campaignProfile.updateMany({
      where: { campaignId },
      data: { status: "PENDING", rejectionReason: null, reviewedAt: null },
    });

    const platformIds = campaign.profiles.flatMap((p) => p.platforms.map((pl) => pl.id));
    if (platformIds.length > 0) {
      await prisma.campaignProfilePlatform.updateMany({
        where: { id: { in: platformIds } },
        data: { status: "PENDING", rejectionReason: null, reviewedAt: null },
      });
    }

    await prisma.campaignService.updateMany({
      where: {
        campaignProfilePlatform: {
          campaignProfile: { campaignId },
        },
      },
      data: { isApproved: true, rejectionReason: null, reviewedAt: null },
    });

    // Un enlace POR CONTACTO, no uno compartido.
    //
    // El codigo de verificacion viaja al correo al que se emitio el
    // enlace, asi que un unico enlace para cuatro personas solo lo
    // puede abrir una: las otras tres tendrian que pedirselo. Y lo que
    // quedaria registrado seria "lo aprobo el cliente", sin nombre.
    // Con uno cada uno, cada quien entra con lo suyo y cada decision
    // lleva firma.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const destinatarios = contactosQueAprueban(campaign);

    await prisma.campaignApprovalToken.createMany({
      data: destinatarios.map((c) => ({
        token: generateApprovalToken(),
        expiresAt,
        campaignId,
        clientContactId: c.id,
        sentToEmail: c.email,
        sentToName: `${c.firstName} ${c.lastName}`,
      })),
    });

    // El que se devuelve es el del principal: es el que la agencia
    // copia al portapapeles cuando quiere pegarlo a mano.
    const delPrincipal = await prisma.campaignApprovalToken.findFirst({
      where: { campaignId, clientContactId: campaign.clientContactId, usedAt: null },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });
    approvalToken = delPrincipal?.token ?? null;
  }

  // ACTIVE transition: validate approvals
  if (newStatus === "ACTIVE") {
    if (campaign.status === "REVIEW") {
      const allApproved = campaign.profiles.every((p) => p.status === "APPROVED");
      if (!allApproved) {
        const pendingCount = campaign.profiles.filter((p) => p.status === "PENDING").length;
        const rejectedCount = campaign.profiles.filter((p) => p.status === "REJECTED").length;
        throw new ValidationError(
          JSON.stringify({
            error: "Todos los perfiles deben estar aprobados para activar la campaña",
            details: {
              total: campaign.profiles.length,
              approved: campaign.profiles.filter((p) => p.status === "APPROVED").length,
              pending: pendingCount,
              rejected: rejectedCount,
            },
          })
        );
      }
    }

    if (campaign.status === "DRAFT" && campaign.profiles.length > 0) {
      await prisma.campaignProfile.updateMany({
        where: { campaignId },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
    }
  }

  // Cancelar es terminal y sin vuelta atras, asi que se exige el motivo.
  // Meses despues nadie recuerda si fue el cliente, el presupuesto o un
  // cambio de plan, y esa fila es todo lo que queda de la campana.
  if (newStatus === "CANCELLED" && !reason?.trim()) {
    throw new ValidationError("Indica por qué se cancela la campaña");
  }

  // Una campana no se cierra mientras falten links por registrar. Los
  // retirados no cuentan: ya no deben nada.
  if (newStatus === "COMPLETED") {
    const pendientes = await entregasPendientesDeCampana(campaignId);
    if (pendientes.length > 0) {
      const detalle = pendientes
        .map((p) => `${p.influencer} (${p.entregados} de ${p.esperados})`)
        .join(", ");
      throw new ValidationError(
        `No se puede completar la campaña: faltan entregas de ${detalle}.`
      );
    }
  }

  // Update campaign status
  const updateData: {
    status: CampaignStatus;
    activationReason?: string | null;
    activatedAt?: Date | null;
    motivoCancelacion?: string | null;
    canceladaEn?: Date | null;
  } = { status: newStatus };

  if (newStatus === "ACTIVE") {
    updateData.activationReason = reason || null;
    updateData.activatedAt = new Date();
  }

  if (newStatus === "CANCELLED") {
    updateData.motivoCancelacion = reason!.trim();
    updateData.canceladaEn = new Date();
  }

  const updatedCampaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: updateData,
    include: {
      profiles: {
        select: {
          id: true,
          status: true,
          profile: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    campaign: updatedCampaign,
    message: getStatusMessage(newStatus),
    approvalToken,
    emailData: newStatus === "REVIEW"
      ? {
          campaignName: campaign.name,
          companyName: campaign.client.companyName,
          // Cada uno con SU enlace. La ruta los recorre y manda un
          // correo a cada quien.
          destinatarios: await enlacesDeRevision(campaignId),
        }
      : null,
  };
}

/**
 * Contactos con derecho a aprobar, tal y como estan guardados.
 *
 * Se filtran los inactivos: alguien pudo dejar la empresa entre que se
 * monto la campana y se envio a revision, y mandarle el enlace seria
 * escribir a una direccion que ya no lee nadie. El principal se cuela
 * igualmente si la lista quedara vacia —una campana sin nadie a quien
 * mandarsela no se puede revisar, y es mejor un correo que rebota que
 * una revision que no sale.
 */
function contactosQueAprueban(campaign: {
  clientContactId: string;
  clientContact: { firstName: string; lastName: string; email: string };
  contacts: {
    clientContact: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    };
  }[];
}) {
  const activos = campaign.contacts
    .map((c) => c.clientContact)
    .filter((c) => c.isActive);

  if (activos.length > 0) return activos;

  return [
    {
      id: campaign.clientContactId,
      firstName: campaign.clientContact.firstName,
      lastName: campaign.clientContact.lastName,
      email: campaign.clientContact.email,
      isActive: true,
    },
  ];
}

/** Los enlaces vigentes de una campana, uno por destinatario. */
async function enlacesDeRevision(campaignId: string) {
  const tokens = await prisma.campaignApprovalToken.findMany({
    where: { campaignId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { token: true, sentToEmail: true, sentToName: true, clientContactId: true },
  });

  // Si por lo que sea hubiera dos vigentes para la misma persona, se
  // manda el mas reciente: dos correos con dos enlaces distintos para
  // la misma campana es la forma mas rapida de que no se abra ninguno.
  const porPersona = new Map<string, (typeof tokens)[number]>();
  for (const t of tokens) {
    const clave = t.clientContactId ?? t.sentToEmail.toLowerCase();
    if (!porPersona.has(clave)) porPersona.set(clave, t);
  }

  return [...porPersona.values()].map((t) => ({
    token: t.token,
    contactEmail: t.sentToEmail,
    contactName: t.sentToName ?? t.sentToEmail,
  }));
}

export async function regenerateApprovalToken(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      clientContact: {
        select: { firstName: true, lastName: true, email: true },
      },
      contacts: {
        select: {
          clientContact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  // ACTIVE tambien vale: a una campana en marcha se le puede sumar un
  // reemplazo cuando alguien se retira, y ese influencer nuevo necesita
  // que el cliente lo apruebe sin reabrir el resto de la campana.
  if (campaign.status !== "REVIEW" && campaign.status !== "ACTIVE") {
    throw new ValidationError(
      "Solo se puede generar un enlace cuando la campaña está en revisión o activa"
    );
  }

  if (campaign.status === "ACTIVE") {
    const pendientes = await prisma.campaignProfile.count({
      where: { campaignId, status: "PENDING", participacion: "ACTIVO" },
    });
    if (pendientes === 0) {
      throw new ValidationError(
        "No hay ningún influencer pendiente de aprobación en esta campaña"
      );
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const destinatarios = contactosQueAprueban(campaign);
  const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

  // Los vigentes se invalidan antes de emitir los nuevos. Si no, cada
  // reenvio dejaria otro enlace vivo de la misma campana y la bandeja
  // del cliente acabaria con tres, sin saber cual es el bueno.
  await prisma.campaignApprovalToken.updateMany({
    where: { campaignId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const nuevos = await Promise.all(
    destinatarios.map((c) =>
      prisma.campaignApprovalToken.create({
        data: {
          token: generateApprovalToken(),
          expiresAt,
          campaignId,
          clientContactId: c.id,
          sentToEmail: c.email,
          sentToName: `${c.firstName} ${c.lastName}`,
        },
        select: { id: true, token: true, sentToEmail: true, sentToName: true, expiresAt: true, createdAt: true, usedAt: true },
      })
    )
  );

  const delPrincipal =
    nuevos.find((t) => t.sentToEmail === campaign.clientContact.email) ?? nuevos[0];

  return {
    token: delPrincipal,
    approvalUrl: `${base}/approve/${delPrincipal.token}`,
    contactEmail: delPrincipal.sentToEmail,
    contactName: delPrincipal.sentToName ?? delPrincipal.sentToEmail,
    campaignName: campaign.name,
    expiresAt,
    destinatarios: nuevos.map((t) => ({
      token: t.token,
      contactEmail: t.sentToEmail,
      contactName: t.sentToName ?? t.sentToEmail,
    })),
  };
}

/**
 * El filtro por contacto, escrito una sola vez.
 *
 * `clientId` separa una empresa de otra. Esto separa a una persona de
 * otra DENTRO de la misma empresa: una campana solo existe para quien
 * figura en ella, de modo que repartirlas entre areas del cliente
 * —marketing la suya, producto la suya— sea posible y que un enlace que
 * llegue a manos de otro contacto no abra nada.
 *
 * Va siempre junto a `clientId`, nunca en su lugar: un id de contacto
 * de otra empresa no deberia poder usarse ni por error.
 */
function soloSusCampanas(contactId: string) {
  return { contacts: { some: { clientContactId: contactId } } };
}

/**
 * Campanas visibles para un cliente en su portal.
 *
 * El filtro por clientId no es negociable: es lo unico que impide que
 * un cliente vea las campanas de otro. El clientId sale de la cookie
 * firmada de sesion (src/lib/client-session.ts), nunca de la peticion.
 *
 * Se excluyen los borradores: una campana en DRAFT esta a medias y el
 * cliente no deberia verla hasta que se le manda a revision.
 *
 * Devuelve el presupuesto ya formateado como cadena porque Decimal de
 * Prisma no puede cruzar a un componente de cliente.
 */
export async function getCampaignsForClientPortal(
  clientId: string,
  contactId: string
) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      clientId,
      ...soloSusCampanas(contactId),
      status: { not: CampaignStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      budget: true,
      currency: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      // Solo los que siguen contratados: al cliente no le sirve un
      // recuento que incluya a quien ya se retiro de la campana.
      _count: { select: { profiles: { where: { participacion: "ACTIVO" } } } },
    },
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    budget: campaign.budget.toString(),
    totalProfiles: campaign._count.profiles,
  }));
}

/**
 * Cambia el margen de UNA campana.
 *
 * Va aparte de updateCampaign a proposito: esa funcion solo deja editar
 * campanas en DRAFT o PENDING, y aqui hace falta poder ajustar tambien
 * las ya activas o cerradas para renegociaciones. Quien puede llamarla
 * lo decide la ruta, que exige permiso de administracion.
 *
 * Cambiar el margen de una campana ya aprobada altera cifras que el
 * cliente acepto: es una decision del negocio, no un descuido, y por
 * eso esta reservada al ADMIN.
 */
export async function setCampaignMarkup(id: string, markup: number) {
  if (!Number.isFinite(markup) || markup < 0 || markup > 5) {
    throw new ValidationError(
      "El margen debe estar entre 0 y 5 (0% y 500%)"
    );
  }

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Campaña no encontrada");

  return prisma.campaign.update({
    where: { id },
    data: { markupPercentage: markup },
    select: { id: true, markupPercentage: true },
  });
}

/**
 * La campana completa para el portal del cliente.
 *
 * `clientId` va en el where ademas del id de campana: ese filtro es lo
 * unico que impide que un cliente lea la campana de otro poniendo un id
 * en la barra de direcciones, y tiene que venir siempre de la cookie
 * firmada, nunca de la peticion.
 *
 * Devuelve null en vez de lanzar cuando no hay coincidencia, para que la
 * pagina responda 404 sin distinguir entre "no existe" y "no es tuya":
 * un mensaje distinto en cada caso confirmaria a un curioso que la
 * campana existe.
 *
 * Dos propiedades que hay que conservar al tocar esto:
 *
 * 1. **Todo campo se nombra con `select`, nunca `include`.** Asi una
 *    columna nueva se queda dentro por omision en vez de salir por
 *    omision. Es lo que mantiene fuera `nombreCompleto`, `tipoDocumento`
 *    y `numeroDocumento` del influencer, que no salen nunca de la
 *    agencia.
 *
 * 2. **El margen se aplica AQUI, no en el navegador.** Lo que viaja es
 *    `precio`, el importe final. `basePrice` —lo que cobra el
 *    influencer— y `markupPercentage` se quedan en el servidor: juntos
 *    revelan cuanto carga la agencia encima, que es cosa de la agencia.
 *    El portal de aprobacion hacia la multiplicacion en el cliente y por
 *    eso ambos numeros bajaban al navegador.
 *
 * Siguen fuera `motivoRetiro` y `origenRetiro` —por que se fue alguien
 * es una conversacion interna—, las `notas` de cada entrega y quien la
 * registro.
 */
export async function getCampaignResultsForClient(
  clientId: string,
  campaignId: string,
  contactId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      clientId,
      ...soloSusCampanas(contactId),
      status: { not: CampaignStatus.DRAFT },
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      budget: true,
      currency: true,
      // Se lee para multiplicar aqui dentro; no se devuelve.
      markupPercentage: true,
      client: { select: { companyName: true } },
      clientContact: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          phone: true,
        },
      },
      // El historial de revisiones. El `token` NO se selecciona: es la
      // credencial que abre la aprobacion, y el cliente no lo necesita
      // —para entrar tiene el boton, que resuelve el enlace contra su
      // sesion—. Lo que sirve aqui es cuando se le pidio cada revision
      // y cuando la contesto.
      approvalTokens: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          usedAt: true,
          verifiedAt: true,
          verifiedEmail: true,
          sentToEmail: true,
        },
      },
      profiles: {
        // Sin filtro de participacion: el cliente ve a todo el que paso
        // por la campana con su estado, incluidos los retirados. Lo que
        // no ve es el motivo del retiro.
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          participacion: true,
          // El motivo del rechazo lo escribio el propio cliente:
          // devolverselo es recordarle lo que dijo, no filtrar nada.
          rejectionReason: true,
          profile: { select: { id: true, name: true } },
          platforms: {
            select: {
              id: true,
              status: true,
              socialAccount: {
                select: {
                  username: true,
                  followers: true,
                  profilePicUrl: true,
                  platform: { select: { name: true, displayName: true } },
                },
              },
              services: {
                select: {
                  id: true,
                  quantity: true,
                  esCombo: true,
                  comboDescripcion: true,
                  isApproved: true,
                  clientNotes: true,
                  rejectionReason: true,
                  fechaLimite: true,
                  basePrice: true,
                  profileService: {
                    select: {
                      serviceType: {
                        select: { displayName: true, esEfimero: true },
                      },
                    },
                  },
                  entregas: {
                    orderBy: { entregadoEn: "asc" },
                    select: {
                      id: true,
                      url: true,
                      publicadoEn: true,
                      entregadoEn: true,
                      // Las cifras escritas a mano. Entran para que el
                      // engagement del portal salga del mismo sitio que
                      // el de la agencia: el alcance es el denominador y
                      // compartidos y reposteos van en el numerador, asi
                      // que sin ellos el cliente veria otro porcentaje
                      // para lo mismo. `notas` sigue fuera a proposito.
                      alcance: true,
                      compartidosReportados: true,
                      reposteosReportados: true,
                      esExtra: true,
                      serviceType: {
                        select: {
                          displayName: true,
                          esEfimero: true,
                          platform: { select: { name: true, displayName: true } },
                        },
                      },
                      metricas: {
                        orderBy: { capturadoEn: "asc" },
                        select: {
                          capturadoEn: true,
                          origen: true,
                          vistas: true,
                          interacciones: true,
                          meGusta: true,
                          comentarios: true,
                          compartidos: true,
                          guardados: true,
                          reposteos: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) return null;

  // A partir de aqui se reconstruye el arbol cambiando `basePrice` por
  // `precio`. Es deliberadamente explicito: mientras la transformacion
  // sea un mapeo campo a campo, anadir una columna a la consulta no la
  // cuela en la respuesta sin que alguien la escriba aqui tambien.
  const { markupPercentage, ...resto } = campaign;

  const conPrecio = (base: unknown, cantidad: number) => {
    const precio = calculateMarkupPrice(Number(base), markupPercentage);
    return {
      precio: Math.round(precio).toString(),
      subtotal: Math.round(precio * cantidad).toString(),
    };
  };

  return {
    ...resto,
    budget: campaign.budget.toString(),
    profiles: campaign.profiles.map((cp) => ({
      id: cp.id,
      status: cp.status,
      participacion: cp.participacion,
      rejectionReason: cp.rejectionReason,
      profile: cp.profile,
      platforms: cp.platforms.map((cpp) => ({
        id: cpp.id,
        status: cpp.status,
        socialAccount: cpp.socialAccount,
        services: cpp.services.map((cs) => {
          const { basePrice, ...servicio } = cs;
          return { ...servicio, ...conPrecio(basePrice, cs.quantity) };
        }),
      })),
    })),
  };
}

/**
 * Las campanas de este cliente que esperan una respuesta suya.
 *
 * Es la misma condicion que deja generar un enlace de aprobacion: la
 * campana admite revision (REVIEW o ACTIVE) y queda al menos un
 * influencer sin contestar. ACTIVE entra porque a una campana en marcha
 * se le suma gente cuando alguien se retira, y ese reemplazo necesita
 * el si del cliente sin reabrir el resto.
 *
 * `clientId` viene de la cookie firmada, como en todo el portal.
 */
export async function revisionesPendientesDeCliente(
  clientId: string,
  contactId: string
) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      clientId,
      ...soloSusCampanas(contactId),
      status: { in: [CampaignStatus.REVIEW, CampaignStatus.ACTIVE] },
      profiles: {
        some: { status: "PENDING", participacion: "ACTIVO" },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: {
        select: {
          profiles: { where: { status: "PENDING", participacion: "ACTIVO" } },
        },
      },
    },
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    pendientes: c._count.profiles,
  }));
}

/**
 * El enlace de revision para un cliente que YA inicio sesion en el portal.
 *
 * Devuelve el token del enlace de aprobacion, reutilizando el vigente si
 * lo hay y creando uno solo cuando no queda ninguno. No envia correo:
 * quien llama ya esta dentro del portal.
 *
 * Por que existe, y no basta con el enlace del correo: ese token caduca,
 * es de un solo uso y ademas exige un codigo enviado al correo
 * registrado. Un cliente que entra por el portal y pulsa "Revisar" se
 * encontraba con "el enlace ya no es valido" en cuanto el anterior
 * vencia o se usaba, y no tenia forma de pedir otro —regenerarlo es una
 * accion de la agencia—. Quedaba bloqueado sin nada que pudiera hacer.
 *
 * Saltarse el codigo por correo no afloja nada: ese codigo esta para
 * demostrar que quien abre el enlace es el destinatario, y la cookie de
 * sesion del portal ya lo demuestra —se obtuvo con usuario y
 * contrasena—. Lo que no puede saltarse es de quien es la campana, y por
 * eso `clientId` va en el where: sin el, un id en la barra de
 * direcciones abriria la revision de otro cliente.
 *
 * El token creado se marca con el correo de quien entro, de modo que en
 * la pestana Revisiones de la agencia se vea que el enlace lo abrio el
 * cliente desde el portal y no que alguien lo genero a mano.
 */
export async function tokenDeRevisionParaCliente(
  clientId: string,
  campaignId: string,
  email: string,
  contactId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, clientId, ...soloSusCampanas(contactId) },
    select: { id: true, status: true },
  });

  if (!campaign) throw new NotFoundError("Campaña no encontrada");

  if (campaign.status !== "REVIEW" && campaign.status !== "ACTIVE") {
    throw new ValidationError("Esta campaña no está en revisión");
  }

  const pendientes = await prisma.campaignProfile.count({
    where: { campaignId, status: "PENDING", participacion: "ACTIVO" },
  });

  if (pendientes === 0) {
    throw new ValidationError("No hay nada pendiente de revisar en esta campaña");
  }

  // Se reaprovecha el SUYO antes de crear otro: si vuelve a pulsar
  // "Revisar" sin haber terminado, debe continuar donde estaba y no
  // abrir una revision distinta de la misma campana.
  //
  // El filtro por contacto es lo importante. Antes se cogia cualquier
  // enlace vigente de la campana, y con varios contactos eso entregaba
  // a quien entraba el enlace emitido a OTRA persona: la decision
  // habria quedado firmada con su nombre y su correo.
  const vigente = await prisma.campaignApprovalToken.findFirst({
    where: {
      campaignId,
      clientContactId: contactId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });

  if (vigente) {
    // Queda constancia de que entro, aunque el enlace lo hubiera creado
    // el envio a revision. La sesion del portal identifica a esta
    // persona igual que lo haria el codigo por correo, y sin esta marca
    // la pestana Revisiones mostraba "—" en la columna de quien entro
    // justo para quien acababa de aprobar desde el portal.
    await prisma.campaignApprovalToken.updateMany({
      where: { token: vigente.token, verifiedAt: null },
      data: { verifiedAt: new Date(), verifiedEmail: email },
    });
    return vigente.token;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const creado = await prisma.campaignApprovalToken.create({
    data: {
      token: generateApprovalToken(),
      expiresAt,
      campaignId,
      clientContactId: contactId,
      sentToEmail: email,
      sentToName: "Portal del cliente",
      // Se da por verificado en el acto: la sesion del portal ya
      // identifico a esta persona, y dejarlo en blanco haria pensar que
      // alguien entro sin identificarse.
      verifiedAt: new Date(),
      verifiedEmail: email,
    },
    select: { token: true },
  });

  return creado.token;
}

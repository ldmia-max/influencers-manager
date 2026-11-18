import { prisma } from "@/lib/prisma";
import { CampaignProfileStatus, Prisma } from "@prisma/client";
import { ValidationError, NotFoundError } from "./errors";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import {
  CODIGO_MINUTOS,
  MAX_INTENTOS,
  REENVIO_SEGUNDOS,
  codigoCoincide,
  generarCodigo,
  hashearCodigo,
  normalizarCorreo,
} from "@/lib/approval-session";

function validateToken(approvalToken: {
  expiresAt: Date;
  usedAt: Date | null;
  campaign: { status: string };
} | null) {
  if (!approvalToken) {
    throw new NotFoundError("Token no válido");
  }

  if (new Date() > approvalToken.expiresAt) {
    throw new ValidationError("EXPIRED_TOKEN");
  }

  if (approvalToken.usedAt) {
    throw new ValidationError("USED_TOKEN");
  }

  if (!ESTADOS_QUE_ADMITEN_APROBACION.includes(approvalToken.campaign.status)) {
    throw new ValidationError("INVALID_STATUS");
  }
}

/**
 * Estados en los que un enlace de aprobacion sirve.
 *
 * REVIEW es la revision inicial de toda la campana. ACTIVE se admite
 * porque a una campana en marcha se le puede sumar un reemplazo cuando
 * alguien se retira, y ese influencer nuevo necesita el visto bueno del
 * cliente sin reabrir lo que ya decidio.
 */
const ESTADOS_QUE_ADMITEN_APROBACION = ["REVIEW", "ACTIVE"];

/**
 * La campana que el cliente va a aprobar.
 *
 * Todo campo se nombra con `select`, nunca `include`. Con `include`,
 * Prisma devuelve todos los escalares del modelo, y por ahi bajaban al
 * navegador del cliente dos cosas que no le incumben: `basePrice` —lo
 * que cobra el influencer— y `motivoRetiro`. El precio con margen se
 * calculaba ademas EN EL NAVEGADOR, asi que `markupPercentage` tambien
 * viajaba: con los dos numeros delante, cualquiera que abriese las
 * herramientas de desarrollo veia el recargo exacto de la agencia.
 *
 * Ahora la multiplicacion se hace aqui y lo que viaja es `precio`, el
 * importe unitario final. Si alguien vuelve a necesitar el margen en el
 * cliente, lo que hay que mover al servidor es el calculo, no el dato.
 */
export async function getApprovalData(token: string) {
  const approvalToken = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    select: {
      token: true,
      expiresAt: true,
      usedAt: true,
      campaign: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          budget: true,
          currency: true,
          // Se lee para multiplicar aqui dentro; no se devuelve.
          markupPercentage: true,
          client: { select: { companyName: true } },
          clientContact: {
            select: { firstName: true, lastName: true, email: true },
          },
          profiles: {
            select: {
              id: true,
              status: true,
              // La franja y las graficas de arriba solo cuentan a quien
              // sigue contratado: un retirado aprobado ya no esta.
              participacion: true,
              profile: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  country: { select: { name: true } },
                  city: { select: { name: true } },
                  gender: { select: { displayName: true } },
                  department: { select: { name: true } },
                  categories: {
                    select: { category: { select: { name: true } } },
                  },
                },
              },
              platforms: {
                select: {
                  id: true,
                  status: true,
                  socialAccount: {
                    select: {
                      id: true,
                      username: true,
                      followers: true,
                      profilePicUrl: true,
                      platform: {
                        select: { id: true, name: true, displayName: true },
                      },
                    },
                  },
                  services: {
                    select: {
                      id: true,
                      quantity: true,
                      basePrice: true,
                      currency: true,
                      isApproved: true,
                      clientNotes: true,
                      esCombo: true,
                      comboDescripcion: true,
                      profileService: {
                        select: {
                          serviceType: {
                            select: { id: true, name: true, displayName: true },
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
    },
  });

  if (!approvalToken) {
    throw new NotFoundError("Token no válido");
  }

  if (new Date() > approvalToken.expiresAt) {
    throw new ValidationError("EXPIRED_TOKEN");
  }

  if (approvalToken.usedAt) {
    throw new ValidationError("USED_TOKEN");
  }

  if (!ESTADOS_QUE_ADMITEN_APROBACION.includes(approvalToken.campaign.status)) {
    throw new ValidationError("INVALID_STATUS");
  }

  const { markupPercentage, ...campana } = approvalToken.campaign;

  return {
    token: approvalToken.token,
    expiresAt: approvalToken.expiresAt,
    campaign: {
      ...campana,
      budget: campana.budget.toString(),
      profiles: campana.profiles.map((cp) => ({
        ...cp,
        platforms: cp.platforms.map((cpp) => ({
          ...cpp,
          services: cpp.services.map((cs) => {
            const { basePrice, ...servicio } = cs;
            return {
              ...servicio,
              // Importe unitario con el margen ya dentro, redondeado
              // aqui para que el cliente y la agencia nombren el mismo
              // numero y no dos que difieren en los decimales.
              precio: Math.round(
                calculateMarkupPrice(Number(basePrice), markupPercentage)
              ).toString(),
            };
          }),
        })),
      })),
    },
  };
}


export async function saveApprovalDecisions(
  token: string,
  decisions: {
    profiles?: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    platforms?: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    services?: {
      id: string;
      isApproved: boolean;
      rejectionReason?: string;
    }[];
  }
) {
  const approvalToken = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: {
      campaign: { select: { id: true, status: true } },
    },
  });

  validateToken(approvalToken);

  const now = new Date();

  if (decisions.profiles && decisions.profiles.length > 0) {
    for (const profile of decisions.profiles) {
      await prisma.campaignProfile.update({
        where: { id: profile.id },
        data: {
          status: profile.status,
          rejectionReason: profile.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }
  }

  if (decisions.platforms && decisions.platforms.length > 0) {
    for (const platform of decisions.platforms) {
      await prisma.campaignProfilePlatform.update({
        where: { id: platform.id },
        data: {
          status: platform.status,
          rejectionReason: platform.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }
  }

  if (decisions.services && decisions.services.length > 0) {
    for (const service of decisions.services) {
      await prisma.campaignService.update({
        where: { id: service.id },
        data: {
          isApproved: service.isApproved,
          rejectionReason: service.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }
  }
}

export async function submitApproval(
  token: string,
  finalDecisions: {
    profiles: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    platforms: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    services: {
      id: string;
      isApproved: boolean;
      rejectionReason?: string;
      clientNotes?: string;
    }[];
  }
) {
  const approvalToken = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          createdById: true,
          client: { select: { companyName: true } },
          clientContact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  validateToken(approvalToken);

  // Quien esta decidiendo. El enlace se emite a una persona concreta y
  // el codigo de verificacion viaja a SU correo, asi que el token es la
  // firma: sin esto la campana solo registraba que "el cliente" dijo
  // que si, y con varios contactos aprobando la misma campana esa es
  // justo la pregunta que hay que poder responder meses despues.
  const quienDecide = approvalToken!.clientContactId;
  const nombreDeQuienDecide =
    approvalToken!.sentToName ??
    `${approvalToken!.campaign.clientContact.firstName} ${approvalToken!.campaign.clientContact.lastName}`;

  const now = new Date();

  /**
   * Que puede decidir este enlace: SOLO lo que sigue pendiente en ESTA
   * campana.
   *
   * Antes se aplicaba lo que llegara, buscando por id a secas. Eso tenia
   * dos consecuencias. La visible: al reenviar una campana en marcha para
   * aprobar un reemplazo, el cliente veia otra vez a los que ya habia
   * decidido y podia cambiarlos, incluido rechazar a alguien que ya
   * habia publicado —y a un rechazado se le retira en el acto, asi que
   * se perdia trabajo contratado—. La invisible, peor: el id no se
   * comprobaba contra la campana del token, de modo que un envio
   * manipulado podia escribir en la campana de OTRO cliente.
   *
   * La lista se construye aqui, desde la base de datos, y no se confia
   * en la que manda el navegador.
   */
  const decidibles = await prisma.campaignProfile.findMany({
    where: {
      campaignId: approvalToken!.campaignId,
      status: "PENDING",
      participacion: "ACTIVO",
    },
    select: {
      id: true,
      platforms: { select: { id: true, services: { select: { id: true } } } },
    },
  });

  const perfilesAbiertos = new Set(decidibles.map((p) => p.id));
  const plataformasAbiertas = new Set(
    decidibles.flatMap((p) => p.platforms.map((pl) => pl.id))
  );
  const serviciosAbiertos = new Set(
    decidibles.flatMap((p) => p.platforms.flatMap((pl) => pl.services.map((s) => s.id)))
  );

  // Lo que no estaba abierto se descarta sin ruido: no es un ataque
  // necesariamente, tambien es lo que manda un enlace viejo abierto en
  // otra pestana.
  const perfiles = finalDecisions.profiles.filter((p) => perfilesAbiertos.has(p.id));
  const plataformas = finalDecisions.platforms.filter((p) =>
    plataformasAbiertas.has(p.id)
  );
  const servicios = finalDecisions.services.filter((s) => serviciosAbiertos.has(s.id));

  if (perfiles.length === 0) {
    throw new ValidationError("NADA_QUE_APROBAR");
  }

  await prisma.$transaction(async (tx) => {
    for (const profile of perfiles) {
      await tx.campaignProfile.update({
        where: { id: profile.id },
        data: {
          status: profile.status,
          rejectionReason: profile.rejectionReason || null,
          reviewedAt: now,
          revisadoPorId: quienDecide,
        },
      });
    }

    for (const platform of plataformas) {
      await tx.campaignProfilePlatform.update({
        where: { id: platform.id },
        data: {
          status: platform.status,
          rejectionReason: platform.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }

    for (const service of servicios) {
      await tx.campaignService.update({
        where: { id: service.id },
        data: {
          isApproved: service.isApproved,
          clientNotes: service.clientNotes || null,
          rejectionReason: service.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }

    await tx.campaignApprovalToken.update({
      where: { id: approvalToken!.id },
      data: { usedAt: now },
    });

    await aplicarRespuestaDelCliente(
      tx,
      approvalToken!.campaignId,
      approvalToken!.campaign.status,
      now
    );
  });

  const summary = {
    totalProfiles: perfiles.length,
    approvedProfiles: perfiles.filter((p) => p.status === "APPROVED").length,
    rejectedProfiles: perfiles.filter((p) => p.status === "REJECTED").length,
    totalPlatforms: plataformas.length,
    approvedPlatforms: plataformas.filter((p) => p.status === "APPROVED").length,
    rejectedPlatforms: plataformas.filter((p) => p.status === "REJECTED").length,
    totalServices: servicios.length,
    approvedServices: servicios.filter((s) => s.isApproved).length,
    rejectedServices: servicios.filter((s) => !s.isApproved).length,
  };

  return {
    summary,
    emailData: {
      campaignId: approvalToken!.campaign.id,
      campaignName: approvalToken!.campaign.name,
      clientName: approvalToken!.campaign.client.companyName,
      // Quien respondio, no el contacto principal: el correo al equipo
      // tiene que nombrar a la persona que acaba de decidir.
      contactName: nombreDeQuienDecide,
      createdById: approvalToken!.campaign.createdById,
      // El correo al equipo habla de lo que se acaba de decidir, no de
      // lo que ya estaba decidido de antes.
      rejectedProfileIds: perfiles
        .filter((p) => p.status === "REJECTED")
        .map((p) => p.id),
    },
  };
}

/**
 * Lo que sigue a una respuesta del cliente, venga del portal o de la
 * agencia decidiendo por el.
 *
 * Si queda aunque sea UN aprobado en la campana, pasa a En proceso: ese
 * trabajo esta contratado y puede empezar hoy. Se cuentan los aprobados
 * de toda la campana y no solo los de esta tanda: la agencia puede haber
 * aprobado a uno y el cliente rechazado al resto, y con la cuenta por
 * tanda esa campana volvia a Abierta con alguien contratado dentro.
 *
 * Si no queda ninguno, vuelve a Abierta. Dejarla en marcha sin un solo
 * influencer contratado no describe nada real, y Abierta es el unico
 * estado donde el equipo puede rehacer la propuesta. Alli NO se retira a
 * nadie: el equipo necesita ver a los rechazados con sus precios para
 * decidir a quien cambia.
 *
 * Camino de En proceso, a los rechazados se les retira. Sin esto
 * seguirian contando en el total y bloquearian el cierre para siempre:
 * la comprobacion de entregas cuenta los formatos de todo perfil activo,
 * y nadie va a publicar los suyos. Con la campana ya en marcha tambien:
 * un reemplazo rechazado no puede quedarse dentro.
 *
 * Una campana ya en marcha no cambia de etapa: puede haber reemplazos
 * en juego mientras el resto sigue publicando.
 */
async function aplicarRespuestaDelCliente(
  tx: Prisma.TransactionClient,
  campaignId: string,
  estadoActual: string,
  ahora: Date
): Promise<string> {
  const aprobados = await tx.campaignProfile.count({
    where: { campaignId, status: "APPROVED", participacion: "ACTIVO" },
  });
  const enMarcha = estadoActual === "ACTIVE" || aprobados > 0;

  if (enMarcha) {
    const rechazados = await tx.campaignProfile.findMany({
      where: { campaignId, status: "REJECTED", participacion: "ACTIVO" },
      select: { id: true, rejectionReason: true },
    });
    for (const r of rechazados) {
      await tx.campaignProfile.update({
        where: { id: r.id },
        data: {
          participacion: "RETIRADO",
          origenRetiro: "CLIENTE",
          motivoRetiro: r.rejectionReason ?? null,
          retiradoEn: ahora,
        },
      });
    }
  }

  if (estadoActual === "ACTIVE") return estadoActual;
  const nuevo = enMarcha ? "ACTIVE" : "DRAFT";
  await tx.campaign.update({ where: { id: campaignId }, data: { status: nuevo } });
  return nuevo;
}

// =====================================================================
// La agencia decide por el cliente
// =====================================================================

/**
 * Lo comun a decidir un formato o un influencer en nombre del cliente:
 * la campana tiene que estar esperando una respuesta, y el influencer
 * pertenecer a ESA campana, seguir pendiente y seguir dentro.
 *
 * Lo que el cliente ya contesto no se toca desde aqui: su respuesta es
 * un hecho. Para eso estan "Deshacer rechazo" y retirar.
 */
function exigirDecidible(perfil: {
  status: string;
  participacion: string;
  campaign: { status: string };
}) {
  if (!ESTADOS_QUE_ADMITEN_APROBACION.includes(perfil.campaign.status)) {
    throw new ValidationError(
      "Solo se decide por el cliente con la campaña en Revisión o En proceso."
    );
  }
  if (perfil.participacion !== "ACTIVO") {
    throw new ValidationError("Este influencer ya fue retirado de la campaña.");
  }
  if (perfil.status !== "PENDING") {
    throw new ValidationError("Este influencer ya tiene respuesta del cliente.");
  }
}

/**
 * Aprueba o rechaza UN formato de un influencer pendiente, en nombre del
 * cliente.
 *
 * Se guarda en el acto, sin esperar a decidir al influencer: es lo que
 * deja marcar los formatos uno a uno antes de aprobarlo. Solo mientras
 * siga pendiente; una vez decidido, sus formatos son lo que se acordo.
 */
export async function decidirFormatoPorElCliente(
  campaignId: string,
  servicioId: string,
  datos: { aprobado: boolean; motivo?: string | null }
) {
  const servicio = await prisma.campaignService.findUnique({
    where: { id: servicioId },
    select: {
      id: true,
      esCombo: true,
      profileService: { select: { serviceType: { select: { displayName: true } } } },
      campaignProfilePlatform: {
        select: {
          campaignProfile: {
            select: {
              id: true,
              campaignId: true,
              status: true,
              participacion: true,
              profile: { select: { id: true, name: true } },
              campaign: { select: { id: true, name: true, status: true } },
            },
          },
        },
      },
    },
  });
  const perfil = servicio?.campaignProfilePlatform.campaignProfile;
  // Un formato de otra campana se trata como inexistente: el id solo no
  // basta para escribir en ella.
  if (!servicio || !perfil || perfil.campaignId !== campaignId) {
    throw new NotFoundError("Formato no encontrado en la campaña");
  }
  exigirDecidible(perfil);

  await prisma.campaignService.update({
    where: { id: servicioId },
    data: {
      isApproved: datos.aprobado,
      rejectionReason: datos.aprobado ? null : datos.motivo?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  return {
    id: servicio.id,
    formato: servicio.esCombo
      ? "Combo"
      : (servicio.profileService?.serviceType.displayName ?? "Formato"),
    influencer: perfil.profile,
    campana: perfil.campaign,
  };
}

/**
 * Aprueba o rechaza a un influencer pendiente en nombre del cliente.
 *
 * Hace lo mismo que el portal con ese influencer, y por eso comparte con
 * el `aplicarRespuestaDelCliente`: cuando en una campana en Revision ya
 * no queda nadie pendiente, la etapa avanza igual que si hubiera
 * contestado el cliente. Mientras quede alguien, la campana sigue en
 * Revision y el cliente puede contestar el resto con su enlace.
 *
 * `revisadoPorId` queda vacio a proposito: lo decidio la agencia, y
 * poner al contacto principal seria inventarle una firma. Quien fue
 * queda en la auditoria.
 *
 * Aprobar exige al menos un formato aprobado: aprobar a alguien sin nada
 * que hacer es un rechazo con otro nombre. Cada red queda aprobada si le
 * queda algun formato aprobado, rechazada si no.
 */
export async function decidirInfluencerPorElCliente(
  campaignId: string,
  campaignProfileId: string,
  datos: { aprobado: boolean; motivo?: string | null }
) {
  const perfil = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: {
      id: true,
      campaignId: true,
      status: true,
      participacion: true,
      profile: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true, status: true } },
      platforms: {
        select: { id: true, services: { select: { isApproved: true } } },
      },
    },
  });
  if (!perfil || perfil.campaignId !== campaignId) {
    throw new NotFoundError("Influencer no encontrado en la campaña");
  }
  exigirDecidible(perfil);

  const motivo = datos.motivo?.trim() || null;
  if (!datos.aprobado && !motivo) {
    throw new ValidationError("Escribe el motivo del rechazo.");
  }
  if (
    datos.aprobado &&
    !perfil.platforms.some((pl) => pl.services.some((s) => s.isApproved))
  ) {
    throw new ValidationError(
      "Todos sus formatos están rechazados: apruébale al menos uno o rechaza al influencer."
    );
  }

  const ahora = new Date();
  const estadoFinal = await prisma.$transaction(async (tx) => {
    await tx.campaignProfile.update({
      where: { id: campaignProfileId },
      data: {
        status: datos.aprobado ? "APPROVED" : "REJECTED",
        rejectionReason: datos.aprobado ? null : motivo,
        reviewedAt: ahora,
        revisadoPorId: null,
      },
    });

    for (const pl of perfil.platforms) {
      const conAlgo = pl.services.some((s) => s.isApproved);
      await tx.campaignProfilePlatform.update({
        where: { id: pl.id },
        data: {
          status: datos.aprobado && conAlgo ? "APPROVED" : "REJECTED",
          reviewedAt: ahora,
        },
      });
    }

    // En Revision la etapa solo se mueve cuando ya no queda nadie por
    // contestar; con la campana en marcha se aplica en el acto, que es lo
    // que retira a un reemplazo rechazado.
    if (perfil.campaign.status === "REVIEW") {
      const quedan = await tx.campaignProfile.count({
        where: { campaignId, status: "PENDING", participacion: "ACTIVO" },
      });
      if (quedan > 0) return "REVIEW";
    }
    return aplicarRespuestaDelCliente(tx, campaignId, perfil.campaign.status, ahora);
  });

  return {
    id: perfil.id,
    influencer: perfil.profile,
    campana: { ...perfil.campaign, estadoFinal },
  };
}

export async function getRejectedProfileDetails(profileIds: string[]) {
  return prisma.campaignProfile.findMany({
    where: { id: { in: profileIds } },
    select: {
      rejectionReason: true,
      profile: { select: { name: true } },
    },
  });
}

// =====================================================================
// Verificacion de acceso al portal de aprobacion
// =====================================================================

/**
 * Comprueba el token y devuelve a quien va dirigido, sin exponer datos
 * de la campana. Se usa antes de verificar el correo, cuando todavia no
 * hay sesion: solo dice si el enlace sirve y da el nombre del contacto
 * y una pista del correo, nunca la direccion completa.
 */
export async function estadoDelToken(token: string) {
  const registro = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: { campaign: { select: { id: true, name: true, status: true } } },
  });

  if (!registro) throw new NotFoundError("Token no encontrado");
  if (registro.expiresAt < new Date()) throw new ValidationError("EXPIRED_TOKEN");

  /**
   * Un enlace agotado no es un error: es una revision que ya pasó.
   *
   * Cada contacto de la campana recibe el suyo, y basta con que uno
   * conteste para que no quede nada que decidir. Los demas abrian el
   * enlace y se encontraban "este enlace ya fue utilizado", que suena a
   * averia y les deja sin ver lo que su compañero acababa de aprobar en
   * su nombre. Se les manda al portal, donde la campana sigue estando.
   *
   * Son tres situaciones y las tres llevan al mismo sitio: su propio
   * enlace ya se uso, otro contesto antes y no queda nada pendiente, o
   * la campana salio de los estados que admiten aprobacion.
   */
  const pendientes = await prisma.campaignProfile.count({
    where: {
      campaignId: registro.campaignId,
      status: "PENDING",
      participacion: "ACTIVO",
    },
  });

  const agotado =
    Boolean(registro.usedAt) ||
    pendientes === 0 ||
    !ESTADOS_QUE_ADMITEN_APROBACION.includes(registro.campaign.status);

  return {
    campaignId: registro.campaign.id,
    campaignName: registro.campaign.name,
    sentToName: registro.sentToName,
    // Pista del tipo "ma***@empresa.com": suficiente para que el
    // destinatario legitimo se reconozca, inutil para adivinarla.
    pistaCorreo: enmascararCorreo(registro.sentToEmail),
    agotado,
  };
}

function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!dominio) return "***";
  const visible = usuario.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}

/**
 * Guarda el codigo (hasheado) para un token, si el correo coincide.
 *
 * Devuelve el codigo en claro SOLO para poder enviarlo por correo; no
 * debe salir nunca en la respuesta HTTP. Si el correo no coincide
 * devuelve null y quien llama responde igual que si coincidiera, para
 * no revelar a que direccion se envio la campana.
 */
export async function prepararCodigo(token: string, correo: string) {
  const registro = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: { campaign: { select: { name: true, status: true } } },
  });

  if (!registro) throw new NotFoundError("Token no encontrado");
  if (registro.usedAt) throw new ValidationError("USED_TOKEN");
  if (registro.expiresAt < new Date()) throw new ValidationError("EXPIRED_TOKEN");
  // La misma lista que admite la aprobacion en si. Exigir REVIEW aqui
  // dejaba fuera el caso para el que existe el enlace en una campana en
  // marcha: el cliente recibia el correo del reemplazo, abria el enlace
  // y se encontraba "la campana ya no esta disponible para revision",
  // sin poder pedir siquiera su codigo.
  if (!ESTADOS_QUE_ADMITEN_APROBACION.includes(registro.campaign.status)) {
    throw new ValidationError("INVALID_STATUS");
  }

  if (normalizarCorreo(registro.sentToEmail) !== normalizarCorreo(correo)) {
    return null;
  }

  // Freno de reenvio: evita que el formulario sirva para bombardear de
  // correos a un destinatario real.
  if (
    registro.codeSentAt &&
    Date.now() - registro.codeSentAt.getTime() < REENVIO_SEGUNDOS * 1000
  ) {
    throw new ValidationError("REENVIO_DEMASIADO_PRONTO");
  }

  const codigo = generarCodigo();

  await prisma.campaignApprovalToken.update({
    where: { id: registro.id },
    data: {
      codeHash: hashearCodigo(codigo),
      codeExpiresAt: new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000),
      codeSentAt: new Date(),
      codeAttempts: 0,
    },
  });

  return {
    codigo,
    destino: registro.sentToEmail,
    nombre: registro.sentToName,
    campaignName: registro.campaign.name,
  };
}

/**
 * Valida el codigo. Devuelve el correo verificado si es correcto.
 *
 * Cada intento fallido cuenta; al llegar a MAX_INTENTOS el codigo se
 * borra y hay que pedir otro. Sin ese limite, seis digitos se agotan
 * por fuerza bruta en minutos.
 */
export async function validarCodigo(token: string, codigo: string) {
  const registro = await prisma.campaignApprovalToken.findUnique({
    where: { token },
  });

  if (!registro) throw new NotFoundError("Token no encontrado");
  if (registro.usedAt) throw new ValidationError("USED_TOKEN");
  if (registro.expiresAt < new Date()) throw new ValidationError("EXPIRED_TOKEN");

  if (!registro.codeHash || !registro.codeExpiresAt) {
    throw new ValidationError("SIN_CODIGO");
  }
  if (registro.codeExpiresAt < new Date()) {
    throw new ValidationError("CODIGO_EXPIRADO");
  }
  if (registro.codeAttempts >= MAX_INTENTOS) {
    throw new ValidationError("DEMASIADOS_INTENTOS");
  }

  if (!codigoCoincide(codigo, registro.codeHash)) {
    await prisma.campaignApprovalToken.update({
      where: { id: registro.id },
      data: { codeAttempts: { increment: 1 } },
    });
    throw new ValidationError("CODIGO_INCORRECTO");
  }

  // Correcto: se consume el codigo y se deja la traza de quien entro.
  await prisma.campaignApprovalToken.update({
    where: { id: registro.id },
    data: {
      codeHash: null,
      codeExpiresAt: null,
      codeAttempts: 0,
      verifiedAt: new Date(),
      verifiedEmail: registro.sentToEmail,
    },
  });

  return { email: registro.sentToEmail };
}

import { prisma } from "@/lib/prisma";
import { ValidationError, NotFoundError } from "./errors";
import { unidadesEsperadas } from "@/lib/entregas";
import { limpiarUrlPublicacion } from "@/lib/social-handles";
import type { OrigenRetiro } from "@prisma/client";

/**
 * Entregas de contenido y participacion de los influencers.
 *
 * Los influencers no tienen cuenta en la aplicacion: los links los pega
 * el personal de la agencia, y por eso cada entrega guarda quien la
 * registro en lugar de un autor externo.
 */

/** Formatos que la aplicacion sabe leer al refrescar metricas. */
const ANFITRIONES_VALIDOS = [
  "instagram.com",
  "www.instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "kick.com",
  "www.kick.com",
];

/**
 * Comprueba que el link es una URL de una red conocida.
 *
 * No se acepta cualquier texto porque de estos links salen las metricas:
 * uno mal pegado se descubriria semanas despues, al ver que esa entrega
 * es la unica sin datos.
 */
function validarUrl(valor: string): string {
  const limpia = valor.trim();
  if (!limpia) throw new ValidationError("El link no puede estar vacío");

  let url: URL;
  try {
    url = new URL(limpia);
  } catch {
    throw new ValidationError(
      "El link no es una URL válida. Debe empezar por https://"
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("El link debe ser una dirección web (https://)");
  }

  if (!ANFITRIONES_VALIDOS.includes(url.hostname.toLowerCase())) {
    throw new ValidationError(
      `«${url.hostname}» no es una red reconocida. Se admiten links de Instagram, TikTok, YouTube y Kick.`
    );
  }

  // Se guarda el enlace de la publicacion, no el rastro de quien lo
  // copio: al pegar desde Instagram viene con ?utm_source=...&stkn=...,
  // y ese stkn es un token de la sesion de esa persona.
  return limpiarUrlPublicacion(url.toString());
}

/** Lo que necesita la ficha de campana para pintar el bloque de entregas. */
export async function getEntregasDeCampana(campaignId: string) {
  const campana = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      profiles: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          participacion: true,
          origenRetiro: true,
          motivoRetiro: true,
          retiradoEn: true,
          profile: { select: { id: true, name: true } },
          platforms: {
            select: {
              id: true,
              socialAccount: {
                select: {
                  id: true,
                  username: true,
                  platform: { select: { name: true, displayName: true } },
                },
              },
              services: {
                select: {
                  id: true,
                  quantity: true,
                  esCombo: true,
                  comboDescripcion: true,
                  fechaLimite: true,
                  profileService: {
                    select: {
                      serviceType: { select: { displayName: true, esEfimero: true } },
                    },
                  },
                  entregas: {
                    orderBy: { entregadoEn: "asc" },
                    select: {
                      id: true,
                      url: true,
                      entregadoEn: true,
                      publicadoEn: true,
                      notas: true,
                      serviceType: {
                        select: { id: true, displayName: true, esEfimero: true },
                      },
                      registradoPor: { select: { id: true, name: true } },
                      metricas: {
                        orderBy: { capturadoEn: "desc" },
                        take: 1,
                        select: {
                          capturadoEn: true,
                          origen: true,
                          vistas: true,
                          meGusta: true,
                          comentarios: true,
                          compartidos: true,
                          guardados: true,
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

  if (!campana) throw new NotFoundError("Campaña no encontrada");
  return campana;
}

/**
 * Registra una entrega de un formato.
 *
 * Con enlace en los formatos normales, y con solo la fecha de emision en
 * los efimeros —stories y directos—, donde la plataforma no publica
 * ninguna URL permanente. En esos la prueba es la confirmacion de quien
 * la registra, que queda guardada en `registradoPorId`.
 */
/** Lo minimo que hace falta saber de un formato para registrar una pieza. */
interface FormatoResuelto {
  id: string | null;
  displayName: string;
  esEfimero: boolean;
}

/**
 * Que formato describe una entrega.
 *
 * El formato contratado no siempre lo dice: un combo agrupa varios
 * ("Reel + 3 Stories") por un precio cerrado y no tiene ProfileService
 * detras, asi que antes toda pieza de un combo se trataba como contenido
 * con enlace y la Story no habia manera de registrarla.
 *
 * Cuando se senala un formato, manda: describe lo que se publico de
 * verdad. Si no se senala se cae al contratado, que en un formato simple
 * es exacto —asi siguen valiendo las entregas registradas antes de que
 * existiera este campo y las que entren por API sin indicarlo—.
 *
 * El formato senalado tiene que ser de la misma plataforma de la cuenta:
 * un Reel de Instagram en una entrega de TikTok no describe nada, y sus
 * metricas se irian a leer a la red equivocada.
 */
async function resolverFormato(
  serviceTypeId: string | null | undefined,
  servicio: {
    esCombo: boolean;
    profileService: {
      serviceType: { esEfimero: boolean; displayName: string };
    } | null;
    campaignProfilePlatform: {
      socialAccount: {
        platformId: string;
        platform: { displayName: string };
      };
    };
  }
): Promise<FormatoResuelto> {
  if (serviceTypeId) {
    const tipo = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { id: true, displayName: true, esEfimero: true, platformId: true },
    });
    if (!tipo) throw new NotFoundError("Formato no encontrado");

    const cuenta = servicio.campaignProfilePlatform.socialAccount;
    if (tipo.platformId !== cuenta.platformId) {
      throw new ValidationError(
        `«${tipo.displayName}» no es un formato de ${cuenta.platform.displayName}.`
      );
    }

    return { id: tipo.id, displayName: tipo.displayName, esEfimero: tipo.esEfimero };
  }

  if (servicio.esCombo) {
    throw new ValidationError(
      "Indica qué formato es esta entrega: un combo agrupa varios y no puede deducirse."
    );
  }

  const contratado = servicio.profileService?.serviceType;
  return {
    id: null,
    displayName: contratado?.displayName ?? "Formato",
    esEfimero: contratado?.esEfimero ?? false,
  };
}

export async function registrarEntrega(datos: {
  campaignServiceId: string;
  /**
   * Que formato es esta pieza. Se pide siempre desde la interfaz, para
   * que registrar contenido sea el mismo gesto en un formato simple y
   * en un combo. Solo es imprescindible en el combo: ahi no hay formato
   * contratado del que deducirlo.
   */
  serviceTypeId?: string | null;
  url?: string | null;
  publicadoEn?: Date | null;
  notas?: string | null;
  /**
   * Vistas que reporta el creador. Solo en formatos efimeros: en los
   * demas las lee Apify, y aceptar un numero a mano abriria la puerta a
   * que conviviera con el medido sin que nadie sepa cual manda.
   */
  vistasReportadas?: number | null;
  usuarioId: string;
}) {
  const servicio = await prisma.campaignService.findUnique({
    where: { id: datos.campaignServiceId },
    select: {
      id: true,
      esCombo: true,
      profileService: {
        select: { serviceType: { select: { esEfimero: true, displayName: true } } },
      },
      campaignProfilePlatform: {
        select: {
          socialAccount: {
            select: {
              platformId: true,
              platform: { select: { displayName: true } },
            },
          },
          campaignProfile: {
            select: {
              participacion: true,
              status: true,
              campaign: { select: { id: true, status: true } },
            },
          },
        },
      },
    },
  });

  if (!servicio) throw new NotFoundError("Formato no encontrado");

  // Que formato es esta pieza. Manda el senalado sobre el contratado:
  // describe lo que se publico de verdad, y de el salen las reglas
  // —si lleva enlace o fecha, si admite vistas a mano—. Un combo no
  // tiene contratado que consultar, asi que ahi es obligatorio.
  const formato = await resolverFormato(datos.serviceTypeId, servicio);
  const esEfimero = formato.esEfimero;

  let url: string | null = null;
  if (esEfimero) {
    // Aceptar un link aqui seria aceptar uno que caduca en horas, y el
    // cliente encontraria un enlace roto donde deberia haber una prueba.
    if (datos.url?.trim()) {
      throw new ValidationError(
        `«${formato.displayName}» no deja enlace permanente: confirma la emisión con su fecha, sin link.`
      );
    }
    if (!datos.publicadoEn) {
      throw new ValidationError("Indica la fecha en que se emitió");
    }
  } else {
    if (datos.vistasReportadas != null) {
      throw new ValidationError(
        "Las vistas de este formato se leen de la plataforma, no se escriben a mano."
      );
    }
    if (!datos.url?.trim()) {
      throw new ValidationError("Pega el link de la publicación");
    }
    url = validarUrl(datos.url);
  }

  const perfil = servicio.campaignProfilePlatform.campaignProfile;

  // Un retirado no entrega: si se le registran links, o no estaba
  // retirado de verdad o el link es de otro.
  if (perfil.participacion !== "ACTIVO") {
    throw new ValidationError(
      "Este influencer está retirado de la campaña. Reactívalo antes de registrar entregas."
    );
  }

  // Tampoco entrega quien todavia espera el visto bueno: seria contenido
  // de un trabajo que aun no se ha encargado. La ficha ya no lo muestra
  // en Entregas, pero la regla vive aqui para que valga tambien por API.
  if (perfil.status === "PENDING") {
    throw new ValidationError(
      "Este influencer todavía espera aprobación: apruébalo antes de registrar entregas."
    );
  }

  if (perfil.campaign.status === "DRAFT") {
    throw new ValidationError(
      "La campaña todavía es un borrador: actívala antes de registrar entregas."
    );
  }

  // Solo se comprueba el duplicado cuando hay link. En los efimeros cada
  // fila es una emision distinta y repetir fecha es legitimo.
  if (url) {
    const existente = await prisma.campaignEntrega.findUnique({
      where: {
        campaignServiceId_url: { campaignServiceId: datos.campaignServiceId, url },
      },
      select: { id: true },
    });
    if (existente) {
      throw new ValidationError("Ese link ya está registrado en este formato");
    }
  }

  const entrega = await prisma.campaignEntrega.create({
    data: {
      campaignServiceId: datos.campaignServiceId,
      url,
      publicadoEn: datos.publicadoEn ?? null,
      notas: datos.notas?.trim() || null,
      serviceTypeId: formato.id,
      registradoPorId: datos.usuarioId,
    },
    select: { id: true, url: true, entregadoEn: true },
  });

  if (datos.vistasReportadas != null) {
    await registrarVistasReportadas(
      entrega.id,
      datos.vistasReportadas,
      datos.usuarioId
    );
  }

  return entrega;
}

/**
 * Anota las vistas que reporto el creador de un contenido efimero.
 *
 * Crea una captura nueva en vez de corregir la anterior, igual que hace
 * el refresco automatico. Una historia se mira durante horas, asi que la
 * cifra del primer dia y la del tercero son datos distintos, no una
 * correccion; guardar las dos permite dibujar la curva y deja claro
 * quien dijo que y cuando.
 */
export async function registrarVistasReportadas(
  entregaId: string,
  vistas: number,
  usuarioId: string
) {
  if (!Number.isFinite(vistas) || vistas < 0) {
    throw new ValidationError("Las vistas deben ser un número igual o mayor que cero");
  }

  const entrega = await prisma.campaignEntrega.findUnique({
    where: { id: entregaId },
    select: {
      id: true,
      url: true,
      serviceType: { select: { esEfimero: true } },
      campaignService: {
        select: {
          esCombo: true,
          profileService: {
            select: { serviceType: { select: { esEfimero: true, displayName: true } } },
          },
        },
      },
    },
  });
  if (!entrega) throw new NotFoundError("Entrega no encontrada");

  // El formato senalado al registrarla manda; si no lo hay, el
  // contratado. Un combo sin formato senalado no dice que es, asi que no
  // admite cifras a mano.
  const esEfimero = entrega.serviceType
    ? entrega.serviceType.esEfimero
    : !entrega.campaignService.esCombo &&
      (entrega.campaignService.profileService?.serviceType.esEfimero ?? false);

  // En un formato con enlace las cifras las lee Apify. Dejar escribirlas
  // a mano crearia dos verdades para el mismo contenido.
  if (!esEfimero) {
    throw new ValidationError(
      "Este formato tiene enlace: sus métricas se leen de la plataforma."
    );
  }

  return prisma.campaignEntregaMetrica.create({
    data: {
      entregaId,
      vistas: Math.round(vistas),
      origen: "REPORTADA",
      reportadaPorId: usuarioId,
    },
    select: { id: true, vistas: true, capturadoEn: true },
  });
}

/** Corrige un link ya registrado. */
export async function actualizarEntrega(
  id: string,
  datos: { url?: string; publicadoEn?: Date | null; notas?: string | null }
) {
  const entrega = await prisma.campaignEntrega.findUnique({
    where: { id },
    select: { id: true, campaignServiceId: true },
  });
  if (!entrega) throw new NotFoundError("Entrega no encontrada");

  const url =
    datos.url !== undefined && datos.url !== null && datos.url.trim()
      ? validarUrl(datos.url)
      : undefined;

  if (url) {
    const choque = await prisma.campaignEntrega.findUnique({
      where: {
        campaignServiceId_url: {
          campaignServiceId: entrega.campaignServiceId,
          url,
        },
      },
      select: { id: true },
    });
    if (choque && choque.id !== id) {
      throw new ValidationError("Ese link ya está registrado en este formato");
    }
  }

  return prisma.campaignEntrega.update({
    where: { id },
    data: {
      ...(url !== undefined && { url }),
      ...(datos.publicadoEn !== undefined && { publicadoEn: datos.publicadoEn }),
      ...(datos.notas !== undefined && { notas: datos.notas?.trim() || null }),
    },
    select: { id: true, url: true },
  });
}

/**
 * Borra un link. Se lleva por delante su historico de metricas, que sin
 * el link no significa nada.
 */
export async function eliminarEntrega(id: string) {
  const entrega = await prisma.campaignEntrega.findUnique({
    where: { id },
    select: { id: true, url: true },
  });
  if (!entrega) throw new NotFoundError("Entrega no encontrada");

  await prisma.campaignEntrega.delete({ where: { id } });
  return entrega;
}

/**
 * Pone la fecha tope de un formato.
 *
 * Va por formato y no por campana porque los plazos reales no son
 * uniformes: el reel puede vencer el dia del lanzamiento y las stories
 * una semana despues.
 */
export async function fijarFechaLimite(
  campaignServiceId: string,
  fecha: Date | null
) {
  const servicio = await prisma.campaignService.findUnique({
    where: { id: campaignServiceId },
    select: { id: true },
  });
  if (!servicio) throw new NotFoundError("Formato no encontrado");

  return prisma.campaignService.update({
    where: { id: campaignServiceId },
    data: { fechaLimite: fecha },
    select: { id: true, fechaLimite: true },
  });
}

/** Aplica la misma fecha a todos los formatos de una campana. */
export async function fijarFechaLimiteDeCampana(
  campaignId: string,
  fecha: Date | null
) {
  const { count } = await prisma.campaignService.updateMany({
    where: {
      campaignProfilePlatform: { campaignProfile: { campaignId } },
    },
    data: { fechaLimite: fecha },
  });
  return { formatosActualizados: count };
}

/**
 * Retira a un influencer de la campana.
 *
 * No se borra el registro: es historia comercial de lo que se llego a
 * acordar, y ademas sus entregas ya registradas siguen teniendo sentido.
 * Simplemente deja de sumar, liberando presupuesto.
 */
export async function retirarInfluencer(
  campaignProfileId: string,
  datos: { origen: OrigenRetiro; motivo?: string | null }
) {
  const perfil = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: {
      id: true,
      participacion: true,
      campaign: { select: { id: true, name: true, status: true } },
      profile: { select: { id: true, name: true } },
    },
  });
  if (!perfil) throw new NotFoundError("Influencer no encontrado en la campaña");

  if (perfil.participacion === "RETIRADO") {
    throw new ValidationError("Este influencer ya estaba retirado");
  }

  if (perfil.campaign.status === "COMPLETED" || perfil.campaign.status === "CANCELLED") {
    throw new ValidationError(
      "La campaña ya está cerrada: no se puede cambiar quién participó en ella"
    );
  }

  const actualizado = await prisma.campaignProfile.update({
    where: { id: campaignProfileId },
    data: {
      participacion: "RETIRADO",
      origenRetiro: datos.origen,
      motivoRetiro: datos.motivo?.trim() || null,
      retiradoEn: new Date(),
    },
    select: { id: true, participacion: true, retiradoEn: true },
  });

  return { ...actualizado, campana: perfil.campaign, influencer: perfil.profile };
}

/** Devuelve a un influencer a la campana, por si el retiro fue un error. */
export async function reactivarInfluencer(campaignProfileId: string) {
  const perfil = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: {
      id: true,
      participacion: true,
      campaign: { select: { id: true, name: true, status: true } },
      profile: { select: { id: true, name: true } },
    },
  });
  if (!perfil) throw new NotFoundError("Influencer no encontrado en la campaña");

  if (perfil.participacion === "ACTIVO") {
    throw new ValidationError("Este influencer ya está activo");
  }

  if (perfil.campaign.status === "COMPLETED" || perfil.campaign.status === "CANCELLED") {
    throw new ValidationError(
      "La campaña ya está cerrada: no se puede cambiar quién participó en ella"
    );
  }

  const actualizado = await prisma.campaignProfile.update({
    where: { id: campaignProfileId },
    data: {
      participacion: "ACTIVO",
      origenRetiro: null,
      motivoRetiro: null,
      retiradoEn: null,
    },
    select: { id: true, participacion: true },
  });

  return { ...actualizado, campana: perfil.campaign, influencer: perfil.profile };
}

/**
 * Que le falta a una campana para poder cerrarse.
 *
 * Devuelve una lista de pendientes por influencer en vez de un booleano:
 * "no se puede completar" sin decir quien falta obliga a buscarlo a mano
 * por toda la ficha.
 *
 * Los retirados no se miran: ya no deben nada.
 */
export async function entregasPendientesDeCampana(campaignId: string): Promise<
  { influencer: string; entregados: number; esperados: number }[]
> {
  const perfiles = await prisma.campaignProfile.findMany({
    // Aprobados y activos. Un PENDING reclamaria formatos que nadie
    // puede entregar —no se le pueden registrar entregas hasta que el
    // cliente lo apruebe—, y la campana no podria cerrarse jamas por
    // culpa de una propuesta que quedo sin contestar.
    where: { campaignId, participacion: "ACTIVO", status: { not: "PENDING" } },
    select: {
      profile: { select: { name: true } },
      platforms: {
        select: {
          services: {
            select: {
              quantity: true,
              esCombo: true,
              _count: { select: { entregas: true } },
            },
          },
        },
      },
    },
  });

  const pendientes: { influencer: string; entregados: number; esperados: number }[] = [];

  for (const perfil of perfiles) {
    let entregados = 0;
    let esperados = 0;
    for (const plataforma of perfil.platforms) {
      for (const servicio of plataforma.services) {
        esperados += unidadesEsperadas(servicio);
        entregados += Math.min(servicio._count.entregas, unidadesEsperadas(servicio));
      }
    }
    if (entregados < esperados) {
      pendientes.push({ influencer: perfil.profile.name, entregados, esperados });
    }
  }

  return pendientes;
}

/**
 * Nivel de cumplimiento historico de un influencer, en todas sus
 * campanas. Alimenta la ficha del perfil y la decision de volver a
 * contratarlo.
 */
export async function formatosHistoricosDeInfluencer(profileId: string) {
  return prisma.campaignService.findMany({
    where: {
      campaignProfilePlatform: {
        campaignProfile: { profileId, participacion: "ACTIVO" },
      },
      fechaLimite: { not: null },
    },
    select: {
      quantity: true,
      esCombo: true,
      fechaLimite: true,
      entregas: { select: { entregadoEn: true } },
    },
  });
}

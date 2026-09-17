import { prisma } from "@/lib/prisma";
import { unidadesEsperadas } from "@/lib/entregas";
import { diaEnAgencia, diaRelativo, diaDeLaSemana } from "@/lib/fechas-agencia";
import type { TipoAvisoEntrega } from "@prisma/client";

/**
 * Avisos de vencimiento de las entregas.
 *
 * Un formato con fecha limite que nadie ha entregado es una fecha que se
 * pasa en silencio: la ficha de la campana lo pinta en rojo, pero solo lo
 * ve quien entra a mirar. Esto lo manda por correo a quien creo la
 * campana, que es quien puede llamar al creador.
 */

/** Con cuanta antelacion se avisa de un vencimiento. */
export const DIAS_DE_AVISO = 2;

/** El resumen de lo que sigue sin entregarse sale los lunes. */
const DIA_DEL_RESUMEN = 1;

export interface FormatoEnRiesgo {
  campaignServiceId: string;
  campana: string;
  campanaId: string;
  influencer: string;
  plataforma: string;
  formato: string;
  fechaLimite: Date;
  entregados: number;
  esperados: number;
  /** Dias de retraso; negativo si aun no ha vencido. */
  diasDeRetraso: number;
}

export interface AvisosDeUnaPersona {
  usuarioId: string;
  email: string;
  nombre: string | null;
  proximos: FormatoEnRiesgo[];
  vencidos: FormatoEnRiesgo[];
  /** Solo los lunes: lo que sigue incumplido de dias anteriores. */
  resumen: FormatoEnRiesgo[];
  /** Formatos activos a los que nadie ha puesto plazo. */
  sinFecha: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Los formatos que cuentan para un aviso.
 *
 * Solo campanas en marcha, influencers aprobados y en activo. Un perfil
 * que espera aprobacion no ha encargado nada todavia, y uno retirado ya
 * no debe nada: avisar de cualquiera de los dos seria reclamar trabajo
 * que nadie contrato.
 */
const DONDE_HAY_COMPROMISO = {
  campaignProfilePlatform: {
    campaignProfile: {
      status: "APPROVED" as const,
      participacion: "ACTIVO" as const,
      campaign: { status: "ACTIVE" as const },
    },
  },
};

function describir(servicio: {
  id: string;
  quantity: number;
  esCombo: boolean;
  fechaLimite: Date | null;
  profileService: { serviceType: { displayName: string } } | null;
  entregas: { id: string }[];
  campaignProfilePlatform: {
    socialAccount: { platform: { displayName: string } };
    campaignProfile: {
      campaignId: string;
      campaign: { name: string };
      profile: { name: string };
    };
  };
}, ahora: Date): FormatoEnRiesgo {
  const cp = servicio.campaignProfilePlatform.campaignProfile;
  return {
    campaignServiceId: servicio.id,
    campana: cp.campaign.name,
    campanaId: cp.campaignId,
    influencer: cp.profile.name,
    plataforma: servicio.campaignProfilePlatform.socialAccount.platform.displayName,
    formato: servicio.esCombo
      ? "Combo"
      : servicio.profileService?.serviceType.displayName ?? "Formato",
    fechaLimite: servicio.fechaLimite!,
    entregados: servicio.entregas.length,
    esperados: unidadesEsperadas(servicio),
    diasDeRetraso: Math.floor(
      (ahora.getTime() - servicio.fechaLimite!.getTime()) / DIA_MS
    ),
  };
}

/**
 * Que hay que avisar hoy, agrupado por la persona que creo cada campana.
 *
 * Devuelve solo lo que todavia NO se ha avisado: la tabla AvisoEntrega
 * guarda cada correo enviado, asi que una segunda ejecucion del dia no
 * repite nada.
 */
export async function avisosDelDia(ahora: Date = new Date()): Promise<AvisosDeUnaPersona[]> {
  const diaProximo = diaRelativo(DIAS_DE_AVISO, ahora);
  const diaAyer = diaRelativo(-1, ahora);
  const hoy = diaEnAgencia(ahora);
  const esDiaDeResumen = diaDeLaSemana(ahora) === DIA_DEL_RESUMEN;

  const servicios = await prisma.campaignService.findMany({
    where: { fechaLimite: { not: null }, ...DONDE_HAY_COMPROMISO },
    select: {
      id: true,
      quantity: true,
      esCombo: true,
      fechaLimite: true,
      profileService: { select: { serviceType: { select: { displayName: true } } } },
      entregas: { select: { id: true } },
      avisos: { select: { tipo: true, clave: true } },
      campaignProfilePlatform: {
        select: {
          socialAccount: { select: { platform: { select: { displayName: true } } } },
          campaignProfile: {
            select: {
              campaignId: true,
              profile: { select: { name: true } },
              campaign: {
                select: {
                  name: true,
                  createdById: true,
                  createdBy: { select: { email: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Los formatos sin plazo no generan aviso, pero si se cuentan: si nadie
  // pone fechas, este correo callaria para siempre sin que se note.
  const sinFechaPorCreador = new Map<string, number>();
  for (const s of await prisma.campaignService.findMany({
    where: { fechaLimite: null, ...DONDE_HAY_COMPROMISO },
    select: {
      campaignProfilePlatform: {
        select: {
          campaignProfile: { select: { campaign: { select: { createdById: true } } } },
        },
      },
    },
  })) {
    const id = s.campaignProfilePlatform.campaignProfile.campaign.createdById;
    sinFechaPorCreador.set(id, (sinFechaPorCreador.get(id) ?? 0) + 1);
  }

  const porPersona = new Map<string, AvisosDeUnaPersona>();
  const dePersona = (
    usuarioId: string,
    email: string,
    nombre: string | null
  ): AvisosDeUnaPersona => {
    const ya = porPersona.get(usuarioId);
    if (ya) return ya;
    const nueva: AvisosDeUnaPersona = {
      usuarioId,
      email,
      nombre,
      proximos: [],
      vencidos: [],
      resumen: [],
      sinFecha: sinFechaPorCreador.get(usuarioId) ?? 0,
    };
    porPersona.set(usuarioId, nueva);
    return nueva;
  };

  for (const servicio of servicios) {
    // Lo ya entregado no se reclama, aunque venza manana.
    if (servicio.entregas.length >= unidadesEsperadas(servicio)) continue;

    const campana = servicio.campaignProfilePlatform.campaignProfile.campaign;
    const email = campana.createdBy.email;
    if (!email) continue;

    const dia = diaEnAgencia(servicio.fechaLimite!);
    const claveDelPlazo = dia;
    const yaAvisado = (tipo: TipoAvisoEntrega, clave: string) =>
      servicio.avisos.some((a) => a.tipo === tipo && a.clave === clave);

    if (dia === diaProximo && !yaAvisado("PROXIMO", claveDelPlazo)) {
      dePersona(campana.createdById, email, campana.createdBy.name).proximos.push(
        describir(servicio, ahora)
      );
      continue;
    }

    if (dia === diaAyer && !yaAvisado("VENCIDO", claveDelPlazo)) {
      dePersona(campana.createdById, email, campana.createdBy.name).vencidos.push(
        describir(servicio, ahora)
      );
      continue;
    }

    // El recordatorio semanal: lo que vencio hace mas de un dia y sigue
    // sin entregarse. Sin esto un incumplimiento se menciona una manana y
    // desaparece, aunque nadie lo resuelva.
    if (esDiaDeResumen && dia < diaAyer && !yaAvisado("RESUMEN", hoy)) {
      dePersona(campana.createdById, email, campana.createdBy.name).resumen.push(
        describir(servicio, ahora)
      );
    }
  }

  // Quien no tiene nada que reclamar no recibe correo: un mensaje diario
  // diciendo "todo en orden" se archiva sin abrir, y arrastra a los que
  // si importan.
  return [...porPersona.values()].filter(
    (p) => p.proximos.length > 0 || p.vencidos.length > 0 || p.resumen.length > 0
  );
}

/** Deja constancia de lo avisado, para no repetirlo manana. */
export async function registrarAvisos(
  persona: AvisosDeUnaPersona,
  ahora: Date = new Date()
) {
  const hoy = diaEnAgencia(ahora);
  const filas = [
    ...persona.proximos.map((f) => ({
      campaignServiceId: f.campaignServiceId,
      tipo: "PROXIMO" as const,
      clave: diaEnAgencia(f.fechaLimite),
    })),
    ...persona.vencidos.map((f) => ({
      campaignServiceId: f.campaignServiceId,
      tipo: "VENCIDO" as const,
      clave: diaEnAgencia(f.fechaLimite),
    })),
    ...persona.resumen.map((f) => ({
      campaignServiceId: f.campaignServiceId,
      tipo: "RESUMEN" as const,
      clave: hoy,
    })),
  ];
  if (filas.length === 0) return 0;

  // skipDuplicates: si dos ejecuciones se solapan, la segunda no revienta
  // por el unico; simplemente no anade nada.
  const r = await prisma.avisoEntrega.createMany({ data: filas, skipDuplicates: true });
  return r.count;
}

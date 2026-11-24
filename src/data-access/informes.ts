import { prisma } from "@/lib/prisma";
import { historicoDeCampana } from "./metricas";
import { NotFoundError } from "./errors";
import {
  calcularTotalCampana,
  redAdmiteAlcance,
  VISUALIZACIONES_POR_SEGUIDOR,
} from "@/lib/campaign-utils";
import { unidadesEsperadas } from "@/lib/entregas";
import { urlDelPerfil } from "@/lib/social-handles";
import { ZONA_AGENCIA } from "@/lib/fechas-agencia";
import {
  engagementSobreAlcance,
  fundirPiezas,
  interaccionesDe,
  type CapturaMetrica,
  type Pieza,
  type Publicacion,
} from "@/lib/impacto";
import {
  APARTADOS_ANALISIS,
  type Analisis,
  type Cifra,
  type DatosInforme,
  type InfluencerInforme,
  type Objetivo,
} from "@/lib/informe/tipos";

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

/** Como se nombra cada red en el informe: la plantilla dice "IG · TikTok". */
function abreviarRed(nombre: string, displayName: string): string {
  switch (nombre.toLowerCase()) {
    case "instagram":
      return "IG";
    case "youtube":
      return "YT";
    case "facebook":
      return "FB";
    default:
      return displayName;
  }
}

/**
 * El periodo de la portada. Sale de las fechas de la campana —"SEPTIEMBRE
 * - OCTUBRE 2026"— y, si no tiene, del mes al que se imputa.
 *
 * Las fechas se guardan a mediodia UTC precisamente para leerlas en
 * crudo: pasarlas por la zona de la agencia moveria un 1 de mayo a abril.
 */
function periodoDe(c: {
  startDate: Date | null;
  endDate: Date | null;
  mes: number;
  anio: number;
}): string {
  const ini = c.startDate;
  const fin = c.endDate ?? c.startDate;
  if (!ini || !fin) return `${MESES[c.mes - 1] ?? ""} ${c.anio}`.trim();
  const mi = MESES[ini.getUTCMonth()];
  const mf = MESES[fin.getUTCMonth()];
  const ai = ini.getUTCFullYear();
  const af = fin.getUTCFullYear();
  if (ai !== af) return `${mi} ${ai} - ${mf} ${af}`;
  if (mi === mf) return `${mi} ${af}`;
  return `${mi} - ${mf} ${af}`;
}

/** Suma de una cifra, o null si ninguna pieza la da. */
function sumar(piezas: Pieza[], clave: "vistas" | "meGusta" | "comentarios" | "compartidos" | "reposteos" | "alcance"): Cifra {
  const conDato = piezas.filter((p) => p[clave] !== null);
  if (conDato.length === 0) return null;
  return conDato.reduce((s, p) => s + (p[clave] ?? 0), 0);
}

/**
 * Los objetivos, del brief que origino la campana.
 *
 * Son los campos del brief que el cliente escribio, tal cual: la app no
 * redacta objetivos. Una campana creada a mano no tiene brief y el
 * informe sale sin esa diapositiva.
 */
function objetivosDelBrief(b: {
  objetivoPrincipal: string;
  objetivoOtro: string | null;
  kpis: string | null;
  publicoObjetivo: string;
  descripcionProducto: string;
} | undefined): Objetivo[] {
  if (!b) return [];
  const lista: Objetivo[] = [];
  const principal =
    b.objetivoPrincipal === "Otro" && b.objetivoOtro?.trim()
      ? b.objetivoOtro.trim()
      : [b.objetivoPrincipal, b.objetivoOtro?.trim()].filter(Boolean).join(": ");
  if (principal.trim()) lista.push({ titulo: "Objetivo principal", texto: principal });
  if (b.kpis?.trim()) lista.push({ titulo: "Indicadores (KPI)", texto: b.kpis.trim() });
  if (b.publicoObjetivo.trim()) {
    lista.push({ titulo: "Público objetivo", texto: b.publicoObjetivo.trim() });
  }
  if (b.descripcionProducto.trim()) {
    lista.push({ titulo: "Producto o servicio", texto: b.descripcionProducto.trim() });
  }
  return lista;
}

/**
 * Todo lo que lleva el informe de resultados, calculado hoy.
 *
 * Las cifras son las de Impacto del contenido en su vista General —lo
 * contratado y lo extra—, fundidas con la misma funcion
 * (`fundirPiezas`), para que el informe y la pantalla no puedan dar dos
 * numeros distintos de la misma campana. La inversion es la de
 * `calcularTotalCampana`, la que ya muestra la ficha.
 */
export async function datosDelInforme(campaignId: string): Promise<DatosInforme> {
  const c = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      mes: true,
      anio: true,
      markupPercentage: true,
      client: { select: { companyName: true } },
      briefs: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          objetivoPrincipal: true,
          objetivoOtro: true,
          kpis: true,
          publicoObjetivo: true,
          descripcionProducto: true,
        },
      },
      profiles: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          participacion: true,
          profile: {
            select: { name: true, city: { select: { name: true } } },
          },
          platforms: {
            select: {
              socialAccountId: true,
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
                  basePrice: true,
                  quantity: true,
                  esCombo: true,
                  profileService: {
                    select: {
                      serviceType: { select: { displayName: true, esEfimero: true } },
                    },
                  },
                  entregas: {
                    select: {
                      id: true,
                      url: true,
                      esExtra: true,
                      miniaturaUrl: true,
                      alcance: true,
                      compartidosReportados: true,
                      reposteosReportados: true,
                      serviceType: {
                        select: {
                          displayName: true,
                          esEfimero: true,
                          platform: { select: { name: true, displayName: true } },
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
  if (!c) throw new NotFoundError("Campaña no encontrada");

  // Las mismas publicaciones que arma la ficha para Impacto del contenido.
  const deQuien = new Map<string, string>();
  const miniaturas = new Map<string, string | null>();
  const publicaciones: Publicacion[] = c.profiles.flatMap((cp) =>
    cp.platforms.flatMap((cpp) =>
      cpp.services.flatMap((cs) =>
        cs.entregas.map((e) => {
          deQuien.set(e.id, cp.id);
          miniaturas.set(e.id, e.miniaturaUrl);
          const red = e.serviceType?.platform ?? cpp.socialAccount.platform;
          return {
            entregaId: e.id,
            influencer: cp.profile.name,
            plataforma: red.displayName,
            username: cpp.socialAccount.username,
            url: e.url,
            formato:
              e.serviceType?.displayName ??
              (cs.esCombo
                ? "Combo"
                : (cs.profileService?.serviceType.displayName ?? null)),
            admiteAlcance: redAdmiteAlcance(red.name),
            admiteReposteos: red.name.toLowerCase() === "instagram",
            esEfimero: e.serviceType
              ? e.serviceType.esEfimero
              : !cs.esCombo && (cs.profileService?.serviceType.esEfimero ?? false),
            alcance: e.alcance,
            compartidosReportados: e.compartidosReportados,
            reposteosReportados: e.reposteosReportados,
            esExtra: e.esExtra,
          };
        }),
      ),
    ),
  );

  const historico = await historicoDeCampana(campaignId);
  const capturas: CapturaMetrica[] = historico.map((m) => {
    const cpp = m.entrega.campaignService.campaignProfilePlatform;
    return {
      capturadoEn: m.capturadoEn.toISOString(),
      origen: m.origen,
      vistas: m.vistas,
      interacciones: m.interacciones,
      meGusta: m.meGusta,
      comentarios: m.comentarios,
      compartidos: m.compartidos,
      guardados: m.guardados,
      reposteos: m.reposteos,
      entregaId: m.entrega.id,
      url: m.entrega.url,
      formato: m.entrega.serviceType?.displayName ?? null,
      influencer: cpp.campaignProfile.profile.name,
      plataforma: cpp.socialAccount.platform.displayName,
      username: cpp.socialAccount.username,
    };
  });

  // General: lo contratado y lo extra, como el informe de la plantilla
  // ("16 de 14 pactadas").
  const { actuales } = fundirPiezas(capturas, publicaciones, () => true);
  const { engagement } = engagementSobreAlcance(actuales);

  // Seguidores para la prevision: una vez por cuenta y solo de quien
  // sigue contratado, igual que la ficha.
  const cuentas = new Set<string>();
  let seguidores = 0;
  let pactadas = 0;
  for (const cp of c.profiles) {
    if (cp.participacion !== "ACTIVO") continue;
    for (const cpp of cp.platforms) {
      if (!cuentas.has(cpp.socialAccountId)) {
        cuentas.add(cpp.socialAccountId);
        seguidores += cpp.socialAccount.followers ?? 0;
      }
      if (cp.status === "APPROVED") {
        for (const cs of cpp.services) pactadas += unidadesEsperadas(cs);
      }
    }
  }

  const piezasDe = new Map<string, Pieza[]>();
  for (const p of actuales) {
    const quien = deQuien.get(p.entregaId);
    if (!quien) continue;
    piezasDe.set(quien, [...(piezasDe.get(quien) ?? []), p]);
  }

  const influencers: InfluencerInforme[] = c.profiles
    // Quien esta contratado, y quien ya no lo esta pero publico: sus
    // vistas estan en los totales y el informe tiene que decir de donde
    // salen.
    .filter(
      (cp) =>
        (cp.participacion === "ACTIVO" && cp.status === "APPROVED") ||
        (piezasDe.get(cp.id)?.length ?? 0) > 0,
    )
    .map((cp) => {
      const piezas = piezasDe.get(cp.id) ?? [];
      const porSeguidores = [...cp.platforms].sort(
        (a, b) => (b.socialAccount.followers ?? 0) - (a.socialAccount.followers ?? 0),
      );
      const principal = porSeguidores[0]?.socialAccount;
      const foto =
        porSeguidores.find((p) => p.socialAccount.profilePicUrl)?.socialAccount
          .profilePicUrl ?? null;
      return {
        campaignProfileId: cp.id,
        nombre: cp.profile.name,
        ciudad: cp.profile.city?.name ?? null,
        usuario: principal?.username ?? null,
        urlPerfil: principal
          ? urlDelPerfil(principal.platform.name, principal.username)
          : null,
        foto,
        seguidores: porSeguidores
          .filter((p) => p.socialAccount.followers !== null)
          .map((p) => ({
            red: abreviarRed(p.socialAccount.platform.name, p.socialAccount.platform.displayName),
            valor: p.socialAccount.followers ?? 0,
          })),
        redes: [
          ...new Set(
            cp.platforms.map((p) =>
              abreviarRed(p.socialAccount.platform.name, p.socialAccount.platform.displayName),
            ),
          ),
        ],
        valor:
          cp.participacion === "ACTIVO"
            ? calcularTotalCampana([cp], c.markupPercentage).conMargen
            : null,
        publicaciones: piezas.length,
        vistas: sumar(piezas, "vistas"),
        alcance: sumar(piezas, "alcance"),
        meGusta: sumar(piezas, "meGusta"),
        comentarios: sumar(piezas, "comentarios"),
        piezas: piezas.map((p) => ({
          etiqueta: `${p.formato ?? "Publicación"} · ${p.plataforma}`,
          url: p.url,
          miniatura: miniaturas.get(p.entregaId) ?? null,
          plataforma: p.plataforma,
          vistas: p.vistas,
          alcance: p.alcance,
          meGusta: p.meGusta,
          comentarios: p.comentarios,
          esExtra: p.esExtra,
        })),
      };
    });

  const ultima = historico.at(-1)?.capturadoEn ?? null;

  return {
    campana: {
      id: c.id,
      nombre: c.name,
      cliente: c.client.companyName,
      periodo: periodoDe(c),
    },
    objetivos: objetivosDelBrief(c.briefs[0]),
    resumen: {
      vistas: sumar(actuales, "vistas"),
      meGusta: sumar(actuales, "meGusta"),
      comentarios: sumar(actuales, "comentarios"),
      compartidos: sumar(actuales, "compartidos"),
      reposteos: sumar(actuales, "reposteos"),
      alcance: sumar(actuales, "alcance"),
      piezasConAlcance: actuales.filter((p) => p.alcance !== null).length,
      interacciones: actuales.reduce((s, p) => s + interaccionesDe(p), 0),
      engagement,
      inversion: calcularTotalCampana(c.profiles, c.markupPercentage).conMargen,
      publicaciones: actuales.length,
      pactadas,
      previsionVistas: seguidores > 0 ? seguidores * VISUALIZACIONES_POR_SEGUIDOR : null,
    },
    influencers,
    fechaDeCorte: ultima
      ? ultima.toLocaleDateString("es-CO", {
          timeZone: ZONA_AGENCIA,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null,
  };
}

/** Lo que mercadeo reescribio del analisis. Vacio si no toco nada. */
export async function analisisGuardado(
  campaignId: string,
): Promise<Partial<Analisis>> {
  const fila = await prisma.informeCampana.findUnique({
    where: { campaignId },
    select: { analisis: true },
  });
  return limpiarAnalisis(fila?.analisis);
}

/** Solo las claves conocidas y con texto: lo demas es la propuesta. */
function limpiarAnalisis(valor: unknown): Partial<Analisis> {
  const limpio: Partial<Analisis> = {};
  if (!valor || typeof valor !== "object") return limpio;
  for (const { clave } of APARTADOS_ANALISIS) {
    const texto = (valor as Record<string, unknown>)[clave];
    if (typeof texto === "string" && texto.trim()) limpio[clave] = texto.trim();
  }
  return limpio;
}

/**
 * Guarda el analisis reescrito. Un apartado vacio o ausente vuelve a la
 * propuesta, que se recalcula con las cifras de cada descarga.
 */
export async function guardarAnalisis(
  campaignId: string,
  analisis: Partial<Record<keyof Analisis, string | null>>,
  usuarioId: string,
): Promise<Partial<Analisis>> {
  const existe = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!existe) throw new NotFoundError("Campaña no encontrada");
  const limpio = limpiarAnalisis(analisis);
  await prisma.informeCampana.upsert({
    where: { campaignId },
    create: { campaignId, analisis: limpio, actualizadoPorId: usuarioId },
    update: { analisis: limpio, actualizadoPorId: usuarioId },
  });
  return limpio;
}

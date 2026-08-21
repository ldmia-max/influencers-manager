import { NextResponse } from "next/server";
import { exigirPermiso } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { busquedaIaSchema } from "@/lib/schemas/busqueda";
import {
  extraerCriterios,
  valorarProspectos,
  ErrorIA,
  NOMBRE_PLATAFORMA,
} from "@/lib/ai-busqueda";
import {
  buscarProspectos,
  esPlataformaBuscable,
  PLATAFORMAS_BUSCABLES,
} from "@/lib/apify";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/busqueda-ia
 *
 * Busca creadores que todavia no estan en la aplicacion, a partir de una
 * frase en lenguaje natural.
 *
 * Tres pasos: la IA traduce la frase a criterios —incluida la plataforma,
 * que decide donde se busca—, Apify busca cuentas reales con esas
 * palabras clave, y la IA valora cuales encajan. El filtro por numero de
 * seguidores lo hace el codigo, que es exacto.
 *
 * Exige permiso de LEER perfiles, que tienen tanto USER como ADMIN:
 * buscar prospectos no crea nada, solo consulta.
 */

/** Tope por consulta. Cada resultado de mas es consumo de Apify. */
const MAX_POR_CONSULTA = 10;

/** Donde se busca cuando el usuario no dice la plataforma. */
const PLATAFORMA_POR_DEFECTO = "tiktok";

export async function POST(req: Request) {
  try {
    const sesion = await exigirPermiso("perfiles", "leer");
    if (sesion instanceof NextResponse) return sesion;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "La búsqueda con IA no está configurada (falta ANTHROPIC_API_KEY)" },
        { status: 503 }
      );
    }

    const body = await parseBody(req, busquedaIaSchema);
    if (body instanceof NextResponse) return body;

    // --- 1. Interpretar la frase ---
    const criterios = await extraerCriterios(body.prompt);

    if (criterios.consultas.length === 0) {
      return NextResponse.json({
        criterios,
        prospectos: [],
        aviso:
          "No se entendió qué buscar. Indica al menos un tema o categoría, por ejemplo «influencers de cocina en Bogotá en TikTok».",
      });
    }

    // --- 2. Decidir la plataforma ---
    // Sin plataforma se busca en la de por defecto, pero se dice cual ha
    // sido: el usuario no tiene por que adivinar donde se ha buscado.
    const pedida = criterios.plataforma;
    const plataforma = pedida || PLATAFORMA_POR_DEFECTO;

    if (!esPlataformaBuscable(plataforma)) {
      const nombre = NOMBRE_PLATAFORMA[plataforma] ?? plataforma;
      const disponibles = PLATAFORMAS_BUSCABLES.map(
        (p) => NOMBRE_PLATAFORMA[p]
      ).join(", ");
      return NextResponse.json({
        criterios: { ...criterios, plataforma },
        prospectos: [],
        aviso: `En ${nombre} se pueden traer los datos de una cuenta concreta, pero no buscar creadores por tema. Puedes buscar en: ${disponibles}.`,
      });
    }

    // --- 3. Buscar cuentas reales ---
    const encontrados = await buscarProspectos(
      plataforma,
      criterios.consultas,
      MAX_POR_CONSULTA
    );

    const nombrePlataforma = NOMBRE_PLATAFORMA[plataforma];

    if (encontrados.length === 0) {
      return NextResponse.json({
        criterios: { ...criterios, plataforma },
        prospectos: [],
        aviso: `La búsqueda en ${nombrePlataforma} no devolvió cuentas. Prueba con otros términos.`,
      });
    }

    // --- 4. Filtrar por lo comprobable, antes de gastar tokens ---
    const porSeguidores = encontrados.filter((p) => {
      if (criterios.minSeguidores && p.seguidores < criterios.minSeguidores) return false;
      if (criterios.maxSeguidores && p.seguidores > criterios.maxSeguidores) return false;
      return true;
    });

    if (porSeguidores.length === 0) {
      return NextResponse.json({
        criterios: { ...criterios, plataforma },
        prospectos: [],
        aviso: `Se encontraron ${encontrados.length} cuentas en ${nombrePlataforma}, pero ninguna dentro del rango de seguidores pedido.`,
      });
    }

    // --- 5. Marcar los que ya estan dados de alta ---
    // La comparacion es por plataforma ademas de por usuario: el mismo
    // handle en dos redes son dos cuentas distintas.
    const usuarios = porSeguidores.map((p) => p.username);
    const yaExisten = await prisma.socialAccount.findMany({
      where: {
        username: { in: usuarios, mode: "insensitive" },
        platform: { name: plataforma },
      },
      select: { username: true, profileId: true },
    });
    const existentes = new Map(
      yaExisten.map((c) => [c.username.toLowerCase(), c.profileId])
    );

    // --- 6. Valoracion de la IA sobre lo que queda ---
    const valoraciones = await valorarProspectos(
      body.prompt,
      criterios,
      porSeguidores.map((p) => ({
        username: p.username,
        nombre: p.nombre,
        bio: p.bio,
        seguidores: p.seguidores,
      }))
    );

    const prospectos = porSeguidores
      .map((p) => {
        const v = valoraciones.get(p.username.toLowerCase());
        return {
          ...p,
          encaja: v ? v.encaja : true,
          motivo: v?.motivo ?? "",
          yaRegistrado: existentes.get(p.username.toLowerCase()) ?? null,
        };
      })
      // Primero los que encajan, y dentro de cada grupo por seguidores.
      .sort((a, b) =>
        a.encaja === b.encaja ? b.seguidores - a.seguidores : a.encaja ? -1 : 1
      );

    return NextResponse.json({
      criterios: { ...criterios, plataforma },
      prospectos,
      // Solo se avisa cuando la plataforma no se pidio: si el usuario la
      // nombro, ya sabe donde se busco.
      aviso: pedida
        ? undefined
        : `No indicaste plataforma, así que se buscó en ${nombrePlataforma}. Escríbela en la frase para buscar en otra.`,
    });
  } catch (error) {
    console.error("Error en busqueda-ia:", error);

    // ErrorIA ya trae un texto pensado para el usuario; el resto no, y
    // pueden llevar detalles internos, asi que se sustituyen.
    if (error instanceof ErrorIA) {
      return NextResponse.json({ error: error.message }, { status: error.estado });
    }
    return NextResponse.json(
      { error: "No se pudo completar la búsqueda. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}

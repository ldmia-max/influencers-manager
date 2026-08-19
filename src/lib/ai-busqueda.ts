import "server-only";
import { anthropic } from "./ai";

/**
 * Busqueda de prospectos guiada por IA.
 *
 * Reparto de trabajo, y conviene tenerlo claro para no esperar de cada
 * pieza lo que no puede dar:
 *
 *  - Apify busca por PALABRAS CLAVE. No entiende "con buen engagement en
 *    Medellin"; entiende "fitness medellin" y devuelve cuentas.
 *  - La IA traduce la frase del usuario a esas palabras clave y a
 *    criterios comprobables (plataforma, rango de seguidores, pais), y
 *    despues valora que candidatos encajan y por que.
 *
 * La IA NUNCA inventa cuentas. Todo lo que se muestra viene de Apify;
 * ella solo interpreta la intencion y ordena. Un modelo proponiendo
 * usuarios de memoria produciria handles inexistentes con datos
 * inventados, que es justo lo contrario de lo que sirve aqui.
 */

const MODELO = "claude-haiku-4-5-20251001";

/** Plataformas en las que hoy se puede DESCUBRIR, no solo consultar. */
export const PLATAFORMAS_BUSCABLES = ["tiktok"] as const;
export type PlataformaBuscable = (typeof PLATAFORMAS_BUSCABLES)[number];

/**
 * Traduce un fallo del API de Anthropic a algo que el usuario entienda.
 *
 * Sin esto la interfaz muestra el JSON crudo del error, que ademas deja
 * ver detalles de la cuenta. Los tres casos separados son los que un
 * operador puede resolver por su cuenta: recargar saldo, revisar la
 * clave o esperar.
 */
export class ErrorIA extends Error {
  /** Codigo HTTP que deberia devolver la ruta. */
  readonly estado: number;
  constructor(mensaje: string, estado = 503) {
    super(mensaje);
    this.name = "ErrorIA";
    this.estado = estado;
  }
}

function traducirErrorIA(error: unknown): ErrorIA {
  const estado =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;

  if (estado === 400 || estado === 402) {
    const texto = error instanceof Error ? error.message : "";
    if (/credit balance/i.test(texto)) {
      return new ErrorIA(
        "La cuenta de Anthropic no tiene saldo. Recarga créditos para poder usar la búsqueda con IA."
      );
    }
  }
  if (estado === 401 || estado === 403) {
    return new ErrorIA(
      "La clave de Anthropic no es válida o no tiene permisos. Revisa ANTHROPIC_API_KEY."
    );
  }
  if (estado === 429) {
    return new ErrorIA(
      "Se alcanzó el límite de peticiones a la IA. Inténtalo de nuevo en unos minutos."
    );
  }
  if (estado && estado >= 500) {
    return new ErrorIA("El servicio de IA no está disponible ahora mismo. Inténtalo más tarde.");
  }
  return new ErrorIA(
    "No se pudo consultar la IA para interpretar la búsqueda. Inténtalo de nuevo.",
    500
  );
}

export interface CriteriosBusqueda {
  plataforma: string;
  /** Consultas para Apify, en el idioma en que la gente etiqueta. */
  consultas: string[];
  minSeguidores?: number;
  maxSeguidores?: number;
  pais?: string;
  ciudad?: string;
  categoria?: string;
  /** Que se entendio, para mostrarlo y que el usuario corrija si hace falta. */
  interpretacion: string;
}

/**
 * Convierte la frase del usuario en criterios de busqueda.
 *
 * Se pide JSON estricto en lugar de usar herramientas: es una sola
 * respuesta sin efectos, y el bucle de tool use aqui solo anadiria
 * latencia.
 */
export async function extraerCriterios(
  prompt: string
): Promise<CriteriosBusqueda> {
  const sistema = `Extraes criterios de busqueda de creadores de contenido a partir de una frase en espanol.

Devuelve UNICAMENTE un objeto JSON, sin texto alrededor ni bloques de codigo, con esta forma:
{
  "plataforma": "tiktok" | "instagram" | "youtube" | "kick" | "",
  "consultas": ["...", "..."],
  "minSeguidores": number | null,
  "maxSeguidores": number | null,
  "pais": string | null,
  "ciudad": string | null,
  "categoria": string | null,
  "interpretacion": "una frase corta explicando que entendiste"
}

Reglas:
- "consultas" son terminos de busqueda literales para un buscador de cuentas, como los escribiria alguien en el buscador de la red. Entre una y tres. Combina nicho y lugar cuando el usuario lo mencione ("fitness medellin"). No uses operadores ni comillas.
- Si el usuario no dice la plataforma, deja "plataforma" en "".
- Interpreta cantidades en lenguaje natural: "50k" son 50000, "mas de 100 mil" es minSeguidores 100000, "entre 10k y 50k" son ambos limites.
- "micro influencers" suele ser 10000-100000 seguidores; "nano" menos de 10000; "macro" mas de 500000. Usalo solo si el usuario emplea esos terminos.
- No inventes nombres de cuentas ni de personas. Solo criterios.`;

  let respuesta;
  try {
    respuesta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 500,
      system: sistema,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    console.error("[busqueda-ia] Fallo al interpretar la búsqueda:", error);
    throw traducirErrorIA(error);
  }

  const texto = respuesta.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  // El modelo a veces envuelve el JSON en un bloque de codigo pese a la
  // instruccion; se recorta antes de parsear.
  const limpio = texto
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(limpio);
  } catch {
    throw new Error(
      "No se pudo interpretar la búsqueda. Prueba a describirla de otra forma."
    );
  }

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const txt = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  const consultas = Array.isArray(datos.consultas)
    ? datos.consultas.filter((c): c is string => typeof c === "string" && !!c.trim())
    : [];

  return {
    plataforma: (txt(datos.plataforma) ?? "").toLowerCase(),
    consultas: consultas.slice(0, 3),
    minSeguidores: num(datos.minSeguidores),
    maxSeguidores: num(datos.maxSeguidores),
    pais: txt(datos.pais),
    ciudad: txt(datos.ciudad),
    categoria: txt(datos.categoria),
    interpretacion: txt(datos.interpretacion) ?? "",
  };
}

export interface ProspectoValorado {
  username: string;
  encaja: boolean;
  motivo: string;
}

/**
 * Valora que candidatos encajan con lo pedido.
 *
 * El filtro por numero de seguidores lo hace el codigo, que para eso es
 * exacto y gratis. A la IA se le deja lo que solo ella puede juzgar: si
 * la biografia y el nombre corresponden de verdad al nicho y al lugar
 * que se buscaba, porque un buscador por palabras clave devuelve mucho
 * ruido.
 *
 * Si la valoracion falla, se devuelven todos como validos en lugar de
 * dejar la busqueda sin resultados: mas vale ruido que una pantalla
 * vacia.
 */
export async function valorarProspectos(
  prompt: string,
  criterios: CriteriosBusqueda,
  candidatos: { username: string; nombre: string; bio: string; seguidores: number }[]
): Promise<Map<string, ProspectoValorado>> {
  const vacio = new Map<string, ProspectoValorado>();
  if (candidatos.length === 0) return vacio;

  try {
    const sistema = `Decides que cuentas encajan con lo que busca una agencia de marketing.

Recibes la peticion original y una lista de cuentas reales. Devuelve UNICAMENTE un array JSON:
[{"username": "...", "encaja": true|false, "motivo": "media frase"}]

- "encaja" es false cuando la cuenta claramente no corresponde al nicho, al lugar o al tipo de creador pedido: marcas en vez de personas, cuentas de otro tema que solo comparten una palabra, o idioma y pais que no cuadran.
- Ante la duda, marca true: es preferible mostrar de mas que ocultar un buen prospecto.
- "motivo" explica en pocas palabras por que si o por que no. En espanol.
- Incluye TODAS las cuentas recibidas, ninguna de mas.`;

    const lista = candidatos
      .map(
        (c) =>
          `- ${c.username} | ${c.nombre} | ${c.seguidores} seguidores | ${c.bio.slice(0, 160)}`
      )
      .join("\n");

    const respuesta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 1500,
      system: sistema,
      messages: [
        {
          role: "user",
          content: `Peticion: ${prompt}\nCriterios entendidos: ${criterios.interpretacion}\n\nCuentas:\n${lista}`,
        },
      ],
    });

    const texto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const filas = JSON.parse(texto) as ProspectoValorado[];
    const mapa = new Map<string, ProspectoValorado>();
    for (const f of filas) {
      if (typeof f?.username === "string") {
        mapa.set(f.username.toLowerCase(), {
          username: f.username,
          encaja: f.encaja !== false,
          motivo: typeof f.motivo === "string" ? f.motivo : "",
        });
      }
    }
    return mapa;
  } catch (error) {
    console.error("[busqueda-ia] No se pudieron valorar los prospectos:", error);
    return vacio;
  }
}

import { ApifyClient } from "apify-client";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { directorioUploads, RUTA_PUBLICA_UPLOADS } from "./uploads";
import { esIdDeCanalYouTube, normalizarUsuarioSocial } from "./social-handles";

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export interface InstagramProfileData {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  profilePicUrlHD: string;
  profilePicLocalPath?: string; // URL en Vercel Blob
  isVerified: boolean;
  engagementRate?: number;
}

/**
 * Descarga la foto de perfil y la guarda donde corresponda.
 *
 * Dos destinos segun el entorno:
 *  - Con BLOB_READ_WRITE_TOKEN: Vercel Blob, y se guarda su URL absoluta.
 *  - Sin token (el caso de OVH): disco, en el directorio de subidas, y
 *    se guarda una ruta relativa servida por /api/uploads.
 *
 * No escribe en public/: con output: "standalone" Next no sirve los
 * archivos que aparezcan ahi despues del build.
 *
 * @returns URL utilizable en un <img>, o null si algo fallo. Devolver
 *          null no aborta la sincronizacion: el perfil se queda sin
 *          foto pero conserva sus metricas.
 */
async function downloadProfilePicture(
  imageUrl: string,
  username: string
): Promise<string | null> {
  try {
    // Descargar la imagen
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determinar extensión del archivo
    const contentType = response.headers.get("content-type");
    const ext = contentType?.includes("png") ? "png" : "jpg";
    const nombre = `${username}_${Date.now()}.${ext}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`profiles/${nombre}`, buffer, {
        access: "public",
        contentType: contentType || "image/jpeg",
      });
      return blob.url;
    }

    const destino = join(directorioUploads(), "profiles");
    await mkdir(destino, { recursive: true });
    await writeFile(join(destino, nombre), buffer);

    return `${RUTA_PUBLICA_UPLOADS}/profiles/${nombre}`;
  } catch (error) {
    console.error("Error downloading profile picture:", error);
    return null;
  }
}

export interface TikTokProfileData {
  username: string;
  nickname: string;
  signature: string;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
  avatarUrl: string;
  avatarLocalPath?: string; // URL en Vercel Blob
  verified: boolean;
}

export interface YouTubeProfileData {
  /** Handle sin arroba, tal y como se guarda en SocialAccount.username. */
  username: string;
  channelName: string;
  description: string;
  channelUrl: string;
  subscribers: number;
  totalVideos: number;
  /** Media de visualizaciones de los ultimos videos analizados. */
  avgViews: number | null;
  avatarUrl: string;
  avatarLocalPath?: string;
  verified: boolean;
}

export interface KickProfileData {
  username: string;
  displayName: string;
  bio: string;
  channelUrl: string;
  followers: number;
  avatarUrl: string;
  avatarLocalPath?: string;
  verified: boolean;
}

export async function getInstagramProfile(
  username: string
): Promise<InstagramProfileData | null> {
  try {
    const run = await client.actor("apify/instagram-profile-scraper").call({
      usernames: [username],
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) return null;

    const profile = items[0] as Record<string, unknown>;

    // Descargar y guardar la foto de perfil HD localmente
    const profilePicUrlHD = String(profile.profilePicUrlHD || "");
    const profilePicLocalPath = profilePicUrlHD
      ? await downloadProfilePicture(profilePicUrlHD, String(profile.username))
      : null;

    return {
      username: String(profile.username || ""),
      fullName: String(profile.fullName || ""),
      biography: String(profile.biography || ""),
      followersCount: Number(profile.followersCount || 0),
      followsCount: Number(profile.followsCount || 0),
      postsCount: Number(profile.postsCount || 0),
      profilePicUrlHD,
      profilePicLocalPath: profilePicLocalPath || undefined,
      isVerified: Boolean(profile.verified),
      engagementRate: profile.engagementRate
        ? Number(profile.engagementRate)
        : undefined,
    };
  } catch (error) {
    console.error("Error fetching Instagram profile:", error);
    return null;
  }
}

export async function getTikTokProfile(
  username: string
): Promise<TikTokProfileData | null> {
  try {
    const run = await client.actor("clockworks/tiktok-profile-scraper").call({
      profiles: [username],
      resultsPerPage: 1,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) return null;

    const item = items[0] as Record<string, unknown>;
    const authorMeta = item.authorMeta as Record<string, unknown>;

    if (!authorMeta) return null;

    // Descargar y guardar el avatar localmente
    const avatarUrl = String(authorMeta.avatar || "");
    const avatarLocalPath = avatarUrl
      ? await downloadProfilePicture(avatarUrl, String(authorMeta.name))
      : null;

    return {
      username: String(authorMeta.name || ""),
      nickname: String(authorMeta.nickName || ""),
      signature: String(authorMeta.signature || ""),
      followerCount: Number(authorMeta.fans || 0),
      followingCount: Number(authorMeta.following || 0),
      heartCount: Number(authorMeta.heart || 0),
      videoCount: Number(authorMeta.video || 0),
      avatarUrl,
      avatarLocalPath: avatarLocalPath || undefined,
      verified: Boolean(authorMeta.verified),
    };
  } catch (error) {
    console.error("Error fetching TikTok profile:", error);
    return null;
  }
}

/** Cuantos videos recientes se piden para promediar visualizaciones. */
const YOUTUBE_VIDEOS_PARA_MEDIA = 10;

/**
 * Datos de un canal de YouTube.
 *
 * Usa streamers/youtube-channel-scraper. El actor devuelve una fila por
 * video, y cada fila repite la informacion del canal; de ahi que los
 * datos del perfil se lean del primer elemento y las visualizaciones se
 * promedien entre todos.
 *
 * Se piden pocos videos a proposito: solo hacen falta para la media, y
 * cada video de mas es consumo de la cuenta de Apify.
 *
 * @param handle Handle del canal, con o sin arroba (por ejemplo
 *               "MrBeast" o "@MrBeast").
 */
export async function getYouTubeProfile(
  handle: string
): Promise<YouTubeProfileData | null> {
  try {
    // Acepta identificador suelto, con arroba o URL completa. Los
    // canales identificados por id (UC...) no admiten la forma con
    // arroba y necesitan /channel/.
    const limpio = normalizarUsuarioSocial("youtube", handle);
    if (!limpio) return null;
    const url = esIdDeCanalYouTube(limpio)
      ? `https://www.youtube.com/channel/${limpio}`
      : `https://www.youtube.com/@${limpio}`;

    const run = await client.actor("streamers/youtube-channel-scraper").call({
      startUrls: [{ url }],
      maxResults: YOUTUBE_VIDEOS_PARA_MEDIA,
      maxResultsShorts: 0,
      maxResultStreams: 0,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (items.length === 0) return null;

    const primero = items[0] as Record<string, unknown>;

    // Media de visualizaciones de los videos devueltos. Es mas util que
    // el total historico del canal, que crece siempre y no dice nada
    // del rendimiento actual.
    const vistas = items
      .map((i) => Number((i as Record<string, unknown>).viewCount))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgViews = vistas.length
      ? Math.round(vistas.reduce((a, b) => a + b, 0) / vistas.length)
      : null;

    const avatarUrl = String(primero.channelAvatarUrl || "");
    const nombreCanal = String(primero.channelUsername || limpio);
    const avatarLocalPath = avatarUrl
      ? await downloadProfilePicture(avatarUrl, nombreCanal)
      : null;

    return {
      username: nombreCanal,
      channelName: String(primero.channelName || ""),
      description: String(primero.channelDescription || ""),
      channelUrl: String(primero.channelUrl || ""),
      subscribers: Number(primero.numberOfSubscribers || 0),
      totalVideos: Number(primero.channelTotalVideos || 0),
      avgViews,
      avatarUrl,
      avatarLocalPath: avatarLocalPath || undefined,
      verified: Boolean(primero.isChannelVerified),
    };
  } catch (error) {
    console.error("Error fetching YouTube profile:", error);
    return null;
  }
}

/**
 * Datos de un canal de Kick.
 *
 * Usa aitooolsmax/kick-data-scraper en modo "channels". Hace falta un
 * actor porque la API publica de kick.com responde 403 a cualquier
 * peticion de servidor: la protege Cloudflare.
 *
 * Kick no expone publicaciones ni visualizaciones agregadas, asi que
 * solo se rellenan seguidores, nombre, biografia, verificacion y
 * avatar. El resto se deja vacio en lugar de inventarlo.
 */
export async function getKickProfile(
  slug: string
): Promise<KickProfileData | null> {
  try {
    const limpio = normalizarUsuarioSocial("kick", slug);
    if (!limpio) return null;

    const run = await client.actor("aitooolsmax/kick-data-scraper").call({
      mode: "channels",
      channelSlugs: [limpio],
      maxItems: 1,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (items.length === 0) return null;

    const canal = items[0] as Record<string, unknown>;

    const avatarUrl = String(canal.profileImage || "");
    const nombre = String(canal.slug || limpio);
    const avatarLocalPath = avatarUrl
      ? await downloadProfilePicture(avatarUrl, nombre)
      : null;

    return {
      username: nombre,
      displayName: String(canal.displayName || ""),
      bio: String(canal.bio || ""),
      channelUrl: String(canal.channelUrl || ""),
      followers: Number(canal.followersCount || 0),
      avatarUrl,
      avatarLocalPath: avatarLocalPath || undefined,
      verified: Boolean(canal.verified),
    };
  } catch (error) {
    console.error("Error fetching Kick profile:", error);
    return null;
  }
}

export async function syncSocialAccountMetrics(
  platform: "instagram" | "tiktok" | "youtube" | "kick",
  username: string
) {
  if (platform === "instagram") {
    const data = await getInstagramProfile(username);
    if (!data) return null;

    return {
      fullName: data.fullName,
      biography: data.biography,
      verified: data.isVerified,
      profilePicUrl: data.profilePicLocalPath || null,
      followers: data.followersCount,
      following: data.followsCount,
      posts: data.postsCount,
      engagementRate: data.engagementRate,
    };
  }

  if (platform === "tiktok") {
    const data = await getTikTokProfile(username);
    if (!data) return null;

    return {
      fullName: data.nickname,
      biography: data.signature,
      verified: data.verified,
      profilePicUrl: data.avatarLocalPath || null,
      followers: data.followerCount,
      following: data.followingCount,
      posts: data.videoCount,
      avgLikes: data.heartCount,
    };
  }

  if (platform === "youtube") {
    const data = await getYouTubeProfile(username);
    if (!data) return null;

    return {
      fullName: data.channelName,
      biography: data.description,
      verified: data.verified,
      profilePicUrl: data.avatarLocalPath || null,
      profileUrl: data.channelUrl,
      followers: data.subscribers,
      posts: data.totalVideos,
      avgViews: data.avgViews,
      // Sin avgLikes ni engagementRate: este actor devuelve
      // visualizaciones por video pero no "me gusta", y calcular un
      // engagement inventado lo dejaria comparandose de tu a tu con el
      // de Instagram, que si es real.
    };
  }

  if (platform === "kick") {
    const data = await getKickProfile(username);
    if (!data) return null;

    return {
      fullName: data.displayName,
      biography: data.bio,
      verified: data.verified,
      profilePicUrl: data.avatarLocalPath || null,
      profileUrl: data.channelUrl,
      followers: data.followers,
      // Kick no publica numero de emisiones ni visualizaciones
      // agregadas, asi que posts, avgViews y engagement quedan vacios.
    };
  }

  return null;
}

/** Plataformas en las que se puede DESCUBRIR cuentas, no solo consultarlas. */
export const PLATAFORMAS_BUSCABLES = ["tiktok", "instagram", "youtube"] as const;
export type PlataformaBuscable = (typeof PLATAFORMAS_BUSCABLES)[number];

export function esPlataformaBuscable(valor: string): valor is PlataformaBuscable {
  return (PLATAFORMAS_BUSCABLES as readonly string[]).includes(valor);
}

/**
 * Una cuenta candidata, ya normalizada, venga de la red que venga.
 *
 * Los campos opcionales son null cuando la plataforma no publica el dato,
 * no cuando vale cero: Instagram no expone el total de me gusta y YouTube
 * no dice cuantos videos tiene un canal ni a cuantos esta suscrito.
 * Distinguirlo importa porque la interfaz oculta lo que no existe en vez
 * de pintar un cero, que se leeria como "no tiene ninguno".
 */
export interface Prospecto {
  plataforma: PlataformaBuscable;
  username: string;
  nombre: string;
  bio: string;
  profileUrl: string;
  avatarUrl: string | null;
  verificado: boolean;
  seguidores: number;
  siguiendo: number | null;
  meGusta: number | null;
  publicaciones: number | null;
  cuentaPrivada: boolean;
  /** Por que aparecio: en YouTube, el video que coincidio con la busqueda. */
  contexto: string | null;
}

/**
 * Busca cuentas por palabras clave en la plataforma indicada.
 *
 * Cada red necesita su propio actor porque ninguno cubre varias, y lo que
 * devuelven no se parece: TikTok e Instagram tienen buscador de cuentas,
 * mientras que en YouTube hay que buscar videos y quedarse con sus
 * canales. Esa diferencia se resuelve aqui; quien llama recibe siempre la
 * misma forma.
 *
 * Nunca lanza: si el actor falla se registra y se devuelve lista vacia.
 * Una busqueda sin resultados es un mal resultado, pero un error a mitad
 * de la peticion deja al usuario sin nada que mirar.
 */
export async function buscarProspectos(
  plataforma: PlataformaBuscable,
  consultas: string[],
  maxPorConsulta = 10
): Promise<Prospecto[]> {
  const limpias = consultas.map((c) => c.trim()).filter(Boolean);
  if (limpias.length === 0) return [];

  try {
    switch (plataforma) {
      case "tiktok":
        return await buscarEnTikTok(limpias, maxPorConsulta);
      case "instagram":
        return await buscarEnInstagram(limpias, maxPorConsulta);
      case "youtube":
        return await buscarEnYouTube(limpias, maxPorConsulta);
    }
  } catch (error) {
    console.error(`Error buscando prospectos en ${plataforma}:`, error);
    return [];
  }
}

/**
 * TikTok: buscador de cuentas. Devuelve el perfil con sus metricas ya
 * incluidas, asi que no hace falta un segundo scraping por candidato.
 */
async function buscarEnTikTok(
  consultas: string[],
  maxPorConsulta: number
): Promise<Prospecto[]> {
  const run = await client.actor("clockworks/tiktok-user-search-scraper").call({
    searchQueries: consultas,
    maxProfilesPerQuery: maxPorConsulta,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const vistos = new Set<string>();
  const prospectos: Prospecto[] = [];

  for (const bruto of items) {
    const it = bruto as Record<string, unknown>;
    const username = String(it.name || "");
    if (!username || vistos.has(username.toLowerCase())) continue;
    vistos.add(username.toLowerCase());

    prospectos.push({
      plataforma: "tiktok",
      username,
      nombre: String(it.nickName || ""),
      bio: String(it.signature || ""),
      profileUrl: String(it.profileUrl || `https://www.tiktok.com/@${username}`),
      avatarUrl: String(it.avatar || "") || null,
      verificado: Boolean(it.verified),
      seguidores: Number(it.fans || 0),
      siguiendo: Number(it.following || 0),
      meGusta: Number(it.heart || 0),
      publicaciones: Number(it.video || 0),
      cuentaPrivada: Boolean(it.privateAccount),
      contexto: null,
    });
  }

  return prospectos;
}

/**
 * Instagram: buscador de cuentas, una consulta por llamada.
 *
 * El actor acepta `search` como cadena y no como lista, de modo que las
 * consultas se lanzan en paralelo y se juntan despues. Instagram no
 * publica el total de me gusta de una cuenta, asi que ese dato queda en
 * null en vez de inventarse.
 */
async function buscarEnInstagram(
  consultas: string[],
  maxPorConsulta: number
): Promise<Prospecto[]> {
  const tandas = await Promise.all(
    consultas.map(async (consulta) => {
      const run = await client.actor("apify/instagram-search-scraper").call({
        search: consulta,
        searchType: "user",
        searchLimit: maxPorConsulta,
      });
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      return items;
    })
  );

  const vistos = new Set<string>();
  const prospectos: Prospecto[] = [];

  for (const bruto of tandas.flat()) {
    const it = bruto as Record<string, unknown>;
    const username = String(it.username || "");
    if (!username || vistos.has(username.toLowerCase())) continue;
    vistos.add(username.toLowerCase());

    prospectos.push({
      plataforma: "instagram",
      username,
      nombre: String(it.fullName || ""),
      bio: String(it.biography || ""),
      profileUrl: String(it.url || `https://www.instagram.com/${username}`),
      avatarUrl: String(it.profilePicUrl || it.profilePicUrlHD || "") || null,
      verificado: Boolean(it.verified),
      seguidores: Number(it.followersCount || 0),
      siguiendo: Number(it.followsCount || 0),
      meGusta: null,
      publicaciones: Number(it.postsCount || 0),
      cuentaPrivada: Boolean(it.private),
      contexto: null,
    });
  }

  return prospectos;
}

/**
 * YouTube: no hay buscador de canales, asi que se buscan VIDEOS y se
 * recogen sus canales.
 *
 * Sale ganando el resultado: aparece quien de verdad publico algo sobre
 * el tema, no quien lleva la palabra en el nombre. A cambio, el actor
 * devuelve una fila por video y varias pueden ser del mismo canal, de ahi
 * la deduplicacion por channelId.
 *
 * Como no trae la descripcion del canal ni su avatar, se usa el video que
 * coincidio: su titulo va en `contexto` y su descripcion hace de bio para
 * que la IA pueda juzgar el nicho.
 */
async function buscarEnYouTube(
  consultas: string[],
  maxPorConsulta: number
): Promise<Prospecto[]> {
  const run = await client.actor("streamers/youtube-scraper").call({
    searchQueries: consultas,
    maxResults: maxPorConsulta,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const vistos = new Set<string>();
  const prospectos: Prospecto[] = [];

  for (const bruto of items) {
    const it = bruto as Record<string, unknown>;
    const canalId = String(it.channelId || "");
    // El handle es lo legible, pero algunos canales solo tienen id.
    const username = String(it.channelUsername || canalId || "");
    const clave = (canalId || username).toLowerCase();
    if (!username || !clave || vistos.has(clave)) continue;
    vistos.add(clave);

    prospectos.push({
      plataforma: "youtube",
      username,
      nombre: String(it.channelName || username),
      bio: String(it.text || "").slice(0, 300),
      profileUrl: String(
        it.channelUrl ||
          (it.channelUsername
            ? `https://www.youtube.com/@${String(it.channelUsername)}`
            : `https://www.youtube.com/channel/${canalId}`)
      ),
      avatarUrl: null,
      verificado: false,
      seguidores: Number(it.numberOfSubscribers || 0),
      siguiendo: null,
      meGusta: null,
      publicaciones: null,
      cuentaPrivada: false,
      contexto: it.title ? `Apareció por el vídeo «${String(it.title)}»` : null,
    });
  }

  return prospectos;
}


// =============================================================================
// Metricas de publicaciones ya entregadas
// =============================================================================

/**
 * Lo que una plataforma publica de una publicacion concreta.
 *
 * Null significa "esta red no da ese dato", que no es cero. Los
 * compartidos solo existen en TikTok; ni Instagram ni YouTube los
 * exponen, porque solo los ve el creador en su panel. Y los guardados,
 * igual. Rellenarlos con cero pintaria un grafico plano que se leeria
 * como "nadie lo compartio".
 */
export interface MetricasPublicacion {
  url: string;
  vistas: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  guardados: number | null;
}

/** De que red es un link, mirando su dominio. */
export function plataformaDeUrl(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "instagram.com") return "instagram";
  if (host === "tiktok.com" || host === "vm.tiktok.com") return "tiktok";
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "kick.com") return "kick";
  return null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Lee las metricas de varias publicaciones de la MISMA red.
 *
 * Se agrupa por plataforma y se manda una sola llamada con todas las
 * URLs: cada arranque de actor tiene su coste fijo, asi que pedirlas de
 * una es bastante mas barato que una llamada por link.
 *
 * Devuelve un mapa por URL. Las que el actor no consiga leer —un post
 * borrado, una cuenta que se hizo privada— simplemente no aparecen, en
 * vez de guardarse como ceros que falsearian el historico.
 */
export async function obtenerMetricasDePublicaciones(
  plataforma: string,
  urls: string[]
): Promise<Map<string, MetricasPublicacion>> {
  const mapa = new Map<string, MetricasPublicacion>();
  const limpias = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (limpias.length === 0) return mapa;

  try {
    if (plataforma === "tiktok") {
      const run = await client.actor("clockworks/tiktok-video-scraper").call({
        postURLs: limpias,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      });
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      for (const bruto of items) {
        const it = bruto as Record<string, unknown>;
        const url = String(it.webVideoUrl || it.url || "");
        if (!url) continue;
        mapa.set(url, {
          url,
          vistas: num(it.playCount),
          meGusta: num(it.diggCount),
          comentarios: num(it.commentCount),
          compartidos: num(it.shareCount),
          guardados: num(it.collectCount),
        });
      }
      return mapa;
    }

    if (plataforma === "instagram") {
      const run = await client.actor("apify/instagram-scraper").call({
        directUrls: limpias,
        resultsType: "posts",
        resultsLimit: limpias.length,
        addParentData: false,
      });
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      for (const bruto of items) {
        const it = bruto as Record<string, unknown>;
        const url = String(it.url || it.inputUrl || "");
        if (!url) continue;
        mapa.set(url, {
          url,
          vistas: num(it.videoPlayCount) ?? num(it.videoViewCount),
          meGusta: num(it.likesCount),
          comentarios: num(it.commentsCount),
          // Instagram no publica compartidos ni guardados.
          compartidos: null,
          guardados: null,
        });
      }
      return mapa;
    }

    if (plataforma === "youtube") {
      const run = await client.actor("streamers/youtube-scraper").call({
        startUrls: limpias.map((url) => ({ url })),
        maxResults: limpias.length,
        maxResultsShorts: 0,
        maxResultStreams: 0,
      });
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      for (const bruto of items) {
        const it = bruto as Record<string, unknown>;
        const url = String(it.url || "");
        if (!url) continue;
        mapa.set(url, {
          url,
          vistas: num(it.viewCount),
          meGusta: num(it.likes),
          comentarios: num(it.commentsCount),
          compartidos: null,
          guardados: null,
        });
      }
      return mapa;
    }

    // Kick no tiene actor de publicaciones sueltas.
    return mapa;
  } catch (error) {
    console.error(`Error leyendo métricas de ${plataforma}:`, error);
    return mapa;
  }
}

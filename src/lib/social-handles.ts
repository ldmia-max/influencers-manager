/**
 * Normalizacion del identificador de una cuenta social.
 *
 * Quien da de alta un creador copia la URL desde la propia plataforma,
 * que es donde tiene el perfil delante. Antes habia que teclear el
 * identificador a mano y pegar la URL fallaba en silencio: el perfil se
 * creaba con las metricas a cero y, peor, ese texto se usaba tambien
 * para construir los enlaces que ve el cliente en el portal de
 * aprobacion, que quedaban rotos.
 *
 * Aqui se acepta cualquier forma razonable y se guarda siempre el
 * identificador limpio.
 *
 * Modulo puro: sin dependencias, para poder usarlo en el navegador y en
 * el servidor.
 */

/** Un id de canal de YouTube: empieza por UC y son 24 caracteres. */
const ID_CANAL_YOUTUBE = /^UC[\w-]{22}$/;

export function esIdDeCanalYouTube(valor: string): boolean {
  return ID_CANAL_YOUTUBE.test(valor);
}

/**
 * Extrae el identificador a partir de lo que sea que hayan escrito.
 *
 * Acepta el identificador suelto, con arroba, la URL completa, sin
 * protocolo, con parametros o con barra final.
 *
 * Si no reconoce el formato devuelve el texto recortado en vez de
 * vaciarlo: es preferible guardar algo aprovechable a descartar la
 * entrada del usuario.
 */
export function normalizarUsuarioSocial(
  plataforma: string,
  valor: string
): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) return "";

  const red = plataforma.trim().toLowerCase();

  // Sin barras ni puntos de dominio: ya es un identificador suelto.
  if (!bruto.includes("/") && !/\b(instagram|tiktok|youtube|kick)\.com/i.test(bruto)) {
    return bruto.replace(/^@/, "");
  }

  // Se descarta el protocolo, el dominio, los parametros y el ancla,
  // y queda la ruta en segmentos.
  const sinProtocolo = bruto.replace(/^[a-z]+:\/\//i, "");
  const sinDominio = sinProtocolo.replace(
    /^(www\.|m\.)?(instagram|tiktok|youtube|kick)\.com\/?/i,
    ""
  );
  const ruta = sinDominio.split(/[?#]/)[0];
  const partes = ruta.split("/").filter(Boolean);

  if (partes.length === 0) return bruto.replace(/^@/, "");

  if (red === "youtube") {
    // youtube.com/@handle | /channel/UCxxx | /c/Nombre | /user/Nombre
    const [primero, segundo] = partes;
    if (primero.startsWith("@")) return primero.slice(1);
    if (["channel", "c", "user"].includes(primero.toLowerCase())) {
      return segundo ?? "";
    }
    return primero;
  }

  // instagram.com/nombre, tiktok.com/@nombre, kick.com/slug
  return partes[0].replace(/^@/, "");
}

/**
 * URL publica del perfil, para enlazarlo desde la interfaz.
 *
 * Los canales de YouTube identificados por id no admiten la forma con
 * arroba y necesitan /channel/.
 */
export function urlDelPerfil(plataforma: string, usuario: string): string | null {
  const red = plataforma.trim().toLowerCase();
  const u = normalizarUsuarioSocial(red, usuario);
  if (!u) return null;

  if (red === "instagram") return `https://www.instagram.com/${u}`;
  if (red === "tiktok") return `https://www.tiktok.com/@${u}`;
  if (red === "kick") return `https://kick.com/${u}`;
  if (red === "youtube") {
    return esIdDeCanalYouTube(u)
      ? `https://www.youtube.com/channel/${u}`
      : `https://www.youtube.com/@${u}`;
  }
  return null;
}

/**
 * Identificador de una publicacion a partir de su enlace.
 *
 * Existe porque emparejar por la URL entera no funciona. Al copiar un
 * enlace desde Instagram se pega con la cola de la sesion de quien lo
 * copio —?utm_source=ig_web_copy_link&stkn=...— y el actor devuelve la
 * forma canonica, sin parametros y a veces con /p/ donde el enlace decia
 * /reel/. Comparando cadenas no coincidian, la metrica se descartaba en
 * silencio y esa publicacion no volvia a aparecer en las graficas: ni
 * error, ni aviso, ni forma de notarlo salvo echar en falta a alguien.
 *
 * El identificador si es estable: el shortcode de Instagram, el id del
 * video en TikTok, el del video en YouTube. Devuelve null cuando no lo
 * reconoce, y entonces se compara por URL como antes.
 */
export function idDePublicacion(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const partes = u.pathname.split("/").filter(Boolean);

  if (host === "instagram.com") {
    // /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE
    const i = partes.findIndex((x) => ["p", "reel", "reels", "tv"].includes(x.toLowerCase()));
    return i >= 0 && partes[i + 1] ? `instagram:${partes[i + 1]}` : null;
  }

  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    // /@usuario/video/ID  ·  /video/ID
    const i = partes.findIndex((x) => x.toLowerCase() === "video");
    if (i >= 0 && partes[i + 1]) return `tiktok:${partes[i + 1]}`;
    // Los enlaces cortos vm.tiktok.com/XXXX no llevan el id a la vista.
    return null;
  }

  if (host === "youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return `youtube:${v}`;
    const i = partes.findIndex((x) => ["shorts", "live", "embed"].includes(x.toLowerCase()));
    return i >= 0 && partes[i + 1] ? `youtube:${partes[i + 1]}` : null;
  }

  if (host === "youtu.be") {
    return partes[0] ? `youtube:${partes[0]}` : null;
  }

  return null;
}

/**
 * El enlace sin la cola que anaden las apps al copiar.
 *
 * Se guarda asi para que lo almacenado sea la publicacion y no el rastro
 * de quien copio el enlace: `stkn` es un token de la sesion de Instagram
 * de esa persona y no pinta nada en la base de datos.
 *
 * En YouTube el parametro `v` SI identifica el video, asi que ahi se
 * conserva y se descarta el resto.
 */
export function limpiarUrlPublicacion(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const v = host === "youtube.com" ? u.searchParams.get("v") : null;

  u.search = "";
  u.hash = "";
  if (v) u.searchParams.set("v", v);

  return u.toString();
}

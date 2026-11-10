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
 * Los dominios de cada red, en UN solo sitio.
 *
 * Antes esta misma lista estaba escrita tres veces —aqui, en el
 * validador de entregas y en la expresion que recorta el dominio al
 * normalizar un usuario—, y anadir una red desde Administracion no
 * tocaba ninguna de las tres. Facebook se dio de alta en produccion con
 * sus formatos y pegar un enlace suyo seguia respondiendo «no es una
 * red reconocida»: la plataforma existia en la base de datos y el
 * codigo no sabia nada de ella.
 *
 * Todo lo que mira el dominio de un enlace sale de aqui. Para sumar una
 * red hacen falta sus anfitriones en este mapa y su nombre visible en
 * NOMBRE_VISIBLE; el resto —el aviso de red equivocada, el mensaje de
 * error al pegar un link, el recorte del dominio— se ajusta solo.
 */
const RED_DEL_ANFITRION: Record<string, string> = {
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "youtu.be": "youtube",
  "kick.com": "kick",
  "www.kick.com": "kick",
  "facebook.com": "facebook",
  "www.facebook.com": "facebook",
  "web.facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "fb.com": "facebook",
  "fb.watch": "facebook",
};

/** Como se escribe cada red cuando se la nombra en pantalla. */
const NOMBRE_VISIBLE: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  kick: "Kick",
  facebook: "Facebook",
};

/**
 * «Instagram, TikTok, YouTube, Kick y Facebook», para los mensajes.
 *
 * Se arma de la propia lista en vez de escribirse a mano: la frase que
 * habia enumeraba cuatro redes y era justo lo que leia alguien cuya red
 * si estaba dada de alta.
 */
export function redesAdmitidas(): string {
  const nombres = [...new Set(Object.values(RED_DEL_ANFITRION))].map(
    (r) => NOMBRE_VISIBLE[r] ?? r
  );
  if (nombres.length < 2) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** El anfitrion sin el subdominio que solo dice desde que aparato se copio. */
function anfitrionBase(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www|m|web)\./, "");
}

const DOMINIOS = Object.keys(RED_DEL_ANFITRION)
  .sort((a, b) => b.length - a.length)
  .map((h) => h.replace(/\./g, "\\."))
  .join("|");

/** Para recortar el dominio de una URL pegada. */
const QUITAR_DOMINIO = new RegExp(`^(${DOMINIOS})/?`, "i");

/** Para distinguir un identificador suelto de una direccion web. */
const PARECE_DOMINIO = new RegExp(`(${DOMINIOS})`, "i");

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
  if (!bruto.includes("/") && !PARECE_DOMINIO.test(bruto)) {
    return bruto.replace(/^@/, "");
  }

  // Se descarta el protocolo y el dominio, y queda la ruta en segmentos.
  // La consulta se guarda aparte porque en Facebook el identificador
  // puede venir ahi: /profile.php?id=100000000000000.
  const sinProtocolo = bruto.replace(/^[a-z]+:\/\//i, "");
  const sinDominio = sinProtocolo.replace(QUITAR_DOMINIO, "");
  const [ruta, consulta = ""] = sinDominio.split(/[?#]/);
  const partes = ruta.split("/").filter(Boolean);

  if (red === "facebook") {
    // Un perfil de Facebook se nombra de tres formas y las tres se
    // pegan tal cual desde el navegador: la bonita /mipagina, la
    // numerica /profile.php?id=100… —la que tiene cualquiera que no
    // haya elegido nombre de usuario— y /people/Nombre-Visible/100….
    const porConsulta = new URLSearchParams(consulta).get("id");
    const primero = partes[0]?.toLowerCase();
    if (primero === "profile.php") return porConsulta ?? "";
    if (primero === "people") return partes[2] ?? partes[1] ?? "";
    return partes[0]?.replace(/^@/, "") ?? bruto.replace(/^@/, "");
  }

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
  if (red === "facebook") {
    // Un identificador todo numeros es un id de perfil, y esos solo
    // abren por /profile.php?id=; facebook.com/100000000000000 no lleva
    // a ninguna parte.
    return /^\d+$/.test(u)
      ? `https://www.facebook.com/profile.php?id=${u}`
      : `https://www.facebook.com/${u}`;
  }
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

  const host = anfitrionBase(u.hostname);
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
 * Pero no toda la consulta sobra: en YouTube `v` ES el video, y en
 * Facebook el enlace de un video (/watch/?v=...) o de una entrada
 * (/story.php?story_fbid=...&id=...) vive entero en la consulta.
 * Vaciarla dejaria guardado un «facebook.com/watch/» que no lleva a
 * ninguna publicacion, y el cliente se encontraria con eso.
 */
const PARAMETROS_QUE_IDENTIFICAN: Record<string, string[]> = {
  "youtube.com": ["v"],
  "facebook.com": ["v", "story_fbid", "id"],
};

export function limpiarUrlPublicacion(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }

  const conservar = PARAMETROS_QUE_IDENTIFICAN[anfitrionBase(u.hostname)] ?? [];
  const guardados = conservar
    .map((nombre) => [nombre, u.searchParams.get(nombre)] as const)
    .filter((par): par is readonly [string, string] => par[1] !== null);

  u.search = "";
  u.hash = "";
  for (const [nombre, valor] of guardados) u.searchParams.set(nombre, valor);

  return u.toString();
}

/**
 * De que red es un enlace, por su dominio.
 *
 * Devuelve el `name` de SocialPlatform en minusculas, o null si el
 * dominio no es de ninguna red conocida —o si ni siquiera es una URL—.
 *
 * Lee RED_DEL_ANFITRION, arriba. Vive aqui y no en apify.ts porque la
 * usa tambien el navegador, para avisar cuando el link pegado no es de
 * la red elegida, y apify.ts arrastra `server-only` a traves de
 * uploads.ts.
 */
export function redDeUrl(valor: string): string | null {
  try {
    return RED_DEL_ANFITRION[new URL(valor.trim()).hostname.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

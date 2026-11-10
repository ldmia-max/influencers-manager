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
 * Lo que sabe cada red —sus dominios, la forma de sus URLs, como se lee
 * el id de una publicacion— vive en `./redes`. Este modulo solo aplica
 * esas fichas: parte la URL, encuentra la red por su anfitrion y
 * delega. Las listas que antes estaban aqui a mano ya no se tocan al
 * anadir una red.
 *
 * Modulo puro: sin dependencias de servidor, para poder usarlo en el
 * navegador y en el servidor.
 */

import { REDES, configDeRed, redDelAnfitrion, type Red } from "./redes";

export { redesAdmitidas } from "./redes";

/** Un id de canal de YouTube: empieza por UC y son 24 caracteres. */
const ID_CANAL_YOUTUBE = /^UC[\w-]{22}$/;

export function esIdDeCanalYouTube(valor: string): boolean {
  return ID_CANAL_YOUTUBE.test(valor);
}

/** Todos los anfitriones conocidos, para reconocer y recortar URLs. */
const ANFITRIONES = Object.values(REDES)
  .flatMap((r) => r.anfitriones)
  .sort((a, b) => b.length - a.length)
  .map((h) => h.replace(/\./g, "\\."))
  .join("|");

/** Para recortar el dominio de una URL pegada. */
const QUITAR_DOMINIO = new RegExp(`^(${ANFITRIONES})/?`, "i");

/** Para distinguir un identificador suelto de una direccion web. */
const PARECE_DOMINIO = new RegExp(`(${ANFITRIONES})`, "i");

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

  const suelto = bruto.replace(/^@/, "");

  // Sin barras ni dominio conocido: ya es un identificador suelto.
  if (!bruto.includes("/") && !PARECE_DOMINIO.test(bruto)) return suelto;

  const config = configDeRed(plataforma);
  if (!config) return suelto;

  // Se descarta el protocolo y el dominio, y queda la ruta en
  // segmentos. La consulta se conserva aparte porque hay redes donde el
  // identificador vive ahi: /profile.php?id=100… en Facebook.
  const sinProtocolo = bruto.replace(/^[a-z]+:\/\//i, "");
  const sinDominio = sinProtocolo.replace(QUITAR_DOMINIO, "");
  const [ruta, consulta = ""] = sinDominio.split(/[?#]/);
  const partes = ruta.split("/").filter(Boolean);

  const leido = config.usuarioDesdeRuta(partes, new URLSearchParams(consulta));
  return leido || suelto;
}

/**
 * URL publica del perfil, para enlazarlo desde la interfaz.
 *
 * Null cuando el codigo no conoce la red: enlazar a algo inventado es
 * peor que no enlazar, sobre todo en el portal del cliente.
 */
export function urlDelPerfil(plataforma: string, usuario: string): string | null {
  const config = configDeRed(plataforma);
  if (!config) return null;

  const u = normalizarUsuarioSocial(plataforma, usuario);
  if (!u) return null;

  return config.urlDelPerfil(u);
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

  const anfitrion = u.hostname.toLowerCase();
  const red = redDelAnfitrion(anfitrion);
  if (!red) return null;

  const partes = u.pathname.split("/").filter(Boolean);
  const id = REDES[red].idDePublicacion(partes, u.searchParams, anfitrion);
  return id ? `${red}:${id}` : null;
}

/**
 * El enlace sin la cola que anaden las apps al copiar.
 *
 * Se guarda asi para que lo almacenado sea la publicacion y no el rastro
 * de quien copio el enlace: `stkn` es un token de la sesion de Instagram
 * de esa persona y no pinta nada en la base de datos.
 *
 * Pero no toda la consulta sobra, y cada red dice en su ficha que
 * parametros SI identifican la pieza: en YouTube `v` ES el video, y en
 * Facebook el enlace de un video (/watch/?v=…) vive entero en la
 * consulta. Vaciarla dejaria guardado un «facebook.com/watch/» que no
 * lleva a ninguna publicacion, y eso es lo que abriria el cliente.
 */
export function limpiarUrlPublicacion(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }

  const red = redDelAnfitrion(u.hostname.toLowerCase());
  const conservar = red ? REDES[red].parametrosDeLaPublicacion : [];
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
 * Vive aqui y no en apify.ts porque la usa tambien el navegador, para
 * avisar cuando el link pegado no es de la red elegida, y apify.ts
 * arrastra `server-only` a traves de uploads.ts.
 */
export function redDeUrl(valor: string): Red | null {
  try {
    return redDelAnfitrion(new URL(valor.trim()).hostname.toLowerCase());
  } catch {
    return null;
  }
}

/**
 * Que sabe la aplicacion de cada red social, en un solo objeto por red.
 *
 * `SocialPlatform` es una tabla a proposito: los formatos y los precios
 * son datos, y darlos de alta no deberia costar un despliegue. Pero hay
 * una parte de cada red que NO es un dato y nunca podra serlo —como se
 * escribe la URL de un perfil, que actor de Apify la lee, como se llama
 * el alcance en su panel, como se extrae el id de una publicacion—, y
 * durante mucho tiempo esa parte estuvo repartida en media docena de
 * listas escritas a mano que no sabian unas de otras.
 *
 * Se vio con Facebook: se dio de alta desde Administracion, con sus
 * formatos, y la red funcionaba para contratar y para pagar pero no
 * para entregar. Pegar un enlace suyo respondia que no era una red
 * reconocida, el enlace al perfil no se pintaba en ninguna parte —ni en
 * el portal del cliente— y al guardar un perfil se perdia el
 * identificador, que quedaba como «www.facebook.com». Nada de eso
 * fallaba con un error: simplemente no pasaba.
 *
 * Ahora todo eso vive aqui. `Red` se deriva de las claves, de modo que
 * al anadir una red el compilador obliga a rellenar su ficha entera en
 * vez de dejar huecos que se descubren semanas despues.
 *
 * Modulo PURO: sin `server-only`, sin Prisma, sin fetch. Lo importan el
 * navegador y el servidor, y apify.ts lo lee —no al reves, porque
 * apify.ts arrastra `server-only` a traves de uploads.ts.
 */

export interface ConfigRed {
  /** Como se escribe cuando se la nombra en pantalla. */
  nombre: string;

  /**
   * Todos los anfitriones que la gente llega a pegar, incluidos los
   * dominios cortos. Lo que no este aqui se rechaza al pegar un link.
   */
  anfitriones: string[];

  /**
   * De la URL al identificador que se guarda.
   *
   * Recibe la ruta ya partida en segmentos y la consulta, porque hay
   * redes donde el identificador vive en la consulta y no en la ruta.
   * Cadena vacia si la URL no lo lleva.
   */
  usuarioDesdeRuta(partes: string[], consulta: URLSearchParams): string;

  /** Del identificador guardado a la URL publica del perfil. */
  urlDelPerfil(usuario: string): string;

  /**
   * Id estable de una publicacion, sin el prefijo de la red.
   *
   * Null cuando no se sabe leer: entonces las metricas se emparejan por
   * URL, que es lo que habia antes y pierde datos en silencio.
   */
  idDePublicacion(
    partes: string[],
    consulta: URLSearchParams,
    anfitrion: string
  ): string | null;

  /**
   * Parametros de la consulta que SI identifican la pieza.
   *
   * Todo lo demas se tira al guardar el enlace: al copiar desde
   * Instagram viene un `stkn`, que es un token de la sesion de quien
   * copio y no pinta nada en la base de datos. Pero vaciar la consulta
   * entera rompe las redes donde la publicacion vive ahi.
   */
  parametrosDeLaPublicacion: string[];

  /**
   * Si la red le da el alcance al autor, y como lo llama en su panel.
   *
   * `nombre: null` significa que alli tambien se llama "alcance" y no
   * hace falta traducirlo. Si la red no lo da, `alcance` es null entero
   * y no se ofrece la casilla: quien la viera buscaria en su panel una
   * fila que no existe.
   */
  alcance: { nombre: string | null } | null;

  /**
   * Actor de Apify que lee un perfil, o null si no hay.
   *
   * Null no es un fallo: Facebook no tiene actor y aun asi es una red
   * util. Lo que importa es que se sepa, porque antes el reparto
   * omitia en silencio lo que no conocia y la cuenta se quedaba sin
   * seguidores, sin foto y sin metricas sin decir nada.
   */
  actorDePerfil: string | null;

  /**
   * Actor para DESCUBRIR cuentas que no estan en la base, o null.
   *
   * Es otra cosa que leer un perfil conocido: Kick tiene lo segundo y
   * no lo primero.
   */
  actorDeBusqueda: string | null;

  /**
   * Actor que lee las metricas de una publicacion, o null.
   *
   * Sin el no hay curva de impacto que dibujar: las entregas de esa red
   * se registran igual, pero nadie las mide. Va de la mano de
   * `idDePublicacion`, que es como se casa cada lectura con su entrega.
   */
  actorDePublicaciones: string | null;
}

/** El primer segmento, sin arroba. Es la forma de la mayoria. */
function primerSegmento(partes: string[]): string {
  return partes[0]?.replace(/^@/, "") ?? "";
}

export const REDES = {
  instagram: {
    nombre: "Instagram",
    anfitriones: ["instagram.com", "www.instagram.com"],
    usuarioDesdeRuta: primerSegmento,
    urlDelPerfil: (u) => `https://www.instagram.com/${u}`,
    idDePublicacion: (partes) => {
      // /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE
      const i = partes.findIndex((x) =>
        ["p", "reel", "reels", "tv"].includes(x.toLowerCase())
      );
      return i >= 0 && partes[i + 1] ? partes[i + 1] : null;
    },
    parametrosDeLaPublicacion: [],
    alcance: { nombre: null },
    actorDePerfil: "apify/instagram-profile-scraper",
    actorDeBusqueda: "apify/instagram-search-scraper",
    actorDePublicaciones: "apify/instagram-scraper",
  },

  tiktok: {
    nombre: "TikTok",
    anfitriones: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"],
    usuarioDesdeRuta: primerSegmento,
    urlDelPerfil: (u) => `https://www.tiktok.com/@${u}`,
    idDePublicacion: (partes) => {
      // /@usuario/video/ID · /video/ID. Los cortos vm.tiktok.com/XXXX
      // no llevan el id a la vista y se quedan sin emparejar.
      const i = partes.findIndex((x) => x.toLowerCase() === "video");
      return i >= 0 && partes[i + 1] ? partes[i + 1] : null;
    },
    parametrosDeLaPublicacion: [],
    alcance: { nombre: "Total espectadores" },
    actorDePerfil: "clockworks/tiktok-profile-scraper",
    actorDeBusqueda: "clockworks/tiktok-user-search-scraper",
    actorDePublicaciones: "clockworks/tiktok-video-scraper",
  },

  youtube: {
    nombre: "YouTube",
    anfitriones: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
    usuarioDesdeRuta: (partes) => {
      // /@handle · /channel/UCxxx · /c/Nombre · /user/Nombre
      const [primero, segundo] = partes;
      if (!primero) return "";
      if (primero.startsWith("@")) return primero.slice(1);
      if (["channel", "c", "user"].includes(primero.toLowerCase())) {
        return segundo ?? "";
      }
      return primero;
    },
    urlDelPerfil: (u) =>
      // Un id de canal (UC + 22 caracteres) no admite la forma con
      // arroba y necesita /channel/.
      /^UC[\w-]{22}$/.test(u)
        ? `https://www.youtube.com/channel/${u}`
        : `https://www.youtube.com/@${u}`,
    idDePublicacion: (partes, consulta, anfitrion) => {
      // youtu.be/ID lleva el video en el unico segmento de la ruta.
      if (anfitrion === "youtu.be") return partes[0] ?? null;
      const v = consulta.get("v");
      if (v) return v;
      const i = partes.findIndex((x) =>
        ["shorts", "live", "embed"].includes(x.toLowerCase())
      );
      if (i >= 0 && partes[i + 1]) return partes[i + 1];
      return null;
    },
    // En YouTube `v` ES el video, no un rastro del copiador.
    parametrosDeLaPublicacion: ["v"],
    alcance: { nombre: "Espectadores únicos" },
    actorDePerfil: "streamers/youtube-channel-scraper",
    actorDeBusqueda: "streamers/youtube-scraper",
    actorDePublicaciones: "streamers/youtube-scraper",
  },

  kick: {
    nombre: "Kick",
    anfitriones: ["kick.com", "www.kick.com"],
    usuarioDesdeRuta: primerSegmento,
    urlDelPerfil: (u) => `https://kick.com/${u}`,
    idDePublicacion: () => null,
    parametrosDeLaPublicacion: [],
    // Kick esta fuera hasta saber si da el alcance al autor; si resulta
    // que si, se anade aqui y no hay nada mas que tocar.
    alcance: null,
    // Hace falta actor porque la API publica de kick.com responde 403 a
    // las peticiones de servidor (Cloudflare).
    actorDePerfil: "aitooolsmax/kick-data-scraper",
    actorDeBusqueda: null,
    // Kick no publica metricas por emision.
    actorDePublicaciones: null,
  },

  facebook: {
    nombre: "Facebook",
    anfitriones: [
      "facebook.com",
      "www.facebook.com",
      "web.facebook.com",
      "m.facebook.com",
      "fb.com",
      "fb.watch",
    ],
    usuarioDesdeRuta: (partes, consulta) => {
      // Un perfil se nombra de tres formas y las tres se pegan tal cual
      // desde el navegador: la bonita /mipagina, la numerica
      // /profile.php?id=100… —la que tiene cualquiera que no haya
      // elegido nombre de usuario— y /people/Nombre-Visible/100….
      const primero = partes[0]?.toLowerCase();
      if (primero === "profile.php") return consulta.get("id") ?? "";
      if (primero === "people") return partes[2] ?? partes[1] ?? "";
      return primerSegmento(partes);
    },
    urlDelPerfil: (u) =>
      // Un identificador todo numeros es un id de perfil, y esos solo
      // abren por /profile.php?id=; facebook.com/100… no lleva a
      // ninguna parte.
      /^\d+$/.test(u)
        ? `https://www.facebook.com/profile.php?id=${u}`
        : `https://www.facebook.com/${u}`,
    // Sin actor que las lea no hay metricas que emparejar.
    idDePublicacion: () => null,
    // El enlace de un video (/watch/?v=…) o de una entrada
    // (/story.php?story_fbid=…&id=…) vive entero en la consulta:
    // vaciarla dejaria guardado un «facebook.com/watch/» que no lleva a
    // ninguna publicacion, y eso es lo que abriria el cliente.
    parametrosDeLaPublicacion: ["v", "story_fbid", "id"],
    // En Meta Business Suite la fila se llama "Alcance".
    alcance: { nombre: null },
    // No hay actor de Facebook: estas cuentas no sincronizan seguidores
    // ni metricas. Se contratan, se aprueban y se pagan igual.
    actorDePerfil: null,
    actorDeBusqueda: null,
    actorDePublicaciones: null,
  },
} satisfies Record<string, ConfigRed>;

/** Las redes que el codigo conoce. Sale de REDES, no se escribe aparte. */
export type Red = keyof typeof REDES;

export const REDES_SOPORTADAS = Object.keys(REDES) as Red[];

/**
 * Las redes que SI tienen actor, derivadas de la propia ficha.
 *
 * Son tipos, no listas: al poner un actor en una red nueva, el `Record`
 * que reparte las llamadas se queda sin una clave y el compilador lo
 * dice. Esa es la diferencia con lo que habia —cuatro `if` escritos a
 * mano— donde una red sin rama no fallaba, simplemente no sincronizaba.
 */
export type RedSincronizable = {
  [K in Red]: (typeof REDES)[K]["actorDePerfil"] extends null ? never : K;
}[Red];

export type RedBuscable = {
  [K in Red]: (typeof REDES)[K]["actorDeBusqueda"] extends null ? never : K;
}[Red];

export const REDES_BUSCABLES = REDES_SOPORTADAS.filter(
  (r) => REDES[r].actorDeBusqueda !== null
) as RedBuscable[];

export function esRedSoportada(nombre: string | null | undefined): nombre is Red {
  if (!nombre) return false;
  return nombre.trim().toLowerCase() in REDES;
}

/** La ficha de una red por su `SocialPlatform.name`, o null si no la conoce. */
export function configDeRed(nombre: string | null | undefined): ConfigRed | null {
  if (!nombre) return null;
  return REDES[nombre.trim().toLowerCase() as Red] ?? null;
}

/** De que red es un anfitrion, o null. */
export function redDelAnfitrion(anfitrion: string): Red | null {
  const buscado = anfitrion.toLowerCase();
  for (const red of REDES_SOPORTADAS) {
    if (REDES[red].anfitriones.includes(buscado)) return red;
  }
  return null;
}

/**
 * «Instagram, TikTok, YouTube, Kick y Facebook», para los mensajes.
 *
 * Se arma de la propia lista en vez de escribirse a mano: la frase que
 * habia enumeraba cuatro redes y era justo lo que leia alguien cuya red
 * si estaba dada de alta.
 */
export function redesAdmitidas(): string {
  const nombres = REDES_SOPORTADAS.map((r) => REDES[r].nombre);
  if (nombres.length < 2) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Que le falta a una red para funcionar del todo.
 *
 * Lo lee Administracion para avisar al crear una plataforma que el
 * codigo no conoce, o que conoce a medias. Devuelve frases listas para
 * pintar, de mas grave a menos.
 */
export type NivelDeSoporte = "completo" | "parcial" | "ninguno";

/**
 * Cuanto sabe el codigo de una red, para que Administracion lo diga.
 *
 * El objetivo es que el hueco se vea al crear la plataforma y no
 * semanas despues, cuando alguien pega un link y lee que su red no es
 * una red reconocida.
 */
export function soporteDeRed(nombre: string): {
  nivel: NivelDeSoporte;
  carencias: string[];
} {
  const carencias = carenciasDeRed(nombre);
  if (!configDeRed(nombre)) return { nivel: "ninguno", carencias };
  return { nivel: carencias.length > 0 ? "parcial" : "completo", carencias };
}

export function carenciasDeRed(nombre: string): string[] {
  const config = configDeRed(nombre);

  if (!config) {
    return [
      "El código no conoce esta red: no se podrán pegar enlaces de perfil ni registrar entregas con un link.",
      "Tampoco sincroniza con Apify: seguidores, foto y métricas se quedan vacíos.",
      "Se puede contratar y pagar con normalidad, y el usuario de la cuenta hay que escribirlo a mano.",
    ];
  }

  const faltas: string[] = [];
  if (!config.actorDePerfil) {
    faltas.push(
      "No hay actor de Apify para el perfil: seguidores y foto no se sincronizan."
    );
  }
  if (!config.actorDePublicaciones) {
    faltas.push(
      "No se miden las publicaciones: no hay actor que lea vistas ni interacciones."
    );
  }
  if (!config.alcance) {
    faltas.push("No se pide el alcance: esta red no se lo muestra al autor.");
  }
  return faltas;
}

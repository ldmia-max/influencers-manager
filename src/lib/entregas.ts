/**
 * Estado de entrega de los contenidos de una campana.
 *
 * Nada de esto se guarda en columnas: se calcula a partir de los hechos
 * —la fecha limite del formato y cuando se registro cada link—. Una
 * columna `estaRetrasado` obligaria a un proceso que la refrescara cada
 * dia, y el dia que ese proceso fallara los datos mentirian sin que
 * nadie se enterara. Comparando fechas, la verdad se recalcula sola en
 * cada consulta.
 *
 * Se usa desde el servidor y desde el navegador, asi que no importa
 * Prisma ni nada de Node.
 */

export type EstadoEntrega =
  /** Aun no vence y falta contenido. */
  | "PENDIENTE"
  /** Vencio sin completarse. */
  | "INCUMPLIDO"
  /** Completo, dentro de plazo. */
  | "A_TIEMPO"
  /** Completo, pero algun link llego despues de la fecha. */
  | "CON_RETRASO"
  /** El formato no tiene fecha limite puesta todavia. */
  | "SIN_PLAZO";

export const ETIQUETA_ENTREGA: Record<EstadoEntrega, string> = {
  PENDIENTE: "Pendiente",
  INCUMPLIDO: "Incumplido",
  A_TIEMPO: "A tiempo",
  CON_RETRASO: "Con retraso",
  SIN_PLAZO: "Sin plazo",
};

export const COLOR_ENTREGA: Record<EstadoEntrega, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  INCUMPLIDO: "bg-red-100 text-red-800",
  A_TIEMPO: "bg-green-100 text-green-800",
  CON_RETRASO: "bg-orange-100 text-orange-800",
  SIN_PLAZO: "bg-gray-100 text-gray-700",
};

export interface EntregaMinima {
  entregadoEn: Date | string;
}

export interface FormatoEntregable {
  /** Cuantos links se esperan. Un combo se da por cumplido con uno. */
  quantity: number;
  esCombo: boolean;
  fechaLimite: Date | string | null;
  entregas: EntregaMinima[];
}

export interface EstadoFormato {
  estado: EstadoEntrega;
  entregados: number;
  esperados: number;
  completo: boolean;
  /** Dias de retraso, o los que faltan si aun no vence. Null sin plazo. */
  diasRespectoAlPlazo: number | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function aFecha(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/**
 * Cuantos links se esperan de un formato.
 *
 * Un combo es un acuerdo en texto libre ("Reel + 3 Stories"), asi que no
 * hay forma fiable de saber cuantas piezas incluye: se pide al menos uno
 * y se deja anadir los que hagan falta. Inventar un numero a partir de la
 * descripcion daria falsos incumplimientos.
 */
export function unidadesEsperadas(formato: {
  quantity: number;
  esCombo: boolean;
}): number {
  return formato.esCombo ? 1 : Math.max(1, formato.quantity);
}

/**
 * Estado de entrega de UN formato.
 *
 * `ahora` se pasa como argumento en vez de leer el reloj dentro para que
 * el resultado sea el mismo en el servidor y en el navegador durante un
 * mismo render: si cada lado mirase su propio reloj, un formato que vence
 * justo ahora podria pintarse distinto en cada sitio.
 */
export function estadoDeFormato(
  formato: FormatoEntregable,
  ahora: Date = new Date()
): EstadoFormato {
  const esperados = unidadesEsperadas(formato);
  const entregados = formato.entregas.length;
  const completo = entregados >= esperados;

  if (!formato.fechaLimite) {
    return {
      estado: "SIN_PLAZO",
      entregados,
      esperados,
      completo,
      diasRespectoAlPlazo: null,
    };
  }

  const limite = aFecha(formato.fechaLimite);

  if (!completo) {
    const vencido = ahora.getTime() > limite.getTime();
    return {
      estado: vencido ? "INCUMPLIDO" : "PENDIENTE",
      entregados,
      esperados,
      completo: false,
      diasRespectoAlPlazo: Math.ceil((ahora.getTime() - limite.getTime()) / DIA_MS),
    };
  }

  // Completo: manda el link mas tardio. Si uno solo llego fuera de plazo,
  // la entrega fue con retraso, aunque el resto fuese puntual.
  const ultimo = Math.max(
    ...formato.entregas.map((e) => aFecha(e.entregadoEn).getTime())
  );
  const retraso = ultimo - limite.getTime();

  return {
    estado: retraso > 0 ? "CON_RETRASO" : "A_TIEMPO",
    entregados,
    esperados,
    completo: true,
    diasRespectoAlPlazo: Math.ceil(retraso / DIA_MS),
  };
}

/**
 * Resumen de un conjunto de formatos: el de un influencer o el de toda
 * la campana.
 */
export function resumirEntregas(
  formatos: FormatoEntregable[],
  ahora: Date = new Date()
): {
  total: number;
  completos: number;
  incumplidos: number;
  conRetraso: number;
  aTiempo: number;
  pendientes: number;
  /** Todos los formatos tienen sus links. Es lo que exige cerrar la campana. */
  todoEntregado: boolean;
} {
  let completos = 0;
  let incumplidos = 0;
  let conRetraso = 0;
  let aTiempo = 0;
  let pendientes = 0;

  for (const formato of formatos) {
    const e = estadoDeFormato(formato, ahora);
    if (e.completo) completos++;
    switch (e.estado) {
      case "INCUMPLIDO":
        incumplidos++;
        break;
      case "CON_RETRASO":
        conRetraso++;
        break;
      case "A_TIEMPO":
        aTiempo++;
        break;
      case "PENDIENTE":
      case "SIN_PLAZO":
        if (!e.completo) pendientes++;
        break;
    }
  }

  return {
    total: formatos.length,
    completos,
    incumplidos,
    conRetraso,
    aTiempo,
    pendientes,
    todoEntregado: completos === formatos.length,
  };
}

/**
 * Nivel de cumplimiento historico de un influencer.
 *
 * Tampoco se guarda en Profile: se cuenta sobre sus formatos de todas las
 * campanas. Un numero denormalizado habria que mantenerlo al dia cada vez
 * que se registra un link, se cambia una fecha o se retira a alguien, y
 * es justo el tipo de dato que se queda obsoleto sin avisar.
 *
 * Solo cuentan los formatos ya vencidos: puntuar por lo que aun esta en
 * plazo penalizaria a quien acaba de entrar en una campana.
 */
export function nivelDeCumplimiento(
  formatos: FormatoEntregable[],
  ahora: Date = new Date()
): {
  evaluados: number;
  aTiempo: number;
  conRetraso: number;
  incumplidos: number;
  /** 0 a 100, o null si todavia no hay nada que evaluar. */
  porcentaje: number | null;
} {
  let evaluados = 0;
  let aTiempo = 0;
  let conRetraso = 0;
  let incumplidos = 0;

  for (const formato of formatos) {
    if (!formato.fechaLimite) continue;
    const e = estadoDeFormato(formato, ahora);
    // Lo que aun no ha vencido no dice nada del influencer.
    if (e.estado === "PENDIENTE") continue;

    evaluados++;
    if (e.estado === "A_TIEMPO") aTiempo++;
    else if (e.estado === "CON_RETRASO") conRetraso++;
    else if (e.estado === "INCUMPLIDO") incumplidos++;
  }

  return {
    evaluados,
    aTiempo,
    conRetraso,
    incumplidos,
    porcentaje: evaluados === 0 ? null : Math.round((aTiempo / evaluados) * 100),
  };
}

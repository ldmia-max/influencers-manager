/**
 * El dia, tal y como lo cuenta la agencia.
 *
 * "Vence dentro de dos dias" y "vencio ayer" dependen de donde se corte
 * el dia, y ahi el servidor y la oficina no coinciden: el contenedor
 * corre en UTC y el equipo trabaja en Colombia (UTC-5). Una fecha limite
 * guardada como el dia 10 a medianoche UTC es el dia 9 a las 19:00 en
 * Bogota, asi que comparar instantes en bruto desplaza los avisos un dia
 * justo en los bordes, que es cuando importan.
 *
 * La solucion aqui es no comparar instantes sino dias: cada fecha se
 * reduce a su "YYYY-MM-DD en Bogota" y se comparan esas cadenas. Dos
 * fechas del mismo dia laboral dan la misma cadena, vengan con la hora
 * que vengan.
 *
 * Modulo puro: sin Prisma ni Node, para poder usarlo tambien en el
 * navegador.
 */

/** Donde trabaja la agencia. De aqui sale cuando empieza y acaba un dia. */
export const ZONA_AGENCIA = "America/Bogota";

const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_AGENCIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El dia de una fecha en la zona de la agencia, como "YYYY-MM-DD". */
export function diaEnAgencia(fecha: Date): string {
  // en-CA ya emite YYYY-MM-DD, asi que no hay que recomponer nada.
  return FORMATO.format(fecha);
}

/**
 * El dia que sera dentro de `dias`, contado en la zona de la agencia.
 *
 * Se suman dias enteros al instante y luego se reduce a dia, en vez de
 * manipular la cadena: asi los cambios de horario —si algun dia los
 * hubiera— los resuelve Intl y no una resta a mano.
 */
export function diaRelativo(dias: number, desde: Date = new Date()): string {
  const movida = new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);
  return diaEnAgencia(movida);
}

/** Dia de la semana en la zona de la agencia: 1 es lunes, 7 domingo. */
export function diaDeLaSemana(fecha: Date = new Date()): number {
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_AGENCIA,
    weekday: "short",
  }).format(fecha);
  const dias = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return dias.indexOf(nombre) + 1;
}

/** "12 de septiembre de 2026", para escribirlo en un correo. */
export function fechaLegible(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_AGENCIA,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

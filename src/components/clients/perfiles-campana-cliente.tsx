import { CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import {
  PROFILE_STATUS_COLORS,
  PROFILE_STATUS_LABELS,
} from "@/lib/campaign-utils";

/**
 * Lo que el portal recibe de cada formato contratado.
 *
 * `precio` y `subtotal` llegan ya con el margen aplicado y como cadena:
 * la multiplicacion la hizo el servidor. Aqui no hay `basePrice` ni
 * `markupPercentage` a proposito —juntos dicen cuanto carga la agencia
 * encima, y eso no sale de la agencia.
 */
export interface FormatoCliente {
  id: string;
  quantity: number;
  esCombo: boolean;
  comboDescripcion: string | null;
  isApproved: boolean;
  clientNotes: string | null;
  rejectionReason: string | null;
  precio: string;
  subtotal: string;
  profileService: { serviceType: { displayName: string } } | null;
  entregas: {
    id: string;
    url: string | null;
    publicadoEn: Date | null;
    entregadoEn: Date;
    serviceType: { displayName: string } | null;
  }[];
}

export interface PerfilCliente {
  id: string;
  status: string;
  participacion: string;
  rejectionReason: string | null;
  profile: { id: string; name: string };
  platforms: {
    id: string;
    status: string;
    socialAccount: {
      username: string;
      followers: number | null;
      platform: { name: string; displayName: string };
    };
    services: FormatoCliente[];
  }[];
}

/**
 * Lo que cuesta este creador entero, con el margen ya dentro y sin
 * desglosarlo: para el cliente ese numero es el precio.
 */
function totalDelPerfil(cp: PerfilCliente): number {
  return cp.platforms.reduce(
    (suma, cpp) =>
      suma + cpp.services.reduce((t, cs) => t + Number(cs.subtotal), 0),
    0
  );
}

/**
 * En que bloque va cada creador. Mas bajo, mas arriba en la lista.
 *
 * El cliente abre esta pestana para ver quien trabaja en su campana, y
 * eso tiene que leerse de un vistazo. En el orden en que venian —el de
 * la base de datos— un rechazado podia abrir la lista y empujar hacia
 * abajo a los contratados.
 *
 * 0. Aprobados y dentro: la campana real, lo que se esta pagando.
 * 1. Pendientes: todavia pueden entrar, y si el cliente no ha
 *    contestado son justo los que le toca mirar.
 * 2. Retirados sin rechazo: estuvieron contratados y ya no siguen.
 * 3. Rechazados: no participan y ademas fue decision del propio
 *    cliente, asi que no le dicen nada que no sepa. Van al final.
 *
 * El rechazo se mira ANTES que la retirada: llegar a "En proceso"
 * retira automaticamente a quien el cliente rechazo, de modo que casi
 * todo rechazado esta tambien retirado y si no, los dos grupos se
 * confundirian en uno.
 */
function grupoDelPerfil(cp: PerfilCliente): number {
  if (cp.status === "REJECTED") return 3;
  if (cp.participacion === "RETIRADO") return 2;
  if (cp.status === "APPROVED") return 0;
  return 1;
}

/**
 * Dentro de cada bloque, de mas caro a mas barato: es el orden en que
 * el cliente quiere repasarlos, porque donde esta el dinero es donde
 * importa fijarse.
 *
 * El nombre desempata. Sin el, dos creadores que cuestan lo mismo
 * podrian intercambiarse entre una carga y otra y la lista parecia
 * moverse sola.
 */
function ordenarPerfiles(perfiles: PerfilCliente[]): PerfilCliente[] {
  return [...perfiles].sort((a, b) => {
    const porGrupo = grupoDelPerfil(a) - grupoDelPerfil(b);
    if (porGrupo !== 0) return porGrupo;

    const porCoste = totalDelPerfil(b) - totalDelPerfil(a);
    if (porCoste !== 0) return porCoste;

    return a.profile.name.localeCompare(b.profile.name, "es");
  });
}

function formatearFecha(fecha: Date | string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(fecha));
}

/**
 * Los creadores de la campana, tal como los ve el cliente.
 *
 * Aparecen TODOS los que pasaron por la campana, no solo los
 * contratados: quien fue rechazado o se retiro tambien estuvo, y
 * esconderlo deja al cliente mirando una propuesta que no cuadra con la
 * que recordaba. Lo que no se dice es POR QUE se retiro alguien
 * —`motivoRetiro` ni siquiera sale de la base de datos—: esa es una
 * conversacion entre la agencia y el creador.
 *
 * El orden lo pone `ordenarPerfiles`: primero quien esta contratado,
 * al final quien no participa, y dentro de cada bloque de mas caro a
 * mas barato. Ver alli el porque de cada escalon.
 *
 * Un retirado se pinta apagado y su insignia manda sobre el estado de
 * aprobacion: son dos ejes distintos —si el cliente dijo que si, y si
 * sigue contratado— pero en la insignia solo cabe uno, y mirando la
 * campana el que importa es si sigue dentro.
 *
 * No hay nada que pulsar. Anadir, retirar o repreciar son decisiones de
 * la agencia; aqui solo se consulta.
 */
export function PerfilesCampanaCliente({
  perfiles,
}: {
  perfiles: PerfilCliente[];
}) {
  if (perfiles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          Todavía no hay creadores en esta campaña. Cuando tu equipo de cuenta
          arme la propuesta, aparecerán aquí.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {ordenarPerfiles(perfiles).map((cp) => {
        const retirado = cp.participacion === "RETIRADO";
        const totalPerfil = totalDelPerfil(cp);

        return (
          <div
            key={cp.id}
            className={`rounded-lg border p-4 ${
              retirado
                ? "border-gray-300 bg-gray-100 opacity-75"
                : cp.status === "REJECTED"
                  ? "border-red-300 bg-red-50"
                  : cp.status === "APPROVED"
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200"
            }`}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-medium text-gray-900">{cp.profile.name}</h3>
              <div className="flex flex-col items-end gap-2">
                {/* El importe de un retirado ya no cuenta para la
                    campana, asi que decirlo como "total" induciria a
                    sumarlo. Se calla. */}
                {!retirado && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total del creador</p>
                    <p className="text-base font-semibold tabular-nums text-gray-900">
                      ${formatNumber(String(Math.round(totalPerfil)))}
                    </p>
                  </div>
                )}
                {/* Retirado manda sobre aprobado: son dos ejes —si el
                    cliente dijo que si, y si sigue contratado— y al
                    mirar la campana el que importa es si sigue dentro.

                    El rechazo es la excepcion, y se pintan los dos.
                    Llegar a "En proceso" retira automaticamente a quien
                    el cliente rechazo, de modo que todo rechazado acaba
                    retirado: con una sola insignia, el cliente no
                    volveria a ver nunca a quien el mismo descarto. */}
                <div className="flex items-center gap-1.5">
                  {cp.status === "REJECTED" && (
                    <Badge className={PROFILE_STATUS_COLORS.REJECTED}>
                      {PROFILE_STATUS_LABELS.REJECTED}
                    </Badge>
                  )}
                  {retirado ? (
                    <Badge className="bg-gray-200 text-gray-700">Retirado</Badge>
                  ) : (
                    cp.status !== "REJECTED" && (
                      <Badge className={PROFILE_STATUS_COLORS[cp.status]}>
                        {PROFILE_STATUS_LABELS[cp.status] ?? cp.status}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* El motivo del rechazo lo escribio el propio cliente:
                devolverselo es recordarle lo que dijo. */}
            {cp.status === "REJECTED" && cp.rejectionReason && (
              <p className="mb-3 rounded-md bg-white/70 px-2 py-1.5 text-xs text-gray-700">
                <span className="text-gray-500">Tu motivo: </span>
                {cp.rejectionReason}
              </p>
            )}

            <div className="space-y-3">
              {cp.platforms.map((cpp) => (
                <div key={cpp.id} className="space-y-2">
                  <p className="text-xs text-gray-500">
                    @{cpp.socialAccount.username} ·{" "}
                    {cpp.socialAccount.platform.displayName}
                    {cpp.socialAccount.followers != null &&
                      ` · ${formatCompactNumber(cpp.socialAccount.followers)} seguidores`}
                  </p>

                  {cpp.services.map((cs) => (
                    <div
                      key={cs.id}
                      className="rounded-lg bg-white/70 p-3 ring-1 ring-gray-200/60"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {cs.esCombo
                              ? cs.comboDescripcion || "Combo"
                              : (cs.profileService?.serviceType.displayName ??
                                "Formato")}
                            {cs.quantity > 1 && (
                              <span className="ml-1 font-normal text-gray-500">
                                × {cs.quantity}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-sm font-medium tabular-nums text-gray-900">
                          ${formatNumber(cs.subtotal)}
                        </p>
                      </div>

                      {cs.entregas.length === 0 ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Pendiente de publicación
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {cs.entregas.map((e) =>
                            e.url ? (
                              <li
                                key={e.id}
                                className="flex items-center gap-1"
                              >
                                {/* Que pieza es. En un combo es lo unico
                                    que lo dice: la cabecera solo lleva el
                                    texto del acuerdo. */}
                                {e.serviceType && (
                                  <span className="text-xs text-gray-500">
                                    {e.serviceType.displayName} ·
                                  </span>
                                )}
                                <a
                                  href={e.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Ver publicación
                                </a>
                              </li>
                            ) : (
                              // Stories y directos no dejan enlace. Se dice
                              // cuando se emitio en vez de ofrecer un link
                              // roto, que es lo que veria el cliente al
                              // entrar dias despues.
                              <li
                                key={e.id}
                                className="inline-flex items-center gap-1 text-xs text-gray-600"
                              >
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                {e.serviceType && (
                                  <span className="text-gray-500">
                                    {e.serviceType.displayName} ·
                                  </span>
                                )}
                                Emitido el{" "}
                                {formatearFecha(e.publicadoEn ?? e.entregadoEn)}
                                <span className="text-gray-400">
                                  · sin enlace permanente
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

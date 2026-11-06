"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Link2,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Send,
} from "lucide-react";
import { regenerateApprovalToken, reenviarRevision } from "@/services/campaign";
import type { ApprovalToken, DecisionDeRevision } from "@/models/campaign";

interface ApprovalTokensCardProps {
  campaignId: string;
  tokens: ApprovalToken[];
  campaignStatus: string;
  /**
   * Quiénes pueden aprobar esta campaña.
   *
   * Hace falta para saber a quién le FALTA enlace. Antes la tarjeta
   * solo miraba si existía alguno vivo, así que añadir contactos a una
   * campaña ya enviada escondía el botón —había un enlace, el del
   * primero— y los nuevos se quedaban sin forma de entrar.
   */
  contactos?: { id: string; nombre: string; isActive: boolean }[];
  /** Lo que cada contacto del cliente decidió, y cuándo. */
  decisiones?: DecisionDeRevision[];
}

export function ApprovalTokensCard({
  campaignId,
  tokens,
  campaignStatus,
  contactos = [],
  decisiones = [],
}: ApprovalTokensCardProps) {
  const router = useRouter();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isReenviando, setIsReenviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<{ ok: boolean; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Memoizar tokens ordenados por fecha de creación (más reciente primero)
  const sortedTokens = useMemo(
    () =>
      [...tokens].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [tokens]
  );

  // Los enlaces vivos: uno por contacto de la campana, no uno solo.
  const enlacesActivos = useMemo(
    () =>
      sortedTokens.filter((t) => !t.usedAt && new Date(t.expiresAt) >= new Date()),
    [sortedTokens]
  );

  // El que se ofrece para copiar es el del primero de la lista, que por
  // orden es el mas reciente. Los demas estan en el historial con su
  // propio boton: pegarle al cliente el enlace de otra persona haria
  // que la decision quedase firmada con un nombre que no es el suyo.
  const activeToken = enlacesActivos[0];

  /**
   * Los contactos que NO tienen enlace vivo.
   *
   * Esta es la condición del botón, y no "¿hay algún enlace?". Mientras
   * lo fuese, bastaba con que a uno le quedara el suyo para que a los
   * demás no hubiera forma de emitírselo: el caso que llega de verdad
   * es añadir gente a una campaña que ya está en Revisión.
   */
  const sinEnlace = useMemo(
    () =>
      contactos.filter(
        (c) =>
          c.isActive &&
          !enlacesActivos.some((t) => t.clientContactId === c.id)
      ),
    [contactos, enlacesActivos]
  );

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXTAUTH_URL || "http://localhost:3000";

  const getApprovalUrl = (token: string) => `${baseUrl}/approve/${token}`;

  const copyToClipboard = async (token: string) => {
    const url = getApprovalUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const handleRegenerateToken = async () => {
    setIsRegenerating(true);
    setError(null);
    setAvisoEnvio(null);

    try {
      const data = await regenerateApprovalToken(campaignId);

      /**
       * Se copia solo cuando se emitió UNO.
       *
       * Cada enlace es de una persona —la decisión queda firmada con su
       * nombre—, así que copiar uno de tres en silencio invita a
       * pegárselo a quien no es. Con varios, cada uno tiene su botón de
       * copiar en la lista de abajo.
       */
      const unoSolo = (data.destinatarios?.length ?? 1) === 1;

      if (unoSolo) {
        await navigator.clipboard.writeText(data.approvalUrl);
        setCopiedToken(data.token.token);
        setTimeout(() => setCopiedToken(null), 2000);
      }

      // El enlace se genera aunque el correo falle, asi que hay que decir
      // cual de las dos cosas pasó. Antes siempre ponia "regenerado" y el
      // equipo daba por enviado un correo que nunca salió.
      setAvisoEnvio(
        data.email?.sent === false
          ? {
              ok: false,
              texto: `El enlace está listo${
                unoSolo ? " y copiado" : ""
              }, pero el correo a ${
                data.emailRecipient ?? "el cliente"
              } no salió (${data.email.error ?? data.email.reason}). ${
                unoSolo
                  ? "Pégaselo tú."
                  : "Copia el de cada uno abajo y pásaselo tú."
              }`,
            }
          : {
              ok: true,
              texto: unoSolo
                ? `Enlace enviado a ${data.emailRecipient ?? "el cliente"} y copiado al portapapeles.`
                : `Enlaces enviados a ${data.emailRecipient ?? "los contactos"}. Cada uno tiene el suyo en la lista de abajo.`,
            }
      );

      // Refrescar la página para mostrar el nuevo token
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Vuelve a mandar los MISMOS enlaces.
   *
   * No recarga la página: no cambia nada que se vea —los enlaces son
   * los de antes— y recargar se llevaría por delante el único dato que
   * importa aquí, que es si el correo salió o no.
   */
  const handleReenviar = async () => {
    setIsReenviando(true);
    setError(null);
    setAvisoEnvio(null);

    try {
      const data = await reenviarRevision(campaignId);
      const fallidos = data.destinatarios.filter((d) => !d.sent);

      setAvisoEnvio(
        fallidos.length === 0
          ? {
              ok: true,
              texto: `Enlace reenviado a ${data.destinatarios
                .map((d) => d.email)
                .join(", ")}.`,
            }
          : {
              ok: false,
              texto: `El correo a ${fallidos
                .map((d) => d.email)
                .join(", ")} tampoco salió (${
                fallidos[0].error ?? "sin detalle"
              }). Copia el enlace y pásaselo tú.`,
            }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsReenviando(false);
    }
  };

  const getTokenStatus = (token: ApprovalToken) => {
    if (token.usedAt) {
      return { label: "Usado", variant: "secondary" as const, icon: CheckCircle2 };
    }
    const isExpired = new Date(token.expiresAt) < new Date();
    if (isExpired) {
      return { label: "Expirado", variant: "destructive" as const, icon: XCircle };
    }
    return { label: "Activo", variant: "default" as const, icon: Clock };
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDaysUntilExpiry = (expiresAt: Date | string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const admiteEnlace = campaignStatus === "REVIEW" || campaignStatus === "ACTIVE";

  // Antes devolvia null y la pestana quedaba en blanco, que no se
  // distingue de algo roto. Si todavia no se puede generar un enlace,
  // lo que hace falta es decir cuando se podra.
  if (tokens.length === 0 && !admiteEnlace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Enlaces de aprobación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Todavía no hay enlace de aprobación.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {campaignStatus === "COMPLETED" || campaignStatus === "CANCELLED"
              ? "Esta campaña ya terminó, así que no se generarán más enlaces."
              : "Se genera al enviar la campaña a revisión, que es cuando el cliente tiene algo que aprobar."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Enlaces de aprobación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mensaje de error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {avisoEnvio && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              avisoEnvio.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {avisoEnvio.texto}
          </div>
        )}

        {/* Emitir enlace para quien no lo tiene. Antes la condición era
            "no hay ningún enlace vivo", y eso escondía el botón justo
            cuando hacía falta: al añadir contactos a una campaña ya
            enviada, el del primero seguía vigente. */}
        {sinEnlace.length > 0 && admiteEnlace && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
            <p className="text-sm text-yellow-800">
              {enlacesActivos.length > 0
                ? `${
                    sinEnlace.length === 1
                      ? `${sinEnlace[0].nombre} todavía no tiene`
                      : `${sinEnlace.length} contactos todavía no tienen`
                  } enlace de aprobación. Los enlaces que ya están vigentes no se tocan.`
                : campaignStatus === "ACTIVE"
                  ? "Genera un enlace para que el cliente apruebe los influencers que añadiste. La campaña sigue en proceso mientras tanto."
                  : "No hay un enlace de aprobación activo. El anterior expiró o ya fue utilizado."}
            </p>
            <Button
              onClick={handleRegenerateToken}
              disabled={isRegenerating}
              className="w-full"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {enlacesActivos.length > 0
                    ? `Generar enlace para ${
                        sinEnlace.length === 1
                          ? sinEnlace[0].nombre
                          : `${sinEnlace.length} contactos`
                      }`
                    : campaignStatus === "ACTIVE"
                      ? "Reenviar para revisión"
                      : "Regenerar enlace de aprobación"}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Reenviar los MISMOS enlaces, para cuando el correo falla.
            Separado del de arriba a propósito: aquel emite enlaces
            nuevos, y usarlo como reenvío mataría el que el cliente
            quizá ya tiene abierto. */}
        {enlacesActivos.length > 0 && admiteEnlace && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-gray-50 p-3">
            <p className="text-xs text-gray-600">
              ¿No le llegó el correo? Vuelve a enviarle el mismo enlace, sin
              generar uno nuevo.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReenviar}
              disabled={isReenviando}
            >
              {isReenviando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Reenviar a revisión
                </>
              )}
            </Button>
          </div>
        )}

        {/* URL activa para copiar */}
        {activeToken && admiteEnlace && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Enlace de {activeToken.sentToName || activeToken.sentToEmail}
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={getApprovalUrl(activeToken.token)}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(activeToken.token)}
                className="shrink-0"
              >
                {copiedToken === activeToken.token ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {getDaysUntilExpiry(activeToken.expiresAt) > 0 && (
                <>
                  Expira en {getDaysUntilExpiry(activeToken.expiresAt)} día
                  {getDaysUntilExpiry(activeToken.expiresAt) !== 1 ? "s" : ""}.{" "}
                </>
              )}
              {enlacesActivos.length > 1 && (
                <>
                  Cada contacto tiene el suyo ({enlacesActivos.length} en total):
                  cópialos abajo, uno por persona.
                </>
              )}
            </p>
          </div>
        )}

        {/* Quien decidio que.
            Antes la campana solo guardaba CUANDO se reviso cada
            influencer. Con varios contactos aprobando la misma
            campana, saber quien dijo que si a un coste deja de ser un
            detalle. */}
        {decisiones.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Decisiones del cliente
            </label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Influencer</TableHead>
                    <TableHead>Decisión</TableHead>
                    <TableHead>Quién</TableHead>
                    <TableHead>Cuándo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisiones.map((d, i) => (
                    <TableRow key={`${d.influencer}-${i}`}>
                      <TableCell className="text-sm font-medium">
                        {d.influencer}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            d.status === "APPROVED"
                              ? "default"
                              : d.status === "REJECTED"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {d.status === "APPROVED"
                            ? "Aprobado"
                            : d.status === "REJECTED"
                            ? "Rechazado"
                            : "Pendiente"}
                        </Badge>
                        {d.motivo && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {d.motivo}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.quien ? (
                          <div>
                            <p className="font-medium">{d.quien}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.quienEmail}
                            </p>
                          </div>
                        ) : (
                          // Lo decidido antes de que se registrara
                          // quien, y lo que aprueba la propia agencia.
                          // Poner aqui al contacto principal seria
                          // inventarse una firma.
                          <span className="text-muted-foreground">
                            {d.reviewedAt ? "Sin registrar" : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.reviewedAt ? (
                          formatDate(d.reviewedAt)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Historial de tokens */}
        {tokens.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Historial de enlaces
            </label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enviado a</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Entró</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTokens.map((token) => {
                    const status = getTokenStatus(token);
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={token.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {token.sentToName || "Sin nombre"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {token.sentToEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(token.createdAt)}
                        </TableCell>
                        {/* Cuando verifico su correo. Es la prueba de
                            que abrio el enlace quien lo recibio y no
                            alguien a quien se lo reenviaron: el codigo
                            solo llega a esa direccion. */}
                        <TableCell className="text-sm">
                          {token.verifiedAt ? (
                            formatDate(token.verifiedAt)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!token.usedAt && new Date(token.expiresAt) > new Date() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(token.token)}
                            >
                              {copiedToken === token.token ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
import { Link2, Copy, Check, Clock, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { regenerateApprovalToken } from "@/services/campaign";
import type { ApprovalToken } from "@/models/campaign";

interface ApprovalTokensCardProps {
  campaignId: string;
  tokens: ApprovalToken[];
  campaignStatus: string;
}

export function ApprovalTokensCard({ campaignId, tokens, campaignStatus }: ApprovalTokensCardProps) {
  const router = useRouter();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
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

  // Memoizar token activo (el más reciente que no ha sido usado y no ha expirado)
  const activeToken = useMemo(
    () =>
      sortedTokens.find((t) => {
        const isExpired = new Date(t.expiresAt) < new Date();
        return !t.usedAt && !isExpired;
      }),
    [sortedTokens]
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

      // Copiar automáticamente el nuevo token
      await navigator.clipboard.writeText(data.approvalUrl);
      setCopiedToken(data.token.token);
      setTimeout(() => setCopiedToken(null), 2000);

      // El enlace se genera aunque el correo falle, asi que hay que decir
      // cual de las dos cosas pasó. Antes siempre ponia "regenerado" y el
      // equipo daba por enviado un correo que nunca salió.
      setAvisoEnvio(
        data.email?.sent === false
          ? {
              ok: false,
              texto: `El enlace está listo y copiado, pero el correo a ${
                data.emailRecipient ?? "el cliente"
              } no salió (${data.email.error ?? data.email.reason}). Pégaselo tú.`,
            }
          : {
              ok: true,
              texto: `Enlace enviado a ${data.emailRecipient ?? "el cliente"} y copiado al portapapeles.`,
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

  if (tokens.length === 0 && !admiteEnlace) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Enlace de Aprobación
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

        {/* Botón para regenerar cuando no hay token activo */}
        {!activeToken && admiteEnlace && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
            <p className="text-sm text-yellow-800">
              {campaignStatus === "ACTIVE"
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
                  {campaignStatus === "ACTIVE"
                    ? "Reenviar para revisión"
                    : "Regenerar enlace de aprobación"}
                </>
              )}
            </Button>
          </div>
        )}

        {/* URL activa para copiar */}
        {activeToken && admiteEnlace && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              URL activa para el cliente
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
            {getDaysUntilExpiry(activeToken.expiresAt) > 0 && (
              <p className="text-xs text-muted-foreground">
                Expira en {getDaysUntilExpiry(activeToken.expiresAt)} día
                {getDaysUntilExpiry(activeToken.expiresAt) !== 1 ? "s" : ""}
              </p>
            )}
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
                    <TableHead>Expira</TableHead>
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
                        <TableCell className="text-sm">
                          {formatDate(token.expiresAt)}
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

import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface RevisionCliente {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  verifiedAt: Date | null;
  verifiedEmail: string | null;
  sentToEmail: string;
}

function fechaYHora(fecha: Date | string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
}

/**
 * Las revisiones de esta campana, desde el lado del cliente.
 *
 * Es el mismo historial que ve la agencia menos el token: ese es la
 * credencial que abre la aprobacion y el cliente no lo necesita, porque
 * para entrar tiene el boton —que resuelve el enlace contra su propia
 * sesion en vez de depender de uno que caduca—.
 *
 * Por eso tampoco hay "regenerar": generar un enlace y mandarlo por
 * correo es una accion de la agencia. Si queda algo pendiente, el boton
 * de aqui entra directamente.
 */
export function RevisionesCampanaCliente({
  campaignId,
  revisiones,
  pendientes,
}: {
  campaignId: string;
  revisiones: RevisionCliente[];
  /** Cuantos creadores esperan respuesta. Cero oculta el boton. */
  pendientes: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Revisiones
          </span>
          {/* En otra pestana, por el mismo motivo que en el listado de
              Revisiones: la revision acaba en su propia pantalla, fuera
              del portal, y desde ahi no hay vuelta atras. */}
          {pendientes > 0 && (
            <Button asChild size="sm">
              <a
                href={`/api/client-portal/revisar/${campaignId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Revisar {pendientes}{" "}
                {pendientes === 1 ? "creador" : "creadores"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {revisiones.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Todavía no se te ha pedido revisar esta campaña.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enviada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Respondida</TableHead>
                <TableHead>Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revisiones.map((r) => {
                const vencida = !r.usedAt && new Date(r.expiresAt) < new Date();

                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {fechaYHora(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      {r.usedAt ? (
                        <Badge className="bg-green-100 text-green-800">
                          Respondida
                        </Badge>
                      ) : vencida ? (
                        <Badge className="bg-gray-100 text-gray-700">
                          Vencida
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.usedAt ? fechaYHora(r.usedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.verifiedEmail ?? r.sentToEmail}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

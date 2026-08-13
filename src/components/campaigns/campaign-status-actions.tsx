"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Send,
  Play,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Link2,
  Trash2,
} from "lucide-react";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from "@/lib/campaign-utils";
import { updateCampaignStatus, deleteCampaign } from "@/services/campaign";
import type { CampaignStatus } from "@prisma/client";

interface CampaignStatusActionsProps {
  campaignId: string;
  currentStatus: CampaignStatus;
  profilesCount: number;
  approvedCount?: number;
  rejectedCount?: number;
  pendingCount?: number;
}

export function CampaignStatusActions({
  campaignId,
  currentStatus,
  profilesCount,
  approvedCount = 0,
  rejectedCount = 0,
  pendingCount = 0,
}: CampaignStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activationReason, setActivationReason] = useState("");
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showApprovalUrlDialog, setShowApprovalUrlDialog] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(approvalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const handleStatusChange = async (
    newStatus: CampaignStatus,
    reason?: string
  ) => {
    setLoading(newStatus);
    setError("");

    try {
      const data = await updateCampaignStatus(campaignId, newStatus, reason);

      // Limpiar estado y cerrar diálogo
      if (newStatus === "ACTIVE") {
        setActivationReason("");
        setShowActivateDialog(false);
      }

      // Si se envió a REVIEW, mostrar el diálogo con la URL de aprobación
      if (newStatus === "REVIEW" && data.approvalUrl) {
        setApprovalUrl(data.approvalUrl);
        setShowApprovalUrlDialog(true);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(null);
    }
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteCampaign(campaignId);
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setDeleting(false);
    }
  };

  const canSendToReview = currentStatus === "DRAFT" && profilesCount > 0;

  return (
    <div className="space-y-4">
      {/* Estado actual */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Estado:</span>
        <Badge className={CAMPAIGN_STATUS_COLORS[currentStatus]}>
          {CAMPAIGN_STATUS_LABELS[currentStatus]}
        </Badge>
      </div>

      {/* Info de perfiles en revisión */}
      {(currentStatus === "REVIEW" || currentStatus === "PENDING") && (
        <div className="text-sm space-y-1">
          <p className="text-gray-600">Estado de perfiles:</p>
          <div className="flex gap-4">
            {pendingCount > 0 && (
              <span className="text-yellow-600">{pendingCount} pendientes</span>
            )}
            {approvedCount > 0 && (
              <span className="text-green-600">{approvedCount} aprobados</span>
            )}
            {rejectedCount > 0 && (
              <span className="text-red-600">{rejectedCount} rechazados</span>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Acciones disponibles */}
      <div className="flex flex-wrap gap-2">
        {/* Enviar a revisión (desde DRAFT) */}
        {currentStatus === "DRAFT" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canSendToReview || loading !== null}>
                <Send className="h-4 w-4 mr-2" />
                Enviar a Revisión
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Enviar a Revisión</AlertDialogTitle>
                <AlertDialogDescription>
                  La campaña será enviada al cliente para su aprobación.
                  El cliente podrá aprobar o rechazar cada perfil individualmente.
                  <br /><br />
                  <strong>Perfiles incluidos:</strong> {profilesCount}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("REVIEW")}
                  disabled={loading !== null}
                >
                  {loading === "REVIEW" ? "Enviando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Activar directamente (desde DRAFT - para campañas ya negociadas) */}
        {currentStatus === "DRAFT" && profilesCount > 0 && (
          <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={loading !== null}>
                <Play className="h-4 w-4 mr-2" />
                Activar Directamente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Activar Campaña Directamente</AlertDialogTitle>
                <AlertDialogDescription>
                  La campaña será activada sin pasar por revisión del cliente.
                  Usa esta opción cuando la campaña ya fue negociada previamente.
                  <br /><br />
                  <strong>Perfiles incluidos:</strong> {profilesCount} (se marcarán como aprobados)
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="activation-reason-draft" className="text-sm font-medium">
                  Motivo de activación (opcional)
                </Label>
                <Textarea
                  id="activation-reason-draft"
                  placeholder="Ej: Campaña negociada por teléfono, cliente confirmó por WhatsApp..."
                  value={activationReason}
                  onChange={(e) => setActivationReason(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setActivationReason("")}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("ACTIVE", activationReason || undefined)}
                  disabled={loading !== null}
                >
                  {loading === "ACTIVE" ? "Activando..." : "Activar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Reenviar a revisión (desde PENDING) */}
        {currentStatus === "PENDING" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={loading !== null}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reenviar a Revisión
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reenviar a Revisión</AlertDialogTitle>
                <AlertDialogDescription>
                  La campaña será reenviada al cliente para revisión.
                  Todos los perfiles volverán a estado pendiente.
                  <br /><br />
                  Asegúrate de haber realizado los ajustes necesarios antes de reenviar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("REVIEW")}
                  disabled={loading !== null}
                >
                  {loading === "REVIEW" ? "Enviando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Volver a borrador (desde REVIEW) */}
        {currentStatus === "REVIEW" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={loading !== null}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Borrador
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Volver a Borrador</AlertDialogTitle>
                <AlertDialogDescription>
                  La campaña volverá a estado borrador y podrás editarla nuevamente.
                  Se perderá cualquier revisión pendiente del cliente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("DRAFT")}
                  disabled={loading !== null}
                >
                  {loading === "DRAFT" ? "Procesando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Activar campaña (desde REVIEW cuando todos los perfiles están aprobados) */}
        {currentStatus === "REVIEW" && approvedCount === profilesCount && profilesCount > 0 && (
          <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
            <AlertDialogTrigger asChild>
              <Button disabled={loading !== null}>
                <Play className="h-4 w-4 mr-2" />
                Activar Campaña
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Activar Campaña</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos los perfiles han sido aprobados. La campaña pasará a estado activo
                  y comenzará su ejecución.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="activation-reason" className="text-sm font-medium">
                  Motivo de activación (opcional)
                </Label>
                <Textarea
                  id="activation-reason"
                  placeholder="Ej: Cliente confirmó inicio de campaña por email..."
                  value={activationReason}
                  onChange={(e) => setActivationReason(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setActivationReason("")}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("ACTIVE", activationReason || undefined)}
                  disabled={loading !== null}
                >
                  {loading === "ACTIVE" ? "Activando..." : "Activar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Marcar completada (desde ACTIVE) */}
        {currentStatus === "ACTIVE" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={loading !== null}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar Completada
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como Completada</AlertDialogTitle>
                <AlertDialogDescription>
                  La campaña será marcada como completada.
                  Esto indica que todas las entregas han sido realizadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("COMPLETED")}
                  disabled={loading !== null}
                >
                  {loading === "COMPLETED" ? "Procesando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Cancelar (desde DRAFT, PENDING o ACTIVE) */}
        {(currentStatus === "DRAFT" ||
          currentStatus === "PENDING" ||
          currentStatus === "ACTIVE") && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading !== null}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Campaña
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar Campaña</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de que deseas cancelar esta campaña?
                  <br /><br />
                  <strong className="text-red-600">
                    Esta acción no se puede deshacer.
                  </strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, volver</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange("CANCELLED")}
                  disabled={loading !== null}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading === "CANCELLED" ? "Cancelando..." : "Sí, cancelar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Eliminar (solo desde DRAFT) */}
        {currentStatus === "DRAFT" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" disabled={loading !== null || deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar Campaña</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de que deseas eliminar esta campaña permanentemente?
                  Se eliminarán todos los perfiles y servicios asociados.
                  <br /><br />
                  <strong className="text-red-600">
                    Esta acción no se puede deshacer.
                  </strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, volver</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Mensaje cuando no hay acciones */}
      {currentStatus === "COMPLETED" && (
        <p className="text-sm text-gray-500">
          Esta campaña está completada. No hay acciones disponibles.
        </p>
      )}

      {currentStatus === "CANCELLED" && (
        <p className="text-sm text-gray-500">
          Esta campaña está cancelada. No hay acciones disponibles.
        </p>
      )}

      {currentStatus === "DRAFT" && profilesCount === 0 && (
        <p className="text-sm text-yellow-600">
          Agrega al menos un perfil para poder enviar la campaña a revisión.
        </p>
      )}

      {/* Diálogo con URL de aprobación */}
      <Dialog open={showApprovalUrlDialog} onOpenChange={setShowApprovalUrlDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Campaña Enviada a Revisión
            </DialogTitle>
            <DialogDescription>
              La campaña ha sido enviada al cliente para su aprobación.
              Comparte el siguiente enlace con el cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Enlace de aprobación
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={approvalUrl}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Este enlace expira en 7 días.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={copyToClipboard} variant="outline">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar enlace
                </>
              )}
            </Button>
            <Button onClick={() => setShowApprovalUrlDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

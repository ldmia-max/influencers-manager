"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Key, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCreateClientAccess, useRevokeClientAccess } from "@/hooks/mutations/use-client-mutations";

interface ManageAccessDialogProps {
  clientId: string;
  clientName: string;
  currentAccess?: {
    email: string;
    isActive: boolean;
  } | null;
}

export function ManageAccessDialog({
  clientId,
  clientName,
  currentAccess,
}: ManageAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    email: currentAccess?.email || "",
    password: "",
    confirmPassword: "",
    isActive: currentAccess?.isActive ?? true,
  });

  const createAccess = useCreateClientAccess();
  const revokeAccess = useRevokeClientAccess();

  const error = createAccess.error?.message || revokeAccess.error?.message || "";
  const loading = createAccess.isPending || revokeAccess.isPending;

  const [validationError, setValidationError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setValidationError("Las contraseñas no coinciden");
      return;
    }

    if (!currentAccess && formData.password.length < 6) {
      setValidationError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    createAccess.mutate(
      {
        clientId,
        payload: {
          password: formData.password,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setFormData({ ...formData, password: "", confirmPassword: "" });
        },
      },
    );
  };

  const handleDelete = () => {
    revokeAccess.mutate(clientId, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        setOpen(false);
      },
    });
  };

  const displayError = validationError || error;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Key className="h-4 w-4 mr-2" />
            {currentAccess ? "Gestionar Acceso" : "Crear Acceso"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAccess ? "Gestionar Acceso" : "Crear Acceso"}
            </DialogTitle>
            <DialogDescription>
              Configura las credenciales de acceso para {clientName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={loading}
                placeholder="cliente@empresa.com"
              />
              <p className="text-xs text-gray-500">
                Este email se usará para iniciar sesión en el portal de clientes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {currentAccess ? "Nueva Contraseña" : "Contraseña"}{" "}
                {!currentAccess && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required={!currentAccess}
                disabled={loading}
                placeholder={currentAccess ? "Dejar vacío para no cambiar" : ""}
              />
              {!currentAccess && (
                <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar Contraseña{" "}
                {!currentAccess && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                required={!currentAccess}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="isActive">Acceso Activo</Label>
                <p className="text-xs text-gray-500">
                  El cliente puede iniciar sesión
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
                disabled={loading}
              />
            </div>

            {displayError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{displayError}</p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              {currentAccess && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Acceso
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Guardando..."
                    : currentAccess
                    ? "Actualizar"
                    : "Crear Acceso"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar acceso?</AlertDialogTitle>
            <AlertDialogDescription>
              El cliente <strong>{clientName}</strong> ya no podrá iniciar sesión en
              el portal. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeAccess.error && <p className="text-sm text-red-600">{revokeAccess.error.message}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokeAccess.isPending ? "Eliminando..." : "Eliminar Acceso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

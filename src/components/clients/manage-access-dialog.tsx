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
import { Key, Trash2, Mail } from "lucide-react";
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
import {
  useCreateClientAccess,
  useRevokeClientAccess,
  useEnviarEnlaceDeAcceso,
} from "@/hooks/mutations/use-client-mutations";

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

  // `currentAccess` lo pinta la pagina de clientes, que es un componente
  // de servidor: mientras este dialogo sigue abierto vale `null` aunque
  // el acceso acabe de crearse. Sin esta marca, el boton de enviar el
  // enlace no aparecia nunca justo cuando mas falta hace —recien creado
  // el acceso, que es su unico momento util— y el aviso verde pedia
  // pulsar algo que no estaba en pantalla.
  const [creado, setCreado] = useState(false);
  const hayAcceso = Boolean(currentAccess) || creado;

  const [formData, setFormData] = useState({
    email: currentAccess?.email || "",
    password: "",
    confirmPassword: "",
    isActive: currentAccess?.isActive ?? true,
  });

  const createAccess = useCreateClientAccess();
  const revokeAccess = useRevokeClientAccess();
  const enlace = useEnviarEnlaceDeAcceso();

  const error =
    createAccess.error?.message ||
    revokeAccess.error?.message ||
    enlace.error?.message ||
    "";
  const loading =
    createAccess.isPending || revokeAccess.isPending || enlace.isPending;

  const [validationError, setValidationError] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(
    null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (formData.password !== formData.confirmPassword) {
      setValidationError("Las contraseñas no coinciden");
      return;
    }

    // La contrasena es opcional: dejandola vacia, el acceso se crea y la
    // elige el cliente con el enlace que se le manda por correo. Solo se
    // valida el minimo cuando se ha escrito algo.
    if (formData.password && formData.password.length < 6) {
      setValidationError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    createAccess.mutate(
      {
        clientId,
        payload: {
          // El correo FALTABA. Sin el, la ruta recibia una cadena vacia
          // y la capa de datos cortaba con "El email es requerido", de
          // modo que crear un acceso desde aqui no funcionaba nunca.
          email: formData.email.trim(),
          password: formData.password || undefined,
          isActive: formData.isActive,
        },
      },
      {
        onSuccess: () => {
          const conContrasena = Boolean(formData.password);
          setFormData({ ...formData, password: "", confirmPassword: "" });

          if (currentAccess) {
            setOpen(false);
            return;
          }

          setCreado(true);

          if (conContrasena) {
            setAviso({
              ok: true,
              texto:
                "Acceso creado. Ya puede entrar con la contraseña que indicaste.",
            });
            return;
          }

          // Creado sin contrasena: la cuenta existe y nadie puede entrar
          // en ella hasta que llegue el enlace, asi que mandarlo no es un
          // segundo paso opcional sino la otra mitad del alta. Pedir un
          // clic mas solo servia para dejar accesos muertos a medio crear.
          mandarEnlace();
        },
      },
    );
  };

  const mandarEnlace = () => {
    setValidationError("");
    setAviso(null);
    enlace.mutate(clientId, {
      onSuccess: (r) => {
        setAviso(
          r.email.sent
            ? {
                ok: true,
                texto: `Enlace enviado a ${r.destino}. Caduca en 24 horas.`,
              }
            : {
                ok: false,
                // Se muestra `error`, no `reason`: el motivo es un
                // codigo para el programa ("sin_remitente") y la frase
                // dice que variable mirar.
                texto: `El enlace se generó, pero el correo no salió: ${r.email.error ?? r.email.reason ?? "error desconocido"}`,
              }
        );
      },
    });
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
                <span className="font-normal text-gray-500">(opcional)</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                disabled={loading}
                placeholder={
                  currentAccess
                    ? "Dejar vacío para no cambiar"
                    : "Dejar vacío y enviar el enlace"
                }
              />
              <p className="text-xs text-gray-500">
                {currentAccess
                  ? "Mínimo 6 caracteres. Vacío la deja como está."
                  : "Déjala vacía y envíale el enlace: así la elige el cliente y no la conoce nadie más."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
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

            {aviso && (
              <div
                className={`rounded-lg border p-3 ${
                  aviso.ok
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    aviso.ok ? "text-green-800" : "text-amber-800"
                  }`}
                >
                  {aviso.texto}
                </p>
              </div>
            )}

            {displayError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{displayError}</p>
              </div>
            )}

            {/* Solo con el acceso ya creado: el enlace va al correo
                guardado, así que antes de guardarlo no hay destino. */}
            {hayAcceso && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={mandarEnlace}
                disabled={loading}
              >
                <Mail className="mr-2 h-4 w-4" />
                {enlace.isPending
                  ? "Enviando…"
                  : "Enviar enlace para elegir contraseña"}
              </Button>
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
                    : hayAcceso
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

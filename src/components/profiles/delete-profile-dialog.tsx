"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import { useDeleteProfile } from "@/hooks/mutations/use-profile-mutations";

interface DeleteProfileDialogProps {
  profileId: string;
  profileName: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  redirectTo?: string;
  /**
   * true cuando vive dentro de un menu de acciones.
   *
   * Cambia el disparador por un DropdownMenuItem y, sobre todo, deja el
   * dialogo como HERMANO del menu. Colgandolo dentro, al pulsar se
   * cerraba el menu, se desmontaba su subarbol y el modal aparecia y
   * desaparecia sin dar tiempo a confirmar.
   */
  asMenuItem?: boolean;
}

export function DeleteProfileDialog({
  profileId,
  profileName,
  variant = "destructive",
  size = "default",
  redirectTo = "/profiles",
  asMenuItem = false,
}: DeleteProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteProfile();

  const handleDelete = () => {
    deleteMutation.mutate(profileId, {
      onSuccess: () => router.push(redirectTo),
    });
  };

  return (
    <>
      {asMenuItem ? (
        <DropdownMenuItem
          onSelect={(e) => {
            // Sin esto Radix cierra el menu y devuelve el foco justo
            // cuando el dialogo se abre, y el modal se cierra solo.
            e.preventDefault();
            setOpen(true);
          }}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      ) : (
        <Button
          variant={variant}
          size={size}
          disabled={deleteMutation.isPending}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente el
            perfil <strong>{profileName}</strong> y todos sus datos asociados
            (redes sociales, formatos y métricas).
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
            {deleteMutation.error.message}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar perfil"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

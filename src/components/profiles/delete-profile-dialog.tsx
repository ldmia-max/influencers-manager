"use client";

import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useDeleteProfile } from "@/hooks/mutations/use-profile-mutations";

interface DeleteProfileDialogProps {
  profileId: string;
  profileName: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  redirectTo?: string;
}

export function DeleteProfileDialog({
  profileId,
  profileName,
  variant = "destructive",
  size = "default",
  redirectTo = "/profiles",
}: DeleteProfileDialogProps) {
  const router = useRouter();
  const deleteMutation = useDeleteProfile();

  const handleDelete = () => {
    deleteMutation.mutate(profileId, {
      onSuccess: () => router.push(redirectTo),
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={deleteMutation.isPending}>
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </Button>
      </AlertDialogTrigger>
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
  );
}

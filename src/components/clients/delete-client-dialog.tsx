"use client";

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useDeleteClient } from "@/hooks/mutations/use-client-mutations";

interface DeleteClientDialogProps {
  clientId: string;
  clientName: string;
}

export function DeleteClientDialog({
  clientId,
  clientName,
}: DeleteClientDialogProps) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteClient();

  const handleDelete = () => {
    deleteMutation.mutate(clientId, {
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button className="flex items-center gap-2 text-red-600 w-full text-left text-sm">
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de eliminar el cliente <strong>{clientName}</strong>.
            Esta acción también eliminará todos los contactos asociados y su acceso
            al sistema. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.error && <p className="text-sm text-red-600">{deleteMutation.error.message}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

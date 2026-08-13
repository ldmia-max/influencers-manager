"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDeleteUser } from "@/hooks/mutations/use-admin-mutations";

interface DeleteUserButtonProps {
  id: string;
  hasProfiles: boolean;
}

export function DeleteUserButton({ id, hasProfiles }: DeleteUserButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteUser();

  if (hasProfiles) {
    return (
      <Button variant="outline" size="sm" disabled title="Usuario tiene perfiles">
        Eliminar
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea eliminar este usuario? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {deleteMutation.error && (
          <p className="text-sm text-red-600">{deleteMutation.error.message}</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate(id, { onSuccess: () => setOpen(false) })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

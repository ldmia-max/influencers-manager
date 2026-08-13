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
import { useDeleteServiceType } from "@/hooks/mutations/use-admin-mutations";

interface DeleteServiceTypeButtonProps {
  id: string;
  hasServices: boolean;
}

export function DeleteServiceTypeButton({ id, hasServices }: DeleteServiceTypeButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteServiceType();

  if (hasServices) {
    return (
      <Button variant="outline" size="sm" disabled title="Formato en uso">
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
            ¿Está seguro que desea eliminar este formato? Esta acción no se puede deshacer.
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

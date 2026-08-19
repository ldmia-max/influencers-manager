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
} from "@/components/ui/alert-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import { useDeleteClient } from "@/hooks/mutations/use-client-mutations";

interface DeleteClientDialogProps {
  clientId: string;
  clientName: string;
}

/**
 * Borrado de cliente desde el menu de acciones.
 *
 * El componente incluye SU PROPIO DropdownMenuItem y deja el dialogo
 * como HERMANO, nunca dentro del menu. Antes el dialogo colgaba de un
 * DropdownMenuItem y el modal aparecia y se cerraba solo: al pulsar, el
 * menu se cerraba y desmontaba todo su subarbol, dialogo incluido, sin
 * dar tiempo a confirmar.
 *
 * El preventDefault del onSelect es la otra mitad del arreglo: evita
 * que Radix cierre el menu y devuelva el foco justo cuando el dialogo
 * se esta abriendo. Es el mismo patron que ya usaba
 * delete-campaign-dialog, que nunca tuvo este problema.
 */
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
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-red-600 focus:text-red-600"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar
      </DropdownMenuItem>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el cliente <strong>{clientName}</strong>.
              Esta acción también eliminará todos los contactos asociados y su
              acceso al sistema. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error && (
            <p className="text-sm text-red-600">{deleteMutation.error.message}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
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
    </>
  );
}

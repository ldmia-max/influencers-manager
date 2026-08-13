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
import { useDeleteCampaign } from "@/hooks/mutations/use-campaign-mutations";

interface DeleteCampaignMenuItemProps {
  campaignId: string;
  campaignName: string;
}

export function DeleteCampaignMenuItem({
  campaignId,
  campaignName,
}: DeleteCampaignMenuItemProps) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteCampaign();

  const handleDelete = () => {
    deleteMutation.mutate(campaignId, {
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
        <Trash2 className="h-4 w-4 mr-2" />
        Eliminar
      </DropdownMenuItem>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Campaña</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar permanentemente la campaña{" "}
              <strong>{campaignName}</strong>? Se eliminarán todos los perfiles
              y servicios asociados.
              <br /><br />
              <strong className="text-red-600">
                Esta acción no se puede deshacer.
              </strong>
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
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

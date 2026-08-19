"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiPatch } from "@/services/api";
import { deleteCampaign } from "@/services/campaign";

interface Props {
  campaignId: string;
  campaignName: string;
  /** Si ya esta archivada, la accion que se ofrece es restaurarla. */
  archivada?: boolean;
}

/**
 * Las dos formas de quitar una campana de en medio, solo para ADMIN.
 *
 * Archivar la retira de los listados conservandolo todo: perfiles,
 * servicios, precios, margen congelado y la traza de quien aprobo.
 * Eliminar borra la fila y arrastra en cascada tokens de aprobacion,
 * perfiles de campana, plataformas y servicios.
 *
 * Se ofrecen juntas y en ese orden a proposito: para una campana
 * terminada casi siempre se quiere lo primero, y quien busca "eliminar"
 * ve ahi mismo que existe una alternativa reversible.
 *
 * Los dialogos van como HERMANOS del menu, no dentro: colgandolos de un
 * DropdownMenuItem, al cerrarse el menu se desmontaba su subarbol y el
 * modal desaparecia sin dar tiempo a confirmar.
 */
export function AccionesEliminarCampana({
  campaignId,
  campaignName,
  archivada = false,
}: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<"archivar" | "eliminar" | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarArchivado = async (valor: boolean) => {
    setTrabajando(true);
    setError(null);
    try {
      await apiPatch(`/api/campaigns/${campaignId}/archivar`, { archivada: valor });
      setAbierto(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setTrabajando(false);
    }
  };

  const eliminar = async () => {
    setTrabajando(true);
    setError(null);
    try {
      await deleteCampaign(campaignId);
      setAbierto(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setTrabajando(false);
    }
  };

  // Una campana ya archivada solo ofrece volver a los listados.
  if (archivada) {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            cambiarArchivado(false);
          }}
        >
          <ArchiveRestore className="mr-2 h-4 w-4" />
          Restaurar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setAbierto("eliminar");
          }}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar definitivamente
        </DropdownMenuItem>
        <DialogoEliminar />
      </>
    );
  }

  function DialogoEliminar() {
    return (
      <AlertDialog
        open={abierto === "eliminar"}
        onOpenChange={(v) => !v && setAbierto(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar definitivamente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Se borrará <strong>{campaignName}</strong> de la base de datos.
                  Con ella desaparecen los creadores de la campaña, sus formatos
                  y precios, el margen aplicado y la constancia de qué aprobó el
                  cliente y cuándo.
                </p>
                <p className="font-medium text-red-700">
                  No se puede deshacer. Si solo quieres que deje de aparecer en
                  el listado, usa «Archivar».
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabajando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                eliminar();
              }}
              disabled={trabajando}
              className="bg-red-600 hover:bg-red-700"
            >
              {trabajando ? "Eliminando…" : "Eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <>
      <DropdownMenuSeparator />

      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setAbierto("archivar");
        }}
      >
        <Archive className="mr-2 h-4 w-4" />
        Archivar
      </DropdownMenuItem>

      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setAbierto("eliminar");
        }}
        className="text-red-600 focus:text-red-600"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar definitivamente
      </DropdownMenuItem>

      <AlertDialog
        open={abierto === "archivar"}
        onOpenChange={(v) => !v && setAbierto(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar campaña</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{campaignName}</strong> dejará de aparecer en el listado y
              en el portal del cliente, pero se conserva entera en la base de
              datos. Puedes recuperarla cuando quieras desde «Ver archivadas».
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabajando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cambiarArchivado(true);
              }}
              disabled={trabajando}
            >
              {trabajando ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogoEliminar />
    </>
  );
}

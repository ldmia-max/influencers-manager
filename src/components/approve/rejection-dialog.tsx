"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: "profile" | "platform" | "service" | "all";
  itemName?: string;
  onConfirm: (reason: string) => void;
}

const itemTypeLabels: Record<string, string> = {
  profile: "perfil",
  platform: "plataforma",
  service: "formato",
  all: "toda la campaña",
};

export function RejectionDialog({
  open,
  onOpenChange,
  itemType,
  itemName,
  onConfirm,
}: RejectionDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar {itemTypeLabels[itemType]}</DialogTitle>
          <DialogDescription>
            {itemName
              ? `¿Estás seguro que deseas rechazar "${itemName}"?`
              : `¿Estás seguro que deseas rechazar ${itemTypeLabels[itemType]}?`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">
              Motivo del rechazo (opcional)
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Escribe el motivo por el cual rechazas este elemento..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirmar rechazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

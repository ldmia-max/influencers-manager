"use client";

import { useSyncProfile } from "@/hooks/mutations/use-profile-mutations";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface SyncProfileButtonProps {
  profileId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function SyncProfileButton({
  profileId,
  variant = "outline",
  size = "default",
  showLabel = true,
}: SyncProfileButtonProps) {
  const syncMutation = useSyncProfile();
  const loading = syncMutation.isPending;

  const handleSync = () => {
    syncMutation.mutate(profileId, {
      onSuccess: (data) => {
        alert(data.message || "Datos actualizados desde Apify");
      },
      onError: (error) => {
        alert(error.message || "Error al sincronizar perfil");
      },
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={loading}
      type="button"
      aria-busy={loading}
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""} ${showLabel ? "mr-2" : ""}`} />
      {showLabel && (loading ? "Sincronizando..." : "Sincronizar Datos")}
    </Button>
  );
}

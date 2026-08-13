"use client";

import { useToggleServiceType } from "@/hooks/mutations/use-admin-mutations";
import { Button } from "@/components/ui/button";

interface ToggleServiceTypeButtonProps {
  id: string;
  isActive: boolean;
}

export function ToggleServiceTypeButton({
  id,
  isActive,
}: ToggleServiceTypeButtonProps) {
  const toggleMutation = useToggleServiceType();

  return (
    <Button
      variant={isActive ? "outline" : "default"}
      size="sm"
      onClick={() => toggleMutation.mutate({ id, isActive: !isActive })}
      disabled={toggleMutation.isPending}
    >
      {toggleMutation.isPending ? "..." : isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}

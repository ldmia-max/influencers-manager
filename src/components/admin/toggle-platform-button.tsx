"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { togglePlatform } from "@/services/admin";

interface TogglePlatformButtonProps {
  id: string;
  isActive: boolean;
}

export function TogglePlatformButton({ id, isActive }: TogglePlatformButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await togglePlatform(id, !isActive);
      router.refresh();
    } catch (error) {
      console.error("Error toggling platform:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={isActive ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? "..." : isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleCity } from "@/services/admin";

interface ToggleCityButtonProps {
  id: string;
  isActive: boolean;
}

export function ToggleCityButton({ id, isActive }: ToggleCityButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleCity(id, !isActive);
      router.refresh();
    } catch (error) {
      console.error("Error toggling city:", error);
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

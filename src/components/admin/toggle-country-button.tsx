"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleCountry } from "@/services/admin";

interface ToggleCountryButtonProps {
  id: string;
  isActive: boolean;
}

export function ToggleCountryButton({ id, isActive }: ToggleCountryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleCountry(id, !isActive);
      router.refresh();
    } catch (error) {
      console.error("Error toggling country:", error);
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

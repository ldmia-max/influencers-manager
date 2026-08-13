"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleReachRange } from "@/services/admin";

interface ToggleReachRangeButtonProps {
  id: string;
  isActive: boolean;
}

export function ToggleReachRangeButton({ id, isActive }: ToggleReachRangeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleReachRange(id, !isActive);
      router.refresh();
    } catch (error) {
      console.error("Error toggling reach range:", error);
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleDepartment } from "@/services/admin";

interface ToggleDepartmentButtonProps {
  id: string;
  isActive: boolean;
}

export function ToggleDepartmentButton({ id, isActive }: ToggleDepartmentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await toggleDepartment(id, !isActive);
      router.refresh();
    } catch (error) {
      console.error("Error toggling department:", error);
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

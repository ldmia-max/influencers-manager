"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Eye } from "lucide-react";

interface ViewProfileButtonProps {
  profileId: string;
}

export function ViewProfileButton({ profileId }: ViewProfileButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleView = () => {
    const params = new URLSearchParams(searchParams);
    params.set("view", profileId);
    router.push(`?${params.toString()}`);
  };

  return (
    <DropdownMenuItem onClick={handleView} className="flex items-center gap-2">
      <Eye className="h-4 w-4" />
      Ver
    </DropdownMenuItem>
  );
}

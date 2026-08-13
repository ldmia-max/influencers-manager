"use client";

import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import type { ProfileWithServices } from "@/models/campaign";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  profile: ProfileWithServices;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddToCartButton({
  profile,
  variant = "outline",
  size = "sm",
  className,
}: AddToCartButtonProps) {
  const isInCart = useCartStore((s) => s.isInCart);
  const openServiceModal = useCartStore((s) => s.openServiceModal);

  const inCart = isInCart(profile.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openServiceModal(profile);
  };

  return (
    <Button
      variant={inCart ? "default" : variant}
      size={size}
      onClick={handleClick}
      className={cn(
        "transition-all",
        inCart && "bg-green-600 hover:bg-green-700",
        className
      )}
    >
      {inCart ? (
        <>
          <Check className="h-4 w-4 mr-1" />
          En carrito
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 mr-1" />
          Agregar
        </>
      )}
    </Button>
  );
}

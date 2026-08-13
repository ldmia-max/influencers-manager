"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

export function CartButton() {
  const totalItems = useCartStore((s) => s.getTotalItems());
  const setCartOpen = useCartStore((s) => s.setCartOpen);

  if (totalItems === 0) return null;

  return (
    <Button
      onClick={() => setCartOpen(true)}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "bg-primary hover:bg-primary/90",
        "transition-all duration-200 hover:scale-105"
      )}
    >
      <ShoppingCart className="h-6 w-6" />
      <Badge
        variant="destructive"
        className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold"
      >
        {totalItems > 9 ? "9+" : totalItems}
      </Badge>
    </Button>
  );
}

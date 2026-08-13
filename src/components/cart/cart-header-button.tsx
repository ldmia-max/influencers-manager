"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";

export function CartHeaderButton() {
  const totalItems = useCartStore((s) => s.getTotalItems());
  const setCartOpen = useCartStore((s) => s.setCartOpen);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setCartOpen(true)}
      className="relative h-10 w-10"
    >
      <ShoppingCart className="h-5 w-5" />
      {totalItems > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold"
        >
          {totalItems > 9 ? "9+" : totalItems}
        </Badge>
      )}
    </Button>
  );
}

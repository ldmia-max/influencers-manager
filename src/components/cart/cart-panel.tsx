"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ShoppingCart, Trash2, Rocket, Instagram, X } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { formatNumber, formatCompactNumber } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import type { CartItem } from "@/models/cart";

function getPlatformIcon(platformName: string) {
  switch (platformName.toLowerCase()) {
    case "instagram":
      return <Instagram className="h-4 w-4" />;
    case "tiktok":
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
        </svg>
      );
    default:
      return null;
  }
}

function CartItemCard({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const firstAccount = item.profile.socialAccounts[0];
  const avatarUrl = firstAccount?.profilePicUrl || null;

  // Calcular subtotal del item con markup
  const itemSubtotal = item.platforms.reduce((total, platform) => {
    return (
      total +
      platform.services.reduce((serviceTotal, service) => {
        const priceWithMarkup = calculateMarkupPrice(service.basePrice);
        return serviceTotal + priceWithMarkup * service.quantity;
      }, 0)
    );
  }, 0);

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
      {/* Header del perfil */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl || ""} alt={item.profile.name} />
            <AvatarFallback className="text-xs">
              {item.profile.name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm">{item.profile.name}</div>
            <div className="text-xs text-muted-foreground">
              {item.profile.type === "INFLUENCER"
                ? "Influencer"
                : item.profile.type === "UGC"
                ? "UGC"
                : "Ambos"}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Plataformas y servicios */}
      <div className="space-y-2 pl-2">
        {item.platforms.map((platform) => {
          const servicesWithQuantity = platform.services.filter((s) => s.quantity > 0);
          if (servicesWithQuantity.length === 0) return null;

          return (
            <div key={platform.socialAccountId} className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getPlatformIcon(platform.platformName)}
                <span>@{platform.username}</span>
                <span className="text-muted-foreground/60">
                  ({formatCompactNumber(platform.followers)})
                </span>
              </div>
              <div className="pl-5 space-y-0.5">
                {servicesWithQuantity.map((service) => {
                  const priceWithMarkup = calculateMarkupPrice(service.basePrice);
                  const total = priceWithMarkup * service.quantity;
                  return (
                    <div
                      key={service.profileServiceId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span>
                        {service.serviceName} x{service.quantity}
                      </span>
                      <span className="text-muted-foreground">
                        ${formatNumber(total.toFixed(0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtotal */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-xs text-muted-foreground">Subtotal:</span>
        <span className="text-sm font-medium">${formatNumber(itemSubtotal.toFixed(0))}</span>
      </div>
    </div>
  );
}

export function CartPanel() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.getTotalItems());
  const totalPriceWithMarkup = useCartStore((s) => s.getTotalPriceWithMarkup());
  const isCartOpen = useCartStore((s) => s.isCartOpen);
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const clearCart = useCartStore((s) => s.clearCart);

  const handleCreateCampaign = () => {
    setCartOpen(false);
    router.push("/campaigns/new/from-cart");
  };

  const handleClearCart = () => {
    if (confirm("¿Estás seguro de vaciar el carrito?")) {
      clearCart();
    }
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-6">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito
            <Badge variant="secondary">{totalItems} influencers</Badge>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">El carrito está vacio</p>
            <p className="text-xs mt-1">Agrega influencers desde la lista de perfiles</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {items.map((item) => (
                  <CartItemCard
                    key={item.profile.id}
                    item={item}
                    onRemove={() => removeFromCart(item.profile.id)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-3 pt-6 mt-4 border-t">
              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="text-xl font-bold">
                  ${formatNumber(totalPriceWithMarkup.toFixed(0))}
                </span>
              </div>

              {/* Botones */}
              <Button onClick={handleCreateCampaign} className="w-full" size="lg">
                <Rocket className="h-4 w-4 mr-2" />
                Crear Campana
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCart}
                className="w-full text-muted-foreground hover:text-destructive mb-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Vaciar carrito
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

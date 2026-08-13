"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Instagram, Plus, Minus, ShoppingCart } from "lucide-react";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import { useCartStore } from "@/stores/cart-store";
import { formatNumber, formatCompactNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import { MAX_SERVICE_QUANTITY } from "@/models/cart";
import type { CartPlatformConfig } from "@/models/cart";

function getPlatformIcon(platformName: string) {
  switch (platformName.toLowerCase()) {
    case "instagram":
      return <Instagram className="h-5 w-5" />;
    case "tiktok":
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
        </svg>
      );
    default:
      return null;
  }
}

interface QuantityControlProps {
  quantity: number;
  onChange: (quantity: number) => void;
  max?: number;
}

function QuantityControl({ quantity, onChange, max = MAX_SERVICE_QUANTITY }: QuantityControlProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(Math.max(0, quantity - 1))}
        disabled={quantity === 0}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-8 text-center text-sm font-medium">{quantity}</span>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function ServiceSelectionModal() {
  const isServiceModalOpen = useCartStore((s) => s.isServiceModalOpen);
  const selectedProfile = useCartStore((s) => s.selectedProfile);
  const closeServiceModal = useCartStore((s) => s.closeServiceModal);
  const addToCart = useCartStore((s) => s.addToCart);
  const getCartItem = useCartStore((s) => s.getCartItem);
  const isInCart = useCartStore((s) => s.isInCart);
  const { data: reachRanges = [] } = useReachRanges();

  // Estado local para la configuración de servicios
  const [platforms, setPlatforms] = useState<CartPlatformConfig[]>([]);

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (selectedProfile && isServiceModalOpen) {
      const existingItem = getCartItem(selectedProfile.id);

      if (existingItem) {
        // Si ya está en el carrito, cargar la configuración existente
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional initialization on modal open
        setPlatforms(existingItem.platforms);
      } else {
        // Si no está, crear configuración inicial con cantidad 0
        const initialPlatforms: CartPlatformConfig[] = selectedProfile.socialAccounts.map((sa) => ({
          socialAccountId: sa.id,
          platformId: sa.platform.id,
          platformName: sa.platform.displayName,
          username: sa.username,
          followers: sa.followers || 0,
          services: sa.services.map((service) => ({
            profileServiceId: service.id,
            serviceTypeId: service.serviceType.id,
            serviceName: service.serviceType.displayName,
            quantity: 0,
            basePrice: typeof service.price === "string" ? parseFloat(service.price) : service.price,
          })),
        }));
        setPlatforms(initialPlatforms);
      }
    }
  }, [selectedProfile, isServiceModalOpen, getCartItem]);

  // Actualizar cantidad de un servicio
  const updateServiceQuantity = (
    platformIndex: number,
    serviceIndex: number,
    quantity: number
  ) => {
    setPlatforms((prev) => {
      const updated = [...prev];
      updated[platformIndex] = {
        ...updated[platformIndex],
        services: updated[platformIndex].services.map((s, i) =>
          i === serviceIndex ? { ...s, quantity } : s
        ),
      };
      return updated;
    });
  };

  // Calcular subtotal con markup
  const subtotal = useMemo(() => {
    return platforms.reduce((total, platform) => {
      return (
        total +
        platform.services.reduce((serviceTotal, service) => {
          const priceWithMarkup = calculateMarkupPrice(service.basePrice);
          return serviceTotal + priceWithMarkup * service.quantity;
        }, 0)
      );
    }, 0);
  }, [platforms]);

  // Verificar si hay al menos un servicio seleccionado
  const hasServices = useMemo(() => {
    return platforms.some((p) => p.services.some((s) => s.quantity > 0));
  }, [platforms]);

  // Manejar agregar al carrito
  const handleAddToCart = () => {
    if (!selectedProfile || !hasServices) return;
    addToCart(selectedProfile, platforms);
    closeServiceModal();
  };

  if (!selectedProfile) return null;

  const firstAccount = selectedProfile.socialAccounts[0];
  const avatarUrl = firstAccount?.profilePicUrl || null;
  const inCart = isInCart(selectedProfile.id);

  return (
    <Dialog open={isServiceModalOpen} onOpenChange={(open) => !open && closeServiceModal()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleccionar Formatos</DialogTitle>
        </DialogHeader>

        {/* Información del perfil */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl || ""} alt={selectedProfile.name} />
            <AvatarFallback>{selectedProfile.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{selectedProfile.name}</div>
            <div className="text-sm text-muted-foreground">
              {selectedProfile.type === "INFLUENCER"
                ? "Influencer"
                : selectedProfile.type === "UGC"
                ? "UGC Creator"
                : "Ambos"}
              {selectedProfile.city && selectedProfile.country && (
                <span> · {selectedProfile.city.name}, {selectedProfile.country.name}</span>
              )}
            </div>
          </div>
          {inCart && (
            <Badge variant="secondary" className="ml-auto">
              En carrito
            </Badge>
          )}
        </div>

        {/* Lista de plataformas y servicios */}
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {platforms.map((platform, platformIndex) => {
            const reach = calculateReach(platform.followers, reachRanges);
            const reachPercent = getReachPercentage(platform.followers, reachRanges);

            return (
              <div key={platform.socialAccountId} className="space-y-2">
                {/* Header de plataforma */}
                <div className="flex items-center gap-2">
                  {getPlatformIcon(platform.platformName)}
                  <span className="font-medium">{platform.platformName}</span>
                  <span className="text-sm text-muted-foreground">@{platform.username}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-7">
                  {formatCompactNumber(platform.followers)} seguidores
                  {reach && (
                    <span className="text-green-600 ml-2">
                      · {formatCompactNumber(reach)} alcance ({reachPercent}%)
                    </span>
                  )}
                </div>

                {/* Lista de servicios */}
                <div className="ml-7 space-y-2">
                  {platform.services.map((service, serviceIndex) => {
                    const priceWithMarkup = calculateMarkupPrice(service.basePrice);
                    const serviceTotal = priceWithMarkup * service.quantity;

                    return (
                      <div
                        key={service.profileServiceId}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">{service.serviceName}</div>
                          <div className="text-xs text-muted-foreground">
                            ${formatNumber(priceWithMarkup.toFixed(0))} c/u
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {service.quantity > 0 && (
                            <span className="text-sm font-medium text-green-600">
                              ${formatNumber(serviceTotal.toFixed(0))}
                            </span>
                          )}
                          <QuantityControl
                            quantity={service.quantity}
                            onChange={(qty) => updateServiceQuantity(platformIndex, serviceIndex, qty)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {platformIndex < platforms.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}
        </div>

        {/* Footer con subtotal y botón */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="text-xl font-bold">${formatNumber(subtotal.toFixed(0))}</span>
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={!hasServices}
            className="w-full"
            size="lg"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {inCart ? "Actualizar carrito" : "Agregar al carrito"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

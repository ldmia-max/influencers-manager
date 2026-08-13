"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CampaignEditor } from "./campaign-editor";
import { useCartStore } from "@/stores/cart-store";
import type { Client, ProfileWithServices, ProfileConfig } from "@/models/campaign";
import type { CartItem } from "@/models/cart";

interface CampaignFromCartEditorProps {
  clients: Client[];
  profiles: ProfileWithServices[];
}

// Convierte un CartItem al formato ProfileConfig que espera CampaignEditor
function cartItemToProfileConfig(item: CartItem): ProfileConfig {
  return {
    profileId: item.profile.id,
    profileName: item.profile.name,
    platforms: item.platforms.map((platform) => ({
      socialAccountId: platform.socialAccountId,
      platformId: platform.platformId,
      platformName: platform.platformName,
      username: platform.username,
      // Si tiene servicios con cantidad > 0, la plataforma está seleccionada
      selected: platform.services.some((s) => s.quantity > 0),
      services: platform.services.map((service) => ({
        profileServiceId: service.profileServiceId,
        serviceTypeId: service.serviceTypeId,
        serviceName: service.serviceName,
        quantity: service.quantity,
        basePrice: service.basePrice,
      })),
    })),
  };
}

export function CampaignFromCartEditor({ clients, profiles }: CampaignFromCartEditorProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  // Redirigir si el carrito está vacío
  useEffect(() => {
    if (items.length === 0) {
      router.push("/profiles");
    }
  }, [items.length, router]);

  // Convertir items del carrito al formato esperado por CampaignEditor
  const existingProfileIds = useMemo(() => {
    return items.map((item) => item.profile.id);
  }, [items]);

  const existingConfig = useMemo(() => {
    return items.map(cartItemToProfileConfig);
  }, [items]);

  // Datos iniciales vacíos para el formulario
  const initialData = {
    name: "",
    description: "",
    clientId: "",
    clientContactId: "",
    budget: "",
    startDate: "",
    endDate: "",
  };

  // Si el carrito está vacío, mostrar loading mientras redirige
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Redirigiendo...</p>
      </div>
    );
  }

  return (
    <CampaignEditor
      initialData={initialData}
      clients={clients}
      profiles={profiles}
      existingProfileIds={existingProfileIds}
      existingConfig={existingConfig}
      onSaveSuccess={clearCart}
    />
  );
}

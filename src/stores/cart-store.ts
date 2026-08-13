import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProfileWithServices } from "@/models/campaign";
import type { CartItem, CartPlatformConfig } from "@/models/cart";
import { MAX_CART_ITEMS } from "@/models/cart";
import { calculateMarkupPrice } from "@/lib/campaign-utils";

// =============================================================================
// Helpers
// =============================================================================

function calculateItemTotal(item: CartItem): number {
  return item.platforms.reduce((platformTotal, platform) => {
    return (
      platformTotal +
      platform.services.reduce((serviceTotal, service) => {
        return serviceTotal + service.basePrice * service.quantity;
      }, 0)
    );
  }, 0);
}

function calculateItemTotalWithMarkup(item: CartItem): number {
  return item.platforms.reduce((platformTotal, platform) => {
    return (
      platformTotal +
      platform.services.reduce((serviceTotal, service) => {
        const priceWithMarkup = calculateMarkupPrice(service.basePrice);
        return serviceTotal + priceWithMarkup * service.quantity;
      }, 0)
    );
  }, 0);
}

// =============================================================================
// Store Types
// =============================================================================

interface CartStore {
  // Cart state
  items: CartItem[];

  // UI state (not persisted)
  isCartOpen: boolean;
  isServiceModalOpen: boolean;
  selectedProfile: ProfileWithServices | null;

  // Computed
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getTotalPriceWithMarkup: () => number;
  isInCart: (profileId: string) => boolean;
  getCartItem: (profileId: string) => CartItem | undefined;

  // Actions
  addToCart: (profile: ProfileWithServices, platforms: CartPlatformConfig[]) => void;
  updateCartItem: (profileId: string, platforms: CartPlatformConfig[]) => void;
  removeFromCart: (profileId: string) => void;
  clearCart: () => void;

  // UI actions
  setCartOpen: (open: boolean) => void;
  openServiceModal: (profile: ProfileWithServices) => void;
  closeServiceModal: () => void;
}

// =============================================================================
// Store
// =============================================================================

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isCartOpen: false,
      isServiceModalOpen: false,
      selectedProfile: null,

      // Computed
      getTotalItems: () => get().items.length,
      getTotalPrice: () =>
        get().items.reduce((total, item) => total + calculateItemTotal(item), 0),
      getTotalPriceWithMarkup: () =>
        get().items.reduce((total, item) => total + calculateItemTotalWithMarkup(item), 0),
      isInCart: (profileId) => get().items.some((item) => item.profile.id === profileId),
      getCartItem: (profileId) => get().items.find((item) => item.profile.id === profileId),

      // Cart actions
      addToCart: (profile, platforms) => {
        const { items } = get();

        if (items.length >= MAX_CART_ITEMS) {
          console.warn(`Máximo ${MAX_CART_ITEMS} items en el carrito`);
          return;
        }

        const hasServices = platforms.some((p) => p.services.some((s) => s.quantity > 0));
        if (!hasServices) {
          console.warn("Debes seleccionar al menos un formato");
          return;
        }

        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.profile.id === profile.id);

          if (existingIndex >= 0) {
            const updated = [...state.items];
            updated[existingIndex] = { profile, platforms, addedAt: Date.now() };
            return { items: updated };
          }

          return { items: [...state.items, { profile, platforms, addedAt: Date.now() }] };
        });
      },

      updateCartItem: (profileId, platforms) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.profile.id === profileId
              ? { ...item, platforms, addedAt: Date.now() }
              : item
          ),
        }));
      },

      removeFromCart: (profileId) => {
        set((state) => ({
          items: state.items.filter((item) => item.profile.id !== profileId),
        }));
      },

      clearCart: () => set({ items: [] }),

      // UI actions
      setCartOpen: (open) => set({ isCartOpen: open }),

      openServiceModal: (profile) =>
        set({ selectedProfile: profile, isServiceModalOpen: true }),

      closeServiceModal: () =>
        set({ isServiceModalOpen: false, selectedProfile: null }),
    }),
    {
      name: "influencer-cart",
      version: 1,
      // Only persist items, not UI state
      partialize: (state) => ({ items: state.items }),
    }
  )
);

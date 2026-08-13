import type { ProfileWithServices } from "./campaign";

// =============================================================================
// Cart Service Configuration
// =============================================================================

export interface CartServiceConfig {
  profileServiceId: string;
  serviceTypeId: string;
  serviceName: string;
  quantity: number;
  basePrice: number;
}

export interface CartPlatformConfig {
  socialAccountId: string;
  platformId: string;
  platformName: string;
  username: string;
  followers: number;
  services: CartServiceConfig[];
}

// =============================================================================
// Cart Item
// =============================================================================

export interface CartItem {
  profile: ProfileWithServices;
  platforms: CartPlatformConfig[];
  addedAt: number; // timestamp
}

// =============================================================================
// Cart State
// =============================================================================

export interface CartState {
  items: CartItem[];
  version: number; // para detectar cambios en el schema
}

// =============================================================================
// Constants
// =============================================================================

export const CART_STORAGE_KEY = "influencer-cart";
export const CART_VERSION = 1;
export const MAX_CART_ITEMS = 20;
export const MAX_SERVICE_QUANTITY = 10;

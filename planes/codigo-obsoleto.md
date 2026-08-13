# Código Obsoleto para Eliminar

Este archivo contiene código fuente de archivos que han sido identificados como no utilizados u obsoletos en el proyecto. Se han guardado aquí como respaldo antes de su eliminación definitiva.

## 1. `src/contexts/cart-context.tsx`

**Razón:** Reemplazado por el store de Zustand `src/stores/cart-store.ts` como parte de la migración de estado global. Los componentes del carrito ahora usan `useCartStore`.

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { ProfileWithServices } from "@/models/campaign";
import type { CartItem, CartPlatformConfig } from "@/models/cart";
import { MAX_CART_ITEMS, CART_STORAGE_KEY, CART_VERSION } from "@/models/cart";

// =============================================================================
// Types
// =============================================================================

interface CartContextType {
  // State
  items: CartItem[];
  isCartOpen: boolean;
  isServiceModalOpen: boolean;
  selectedProfile: ProfileWithServices | null;

  // Computed
  totalItems: number;
  totalPrice: number;
  totalPriceWithMarkup: number;
  isInCart: (profileId: string) => boolean;

  // Actions
  addToCart: (profile: ProfileWithServices, platforms: CartPlatformConfig[]) => void;
  updateCartItem: (profileId: string, platforms: CartPlatformConfig[]) => void;
  removeFromCart: (profileId: string) => void;
  clearCart: () => void;

  // UI Actions
  setCartOpen: (open: boolean) => void;
  openServiceModal: (profile: ProfileWithServices) => void;
  closeServiceModal: () => void;
}

// =============================================================================
// Context
// =============================================================================

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

// =============================================================================
// Provider
// =============================================================================

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setCartOpen] = useState(false);
  const [isServiceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileWithServices | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === CART_VERSION && Array.isArray(parsed.items)) {
          setItems(parsed.items);
        }
      }
    } catch {
      // Ignore parsing errors
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ version: CART_VERSION, items })
      );
    }
  }, [items, isHydrated]);

  // Memoized computed values
  const totalItems = useMemo(() => items.length, [items]);

  const totalPrice = useMemo(() => {
    return items.reduce((total, item) => {
      const itemTotal = item.platforms.reduce((platformTotal, platform) => {
        return (
          platformTotal +
          platform.services.reduce((serviceTotal, service) => {
            return serviceTotal + service.basePrice * service.quantity;
          }, 0)
        );
      }, 0);
      return total + itemTotal;
    }, 0);
  }, [items]);

  const totalPriceWithMarkup = useMemo(() => {
    return totalPrice * 1.2;
  }, [totalPrice]);

  const isInCart = useCallback(
    (profileId: string) => items.some((item) => item.profile.id === profileId),
    [items]
  );

  // Actions
  const addToCart = useCallback(
    (profile: ProfileWithServices, platforms: CartPlatformConfig[]) => {
      if (items.length >= MAX_CART_ITEMS) {
        alert(`No se pueden agregar más de ${MAX_CART_ITEMS} perfiles al carrito.`);
        return;
      }

      const hasServices = platforms.some((p) => p.services.some((s) => s.quantity > 0));
      if (!hasServices) {
        alert("Debes seleccionar al menos un formato para agregar al carrito.");
        return;
      }

      setItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.profile.id === profile.id);

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { profile, platforms, addedAt: Date.now() };
          return updated;
        }

        return [...prev, { profile, platforms, addedAt: Date.now() }];
      });
    },
    [items.length]
  );

  const updateCartItem = useCallback((profileId: string, platforms: CartPlatformConfig[]) => {
    setItems((prev) =>
      prev.map((item) =>
        item.profile.id === profileId
          ? { ...item, platforms, addedAt: Date.now() }
          : item
      )
    );
  }, []);

  const removeFromCart = useCallback((profileId: string) => {
    setItems((prev) => prev.filter((item) => item.profile.id !== profileId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // UI Actions
  const openServiceModal = useCallback((profile: ProfileWithServices) => {
    setSelectedProfile(profile);
    setServiceModalOpen(true);
  }, []);

  const closeServiceModal = useCallback(() => {
    setServiceModalOpen(false);
    setSelectedProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      items,
      isCartOpen,
      isServiceModalOpen,
      selectedProfile,
      totalItems,
      totalPrice,
      totalPriceWithMarkup,
      isInCart,
      addToCart,
      updateCartItem,
      removeFromCart,
      clearCart,
      setCartOpen,
      openServiceModal,
      closeServiceModal,
    }),
    [
      items,
      isCartOpen,
      isServiceModalOpen,
      selectedProfile,
      totalItems,
      totalPrice,
      totalPriceWithMarkup,
      isInCart,
      addToCart,
      updateCartItem,
      removeFromCart,
      clearCart,
      openServiceModal,
      closeServiceModal,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
```

## 2. `src/types/index.ts`

**Razón:** Los tipos de dominio ahora se definen en `src/models/` y los tipos de payload de API se infieren de los esquemas de Zod en `src/lib/schemas/`. Este archivo se ha vuelto obsoleto.

```typescript
import type { ProfileType } from "@prisma/client";

// Re-export Prisma enums for convenience
export { ProfileType, UserRole } from "@prisma/client";

// Profile with all relations
export interface ProfileWithRelations {
  id: string;
  name: string;
  type: ProfileType;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  socialAccounts: SocialAccountWithRelations[];
  categories: CategoryRelation[];
}

export interface SocialAccountWithRelations {
  id: string;
  username: string;
  profileUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  avgViews: number | null;
  avgLikes: number | null;
  engagementRate: number | null;
  lastSyncAt: Date | null;
  platform: {
    id: string;
    name: string;
    displayName: string;
  };
  services: ProfileServiceWithType[];
}

export interface ProfileServiceWithType {
  id: string;
  price: number;
  currency: string;
  notes: string | null;
  serviceType: {
    id: string;
    name: string;
    displayName: string;
  };
}

export interface CategoryRelation {
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

// Form types for creating/editing profiles
export interface CreateProfileInput {
  name: string;
  type: ProfileType;
  socialAccounts: {
    platformId: string;
    username: string;
    services: {
      serviceTypeId: string;
      price: number;
      currency?: string;
      notes?: string;
    }[];
  }[];
  categoryIds: string[];
}

export interface UpdateProfileInput extends Partial<CreateProfileInput> {
  id: string;
}

// Search/filter types
export interface ProfileFilters {
  search?: string;
  type?: ProfileType;
  platforms?: string[];
  categories?: string[];
  minFollowers?: number;
  maxFollowers?: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

## 3. `src/components/campaigns/profile-selector.tsx`

**Razón:** Reemplazado por `profile-selector-new.tsx` y la nueva lógica de filtros en el wizard de campañas. No se encontraron importaciones de este componente.

```typescript
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users, Instagram, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { formatCompactNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { useReachRanges } from "@/contexts";
import { ClientPagination } from "@/components/ui/client-pagination";
import type { ProfileWithServices } from "@/models/campaign";
import { PROFILE_TYPES } from "@/models/campaign";

// Re-export for backwards compatibility
export type { ProfileWithServices } from "@/models/campaign";

interface ProfileSelectorProps {
  profiles: ProfileWithServices[];
  selectedProfileIds: string[];
  onSelectionChange: (profileIds: string[]) => void;
  excludeProfileIds?: string[];
}

export function ProfileSelector({
  profiles,
  selectedProfileIds,
  onSelectionChange,
  excludeProfileIds = [],
}: ProfileSelectorProps) {
  const reachRanges = useReachRanges();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter states
  const [profileType, setProfileType] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(
    []
  );

  // Popover states
  const [platformPopoverOpen, setPlatformPopoverOpen] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [serviceTypePopoverOpen, setServiceTypePopoverOpen] = useState(false);

  // Extraer plataformas y categorías únicas de los perfiles
  const availablePlatforms = useMemo(() => {
    const platformMap = new Map<string, { id: string; name: string; displayName: string }>();
    profiles.forEach((p) => {
      p.socialAccounts.forEach((sa) => {
        if (!platformMap.has(sa.platform.id)) {
          platformMap.set(sa.platform.id, sa.platform);
        }
      });
    });
    return Array.from(platformMap.values());
  }, [profiles]);

  const availableCategories = useMemo(() => {
    const categoryMap = new Map<string, { id: string; name: string }>();
    profiles.forEach((p) => {
      p.categories.forEach((pc) => {
        if (!categoryMap.has(pc.category.id)) {
          categoryMap.set(pc.category.id, pc.category);
        }
      });
    });
    return Array.from(categoryMap.values());
  }, [profiles]);

  // Extraer géneros únicos de los perfiles
  const availableGenders = useMemo(() => {
    const genderMap = new Map<string, { id: string; name: string; displayName: string }>();
    profiles.forEach((p) => {
      if (p.gender && !genderMap.has(p.gender.id)) {
        genderMap.set(p.gender.id, p.gender);
      }
    });
    return Array.from(genderMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [profiles]);

  // Extraer tipos de servicio únicos de los perfiles
  const availableServiceTypes = useMemo(() => {
    const serviceTypeMap = new Map<string, { id: string; name: string; displayName: string; platformId: string }>();
    profiles.forEach((p) => {
      p.socialAccounts.forEach((sa) => {
        sa.services.forEach((s) => {
          if (!serviceTypeMap.has(s.serviceType.id)) {
            serviceTypeMap.set(s.serviceType.id, {
              ...s.serviceType,
              platformId: sa.platform.id,
            });
          }
        });
      });
    });
    return Array.from(serviceTypeMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [profiles]);

  // Extraer ciudades únicas de los perfiles
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    profiles.forEach((p) => {
      if (p.city?.name) {
        citySet.add(p.city.name);
      }
    });
    return Array.from(citySet).sort();
  }, [profiles]);

  
  // Filtrar perfiles
  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((p) => !excludeProfileIds.includes(p.id))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.socialAccounts.some((sa) =>
            sa.username.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
      .filter((p) => !profileType || p.type === profileType)
      .filter((p) => !selectedCity || p.city?.name === selectedCity)
      .filter((p) => !selectedGender || p.gender?.id === selectedGender)
      .filter(
        (p) =>
          selectedPlatforms.length === 0 ||
          p.socialAccounts.some((sa) => selectedPlatforms.includes(sa.platform.id))
      )
      .filter(
        (p) =>
          selectedCategories.length === 0 ||
          p.categories.some((pc) => selectedCategories.includes(pc.category.id))
      )
      .filter(
        (p) =>
          selectedServiceTypes.length === 0 ||
          p.socialAccounts.some((sa) =>
            sa.services.some((s) => selectedServiceTypes.includes(s.serviceType.id))
          )
      );
  }, [
    profiles,
    excludeProfileIds,
    searchTerm,
    profileType,
    selectedCity,
    selectedGender,
    selectedPlatforms,
    selectedCategories,
    selectedServiceTypes,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredProfiles.length / pageSize) || 1;
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProfiles.slice(start, start + pageSize);
  }, [filteredProfiles, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional pagination reset
    setCurrentPage(1);
  }, [searchTerm, profileType, selectedCity, selectedGender, selectedPlatforms, selectedCategories, selectedServiceTypes]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleServiceType = (serviceTypeId: string) => {
    setSelectedServiceTypes((prev) =>
      prev.includes(serviceTypeId)
        ? prev.filter((id) => id !== serviceTypeId)
        : [...prev, serviceTypeId]
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setProfileType("");
    setSelectedCity("");
    setSelectedGender("");
    setSelectedPlatforms([]);
    setSelectedCategories([]);
    setSelectedServiceTypes([]);
  };

  const hasActiveFilters =
    profileType ||
    selectedCity ||
    selectedGender ||
    selectedPlatforms.length > 0 ||
    selectedCategories.length > 0 ||
    selectedServiceTypes.length > 0;

  const activeFilterCount =
    (profileType ? 1 : 0) +
    (selectedCity ? 1 : 0) +
    (selectedGender ? 1 : 0) +
    selectedPlatforms.length +
    selectedCategories.length +
    selectedServiceTypes.length;

  const toggleProfile = (profileId: string) => {
    if (selectedProfileIds.includes(profileId)) {
      onSelectionChange(selectedProfileIds.filter((id) => id !== profileId));
    } else {
      onSelectionChange([...selectedProfileIds, profileId]);
    }
  };

  const toggleAllPage = () => {
    const pageIds = paginatedProfiles.map((p) => p.id);
    const allPageSelected = pageIds.every((id) => selectedProfileIds.includes(id));

    if (allPageSelected) {
      // Deselect all from current page
      onSelectionChange(selectedProfileIds.filter((id) => !pageIds.includes(id)));
    } else {
      // Select all from current page
      const newIds = [...new Set([...selectedProfileIds, ...pageIds])];
      onSelectionChange(newIds);
    }
  };

  const allPageSelected = paginatedProfiles.length > 0 &&
    paginatedProfiles.every((p) => selectedProfileIds.includes(p.id));

  const getPlatformIcon = (platformName: string) => {
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
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Seleccionar Perfiles
          </CardTitle>
          <Badge variant="outline">
            {selectedProfileIds.length} seleccionado
            {selectedProfileIds.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Búsqueda y botón de filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre o username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
            {showFilters ? (
              <ChevronUp className="h-4 w-4 ml-2" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2" />
            )}
          </Button>
        </div>

        {/* Panel de filtros expandible */}
        {showFilters && (
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Tipo de Perfil */}
                <div className="space-y-2">
                  <Label>Tipo de Perfil</Label>
                  <Select value={profileType || "all"} onValueChange={(v) => setProfileType(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      {PROFILE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ciudad */}
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Select value={selectedCity || "all"} onValueChange={(v) => setSelectedCity(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas las ciudades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las ciudades</SelectItem>
                      {availableCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Género */}
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={selectedGender || "all"} onValueChange={(v) => setSelectedGender(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos los géneros" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los géneros</SelectItem>
                      {availableGenders.map((gender) => (
                        <SelectItem key={gender.id} value={gender.id}>
                          {gender.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plataformas */}
                <div className="space-y-2">
                  <Label>Redes Sociales</Label>
                  <Popover open={platformPopoverOpen} onOpenChange={setPlatformPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedPlatforms.length > 0
                          ? `${selectedPlatforms.length} seleccionada${selectedPlatforms.length > 1 ? "s" : ""}`
                          : "Todas"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar plataforma..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron.</CommandEmpty>
                          <CommandGroup>
                            {availablePlatforms.map((platform) => (
                              <CommandItem
                                key={platform.id}
                                value={platform.displayName}
                                onSelect={() => togglePlatform(platform.id)}
                              >
                                <div
                                  className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                                    selectedPlatforms.includes(platform.id)
                                      ? "bg-primary text-primary-foreground"
                                      : "opacity-50"
                                  }`}
                                >
                                  {selectedPlatforms.includes(platform.id) && (
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                {platform.displayName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Categorías */}
                <div className="space-y-2">
                  <Label>Categorías</Label>
                  <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedCategories.length > 0
                          ? `${selectedCategories.length} seleccionada${selectedCategories.length > 1 ? "s" : ""}`
                          : "Todas"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar categoría..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron.</CommandEmpty>
                          <CommandGroup>
                            {availableCategories.map((category) => (
                              <CommandItem
                                key={category.id}
                                value={category.name}
                                onSelect={() => toggleCategory(category.id)}
                              >
                                <div
                                  className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                                    selectedCategories.includes(category.id)
                                      ? "bg-primary text-primary-foreground"
                                      : "opacity-50"
                                  }`}
                                >
                                  {selectedCategories.includes(category.id) && (
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                {category.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Formatos */}
                <div className="space-y-2">
                  <Label>Formatos</Label>
                  <Popover open={serviceTypePopoverOpen} onOpenChange={setServiceTypePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedServiceTypes.length > 0
                          ? `${selectedServiceTypes.length} seleccionado${selectedServiceTypes.length > 1 ? "s" : ""}`
                          : "Todos"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar formato..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron.</CommandEmpty>
                          <CommandGroup>
                            {availableServiceTypes.map((serviceType) => {
                              const platform = availablePlatforms.find((p) => p.id === serviceType.platformId);
                              return (
                                <CommandItem
                                  key={serviceType.id}
                                  value={serviceType.displayName}
                                  onSelect={() => toggleServiceType(serviceType.id)}
                                >
                                  <div
                                    className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                                      selectedServiceTypes.includes(serviceType.id)
                                        ? "bg-primary text-primary-foreground"
                                        : "opacity-50"
                                    }`}
                                  >
                                    {selectedServiceTypes.includes(serviceType.id) && (
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  {serviceType.displayName}
                                  {platform && (
                                    <span className="ml-1 text-xs text-gray-500">
                                      ({platform.displayName})
                                    </span>
                                  )}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Badges de filtros activos y botón limpiar */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                  <span className="text-sm text-gray-500">Filtros activos:</span>
                  {profileType && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setProfileType("")}>
                      {PROFILE_TYPES.find((t) => t.value === profileType)?.label}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  )}
                  {selectedCity && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCity("")}>
                      {selectedCity}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  )}
                  {selectedGender && (
                    <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedGender("")}>
                      {availableGenders.find((g) => g.id === selectedGender)?.displayName}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  )}
                  {selectedPlatforms.map((pId) => {
                    const platform = availablePlatforms.find((p) => p.id === pId);
                    return platform ? (
                      <Badge key={pId} variant="secondary" className="cursor-pointer" onClick={() => togglePlatform(pId)}>
                        {platform.displayName}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ) : null;
                  })}
                  {selectedCategories.map((cId) => {
                    const category = availableCategories.find((c) => c.id === cId);
                    return category ? (
                      <Badge key={cId} variant="secondary" className="cursor-pointer" onClick={() => toggleCategory(cId)}>
                        {category.name}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ) : null;
                  })}
                  {selectedServiceTypes.map((stId) => {
                    const serviceType = availableServiceTypes.find((s) => s.id === stId);
                    return serviceType ? (
                      <Badge key={stId} variant="secondary" className="cursor-pointer" onClick={() => toggleServiceType(stId)}>
                        {serviceType.displayName}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    ) : null;
                  })}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
                    Limpiar todos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabla de perfiles */}
        {filteredProfiles.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No se encontraron perfiles disponibles.
          </p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleAllPage}
                    />
                  </TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Redes Sociales</TableHead>
                  <TableHead>Seguidores</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Categorías</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProfiles.map((profile) => (
                  <TableRow
                    key={profile.id}
                    className={
                      selectedProfileIds.includes(profile.id)
                        ? "bg-blue-50"
                        : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProfileIds.includes(profile.id)}
                        onCheckedChange={() => toggleProfile(profile.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{profile.name}</div>
                        {profile.city && profile.country && (
                          <div className="text-sm text-gray-500">
                            {profile.city.name}, {profile.country.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {profile.type === "INFLUENCER"
                          ? "Influencer"
                          : profile.type === "UGC"
                          ? "UGC"
                          : "Ambos"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {profile.socialAccounts.map((sa) => (
                          <div
                            key={sa.id}
                            className="flex items-center gap-1 text-sm"
                          >
                            {getPlatformIcon(sa.platform.name)}
                            <span className="truncate max-w-[120px]" title={`@${sa.username}`}>
                              @{sa.username}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {profile.socialAccounts.map((sa) => (
                          <div key={sa.id} className="text-sm whitespace-nowrap">
                            {formatCompactNumber(sa.followers)}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {profile.socialAccounts.map((sa) => {
                          const reach = calculateReach(sa.followers || 0, reachRanges);
                          const percentage = getReachPercentage(sa.followers || 0, reachRanges);
                          return (
                            <div key={sa.id} className="text-sm whitespace-nowrap">
                              {formatCompactNumber(reach)} <span className="text-muted-foreground">({percentage || 0}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {profile.categories.slice(0, 2).map((pc) => (
                          <Badge key={pc.category.id} variant="secondary">
                            {pc.category.name}
                          </Badge>
                        ))}
                        {profile.categories.length > 2 && (
                          <Badge variant="secondary">
                            +{profile.categories.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginación */}
        {filteredProfiles.length > 0 && (
          <ClientPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={filteredProfiles.length}
            onPageChange={setCurrentPage}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

## 4. `src/components/ui/slider.tsx`

**Razón:** Este componente de UI existe pero no se utiliza en ninguna parte de la aplicación. Los filtros de rango de precios y engagement usan inputs numéricos.

```typescript
"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const value = props.value || props.defaultValue || [0];
  const thumbs = Array.isArray(value) ? value : [value];

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {thumbs.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
```

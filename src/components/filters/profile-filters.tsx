"use client";

import { useReducer, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  filterReducer,
  createInitialState,
} from "@/reducers/profile-filter-reducer";
import type { Platform, Category, ServiceType, Gender, Country, Department, City } from "@/models/admin";

interface ProfileFiltersProps {
  platforms: Platform[];
  categories: Category[];
  serviceTypes: ServiceType[];
  genders: Gender[];
  countries: Country[];
  departments: Department[];
  cities: City[];
}

const PROFILE_TYPES = [
  { value: "INFLUENCER", label: "Influencer" },
  { value: "UGC", label: "UGC Creator" },
  { value: "BOTH", label: "Ambos" },
];

export function ProfileFilters({
  platforms,
  categories,
  serviceTypes,
  genders,
  countries,
  departments,
  cities,
}: ProfileFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Estados de popovers (UI-specific, keep separate)
  const [platformPopoverOpen, setPlatformPopoverOpen] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);

  // Consolidated filter state with useReducer
  const [filters, dispatch] = useReducer(
    filterReducer,
    searchParams,
    createInitialState
  );

  // Destructure for easier access
  const {
    search,
    countryId,
    departmentId,
    cityId,
    profileType,
    genderId,
    selectedPlatforms,
    selectedCategories,
    selectedServices,
    minPrice,
    maxPrice,
    engagementRange,
  } = filters;

  const availableDepartments = useMemo(
    () => (countryId ? departments.filter((d) => d.countryId === countryId) : []),
    [countryId, departments]
  );

  const availableCities = useMemo(
    () => (departmentId ? cities.filter((c) => c.departmentId === departmentId) : []),
    [departmentId, cities]
  );

  // Aplicar filtros
  const applyFilters = () => {
    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (countryId) params.set("countryId", countryId);
    if (departmentId) params.set("departmentId", departmentId);
    if (cityId) params.set("cityId", cityId);
    if (profileType) params.set("type", profileType);
    if (genderId) params.set("gender", genderId);
    if (selectedPlatforms.length > 0)
      params.set("platforms", selectedPlatforms.join(","));
    if (selectedCategories.length > 0)
      params.set("categories", selectedCategories.join(","));
    if (selectedServices.length > 0)
      params.set("services", selectedServices.join(","));
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);

    if (engagementRange[0] > 0)
      params.set("minEngagement", engagementRange[0].toString());
    if (engagementRange[1] < 10)
      params.set("maxEngagement", engagementRange[1].toString());

    startTransition(() => {
      router.push(`/profiles?${params.toString()}`);
    });
  };

  // Limpiar filtros
  const clearFilters = () => {
    dispatch({ type: "CLEAR_ALL" });
    startTransition(() => {
      router.push("/profiles");
    });
  };

  const togglePlatform = (platformId: string) => {
    dispatch({ type: "TOGGLE_PLATFORM", payload: platformId });
  };

  const toggleCategory = (categoryId: string) => {
    dispatch({ type: "TOGGLE_CATEGORY", payload: categoryId });
  };

  const toggleService = (serviceId: string) => {
    dispatch({ type: "TOGGLE_SERVICE", payload: serviceId });
  };

  const hasActiveFilters =
    search ||
    countryId ||
    departmentId ||
    cityId ||
    profileType ||
    genderId ||
    selectedPlatforms.length > 0 ||
    selectedCategories.length > 0 ||
    selectedServices.length > 0 ||
    minPrice ||
    maxPrice ||
    engagementRange[0] > 0 ||
    engagementRange[1] < 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buscador General */}
        <div className="space-y-2">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => dispatch({ type: "SET_SEARCH", payload: e.target.value })}
            placeholder="Buscar por nombre o username..."
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>

        {/* País */}
        <div className="space-y-2">
          <Label>País</Label>
          <div className="flex gap-2">
            <Select value={countryId || undefined} onValueChange={(v) => dispatch({ type: "SET_COUNTRY", payload: v })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Todos los países" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {countryId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "CLEAR_COUNTRY" })}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* Departamento */}
        <div className="space-y-2">
          <Label>Departamento</Label>
          <div className="flex gap-2">
            <Select
              value={departmentId || undefined}
              onValueChange={(v) => dispatch({ type: "SET_DEPARTMENT", payload: v })}
              disabled={!countryId}
            >
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={
                    countryId ? "Todos los departamentos" : "Selecciona país primero"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departmentId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "CLEAR_DEPARTMENT" })}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* Ciudad */}
        <div className="space-y-2">
          <Label>Ciudad</Label>
          <div className="flex gap-2">
            <Select
              value={cityId || undefined}
              onValueChange={(v) => dispatch({ type: "SET_CITY", payload: v })}
              disabled={!departmentId}
            >
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={
                    departmentId ? "Todas las ciudades" : "Selecciona departamento primero"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableCities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cityId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "SET_CITY", payload: "" })}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* Tipo de Perfil */}
        <div className="space-y-2">
          <Label>Tipo de Perfil</Label>
          <div className="flex gap-2">
            <Select value={profileType || undefined} onValueChange={(v) => dispatch({ type: "SET_PROFILE_TYPE", payload: v })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profileType && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "SET_PROFILE_TYPE", payload: "" })}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* Género */}
        <div className="space-y-2">
          <Label>Género</Label>
          <div className="flex gap-2">
            <Select value={genderId || undefined} onValueChange={(v) => dispatch({ type: "SET_GENDER", payload: v })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Todos los géneros" />
              </SelectTrigger>
              <SelectContent>
                {genders.map((gender) => (
                  <SelectItem key={gender.id} value={gender.id}>
                    {gender.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {genderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "SET_GENDER", payload: "" })}
              >
                ✕
              </Button>
            )}
          </div>
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
                  ? `${selectedPlatforms.length} plataformas seleccionadas`
                  : "Seleccionar plataformas..."}
                <svg
                  className="ml-2 h-4 w-4 shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                  />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar plataforma..." />
                <CommandList>
                  <CommandEmpty>No se encontraron plataformas.</CommandEmpty>
                  <CommandGroup>
                    {platforms.map((platform) => (
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
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
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
          {selectedPlatforms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedPlatforms.map((platformId) => {
                const platform = platforms.find((p) => p.id === platformId);
                return platform ? (
                  <Badge
                    key={platformId}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => togglePlatform(platformId)}
                  >
                    {platform.displayName}
                    <svg
                      className="ml-1 h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Formatos */}
        <div className="space-y-2">
          <Label>Formatos</Label>
          <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                {selectedServices.length > 0
                  ? `${selectedServices.length} formatos seleccionados`
                  : "Seleccionar formatos..."}
                <svg
                  className="ml-2 h-4 w-4 shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                  />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar formato..." />
                <CommandList>
                  <CommandEmpty>No se encontraron formatos.</CommandEmpty>
                  <CommandGroup>
                    {serviceTypes.map((service) => {
                      const platform = platforms.find(
                        (p) => p.id === service.platformId
                      );
                      return (
                        <CommandItem
                          key={service.id}
                          value={service.displayName}
                          onSelect={() => toggleService(service.id)}
                        >
                          <div
                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                              selectedServices.includes(service.id)
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            }`}
                          >
                            {selectedServices.includes(service.id) && (
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          {service.displayName}{" "}
                          <span className="text-xs text-gray-500 ml-1">
                            ({platform?.displayName})
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedServices.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedServices.map((serviceId) => {
                const service = serviceTypes.find((s) => s.id === serviceId);
                return service ? (
                  <Badge
                    key={serviceId}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleService(serviceId)}
                  >
                    {service.displayName}
                    <svg
                      className="ml-1 h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Rango de Precios */}
        <div className="space-y-2">
          <Label>Rango de Precios (COP)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input
                type="number"
                value={minPrice}
                onChange={(e) => dispatch({ type: "SET_MIN_PRICE", payload: e.target.value })}
                placeholder="Mín"
                min="0"
              />
            </div>
            <div>
              <Input
                type="number"
                value={maxPrice}
                onChange={(e) => dispatch({ type: "SET_MAX_PRICE", payload: e.target.value })}
                placeholder="Máx"
                min="0"
              />
            </div>
          </div>
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
                  ? `${selectedCategories.length} categorías seleccionadas`
                  : "Seleccionar categorías..."}
                <svg
                  className="ml-2 h-4 w-4 shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                  />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar categoría..." />
                <CommandList>
                  <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                  <CommandGroup>
                    {categories.map((category) => (
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
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
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
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedCategories.map((categoryId) => {
                const category = categories.find((c) => c.id === categoryId);
                return category ? (
                  <Badge
                    key={categoryId}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleCategory(categoryId)}
                  >
                    {category.name}
                    <svg
                      className="ml-1 h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={applyFilters}
            className="flex-1"
            disabled={isPending}
          >
            {isPending ? "Aplicando..." : "Aplicar Filtros"}
          </Button>
          {hasActiveFilters && (
            <Button
              onClick={clearFilters}
              variant="outline"
              disabled={isPending}
            >
              Limpiar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

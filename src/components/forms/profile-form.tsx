"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDepartments, useCities } from "@/hooks/queries/use-locations";
import { useCreateProfile, useUpdateProfile } from "@/hooks/mutations/use-profile-mutations";
import { useCreateGender } from "@/hooks/mutations/use-gender-mutations";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriceInput } from "@/components/ui/price-input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileType } from "@prisma/client";
import type { Platform, ServiceType, Category, Gender, Country, Department, City } from "@/models/admin";

interface ProfileFormProps {
  platforms: Platform[];
  serviceTypes: ServiceType[];
  categories: Category[];
  genders: Gender[];
  countries: Country[];
  initialData?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    type: ProfileType;
    countryId?: string | null;
    departmentId?: string | null;
    cityId?: string | null;
    genderId?: string | null;
    socialAccounts: {
      platformId: string;
      username: string;
      services: {
        serviceTypeId: string;
        price: number;
        currency: string;
      }[];
    }[];
    categoryIds: string[];
  };
}

interface SocialAccountInput {
  platformId: string;
  username: string;
  services: {
    serviceTypeId: string;
    price: string;
  }[];
}

const TYPE_LABELS: Record<ProfileType, string> = {
  INFLUENCER: "Influencer",
  UGC: "UGC Creator",
  BOTH: "Ambos (Influencer + UGC)",
};

export function ProfileForm({
  platforms,
  serviceTypes,
  categories,
  genders: initialGenders,
  countries,
  initialData,
}: ProfileFormProps) {
  const router = useRouter();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const [departmentPopoverOpen, setDepartmentPopoverOpen] = useState(false);
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);

  // Mutations
  const createMutation = useCreateProfile();
  const updateMutation = useUpdateProfile();
  const mutation = initialData ? updateMutation : createMutation;
  const loading = mutation.isPending;
  const error = validationError || mutation.error?.message || null;

  // Gender state
  const [genders, setGenders] = useState<Gender[]>(initialGenders);
  const [genderDialogOpen, setGenderDialogOpen] = useState(false);
  const [newGenderName, setNewGenderName] = useState("");
  const genderMutation = useCreateGender();
  const genderLoading = genderMutation.isPending;
  const genderError = genderMutation.error?.message || null;

  // Form state
  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [type, setType] = useState<ProfileType>(initialData?.type || "INFLUENCER");
  const [countryId, setCountryId] = useState<string>(initialData?.countryId || "");
  const [departmentId, setDepartmentId] = useState<string>(initialData?.departmentId || "");

  // Location queries (after countryId/departmentId state declarations)
  const { data: departments = [], isLoading: loadingDepartments } = useDepartments(countryId);
  const { data: cities = [], isLoading: loadingCities } = useCities(departmentId);
  const [cityId, setCityId] = useState<string>(initialData?.cityId || "");
  const [genderId, setGenderId] = useState<string>(initialData?.genderId || "");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    initialData?.socialAccounts.map((sa) => sa.platformId) || []
  );
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountInput[]>(
    initialData?.socialAccounts.map((sa) => ({
      platformId: sa.platformId,
      username: sa.username,
      services: sa.services.map((s) => ({
        serviceTypeId: s.serviceTypeId,
        price: s.price.toString(),
      })),
    })) || []
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialData?.categoryIds || []
  );

  // Get available service types for a platform and profile type
  const getAvailableServices = (platformId: string) => {
    return serviceTypes.filter((st) => {
      if (st.platformId !== platformId) return false;

      // Si el tipo es BOTH, mostrar TODOS los servicios de la plataforma
      if (type === "BOTH") return true;

      // Si no, filtrar por el tipo específico
      return st.profileTypes.includes(type);
    });
  };

  // Handle country change - reset department and city
  const handleCountryChange = (newCountryId: string) => {
    setCountryId(newCountryId);
    setCountryPopoverOpen(false);
    if (newCountryId !== countryId) {
      setDepartmentId("");
      setCityId("");
    }
  };

  // Handle department change - reset city
  const handleDepartmentChange = (newDepartmentId: string) => {
    setDepartmentId(newDepartmentId);
    setDepartmentPopoverOpen(false);
    if (newDepartmentId !== departmentId) {
      setCityId("");
    }
  };

  // Handle city change
  const handleCityChange = (newCityId: string) => {
    setCityId(newCityId);
    setCityPopoverOpen(false);
  };

  // Handle platform selection change
  useEffect(() => {
    setSocialAccounts((prev) => {
      // Add new platforms
      const newAccounts = selectedPlatforms
        .filter((pId) => !prev.find((sa) => sa.platformId === pId))
        .map((platformId) => ({
          platformId,
          username: "",
          services: getAvailableServices(platformId).map((st) => ({
            serviceTypeId: st.id,
            price: "",
          })),
        }));

      // Keep existing and update services based on type change
      const existingAccounts = prev
        .filter((sa) => selectedPlatforms.includes(sa.platformId))
        .map((sa) => ({
          ...sa,
          services: getAvailableServices(sa.platformId).map((st) => {
            const existing = sa.services.find(
              (s) => s.serviceTypeId === st.id
            );
            return existing || { serviceTypeId: st.id, price: "" };
          }),
        }));

      return [...existingAccounts, ...newAccounts];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getAvailableServices is stable within platform/type changes
  }, [selectedPlatforms, type]);

  // Handle platform checkbox
  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    );
  };

  // Handle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Remove category
  const removeCategory = (categoryId: string) => {
    setSelectedCategories((prev) => prev.filter((id) => id !== categoryId));
  };

  // Create new gender
  const handleCreateGender = () => {
    if (!newGenderName.trim()) return;

    genderMutation.mutate(newGenderName, {
      onSuccess: (data) => {
        setGenders((prev) => [...prev, data].sort((a, b) => a.displayName.localeCompare(b.displayName)));
        setGenderId(data.id);
        setNewGenderName("");
        setGenderDialogOpen(false);
      },
    });
  };

  // Update social account username
  const updateUsername = (platformId: string, username: string) => {
    setSocialAccounts((prev) =>
      prev.map((sa) =>
        sa.platformId === platformId ? { ...sa, username } : sa
      )
    );
  };

  // Update service price
  const updateServicePrice = (
    platformId: string,
    serviceTypeId: string,
    price: string
  ) => {
    setSocialAccounts((prev) =>
      prev.map((sa) =>
        sa.platformId === platformId
          ? {
              ...sa,
              services: sa.services.map((s) =>
                s.serviceTypeId === serviceTypeId ? { ...s, price } : s
              ),
            }
          : sa
      )
    );
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate
    if (!name.trim()) {
      setValidationError("El nombre es requerido");
      return;
    }

    if (selectedPlatforms.length === 0) {
      setValidationError("Selecciona al menos una plataforma");
      return;
    }

    // Check all usernames are filled
    const missingUsername = socialAccounts.find((sa) => !sa.username.trim());
    if (missingUsername) {
      const platform = platforms.find((p) => p.id === missingUsername.platformId);
      setValidationError(`Ingresa el username de ${platform?.displayName}`);
      return;
    }

    const payload = {
      name,
      email: email || null,
      phone: phone || null,
      type,
      countryId: countryId || null,
      departmentId: departmentId || null,
      cityId: cityId || null,
      genderId: genderId || null,
      socialAccounts: socialAccounts.map((sa) => ({
        platformId: sa.platformId,
        username: sa.username,
        services: sa.services
          .filter((s) => s.price && parseInt(s.price, 10) > 0)
          .map((s) => ({
            serviceTypeId: s.serviceTypeId,
            price: parseInt(s.price, 10),
            currency: "COP",
          })),
      })),
      categoryIds: selectedCategories,
    };

    const onSuccess = (data: { id: string }) => {
      router.push(`/profiles/${data.id}`);
      router.refresh();
    };

    if (initialData) {
      updateMutation.mutate(
        { profileId: initialData.id, payload },
        { onSuccess },
      );
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  };

  // Get selected category objects
  const selectedCategoryObjects = categories.filter((c) =>
    selectedCategories.includes(c.id)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-md">{error}</div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Perfil</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del influencer/creador"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: +57 300 123 4567"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Perfil</Label>
            <Select value={type} onValueChange={(v) => setType(v as ProfileType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INFLUENCER">Influencer</SelectItem>
                <SelectItem value="UGC">UGC Creator</SelectItem>
                <SelectItem value="BOTH">Ambos (Influencer + UGC)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Género</Label>
            <div className="flex gap-2">
              <Select value={genderId} onValueChange={setGenderId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar género..." />
                </SelectTrigger>
                <SelectContent>
                  {genders.map((gender) => (
                    <SelectItem key={gender.id} value={gender.id}>
                      {gender.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setGenderDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gender Dialog */}
      <Dialog open={genderDialogOpen} onOpenChange={setGenderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Género</DialogTitle>
            <DialogDescription>
              Ingresa el nombre del nuevo género.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {genderError && (
              <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                {genderError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newGender">Nombre</Label>
              <Input
                id="newGender"
                value={newGenderName}
                onChange={(e) => setNewGenderName(e.target.value)}
                placeholder="Ej: No binario"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateGender();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setGenderDialogOpen(false);
                setNewGenderName("");
                genderMutation.reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateGender}
              disabled={genderLoading}
            >
              {genderLoading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Ubicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Country */}
          <div className="space-y-2">
            <Label>País</Label>
            <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryPopoverOpen}
                  className="w-full justify-between"
                >
                  {countryId
                    ? countries.find((c) => c.id === countryId)?.name
                    : "Seleccionar país..."}
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
                  <CommandInput placeholder="Buscar país..." />
                  <CommandList>
                    <CommandEmpty>No se encontró el país.</CommandEmpty>
                    <CommandGroup>
                      {countries.map((countryOption) => (
                        <CommandItem
                          key={countryOption.id}
                          value={countryOption.name}
                          onSelect={() => handleCountryChange(countryOption.id)}
                        >
                          <div
                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                              countryId === countryOption.id
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            }`}
                          >
                            {countryId === countryOption.id && (
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
                          {countryOption.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Popover open={departmentPopoverOpen} onOpenChange={setDepartmentPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={departmentPopoverOpen}
                  className="w-full justify-between"
                  disabled={!countryId || loadingDepartments}
                >
                  {loadingDepartments
                    ? "Cargando..."
                    : departmentId
                    ? departments.find((d) => d.id === departmentId)?.name
                    : countryId
                    ? "Seleccionar departamento..."
                    : "Selecciona un país primero"}
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
                  <CommandInput placeholder="Buscar departamento..." />
                  <CommandList>
                    <CommandEmpty>No se encontró el departamento.</CommandEmpty>
                    <CommandGroup>
                      {departments.map((deptOption) => (
                        <CommandItem
                          key={deptOption.id}
                          value={deptOption.name}
                          onSelect={() => handleDepartmentChange(deptOption.id)}
                        >
                          <div
                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                              departmentId === deptOption.id
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            }`}
                          >
                            {departmentId === deptOption.id && (
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
                          {deptOption.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Popover open={cityPopoverOpen} onOpenChange={setCityPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={cityPopoverOpen}
                  className="w-full justify-between"
                  disabled={!departmentId || loadingCities}
                >
                  {loadingCities
                    ? "Cargando..."
                    : cityId
                    ? cities.find((c) => c.id === cityId)?.name
                    : departmentId
                    ? "Seleccionar ciudad..."
                    : "Selecciona un departamento primero"}
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
                  <CommandInput placeholder="Buscar ciudad..." />
                  <CommandList>
                    <CommandEmpty>No se encontró la ciudad.</CommandEmpty>
                    <CommandGroup>
                      {cities.map((cityOption) => (
                        <CommandItem
                          key={cityOption.id}
                          value={cityOption.name}
                          onSelect={() => handleCityChange(cityOption.id)}
                        >
                          <div
                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                              cityId === cityOption.id
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            }`}
                          >
                            {cityId === cityOption.id && (
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
                          {cityOption.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Platforms Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Redes Sociales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            {platforms.map((platform) => (
              <div key={platform.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`platform-${platform.id}`}
                  checked={selectedPlatforms.includes(platform.id)}
                  onCheckedChange={() => togglePlatform(platform.id)}
                />
                <Label htmlFor={`platform-${platform.id}`} className="cursor-pointer">
                  {platform.displayName}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Social Accounts & Services */}
      {socialAccounts.map((account) => {
        const platform = platforms.find((p) => p.id === account.platformId);
        const availableServices = getAvailableServices(account.platformId);

        return (
          <Card key={account.platformId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge>{platform?.displayName}</Badge>
                <span className="text-sm font-normal text-gray-500">
                  - {TYPE_LABELS[type]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">@</span>
                  <Input
                    value={account.username}
                    onChange={(e) =>
                      updateUsername(account.platformId, e.target.value)
                    }
                    placeholder={`Usuario de ${platform?.displayName}`}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Formatos y Precios</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableServices.map((service) => {
                    const serviceInput = account.services.find(
                      (s) => s.serviceTypeId === service.id
                    );
                    return (
                      <div key={service.id} className="flex items-center gap-2">
                        <Label className="min-w-32 text-sm">
                          {service.displayName}
                        </Label>
                        <div className="flex items-center flex-1">
                          <span className="text-gray-500 mr-1">$</span>
                          <PriceInput
                            value={serviceInput?.price || ""}
                            onChange={(value) =>
                              updateServicePrice(
                                account.platformId,
                                service.id,
                                value
                              )
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Categories - Multi Select */}
      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={categoryPopoverOpen}
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

          {/* Selected categories badges */}
          {selectedCategoryObjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCategoryObjects.map((category) => (
                <Badge
                  key={category.id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeCategory(category.id)}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : initialData ? "Actualizar Perfil" : "Crear Perfil"}
        </Button>
      </div>
    </form>
  );
}

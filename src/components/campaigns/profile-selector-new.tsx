"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Users,
  Instagram,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { calculateReach, getReachPercentage } from "@/lib/format";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import { ClientPagination } from "@/components/ui/client-pagination";
import { cn } from "@/lib/utils";

export interface ProfileWithServices {
  id: string;
  name: string;
  type: string;
  country?: string | null;
  city?: string | null;
  gender?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  socialAccounts: {
    id: string;
    username: string;
    followers?: number | null;
    profilePicUrl?: string | null;
    platform: {
      id: string;
      name: string;
      displayName: string;
    };
    services: {
      id: string;
      price: number | string;
      serviceType: {
        id: string;
        name: string;
        displayName: string;
      };
    }[];
  }[];
  categories: {
    category: {
      id: string;
      name: string;
    };
  }[];
}

const PROFILE_TYPES = [
  { value: "INFLUENCER", label: "Influencer" },
  { value: "UGC", label: "UGC Creator" },
  { value: "BOTH", label: "Ambos" },
];

interface ProfileSelectorNewProps {
  profiles: ProfileWithServices[];
  selectedProfileIds: string[];
  onSelectionChange: (profileIds: string[]) => void;
  excludeProfileIds?: string[];
}

export function ProfileSelectorNew({
  profiles,
  selectedProfileIds,
  onSelectionChange,
  excludeProfileIds = [],
}: ProfileSelectorNewProps) {
  const { data: reachRanges = [] } = useReachRanges();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter states
  const [profileType, setProfileType] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(
    []
  );

  // Extract unique platforms from profiles
  const availablePlatforms = useMemo(() => {
    const platformMap = new Map<
      string,
      { id: string; name: string; displayName: string }
    >();
    profiles.forEach((p) => {
      p.socialAccounts.forEach((sa) => {
        if (!platformMap.has(sa.platform.id)) {
          platformMap.set(sa.platform.id, sa.platform);
        }
      });
    });
    return Array.from(platformMap.values());
  }, [profiles]);

  // Extract unique categories from profiles
  const availableCategories = useMemo(() => {
    const categoryMap = new Map<string, { id: string; name: string }>();
    profiles.forEach((p) => {
      p.categories.forEach((pc) => {
        if (!categoryMap.has(pc.category.id)) {
          categoryMap.set(pc.category.id, pc.category);
        }
      });
    });
    return Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [profiles]);

  // Extract unique genders from profiles
  const availableGenders = useMemo(() => {
    const genderMap = new Map<
      string,
      { id: string; name: string; displayName: string }
    >();
    profiles.forEach((p) => {
      if (p.gender && !genderMap.has(p.gender.id)) {
        genderMap.set(p.gender.id, p.gender);
      }
    });
    return Array.from(genderMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [profiles]);

  // Extract unique service types from profiles
  const availableServiceTypes = useMemo(() => {
    const serviceTypeMap = new Map<
      string,
      { id: string; name: string; displayName: string; platformId: string }
    >();
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
    return Array.from(serviceTypeMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [profiles]);

  // Extract unique countries from profiles
  const availableCountries = useMemo(() => {
    const countrySet = new Set<string>();
    profiles.forEach((p) => {
      if (p.country) {
        countrySet.add(p.country);
      }
    });
    return Array.from(countrySet).sort();
  }, [profiles]);

  // Extract unique cities from profiles (filtered by selected country)
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    profiles.forEach((p) => {
      if (p.city && (!selectedCountry || p.country === selectedCountry)) {
        citySet.add(p.city);
      }
    });
    return Array.from(citySet).sort();
  }, [profiles, selectedCountry]);

  // Filter profiles
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
      .filter((p) => !selectedCountry || p.country === selectedCountry)
      .filter((p) => !selectedCity || p.city === selectedCity)
      .filter((p) => !selectedGender || p.gender?.id === selectedGender)
      .filter(
        (p) =>
          selectedPlatforms.length === 0 ||
          p.socialAccounts.some((sa) =>
            selectedPlatforms.includes(sa.platform.id)
          )
      )
      .filter(
        (p) =>
          selectedCategories.length === 0 ||
          p.categories.some((pc) =>
            selectedCategories.includes(pc.category.id)
          )
      )
      .filter(
        (p) =>
          selectedServiceTypes.length === 0 ||
          p.socialAccounts.some((sa) =>
            sa.services.some((s) =>
              selectedServiceTypes.includes(s.serviceType.id)
            )
          )
      );
  }, [
    profiles,
    excludeProfileIds,
    searchTerm,
    profileType,
    selectedCountry,
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
  }, [
    searchTerm,
    profileType,
    selectedCountry,
    selectedCity,
    selectedGender,
    selectedPlatforms,
    selectedCategories,
    selectedServiceTypes,
  ]);

  // Reset city when country changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional derived state reset
    setSelectedCity("");
  }, [selectedCountry]);

  const clearFilters = () => {
    setSearchTerm("");
    setProfileType("");
    setSelectedCountry("");
    setSelectedCity("");
    setSelectedGender("");
    setSelectedPlatforms([]);
    setSelectedCategories([]);
    setSelectedServiceTypes([]);
  };

  const hasActiveFilters =
    profileType ||
    selectedCountry ||
    selectedCity ||
    selectedGender ||
    selectedPlatforms.length > 0 ||
    selectedCategories.length > 0 ||
    selectedServiceTypes.length > 0;

  const activeFilterCount =
    (profileType ? 1 : 0) +
    (selectedCountry ? 1 : 0) +
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
    const allPageSelected = pageIds.every((id) =>
      selectedProfileIds.includes(id)
    );

    if (allPageSelected) {
      onSelectionChange(
        selectedProfileIds.filter((id) => !pageIds.includes(id))
      );
    } else {
      const newIds = [...new Set([...selectedProfileIds, ...pageIds])];
      onSelectionChange(newIds);
    }
  };

  const allPageSelected =
    paginatedProfiles.length > 0 &&
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

  const getProfileAvatar = (profile: ProfileWithServices) => {
    const firstAccount = profile.socialAccounts[0];
    return firstAccount?.profilePicUrl || null;
  };

  // Convert to MultiSelect options
  const platformOptions = availablePlatforms.map((p) => ({
    value: p.id,
    label: p.displayName,
  }));

  const categoryOptions = availableCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const serviceTypeOptions = availableServiceTypes.map((s) => ({
    value: s.id,
    label: s.displayName,
  }));

  return (
    <Card>
      <CardHeader className="pb-4">
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
        {/* Search and filter toggle */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="filter-toggle" className="text-sm cursor-pointer">
              Filtros
            </Label>
            <Switch
              id="filter-toggle"
              checked={showFilters}
              onCheckedChange={setShowFilters}
            />
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Collapsible filter panel */}
        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            showFilters
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Profile Type */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Tipo de Perfil
                    </Label>
                    <Select
                      value={profileType || "all"}
                      onValueChange={(v) =>
                        setProfileType(v === "all" ? "" : v)
                      }
                    >
                      <SelectTrigger>
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

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Género
                    </Label>
                    <Select
                      value={selectedGender || "all"}
                      onValueChange={(v) =>
                        setSelectedGender(v === "all" ? "" : v)
                      }
                    >
                      <SelectTrigger>
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

                  {/* Country */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      País
                    </Label>
                    <Select
                      value={selectedCountry || "all"}
                      onValueChange={(v) =>
                        setSelectedCountry(v === "all" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los países" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los países</SelectItem>
                        {availableCountries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Ciudad
                    </Label>
                    <Select
                      value={selectedCity || "all"}
                      onValueChange={(v) =>
                        setSelectedCity(v === "all" ? "" : v)
                      }
                    >
                      <SelectTrigger>
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

                  {/* Platforms - Multi Select */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Redes Sociales
                    </Label>
                    <MultiSelect
                      options={platformOptions}
                      selected={selectedPlatforms}
                      onChange={setSelectedPlatforms}
                      placeholder="Todas las redes"
                      searchPlaceholder="Buscar red social..."
                      emptyMessage="No se encontraron redes."
                    />
                  </div>

                  {/* Categories - Multi Select */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Categorias
                    </Label>
                    <MultiSelect
                      options={categoryOptions}
                      selected={selectedCategories}
                      onChange={setSelectedCategories}
                      placeholder="Todas las categorias"
                      searchPlaceholder="Buscar categoria..."
                      emptyMessage="No se encontraron categorias."
                    />
                  </div>

                  {/* Service Types - Multi Select */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Formatos
                    </Label>
                    <MultiSelect
                      options={serviceTypeOptions}
                      selected={selectedServiceTypes}
                      onChange={setSelectedServiceTypes}
                      placeholder="Todos los formatos"
                      searchPlaceholder="Buscar formato..."
                      emptyMessage="No se encontraron formatos."
                    />
                  </div>
                </div>

                {/* Active filters and clear button */}
                {hasActiveFilters && (
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">
                        Filtros activos:
                      </span>
                      {profileType && (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setProfileType("")}
                        >
                          {
                            PROFILE_TYPES.find((t) => t.value === profileType)
                              ?.label
                          }
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      )}
                      {selectedGender && (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setSelectedGender("")}
                        >
                          {
                            availableGenders.find(
                              (g) => g.id === selectedGender
                            )?.displayName
                          }
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      )}
                      {selectedCountry && (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setSelectedCountry("")}
                        >
                          {selectedCountry}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      )}
                      {selectedCity && (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setSelectedCity("")}
                        >
                          {selectedCity}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      )}
                      {selectedPlatforms.map((pId) => {
                        const platform = availablePlatforms.find(
                          (p) => p.id === pId
                        );
                        return platform ? (
                          <Badge
                            key={pId}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() =>
                              setSelectedPlatforms((prev) =>
                                prev.filter((id) => id !== pId)
                              )
                            }
                          >
                            {platform.displayName}
                            <X className="ml-1 h-3 w-3" />
                          </Badge>
                        ) : null;
                      })}
                      {selectedCategories.map((cId) => {
                        const category = availableCategories.find(
                          (c) => c.id === cId
                        );
                        return category ? (
                          <Badge
                            key={cId}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() =>
                              setSelectedCategories((prev) =>
                                prev.filter((id) => id !== cId)
                              )
                            }
                          >
                            {category.name}
                            <X className="ml-1 h-3 w-3" />
                          </Badge>
                        ) : null;
                      })}
                      {selectedServiceTypes.map((stId) => {
                        const serviceType = availableServiceTypes.find(
                          (s) => s.id === stId
                        );
                        return serviceType ? (
                          <Badge
                            key={stId}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() =>
                              setSelectedServiceTypes((prev) =>
                                prev.filter((id) => id !== stId)
                              )
                            }
                          >
                            {serviceType.displayName}
                            <X className="ml-1 h-3 w-3" />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpiar todos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {filteredProfiles.length} perfil
          {filteredProfiles.length !== 1 ? "es" : ""} encontrado
          {filteredProfiles.length !== 1 ? "s" : ""}
        </div>

        {/* Profiles table */}
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No se encontraron perfiles disponibles.</p>
            {hasActiveFilters && (
              <Button
                variant="link"
                onClick={clearFilters}
                className="mt-2"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
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
                  <TableHead>Alcance Est.</TableHead>
                  <TableHead>Categorias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProfiles.map((profile) => {
                  const isSelected = selectedProfileIds.includes(profile.id);
                  const avatarUrl = getProfileAvatar(profile);

                  return (
                    <TableRow
                      key={profile.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => toggleProfile(profile.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProfile(profile.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={avatarUrl || ""} />
                            <AvatarFallback>
                              {profile.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{profile.name}</div>
                            {(profile.city || profile.country) && (
                              <div className="text-xs text-muted-foreground">
                                {[profile.city, profile.country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {profile.type === "INFLUENCER"
                            ? "Influencer"
                            : profile.type === "UGC"
                            ? "UGC"
                            : "Ambos"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.socialAccounts.map((sa) => (
                            <Badge
                              key={sa.id}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {getPlatformIcon(sa.platform.name)}
                              <span className="text-xs">@{sa.username}</span>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {profile.socialAccounts.map((sa) => (
                            <div
                              key={sa.id}
                              className="text-xs flex items-center gap-1"
                            >
                              {getPlatformIcon(sa.platform.name)}
                              <span>
                                {sa.followers?.toLocaleString() || 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {profile.socialAccounts.map((sa) => {
                            const reach = calculateReach(sa.followers || 0, reachRanges);
                            const percentage = getReachPercentage(
                              sa.followers || 0, reachRanges
                            );
                            return (
                              <div
                                key={sa.id}
                                className="text-xs text-green-600"
                              >
                                {reach?.toLocaleString() || 0}{" "}
                                <span className="text-muted-foreground">
                                  ({percentage || 0}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {profile.categories.slice(0, 2).map((pc) => (
                            <Badge key={pc.category.id} variant="outline">
                              {pc.category.name}
                            </Badge>
                          ))}
                          {profile.categories.length > 2 && (
                            <Badge variant="outline">
                              +{profile.categories.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
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

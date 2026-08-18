"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Search, Instagram, Trash2, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatCompactNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import type { ProfileWithServices } from "@/models/campaign";
import { PROFILE_TYPES } from "@/models/campaign";
import { useCampaignWizard } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import { ClientPagination } from "@/components/ui/client-pagination";

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

function getProfileAvatar(profile: ProfileWithServices) {
  const firstAccount = profile.socialAccounts[0];
  return firstAccount?.profilePicUrl || null;
}

export function CampaignStepProfiles() {
  const { profiles, filters } = useCampaignWizard();
  const selectedProfileIds = useCampaignWizardStore((s) => s.selectedProfileIds);
  const markup = useCampaignWizardStore((s) => s.markup);
  const profileConfigs = useCampaignWizardStore((s) => s.profileConfigs);
  const showFilters = useCampaignWizardStore((s) => s.showFilters);
  const setShowFilters = useCampaignWizardStore((s) => s.setShowFilters);
  const toggleProfile = useCampaignWizardStore((s) => s.toggleProfile);
  const removeProfile = useCampaignWizardStore((s) => s.removeProfile);
  const togglePlatform = useCampaignWizardStore((s) => s.togglePlatform);
  const toggleService = useCampaignWizardStore((s) => s.toggleService);
  const updateServiceQuantity = useCampaignWizardStore((s) => s.updateServiceQuantity);
  const { data: reachRanges = [] } = useReachRanges();

  const selectedProfiles = useMemo(
    () => profiles.filter((p) => selectedProfileIds.includes(p.id)),
    [profiles, selectedProfileIds]
  );

  const platformOptions = useMemo(
    () =>
      filters.filterOptions.platforms.map((p) => ({
        value: p.id,
        label: p.displayName,
      })),
    [filters.filterOptions.platforms]
  );

  const categoryOptions = useMemo(
    () =>
      filters.filterOptions.categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [filters.filterOptions.categories]
  );

  const serviceOptions = useMemo(
    () =>
      filters.filterOptions.serviceTypes.map((s) => ({
        value: s.id,
        label: s.displayName,
      })),
    [filters.filterOptions.serviceTypes]
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalProfiles = filters.filteredProfiles.length;
  const totalPages = Math.ceil(totalProfiles / pageSize) || 1;
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filters.filteredProfiles.slice(start, start + pageSize);
  }, [filters.filteredProfiles, currentPage, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional pagination reset
    setCurrentPage(1);
  }, [filters.filteredProfiles.length]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-320px)] lg:min-h-[500px]">
      {/* Left column: Filters and profile list */}
      <div className="lg:col-span-7 flex flex-col gap-3 overflow-y-auto">
        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o username..."
            value={filters.searchTerm}
            onChange={(e) => filters.setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Filters toggle */}
        <div className="flex items-center justify-between px-1 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="filter-toggle" className="text-sm cursor-pointer">
              Filtros
            </Label>
            {filters.activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.activeFilterCount}
              </Badge>
            )}
          </div>
          <Switch
            id="filter-toggle"
            checked={showFilters}
            onCheckedChange={setShowFilters}
          />
        </div>

        {/* Collapsible filters panel */}
        {showFilters && (
          <Card className="shrink-0 max-h-[280px] overflow-hidden flex flex-col">
            <CardContent className="pt-3 pb-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2">
                {/* Profile type */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Tipo de Perfil
                  </Label>
                  <Select
                    value={filters.profileType || "all"}
                    onValueChange={(v) => filters.setProfileType(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="h-9 w-full">
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

                {/* Social networks */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Redes Sociales
                  </Label>
                  <MultiSelect
                    options={platformOptions}
                    selected={filters.selectedPlatforms}
                    onChange={filters.setSelectedPlatforms}
                    placeholder="Todas las redes"
                    searchPlaceholder="Buscar red social..."
                    emptyMessage="No se encontraron."
                  />
                </div>

                {/* Services */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Formatos
                  </Label>
                  <MultiSelect
                    options={serviceOptions}
                    selected={filters.selectedServices}
                    onChange={filters.setSelectedServices}
                    placeholder="Todos los formatos"
                    searchPlaceholder="Buscar formato..."
                    emptyMessage="No se encontraron."
                  />
                </div>

                {/* Gender */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Género
                  </Label>
                  <Select
                    value={filters.selectedGender || "all"}
                    onValueChange={(v) => filters.setSelectedGender(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos los géneros" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los géneros</SelectItem>
                      {filters.filterOptions.genders.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Categories */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Categorías
                  </Label>
                  <MultiSelect
                    options={categoryOptions}
                    selected={filters.selectedCategories}
                    onChange={filters.setSelectedCategories}
                    placeholder="Todas las categorías"
                    searchPlaceholder="Buscar categoría..."
                    emptyMessage="No se encontraron."
                  />
                </div>

                {/* Country */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    País
                  </Label>
                  <Select
                    value={filters.selectedCountry || "all"}
                    onValueChange={(v) => {
                      filters.setSelectedCountry(v === "all" ? "" : v);
                      filters.setSelectedDepartment("");
                      filters.setSelectedCity("");
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filters.filterOptions.countries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Departamento
                  </Label>
                  <Select
                    value={filters.selectedDepartment || "all"}
                    onValueChange={(v) => {
                      filters.setSelectedDepartment(v === "all" ? "" : v);
                      filters.setSelectedCity("");
                    }}
                    disabled={!filters.selectedCountry}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filters.filterOptions.departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* City */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Ciudad
                  </Label>
                  <Select
                    value={filters.selectedCity || "all"}
                    onValueChange={(v) => filters.setSelectedCity(v === "all" ? "" : v)}
                    disabled={!filters.selectedDepartment}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {filters.filterOptions.cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear filters button */}
                {filters.hasActiveFilters && (
                  <div className="col-span-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={filters.clearFilters}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" /> Limpiar filtros
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile list */}
        <Card className="flex flex-col min-h-[400px]">
          <CardHeader className="py-2 shrink-0 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Perfiles Disponibles</CardTitle>
              <Badge variant="outline">{filters.filteredProfiles.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2 max-h-[500px]">
            {filters.filteredProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                <p>No se encontraron perfiles</p>
                {filters.hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={filters.clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {paginatedProfiles.map((profile) => {
                  const isSelected = selectedProfileIds.includes(profile.id);
                  const avatarUrl = getProfileAvatar(profile);

                  return (
                    <div
                      key={profile.id}
                      onClick={() => toggleProfile(profile.id)}
                      className={cn(
                        "relative flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-muted/50 border-transparent"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="shrink-0 h-4 w-4 absolute top-1.5 right-1.5"
                      />
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage src={avatarUrl || ""} alt={profile.name} />
                        <AvatarFallback className="text-xs">
                          {profile.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 pr-5">
                        <div className="font-medium text-xs truncate">{profile.name}</div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          {profile.socialAccounts.slice(0, 2).map((sa) => {
                            const followers = sa.followers || 0;
                            const reach = calculateReach(followers, reachRanges);
                            return (
                              <div
                                key={sa.id}
                                className="text-[10px] text-muted-foreground flex items-center gap-1"
                              >
                                {getPlatformIcon(sa.platform.name)}
                                <span className="truncate">@{sa.username}</span>
                                {followers > 0 && (
                                  <>
                                    <span className="text-muted-foreground/60">·</span>
                                    <span>{formatCompactNumber(followers)}</span>
                                    <span className="text-green-600">
                                      ({formatCompactNumber(reach)} alc.)
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          {totalProfiles > 0 && (
            <div className="p-2 border-t">
              <ClientPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                total={totalProfiles}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 20, 50]}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Right column: Service configuration */}
      <Card className="lg:col-span-5 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configurar Formatos</CardTitle>
            <Badge variant="default">{selectedProfileIds.length} seleccionados</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-0">
          {selectedProfiles.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecciona perfiles para configurar sus formatos
            </div>
          ) : (
            <div className="space-y-4">
              {selectedProfiles.map((profile) => {
                const config = profileConfigs.find((pc) => pc.profileId === profile.id);
                if (!config) return null;

                return (
                  <div key={profile.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarImage src={getProfileAvatar(profile) || ""} />
                          <AvatarFallback>{profile.name[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{profile.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeProfile(profile.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {config.platforms.map((platform) => {
                        const account = profile.socialAccounts.find(
                          (sa) => sa.id === platform.socialAccountId
                        );
                        const followers = account?.followers || 0;
                        const reach = calculateReach(followers, reachRanges);
                        const reachPercent = getReachPercentage(followers, reachRanges);

                        return (
                          <div
                            key={platform.socialAccountId}
                            className="bg-muted/50 rounded-lg p-2"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={platform.selected}
                                  onCheckedChange={() =>
                                    togglePlatform(profile.id, platform.socialAccountId)
                                  }
                                />
                                <div className="flex items-center gap-1">
                                  {getPlatformIcon(platform.platformName)}
                                  <span className="text-sm font-medium">
                                    {platform.platformName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    @{platform.username}
                                  </span>
                                </div>
                              </div>
                              {followers > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span>{formatCompactNumber(followers)}</span>
                                  <span className="mx-1">|</span>
                                  <span className="text-green-600">
                                    {formatCompactNumber(reach)} alc. ({reachPercent}%)
                                  </span>
                                </div>
                              )}
                            </div>

                            {platform.selected && (
                              <div className="ml-6 space-y-1">
                                {platform.services.map((service) => {
                                  const price = calculateMarkupPrice(service.basePrice, markup);
                                  return (
                                    <div
                                      key={service.profileServiceId}
                                      className="flex items-center gap-2 text-sm"
                                    >
                                      <Checkbox
                                        checked={service.quantity > 0}
                                        onCheckedChange={() =>
                                          toggleService(
                                            profile.id,
                                            platform.socialAccountId,
                                            service.profileServiceId
                                          )
                                        }
                                        className="h-4 w-4"
                                      />
                                      <span className="flex-1 text-xs">{service.serviceName}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ${formatNumber(price.toFixed(0))}
                                      </span>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={service.quantity}
                                        onChange={(e) =>
                                          updateServiceQuantity(
                                            profile.id,
                                            platform.socialAccountId,
                                            service.profileServiceId,
                                            parseInt(e.target.value, 10) || 0
                                          )
                                        }
                                        className="w-14 h-7 text-xs text-center"
                                        disabled={service.quantity === 0}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

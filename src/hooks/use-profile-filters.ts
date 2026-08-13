"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { ProfileWithServices } from "@/models/campaign";

export interface FilterOptions {
  platforms: { id: string; name: string; displayName: string }[];
  serviceTypes: { id: string; name: string; displayName: string }[];
  genders: { id: string; name: string; displayName: string }[];
  categories: { id: string; name: string }[];
  countries: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  cities: { id: string; name: string }[];
}

export interface UseProfileFiltersReturn {
  // Filter states
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  profileType: string;
  setProfileType: (value: string) => void;
  selectedPlatforms: string[];
  setSelectedPlatforms: (value: string[]) => void;
  selectedServices: string[];
  setSelectedServices: (value: string[]) => void;
  selectedGender: string;
  setSelectedGender: (value: string) => void;
  selectedCategories: string[];
  setSelectedCategories: (value: string[]) => void;
  selectedCountry: string;
  setSelectedCountry: (value: string) => void;
  selectedDepartment: string;
  setSelectedDepartment: (value: string) => void;
  selectedCity: string;
  setSelectedCity: (value: string) => void;

  // Computed values
  filterOptions: FilterOptions;
  filteredProfiles: ProfileWithServices[];
  hasActiveFilters: boolean;
  activeFilterCount: number;

  // Actions
  clearFilters: () => void;
}

export function useProfileFilters(profiles: ProfileWithServices[]): UseProfileFiltersReturn {
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [profileType, setProfileType] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // Extract available filter options from profiles in a SINGLE iteration
  const filterOptions = useMemo<FilterOptions>(() => {
    const platformMap = new Map<string, { id: string; name: string; displayName: string }>();
    const serviceMap = new Map<string, { id: string; name: string; displayName: string }>();
    const genderMap = new Map<string, { id: string; name: string; displayName: string }>();
    const categoryMap = new Map<string, { id: string; name: string }>();
    const countryMap = new Map<string, { id: string; name: string }>();
    const departmentMap = new Map<string, { id: string; name: string }>();
    const cityMap = new Map<string, { id: string; name: string }>();

    // Single iteration through all profiles
    for (const p of profiles) {
      // Gender
      if (p.gender && !genderMap.has(p.gender.id)) {
        genderMap.set(p.gender.id, p.gender);
      }

      // Country
      if (p.country && !countryMap.has(p.country.id)) {
        countryMap.set(p.country.id, { id: p.country.id, name: p.country.name });
      }

      // Department (filtered by selected country)
      if (p.department && (!selectedCountry || p.country?.id === selectedCountry)) {
        if (!departmentMap.has(p.department.id)) {
          departmentMap.set(p.department.id, { id: p.department.id, name: p.department.name });
        }
      }

      // City (filtered by selected department)
      if (p.city && (!selectedDepartment || p.department?.id === selectedDepartment)) {
        if (!cityMap.has(p.city.id)) {
          cityMap.set(p.city.id, { id: p.city.id, name: p.city.name });
        }
      }

      // Categories
      for (const pc of p.categories) {
        if (!categoryMap.has(pc.category.id)) {
          categoryMap.set(pc.category.id, pc.category);
        }
      }

      // Social accounts: platforms and services
      for (const sa of p.socialAccounts) {
        // Platform
        if (!platformMap.has(sa.platform.id)) {
          platformMap.set(sa.platform.id, sa.platform);
        }

        // Services (filtered by selected platforms)
        if (selectedPlatforms.length === 0 || selectedPlatforms.includes(sa.platform.id)) {
          for (const s of sa.services) {
            if (!serviceMap.has(s.serviceType.id)) {
              serviceMap.set(s.serviceType.id, s.serviceType);
            }
          }
        }
      }
    }

    return {
      platforms: Array.from(platformMap.values()),
      serviceTypes: Array.from(serviceMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
      genders: Array.from(genderMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
      categories: Array.from(categoryMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      countries: Array.from(countryMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      departments: Array.from(departmentMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      cities: Array.from(cityMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  }, [profiles, selectedPlatforms, selectedCountry, selectedDepartment]);

  // Clean up services that are no longer available when platforms change
  // Note: We intentionally exclude selectedServices from deps to avoid infinite loops
  // The effect only needs to run when the available options change (platforms filter)
  useEffect(() => {
    if (selectedPlatforms.length > 0) {
      const availableServiceIds = new Set(filterOptions.serviceTypes.map((s) => s.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional cleanup of invalid selections
      setSelectedServices((prev) => {
        const validServices = prev.filter((id) => availableServiceIds.has(id));
        return validServices.length !== prev.length ? validServices : prev;
      });
    }
  }, [selectedPlatforms, filterOptions.serviceTypes]);

  // Filter profiles based on current filters - SINGLE filter with all conditions
  const filteredProfiles = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    return profiles.filter((p) => {
      // Search filter (name or username)
      if (searchTerm) {
        const nameMatch = p.name.toLowerCase().includes(searchLower);
        const usernameMatch = p.socialAccounts.some((sa) =>
          sa.username.toLowerCase().includes(searchLower)
        );
        if (!nameMatch && !usernameMatch) return false;
      }

      // Profile type filter
      if (profileType) {
        if (p.type !== profileType && !(profileType !== "BOTH" && p.type === "BOTH")) {
          return false;
        }
      }

      // Platform filter
      if (selectedPlatforms.length > 0) {
        if (!p.socialAccounts.some((sa) => selectedPlatforms.includes(sa.platform.id))) {
          return false;
        }
      }

      // Services filter
      if (selectedServices.length > 0) {
        if (
          !p.socialAccounts.some((sa) =>
            sa.services.some((s) => selectedServices.includes(s.serviceType.id))
          )
        ) {
          return false;
        }
      }

      // Gender filter
      if (selectedGender && p.gender?.id !== selectedGender) {
        return false;
      }

      // Categories filter
      if (selectedCategories.length > 0) {
        if (!p.categories.some((pc) => selectedCategories.includes(pc.category.id))) {
          return false;
        }
      }

      // Country filter
      if (selectedCountry && p.country?.id !== selectedCountry) {
        return false;
      }

      // Department filter
      if (selectedDepartment && p.department?.id !== selectedDepartment) {
        return false;
      }

      // City filter
      if (selectedCity && p.city?.id !== selectedCity) {
        return false;
      }

      return true;
    });
  }, [
    profiles,
    searchTerm,
    profileType,
    selectedPlatforms,
    selectedServices,
    selectedGender,
    selectedCategories,
    selectedCountry,
    selectedDepartment,
    selectedCity,
  ]);

  // Computed values - memoized to prevent unnecessary recalculations
  const hasActiveFilters = useMemo(
    () =>
      !!profileType ||
      selectedPlatforms.length > 0 ||
      selectedServices.length > 0 ||
      !!selectedGender ||
      selectedCategories.length > 0 ||
      !!selectedCountry ||
      !!selectedDepartment ||
      !!selectedCity,
    [profileType, selectedPlatforms, selectedServices, selectedGender, selectedCategories, selectedCountry, selectedDepartment, selectedCity]
  );

  const activeFilterCount = useMemo(
    () =>
      (profileType ? 1 : 0) +
      (selectedCountry ? 1 : 0) +
      (selectedDepartment ? 1 : 0) +
      (selectedCity ? 1 : 0) +
      (selectedGender ? 1 : 0) +
      selectedPlatforms.length +
      selectedCategories.length +
      selectedServices.length,
    [profileType, selectedCountry, selectedDepartment, selectedCity, selectedGender, selectedPlatforms, selectedCategories, selectedServices]
  );

  // Actions - memoized to maintain stable reference
  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setProfileType("");
    setSelectedPlatforms([]);
    setSelectedServices([]);
    setSelectedGender("");
    setSelectedCategories([]);
    setSelectedCountry("");
    setSelectedDepartment("");
    setSelectedCity("");
  }, []);

  return {
    // Filter states
    searchTerm,
    setSearchTerm,
    profileType,
    setProfileType,
    selectedPlatforms,
    setSelectedPlatforms,
    selectedServices,
    setSelectedServices,
    selectedGender,
    setSelectedGender,
    selectedCategories,
    setSelectedCategories,
    selectedCountry,
    setSelectedCountry,
    selectedDepartment,
    setSelectedDepartment,
    selectedCity,
    setSelectedCity,

    // Computed values
    filterOptions,
    filteredProfiles,
    hasActiveFilters,
    activeFilterCount,

    // Actions
    clearFilters,
  };
}

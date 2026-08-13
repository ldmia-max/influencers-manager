export const queryKeys = {
    // =========================================================================
    // Profiles
    // =========================================================================
    profiles: {
        all: ["profiles"] as const,
        list: (filters?: Record<string, string>) =>
            [...queryKeys.profiles.all, "list", filters] as const,
        detail: (id: string) =>
            [...queryKeys.profiles.all, "detail", id] as const,
    },

    // =========================================================================
    // Campaigns
    // =========================================================================
    campaigns: {
        all: ["campaigns"] as const,
        list: (filters?: Record<string, string>) =>
            [...queryKeys.campaigns.all, "list", filters] as const,
        detail: (id: string) =>
            [...queryKeys.campaigns.all, "detail", id] as const,
        profiles: (campaignId: string) =>
            [...queryKeys.campaigns.detail(campaignId), "profiles"] as const,
    },

    // =========================================================================
    // Clients
    // =========================================================================
    clients: {
        all: ["clients"] as const,
        list: (filters?: Record<string, string>) =>
            [...queryKeys.clients.all, "list", filters] as const,
        detail: (id: string) =>
            [...queryKeys.clients.all, "detail", id] as const,
        access: (clientId: string) =>
            [...queryKeys.clients.detail(clientId), "access"] as const,
    },

    // =========================================================================
    // Categories
    // =========================================================================
    categories: {
        all: ["categories"] as const,
        list: () => [...queryKeys.categories.all, "list"] as const,
        detail: (id: string) =>
            [...queryKeys.categories.all, "detail", id] as const,
    },

    // =========================================================================
    // Platforms (public - for profile forms, filters, etc.)
    // =========================================================================
    platforms: {
        all: ["platforms"] as const,
    },

    // =========================================================================
    // Service Types (public - for profile form filtering by platform+type)
    // =========================================================================
    serviceTypes: {
        all: ["service-types"] as const,
        byPlatform: (platformId: string) =>
            [...queryKeys.serviceTypes.all, "platform", platformId] as const,
    },

    // =========================================================================
    // Locations (public endpoints)
    // =========================================================================
    locations: {
        all: ["locations"] as const,
        countries: () =>
            [...queryKeys.locations.all, "countries"] as const,
        departments: (countryId: string) =>
            [...queryKeys.locations.all, "departments", countryId] as const,
        cities: (departmentId: string) =>
            [...queryKeys.locations.all, "cities", departmentId] as const,
    },

    // =========================================================================
    // Reach Ranges
    // =========================================================================
    reachRanges: {
        all: ["reach-ranges"] as const,
    },

    // =========================================================================
    // Genders
    // =========================================================================
    genders: {
        all: ["genders"] as const,
    },

    // =========================================================================
    // Admin CRUD
    // =========================================================================
    admin: {
        all: ["admin"] as const,
        users: () => [...queryKeys.admin.all, "users"] as const,
        platforms: () => [...queryKeys.admin.all, "platforms"] as const,
        serviceTypes: () => [...queryKeys.admin.all, "service-types"] as const,
        reachRanges: () => [...queryKeys.admin.all, "reach-ranges"] as const,
        countries: () => [...queryKeys.admin.all, "countries"] as const,
        departments: (countryId?: string) =>
            countryId
                ? [...queryKeys.admin.all, "departments", countryId] as const
                : [...queryKeys.admin.all, "departments"] as const,
        cities: (departmentId?: string) =>
            departmentId
                ? [...queryKeys.admin.all, "cities", departmentId] as const
                : [...queryKeys.admin.all, "cities"] as const,
    },

    // =========================================================================
    // Approval (public token-based)
    // =========================================================================
    approval: {
        all: ["approval"] as const,
        data: (token: string) =>
            [...queryKeys.approval.all, token] as const,
    },

    // =========================================================================
    // Chat
    // =========================================================================
    chat: {
        all: ["chat"] as const,
        campaign: (campaignId: string) =>
            [...queryKeys.chat.all, "campaign", campaignId] as const,
    },
} as const;
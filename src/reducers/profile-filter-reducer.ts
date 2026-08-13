// Profile filter state and reducer

export interface FilterState {
  search: string;
  countryId: string;
  departmentId: string;
  cityId: string;
  profileType: string;
  genderId: string;
  selectedPlatforms: string[];
  selectedCategories: string[];
  selectedServices: string[];
  minPrice: string;
  maxPrice: string;
  engagementRange: [number, number];
}

export type FilterAction =
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_COUNTRY"; payload: string }
  | { type: "SET_DEPARTMENT"; payload: string }
  | { type: "SET_CITY"; payload: string }
  | { type: "SET_PROFILE_TYPE"; payload: string }
  | { type: "SET_GENDER"; payload: string }
  | { type: "TOGGLE_PLATFORM"; payload: string }
  | { type: "TOGGLE_CATEGORY"; payload: string }
  | { type: "TOGGLE_SERVICE"; payload: string }
  | { type: "SET_MIN_PRICE"; payload: string }
  | { type: "SET_MAX_PRICE"; payload: string }
  | { type: "SET_ENGAGEMENT_RANGE"; payload: [number, number] }
  | { type: "CLEAR_ALL" }
  | { type: "CLEAR_COUNTRY" }
  | { type: "CLEAR_DEPARTMENT" };

export const initialFilterState: FilterState = {
  search: "",
  countryId: "",
  departmentId: "",
  cityId: "",
  profileType: "",
  genderId: "",
  selectedPlatforms: [],
  selectedCategories: [],
  selectedServices: [],
  minPrice: "",
  maxPrice: "",
  engagementRange: [0, 10],
};

export function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, search: action.payload };
    case "SET_COUNTRY":
      return { ...state, countryId: action.payload, departmentId: "", cityId: "" };
    case "SET_DEPARTMENT":
      return { ...state, departmentId: action.payload, cityId: "" };
    case "SET_CITY":
      return { ...state, cityId: action.payload };
    case "SET_PROFILE_TYPE":
      return { ...state, profileType: action.payload };
    case "SET_GENDER":
      return { ...state, genderId: action.payload };
    case "TOGGLE_PLATFORM":
      return {
        ...state,
        selectedPlatforms: state.selectedPlatforms.includes(action.payload)
          ? state.selectedPlatforms.filter((id) => id !== action.payload)
          : [...state.selectedPlatforms, action.payload],
      };
    case "TOGGLE_CATEGORY":
      return {
        ...state,
        selectedCategories: state.selectedCategories.includes(action.payload)
          ? state.selectedCategories.filter((id) => id !== action.payload)
          : [...state.selectedCategories, action.payload],
      };
    case "TOGGLE_SERVICE":
      return {
        ...state,
        selectedServices: state.selectedServices.includes(action.payload)
          ? state.selectedServices.filter((id) => id !== action.payload)
          : [...state.selectedServices, action.payload],
      };
    case "SET_MIN_PRICE":
      return { ...state, minPrice: action.payload };
    case "SET_MAX_PRICE":
      return { ...state, maxPrice: action.payload };
    case "SET_ENGAGEMENT_RANGE":
      return { ...state, engagementRange: action.payload };
    case "CLEAR_COUNTRY":
      return { ...state, countryId: "", departmentId: "", cityId: "" };
    case "CLEAR_DEPARTMENT":
      return { ...state, departmentId: "", cityId: "" };
    case "CLEAR_ALL":
      return initialFilterState;
    default:
      return state;
  }
}

// Helper to create initial state from URL params
export function createInitialState(searchParams: URLSearchParams): FilterState {
  return {
    search: searchParams.get("search") || "",
    countryId: searchParams.get("countryId") || "",
    departmentId: searchParams.get("departmentId") || "",
    cityId: searchParams.get("cityId") || "",
    profileType: searchParams.get("type") || "",
    genderId: searchParams.get("gender") || "",
    selectedPlatforms: searchParams.get("platforms")?.split(",").filter(Boolean) || [],
    selectedCategories: searchParams.get("categories")?.split(",").filter(Boolean) || [],
    selectedServices: searchParams.get("services")?.split(",").filter(Boolean) || [],
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    engagementRange: [
      Number(searchParams.get("minEngagement")) || 0,
      Number(searchParams.get("maxEngagement")) || 10,
    ],
  };
}

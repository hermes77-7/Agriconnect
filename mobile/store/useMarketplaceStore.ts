import { create } from "zustand";
import { Listing, FilterParams } from "../types/produce";
import { listingService } from "../services/api/listingService";

interface MarketplaceStore {
  listings: Listing[];
  isLoading: boolean;
  error: string | null;
  filters: FilterParams;

  fetchListings: (filters?: FilterParams) => Promise<void>;
  setFilters: (filters: FilterParams) => void;
  clearFilters: () => void;
}

export const useMarketplaceStore = create<MarketplaceStore>((set, get) => ({
  listings: [],
  isLoading: false,
  error: null,
  filters: {},

  fetchListings: async (filters?: FilterParams) => {
    set({ isLoading: true, error: null });
    try {
      const activeFilters = filters ?? get().filters;
      const listings = await listingService.getAll(activeFilters);
      set({ listings, isLoading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.error || "Failed to load listings",
        isLoading: false,
      });
    }
  },

  setFilters: (filters) => {
    set({ filters });
    get().fetchListings(filters);
  },

  clearFilters: () => {
    set({ filters: {} });
    get().fetchListings({});
  },
}));

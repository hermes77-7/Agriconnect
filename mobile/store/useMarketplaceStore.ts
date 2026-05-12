import { create } from "zustand";

export interface ProduceItem {
  id: string;
  name: string;
  farmer: string;
  region: string;
  quantity: number;
  unit: string;
  price: number;
  image: string;
}

interface MarketplaceStore {
  produce: ProduceItem[];

  setProduce: (items: ProduceItem[]) => void;
}

export const useMarketplaceStore = create<MarketplaceStore>((set) => ({
  produce: [],

  setProduce: (items) =>
    set({
      produce: items,
    }),
}));

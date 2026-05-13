import { api } from "./client";
import { Listing, FilterParams } from "../../types/produce";

export const listingService = {
  getAll: async (filters?: FilterParams): Promise<Listing[]> => {
    const params = new URLSearchParams();
    if (filters?.crop) params.append("crop", filters.crop);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.region) params.append("region", filters.region);
    if (filters?.minPrice) params.append("minPrice", filters.minPrice);
    if (filters?.maxPrice) params.append("maxPrice", filters.maxPrice);
    if (filters?.minQty) params.append("minQty", filters.minQty);

    const query = params.toString();
    const res = await api.get(`/api/listings${query ? "?" + query : ""}`);
    return res.data;
  },

  getById: async (id: number): Promise<Listing> => {
    const res = await api.get(`/api/listings/${id}`);
    return res.data;
  },

  getFarmerListings: async (): Promise<Listing[]> => {
    const res = await api.get("/api/farmer/listings");
    return res.data;
  },

  create: async (data: {
    cropName: string;
    category: string;
    totalQuantity: number;
    minOrderQty: number;
    price: number;
    pickupLocation: string;
    region: string;
    description: string;
    imageUrl?: string;
  }): Promise<{ listingId: number }> => {
    const res = await api.post("/api/listings", data);
    return res.data;
  },

  update: async (
    id: number,
    data: Partial<{
      cropName: string;
      category: string;
      price: number;
      totalQuantity: number;
      minOrderQty: number;
      pickupLocation: string;
      region: string;
      description: string;
      status: string;
    }>,
  ): Promise<void> => {
    await api.put(`/api/listings/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/listings/${id}`);
  },

  placeOrder: async (
    listingId: number,
    quantityOrdered: number,
  ): Promise<{
    orderId: number;
    totalPrice: number;
    quantityOrdered: number;
  }> => {
    const res = await api.post("/api/orders", { listingId, quantityOrdered });
    return res.data;
  },

  cancelOrder: async (orderId: number): Promise<void> => {
    await api.delete(`/api/orders/${orderId}`);
  },
};

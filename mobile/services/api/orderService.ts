import { api } from "./client";
import { Order } from "../../types/produce";

export const orderService = {
  getMyOrders: async (): Promise<Order[]> => {
    const res = await api.get("/api/orders/my");
    return res.data;
  },

  getIncomingOrders: async (): Promise<Order[]> => {
    const res = await api.get("/api/orders/incoming");
    return res.data;
  },

  getPendingCount: async (): Promise<number> => {
    const res = await api.get("/api/orders/pending-count");
    return res.data.count;
  },

  accept: async (orderId: number): Promise<void> => {
    await api.put(`/api/orders/${orderId}/accept`);
  },

  reject: async (orderId: number): Promise<void> => {
    await api.put(`/api/orders/${orderId}/reject`);
  },

  cancel: async (orderId: number): Promise<void> => {
    await api.put(`/api/orders/${orderId}/cancel`);
  },

  complete: async (orderId: number): Promise<void> => {
    await api.put(`/api/orders/${orderId}/complete`);
  },
};

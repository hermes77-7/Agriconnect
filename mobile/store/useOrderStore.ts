import { create } from "zustand";
import { Order } from "../types/produce";
import { orderService } from "../services/api/orderService";

interface OrderStore {
  myOrders: Order[];
  incomingOrders: Order[];
  pendingCount: number;
  isLoading: boolean;

  fetchMyOrders: () => Promise<void>;
  fetchIncomingOrders: () => Promise<void>;
  fetchPendingCount: () => Promise<void>;
  acceptOrder: (id: number) => Promise<void>;
  rejectOrder: (id: number) => Promise<void>;
  cancelOrder: (id: number) => Promise<void>;
  completeOrder: (id: number) => Promise<void>;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  myOrders: [],
  incomingOrders: [],
  pendingCount: 0,
  isLoading: false,

  fetchMyOrders: async () => {
    set({ isLoading: true });
    try {
      const orders = await orderService.getMyOrders();
      set({ myOrders: orders });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchIncomingOrders: async () => {
    set({ isLoading: true });
    try {
      const orders = await orderService.getIncomingOrders();
      set({ incomingOrders: orders });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPendingCount: async () => {
    try {
      const count = await orderService.getPendingCount();
      set({ pendingCount: count });
    } catch {}
  },

  acceptOrder: async (id) => {
    await orderService.accept(id);
    await get().fetchIncomingOrders();
    await get().fetchPendingCount();
  },

  rejectOrder: async (id) => {
    await orderService.reject(id);
    await get().fetchIncomingOrders();
    await get().fetchPendingCount();
  },

  cancelOrder: async (id) => {
    await orderService.cancel(id);
    await get().fetchMyOrders();
    await get().fetchIncomingOrders();
  },

  completeOrder: async (id) => {
    await orderService.complete(id);
    await get().fetchMyOrders();
    await get().fetchIncomingOrders();
  },
}));

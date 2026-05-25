import { api } from "./client";
import { TransportJob, TransportCheck } from "../../types/produce";

export const transportService = {
  getAvailableJobs: async (): Promise<TransportJob[]> => {
    const res = await api.get("/api/transport/available");
    return res.data;
  },

  getMyJobs: async (): Promise<TransportJob[]> => {
    const res = await api.get("/api/transport/my");
    return res.data;
  },

  checkOrderTransport: async (orderId: number): Promise<TransportCheck> => {
    const res = await api.get(`/api/transport/order/${orderId}`);
    return res.data;
  },

  createJob: async (data: {
    orderId: number;
    pickupLocation: string;
    destination: string;
    cargoDesc?: string;
    transportDate?: string;
    estimatedWeight?: number;
    price?: number;
    specialInstructions?: string;
  }): Promise<{ jobId: number }> => {
    const res = await api.post("/api/transport", data);
    return res.data;
  },

  acceptJob: async (jobId: number): Promise<void> => {
    await api.put(`/api/transport/${jobId}/accept`);
  },

  updateStatus: async (
    jobId: number,
    status: "In_Transit" | "Delivered",
  ): Promise<void> => {
    await api.put(`/api/transport/${jobId}/status`, { status });
  },
};

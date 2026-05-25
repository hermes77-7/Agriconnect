import { create } from "zustand";
import { TransportJob } from "../types/produce";
import { transportService } from "../services/api/transportService";

interface TransportStore {
  availableJobs: TransportJob[];
  myJobs: TransportJob[];
  isLoading: boolean;

  fetchAvailableJobs: () => Promise<void>;
  fetchMyJobs: () => Promise<void>;
  acceptJob: (jobId: number) => Promise<void>;
  updateStatus: (
    jobId: number,
    status: "In_Transit" | "Delivered",
  ) => Promise<void>;
}

export const useTransportStore = create<TransportStore>((set, get) => ({
  availableJobs: [],
  myJobs: [],
  isLoading: false,

  fetchAvailableJobs: async () => {
    set({ isLoading: true });
    try {
      const jobs = await transportService.getAvailableJobs();
      set({ availableJobs: jobs });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMyJobs: async () => {
    set({ isLoading: true });
    try {
      const jobs = await transportService.getMyJobs();
      set({ myJobs: jobs });
    } finally {
      set({ isLoading: false });
    }
  },

  acceptJob: async (jobId) => {
    await transportService.acceptJob(jobId);
    await get().fetchAvailableJobs();
    await get().fetchMyJobs();
  },

  updateStatus: async (jobId, status) => {
    await transportService.updateStatus(jobId, status);
    await get().fetchMyJobs();
  },
}));

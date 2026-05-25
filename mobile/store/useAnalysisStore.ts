import { create } from "zustand";
import { CropAnalysis } from "../types/produce";
import { analysisService } from "../services/api/analysisService";

interface AnalysisStore {
  history: CropAnalysis[];
  isLoading: boolean;
  isAnalyzing: boolean;
  lastResult: CropAnalysis | null;

  analyze: (imageUri: string, cropName: string) => Promise<CropAnalysis>;
  fetchHistory: () => Promise<void>;
  clearLastResult: () => void;
  clearHistory: () => Promise<void>;
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  history: [],
  isLoading: false,
  isAnalyzing: false,
  lastResult: null,

  analyze: async (imageUri, cropName) => {
    set({ isAnalyzing: true });
    try {
      const result = await analysisService.analyze(imageUri, cropName);
      set((state) => ({
        lastResult: result,
        history: [result, ...state.history],
        isAnalyzing: false,
      }));
      return result;
    } catch (e) {
      set({ isAnalyzing: false });
      throw e;
    }
  },

  fetchHistory: async () => {
    set({ isLoading: true });
    try {
      const history = await analysisService.getHistory();
      set({ history });
    } finally {
      set({ isLoading: false });
    }
  },

  clearLastResult: () => set({ lastResult: null }),

  clearHistory: async () => {
    await analysisService.clearHistory();
    set({ history: [], lastResult: null });
  },
}));

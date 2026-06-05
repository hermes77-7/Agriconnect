import { create } from "zustand";
import { EducationArticle, EducationCategory } from "../types/produce";
import { educationService } from "../services/api/educationService";

interface EducationStore {
  articles: EducationArticle[];
  isLoading: boolean;
  selectedCategory: EducationCategory | "";

  fetchArticles: (filters?: {
    category?: EducationCategory | "";
    search?: string;
  }) => Promise<void>;
  setCategory: (cat: EducationCategory | "") => void;
  deleteArticle: (id: number) => Promise<void>;
}

export const useEducationStore = create<EducationStore>((set, get) => ({
  articles: [],
  isLoading: false,
  selectedCategory: "",

  fetchArticles: async (filters) => {
    set({ isLoading: true });
    try {
      const articles = await educationService.getAll(filters);
      set({ articles });
    } finally {
      set({ isLoading: false });
    }
  },

  setCategory: (cat) => {
    set({ selectedCategory: cat });
    get().fetchArticles({ category: cat });
  },

  deleteArticle: async (id) => {
    await educationService.delete(id);
    set((state) => ({
      articles: state.articles.filter((a) => a.id !== id),
    }));
  },
}));

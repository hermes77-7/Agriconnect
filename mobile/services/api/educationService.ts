import { api } from "./client";
import { EducationArticle, EducationCategory } from "../../types/produce";

export const educationService = {
  getAll: async (filters?: {
    category?: EducationCategory | "";
    search?: string;
  }): Promise<EducationArticle[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.search) params.append("search", filters.search);
    const query = params.toString();
    const res = await api.get(`/api/education${query ? "?" + query : ""}`);
    return res.data;
  },

  getById: async (id: number): Promise<EducationArticle> => {
    const res = await api.get(`/api/education/${id}`);
    return res.data;
  },

  create: async (data: {
    title: string;
    category: EducationCategory;
    coverImage?: string;
    sections: { heading: string; body: string }[];
    isPublished: boolean;
  }): Promise<{ articleId: number }> => {
    const res = await api.post("/api/education", data);
    return res.data;
  },

  update: async (
    id: number,
    data: Partial<{
      title: string;
      category: EducationCategory;
      coverImage: string;
      sections: { heading: string; body: string }[];
      isPublished: boolean;
    }>,
  ): Promise<void> => {
    await api.put(`/api/education/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/education/${id}`);
  },
};

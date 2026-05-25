import { api } from "./client";
import { CropAnalysis } from "../../types/produce";

export const analysisService = {
  analyze: async (
    imageUri: string,
    cropName: string,
  ): Promise<CropAnalysis> => {
    const formData = new FormData();

    // Append image
    const filename = imageUri.split("/").pop() ?? "crop.jpg";
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";

    formData.append("image", {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as any);

    formData.append("cropName", cropName);

    const res = await api.post("/api/analysis", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000, // 30s for image upload
    });

    return res.data;
  },

  getHistory: async (): Promise<CropAnalysis[]> => {
    const res = await api.get("/api/analysis");
    return res.data;
  },

  getById: async (id: number): Promise<CropAnalysis> => {
    const res = await api.get(`/api/analysis/${id}`);
    return res.data;
  },

  clearHistory: async (): Promise<void> => {
    await api.delete("/api/analysis");
  },

  getImageUrl: (imagePath: string, baseUrl: string): string => {
    return `${baseUrl}/api/uploads/${imagePath}`;
  },
};

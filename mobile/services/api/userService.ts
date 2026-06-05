import { api } from "./client";
import { AuthUser } from "../../store/useAuthStore";

export const userService = {
  updateProfile: async (data: {
    name: string;
    phone: string;
  }): Promise<AuthUser> => {
    const res = await api.put("/api/user/profile", data);
    return res.data.user;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await api.put("/api/user/password", data);
  },

  upgradeRole: async (role: "FARMER" | "TRANSPORTER"): Promise<AuthUser> => {
    const res = await api.put("/api/user/role", { role });
    return res.data.user;
  },

  getOrderHistory: async (): Promise<any[]> => {
    const res = await api.get("/api/user/order-history");
    return res.data;
  },

  getDeliveryHistory: async (): Promise<any[]> => {
    const res = await api.get("/api/user/delivery-history");
    return res.data;
  },
};

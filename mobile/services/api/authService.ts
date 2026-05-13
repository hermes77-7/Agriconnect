import { api } from "./client";
import { AuthUser, UserType } from "../../store/useAuthStore";

interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  type: UserType;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authService = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await api.post("/api/auth/register", payload);
    return res.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post("/api/auth/login", { email, password });
    return res.data;
  },
};

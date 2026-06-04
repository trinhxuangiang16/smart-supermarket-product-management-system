import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { api, clearAuthTokens, getRefreshToken } from "../../lib/api-client";
type User = { id: string; email: string; role: string; name: string };
const AuthCtx = createContext<{ user: User | null; isLoading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }>({ user: null, isLoading: true, login: async () => {}, logout: async () => {} });
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setIsLoading(false);
      return;
    }
    api<{ data: User }>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => clearAuthTokens())
      .finally(() => setIsLoading(false));
  }, []);
  const login = async (email: string, password: string) => {
    const r = await api<{ data: { token: string; refreshToken: string; user: User } }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    localStorage.setItem("token", r.data.token);
    localStorage.setItem("refreshToken", r.data.refreshToken);
    setUser(r.data.user);
  };
  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
      }
    } finally {
      clearAuthTokens();
      setUser(null);
    }
  };
  return <AuthCtx.Provider value={{ user, isLoading, login, logout }}>{children}</AuthCtx.Provider>;
};
export const useAuth = () => useContext(AuthCtx);

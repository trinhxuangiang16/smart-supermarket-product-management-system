const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
export const getToken = () => localStorage.getItem("token");
export const getRefreshToken = () => localStorage.getItem("refreshToken");
export const clearAuthTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
};

const setAuthTokens = (token: string, refreshToken: string) => {
  localStorage.setItem("token", token);
  localStorage.setItem("refreshToken", refreshToken);
};

let refreshPromise: Promise<boolean> | null = null;
const tryRefreshToken = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const nextToken = data?.data?.token as string | undefined;
    const nextRefreshToken = data?.data?.refreshToken as string | undefined;
    if (!nextToken || !nextRefreshToken) return false;
    setAuthTokens(nextToken, nextRefreshToken);
    return true;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
};

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const execute = async () => fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: getToken() ? `Bearer ${getToken()}` : "", ...(init?.headers ?? {}) },
  });

  let res = await execute();
  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) res = await execute();
  }

  const data = await res.json();
  if (res.status === 401) {
    clearAuthTokens();
    if (window.location.pathname !== "/login") window.location.assign("/login");
  }
  if (!res.ok) throw new Error(data?.error?.message ?? "Request failed");
  return data;
};

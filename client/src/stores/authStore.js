import { create } from "zustand";

const persisted =
  typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("retailer.auth") || "null") : null;

export const useAuthStore = create((set) => ({
  user: persisted?.user || null,
  token: persisted?.token || null,
  setSession: ({ user, token }) =>
    set(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("retailer.auth", JSON.stringify({ user, token }));
      }
      return { user, token };
    }),
  logout: () =>
    set(() => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("retailer.auth");
      }
      return { user: null, token: null };
    }),
}));

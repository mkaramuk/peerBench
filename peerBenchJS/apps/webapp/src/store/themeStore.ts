import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>(() => ({
  theme: () => {
    if (typeof window === "undefined") {
      return "light";
    }

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme as Theme;
    }
    return "light";
  },
  setTheme: (theme) => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem("theme", theme);
  },
  toggleTheme: () => {
    if (typeof window === "undefined") {
      return;
    }

    const currentTheme = localStorage.getItem("theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    localStorage.setItem("theme", newTheme);
  },
}));

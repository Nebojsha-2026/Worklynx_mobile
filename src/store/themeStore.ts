import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyColorTheme } from '@/lib/theme';

const THEME_KEY = '@worklynx_theme';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,

  toggleTheme: () => {
    const next = !get().isDark;
    set({ isDark: next });
    applyColorTheme(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
  },

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      const isDark = saved !== 'light';
      set({ isDark });
      applyColorTheme(isDark);
    } catch {
      // default to dark
    }
  },
}));

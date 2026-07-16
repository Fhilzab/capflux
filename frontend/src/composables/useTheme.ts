import { useThemeStore } from '@/stores/themeStore';

export type ThemeMode = 'light' | 'dark';

/**
 * useTheme - Typed composable for Capstone Enterprise Minimalism Design System
 * Wraps the existing themeStore (DO NOT EDIT) to provide a stable API
 * for all components to consume.
 */
export function useTheme() {
  const store = useThemeStore();

  const init = (): void => {
    store.initTheme();
  };

  const toggle = (): void => {
    store.toggleTheme();
  };

  const setMode = (mode: ThemeMode): void => {
    store.setTheme(mode);
  };

  const isDark = (): boolean => {
    return store.mode === 'dark';
  };

  const isLight = (): boolean => {
    return store.mode === 'light';
  };

  return {
    // Expose raw state (reactive)
    mode: store.mode,
    initialized: store.initialized,

    // Methods
    init,
    toggle,
    setMode,

    // Computed helpers
    isDark,
    isLight,
  };
}
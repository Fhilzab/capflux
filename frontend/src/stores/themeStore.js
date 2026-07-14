import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref('dark'); // 'dark' or 'light'
  const initialized = ref(false);

  // Initialize theme from localStorage or system preference
  const initTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      mode.value = saved;
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      mode.value = prefersDark ? 'dark' : 'light';
    }
    applyTheme();
    initialized.value = true;
  };

  // Apply theme to document
  const applyTheme = () => {
    const html = document.documentElement;
    if (mode.value === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    mode.value = mode.value === 'dark' ? 'light' : 'dark';
  };

  // Set theme directly
  const setTheme = (newMode) => {
    if (newMode === 'dark' || newMode === 'light') {
      mode.value = newMode;
    }
  };

  // Watch for changes and persist
  watch(mode, (newMode) => {
    if (initialized.value) {
      localStorage.setItem('theme', newMode);
      applyTheme();
    }
  });

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          mode.value = e.matches ? 'dark' : 'light';
        }
      });
  }

  return {
    mode,
    initialized,
    initTheme,
    toggleTheme,
    setTheme,
  };
});
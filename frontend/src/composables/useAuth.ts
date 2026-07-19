import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { sanitizeAuthError } from '../utils/error-handler';

/**
 * Central auth composable for Capstone
 * Provides offline detection, typed auth wrappers, and error sanitization
 */

// Shared offline state (singleton pattern)
const isOfflineState = ref(false);
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;

export function useAuth() {
  const authStore = useAuthStore();

  // Set up global offline listeners once
  if (!onlineHandler || !offlineHandler) {
    onlineHandler = () => { isOfflineState.value = false; };
    offlineHandler = () => { isOfflineState.value = true; };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
    }
  }

  // Initialize offline state on mount
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    isOfflineState.value = !navigator.onLine;
  }

  // Typed wrapper for signIn
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (isOfflineState.value) {
      return { success: false, error: 'You are currently offline. Internet access is required to sign in.' };
    }

    const result = await authStore.signIn({ email, password });
    
    if (!result) {
      return { success: false, error: authStore.error ? sanitizeAuthError({ message: authStore.error }) : 'Authentication failed' };
    }
    
    return { success: true };
  };

  // Typed wrapper for signUp
  const signUp = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (isOfflineState.value) {
      return { success: false, error: 'You are currently offline. Internet access is required to create an account.' };
    }

    const result = await authStore.signUp({ email, password });
    
    if (result?.error) {
      return { success: false, error: sanitizeAuthError(result.error) };
    }
    
    return { success: true };
  };

  // Typed wrapper for signOut
  const signOut = async (): Promise<void> => {
    await authStore.signOut();
  };

  return {
    // Offline state
    isOffline: computed(() => isOfflineState.value),
    isOnline: computed(() => !isOfflineState.value),
    
    // Auth state from store
    user: computed(() => authStore.user),
    session: computed(() => authStore.session),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    loading: computed(() => authStore.loading),
    error: computed(() => authStore.error),
    schoolId: computed(() => authStore.schoolId),
    role: computed(() => authStore.role),
    adminStatus: computed(() => authStore.adminStatus),
    isSchoolSetupComplete: computed(() => authStore.isSchoolSetupComplete),
    emailVerified: computed(() => authStore.emailVerified),
    
    // Auth actions
    signIn,
    signUp,
    signOut,
  };
}
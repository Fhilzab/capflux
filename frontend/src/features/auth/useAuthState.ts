import { ref, computed } from 'vue';

// Auth state types
export type AuthState = 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password';

// Animation direction for transitions
export type TransitionDirection = 'forward' | 'backward';

const state = ref<AuthState>('login');
const direction = ref<TransitionDirection>('forward');

export function useAuthState() {
  const current = computed(() => state.value);

  const transition = (newState: AuthState) => {
    // Determine animation direction based on whether we're going forward or back
    // Login <-> Signup: switch without animation
    // All other transitions: forward
    if (newState === 'login' || newState === 'signup') {
      // Toggle between login/signup - no direction animation needed
      state.value = newState;
    } else {
      // Forward transitions for other states (verify-email, forgot-password, reset-password)
      direction.value = 'forward';
      state.value = newState;
    }
  };

  const goBack = () => {
    // Default back behavior: go to login
    state.value = 'login';
    direction.value = 'backward';
  };

  return {
    state: current,
    direction,
    transition,
    goBack,
  };
}

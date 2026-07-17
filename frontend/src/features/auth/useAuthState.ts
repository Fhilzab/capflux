import { ref, computed } from 'vue';

// Auth state types
export type AuthState = 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password';

// Animation direction for transitions
export type TransitionDirection = 'forward' | 'backward';

const state = ref<AuthState>('login');
const direction = ref<TransitionDirection>('forward');

// State history for back navigation
const stateHistory = ref<AuthState[]>(['login']);

export function useAuthState() {
  const current = computed(() => state.value);

  const transition = (newState: AuthState) => {
    // Determine animation direction
    const currentIndex = stateHistory.value.indexOf(state.value);
    const newIndex = stateHistory.value.indexOf(newState);

    if (newIndex === -1) {
      // New state, add to history
      stateHistory.value.push(newState);
      direction.value = 'forward';
    } else if (newIndex < currentIndex) {
      // Going back
      direction.value = 'backward';
      stateHistory.value = stateHistory.value.slice(0, newIndex + 1);
    } else {
      // Going forward to existing state
      direction.value = 'forward';
      stateHistory.value = stateHistory.value.slice(0, currentIndex + 1);
      stateHistory.value.push(newState);
    }

    state.value = newState;
  };

  const goBack = () => {
    if (stateHistory.value.length > 1) {
      stateHistory.value.pop();
      state.value = stateHistory.value[stateHistory.value.length - 1];
      direction.value = 'backward';
    }
  };

  return {
    state: current,
    direction,
    transition,
    goBack,
  };
}
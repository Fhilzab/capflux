/**
 * AuthState — canonical source of truth for the authentication flow.
 * The route query parameter (?mode=...) drives the current state;
 * there is no competing component-local state.
 */

export type AuthState = 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password';

/** The transition payload emitted by child forms to switch the route mode. */
export type AuthStateTransition = (newState: AuthState) => void;

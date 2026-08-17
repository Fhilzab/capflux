/**
 * Authentication Module Barrel Exports
 * Provides clean imports for auth-related types and classes
 */

export { AuthProvider, type AuthStateChangeListener, type AuthSubscription } from './AuthProvider';
export { AuthKitProvider } from './AuthKitProvider';
export { SupabaseAuthProvider } from './SupabaseAuthProvider';
export { mapProviderError, getErrorMessage } from './AuthError';
export { AuthService } from './AuthService';
export type { 
  AuthRole, 
  User, 
  Session, 
  AuthProviderConfig, 
  AuthResult, 
  AuthErrorCode,
  AuthErrorData 
} from './types';
/**
 * Authentication Type Definitions
 * Used across AuthProvider, AuthKitProvider, and AuthService
 */

/**
 * Supported authentication roles
 * For MVP: Only OWNER and ADMIN supported
 */
export type AuthRole = 'OWNER' | 'ADMIN';

/**
 * User model returned from auth provider
 */
export interface User {
  id: string;
  email: string;
  role?: AuthRole;
  name?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Session model containing auth tokens and metadata
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number; // Unix timestamp in seconds
  user?: User;
}

/**
 * Configuration for auth provider
 */
export interface AuthProviderConfig {
  clientId?: string;
  domain?: string;
  redirectUri?: string;
}

/**
 * Auth error codes for centralized error handling
 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'USER_ALREADY_EXISTS'
  | 'DUPLICATE_ACCOUNT'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'WEAK_PASSWORD'
  | 'BREACHED_PASSWORD'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

/**
 * Auth error with friendly message mapping
 */
export interface AuthErrorData {
  code: AuthErrorCode;
  message: string;
  raw?: unknown;
}

/**
 * Generic result type for auth operations
 * Never exposes raw provider errors to consumers
 */
export interface AuthResult<T> {
  data: T | null;
  error: AuthErrorData | null;
}
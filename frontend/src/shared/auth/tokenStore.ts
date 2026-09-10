/**
 * tokenStore — In-memory token storage for WorkOS AuthKit.
 *
 * This module provides a single source of truth for the WorkOS access/refresh tokens
 * used by both the AuthKitProvider and the API client.
 *
 * Tokens are stored ONLY in memory (module-level variables), never in localStorage,
 * sessionStorage, or cookies. This prevents token leakage and ensures that tokens
 * are cleared when the browser tab is closed.
 */

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;
let memoryExpiresAt: number | null = null; // Unix timestamp in seconds

/**
 * Store tokens in memory.
 */
export function setMemoryTokens(accessToken: string, refreshToken: string, expiresAt?: number): void {
  memoryAccessToken = accessToken;
  memoryRefreshToken = refreshToken;
  memoryExpiresAt = expiresAt ?? null;
}

/**
 * Clear all tokens from memory.
 */
export function clearMemoryTokens(): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  memoryExpiresAt = null;
}

/**
 * Get the current access token from memory.
 */
export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

/**
 * Get the current refresh token from memory.
 */
export function getMemoryRefreshToken(): string | null {
  return memoryRefreshToken;
}

/**
 * Get the token expiration time (Unix timestamp in seconds).
 */
export function getMemoryExpiresAt(): number | null {
  return memoryExpiresAt;
}

/**
 * Check if the current access token is expired or not set.
 */
export function isTokenExpired(): boolean {
  if (!memoryExpiresAt) return true;
  return Date.now() >= memoryExpiresAt * 1000; // expiresAt is in seconds
}

/**
 * Check if there is a valid access token in memory.
 */
export function hasValidToken(): boolean {
  return !!memoryAccessToken && !isTokenExpired();
}
/**
 * Shared API error categorization for the CAPFLUX frontend data plane.
 *
 * The apiClient axios interceptor enriches every rejected request with:
 *   - status        : HTTP status code (when a response was received)
 *   - isNetworkError: true when no response arrived (offline, CORS, wrong URL, timeout)
 *   - backendMessage: the user-facing message from the backend JSON body
 *   - code          : 'SESSION_EXPIRED' for 401
 *
 * These helpers preserve HTTP-status information through the API helper layer
 * so that 401/403/404/500 errors are NOT masked as generic "Connection problem".
 */
export type ApiErrorCategory =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'ONBOARDING_ERROR';

export interface CategorizedError {
  category: ApiErrorCategory;
  message: string;
  status?: number;
}

interface RawApiError {
  response?: { status?: number; data?: { error?: string; message?: string } };
  message?: string;
  code?: string;
  isNetworkError?: boolean;
  status?: number;
  backendMessage?: string;
}

/** User-facing short messages mapped from error categories. */
export const CATEGORY_MESSAGES: Record<ApiErrorCategory, string> = {
  NETWORK_ERROR: 'Connection problem',
  AUTH_ERROR: 'Authentication required',
  SERVER_ERROR: 'CAPFLUX is temporarily unavailable',
  VALIDATION_ERROR: 'Some information needs attention',
  ONBOARDING_ERROR: 'Unable to load setup status',
};

/** Contextual sub-text for error banners. */
export const CATEGORY_DESCRIPTIONS: Record<ApiErrorCategory, string> = {
  NETWORK_ERROR:
    "We couldn't reach CAPFLUX right now. Check your internet connection and try again.",
  AUTH_ERROR: 'Your session has expired. Please sign in again.',
  SERVER_ERROR:
    'Our servers are temporarily unavailable. Please try again in a few minutes.',
  VALIDATION_ERROR:
    'Some setup information needs attention before you can continue.',
  ONBOARDING_ERROR:
    "We couldn't load your setup progress. Your account is still safe — please try again.",
};

/**
 * Categorize a raw API error (axios-enhanced or plain) into a category +
 * user-friendly message. Never exposes raw Axios errors, stack traces, or
 * backend SQL payloads to the UI layer.
 */
export function categorizeApiError(
  err: unknown,
  fallback: string,
): CategorizedError {
  const e = (err ?? {}) as RawApiError;

  // Network-level failure: no response received at all (offline, CORS,
  // wrong backend URL/port, DNS failure, timeout).
  if (e.isNetworkError) {
    return { category: 'NETWORK_ERROR', message: CATEGORY_MESSAGES.NETWORK_ERROR };
  }

  const status = e.status ?? e.response?.status;
  const backendMessage =
    e.backendMessage || e.response?.data?.error || e.response?.data?.message;

  if (status !== undefined) {
    // Auth failures — always show the safe default (never leak backend text).
    if (status === 401 || status === 403) {
      return { category: 'AUTH_ERROR', message: CATEGORY_MESSAGES.AUTH_ERROR, status };
    }
    // Validation — use the backend's user-facing message when available.
    if (status === 400 || status === 422) {
      return {
        category: 'VALIDATION_ERROR',
        message: backendMessage || CATEGORY_MESSAGES.VALIDATION_ERROR,
        status,
      };
    }
    // Server errors and 404 (endpoint/resource missing).
    if (status === 404 || status >= 500) {
      return { category: 'SERVER_ERROR', message: CATEGORY_MESSAGES.SERVER_ERROR, status };
    }
    // Other HTTP errors (409, etc.)
    return {
      category: 'ONBOARDING_ERROR',
      message: backendMessage || CATEGORY_MESSAGES.ONBOARDING_ERROR,
      status,
    };
  }

  // No HTTP response — genuine network-level failure.
  if (!e.response) {
    if (e.code === 'ERR_CANCELED' || e.code === 'ECONNABORTED') {
      return { category: 'NETWORK_ERROR', message: CATEGORY_MESSAGES.NETWORK_ERROR };
    }
    if (
      e.message?.toLowerCase().includes('timeout') ||
      e.message?.toLowerCase().includes('network')
    ) {
      return { category: 'NETWORK_ERROR', message: CATEGORY_MESSAGES.NETWORK_ERROR };
    }
  }

  return { category: 'ONBOARDING_ERROR', message: e.message || fallback };
}

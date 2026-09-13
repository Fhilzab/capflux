/**
 * apiClient — reusable frontend API client for the CAPFLUX backend.
 *
 * All domain data now flows:
 *   Vue -> Pinia -> Axios /api/* -> Express requireAuthWorkOS -> domain service
 *   -> Supabase service-role client
 *
 * Authentication modes:
 *   - WorkOS (primary): WorkOS access token attached as Authorization: Bearer <WORKOS_ACCESS_TOKEN>
 *     The backend validates it via WorkOS JWKS and resolves CAPFLUX UUID via user_identity_links.
 *   - Supabase Auth (fallback/legacy): Supabase access token attached as Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
 *     The backend validates it via supabase.auth.getUser(token).
 *   - Demo (sandbox): Demo session token attached as Authorization: Bearer <DEMO_SESSION_TOKEN>
 *     The backend validates it via DemoAuthService and resolves the demo persona.
 *
 * The frontend NEVER sends a user id or credential in request bodies or
 * custom headers. Identity is always derived from the validated JWT.
 *
 * Transport modes:
 *   - remote (default): Normal network requests to VITE_API_BASE_URL
 *   - simulator: In-browser SandboxApiServer (sandbox mode only)
 */
import axios, { InternalAxiosRequestConfig } from 'axios';
import { supabase, hasSupabaseConfig } from '@/lib/supabase';
import { runtimeEnvironment } from '@/shared/environment/runtimeEnvironment';
import { sandboxAxiosAdapter } from '@/sandbox/api/axiosAdapter';
import { getMemoryAccessToken, hasValidToken } from '@/shared/auth/tokenStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Transport selection: remote (default) vs simulator (explicit opt-in).
// The simulator is ONLY installed when VITE_API_TRANSPORT=simulator AND
// VITE_CAPFLUX_MODE=sandbox. This allows a deployed sandbox to use the
// remote Render backend while keeping the simulator available for development.
if (runtimeEnvironment.transport === 'simulator') {
  http.defaults.adapter = sandboxAxiosAdapter;
}

// Attach authentication token to every request.
// Priority: WorkOS token (primary) > Demo token (sandbox) > Supabase token (fallback)
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // 1. Try WorkOS token first (primary auth mode)
  if (hasValidToken()) {
    const workosToken = getMemoryAccessToken();
    if (workosToken && config.headers) {
      config.headers.Authorization = `Bearer ${workosToken}`;
      return config;
    }
  }

  // 2. Try demo session token (sandbox mode)
  if (runtimeEnvironment.isSandbox) {
    try {
      const raw = localStorage.getItem('capflux_demo_session');
      if (raw) {
        const parsed = JSON.parse(raw) as { token?: string; expiresAt?: number };
        if (parsed.token && parsed.expiresAt && parsed.expiresAt * 1000 > Date.now()) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
          return config;
        }
      }
    } catch {
      // Session storage unavailable or invalid; continue to next auth method.
    }
  }

  // 3. Fall back to Supabase token (legacy/fallback mode)
  if (hasSupabaseConfig) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && config.headers) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch {
      // Session may be absent; requests will be rejected (401) by the backend.
    }
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enrich the ORIGINAL axios error rather than replacing it with `new Error()`.
    // The previous implementation did `new Error(message)` which discarded
    // `error.response`, causing every HTTP status (401/403/404/500) to be
    // misclassified downstream as a NETWORK_ERROR ("Connection problem").
    const status = error.response?.status;
    const backendMessage = error.response?.data?.error || error.response?.data?.message;

    if (backendMessage) {
      error.message = backendMessage;
    }
    error.status = status;
    error.backendMessage = backendMessage;
    error.isNetworkError = !error.response;

    // 401 from a domain call typically means the session expired or token is invalid.
    if (status === 401) {
      error.code = 'SESSION_EXPIRED';
    }

    return Promise.reject(error);
  },
);

export const apiClient = {
  http,
  baseUrl: API_BASE_URL,
};

export default apiClient;
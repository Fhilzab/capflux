/**
 * apiClient — reusable frontend API client for the CAPFLUX backend.
 *
 * All domain data now flows:
 *   Vue -> Pinia -> Axios /api/* -> Express requireAuth -> domain service
 *   -> Supabase service-role client
 *
 * Authentication: the Supabase access token is attached to each request as
 *   Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
 * The backend validates it via supabase.auth.getUser(token).
 *
 * The frontend NEVER sends a user id or credential in request bodies or
 * custom headers. Identity is always derived from the validated JWT.
 */
import axios from 'axios';
import { supabase, hasSupabaseConfig } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Supabase access token to every request.
http.interceptors.request.use(async (config) => {
  if (!hasSupabaseConfig) return config;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // Session may be absent; requests will be rejected (401) by the backend.
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

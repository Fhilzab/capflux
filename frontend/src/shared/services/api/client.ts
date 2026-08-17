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
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message || 'Network request failed';
    const apiError = new Error(message);
    (apiError as Error & { status?: number }).status = status;
    // 401 from a domain call typically means the session expired or token is invalid.
    if (status === 401) {
      (apiError as Error & { code?: string }).code = 'SESSION_EXPIRED';
    }
    return Promise.reject(apiError);
  },
);

export const apiClient = {
  http,
  baseUrl: API_BASE_URL,
};

export default apiClient;

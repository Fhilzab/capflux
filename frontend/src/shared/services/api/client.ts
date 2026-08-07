/**
 * apiClient — reusable frontend API client for the CAPFLUX backend.
 *
 * All domain data now flows:
 *   Vue -> Pinia -> Axios /api/* -> Express requireAuth -> domain service
 *   -> Supabase service-role client
 *
 * Authentication is carried by the HttpOnly workos_session cookie (set by the
 * backend). The frontend NEVER sends a user id or credential as a bearer
 * token; it never reads the cookie.
 *
 * For non-browser/API contexts a Bearer sealed session may be used, but the
 * browser client relies on cookies only.
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // Cookies (HttpOnly workos_session) are sent on same-origin/cross-origin
  // requests when the backend CORS allowlist includes this origin.
  withCredentials: true,
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message || 'Network request failed';
    const apiError = new Error(message);
    (apiError as Error & { status?: number }).status = status;
    // 401 from a domain call typically means the session expired.
    if (status === 401) {
      (apiError as Error & { code?: string }).code = 'SESSION_EXPIRED';
    }
    return Promise.reject(apiError);
  }
);

export const apiClient = {
  http,
  baseUrl: API_BASE_URL,
};

export default apiClient;

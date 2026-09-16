/**
 * AuthKitProvider — WorkOS AuthKit authentication provider.
 *
 * Uses WorkOS AuthKit hosted UI for authentication.
 * After authentication, stores the WorkOS access token in memory and sends it
 * as Authorization: Bearer header to the backend.
 *
 * Does NOT use HttpOnly cookies for the primary authentication mechanism.
 * The backend validates the WorkOS JWT directly via JWKS.
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AuthProvider, AuthStateChangeListener, AuthSubscription } from './AuthProvider';
import type { User, Session, AuthProviderConfig, AuthResult, AuthErrorData } from './types';
import {
  setMemoryTokens,
  clearMemoryTokens,
  getMemoryAccessToken,
  getMemoryRefreshToken,
  getMemoryExpiresAt,
  isTokenExpired,
} from './tokenStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// Session hint for UI (non-authoritative)
const SESSION_KEY = 'capflux_auth_ui_hint';

interface BackendUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  profilePictureUrl?: string | null;
}

interface BackendAuthResponse {
  success?: boolean;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string | null;
  expiresAt?: number;
  user?: BackendUser | null;
  url?: string;
  error?: string;
}

const toUser = (u: BackendUser | null | undefined): User | null => {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email || '',
    name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' '),
    avatarUrl: u.profilePictureUrl || undefined,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

const toSession = (r: BackendAuthResponse): Session | null => {
  const accessToken = r.accessToken || '';
  const user = toUser(r.user);
  if (!accessToken || !user) return null;
  return {
    accessToken,
    refreshToken: r.refreshToken || '',
    expiresAt: r.expiresAt,
    user,
  };
}

export class AuthKitProvider extends AuthProvider {
  private readonly http: AxiosInstance;
  private config: AuthProviderConfig = {};
  private listeners = new Set<AuthStateChangeListener>();
  private isInitialized = false;

  constructor(config?: AuthProviderConfig) {
    super();
    this.config = config || {};
    this.http = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      // Do NOT use withCredentials for the new JWT Bearer token flow.
      // The WorkOS access token is sent as Authorization header.
      withCredentials: false,
    });

    // Request interceptor to add Authorization header
    this.http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = getMemoryAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for token refresh on 401
    this.http.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry && getMemoryRefreshToken()) {
          originalRequest._retry = true;
          try {
            await this.refreshTokens();
            const newToken = getMemoryAccessToken();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.http(originalRequest);
          } catch {
            // Refresh failed, clear tokens and let the error propagate
            clearMemoryTokens();
            this.notify('SIGNED_OUT', null);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // === Session hint (non-authoritative) ===
  private persistSessionHint(session: Session | null): void {
    if (typeof localStorage === 'undefined') return;
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const hint = { userId: session.user?.id, email: session.user?.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(hint));
  }

  private notify(event: string, session: Session | null): void {
    this.listeners.forEach((l) => l(event, session));
  }

  // === Internal helpers ===
  private async request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const res = await fn();
      return res.data;
    } catch (raw) {
      const err = raw as AxiosError<{ error?: string; message?: string; code?: string }>;
      const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
      const backendMessage = err.response?.data?.error || err.response?.data?.message;
      const backendCode = err.response?.data?.code;
      const message = backendMessage || err.message || 'Network request failed';
      const code = this.mapStatus(err.response?.status, message, isNetworkError, backendCode);
      const apiError = new Error(message);
      (apiError as Error & { code?: string }).code = code;
      (apiError as Error & { status?: number }).status = err.response?.status;
      throw apiError;
    }
  }

  private mapStatus(
    status: number | undefined,
    message: string,
    isNetworkError: boolean,
    backendCode?: string,
  ): string {
    if (isNetworkError || status === undefined) {
      return 'NETWORK_ERROR';
    }

    if (backendCode) {
      const upperBackendCode = backendCode.toUpperCase();
      const knownCodes = [
        'INVALID_CREDENTIALS',
        'EMAIL_NOT_VERIFIED',
        'USER_ALREADY_EXISTS',
        'DUPLICATE_ACCOUNT',
        'WEAK_PASSWORD',
        'BREACHED_PASSWORD',
        'RATE_LIMITED',
        'NOT_FOUND',
        'AUTH_ERROR',
      ];
      if (knownCodes.includes(upperBackendCode)) {
        return upperBackendCode;
      }
    }

    const lowerMessage = message.toLowerCase();

    if (status === 409 || lowerMessage.includes('already exists') || lowerMessage.includes('user_already_exists')) {
      return 'USER_ALREADY_EXISTS';
    }

    if (lowerMessage.includes('password does not meet') ||
        lowerMessage.includes('password must') ||
        lowerMessage.includes('password policy') ||
        lowerMessage.includes('does not meet any password')) {
      if (lowerMessage.includes('breach') || lowerMessage.includes('compromised') || lowerMessage.includes('pwned')) {
        return 'BREACHED_PASSWORD';
      }
      return 'WEAK_PASSWORD';
    }

    switch (status) {
      case 400:
        return lowerMessage.includes('invalid') || lowerMessage.includes('incorrect')
          ? 'INVALID_CREDENTIALS'
          : 'VALIDATION_ERROR';
      case 401:
        return 'INVALID_CREDENTIALS';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RATE_LIMITED';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'SERVER_ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_API_BASE_URL);
  }

  getConfig(): AuthProviderConfig {
    return this.config;
  }

  // === AuthKit Custom UI ===
  // Returns empty URL so the caller renders inline forms instead of
  // redirecting to WorkOS Hosted AuthKit. The custom login/register forms
  // handle email/password directly via /api/auth/signin and /api/auth/signup.
  async initiateAuthKit(mode: 'login' | 'signup'): Promise<AuthResult<{ url: string; redirect: boolean }>> {
    return { data: { url: '', redirect: false }, error: null };
  }

  // === AuthProvider ===
  async initialize(): Promise<AuthResult<{ session: Session | null }>> {
    try {
      // Check if we have a valid access token in memory
      const token = getMemoryAccessToken();
      if (token && !isTokenExpired()) {
        // Token exists and not expired, fetch user info
        const data = await this.request<BackendAuthResponse>(() =>
          this.http.get('/auth/session')
        );
        const backendUser = data.user;
        if (backendUser?.id) {
          const session: Session = {
            accessToken: token,
            refreshToken: getMemoryRefreshToken() || '',
            expiresAt: getMemoryExpiresAt() || 0,
            user: toUser(backendUser),
          };
          this.isInitialized = true;
          return { data: { session }, error: null };
        }
      }
      this.isInitialized = true;
      return { data: { session: null }, error: null };
    } catch {
      this.isInitialized = true;
      return { data: { session: null }, error: null };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult<{ session: Session; user: User }>> {
    // For email/password, we still use the legacy signin endpoint which returns tokens
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.post('/auth/signin', { email, password })
    );
    const session = toSession(data);
    if (!session?.user) throw new Error('Sign in did not return a valid session');

    // Store tokens in memory
    if (data.accessToken && data.refreshToken) {
      setMemoryTokens(data.accessToken, data.refreshToken, data.expiresAt);
    }

    this.notify('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  }

  async signUpWithName(email: string, password: string, fullName: string): Promise<AuthResult<{ user: User; verificationRequired: boolean }>> {
    const data = await this.request<BackendAuthResponse & { verificationRequired?: boolean }>(() =>
      this.http.post('/auth/signup', { fullName, email, password })
    );
    const user = toUser(data.user);
    if (!user) throw new Error('Sign up did not return a valid user');

    // If verification is required, don't store tokens or create session
    if (data.verificationRequired) {
      return { data: { user, verificationRequired: true }, error: null };
    }

    // Store tokens if returned (fallback for legacy flow)
    if (data.accessToken && data.refreshToken) {
      setMemoryTokens(data.accessToken, data.refreshToken, data.expiresAt);
    }

    const session = toSession(data);
    if (session) {
      this.notify('SIGNED_UP', session);
    }
    return { data: { user, verificationRequired: false }, error: null };
  }

  async signUp(email: string, password: string): Promise<AuthResult<{ user: User }>> {
    return this.signUpWithName(email, password, '');
  }

  async signInWithProvider(provider: string): Promise<AuthResult<{ session: Session | null; user: User | null; redirect?: boolean }>> {
    if (provider !== 'google') throw new Error(`Provider ${provider} is not supported`);
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.post('/auth/google', { redirectUri: `${window.location.origin}/auth/callback` })
    );
    if (!data.url) throw new Error('Google sign in did not return an authorization URL');
    window.location.href = data.url;
    return { data: { session: null, user: null, redirect: true }, error: null };
  }

  async handleOAuthCallback(code: string, state?: string): Promise<AuthResult<{ session: Session | null; user: User | null }>> {
    const params: { code: string; state?: string } = { code };
    if (state) params.state = state;
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.get('/auth/authkit-callback', { params })
    );
    const session = toSession(data);
    if (session) {
      // Store tokens in memory from callback response
      if (data.accessToken && data.refreshToken) {
        setMemoryTokens(data.accessToken, data.refreshToken, data.expiresAt);
      }
      this.notify('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    }
    return { data: { session: null, user: null }, error: null };
  }

  async signOut(): Promise<AuthResult<void>> {
    try {
      // Call backend signout to revoke WorkOS session
      await this.request(() => this.http.post('/auth/signout'));
    } catch {
      // Ignore network errors on logout
    }
    clearMemoryTokens();
    this.persistSessionHint(null);
    this.notify('SIGNED_OUT', null);
    return { data: null, error: null };
  }

  async refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    try {
      await this.refreshTokens();
      const token = getMemoryAccessToken();
      if (!token) {
        return { data: { session: null }, error: null };
      }
      const data = await this.request<BackendAuthResponse>(() =>
        this.http.get('/auth/session')
      );
      const backendUser = data.user;
      if (backendUser?.id) {
        const session: Session = {
          accessToken: token,
          refreshToken: getMemoryRefreshToken() || '',
          expiresAt: getMemoryExpiresAt() || 0,
          user: toUser(backendUser),
        };
        return { data: { session }, error: null };
      }
      return { data: { session: null }, error: null };
    } catch {
      clearMemoryTokens();
      return { data: { session: null }, error: null };
    }
  }

  private async refreshTokens(): Promise<void> {
    const refreshToken = getMemoryRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.post('/auth/refresh', { refreshToken })
    );
    if (data.accessToken && data.refreshToken) {
      setMemoryTokens(data.accessToken, data.refreshToken, data.expiresAt);
    } else {
      throw new Error('Token refresh did not return new tokens');
    }
  }

  restoreSession(): Promise<AuthResult<{ session: Session | null }>> {
    return this.initialize();
  }

  async getCurrentUser(): Promise<AuthResult<{ user: User | null }>> {
    const result = await this.initialize();
    return { data: { user: result.data?.session?.user ?? null }, error: result.error };
  }

  async getSession(): Promise<AuthResult<{ session: Session | null }>> {
    return this.initialize();
  }

  onAuthStateChange(callback: AuthStateChangeListener): AuthSubscription {
    this.listeners.add(callback);
    return { unsubscribe: () => { this.listeners.delete(callback); } };
  }

  async forgotPassword(email: string): Promise<AuthResult<void>> {
    await this.request(() => this.http.post('/auth/forgot-password', { email }));
    return { data: null, error: null };
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthResult<void>> {
    await this.request(() => this.http.post('/auth/reset-password', { token, newPassword }));
    return { data: null, error: null };
  }

  async resendVerification(userId: string): Promise<AuthResult<void>> {
    await this.request(() => this.http.post('/auth/resend-verification', { userId }));
    return { data: null, error: null };
  }
}
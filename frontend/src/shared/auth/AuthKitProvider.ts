/**
 * AuthKitProvider — Backend-proxy AuthProvider.
 * Frontend only talks to /api/auth/* via Axios. Never WorkOS/Supabase Auth directly.
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthProvider, AuthStateChangeListener, AuthSubscription } from './AuthProvider';
import type { User, Session, AuthProviderConfig, AuthResult, AuthErrorData } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
// NOTE: the HttpOnly workos_session cookie is the canonical session.
// localStorage is used ONLY as a non-authoritative UI hint (e.g. to avoid a
// flash of logged-out UI) and is never treated as a credential.
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
  session?: { user?: BackendUser | null };
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
  const refreshToken = r.refreshToken || '';
  const user = toUser(r.user ?? r.session?.user);
  if (!accessToken || !user) return null;
  return { accessToken, refreshToken, expiresAt: r.expiresAt, user };
};

export class AuthKitProvider extends AuthProvider {
  private readonly http: AxiosInstance;
  private config: AuthProviderConfig = {};
  private listeners = new Set<AuthStateChangeListener>();

  constructor(config?: AuthProviderConfig) {
    super();
    this.config = config || {};
    this.http = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      // Send/accept the HttpOnly workos_session cookie.
      withCredentials: true,
    });
  }

  // === Session hint (non-authoritative) ===
  private persistSession(session: Session | null): void {
    // The server cookie is authoritative; we only keep a UI hint so the app
    // doesn't flash logged-out before /auth/session returns. If localStorage
    // is tampered with, /auth/session still returns the truth.
    if (typeof localStorage === 'undefined') return;
    if (!session) { localStorage.removeItem(SESSION_KEY); return; }
    const hint = { userId: session.user?.id, email: session.user?.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(hint));
  }

  private readPersistedSession(): Session | null {
    // NOT a credential — only a hint that a session might exist. The real
    // session is verified server-side from the cookie on every restore.
    return null;
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

    // Honor the backend's error code when it is a known auth code.
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

    // Duplicate account detection
    if (status === 409 || lowerMessage.includes('already exists') || lowerMessage.includes('user_already_exists')) {
      return 'USER_ALREADY_EXISTS';
    }

    // Password policy errors — never mask as NETWORK_ERROR or VALIDATION_ERROR
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
        // 400 with invalid/incorrect → credentials; otherwise validation.
        // Password errors are caught above.
        return lowerMessage.includes('invalid') || lowerMessage.includes('incorrect')
          ? 'INVALID_CREDENTIALS'
          : 'VALIDATION_ERROR';
      case 401:
        // On auth endpoints, 401 means invalid credentials (not session expiry).
        // SESSION_EXPIRED is handled by mapProviderError's message pattern check.
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

  // === AuthProvider ===
  async initialize(): Promise<AuthResult<{ session: Session | null }>> {
    try {
      // The HttpOnly workos_session cookie is sent automatically; /auth/session
      // returns safe session info only after server-side verification.
      const data = await this.request<BackendAuthResponse>(() =>
        this.http.get('/auth/session')
      );
      const backendUser = data.session?.user || data.user;
      if (backendUser?.id) {
        const session: Session = {
          accessToken: '', // never exposed to the frontend
          refreshToken: '', // never exposed to the frontend
          expiresAt: 0,
          user: toUser(backendUser),
        };
        this.persistSession(session);
        return { data: { session }, error: null };
      }
      return { data: { session: null }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult<{ session: Session; user: User }>> {
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.post('/auth/signin', { email, password })
    );
    const session = toSession(data);
    if (!session?.user) throw new Error('Sign in did not return a valid session');
    this.persistSession(session);
    this.notify('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  }

  async signUpWithName(email: string, password: string, fullName: string): Promise<AuthResult<{ user: User }>> {
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.post('/auth/signup', { fullName, email, password })
    );
    const user = toUser(data.user);
    if (!user) throw new Error('Sign up did not return a valid user');
    const session = toSession(data);
    if (session) { this.persistSession(session); this.notify('SIGNED_UP', session); }
    return { data: { user }, error: null };
  }

  async signUp(email: string, password: string): Promise<AuthResult<{ user: User }>> {
    return this.signUpWithName(email, password, '');
  }

  async signInWithProvider(provider: string): Promise<AuthResult<{ session: Session | null; user: User | null; redirect?: boolean }>> {
    if (provider !== 'google') throw new Error(`Provider ${provider} is not supported`);
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.post('/auth/google', { redirectUri: `${window.location.origin}/auth?provider=google` })
    );
    if (!data.url) throw new Error('Google sign in did not return an authorization URL');
    window.location.href = data.url;
    return { data: { session: null, user: null, redirect: true }, error: null };
  }

  async handleOAuthCallback(code: string): Promise<AuthResult<{ session: Session | null; user: User | null }>> {
    const data = await this.request<BackendAuthResponse>(() =>
      this.http.get('/auth/callback', { params: { code } })
    );
    const session = toSession(data);
    if (session) {
      this.persistSession(session);
      this.notify('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    }
    return { data: { session: null, user: null }, error: null };
  }

  async signOut(): Promise<AuthResult<void>> {
    try {
      // The backend revokes the WorkOS session and clears the HttpOnly cookie.
      await this.request(() => this.http.post('/auth/signout'));
    } catch { /* ignore network errors on logout */ }
    this.persistSession(null);
    this.notify('SIGNED_OUT', null);
    return { data: null, error: null };
  }

  async refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    // Session refresh is transparent: /auth/session re-verifies the cookie.
    return this.initialize();
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
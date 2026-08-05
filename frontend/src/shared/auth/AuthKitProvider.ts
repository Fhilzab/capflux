/**
 * AuthKitProvider — Backend-proxy AuthProvider.
 * Frontend only talks to /api/auth/* via Axios. Never WorkOS/Supabase Auth directly.
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthProvider, AuthStateChangeListener, AuthSubscription } from './AuthProvider';
import type { User, Session, AuthProviderConfig, AuthResult, AuthErrorData } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const SESSION_KEY = 'capflux_auth_session';

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
    });
  }

  // === Session persistence ===
  private persistSession(session: Session | null): void {
    if (typeof localStorage === 'undefined') return;
    if (!session) { localStorage.removeItem(SESSION_KEY); return; }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private readPersistedSession(): Session | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as Session; }
    catch { localStorage.removeItem(SESSION_KEY); return null; }
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
      const err = raw as AxiosError<{ error?: string }>;
      const message = err.response?.data?.error || err.message || 'Network request failed';
      const apiError = new Error(message);
      (apiError as Error & { code?: string }).code = this.mapStatus(err.response?.status);
      throw apiError;
    }
  }

  private mapStatus(status: number | undefined): string {
    switch (status) {
      case 400: return 'INVALID_CREDENTIALS';
      case 401: return 'SESSION_EXPIRED';
      case 404: return 'NOT_FOUND';
      case 429: return 'RATE_LIMITED';
      case undefined: return 'NETWORK_ERROR';
      default: return 'UNKNOWN';
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
    const persisted = this.readPersistedSession();
    if (!persisted?.user?.id) return { data: { session: null }, error: null };

    try {
      const data = await this.request<BackendAuthResponse>(() =>
        this.http.get('/auth/me', { headers: { Authorization: `Bearer ${persisted.user!.id}` } })
      );
      if (data.user) {
        const session: Session = { ...persisted, user: toUser(data.user) || persisted.user };
        this.persistSession(session);
        return { data: { session }, error: null };
      }
      return { data: { session: null }, error: null };
    } catch {
      this.persistSession(null);
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
    const persisted = this.readPersistedSession();
    try {
      if (persisted?.refreshToken) {
        await this.request(() => this.http.post('/auth/signout', { refreshToken: persisted.refreshToken }));
      }
    } catch { /* ignore network errors on logout */ }
    this.persistSession(null);
    this.notify('SIGNED_OUT', null);
    return { data: null, error: null };
  }

  async refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    const persisted = this.readPersistedSession();
    if (!persisted?.refreshToken) return { data: { session: null }, error: null };
    try {
      const data = await this.request<BackendAuthResponse>(() =>
        this.http.post('/auth/refresh', { refreshToken: persisted.refreshToken })
      );
      const session = toSession(data);
      if (session) {
        this.persistSession(session);
        this.notify('SESSION_REFRESHED', session);
        return { data: { session }, error: null };
      }
      this.persistSession(null);
      return { data: { session: null }, error: null };
    } catch {
      this.persistSession(null);
      return { data: { session: null }, error: null };
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
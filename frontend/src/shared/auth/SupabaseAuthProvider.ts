/**
 * SupabaseAuthProvider — Supabase Auth implementation of the AuthProvider
 * abstract interface.
 *
 * Replaces AuthKitProvider (WorkOS) as the concrete AuthProvider. The rest
 * of CAPFLUX — AuthService, authStore, RouteGuard — remains unchanged
 * because they depend only on the AuthProvider abstract contract.
 *
 * Uses the centralized Supabase client from @/lib/supabase.
 *
 * Supabase Auth handles:
 *   - session persistence (localStorage via supabase.auth)
 *   - token auto-refresh
 *   - email/password sign-in & sign-up
 *   - email verification
 *   - password reset
 *   - OAuth (Google) — via signInWithOAuth
 *
 * The frontend stores NO manually-managed tokens. The Supabase client
 * manages the session in the standard supabase.auth token key (automatic,
 * library-managed persistence). A non-authoritative UI hint may be kept
 * in localStorage (capflux_auth_ui_hint) for flash-of-logged-out prevention,
 * but it is never treated as a credential.
 */
import { supabase, hasSupabaseConfig } from '@/lib/supabase';
import type {
  User,
  Session,
  AuthProviderConfig,
  AuthResult,
  AuthErrorData,
  AuthStateChangeListener,
  AuthSubscription,
} from './types';
import { AuthProvider } from './AuthProvider';

const SESSION_KEY = 'capflux_auth_ui_hint';

/**
 * Map a Supabase user to the CAPFLUX User type.
 */
function toUser(supabaseUser: any): User | null {
  if (!supabaseUser) return null;
  const metadata = supabaseUser.user_metadata || {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: metadata.full_name || metadata.name || '',
    avatarUrl: metadata.avatar_url || metadata.picture || '',
    createdAt: supabaseUser.created_at,
    updatedAt: supabaseUser.updated_at,
  };
}

/**
 * Map a Supabase session to the CAPFLUX Session type.
 */
function toSession(supabaseSession: any): Session | null {
  if (!supabaseSession) return null;
  return {
    accessToken: supabaseSession.access_token || '',
    refreshToken: supabaseSession.refresh_token || '',
    expiresAt: supabaseSession.expires_at,
    user: toUser(supabaseSession.user),
  };
}

/**
 * Non-authoritative UI hint: stored in localStorage so the app doesn't flash
 * logged-out before the session check completes. NEVER treated as a credential.
 */
function persistSessionHint(session: Session | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  const hint = { userId: session.user?.id, email: session.user?.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(hint));
}

export class SupabaseAuthProvider extends AuthProvider {
  private config: AuthProviderConfig = {};
  private listeners = new Set<AuthStateChangeListener>();
  private unsubscribe: (() => void) | null = null;
  private initialized = false;

  constructor(config?: AuthProviderConfig) {
    super();
    this.config = config || {};
    this._setupAuthStateListener();
  }

  /**
   * Set up Supabase onAuthStateChange listener that forwards events to
   * all registered CAPFLUX listeners. This must be called once per provider
   * instance.
   */
  private _setupAuthStateListener() {
    if (this.unsubscribe) return;
    this.unsubscribe = supabase.auth.onAuthStateChange((event, session) => {
      const mappedSession = toSession(session);
      persistSessionHint(mappedSession);
      this.listeners.forEach((l) => l(event, mappedSession));
    }).data.subscription;
  }

  private notify(event: string, session: Session | null): void {
    this.listeners.forEach((l) => l(event, session));
  }

  // === AuthProvider implementation ===

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }

  getConfig(): AuthProviderConfig {
    return this.config;
  }

  /**
   * Initialize: check for existing session and return it.
   * Supabase client auto-refreshes tokens; this just reads the current session.
   */
  async initialize(): Promise<AuthResult<{ session: Session | null }>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) return { data: null, error: this._mapError(error) };
      const mappedSession = toSession(session);
      if (mappedSession) {
        persistSessionHint(mappedSession);
      }
      return { data: { session: mappedSession }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult<{ session: Session; user: User }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { data: null, error: this._mapError(error) };
      const session = toSession(data.session);
      const user = toUser(data.user);
      if (!session || !user) {
        const err = new Error('Sign in did not return a valid session');
        return { data: null, error: this._mapError(err) };
      }
      persistSessionHint(session);
      return { data: { session, user }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async signUp(email: string, password: string, fullName?: string): Promise<AuthResult<{ user: User }>> {
    return this.signUpWithName(email, password, fullName || '');
  }

  async signUpWithName(email: string, password: string, fullName: string): Promise<AuthResult<{ user: User }>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
        },
      });
      if (error) return { data: null, error: this._mapError(error) };
      const user = toUser(data.user);
      if (!user) {
        const err = new Error('Sign up did not return a valid user');
        return { data: null, error: this._mapError(err) };
      }
      return { data: { user }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  /**
   * Supabase Auth has no hosted UI to redirect to. Returns null URL so the
   * caller (AuthView) falls back to rendering the inline form components.
   */
  async initiateAuthKit(mode: 'login' | 'signup'): Promise<AuthResult<{ url: string }>> {
    return { data: { url: '' }, error: null };
  }

  async signInWithProvider(provider: string): Promise<AuthResult<{ session: Session | null; user: User | null; redirect?: boolean }>> {
    if (provider !== 'google') {
      const err = new Error(`Provider ${provider} is not supported`);
      return { data: null, error: this._mapError(err) };
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return { data: null, error: this._mapError(error) };
      // signInWithOAuth returns { url, provider } — the browser is redirected.
      return { data: { session: null, user: null, redirect: true }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async handleOAuthCallback(code: string, state?: string): Promise<AuthResult<{ session: Session | null; user: User | null }>> {
    try {
      // With detectSessionInUrl enabled, the Supabase client may have already
      // exchanged the code automatically. Attempt an explicit exchange first;
      // if the code was already consumed, fall back to the existing session.
      const exchangeResult = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeResult.error && exchangeResult.data?.session) {
        const mappedSession = toSession(exchangeResult.data.session);
        const mappedUser = toUser(exchangeResult.data.user);
        if (mappedSession) {
          persistSessionHint(mappedSession);
          this.notify('SIGNED_IN', mappedSession);
        }
        return { data: { session: mappedSession, user: mappedUser }, error: null };
      }

      // Fall back: session may have been established by detectSessionInUrl.
      const { data: { session, user }, error: sessionError } = await supabase.auth.getSession();
      const mappedSession = toSession(session);
      if (mappedSession) {
        persistSessionHint(mappedSession);
        return { data: { session: mappedSession, user: toUser(user) }, error: null };
      }
      return { data: { session: null, user: null }, error: this._mapError(sessionError) };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async forgotPassword(email: string): Promise<AuthResult<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`,
      });
      if (error) return { data: null, error: this._mapError(error) };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthResult<void>> {
    try {
      // Supabase password reset: the token (email OTP / recovery token) is
      // verified, then the password is updated. The verifyOtp call
      // establishes a temporary session, then updateUser sets the new password.
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });
      if (verifyError) return { data: null, error: this._mapError(verifyError) };

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) return { data: null, error: this._mapError(updateError) };

      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async resendVerification(userId: string): Promise<AuthResult<void>> {
    try {
      // Resolve the user's email from the current session.
      // If the session is absent the user must be identified another way.
      let email: string | null = null;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        email = user.email || null;
      }

      if (!email) {
        const err = new Error('User not found: no authenticated session to resend verification');
        return { data: null, error: this._mapError(err) };
      }

      const { error } = await supabase.auth.resend({
        type: 'email_confirmation',
        email,
      });
      if (error) return { data: null, error: this._mapError(error) };
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async signOut(): Promise<AuthResult<void>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { data: null, error: this._mapError(error) };
      persistSessionHint(null);
      this.notify('SIGNED_OUT', null);
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) return { data: null, error: this._mapError(error) };
      const mapped = toSession(session);
      if (mapped) persistSessionHint(mapped);
      return { data: { session: mapped }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  restoreSession(): Promise<AuthResult<{ session: Session | null }>> {
    // Alias for initialize — reads the persisted session.
    return this.initialize();
  }

  async getCurrentUser(): Promise<AuthResult<{ user: User | null }>> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) return { data: null, error: this._mapError(error) };
      return { data: { user: toUser(user) }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  async getSession(): Promise<AuthResult<{ session: Session | null }>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) return { data: null, error: this._mapError(error) };
      return { data: { session: toSession(session) }, error: null };
    } catch (err) {
      return { data: null, error: this._mapError(err as Error) };
    }
  }

  onAuthStateChange(callback: AuthStateChangeListener): AuthSubscription {
    this.listeners.add(callback);
    return {
      unsubscribe: () => {
        this.listeners.delete(callback);
      },
    };
  }

  // === Internal ===

  /**
   * Map a Supabase auth error to the CAPFLUX AuthErrorData shape.
   */
  private _mapError(error: unknown): AuthErrorData {
    const err = error as { message?: string; code?: string };
    const message = err?.message || 'Authentication error';
    const lower = message.toLowerCase();

    let code: AuthErrorData['code'] = 'UNKNOWN';

    if (err?.code === 'invalid_credentials' ||
        lower.includes('invalid') ||
        lower.includes('incorrect') ||
        lower.includes('invalid login')) {
      code = 'INVALID_CREDENTIALS';
    } else if (lower.includes('breach') ||
               lower.includes('compromised') ||
               lower.includes('pwned') ||
               lower.includes('commonly used')) {
      code = 'BREACHED_PASSWORD';
    } else if (lower.includes('password does not meet') ||
               lower.includes('password must') ||
               lower.includes('password policy') ||
               lower.includes('does not meet any password') ||
               err?.code === 'weak_password') {
      code = 'WEAK_PASSWORD';
    } else if (lower.includes('already registered') ||
               lower.includes('already exists') ||
               err?.code === 'user_already_exists' ||
               err?.code === 'signup_disabled') {
      code = 'USER_ALREADY_EXISTS';
    } else if (lower.includes('email not confirmed') ||
               lower.includes('email not verified') ||
               err?.code === 'email_not_verified') {
      code = 'EMAIL_NOT_VERIFIED';
    } else if (lower.includes('jwt expired') ||
               lower.includes('session expired')) {
      code = 'SESSION_EXPIRED';
    } else if (lower.includes('network') ||
               lower.includes('fetch') ||
               lower.includes('failed to fetch') ||
               err?.code === 'network_error') {
      code = 'NETWORK_ERROR';
    } else if (lower.includes('too many') ||
               lower.includes('rate') ||
               err?.code === 'rate_limit') {
      code = 'RATE_LIMITED';
    } else if (lower.includes('not found') ||
               err?.code === 'not_found') {
      code = 'NOT_FOUND';
    } else if (err?.code) {
      // Pass through known Supabase error codes that map to our existing codes
      const mapped = {
        auth_invalid_credentials: 'INVALID_CREDENTIALS',
        auth_user_not_found: 'NOT_FOUND',
        auth_session_expired: 'SESSION_EXPIRED',
        auth_rate_limit: 'RATE_LIMITED',
      }[err.code as string];
      if (mapped) code = mapped as AuthErrorData['code'];
    }

    return { code, message };
  }
}

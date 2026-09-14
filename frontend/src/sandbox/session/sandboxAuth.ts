/**
 * Sandbox authentication — demo personas with server-validated sessions.
 *
 * This provider authenticates against the sandbox backend /api/auth/demo-login
 * endpoint, which validates the persona against a server-side allowlist and
 * issues a signed demo session token. The browser NEVER determines roles or
 * permissions — the server is authoritative.
 *
 * Authorization is enforced downstream by the backend via requireAuthDemo
 * middleware which validates the demo session token on every request.
 */

import {
  AuthProvider,
  type AuthStateChangeListener,
  type AuthSubscription,
} from '../../shared/auth/AuthProvider';
import type {
  AuthProviderConfig,
  AuthResult,
  Session,
  User,
} from '../../shared/auth/types';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from '../runtime/sandboxGuard';
import { DEMO_PERSONAS, type DemoPersonaSpec } from '../seed/demoData';
import { apiClient } from '../../shared/services/api/client';

export function listDemoPersonas(): readonly DemoPersonaSpec[] {
  return DEMO_PERSONAS;
}

const DEMO_SESSION_STORAGE_KEY = 'capflux_demo_session';

interface DemoSessionData {
  token: string;
  personaId: string;
  expiresAt: number;
}

function readStoredSession(): DemoSessionData | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSessionData;
    if (parsed.expiresAt * 1000 < Date.now()) {
      localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: DemoSessionData | null): void {
  try {
    if (session) {
      localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — session simply won't persist across reloads.
  }
}

function ok<T>(data: T): AuthResult<T> {
  return { data, error: null };
}

function fail<T>(code: string, message: string): AuthResult<T> {
  return { data: null, error: { code, message, raw: undefined } };
}

function personaToUser(persona: DemoPersonaSpec): User & { personaId: string; systemRole: string; platformStaff: boolean; title: string } {
  return {
    id: `demo-${persona.id}`,
    email: persona.email,
    name: persona.fullName,
    role: persona.systemRole === 'OWNER' ? 'OWNER' : 'ADMIN',
    personaId: persona.id,
    systemRole: persona.systemRole,
    platformStaff: Boolean(persona.platformStaff),
    title: persona.title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export class SandboxAuthProvider extends AuthProvider {
  private listeners = new Set<AuthStateChangeListener>();
  private currentSession: DemoSessionData | null = null;
  private currentPersona: DemoPersonaSpec | null = null;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxAuthProvider');
    this.currentSession = readStoredSession();
    if (this.currentSession) {
      this.currentPersona = DEMO_PERSONAS.find((p) => p.id === this.currentSession!.personaId) ?? null;
    }
  }

  private buildSession(persona: DemoPersonaSpec, token: string, expiresAt: number): Session {
    const user = personaToUser(persona);
    return {
      accessToken: token,
      refreshToken: token, // Demo session uses same token for refresh
      expiresAt,
      user,
    };
  }

  private emit(event: string, session: Session | null): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event, session);
      } catch {
        // Listener failures must not break auth flows.
      }
    }
  }

  /** Currently signed-in persona (or null). */
  getPersona(): DemoPersonaSpec | null {
    const stored = readStoredSession();
    if (stored && stored.personaId !== this.currentPersona?.id) {
      this.currentSession = stored;
      this.currentPersona = DEMO_PERSONAS.find((p) => p.id === stored.personaId) ?? null;
    } else if (!stored && this.currentPersona) {
      this.currentPersona = null;
      this.currentSession = null;
    }
    return this.currentPersona;
  }

  /** Role switcher: sign in as another demo persona in one step. */
  async switchToPersona(personaId: string): Promise<AuthResult<{ session: Session; user: User }>> {
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) return fail('NOT_FOUND', 'Unknown demo persona');
    return this.signInAsPersona(persona);
  }

  async initialize(): Promise<AuthResult<{ session: Session | null }>> {
    const session = this.getSessionFromStorage();
    return ok({ session });
  }

  private getSessionFromStorage(): Session | null {
    const stored = readStoredSession();
    if (!stored || !this.currentPersona) return null;
    return this.buildSession(this.currentPersona, stored.token, stored.expiresAt);
  }

  async signIn(email: string, _password: string): Promise<AuthResult<{ session: Session; user: User }>> {
    const normalized = email.trim().toLowerCase();
    const persona = DEMO_PERSONAS.find((p) => p.email.toLowerCase() === normalized);
    if (!persona) {
      return fail('INVALID_CREDENTIALS', 'Unknown demo persona.');
    }
    return this.signInAsPersona(persona);
  }

  private async signInAsPersona(persona: DemoPersonaSpec): Promise<AuthResult<{ session: Session; user: User }>> {
    try {
      const response = await apiClient.post('/auth/demo-login', { personaId: persona.id });
      const data = response.data as {
        success: boolean;
        token: string;
        persona: { id: string; email: string; fullName: string; role: string; systemRole: string; title: string; platformStaff: boolean };
        expiresIn: number;
      };

      if (!data.success || !data.token) {
        return fail('AUTH_ERROR', 'Demo login failed.');
      }

      const expiresAt = Math.floor(Date.now() / 1000) + data.expiresIn;
      this.currentSession = { token: data.token, personaId: persona.id, expiresAt };
      this.currentPersona = persona;
      writeStoredSession(this.currentSession);

      const session = this.buildSession(persona, data.token, expiresAt);
      this.emit('SIGNED_IN', session);
      return ok({ session, user: session.user! });
    } catch (error) {
      console.error('Demo sign-in failed:', error);
      return fail('AUTH_ERROR', 'Failed to establish demo session. Please try again.');
    }
  }

  async signUp(): Promise<AuthResult<{ user: User }>> {
    return fail('UNAUTHORIZED', 'Sign-up is disabled in the sandbox — use a demo persona.');
  }

  async signUpWithName(): Promise<AuthResult<{ user: User }>> {
    return this.signUp();
  }

  async signInWithProvider(): Promise<AuthResult<{ session: Session | null; user: User | null; redirect?: boolean }>> {
    return ok({ session: null, user: null, redirect: false });
  }

  async handleOAuthCallback(): Promise<AuthResult<{ session: Session | null; user: User | null }>> {
    return ok({ session: null, user: null });
  }

  async forgotPassword(_email: string): Promise<AuthResult<void>> {
    return fail('UNAUTHORIZED', 'Password reset is not applicable to demo personas.');
  }

  async resetPassword(): Promise<AuthResult<void>> {
    return fail('UNAUTHORIZED', 'Password reset is not applicable to demo personas.');
  }

  async resendVerification(_userId: string): Promise<AuthResult<void>> {
    return fail('UNAUTHORIZED', 'Email verification is not simulated for demo personas.');
  }

  async signOut(): Promise<AuthResult<void>> {
    this.currentPersona = null;
    this.currentSession = null;
    writeStoredSession(null);
    this.emit('SIGNED_OUT', null);
    return ok(undefined as unknown as void);
  }

  async refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    const session = this.getSessionFromStorage();
    if (!session) {
      return ok({ session: null });
    }
    // Validate session with backend
    try {
      await apiClient.get('/auth/demo-session', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      return ok({ session });
    } catch {
      this.currentPersona = null;
      this.currentSession = null;
      writeStoredSession(null);
      return ok({ session: null });
    }
  }

  async restoreSession(): Promise<AuthResult<{ session: Session | null }>> {
    return this.initialize();
  }

  async getCurrentUser(): Promise<AuthResult<{ user: User | null }>> {
    const persona = this.getPersona();
    return ok({ user: persona ? personaToUser(persona) : null });
  }

  async getSession(): Promise<AuthResult<{ session: Session | null }>> {
    const session = this.getSessionFromStorage();
    return ok({ session });
  }

  onAuthStateChange(callback: AuthStateChangeListener): AuthSubscription {
    this.listeners.add(callback);
    return {
      unsubscribe: () => {
        this.listeners.delete(callback);
      },
    };
  }

  getConfig(): AuthProviderConfig {
    return { clientId: 'capflux-sandbox', domain: 'sandbox.local', redirectUri: undefined };
  }

  async initiateAuthKit(_mode: 'login' | 'signup'): Promise<AuthResult<{ url: string } | null>> {
    void _mode;
    return ok({ url: null });
  }

  isConfigured(): boolean {
    return true;
  }
}

let instance: SandboxAuthProvider | null = null;

/** Mode-guarded singleton accessor used by the AuthService factory. */
export function getSandboxAuthProvider(): SandboxAuthProvider {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxAuthProvider');
  if (!instance) instance = new SandboxAuthProvider();
  return instance;
}

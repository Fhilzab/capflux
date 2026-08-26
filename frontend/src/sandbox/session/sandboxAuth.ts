/**
 * Sandbox authentication — demo personas exercising the REAL authorization
 * model. No Supabase/WorkOS call is ever made; identity is resolved from a
 * local demo roster and persisted as a plain session hint in localStorage.
 *
 * Authorization itself stays enforced downstream: /context/rbac (served by
 * the sandbox API simulator) returns role + permission codes per persona,
 * which drive the same rbacStore/RouteGuard checks as production.
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
import { DEMO_PASSWORD_HINT, DEMO_PERSONAS, type DemoPersonaSpec } from '../seed/demoData';

const SESSION_STORAGE_KEY = 'capflux_sandbox_session';

export function listDemoPersonas(): readonly DemoPersonaSpec[] {
  return DEMO_PERSONAS;
}

function personaToUser(persona: DemoPersonaSpec): User & { personaId: string; systemRole: string; platformStaff: boolean; title: string } {
  return {
    id: persona.id,
    email: persona.email,
    name: persona.fullName,
    role: persona.systemRole === 'OWNER' ? 'OWNER' : 'ADMIN',
    personaId: persona.id,
    systemRole: persona.systemRole,
    platformStaff: Boolean(persona.platformStaff),
    title: persona.title,
    createdAt: '2025-09-01T08:00:00.000Z',
    updatedAt: '2025-09-01T08:00:00.000Z',
  };
}

function readStoredPersonaId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { personaId?: string }).personaId ?? null : null;
  } catch {
    return null;
  }
}

function writeStoredPersonaId(personaId: string | null): void {
  try {
    if (personaId) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ personaId }));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — session simply won't persist across reloads.
  }
}

function ok<T>(data: T): AuthResult<T> {
  return { data, error: null };
}

function fail<T>(code: Parameters<typeof mapAuthError>[0], message: string): AuthResult<T> {
  return { data: null, error: { code, message, raw: undefined } };
}

function mapAuthError(code: never): string {
  return String(code);
}

export class SandboxAuthProvider extends AuthProvider {
  private listeners = new Set<AuthStateChangeListener>();
  private currentPersonaId: string | null = null;

  constructor() {
    super();
    assertSandboxMode(runtimeEnvironment.isSandbox, 'SandboxAuthProvider');
    this.currentPersonaId = readStoredPersonaId();
  }

  private buildSession(persona: DemoPersonaSpec): Session {
    const user = personaToUser(persona);
    return {
      accessToken: `sandbox-token-${persona.id}`,
      refreshToken: `sandbox-refresh-${persona.id}`,
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
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

  /** Currently signed-in persona (or null). Re-reads persisted session so
   * external updates (reset, role switch via storage) always win. */
  getPersona(): DemoPersonaSpec | null {
    const storedId = readStoredPersonaId();
    if (storedId !== this.currentPersonaId) {
      this.currentPersonaId = storedId;
    }
    return DEMO_PERSONAS.find((p) => p.id === this.currentPersonaId) ?? null;
  }

  /** Role switcher: sign in as another demo persona in one step. */
  async switchToPersona(personaId: string): Promise<AuthResult<{ session: Session; user: User }>> {
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) return fail('NOT_FOUND', 'Unknown demo persona');
    this.currentPersonaId = persona.id;
    writeStoredPersonaId(persona.id);
    const session = this.buildSession(persona);
    this.emit('SIGNED_IN', session);
    return ok({ session, user: session.user! });
  }

  async initialize(): Promise<AuthResult<{ session: Session | null }>> {
    const persona = this.getPersona();
    return ok({ session: persona ? this.buildSession(persona) : null });
  }

  async signIn(email: string, password: string): Promise<AuthResult<{ session: Session; user: User }>> {
    const normalized = email.trim().toLowerCase();
    const persona = DEMO_PERSONAS.find((p) => p.email.toLowerCase() === normalized);
    if (!persona || password !== DEMO_PASSWORD_HINT) {
      return fail('INVALID_CREDENTIALS', 'Use one of the demo personas (password: demo1234).');
    }
    this.currentPersonaId = persona.id;
    writeStoredPersonaId(persona.id);
    const session = this.buildSession(persona);
    this.emit('SIGNED_IN', session);
    return ok({ session, user: session.user! });
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

  async forgotPassword(email: string): Promise<AuthResult<void>> {
    void email;
    return fail('UNAUTHORIZED', 'Password reset is not applicable to demo personas.');
  }

  async resetPassword(): Promise<AuthResult<void>> {
    return fail('UNAUTHORIZED', 'Password reset is not applicable to demo personas.');
  }

  async resendVerification(userId: string): Promise<AuthResult<void>> {
    void userId;
    return fail('UNAUTHORIZED', 'Email verification is not simulated for demo personas.');
  }

  async signOut(): Promise<AuthResult<void>> {
    this.currentPersonaId = null;
    writeStoredPersonaId(null);
    this.emit('SIGNED_OUT', null);
    return ok(undefined as unknown as void);
  }

  async refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    return this.initialize();
  }

  async restoreSession(): Promise<AuthResult<{ session: Session | null }>> {
    return this.initialize();
  }

  async getCurrentUser(): Promise<AuthResult<{ user: User | null }>> {
    const persona = this.getPersona();
    return ok({ user: persona ? personaToUser(persona) : null });
  }

  async getSession(): Promise<AuthResult<{ session: Session | null }>> {
    return this.initialize();
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

  /** Parity with SupabaseAuthProvider — no hosted UI in sandbox. */
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

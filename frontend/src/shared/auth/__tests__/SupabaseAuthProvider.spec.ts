import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mock state ──────────────────────────────────
// vi.mock() factory is hoisted to the top of the file, so all variables
// it references must be declared via vi.hoisted().

const { mockSupabaseAuth, mockUnsubscribe } = vi.hoisted(() => {
  return {
    mockUnsubscribe: vi.fn(),
    mockSupabaseAuth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
      resend: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: mockUnsubscribe },
      })),
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockSupabaseAuth },
  hasSupabaseConfig: true,
}));

// Mock localStorage so persistSessionHint doesn't crash in jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
window.localStorage.clear();

import { SupabaseAuthProvider } from '../SupabaseAuthProvider';

// ── Test data ──

const mockUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockSession = {
  access_token: 'access.token.value',
  refresh_token: 'refresh.token.value',
  expires_at: 1735689600,
  user: mockUser,
};

const mockError = (message: string, code?: string) => {
  const err = new Error(message);
  if (code) (err as any).code = code;
  return err;
};

// ── Tests ──

describe('SupabaseAuthProvider', () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new SupabaseAuthProvider();
    window.localStorage.clear();
  });

  describe('isConfigured', () => {
    it('returns true when supabase config is present', () => {
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('signIn', () => {
    it('returns session and user on success', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await provider.signIn('test@example.com', 'Password123!');

      expect(result.error).toBeNull();
      expect(result.data?.user.email).toBe('test@example.com');
      expect(result.data?.session.accessToken).toBe('access.token.value');
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
    });

    it('returns INVALID_CREDENTIALS on invalid password', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: mockError('Invalid login credentials', 'invalid_credentials'),
      });

      const result = await provider.signIn('test@example.com', 'wrong');

      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
      expect(result.data).toBeNull();
    });

    it('maps session expiry errors', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: mockError('JWT expired', 'jwt expired'),
      });

      const result = await provider.signIn('test@example.com', 'pw');

      expect(result.error?.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('signUp', () => {
    it('signs up with email and password without full name', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await provider.signUp('new@example.com', 'Password123!');

      expect(result.error).toBeNull();
      expect(result.data?.user.id).toBe(mockUser.id);
      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'Password123!',
        options: { data: undefined },
      });
    });

    it('signs up with email, password, and full name', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await provider.signUpWithName('new@example.com', 'Password123!', 'Jane Doe');

      expect(result.error).toBeNull();
      expect(result.data?.user.email).toBe('test@example.com');
      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'Password123!',
        options: { data: { full_name: 'Jane Doe' } },
      });
    });

    it('returns USER_ALREADY_EXISTS on duplicate email', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null },
        error: mockError('User already registered', 'user_already_exists'),
      });

      const result = await provider.signUp('dup@example.com', 'Password123!');

      expect(result.error?.code).toBe('USER_ALREADY_EXISTS');
      expect(result.data).toBeNull();
    });

    it('returns WEAK_PASSWORD for weak passwords', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null },
        error: mockError('Password does not meet requirements', 'weak_password'),
      });

      const result = await provider.signUp('weak@example.com', '123');

      expect(result.error?.code).toBe('WEAK_PASSWORD');
      expect(result.data).toBeNull();
    });
  });

  describe('signOut', () => {
    it('calls supabase.auth.signOut and clears session hint', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      // Sign in to set the session hint
      await provider.signIn('test@example.com', 'Password123!');

      // Now sign out
      const result = await provider.signOut();

      expect(result.error).toBeNull();
      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it('propagates sign out errors', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({
        error: mockError('Network error', 'network_error'),
      });

      const result = await provider.signOut();

      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('getSession', () => {
    it('returns session when one exists', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await provider.getSession();

      expect(result.error).toBeNull();
      expect(result.data?.session?.accessToken).toBe('access.token.value');
    });

    it('returns null session when no session exists', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await provider.getSession();

      expect(result.error).toBeNull();
      expect(result.data?.session).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('returns mapped user on success', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await provider.getCurrentUser();

      expect(result.error).toBeNull();
      expect(result.data?.user?.email).toBe('test@example.com');
      expect(result.data?.user?.name).toBe('Test User');
      expect(result.data?.user?.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('returns null user when not authenticated', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await provider.getCurrentUser();

      expect(result.data?.user).toBeNull();
    });
  });

  describe('initialize / restoreSession', () => {
    it('returns existing session on initialize', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await provider.initialize();

      expect(result.error).toBeNull();
      expect(result.data?.session?.accessToken).toBe('access.token.value');
    });

    it('returns null session when no session exists', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await provider.initialize();

      expect(result.error).toBeNull();
      expect(result.data?.session).toBeNull();
    });

    it('restoreSession delegates to initialize', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await provider.restoreSession();

      expect(result.error).toBeNull();
      expect(result.data?.session).not.toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('registers a listener and returns an unsubscribe function', () => {
      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled();

      const listener = vi.fn();
      const subscription = provider.onAuthStateChange(listener);

      expect(typeof subscription.unsubscribe).toBe('function');

      const callback = mockSupabaseAuth.onAuthStateChange.mock.calls[0][0];
      callback('SIGNED_OUT', null);
      expect(listener).toHaveBeenCalledWith('SIGNED_OUT', null);

      subscription.unsubscribe();
      callback('SIGNED_IN', mockSession);
      expect(listener).not.toHaveBeenCalledWith('SIGNED_IN', expect.anything());
    });
  });

  describe('signInWithProvider (Google OAuth)', () => {
    it('calls supabase.auth.signInWithOAuth with redirectTo', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth', provider: 'google' },
        error: null,
      });

      const result = await provider.signInWithProvider('google');

      expect(result.error).toBeNull();
      expect(result.data?.redirect).toBe(true);
      expect(result.data?.session).toBeNull();
      expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: expect.stringContaining('/auth/callback') },
      });
    });

    it('rejects unsupported providers', async () => {
      const result = await provider.signInWithProvider('github');

      expect(result.error?.code).toBe('UNKNOWN');
      expect(result.data).toBeNull();
    });

    it('propagates OAuth errors', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: null, provider: 'google' },
        error: mockError('OAuth configuration error', 'oauth_error'),
      });

      const result = await provider.signInWithProvider('google');

      expect(result.error).not.toBeNull();
      expect(result.data).toBeNull();
    });
  });

  describe('handleOAuthCallback', () => {
    it('exchanges code for session on explicit call', async () => {
      mockSupabaseAuth.exchangeCodeForSession.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await provider.handleOAuthCallback('test-code', 'test-state');

      expect(result.error).toBeNull();
      expect(result.data?.session?.accessToken).toBe('access.token.value');
      expect(result.data?.user?.email).toBe('test@example.com');
      expect(mockSupabaseAuth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    });

    it('falls back to getSession when code already consumed', async () => {
      mockSupabaseAuth.exchangeCodeForSession.mockResolvedValue({
        data: { session: null, user: null },
        error: mockError('code already used'),
      });
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await provider.handleOAuthCallback('used-code');

      expect(result.error).toBeNull();
      expect(result.data?.session?.accessToken).toBe('access.token.value');
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('sends reset email on success', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

      const result = await provider.forgotPassword('test@example.com');

      expect(result.error).toBeNull();
      expect(mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ redirectTo: expect.any(String) }),
      );
    });

    it('propagates errors', async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        error: mockError('Email not found'),
      });

      const result = await provider.forgotPassword('nobody@example.com');

      expect(result.error).not.toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('verifies OTP and updates password', async () => {
      mockSupabaseAuth.verifyOtp.mockResolvedValue({ error: null });
      mockSupabaseAuth.updateUser.mockResolvedValue({ error: null });

      const result = await provider.resetPassword('reset-token', 'NewPassword123!');

      expect(result.error).toBeNull();
      expect(mockSupabaseAuth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'reset-token',
        type: 'email',
      });
      expect(mockSupabaseAuth.updateUser).toHaveBeenCalledWith({
        password: 'NewPassword123!',
      });
    });

    it('returns error when OTP verification fails', async () => {
      mockSupabaseAuth.verifyOtp.mockResolvedValue({
        error: mockError('Invalid token', 'invalid_token'),
      });

      const result = await provider.resetPassword('bad-token', 'NewPassword123!');

      expect(result.error).not.toBeNull();
      expect(mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('sends verification email using session user email', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      mockSupabaseAuth.resend.mockResolvedValue({ error: null });

      const result = await provider.resendVerification(mockUser.id);

      expect(result.error).toBeNull();
      expect(mockSupabaseAuth.resend).toHaveBeenCalledWith({
        type: 'email_confirmation',
        email: 'test@example.com',
      });
    });

    it('returns error when no authenticated user', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await provider.resendVerification('some-user-id');

      expect(result.error?.code).toBe('NOT_FOUND');
      expect(mockSupabaseAuth.resend).not.toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('refreshes and returns new session', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await provider.refreshSession();

      expect(result.error).toBeNull();
      expect(result.data?.session?.accessToken).toBe('access.token.value');
      expect(mockSupabaseAuth.refreshSession).toHaveBeenCalled();
    });
  });

  describe('initiateAuthKit (no-op for Supabase)', () => {
    it('returns empty URL for login mode', async () => {
      const result = await provider.initiateAuthKit('login');
      expect(result.error).toBeNull();
      expect(result.data?.url).toBe('');
    });

    it('returns empty URL for signup mode', async () => {
      const result = await provider.initiateAuthKit('signup');
      expect(result.error).toBeNull();
      expect(result.data?.url).toBe('');
    });
  });

  describe('session hint persistence (UI hint only, not a credential)', () => {
    it('persists session hint to localStorage on sign in', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      await provider.signIn('test@example.com', 'Password123!');

      const stored = window.localStorage.getItem('capflux_auth_ui_hint');
      expect(stored).not.toBeNull();
      const hint = JSON.parse(stored!);
      expect(hint.userId).toBe(mockUser.id);
      expect(hint.email).toBe('test@example.com');
    });

    it('clears session hint on sign out', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      await provider.signIn('test@example.com', 'Password123!');
      await provider.signOut();

      expect(window.localStorage.getItem('capflux_auth_ui_hint')).toBeNull();
    });
  });
});

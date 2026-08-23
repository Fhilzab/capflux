/**
 * Auth routes — LEGACY (WorkOS).
 *
 * Phase 4: Supabase Auth is the active authentication authority.
 * The frontend authenticates directly against Supabase Auth via
 * SupabaseAuthProvider. These WorkOS-based routes are preserved as a
 * rollback path and are NOT called by the current frontend.
 *
 * Do NOT delete until the migration is fully verified and WorkOS is
 * removed in a later phase.
 */
import { Router, Request, Response, CookieOptions } from 'express';
import { supabase } from '../supabaseClient.js';
import WorkOSAuthService from '../services/WorkOSAuthService.js';
import sessionService from '../services/SessionService.js';
import requireAuth from '../middleware/requireAuth.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser } from '../types/http.js';
import type { NormalizedSession } from '../services/SessionService.js';
import type { WorkosFormattedUser } from '../services/WorkOSAuthService.js';

const router = Router();
const authService = new WorkOSAuthService();

const { name: SESSION_COOKIE_NAME, options: SESSION_COOKIE_OPTIONS } =
  sessionService.cookieOptions();

// --- OAuth state cookie (CSRF protection) ---
const STATE_COOKIE_NAME = 'auth_state';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSecureEnv = process.env.COOKIE_SECURE;
const STATE_SECURE =
  cookieSecureEnv !== undefined ? cookieSecureEnv === 'true' : isProduction;

const STATE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/api',
  maxAge: 5 * 60 * 1000, // 5 minutes
  secure: STATE_SECURE,
};

/**
 * Set the canonical HttpOnly session cookie from a WorkOS authentication
 * response.
 */
const setSessionCookie = async (
  res: Response,
  authResult: { accessToken?: string } | null | undefined
): Promise<void> => {
  if (!authResult?.accessToken) return;
  try {
    const cookieValue = await sessionService.createSessionCookieValue(authResult as Parameters<typeof sessionService.createSessionCookieValue>[0]);
    res.cookie(SESSION_COOKIE_NAME, cookieValue, SESSION_COOKIE_OPTIONS);
  } catch (error) {
    // Cookie sealing failure should not break the auth response, but must be
    // logged — the client will simply not have a persisted session.
    console.error('Failed to set session cookie:', errorMessage(error) || error);
  }
};

const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
};

/**
 * Upsert the CAPFLUX `users` identity and `user_profiles` rows.
 * Authentication ONLY — no organizations, schools, or subscriptions.
 */
const upsertUserRecords = async (user: AuthUser | WorkosFormattedUser | null): Promise<void> => {
  const u = user as AuthUser | null;
  if (!u?.id || !u?.email) return;

  try {
    await supabase.from('users').upsert({
      id: u.id,
      email: u.email,
      auth_provider: 'workos',
      email_verified: Boolean(u.emailVerified),
    });
  } catch (error) {
    console.warn('Unable to upsert users record:', errorMessage(error) || error);
  }

  try {
    await supabase.from('user_profiles').upsert({
      user_id: u.id,
      full_name: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || null,
      phone: u.phone || null,
      avatar_url: u.profilePictureUrl || null,
    });
  } catch (error) {
    console.warn('Unable to upsert user_profiles record:', errorMessage(error) || error);
  }
};

const handleError = (res: Response, error: unknown, fallbackStatus = 500): Response => {
  const status = (error as { statusCode?: number })?.statusCode || fallbackStatus;
  const message = errorMessage(error) || 'Internal server error';
  const code = (error as { code?: string })?.code || 'AUTH_ERROR';
  return res.status(status).json({ error: message, code });
};

router.post('/signin', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { email, password } = body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await authService.signInWithPassword(email as string, password as string);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signup', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { fullName, email, password } = body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  try {
    const result = await authService.signUpWithPassword(email as string, password as string, fullName as string);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/google', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { redirectUri } = body;
  const redirect = (redirectUri as string) || process.env.WORKOS_REDIRECT_URI;

  if (!redirect) {
    return res.status(500).json({ error: 'WORKOS_REDIRECT_URI is not configured.' });
  }

  try {
    const url = authService.getOAuthAuthorizationUrl('google', redirect);
    return res.json({ success: true, url });
  } catch (error) {
    return handleError(res, error, 500);
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'OAuth callback code is required.' });
  }
  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'State parameter is required.' });
  }

  // Validate state against HttpOnly cookie (timing-safe comparison)
  const cookies = sessionService.parseCookieHeader(req.headers.cookie);
  const cookieState = cookies[STATE_COOKIE_NAME];
  if (!cookieState || !authService.validateAuthState(state, cookieState)) {
    res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
    return res.status(400).json({ error: 'Invalid or expired authentication state.' });
  }

  // Consume-once: clear the state cookie immediately after successful validation
  res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);

  try {
    const result = await authService.handleOAuthCallback(code);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

/**
 * GET /api/auth/session
 * Returns SAFE session information for the frontend.
 * Requires the HttpOnly session cookie (validated server-side).
 * NEVER returns refresh tokens, cookie values, or raw credentials.
 */
router.get('/session', requireAuth, async (req: Request, res: Response) => {
  return res.json({
    success: true,
    session: sessionService.safeSessionPayload({
      // requireAuth guarantees both fields before this handler runs; the
      // casts bridge the WorkOS-normalized shape to NormalizedSession.
      user: req.user as unknown as NormalizedSession['user'],
      sessionId: (req.sessionId ?? null) as string | null,
    }),
  });
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  // Identity comes from the verified WorkOS session cookie, not a client
  // supplied user id. Upsert the identity records for the authenticated user.
  try {
    await upsertUserRecords(req.user);
    return res.json({ success: true, user: req.user });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signout', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.sessionId;
    if (sessionId) {
      await sessionService.revokeSession(sessionId);
    }
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 500);
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { refreshToken } = body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const result = await authService.refreshToken(refreshToken as string);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { email } = body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    await authService.sendPasswordResetEmail(email as string);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { token, newPassword } = body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required.' });
  }

  try {
    const result = await authService.resetPassword(token as string, newPassword as string);
    await upsertUserRecords(result.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/resend-verification', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { userId, email } = body;
  if (!userId && !email) {
    return res.status(400).json({ error: 'Either userId or email is required.' });
  }

  try {
    let id = userId as string | undefined;
    if (!id) {
      const { data, error } = await supabase.from('users').select('id').eq('email', email as string).single();
      if (error || !data) {
        return res.status(404).json({ error: 'User not found.' });
      }
      id = (data as { id: string }).id;
    }

    await authService.sendVerificationEmail(id);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

/**
 * POST /api/auth/claim-account
 * Legacy Supabase → WorkOS account-claim flow.
 *
 * Accepts an email. If it belongs to an eligible legacy identity
 * (legacy_identity_migrations), CAPFLUX creates/locates the WorkOS user and
 * sends a WorkOS password-setup email. The response is GENERIC regardless of
 * whether the email is eligible, to prevent account enumeration:
 *   "If this account is eligible, you will receive an email with instructions."
 *
 * NEVER stores or exposes passwords/hashes/tokens. NEVER reveals whether an
 * arbitrary email exists.
 */
router.post('/claim-account', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { email } = body;
  const GENERIC = 'If this account is eligible, you will receive an email with instructions.';

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    // Still return the generic message so the endpoint never reveals validity.
    return res.json({ success: true, message: GENERIC });
  }

  const normalized = email.trim().toLowerCase();
  const idempotencyKey = `claim:${normalized}`;

  try {
    // 1. Look up the legacy migration record (eligible = PENDING or INVITED).
    const { data: legacy, error: legacyError } = await supabase
      .from('legacy_identity_migrations')
      .select('id, email, workos_user_id, status')
      .eq('email', normalized)
      .maybeSingle();

    // If the table doesn't exist (migrations not applied) or no record, still
    // respond generically — never reveal eligibility.
    if (legacyError || !legacy) {
      return res.json({ success: true, message: GENERIC });
    }

    const legacyRow = legacy as { id: string; status?: string; workos_user_id?: string | null; legacy_user_id?: string | null };

    // Already migrated — idempotent, no duplicate email.
    if (legacyRow.status === 'COMPLETED' || legacyRow.status === 'CLAIMED') {
      return res.json({ success: true, message: GENERIC });
    }

    // 2. Ensure a WorkOS user exists for the email (create only if absent).
    let workosUserId = legacyRow.workos_user_id || null;
    if (!workosUserId) {
      try {
        const { user } = await authService.getWorkosUserByEmail(normalized);
        workosUserId = (user as { id?: string } | null)?.id || null;
      } catch (_err) {
        workosUserId = null;
      }
      if (!workosUserId) {
        try {
          const created = await authService.createWorkosUserForClaim(normalized);
          workosUserId = created?.id || null;
        } catch (_err) {
          workosUserId = null;
        }
      }
    }

    // 3. Send WorkOS password-setup email (idempotent; safe to resend).
    try {
      await authService.sendPasswordResetEmail(normalized);
    } catch (err) {
      console.warn('[claim-account] password reset email failed:', errorMessage(err) || err);
    }

    // 4. Record INVITED state (idempotent via unique email).
    await supabase
      .from('legacy_identity_migrations')
      .upsert(
        {
          email: normalized,
          legacy_user_id: legacyRow.legacy_user_id || null,
          workos_user_id: workosUserId || undefined,
          status: 'INVITED',
          idempotency_key: idempotencyKey,
          claimed_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );

    // 5. Audit (reference only, never email-dependent disclosure).
    try {
      await supabase.from('audit_logs').insert({
        school_id: null,
        actor_id: null,
        action: 'LEGACY_ACCOUNT_CLAIMED',
        entity: 'legacy_identity_migrations',
        entity_id: legacyRow.id,
        metadata: JSON.stringify({ status: 'INVITED', idempotency_key: idempotencyKey }),
      });
    } catch (auditError) {
      // Phase 3 hardening: audit failures must never be silent. NOTE — this
      // specific event CANNOT currently persist: audit_logs.school_id is NOT
      // NULL with an FK to schools, and a pre-auth claim has no school or
      // authenticated actor. No system-level representation exists in the
      // schema (the platform helper log_audit_action resolves school via the
      // actor, which is null here). Escalated to the owner; the insert payload
      // is intentionally unchanged until a representation is decided.
      console.error(
        '[claim-account] AUDIT WRITE FAILED for LEGACY_ACCOUNT_CLAIMED:',
        errorMessage(auditError) || auditError
      );
    }

    return res.json({ success: true, message: GENERIC });
  } catch (error) {
    console.error('[claim-account] error:', errorMessage(error) || error);
    // Always return generic — never reveal failure reasons to the caller.
    return res.json({ success: true, message: GENERIC });
  }
});

export { STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS };
export default router;

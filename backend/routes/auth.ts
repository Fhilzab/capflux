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
import { workosProvisioningService } from '../services/WorkOSProvisioningService.js';
import sessionService from '../services/SessionService.js';
import { DemoAuthService, type DemoPersona, type DemoSessionPayload } from '../services/DemoAuthService.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAuthHybrid from '../middleware/requireAuthHybrid.js';
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

// SameSite must match the session cookie: 'none' in production for cross-origin
// Vercel→Render flow, 'lax' in dev. SameSite=None requires Secure=true.
const STATE_SAMESITE: 'none' | 'lax' | 'strict' =
  isProduction ? 'none' : 'lax';

const STATE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: STATE_SAMESITE,
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
 *
 * SAFETY: public.users.id and public.user_profiles.user_id are UUID columns.
 * WorkOS user IDs ("user_...") are TEXT and must NEVER be written there —
 * identity mapping belongs exclusively to public.user_identity_links (which
 * these legacy routes do not manage). If the id is not a UUID, the write is
 * skipped (authentication still succeeds; the session remains valid).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const upsertUserRecords = async (user: AuthUser | WorkosFormattedUser | null): Promise<void> => {
  const u = user as AuthUser | null;
  if (!u?.id || !u?.email) return;

  if (!UUID_RE.test(u.id)) {
    // Legacy WorkOS identity (e.g. "user_...") — not a CAPFLUX canonical UUID.
    // Skip the write rather than corrupt UUID columns. The authoritative
    // mapping for such identities is public.user_identity_links via the
    // atomic provision_workos_user RPC (webhook path).
    console.warn('Skipping users upsert: id is not a CAPFLUX UUID (legacy WorkOS identity).');
    return;
  }

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

    // JIT provisioning: ensure WorkOS user has a CAPFLUX identity
    if (result.user?.id?.startsWith('user_')) {
      try {
        await workosProvisioningService.provisionWorkOSIdentity({
          workosUserId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
          profilePictureUrl: result.user.profilePictureUrl,
        });
      } catch (provisionErr) {
        // Non-fatal for signin — the user can still authenticate.
        // Identity will be resolved on next request.
        console.error('[signin] JIT provisioning failed:', errorMessage(provisionErr));
      }
    }

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

    // Provision CAPFLUX identity (user + profile + identity link) immediately.
    // This must happen during signup, NOT only during signin, so the user
    // has a CAPFLUX UUID before email verification.
    if (result.user?.id) {
      try {
        await workosProvisioningService.provisionWorkOSIdentity({
          workosUserId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: false, // verification pending
          profilePictureUrl: result.user.profilePictureUrl,
        });
      } catch (provisionErr) {
        // Distinguish provisioning failure from verification failure.
        // If provisioning fails, the user cannot authenticate at all.
        // If verification email fails, the user can resend.
        const provisionMsg = errorMessage(provisionErr) || 'Unknown provisioning error';
        console.error('[signup] CAPFLUX provisioning failed:', provisionMsg);

        // Email already exists in CAPFLUX — this is a duplicate signup attempt
        if (provisionMsg.includes('already exists')) {
          return res.status(409).json({
            error: 'An account with this email already exists. Please sign in instead.',
            code: 'USER_ALREADY_EXISTS',
          });
        }

        // Other provisioning failure — return safe server error
        return res.status(500).json({
          error: 'Account creation failed. Please try again.',
          code: 'PROVISIONING_ERROR',
        });
      }
    }

    // No session cookie — user must verify email first
    return res.json({
      success: true,
      user: result.user,
      verificationRequired: true,
      verificationSent: result.verificationSent,
    });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/google', async (req: Request, res: Response) => {
  // Use the AuthKit callback URL for Google OAuth (production: https://capflux.vercel.app/auth/callback)
  const redirectUri = process.env.WORKOS_AUTHKIT_REDIRECT_URI;

  if (!redirectUri) {
    return res.status(500).json({ error: 'WORKOS_AUTHKIT_REDIRECT_URI is not configured.' });
  }

  try {
    const { url, state } = authService.getOAuthAuthorizationUrl('google', redirectUri);
    // Set state cookie for CSRF protection on callback (same as AuthKit flow)
    res.cookie(STATE_COOKIE_NAME, state, STATE_COOKIE_OPTIONS);
    return res.json({ success: true, url });
  } catch (error) {
    return handleError(res, error, 500);
  }
});

/**
 * GET /api/auth/authkit-url
 * Returns the WorkOS AuthKit hosted UI authorization URL.
 * Called by the frontend AuthKitProvider to initiate the AuthKit flow.
 * Mode 'login'|'signup' selects the WorkOS screen_hint 'sign-in'|'sign-up'.
 * Sets a state cookie for CSRF protection on the callback.
 */
router.get('/authkit-url', async (req: Request, res: Response) => {
  const mode = (req.query.mode as string) || 'login';
  if (!['login', 'signup'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use "login" or "signup".' });
  }

  try {
    const { url, state } = authService.getAuthKitAuthorizationUrl(mode as 'login' | 'signup');
    // Set state cookie for CSRF protection on callback
    res.cookie(STATE_COOKIE_NAME, state, STATE_COOKIE_OPTIONS);
    return res.json({ success: true, url, state });
  } catch (error) {
    return handleError(res, error, 500);
  }
});

/**
 * GET /api/auth/authkit-callback
 * Handles the WorkOS AuthKit OAuth callback.
 * Exchanges the authorization code for tokens.
 * Verifies state cookie for CSRF protection (like legacy Google OAuth flow).
 * 
 * Also handles linking for existing CAPFLUX users (Supabase Auth migration):
 * - If WorkOS user has no identity link, check legacy_identity_migrations table
 * - If legacy record exists (PENDING/INVITED), create identity link and mark COMPLETED
 * - This enables seamless migration for existing users
 */
router.get('/authkit-callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'OAuth callback code is required.' });
  }
  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'State parameter is required.' });
  }

  // Validate state against HttpOnly cookie (primary) or query param (cross-origin fallback).
  // Cross-origin requests (Vercel→Render) may not carry the cookie, so we also accept
  // state from the query parameter. The query state was set by our own frontend before
  // redirecting to Google, so it's safe to validate against.
  const cookies = sessionService.parseCookieHeader(req.headers.cookie);
  const cookieState = cookies[STATE_COOKIE_NAME];

  if (cookieState) {
    // Cookie present — validate against it (same-origin or SameSite=None succeeded)
    if (!authService.validateAuthState(state, cookieState)) {
      res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
      return res.status(400).json({ error: 'Invalid or expired authentication state.' });
    }
    // Consume-once: clear the state cookie immediately after successful validation
    res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
  } else {
    // No cookie — this is expected for cross-origin flows (Vercel→Render).
    // The state was passed by our own frontend, which got it from the backend's
    // /auth/google response. CSRF protection relies on the fact that only our
    // frontend could have obtained this state value.
    console.log('[authkit-callback] No auth_state cookie — using query state (cross-origin flow)');
  }

  try {
    const result = await authService.handleOAuthCallback(code);
    
    // JIT provisioning: ensure WorkOS user has a CAPFLUX identity
    if (result.user?.id?.startsWith('user_')) {
      try {
        await workosProvisioningService.provisionWorkOSIdentity({
          workosUserId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
          profilePictureUrl: result.user.profilePictureUrl,
        });
      } catch (provisionErr) {
        // Non-fatal for OAuth callback — the user can still authenticate.
        // Identity will be resolved on next request.
        console.error('[authkit-callback] JIT provisioning failed:', errorMessage(provisionErr));
      }
    }

    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
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

  // Validate state against HttpOnly cookie (primary) or query param (cross-origin fallback).
  const cookies = sessionService.parseCookieHeader(req.headers.cookie);
  const cookieState = cookies[STATE_COOKIE_NAME];

  if (cookieState) {
    if (!authService.validateAuthState(state, cookieState)) {
      res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
      return res.status(400).json({ error: 'Invalid or expired authentication state.' });
    }
    res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
  } else {
    console.log('[callback] No auth_state cookie — using query state (cross-origin flow)');
  }

  try {
    const result = await authService.handleOAuthCallback(code);

    // JIT provisioning: ensure WorkOS user has a CAPFLUX identity
    if (result.user?.id?.startsWith('user_')) {
      try {
        await workosProvisioningService.provisionWorkOSIdentity({
          workosUserId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
          profilePictureUrl: result.user.profilePictureUrl,
        });
      } catch (provisionErr) {
        console.error('[callback] JIT provisioning failed:', errorMessage(provisionErr));
      }
    }

    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

/**
 * GET /api/auth/session
 * Returns SAFE session information for the frontend.
 * Supports both WorkOS JWT Bearer token and HttpOnly session cookie.
 * NEVER returns refresh tokens, cookie values, or raw credentials.
 */
router.get('/session', requireAuthHybrid, async (req: Request, res: Response) => {
  return res.json({
    success: true,
    session: sessionService.safeSessionPayload({
      user: req.user as unknown as NormalizedSession['user'],
      sessionId: (req.sessionId ?? null) as string | null,
    }),
  });
});

router.get('/me', requireAuthHybrid, async (req: Request, res: Response) => {
  // Identity comes from the verified WorkOS session (Bearer token or cookie),
  // not a client supplied user id. Upsert the identity records for the authenticated user.
  try {
    await upsertUserRecords(req.user);
    return res.json({ success: true, user: req.user });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signout', requireAuthHybrid, async (req: Request, res: Response) => {
  try {
    // Try to revoke session using sessionId from either auth method
    const sessionId = req.sessionId;
    if (sessionId) {
      // Revoke via WorkOS API (triggers session.revoked webhook)
      await sessionService.revokeSession(sessionId);
      // Also record in durable database store for immediate enforcement
      const { error: revokeErr } = await supabase.rpc('revoke_workos_session', {
        p_session_id: sessionId,
        p_source: 'signout',
      });
      if (revokeErr) {
        console.error('signout: Failed to revoke session in database:', errorMessage(revokeErr));
      }
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

/**
 * POST /api/auth/demo-login
 * Sandbox-only endpoint for demo persona authentication.
 *
 * Accepts a known persona ID from the server-side allowlist and returns
 * a signed demo session token. The browser must NEVER be able to specify
 * roles, permissions, or arbitrary user IDs — the server is authoritative.
 *
 * This endpoint is ONLY available when CAPFLUX_MODE=sandbox.
 * Production deployments must reject requests to this endpoint.
 */
router.post('/demo-login', async (req: Request, res: Response) => {
  const mode = process.env.CAPFLUX_MODE?.toLowerCase();
  if (mode !== 'sandbox') {
    return res.status(404).json({ error: 'Not found' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { personaId } = body;

  if (!personaId || typeof personaId !== 'string') {
    return res.status(400).json({ error: 'personaId is required' });
  }

  try {
    const persona = DemoAuthService.validatePersona(personaId);
    const token = await DemoAuthService.createDemoSession(persona);

    return res.json({
      success: true,
      token,
      persona: {
        id: persona.id,
        email: persona.email,
        fullName: persona.fullName,
        role: persona.role,
        systemRole: persona.systemRole,
        title: persona.title,
        platformStaff: persona.platformStaff ?? false,
      },
      expiresIn: 4 * 60 * 60, // 4 hours in seconds
    });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

/**
 * GET /api/auth/demo-session
 * Validate a demo session token and return the session payload.
 *
 * Sandbox-only endpoint. Production returns 404.
 */
router.get('/demo-session', async (req: Request, res: Response) => {
  const mode = process.env.CAPFLUX_MODE?.toLowerCase();
  if (mode !== 'sandbox') {
    return res.status(404).json({ error: 'Not found' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required' });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Bearer token required' });
  }

  try {
    const payload = await DemoAuthService.verifyDemoSession(token);
    return res.json({ success: true, session: payload });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

/**
 * GET /api/auth/demo-personas
 * List available demo personas (sandbox only).
 */
router.get('/demo-personas', async (_req: Request, res: Response) => {
  const mode = process.env.CAPFLUX_MODE?.toLowerCase();
  if (mode !== 'sandbox') {
    return res.status(404).json({ error: 'Not found' });
  }

  const personas = DemoAuthService.getPersonas().map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    role: p.role,
    systemRole: p.systemRole,
    title: p.title,
    platformStaff: p.platformStaff ?? false,
  }));

  return res.json({ success: true, personas });
});

export { STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS };
export default router;

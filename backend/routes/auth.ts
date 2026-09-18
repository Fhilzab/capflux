/**
 * Auth routes — WorkOS authentication (production).
 *
 * These routes handle WorkOS-based authentication with a custom CAPFLUX-branded UI.
 * The frontend never talks to WorkOS directly — it calls /api/auth/* which
 * delegates to WorkOSAuthService and WorkOSProvisioningService.
 *
 * Identity state machine:
 *   Password signup (email not verified):
 *     status=PENDING, verified_at=NULL, migration_source=MANUAL
 *   After email verification:
 *     status=ACTIVE, verified_at=timestamp, migration_source=JIT_VERIFIED_EMAIL
 *   Google OAuth (email already verified by Google):
 *     status=ACTIVE, verified_at=timestamp, migration_source=JIT_VERIFIED_EMAIL
 *   Webhook:
 *     status=PENDING, verified_at=NULL, migration_source=WEBHOOK
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
 * SAFETY: public.users.id and public.user_profiles.user_id are UUID columns.
 * WorkOS user IDs ("user_...") are TEXT and must NEVER be written there.
 * If the id is not a UUID, the write is skipped (not a CAPFLUX UUID).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const upsertUserRecords = async (user: AuthUser | WorkosFormattedUser | null): Promise<void> => {
  const u = user as AuthUser | null;
  if (!u?.id || !u?.email) return;

  if (!UUID_RE.test(u.id)) {
    // Legacy WorkOS identity (e.g. "user_...") — not a CAPFLUX UUID (is not a UUID).
    // Skip the write rather than corrupt UUID columns.
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

/**
 * POST /api/auth/signup
 *
 * Creates a WorkOS user + CAPFLUX identity (PENDING until email verified).
 * Returns verificationRequired=true. No session is established.
 *
 * Flow:
 *   1. WorkOS createUser()
 *   2. Generate CAPFLUX UUID
 *   3. Insert public.users, public.user_profiles, public.user_identity_links
 *   4. Identity status=PENDING, verified_at=NULL, migration_source=MANUAL
 *   5. Send WorkOS verification code
 *   6. Return verificationRequired=true
 *   7. Frontend opens verification-code UI
 *
 * If CAPFLUX provisioning fails:
 *   - Return safe PROVISIONING_ERROR (no false success)
 *   - No ACTIVE identity created
 *   - Log internal failure
 */
router.post('/signup', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { fullName, email, password } = body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  let workosUserId: string | null = null;

  try {
    // Step 1: Create WorkOS user
    const result = await authService.signUpWithPassword(email as string, password as string, fullName as string);
    workosUserId = result.user?.id || null;

    if (!workosUserId) {
      console.error('[signup] WorkOS createUser returned no user ID');
      return res.status(500).json({ error: 'Account creation failed. Please try again.', code: 'PROVISIONING_ERROR' });
    }

    // Step 2-4: Provision CAPFLUX identity (PENDING — email not yet verified)
    try {
      await workosProvisioningService.provisionWorkOSIdentity({
        workosUserId,
        email: result.user!.email,
        firstName: result.user!.firstName,
        lastName: result.user!.lastName,
        emailVerified: false,
        profilePictureUrl: result.user!.profilePictureUrl,
        migrationSource: 'MANUAL',
      });
    } catch (provisionErr) {
      const provisionMsg = errorMessage(provisionErr) || 'Unknown provisioning error';
      console.error('[signup] CAPFLUX provisioning failed:', provisionMsg);

      if (provisionMsg.includes('already exists')) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in instead.',
          code: 'USER_ALREADY_EXISTS',
        });
      }

      return res.status(500).json({
        error: 'Account creation failed. Please try again.',
        code: 'PROVISIONING_ERROR',
      });
    }

    // Step 5-6: Verification code was sent by signUpWithPassword (sendVerificationEmail)
    // No session cookie — user must verify email first
    return res.json({
      success: true,
      user: result.user,
      verificationRequired: true,
      verificationSent: result.verificationSent,
    });
  } catch (error) {
    // WorkOS createUser may have succeeded but verification sending failed.
    // Distinguish: if we have a workosUserId, WorkOS user was created.
    if (workosUserId) {
      console.error('[signup] WorkOS user created but post-creation step failed:', errorMessage(error));
    }
    return handleError(res, error, 400);
  }
});

/**
 * POST /api/auth/verify-email
 *
 * Verifies a user's email with the 6-digit code from the verification email.
 * Accepts email (not userId) — the backend resolves the WorkOS user ID
 * server-side via the identity bridge. No WorkOS ID is exposed to the client.
 *
 * On success:
 *   1. WorkOS marks user as email_verified=true
 *   2. CAPFLUX users.email_verified = true
 *   3. Identity link transitions: PENDING -> ACTIVE, verified_at = timestamp
 *   4. Return verificationSuccess (user must sign in separately)
 *
 * On failure:
 *   - Return clear error (invalid code, expired code)
 *   - No session established
 *   - Identity remains PENDING
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { code, email } = body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Verification code is required.' });
  }
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Step 1: Resolve WorkOS user ID from email via the identity bridge.
    // email -> CAPFLUX users.id -> user_identity_links.workos_user_id
    const normalizedEmail = email.toLowerCase().trim();

    const { data: capfluxUser, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userErr || !capfluxUser) {
      console.error('[verify-email] CAPFLUX user not found for email:', normalizedEmail);
      return res.status(400).json({ error: 'Invalid or expired verification code.', code: 'INVALID_CODE' });
    }

    const { data: identityLink, error: linkErr } = await supabase
      .from('user_identity_links')
      .select('workos_user_id, status')
      .eq('capflux_user_id', capfluxUser.id)
      .eq('identity_type', 'workos_authkit')
      .maybeSingle();

    if (linkErr || !identityLink) {
      console.error('[verify-email] Identity link not found for CAPFLUX user:', capfluxUser.id);
      return res.status(400).json({ error: 'Invalid or expired verification code.', code: 'INVALID_CODE' });
    }

    // Guard: only PENDING identities can be verified
    if (identityLink.status !== 'PENDING') {
      if (identityLink.status === 'ACTIVE') {
        return res.json({ success: true, verificationSuccess: true, authenticated: false });
      }
      return res.status(400).json({ error: 'Invalid or expired verification code.', code: 'INVALID_CODE' });
    }

    const workosUserId = identityLink.workos_user_id;

    // Step 2: Verify email with WorkOS (marks user as email_verified=true)
    const verifyResult = await authService.verifyEmail(code, workosUserId);

    if (!verifyResult.success || !verifyResult.user) {
      return res.status(400).json({ error: 'Invalid or expired verification code.', code: 'INVALID_CODE' });
    }

    // Step 3: Update CAPFLUX users.email_verified = true
    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', capfluxUser.id);

    // Step 4: Transition identity: PENDING -> ACTIVE, set verified_at
    await supabase
      .from('user_identity_links')
      .update({
        status: 'ACTIVE',
        verified_at: new Date().toISOString(),
      })
      .eq('capflux_user_id', capfluxUser.id)
      .eq('workos_user_id', workosUserId)
      .eq('identity_type', 'workos_authkit');

    // Step 5: Return verification success — user must sign in separately.
    // WorkOS requires a password-based sign-in to obtain tokens.
    return res.json({ success: true, verificationSuccess: true, authenticated: false });
  } catch (error) {
    const msg = errorMessage(error) || '';
    if (msg.includes('invalid') || msg.includes('expired') || msg.includes('code')) {
      return res.status(400).json({ error: 'Invalid or expired verification code.', code: 'INVALID_CODE' });
    }
    return handleError(res, error, 400);
  }
});

/**
 * POST /api/auth/resend-verification
 *
 * Resends the verification code. Accepts email (not userId) for UX convenience.
 * Resolves the WorkOS user by looking up the identity link via CAPFLUX users.email.
 *
 * Safety: Always returns success to prevent account enumeration.
 * Never reveals whether an arbitrary email belongs to an account.
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { email } = body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Find CAPFLUX user by email (not for identity resolution — just to get the WorkOS user ID for resending)
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!user) {
      // Always return success — never reveal whether email exists
      return res.json({ success: true });
    }

    // Find the WorkOS identity link for this CAPFLUX user
    const { data: identityLink } = await supabase
      .from('user_identity_links')
      .select('workos_user_id')
      .eq('capflux_user_id', user.id)
      .eq('identity_type', 'workos_authkit')
      .maybeSingle();

    if (!identityLink) {
      // No identity link — still return success (never reveal)
      return res.json({ success: true });
    }

    // Resend verification email via WorkOS
    try {
      await authService.sendVerificationEmail(identityLink.workos_user_id);
    } catch {
      // Log but don't fail — always return success to prevent enumeration
      console.warn('[resend-verification] WorkOS sendVerificationEmail failed for user:', user.id);
    }

    return res.json({ success: true });
  } catch (error) {
    // Always return success — never reveal failure reasons
    return res.json({ success: true });
  }
});

/**
 * POST /api/auth/signin
 *
 * Password sign-in. If WorkOS user has no CAPFLUX identity, provisions one (JIT).
 * On success, establishes a session.
 */
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
          migrationSource: 'JIT_VERIFIED_EMAIL',
        });
      } catch (provisionErr) {
        console.error('[signin] JIT provisioning failed:', errorMessage(provisionErr));
      }
    }

    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

/**
 * POST /api/auth/google
 *
 * Initiates Google OAuth flow. Returns the WorkOS authorization URL.
 */
router.post('/google', async (req: Request, res: Response) => {
  const redirectUri = process.env.WORKOS_AUTHKIT_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).json({ error: 'WORKOS_AUTHKIT_REDIRECT_URI is not configured.' });
  }

  try {
    const { url, state } = authService.getOAuthAuthorizationUrl('google', redirectUri);
    res.cookie(STATE_COOKIE_NAME, state, STATE_COOKIE_OPTIONS);
    return res.json({ success: true, url });
  } catch (error) {
    return handleError(res, error, 500);
  }
});

/**
 * GET /api/auth/authkit-url
 * Returns the WorkOS AuthKit hosted UI authorization URL.
 */
router.get('/authkit-url', async (req: Request, res: Response) => {
  const mode = (req.query.mode as string) || 'login';
  if (!['login', 'signup'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use "login" or "signup".' });
  }

  try {
    const { url, state } = authService.getAuthKitAuthorizationUrl(mode as 'login' | 'signup');
    res.cookie(STATE_COOKIE_NAME, state, STATE_COOKIE_OPTIONS);
    return res.json({ success: true, url, state });
  } catch (error) {
    return handleError(res, error, 500);
  }
});

/**
 * GET /api/auth/authkit-callback
 *
 * Handles the WorkOS AuthKit/Google OAuth callback.
 * Exchanges the authorization code for tokens.
 * Provisions CAPFLUX identity (HARD FAIL if provisioning fails).
 *
 * For Google OAuth users:
 *   - Google has already verified the email
 *   - Identity: status=ACTIVE, migration_source=JIT_VERIFIED_EMAIL
 *   - Provisioning failure = hard error (no session)
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

  // Validate state against HttpOnly cookie (primary) or query param (cross-origin fallback)
  const cookies = sessionService.parseCookieHeader(req.headers.cookie);
  const cookieState = cookies[STATE_COOKIE_NAME];

  if (cookieState) {
    if (!authService.validateAuthState(state, cookieState)) {
      res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
      return res.status(400).json({ error: 'Invalid or expired authentication state.' });
    }
    res.clearCookie(STATE_COOKIE_NAME, STATE_COOKIE_OPTIONS);
  } else {
    console.log('[authkit-callback] No auth_state cookie — using query state (cross-origin flow)');
  }

  try {
    const result = await authService.handleOAuthCallback(code);

    // Provision CAPFLUX identity (HARD FAIL if provisioning fails)
    // Google OAuth users have email_verified=true by Google.
    if (result.user?.id?.startsWith('user_')) {
      try {
        await workosProvisioningService.provisionWorkOSIdentity({
          workosUserId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
          profilePictureUrl: result.user.profilePictureUrl,
          migrationSource: 'JIT_VERIFIED_EMAIL',
        });
      } catch (provisionErr) {
        console.error('[authkit-callback] CAPFLUX provisioning failed:', errorMessage(provisionErr));
        return res.status(500).json({
          error: 'Authentication failed. Please try again.',
          code: 'PROVISIONING_ERROR',
        });
      }
    }

    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

/**
 * GET /api/auth/callback
 * Legacy Google OAuth callback (same logic as authkit-callback).
 */
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'OAuth callback code is required.' });
  }
  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'State parameter is required.' });
  }

  // Validate state against HttpOnly cookie (primary) or query param (cross-origin fallback)
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

    // Provision CAPFLUX identity (HARD FAIL if provisioning fails)
    if (result.user?.id?.startsWith('user_')) {
      try {
        await workosProvisioningService.provisionWorkOSIdentity({
          workosUserId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          emailVerified: result.user.emailVerified,
          profilePictureUrl: result.user.profilePictureUrl,
          migrationSource: 'JIT_VERIFIED_EMAIL',
        });
      } catch (provisionErr) {
        console.error('[callback] CAPFLUX provisioning failed:', errorMessage(provisionErr));
        return res.status(500).json({
          error: 'Authentication failed. Please try again.',
          code: 'PROVISIONING_ERROR',
        });
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
  try {
    return res.json({ success: true, user: req.user });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signout', requireAuthHybrid, async (req: Request, res: Response) => {
  try {
    const sessionId = req.sessionId;
    if (sessionId) {
      await sessionService.revokeSession(sessionId);
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
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

/**
 * POST /api/auth/claim-account
 * Legacy Supabase → WorkOS account-claim flow.
 */
router.post('/claim-account', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { email } = body;
  const GENERIC = 'If this account is eligible, you will receive an email with instructions.';

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.json({ success: true, message: GENERIC });
  }

  const normalized = email.trim().toLowerCase();
  const idempotencyKey = `claim:${normalized}`;

  try {
    const { data: legacy, error: legacyError } = await supabase
      .from('legacy_identity_migrations')
      .select('id, email, workos_user_id, status')
      .eq('email', normalized)
      .maybeSingle();

    if (legacyError || !legacy) {
      return res.json({ success: true, message: GENERIC });
    }

    const legacyRow = legacy as { id: string; status?: string; workos_user_id?: string | null; legacy_user_id?: string | null };

    if (legacyRow.status === 'COMPLETED' || legacyRow.status === 'CLAIMED') {
      return res.json({ success: true, message: GENERIC });
    }

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

    try {
      await authService.sendPasswordResetEmail(normalized);
    } catch (err) {
      console.warn('[claim-account] password reset email failed:', errorMessage(err) || err);
    }

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
      console.error(
        '[claim-account] AUDIT WRITE FAILED for LEGACY_ACCOUNT_CLAIMED:',
        errorMessage(auditError) || auditError
      );
    }

    return res.json({ success: true, message: GENERIC });
  } catch (error) {
    console.error('[claim-account] error:', errorMessage(error) || error);
    return res.json({ success: true, message: GENERIC });
  }
});

/**
 * POST /api/auth/demo-login
 * Sandbox-only endpoint for demo persona authentication.
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
      expiresIn: 4 * 60 * 60,
    });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

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

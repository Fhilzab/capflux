import express from 'express';
import { supabase } from '../supabaseClient.js';
import WorkOSAuthService from '../services/WorkOSAuthService.js';
import sessionService from '../services/SessionService.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
const authService = new WorkOSAuthService();

const { name: SESSION_COOKIE_NAME, options: SESSION_COOKIE_OPTIONS } =
  sessionService.cookieOptions();

/**
 * Set the canonical HttpOnly session cookie from a WorkOS authentication
 * response.
 */
const setSessionCookie = async (res, authResult) => {
  if (!authResult?.accessToken) return;
  try {
    const cookieValue = await sessionService.createSessionCookieValue(authResult);
    res.cookie(SESSION_COOKIE_NAME, cookieValue, SESSION_COOKIE_OPTIONS);
  } catch (error) {
    // Cookie sealing failure should not break the auth response, but must be
    // logged — the client will simply not have a persisted session.
    console.error('Failed to set session cookie:', error?.message || error);
  }
};

const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
};

/**
 * Upsert the CAPFLUX `users` identity and `user_profiles` rows.
 * Authentication ONLY — no organizations, schools, or subscriptions.
 */
const upsertUserRecords = async (user) => {
  if (!user?.id || !user?.email) return;

  try {
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      auth_provider: 'workos',
      email_verified: Boolean(user.emailVerified),
    });
  } catch (error) {
    console.warn('Unable to upsert users record:', error?.message || error);
  }

  try {
    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      full_name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
      phone: user.phone || null,
      avatar_url: user.profilePictureUrl || null,
    });
  } catch (error) {
    console.warn('Unable to upsert user_profiles record:', error?.message || error);
  }
};

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await authService.signInWithPassword(email, password);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signup', async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  try {
    const result = await authService.signUpWithPassword(email, password, fullName);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/google', async (req, res) => {
  const { redirectUri } = req.body;
  const redirect = redirectUri || process.env.WORKOS_REDIRECT_URI;

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

router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'OAuth callback code is required.' });
  }

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
router.get('/session', requireAuth, async (req, res) => {
  return res.json({
    success: true,
    session: sessionService.safeSessionPayload({
      user: req.user,
      sessionId: req.sessionId,
    }),
  });
});

router.get('/me', requireAuth, async (req, res) => {
  // Identity comes from the verified WorkOS session cookie, not a client
  // supplied user id. Upsert the identity records for the authenticated user.
  try {
    await upsertUserRecords(req.user);
    return res.json({ success: true, user: req.user });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signout', requireAuth, async (req, res) => {
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

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const result = await authService.refreshToken(refreshToken);
    await upsertUserRecords(result.user);
    await setSessionCookie(res, result);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    await authService.sendPasswordResetEmail(email);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required.' });
  }

  try {
    const result = await authService.resetPassword(token, newPassword);
    await upsertUserRecords(result.user);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.post('/resend-verification', async (req, res) => {
  const { userId, email } = req.body;
  if (!userId && !email) {
    return res.status(400).json({ error: 'Either userId or email is required.' });
  }

  try {
    let id = userId;
    if (!id) {
      const { data, error } = await supabase.from('users').select('id').eq('email', email).single();
      if (error || !data) {
        return res.status(404).json({ error: 'User not found.' });
      }
      id = data.id;
    }

    await authService.sendVerificationEmail(id);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

export default router;
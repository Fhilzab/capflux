import express from 'express';
import { supabase } from '../supabaseClient.js';
import WorkOSAuthService from '../services/WorkOSAuthService.js';

const router = express.Router();
const authService = new WorkOSAuthService();

/**
 * Extract the bearer token from the Authorization header.
 * For /session and /me the frontend sends the WorkOS user ID as the bearer value.
 */
const getBearerToken = (req) => {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (!authorization || typeof authorization !== 'string') return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  return token || null;
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
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 400);
  }
});

router.get('/session', async (req, res) => {
  const userId = getBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authorization bearer token is required.' });
  }

  try {
    const user = await authService.getCurrentUser(userId);
    return res.json({ success: true, session: { user } });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.get('/me', async (req, res) => {
  const userId = getBearerToken(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authorization bearer token is required.' });
  }

  try {
    const user = await authService.getCurrentUser(userId);
    await upsertUserRecords(user);
    return res.json({ success: true, user });
  } catch (error) {
    return handleError(res, error, 401);
  }
});

router.post('/signout', async (req, res) => {
  const { sessionId } = req.body;

  try {
    await authService.signOut(sessionId);
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
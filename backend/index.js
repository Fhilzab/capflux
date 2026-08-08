import express from 'express';
import cors from 'cors';
import { supabase, hasSupabaseConfig } from './supabaseClient.js';
import webhookRoutes from './routes/webhook.js';
import paymentAccountRoutes from './routes/payment-accounts.js';
import dvaRoutes from './routes/dva.js'; // Canonical DVA lifecycle
import paymentsRoutes from './routes/payments.js';
import financialOperationsRoutes from './routes/financial-operations.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import onboardingRoutes from './routes/onboarding.js';
import kycRoutes from './routes/kyc.js';
import contextRoutes from './routes/context.js';
import financialAdminRoutes from './routes/financial-admin.js';
import requireAuth from './middleware/requireAuth.js';
import sessionService from './services/SessionService.js';
import ProviderStatusService from './services/ProviderStatusService.js';
import providerStatusRoutes from './routes/provider-status.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === 'production';

// Validate PAYMENTS_PROVIDER_MODE at startup.
try {
  ProviderStatusService.validateStartupMode();
} catch (err) {
  console.error('[startup] Provider mode validation failed:', err.message);
  process.exit(1);
}

// ==========================================================
// SECURITY MIDDLEWARE
// ==========================================================

// Basic security headers (Helmet-like, no extra dependency).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// CORS: allowlist in production; configurable via env in development.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowAllDev = process.env.CORS_ALLOW_ALL === 'true' && !isProduction;

app.use(cors({
  origin(origin, callback) {
    // Same-origin requests and non-browser clients have no Origin header.
    if (!origin || allowAllDev) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow the HttpOnly session cookie.
}));

app.use(express.json());

// ==========================================================
// RATE LIMITING
// ==========================================================

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 100); // Max requests per window
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20); // Auth endpoints

function makeRateLimiter(max) {
  return function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      return next();
    }

    const entry = rateLimitMap.get(ip);
    if (now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    return next();
  };
}

const rateLimit = makeRateLimiter(RATE_LIMIT_MAX);
const authRateLimit = makeRateLimiter(AUTH_RATE_LIMIT_MAX);

app.use(rateLimit);

// Stricter rate limiting for authentication endpoints.
app.use('/api/auth', authRateLimit);

// Payment gateway routes
app.use('/api/webhook', webhookRoutes);
// Canonical DVA lifecycle
app.use('/api/dva', dvaRoutes);
// Provider-agnostic payment accounts (DVA) routes
app.use('/api/payment-accounts', paymentAccountRoutes);
// Payment transaction routes
app.use('/api/payments', paymentsRoutes);
// Reconciliation + settlement routes (scoped under /api/operations so their
// router-level requireAuth never intercepts other /api/* paths such as /api/auth)
app.use('/api/operations', financialOperationsRoutes);
// Auth routes
app.use('/api/auth', authRoutes);
// Admin management routes (Owner/Admin authorization)
app.use('/api/admin', adminRoutes);
// Onboarding routes
app.use('/api/onboarding', onboardingRoutes);
// KYC compliance routes
app.use('/api/kyc', kycRoutes);
// Authenticated context (user/org/school/rbac) for the frontend data plane
app.use('/api/context', contextRoutes);
// Financial activation staff operations (KYC review, settlement, gateway, activation)
app.use('/api/admin', financialAdminRoutes);
// Provider status — safe configuration/capability info, no secrets.
app.use('/api/providers', providerStatusRoutes);

// Health check endpoint with detailed status
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.0.0',
    supabase: {
      configured: hasSupabaseConfig,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  };

  // Test database connectivity if configured
  if (hasSupabaseConfig) {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id', { count: 'exact', head: true });

      healthStatus.supabase.connected = !error;
      healthStatus.supabase.error = error?.message || null;
      healthStatus.database = {
        status: error ? 'error' : 'connected',
        schoolsCount: data?.length || 0,
      };
    } catch (err) {
      healthStatus.supabase.connected = false;
      healthStatus.supabase.error = err.message;
      healthStatus.database = { status: 'error' };
    }
  } else {
    healthStatus.supabase.connected = false;
    healthStatus.database = { status: 'not_configured' };
  }

  const statusCode = healthStatus.database?.status === 'error' ? 503 : 200;
  return res.status(statusCode).json(healthStatus);
});

// Allowlist of permitted RPC functions (security hardening)
// Only these functions can be called through the RPC proxy.
const PERMITTED_RPC_FUNCTIONS = [
  'student_balance',
  'school_balance',
  'trigger_apply_student_base_fees',
  'complete_onboarding',
  'get_onboarding_status',
];

// RPC proxy endpoint — requires an authenticated WorkOS session.
app.post('/rpc', requireAuth, async (req, res) => {
  if (!hasSupabaseConfig) {
    return res.status(500).json({ error: 'Supabase backend is not configured.' });
  }

  const { functionName, params } = req.body;
  if (!functionName) {
    return res.status(400).json({ error: 'functionName is required.' });
  }

  // Security: Only allow calls to whitelisted functions.
  if (!PERMITTED_RPC_FUNCTIONS.includes(functionName)) {
    return res.status(403).json({
      error: 'RPC function not permitted',
      message: `The function '${functionName}' is not in the allowed list.`,
    });
  }

  // Security: identity and scope are derived from the verified session.
  // A caller can never pass another user's id as their own.
  const callerId = req.user.id;
  const safeParams = { ...(params || {}) };

  try {
    // complete_onboarding operates on the caller's own school.
    if (functionName === 'complete_onboarding') {
      const { data: member } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', callerId)
        .eq('is_active', true)
        .single();
      if (!member) {
        return res.status(403).json({ error: 'No active school membership.' });
      }
      // Forbid targeting another school.
      if (safeParams.p_school_id && safeParams.p_school_id !== member.school_id) {
        return res.status(403).json({ error: 'Cross-school access is not permitted.' });
      }
      safeParams.p_school_id = member.school_id;
    }

    // get_onboarding_status always resolves for the caller.
    if (functionName === 'get_onboarding_status') {
      safeParams.p_user_id = callerId;
    }

    // Log sensitive administrative operations.
    if (functionName === 'complete_onboarding') {
      console.info(`[AUDIT] user ${callerId} completed onboarding for school ${safeParams.p_school_id}`);
    }

    const { data, error } = await supabase.rpc(functionName, safeParams);
    if (error) {
      return res.status(500).json({ error: error.message, details: error.details });
    }
    return res.json({ data });
  } catch (err) {
    console.error('RPC proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Error tracking endpoint - receives client-side errors
app.post('/api/log-error', express.json({ limit: '100kb' }), (req, res) => {
  const { message, stack, url, userAgent, timestamp } = req.body;

  console.error(JSON.stringify({
    type: 'CLIENT_ERROR',
    message,
    stack: stack?.substring(0, 500),
    url,
    userAgent,
    timestamp: timestamp || new Date().toISOString(),
  }));

  return res.json({ received: true });
});

app.listen(port, () => {
  console.log(`CAPFLUX backend server running on http://localhost:${port}`);
});

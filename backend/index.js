import express from 'express';
import cors from 'cors';
import { supabase, hasSupabaseConfig } from './supabaseClient.js';
import webhookRoutes from './routes/webhook.js';
import dvaRoutes from './routes/dva.js';

const app = express();
const port = Number(process.env.PORT || 4000);

// Rate limiting (basic in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // Max requests per window

function rateLimit(req, res, next) {
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
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  return next();
}

app.use(cors());
app.use(express.json());
app.use(rateLimit);

// Payment gateway routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/dva', dvaRoutes);

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
// Only these functions can be called through the RPC proxy
const PERMITTED_RPC_FUNCTIONS = [
  'student_balance',
  'school_balance',
  'trigger_apply_student_base_fees',
];

// RPC proxy endpoint
app.post('/rpc', async (req, res) => {
  if (!hasSupabaseConfig) {
    return res.status(500).json({ error: 'Supabase backend is not configured.' });
  }

  const { functionName, params } = req.body;
  if (!functionName) {
    return res.status(400).json({ error: 'functionName is required.' });
  }

  // Security: Only allow calls to whitelisted functions
  if (!PERMITTED_RPC_FUNCTIONS.includes(functionName)) {
    return res.status(403).json({
      error: 'RPC function not permitted',
      message: `The function '${functionName}' is not in the allowed list.`,
    });
  }

  try {
    const { data, error } = await supabase.rpc(functionName, params || {});
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
  console.log(`Capstone backend server running on http://localhost:${port}`);
});
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
}

/**
 * Creates a fetch function with a timeout.
 * The default fetch in Node.js has no timeout, which can cause webhook requests
 * to hang indefinitely if the Supabase RPC/database is slow.
 */
function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

// 15 second timeout for Supabase RPC/database operations
// This should be less than WorkOS webhook timeout (typically 10-30s)
// and Render's request timeout (30s default)
const FETCH_TIMEOUT_MS = 15000;

const fetchWithTimeout = createFetchWithTimeout(FETCH_TIMEOUT_MS);

export const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);

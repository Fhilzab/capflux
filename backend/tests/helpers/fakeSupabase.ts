/**
 * fakeSupabase — test-only typed boundary for Supabase client mocking.
 *
 * The JS behavioral oracles patch `supabase.from` / `supabase.rpc` /
 * `supabase.auth.getUser` with scenario-specific mock shapes that cannot
 * structurally satisfy the real SupabaseClient types. This helper isolates
 * that mismatch behind ONE documented seam so individual test files stay
 * fully typed elsewhere.
 *
 * Rules:
 *   - Production types are NOT modified.
 *   - No `any`: handlers are typed as unknown-returning functions; the single
 *     boundary cast lives here and nowhere else.
 *   - Handlers receive the exact table/fn name so tests can assert routing.
 */
import { supabase } from '../../supabaseClient.js';

/** Result shape common to PostgREST responses. */
export interface FakePostgrestResult {
  data: unknown;
  error: { code?: string; message: string; details?: unknown } | null;
  count?: number | null;
  status?: number;
}

export function okSingle(row: unknown): FakePostgrestResult {
  return { data: row, error: null, count: null, status: 200 };
}

export function errSingle(code: string, message: string): FakePostgrestResult {
  return { data: null, error: { code, message }, count: 0, status: 406 };
}

/** Chainable, awaitable stand-in for PostgrestFilterBuilder (then-only, like the real builder). */
export class FakeBuilder {
  protected _result: FakePostgrestResult | Promise<FakePostgrestResult>;

  constructor(result: FakePostgrestResult | Promise<FakePostgrestResult>) {
    this._result = result;
    for (const m of [
      'select', 'eq', 'neq', 'in', 'gte', 'lte', 'order', 'limit', 'range',
      'single', 'maybeSingle', 'update',
    ] as const) {
      (this as unknown as Record<string, unknown>)[m] = () => this;
    }
  }

  insert(_values?: unknown): this { return this; }
  upsert(_values?: unknown, _opts?: unknown): this { return this; }
  delete(): this { return this; }

  /** Subclasses may override to vary the awaited result dynamically. */
  protected resolve(): FakePostgrestResult | Promise<FakePostgrestResult> {
    return this._result;
  }

  then<TResult1 = FakePostgrestResult, TResult2 = never>(
    onfulfilled?: ((value: FakePostgrestResult) => TResult1 | PromiseLike<TResult1>) | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

export type TableHandler = (table: string) => FakeBuilder;

interface RestoreHandle {
  restore: () => void;
}

/**
 * Replace the singleton's data plane with scenario handlers.
 * Returns a restore function; call it in afterEach/after.
 */
export function installFakeSupabase(handlers: {
  from: TableHandler;
  rpc?: (fn: string, params: Record<string, unknown>) => FakeBuilder;
  getUser?: (token: string) => Promise<{ data: { user: unknown }; error: null }>;
}): RestoreHandle {
  const originalFrom = supabase.from;
  const originalRpc = supabase.rpc;
  const originalGetUser = supabase.auth.getUser;

  // ── The single documented boundary cast (test-only) ─────────────────────
  supabase.from = ((table: string) =>
    handlers.from(table)) as unknown as typeof supabase.from;

  if (handlers.rpc) {
    const rpcHandler = handlers.rpc;
    supabase.rpc = ((fn: string, params: Record<string, unknown>) =>
      rpcHandler(fn, params ?? {})) as unknown as typeof supabase.rpc;
  }

  if (handlers.getUser) {
    const getUserHandler = handlers.getUser;
    supabase.auth.getUser = (token: string) =>
      getUserHandler(token) as unknown as ReturnType<typeof supabase.auth.getUser>;
  }

  return {
    restore: () => {
      supabase.from = originalFrom;
      supabase.rpc = originalRpc;
      supabase.auth.getUser = originalGetUser;
    },
  };
}

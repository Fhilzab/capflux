/**
 * http — shared HTTP/error types for the CAPFLUX backend.
 *
 * The legacy JavaScript code attached `code` / `statusCode` to plain Error
 * objects (via Object.assign or direct assignment). AppError preserves that
 * contract; the narrowing helpers below mirror raw JS property-access
 * semantics (`err?.message`, `err.code === '23505'`) so migration does not
 * change observable error behavior.
 */

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  status?: number;
}

/** Build an Error with the legacy attached fields (same runtime shape as the JS code). */
export function appError(message: string, extra: { code?: string; statusCode?: number } = {}): AppError {
  return Object.assign(new Error(message), extra) as AppError;
}

/**
 * Mirror of `err?.message`: returns the `message` property when it is a
 * string, otherwise undefined. Never throws on null/undefined/primitives.
 */
export function errorMessage(e: unknown): string | undefined {
  if (e !== null && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    return typeof m === 'string' ? m : undefined;
  }
  return undefined;
}

/** Mirror of `err?.code` for string codes. */
export function errorCode(e: unknown): string | undefined {
  if (e !== null && typeof e === 'object' && 'code' in e) {
    const c = (e as { code?: unknown }).code;
    return typeof c === 'string' ? c : undefined;
  }
  return undefined;
}

/** Mirror of `err?.statusCode`. */
export function errorStatusCode(e: unknown): number | undefined {
  if (e !== null && typeof e === 'object' && 'statusCode' in e) {
    const s = (e as { statusCode?: unknown }).statusCode;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

/** Mirror of `err?.status` (WorkOS SDK exposes HTTP status here). */
export function errorStatus(e: unknown): number | undefined {
  if (e !== null && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

/** Mirror of `error.code === code` used for Postgres unique-violation checks. */
export function hasErrorCode(e: unknown, code: string): boolean {
  return errorCode(e) === code;
}

// ── Express request augmentation ─────────────────────────────────────────
// The auth middlewares attach these. `user` is declared non-optional because
// every route that reads it sits behind router.use(requireAuthSupabase) —
// same assumption the original JavaScript made.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Trusted authenticated identity (Supabase public.users row, or WorkOS normalized user on the legacy path). */
      user: AuthUser;
      supabaseUser?: SupabaseAuthUser;
      token?: string;
      sessionId?: string | null;
      organizationId?: string | null;
      authenticationMethod?: string | null;
      roles?: string[];
      schoolId?: string;
      staffRoles?: string[];
    }
  }
}

/**
 * Authenticated identity. Covers both shapes historically attached to
 * req.user:
 *  - requireAuthSupabase → public.users row (snake_case columns)
 *  - requireAuth (legacy WorkOS) → SessionService.normalize() user (camelCase)
 */
export interface AuthUser {
  id: string;
  email?: string;
  // Supabase users row
  auth_provider?: string | null;
  email_verified?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Legacy WorkOS normalized user
  firstName?: string;
  lastName?: string;
  fullName?: string;
  emailVerified?: boolean;
  profilePictureUrl?: string | null;
  phone?: string | null;
}

/** Minimal shape of a verified Supabase Auth user (supabase.auth.getUser). */
export interface SupabaseAuthUser {
  id: string;
  email?: string;
  aud?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

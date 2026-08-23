/**
 * requireAuthSupabase — Supabase Auth authentication middleware.
 *
 * Validates the Supabase access token sent as:
 *   Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
 *
 * Flow:
 *   1. Read Authorization header.
 *   2. Verify Bearer token exists.
 *   3. Ask Supabase to validate the token (supabase.auth.getUser).
 *   4. Reject invalid/expired tokens with HTTP 401.
 *   5. Attach the authenticated Supabase user to req.supabaseUser.
 *   6. Resolve the corresponding CAPFLUX application user from public.users.
 *   7. Attach the CAPFLUX user to req.user.
 *
 * Never trusts user IDs supplied by request bodies or headers (x-user-id,
 * x-school-id). Identity is established ONLY from the validated JWT.
 *
 * This middleware runs alongside the legacy WorkOS requireAuth — it is not
 * a replacement until the migration is complete and WorkOS routes are removed.
 */
import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser, SupabaseAuthUser } from '../types/http.js';

export async function requireAuthSupabase(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    // 1. Read Authorization header.
    const authHeader = req.headers.authorization;

    // 2. Verify Bearer token exists.
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    // 3. Ask Supabase to validate the token.
    const { data: { user: supabaseUser }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !supabaseUser) {
      return res.status(401).json({ error: 'Unauthorized: invalid or expired token.' });
    }

    // 6. Resolve the corresponding CAPFLUX application user.
    const { data: appUser, error: appError } = await supabase
      .from('users')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (appError || !appUser) {
      return res.status(401).json({ error: 'Unauthorized: CAPFLUX user not found.' });
    }

    // 5. Attach the authenticated users to the request.
    // req.user carries the trusted CAPFLUX identity (matches existing requireAuth shape).
    req.user = appUser as unknown as AuthUser;
    req.supabaseUser = supabaseUser as unknown as SupabaseAuthUser;
    req.token = token;

    // req.user already carries school membership resolution via AuthorizationService
    // (same as the WorkOS requireAuth path). Routes that need school scope should
    // use AuthorizationService.getSchoolMembership(req.user.id, schoolId).
    return next();
  } catch (error) {
    console.error('requireAuthSupabase error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: authentication failed.' });
  }
}

export default requireAuthSupabase;

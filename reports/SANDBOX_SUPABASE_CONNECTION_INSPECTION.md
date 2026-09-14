# CAPFLUX SANDBOX SUPABASE CONNECTION INSPECTION

**Date:** 2026-09-14 (UTC) · **Scope:** read-only inspection, sandbox only · **Production:** untouched

## 1. Verdict

**CONFIGURATION MISMATCH** — the code, SDK, key format, project, and schema are all proven working with a live read-only query; the Render service's runtime (its env values or its network path) differs. Network/egress is the P1 alternative; the exact thrown value is only visible in Render logs.

## 2. Evidence

- `backend/supabaseClient.ts:6-11,42-51` — sole client; `createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {auth:{persistSession:false}, global:{fetch: 15s-timeout fetch}})`; throws at boot only if a var is *absent*.
- `backend/index.ts:3,157-204` — `/health` imports that client; query `supabase.from('schools').select('id', {count:'exact', head:true})` (`index.ts:176-178`); builds `schoolsCount` at `:185`.
- `backend/types/http.ts:26-32` — `errorMessage()` returns `undefined` for any non-object throw.
- Live reproduction from this machine with the sandbox project credentials: `status=200, count=4, error=null` — project healthy, key valid, SDK compatible, `schools` table readable.
- Live network: DNS resolves (172.64.149.246 / 104.18.38.10), `https://…supabase.co/rest/v1/` → 401 in 0.69s (routing/TLS fine; project **not paused**).
- Single `createClient` in backend src; no `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` server usage; `SANDBOX_DATABASE_URL` appears only in the validator's sandbox-never-on-prod list (`services/RuntimeConfiguration.ts:45-48`) — **no code path can select a different project when `CAPFLUX_MODE=sandbox`**; project selection is purely `SUPABASE_URL`.
- Startup validation (`index.ts:29-40`) exits 1 on mode/DB-env mismatch and on prod credentials in sandbox mode — the service boots, so mode vars are consistent.

## 3. Supabase Client Construction

`supabaseClient.ts` → `dotenv.config()` (no-op when no `.env` file, as on Render; never clears process env) → reads **`SUPABASE_URL`** + **`SUPABASE_SECRET_KEY`** (the only two server credential vars; canonical per `.env.example:20-24`) → one shared `createClient` with `persistSession:false` and a 15s abort-timeout fetch. No per-mode branching, no credential transformation, no wrapper.

## 4. Secret-Key Compatibility

**Compatible.** Installed `@supabase/supabase-js@2.112.2` (`backend/package.json: ^2.110.0`) sends the key as `apikey`/`Authorization` bearer without JWT-decoding it, and the `sb_secret_…` format was **proven working end-to-end**: authenticated count query → HTTP 200. `sb_secret_` must stay server-side only (RLS-bypassing, like the legacy service_role) — current usage complies. Do NOT "fix" by demanding an `eyJ…` JWT.

## 5. Health Endpoint

`connected:false` + `database.status:error` with `error:null` means the query **threw** (catch branch, `index.ts:187-192`) rather than returning a PostgREST `{error}` (which always carries `.message` and would display). `error:null` specifically means the thrown value had **no string `.message`** (`errorMessage()` → `undefined` → JSON null) — i.e. a transport-level or non-Error rejection inside Render's runtime, not an API/schema rejection. The endpoint has no timeout/retry/DNS handling of its own beyond the client's 15s fetch abort.

## 6. Network Tests

- DNS `jwvwetwlexvgbtzamxvb.supabase.co` → resolves (PASS)
- HTTPS `GET /rest/v1/` → 401 in 0.69s, project responding (PASS — not paused)
- Postgres `db.…` DNS → resolves IPv6 (PASS); `nc` unavailable, direct 5432 not tested (not needed — backend uses HTTPS/PostgREST only)

## 7. Environment Selection

Sandbox resolves solely via `SUPABASE_URL`; there is **no code path** that can substitute the production project under `CAPFLUX_MODE=sandbox`. Startup validator additionally kills the process if prod payment/webhook/provider credentials appear in sandbox mode. Selection logic is safe; the failure is in the *values/reachability* at runtime, not selection.

## 8. Root Cause

- **P0 — Render runtime env/network mismatch (most likely):** same code + same project + same key format succeeds from here, so Render's `SUPABASE_URL`/`SUPABASE_SECRET_KEY` values differ (stale/rotated/mistyped) or Render's egress can't complete TLS to Supabase. Read the Render service Logs at the next `GET /health` for the unhandled rejection shape to split these two.
- **P1 — Transport-level throw with poor serialization:** whatever the cause, the health handler records `undefined` instead of the real error (consider logging the full error server-side in future — suggestion only, not implemented).
- **P2 — `schoolsCount` is always 0:** with `head:true`, `data` is `null` even when healthy; use the returned `count` instead (cosmetic; suggestion only).

## 9. Recommended Fix

On the Render `capflux-sandbox-api` service only: verify `SUPABASE_URL` is exactly the sandbox URL and `SUPABASE_SECRET_KEY` is the current sandbox `sb_secret_…` value (rotate in Supabase dashboard if unsure), redeploy/restart, then re-check `/health`. If it still 503s, pull the service log line for the thrown value — that distinguishes bad-value from egress-blocked. No code, migration, or data changes are indicated.

## 10. Production Safety

Production code unchanged · configuration unchanged · production database untouched (never connected) · sandbox database untouched (two SELECT-count probes only, zero writes) · no secrets printed/committed/written (only the `sb_secret_` prefix inspected) · no deployment triggered · no service restarted · no repo files created/modified/deleted during inspection.

## 11. Commands Executed

`pwd`; `git status --short`; `git branch --show-current`; `git log -5 --oneline`; `grep -RIn SUPABASE_SECRET_KEY backend/`; `grep createClient` (backend src); `grep schoolsCount`; `grep SUPABASE_SERVICE_ROLE_KEY|ANON`; `npm ls @supabase/supabase-js`; `git ls-files backend/.env`; redacted `SUPABASE_URL` host + key-prefix probes via `node -e` (prefix only); `getent hosts` (project + `db.` host); `curl -I https://…/rest/v1/`; live read-only probes via `node --import=tsx` (`select id, count exact, head true` → 200/count=4); `rm` of temp probes; final `git status`.

## 12. Final Recommendation

Operator: fix the Render sandbox env values (or unblock its Supabase egress per the service log), restart, confirm `/health` 200 `connected`, then proceed with `DEMO_SESSION_SECRET` + the browser pass. Nothing in application code needs to change.

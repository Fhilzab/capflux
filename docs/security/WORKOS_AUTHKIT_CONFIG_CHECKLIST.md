# CAPFLUX WorkOS AuthKit — Configuration Checklist

> Phase 0C structure: WORKOS DASHBOARD · SUPABASE DASHBOARD · CAPFLUX
> ENVIRONMENT. Placeholders `<ANGLE_BRACKETS>` are filled from live dashboards
> at configuration time. No secret values ever appear in this file.
> ⚠️ ORDER markers are hard sequencing constraints.

---

## WORKOS DASHBOARD

### Environment separation
- [ ] Staging environment created (FREE per workos.com/pricing) for all rehearsal
- [ ] Production environment separate; only production is billed

### Domain (D6 — CLOSED 2026-08-23)
- [x] **DECIDED:** initial deployment uses the DEFAULT WorkOS AuthKit-hosted
      authentication domain. No custom domain is configured now.
- [ ] The custom CAPFLUX domain is intentionally DEFERRED (owner decision) and
      is NOT an implementation blocker. When introduced later it follows the
      original ordering: configure in WorkOS → ACTIVE → update issuer value →
      re-verify Supabase third-party integration → verify JWT probe.

### Configuration-driven issuer rule (MANDATORY, all environments)
- [ ] Issuer/redirects/client identity exist ONLY as configuration:
      `AUTH_ISSUER`, `AUTH_REDIRECT_URI` (+ existing `WORKOS_AUTHKIT_REDIRECT_URI`
      until renamed in implementation), `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`,
      `WORKOS_ENVIRONMENT`; OPTIONAL future override
      `WORKOS_CUSTOM_AUTH_DOMAIN` (empty by default; when set it derives the
      issuer hostname instead of the default WorkOS domain)
- [ ] NO WorkOS hostname hard-coded in frontend/backend source — enforced by a
      review grep-gate from Phase 6 onward (default-domain election makes this
      check trivial: zero occurrences expected)

### AuthKit
- [ ] Email + Password ON (required for hash-port cohort)
- [ ] Email verification REQUIRED; breached-password protection ON;
      password strength policy per docs/security/authentication.md baseline
- [ ] Signups DISABLED until import window completes, then ENABLED at cutover

### Password migration / import (D1)
- [ ] Import executed via Create User API (`passwordHash`,
      `passwordHashType:'bcrypt'`) or official migrations CLI from backend host
- [ ] Post-import spot-check list signed (N≥20 incl. ALL privileged sample)

### Google OAuth (D4 — approved set)
- [ ] Google provider configured via AuthKit wizard (its generated redirect
      URIs copied verbatim); Microsoft / Apple / GitHub remain OFF

### MFA (D9 schedule)
- [ ] Stage 1: optional enrollment available; no mandates at cutover
- [ ] Later stages enabled per D9 triggers (TOTP-first)

### Redirect URIs & allowed origins
- [ ] staging: `https://<STAGING_FRONTEND_HOST>/auth/callback`
- [ ] production: `https://<PRODUCTION_FRONTEND_HOST>/auth/callback`
- [ ] local dev: `http://localhost:5173/auth/callback`
- [ ] App homepage URL per environment = frontend origin

### JWT template (D2/C1 — REQUIRED)
- [ ] Authentication → Sessions → JWT Template containing exactly:
      `{ "role": "authenticated", "user_role": {{organization_membership.role}} }`

### Webhooks
- [ ] Endpoint `https://<BACKEND_HOST>/api/webhooks/workos`
- [ ] Events: `user.created`, `user.updated`, `user.deleted`, `session.revoked`
- [ ] Signing secret `<WORKOS_WEBHOOK_SECRET>` → backend secret store only

### Issuer record (for Supabase step)
- [ ] `AUTH_ISSUER` = default WorkOS issuer:
      `https://api.workos.com/user_management/<WORKOS_CLIENT_ID>`
      (value lives in configuration; when a custom domain is introduced later,
      ONLY this value changes — nothing else in the architecture)

## SUPABASE DASHBOARD

### Third-party authentication (staging first)
- [ ] ⚠️ ORDER (issuer final from configuration): Authentication →
      Third-Party Auth → Add WorkOS integration with the configured
      `AUTH_ISSUER` value — NEVER configure against an unverified issuer
- [ ] JWKS fetch status healthy in integration indicator

### Issuer / JWKS / JWT validation
- [ ] Probe (C1): real WorkOS token through Data API ⇒ Postgres role
      `authenticated`; result recorded as C1 evidence

### Redirect URLs & auth settings
- [ ] Site URL + redirect allowlist unchanged during dual window
      (legacy recovery still routes `/auth/callback`)
- [ ] Native providers stay ENABLED through the window; disabled only in
      Phase 12 (never delete project/auth data)

### RLS verification
- [ ] NO hand edits — migrations `202608230002`/`202608230003` only
- [ ] After Phase 8: run CR §13 fail-closed matrix — 100% pass required

## CAPFLUX ENVIRONMENT

### Required variables (names only — values in platform secret stores)

Backend:
| Variable | Environments | Note |
|---|---|---|
| WORKOS_API_KEY | dev/staging/prod | rotate from any pilot value |
| WORKOS_CLIENT_ID | dev/staging/prod | non-secret |
| WORKOS_CLIENT_SECRET | if SDK config requires | secret |
| WORKOS_COOKIE_PASSWORD | distinct ≥32-char random PER ENV | secret |
| WORKOS_WEBHOOK_SECRET | staging/prod | secret |
| WORKOS_AUTHKIT_REDIRECT_URI | per-env callback URL | |
| AUTH_PROVIDER_MODE | `supabase_only\|dual\|workos_primary\|workos_only` | D5 flag |
| SUPABASE_URL / SUPABASE_SECRET_KEY | existing | KEEP; post-migration rotation scheduled |

Frontend:
| Variable | Note |
|---|---|
| VITE_AUTH_PROVIDER | `supabase` → `workos` rollout flag |
| VITE_API_BASE_URL | existing |
| VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY | existing (sync plane) |
| VITE_WORKOS_CLIENT_ID | REMOVE (unused by target design) |

### Development
- [ ] localhost redirect URI registered in STAGING WorkOS env;
      `COOKIE_SECURE=false`; `AUTH_PROVIDER_MODE=dual`

### Staging
- [ ] Full checklist above executed on staging environment; import dry-run +
      sample sign-ins verified; C1 probe recorded

### Production
- [ ] Every staging item mirrored; D6 ordering complete BEFORE issuer config
- [ ] Monitoring live pre-cutover: auth success/fail rates, link failures,
      webhook delivery, sync-plane auth errors

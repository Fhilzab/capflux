# WorkOS AuthKit Configuration

> **Status:** Active (Milestone 9)
> **Related:** [Authentication Security](authentication.md)

## Overview

CAPFLUX uses **WorkOS AuthKit Hosted UI** as the authoritative authentication
flow. The frontend displays a CAPFLUX-branded entry page, then redirects the
browser to the WorkOS-hosted sign-in/sign-up screen. WorkOS owns the
authentication form, password policy, email verification, and all validation.
The backend exchanges the authorization code, upserts user records, and
establishes the `workos_session` HttpOnly cookie.

## Architecture Flow

```
CAPFLUX AuthView (/auth?mode=login|signup)
  → GET /api/auth/authkit-url?mode=login|signup  (backend generates URL)
  → WorkOS AuthKit Hosted UI (sign-in or sign-up screen)
  → WorkOS authentication (password policy, breach check, email verification)
  → WorkOS redirect to /auth/callback?code=<code>
  → AuthView picks up code from URL, calls GET /api/auth/callback?code=<code>
  → Backend exchanges code, upserts public.users + user_profiles, sets workos_session cookie
  → AuthView redirects to /dashboard
```

## Environment Variables Required

### Backend (server-only — never exposed to frontend)

| Variable | Description | Example |
|---|---|---|
| `WORKOS_API_KEY` | WorkOS secret API key | `sk_...` |
| `WORKOS_CLIENT_ID` | WorkOS application client ID | `client_...` |
| `WORKOS_CLIENT_SECRET` | WorkOS client secret (if using confidential client) | `your-workos-client-secret` |
| `WORKOS_REDIRECT_URI` | Redirect URI for AuthKit callback | `http://localhost:5173/auth/callback` |
| `WORKOS_COOKIE_PASSWORD` | Secret for sealing the session cookie (>=32 chars) | *(random 32+ char string)* |

### Frontend (client-safe — only VITE_ prefixed vars)

| Variable | Description | Value |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:4000/api` |

**Never** expose `WORKOS_API_KEY`, `WORKOS_CLIENT_SECRET`, or `WORKOS_COOKIE_PASSWORD`
to the frontend. The frontend only needs `VITE_API_BASE_URL`; all WorkOS
interaction goes through backend `/api/auth/*` endpoints.

## WorkOS Dashboard Configuration (Local Development)

### 1. Application Settings

- **Application Type:** AuthKit
- **Client ID:** Use the existing `WORKOS_CLIENT_ID` from `.env`
- **Redirect URIs:** Add the following for local development:
  - `http://localhost:5173/auth/callback` — AuthKit callback
  - `http://localhost:5173/auth?provider=google` — Google OAuth callback (legacy)

### 2. AuthKit Configuration

- **Authentication Flows:** Email + Password enabled
- **Sign-in screen:** Enabled (shows existing user form)
- **Sign-up screen:** Enabled (shows new user form)
- **Email verification:** Enabled (required before dashboard access)
- **Password reset:** Enabled (WorkOS manages reset emails)

### 3. Allowed Origins

For local development, add:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

### 4. Social Connections (Optional)

If using Google OAuth alongside AuthKit:
- **Google:** OAuth client configured with:
  - Redirect URI: `http://localhost:5173/auth?provider=google`
  - Authorized JavaScript origins: `http://localhost:5173`

### 5. Branding (Configurable in WorkOS Dashboard)

AuthKit Hosted UI respects your WorkOS application's branding settings:
- Logo
- Primary color
- Font family
- Sign-in/sign-up screen customization

## Backend Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/authkit-url?mode=login\|signup` | Returns the AuthKit authorization URL |
| `GET` | `/api/auth/callback?code=<code>` | Exchanges code, upserts user records, sets session cookie |
| `GET` | `/api/auth/session` | Returns safe session info (requires cookie) |
| `GET` | `/api/auth/me` | Returns authenticated user info |
| `POST` | `/api/auth/signout` | Revokes WorkOS session and clears cookie |
| `POST` | `/api/auth/google` | Generates Google OAuth URL (legacy) |

## Session Architecture

The `workos_session` cookie is the authoritative session credential:

- **Name:** `workos_session`
- **HttpOnly:** Yes (never readable by JavaScript)
- **SameSite:** Lax
- **Path:** `/api`
- **Secure:** `true` in production (HTTPS); `false` in local dev (HTTP)
- **Cookie Password:** `WORKOS_COOKIE_PASSWORD` (server-side only, used to seal/unseal)

The frontend only stores a **non-authoritative UI hint** in `localStorage`
(`capflux_auth_ui_hint`) with the user's ID and email — never tokens or
credentials. Session verification always occurs server-side via
`SessionService.authenticateRequest`.

# CAPFLUX — Provider Capability Matrix

> Updated: Milestone 7. No production credentials available.
> Production activation remains BLOCKED_PENDING_PROVIDER_ACCESS.

## Capability tiers

| Tier | Description |
|------|-------------|
| `CODE_VERIFIED` | Method exists, contract tested, no API call made |
| `SANDBOX_API_VERIFIED` | Real sandbox API call succeeded |
| `PRODUCTION_API_UNVERIFIED` | Production credentials absent or not attempted |
| `PRODUCTION_READY` | Production credentials present + explicit activation |
| `SANDBOX_CAPABILITY_UNAVAILABLE` | Sandbox/test API does not support this operation |
| `PROVIDER_CAPABILITY_UNAVAILABLE` | Provider does not support this operation at any tier |

## Monnify

| Capability | Status |
|------------|--------|
| DVA creation | CODE_VERIFIED |
| DVA lookup | CODE_VERIFIED |
| DVA deactivation | CODE_VERIFIED |
| Transaction verification | CODE_VERIFIED |
| Transaction listing | CODE_VERIFIED |
| Webhook signature verification | CODE_VERIFIED |
| Settlement status | CODE_VERIFIED |
| Settlement execution | SANDBOX_CAPABILITY_UNAVAILABLE |

## Paystack

| Capability | Status |
|------------|--------|
| DVA creation | CODE_VERIFIED |
| DVA lookup | CODE_VERIFIED |
| DVA deactivation | CODE_VERIFIED |
| Transaction verification | CODE_VERIFIED |
| Transaction listing | CODE_VERIFIED |
| Webhook signature verification | CODE_VERIFIED |
| Settlement status | CODE_VERIFIED |
| Settlement execution | SANDBOX_CAPABILITY_UNAVAILABLE |

## Identity Verification

| Capability | Mock | Approved (Fincra) | Status |
|------------|------|-------------------|--------|
| NIN/BVN identifier validity (11-digit) | CODE_VERIFIED | — | Fincra: PENDING_PROVIDER |
| Verified name | SANDBOX_CAPABILITY_UNAVAILABLE (mock; identifier-only) | — | Fincra capability unconfirmed |
| Verified date of birth | SANDBOX_CAPABILITY_UNAVAILABLE (mock) | — | Fincra capability unconfirmed |
| Verified phone | SANDBOX_CAPABILITY_UNAVAILABLE (mock) | — | Fincra capability unconfirmed |
| Encrypted NIN/BVN at rest | CODE_VERIFIED | — | — |

> CAPFLUX does **not** assume any identity provider returns a fixed set of fields. Each provider
> declares `getCapabilities()`; `verifyIdentity()` returns `verifiedFields` (only what the provider
> actually returned this run). Matching is capability-aware — an unreturned field is
> `NOT_PROVIDED`, never `MISMATCH`. The mock is deliberately capability-conservative
> (identifier-only) so local dev never fabricates PII.

## Settlement Verification

| Capability | Mock | Approved (Fincra) | Status |
|------------|------|-------------------|--------|
| Bank account existence | CODE_VERIFIED | — | Fincra: PENDING_PROVIDER |
| Verified account name (name enquiry) | CODE_VERIFIED | — | Fincra: PENDING_PROVIDER |
| BVN ownership of account | NOT_VERIFIED (BVN is a SEPARATE identity verification) | — | Fincra: PENDING_PROVIDER |

> Account-name enquiry and BVN ownership are **separate** concepts. CAPFLUX applies its own
> ownership rule (account name matches verified owner) on top of provider evidence.

## Fincra

- **Status: PENDING_PROVIDER** — no Fincra credentials; no Fincra API contract verified.
- Integration path: `FincraIdentityProvider` / `FincraSettlementProvider` adapters behind
  `IDENTITY_VERIFICATION_PROVIDER=approved` / `SETTLEMENT_VERIFICATION_PROVIDER=approved`.
  `getProvider()` refuses in production without approved credentials.
- Fincra capabilities (name/DOB/phone/BVN/name-enquiry) must be CONFIRMED from Fincra's API
  before being declared — do not invent fields.
- Until confirmed, the capability-aware contract + the `mock` provider cover development and tests
  without assuming provider behaviour.

## Provider activation requirements

To transition from `PROVIDER_SANDBOX` to `PROVIDER_PRODUCTION_ACTIVE`, each provider must satisfy:

1. Production credentials configured in server environment (`<PROVIDER>_ENV=production`)
2. `PAYMENTS_PROVIDER_MODE=production` set explicitly
3. NODE_ENV=production (enforced at startup)
4. Provider sandbox capability matrix filled with SANDBOX_API_VERIFIED entries
5. All provider secrets verified present and valid (no placeholder values)
6. Webhook secret configured and verified
7. Provider contract tests pass
8. No mock/test gateway registered (auto-guarded at startup)

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

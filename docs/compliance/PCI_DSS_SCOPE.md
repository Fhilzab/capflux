# CAPFLUX PCI DSS Scope Audit

**Audit date:** 2026-08-23.

## Method

Whole-repo search (source, migrations, types, frontend, docs, tests) for cardholder-data indicators: PAN patterns (`\b4[0-9]{12}(?:[0-9]{3})?`-class regexes in code paths that persist), field names: `card_number|pan|cvv|cvc|expiry|exp_month|exp_year|cardholder`.

## Results

| Check | Result |
|---|---|
| PAN storage (DB columns) | **NOT FOUND** — no column in any migration or generated type |
| CVV/CVC anywhere | **NOT FOUND** |
| Card expiry fields | **NOT FOUND** |
| Card data transmission through CAPFLUX code | **NOT FOUND** — payment initiation creates intents/DVAs; no card entry surfaces exist in the SPA; no gateway SDK collecting cards server-side |
| raw_payload risk | payment_transactions.raw_payload stores provider webhook JSON — could contain masked/truncated card hints for card-funded payments. Treat as "could impact scope" data; do not assert it is CHD-free without provider payload review (**UNKNOWN → verify with PSP payload samples before production**) |
| SAD (sensitive authentication data) | NOT FOUND |

## Scope determination

- CAPFLUX systems **do not store, process, or transmit** account data as far as verifiable from code. Card acceptance (where used) occurs on PSP-hosted channels ⇒ CAPFLUX's eligibility is for the lightest self-assessment category (SAQ A-style *eligibility*), relying on PSP delegation.
- **Do not claim PCI compliance from absence of card data.** Formal determination requires: PSP programme agreement review + confirmation that no CAPFLUX surface can be made to proxy card data + inclusion of any log/telemetry vendors in scope.
- STATUS: PCI-001 (no CHD in scope systems) = PASS as a technical finding; PCI-002 (formal SAQ classification & attestation) = REQUIRES_LEGAL_REVIEW / REQUIRES_OPERATIONAL_REVIEW.

## Guardrails going forward

1. Never add card-fields to schema or payloads (enforced by AI gate + `check-sensitive-fields`).
2. Keep raw_payload retention bounded and review PSP payload contents during production integration (COMP-041).

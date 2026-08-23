# CAPFLUX Consumer Protection Audit

**Audit date:** 2026-08-23. FCCPC-relevant surface review (REGULATORY_MATRIX R-5). No legal conclusions.

## 1. Pricing & levy disclosure — FAIL (CONSUMER-001)

Verified frontend copy (frontend/src/views/LandingView.vue, LandingNav.vue):

| Location | Copy | Problem |
|---|---|---|
| LandingView:41 | "No Setup Fee — Zero cost to deploy. Schools never pay for software." | Accurate re schools; acceptable if levy disclosed nearby |
| LandingView:57 | "Zero Setup Cost … at no cost." | same |
| LandingView:76 (FAQ) | "Parents pay a small transparent CAPFLUX Platform Levy…" | Names the payer but **no amount/rate/calculation anywhere** |
| LandingView:143/591, LandingNav:108/160 | "Get Started Free" / "Get Started Free Today" | Unqualified "Free" CTAs adjacent to a parent-paid levy ⇒ misleading-representation risk |
| LandingView:280–282 | "Set Up Your School — Free" / "No setup costs" | same class |
| Pricing section 416–486 | "Start today without paying for software… Instead, parents pay a small transparent CAPFLUX Platform Levy" | Best current disclosure; still no amount |

**Required posture:** distinguish *"No setup/licence fee for schools"* from *"A transparent Platform Levy may apply to payments"*, and disclose the actual rate/amount + who remits it before parents transact. Levy mechanics are not even implemented in the money path yet (FIN-008) — the product currently cannot show a parent a levy breakdown ⇒ fix messaging AND implement receipt-level levy transparency together.

## 2. Receipts & payment confirmation — PARTIAL (CONSUMER-002)

Webhook inserts a `notifications` row with a ₦-formatted confirmation message per payment (routes/webhook.ts:167–183). Delivery provider integration is deferred ⇒ confirmations may never reach parents today. SMS/email delivery must be live before production claims of "automatic receipts".

## 3. Failed/duplicate/reversal handling — PASS technically

Idempotent webhook processing prevents double-charging artefacts; FAILED is terminal with reason; reversal is permissioned + audited. Parent-visible status communication for failures = NOT_IMPLEMENTED (no parent-facing channel).

## 4. Refund policy — NOT_IMPLEMENTED (CONSUMER-004)

No refund flow exists in code or copy. Consumer-protection exposure if fees are collected then disputed. REQUIRES_LEGAL_REVIEW for policy content; product decision for flow design.

## 5. Complaint handling & support — PARTIAL (CONSUMER-003)

SupportView exists in SPA (support surface), but no documented complaint intake SLA, escalation path, or regulator-facing process. FCCPC-style complaint mechanisms need operational definition (REQUIRES_OPERATIONAL_REVIEW).

## 6. Terms & privacy notice — NOT_IMPLEMENTED

No terms-of-service or privacy notice exists anywhere in the product (DATA_PROTECTION.md §3). Both are prerequisites for fair, transparent consumer dealings.

## Remediation mapping

COMP-014 (levy disclosure + CTA language), COMP-018 (refund policy/flow), COMP-042 (complaints procedure), COMP-001/002 (notice/terms).

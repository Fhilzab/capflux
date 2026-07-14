# Fee-First Billing Architecture Migration Report

## Executive Summary

This architectural refactor transforms Capstone School ERP to reflect how Nigerian private schools operate while preserving the offline-first and append-only ledger architecture.

---

## Changes Made

### 1. Database Schema Changes

#### New Tables Created

| Table | Purpose |
|-------|---------|
| `tuition_configuration` | Tuition configured per (school, session, term, category) |
| `fee_rules` | Configurable platform & banking service fee policy |
| `payment_accounts` | Dedicated Virtual Accounts (DVA) decoupled from students |

#### New Enum Types

| Type | Values |
|------|--------|
| `student_category` | NURSERY, PRIMARY, SECONDARY |
| `academic_term` | FIRST, SECOND, THIRD |

#### Modified Tables

| Table | Changes |
|-------|---------|
| `students` | Added `category` column (backfilled from class_name) |

#### Preserved (for backward compatibility)

| Table | Notes |
|-------|-------|
| `dva_assignments` | Kept for backward compatibility during transition |
| `guardian_phone` on students | Kept as nullable field |

---

### 2. Dexie Schema Updates

**Version bumped from 1 to 2**

New stores:
- `payment_accounts` - UUID-first offline storage
- `tuition_configurations` - Offline tuition config
- `fee_rules` - Offline fee rules

Removed stores:
- `dva_assignments` - Replaced by `payment_accounts`

---

### 3. TypeScript Interface Changes

New interfaces in `src/types/billing.ts`:
- `TuitionConfiguration`
- `FeeRule`
- `PaymentAccount`
- `PlatformFeeCalculation`
- `TransactionVerification`
- `DVARequest`, `DVAResponse`

All `Record<string, any>` replaced with strict types.

---

### 4. Repositories Updated

| Repository | Changes |
|------------|---------|
| `TuitionConfigurationRepository.ts` | New - offline-first tuition config |
| `FeeRuleRepository.ts` | New - offline-first fee rules |
| `PaymentAccountRepository.ts` | New - offline-first DVA management |
| `StudentRepository.ts` | Updated with category, strict types |
| `GuardianRepository.ts` | Updated with strict types |
| `LedgerRepository.ts` | Updated with strict types |

---

### 5. Services Updated

| Service | Changes |
|---------|---------|
| `TuitionConfigurationService.ts` | New - tuition lookup and configuration |
| `FeeRuleService.ts` | Via FeeRuleRepository - platform fee calculation |
| `BillingService.ts` | Updated - no TECH_LEVY on registration, balance computed |
| `StudentService.ts` | Updated - full registration flow with tuition |
| `PaymentService.ts` | Updated - platform fee from fee_rules |
| `PaymentGateway.ts` | Updated - removed hardcoded fee logic |

---

### 6. Backend Changes

| File | Changes |
|------|--------|
| `PaymentGateway.js` | Updated docs - platform fee now from fee_rules |
| `LedgerService.js` | Creates PLATFORM_BANKING_FEE entry on payment |
| `routes/webhook.js` | Uses payment_accounts table, guardian lookup |

---

## Key Architectural Changes

### Before → After

| Aspect | Before | After |
|--------|--------|-----|
| Tuition | Hardcoded in function | Configured in `tuition_configuration` table |
| Student Category | Implicit from class_name | Explicit `category` field |
| DVAs | On student row | Dedicated `payment_accounts` table |
| Platform Fee | Hardcoded (1000 + 200) | Configurable via `fee_rules` table |
| Platform Fee Timing | On registration (TECH_LEVY) | On payment (PLATFORM_BANKING_FEE) |
| Guardian Storage | Duplicated per student | Normalized with one-to-many |
| Fee Rule Policy | Hardcoded in services | Database-driven configuration |

---

## Migration Sequence

1. Run `202607100012_tuition_and_fees.sql` - Creates tables + adds category column
2. Run `202607100013_rls.sql` - RLS policies + helper functions
3. Run `202607100014_registration_flow.sql` - Registration function
4. Run `202607100015_data_migration.sql` - Migrates existing data

---

## Backward Compatibility

- Existing `TECH_LEVY` ledger entries remain (append-only)
- `dva_assignments` table still exists for transition period
- `guardian_phone` on students preserved (nullable)
- All existing API routes remain functional

---

## Testing Checklist

- [ ] TypeScript compilation passes with zero errors
- [ ] Existing students can be retrieved with category
- [ ] Tuition configuration can be saved/retrieved
- [ ] Fee rules can be saved/retrieved
- [ ] Platform fee calculation uses fee_rules
- [ ] Student registration follows new flow
- [ ] DVA provisioning uses payment_accounts
- [ ] Payment webhook records PLATFORM_BANKING_FEE
- [ ] Offline sync works for new entities
- [ ] Guardian deduplication works in registration

---

## Files Created/Modified

### SQL Migrations
- `supabase/migrations/202607100012_tuition_and_fees.sql` (new)
- `supabase/migrations/202607100013_rls.sql` (new)
- `supabase/migrations/202607100014_registration_flow.sql` (new)
- `supabase/migrations/202607100015_data_migration.sql` (new)

### TypeScript Types
- `frontend/src/types/billing.ts` (new)

### Repositories
- `frontend/src/repositories/TuitionConfigurationRepository.ts` (new)
- `frontend/src/repositories/FeeRuleRepository.ts` (new)
- `frontend/src/repositories/PaymentAccountRepository.ts` (new)
- `frontend/src/repositories/StudentRepository.ts` (updated)
- `frontend/src/repositories/GuardianRepository.ts` (updated)
- `frontend/src/repositories/LedgerRepository.ts` (updated)

### Services
- `frontend/src/services/TuitionConfigurationService.ts` (new)
- `frontend/src/services/BillingService.ts` (updated)
- `frontend/src/services/StudentService.ts` (updated)
- `frontend/src/services/PaymentService.ts` (updated)
- `backend/services/PaymentGateway.js` (updated)
- `backend/services/LedgerService.js` (updated)
- `backend/routes/webhook.js` (updated)

### Documentation
- `docs/database/ER_DIAGRAM.md` (updated)
- `docs/database/MIGRATION_REPORT.md` (this file)

---

## Next Steps

1. Apply migrations during maintenance window
2. Deploy frontend changes
3. Test registration flow end-to-end
4. Test payment flow with platform fee
5. Remove deprecated fields after migration period
6. Consider adding Flutterwave/Remita gateway implementations
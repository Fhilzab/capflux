# Migration Report: Synchronization Architecture Refactor

## Date: 2026-07-14

## Objective
Refactor Capstone's synchronization architecture to distinguish between operational (school-generated) data and financial (bank-generated) data.

## Changes Summary

### 1. Entity Ownership Classification

All entities are now classified into three ownership models:

| Entity Type | Ownership Model | Direction | Examples |
|-------------|-----------------|-----------|----------|
| students | LOCAL OWNED | ↑ Upload | Student records, class enrollment |
| guardians | LOCAL OWNED | ↑ Upload | Parent/guardian contact info |
| tuition_configurations | LOCAL OWNED | ↑ Upload | Fee configuration per session/term |
| fee_rules | LOCAL OWNED | ↑ Upload | Platform fee policy |
| notifications | HYBRID | ↑ Upload / ↓ Download | Notification drafts vs delivery status |
| ledger_entries | HYBRID | ↑ Upload (DEBIT) / ↓ Download (CREDIT) | Tuition charges vs payments |
| payment_accounts | HYBRID | ↑ Upload (request) / ↓ Download (response) | DVA creation requests vs responses |
| payment_transactions | CLOUD OWNED | ↓ Download | Bank transaction records |
| settlement_records | CLOUD OWNED | ↓ Download | Split settlement details |

### 2. Database Schema Changes

#### Dexie Schema (v3)
- Added `source` field to all tables: `'LOCAL'` | `'SERVER'` | `'WEBHOOK'`
- Added `version` field for optimistic locking
- Added `updated_at` field for conflict resolution

```typescript
// Example: payment_transactions now includes source tracking
payment_transactions: 'id, school_id, student_id, ..., source, version, updated_at'
```

### 3. New Sync Engines

#### UploadSyncEngine (`frontend/src/offline/UploadSyncEngine.ts`)
- Responsible for syncing LOCAL OWNED entities to Supabase
- Validates entity ownership before upload
- Used by: StudentService, GuardianService, TuitionConfigurationService

#### DownloadSyncEngine (`frontend/src/offline/DownloadSyncEngine.ts`)
- Responsible for downloading CLOUD OWNED entities from Supabase
- Never creates/modifies financial data locally
- Used by: SyncService, RealtimeSyncService

#### RealtimeSyncService (`frontend/src/offline/RealtimeSyncService.ts`)
- Subscribes to Supabase realtime events
- Automatically updates local Dexie on CLOUD OWNED changes
- Channels: `payment_transactions`, `payment_accounts`, `settlement_records`, `ledger_entries`

### 4. API Changes

#### New Routes
- `POST /api/payment-accounts/provision` - Provider-agnostic payment account creation
- `GET /api/payment-accounts/:student_id` - Get payment account details
- `POST /api/payment-accounts/deactivate` - Deactivate payment account
- `POST /api/payment-accounts/bulk-provision` - Bulk provisioning

#### Deprecated Routes
- `POST /api/dva/provision` - Use `/api/payment-accounts/provision` instead
- `GET /api/dva/:student_id` - Use `/api/payment-accounts/:student_id` instead

### 5. Payment Flow (Updated)

```
Parent Payment
        ↓
     Bank
        ↓
   Monnify
        ↓
   Webhook (backend)
        ↓
   Supabase (payment_transactions)
        ↓
   Realtime Sync
        ↓
   Dexie (CLOUD OWNED - read-only)
        ↓
   Vue UI
```

### 6. Key Rules Enforced

1. **CREDIT ledger entries cannot be created locally** - Only DEBIT entries (tuition charges) can be created in the browser
2. **Payment transactions are read-only** - Browser treats `payment_transactions` as immutable
3. **Source tracking required** - Every entity has `source`, `version`, `updated_at` fields
4. **Provider agnostic** - All payment operations use `GatewayFactory.get(provider)`

### 7. Files Modified

| File | Change Type |
|------|-------------|
| `frontend/src/offline/localDb.ts` | Schema updated to v3 with source tracking |
| `frontend/src/offline/UploadSyncEngine.ts` | New file |
| `frontend/src/offline/DownloadSyncEngine.ts` | New file |
| `frontend/src/offline/RealtimeSyncService.ts` | New file |
| `frontend/src/services/SyncService.ts` | Updated to use new sync engines |
| `backend/routes/payment-accounts.js` | New file (provider-agnostic) |
| `backend/index.js` | Route registration updated |
| `docs/database/ER_DIAGRAM.md` | Updated with payment_accounts relationship |

### 8. Migration Steps for Existing Deployments

1. Run SQL migration `202607100016_payment_accounts.sql` to create `payment_accounts` table
2. Run SQL migration `202607100017_dva_deprecation.sql` to add deprecation notices
3. Deploy backend changes (include both old and new routes)
4. Deploy frontend changes (Dexie auto-upgrades schema)
5. Update client code to use `/api/payment-accounts` endpoints
6. Future: Remove `/api/dva` routes and `dva_assignments` table

## Backward Compatibility

- The old `/api/dva` routes remain functional
- A view is created for backward compatibility in SQL
- SyncService maintains legacy methods
- LocalRepository methods preserved for existing code

## Testing Checklist

- [ ] Frontend build succeeds (✓)
- [ ] Entity ownership validation works correctly
- [ ] Cannot create CREDIT ledger entries locally
- [ ] Realtime subscriptions update Dexie correctly
- [ ] Download sync populates CLOUD OWNED entities
- [ ] Upload sync rejects CLOUD OWNED entities
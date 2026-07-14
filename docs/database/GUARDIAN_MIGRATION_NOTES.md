# Guardian Entity Migration Notes

## Overview

This migration introduces the `guardians` table to normalize parent/guardian information previously stored as duplicated text fields on student records.

## Migration Steps

### 1. New Migration File: `202607100009_guardians.sql`

This migration:
1. Creates the `guardian_relationship` enum type (FATHER, MOTHER, GUARDIAN, OTHER)
2. Creates the `guardians` table with proper constraints
3. Migrates existing `guardian_phone` values to guardian records
4. Links existing students to their guardians via `guardian_id`
5. Creates necessary indexes

### 2. Migration Logic Details

**Phase 1: Create Guardian Records**
```sql
INSERT INTO guardians (school_id, full_name, primary_phone, relationship)
SELECT DISTINCT ON (school_id, guardian_phone)
    school_id,
    'Parent/Guardian' AS full_name,  -- placeholder
    guardian_phone AS primary_phone,
    'GUARDIAN' AS relationship
FROM students
WHERE guardian_phone IS NOT NULL AND guardian_phone != ''
ON CONFLICT (school_id, primary_phone) DO NOTHING;
```

**Phase 2: Link Students to Guardians**
```sql
UPDATE students s
SET guardian_id = g.id
FROM guardians g
WHERE s.school_id = g.school_id 
    AND s.guardian_phone = g.primary_phone
    AND s.guardian_id IS NULL;
```

### 3. Data Deduplication

For schools with existing data:
- Students sharing the same `guardian_phone` within the same school will be linked to a single guardian record
- The `UNIQUE(school_id, primary_phone)` constraint ensures no duplicate guardians are created going forward

### 4. Updated RLS Policies

New migration `202607100010_guardian_rls.sql`:
- Guardian records are protected by the same `current_school_id()` tenant isolation as other tables

### 5. Frontend Changes

#### IndexedDB (Dexie) Schema
- New `Guardian` interface with all required fields
- Student interface updated to use `guardian_id` instead of `guardian_phone`
- New `guardians` object store added
- Helper methods: `saveGuardian`, `getGuardiansBySchool`, `findGuardianByPhone`

#### Registration Flow
The student registration now:
1. Checks if a guardian with the same school_id and primary_phone exists
2. Reuses existing guardian if found
3. Creates new guardian if not found
4. Links student to guardian via `guardian_id`

#### View Updates
- **StudentListView.vue**: Shows guardian name instead of flat phone
- **StudentDetailView.vue**: Displays guardian information card with full details

## Backward Compatibility

### Existing Student Records
- All existing students with `guardian_phone` values will be migrated
- Students without guardian_phone will have `guardian_id = NULL`
- The `guardian_phone` column remains on the students table for now (can be dropped in a future migration if desired)

### Offline-First Operation
- Guardian records can be created independently
- Sync engine handles guardian sync as a separate entity type
- Notifications can target guardian_id for family-level communications

## Future Features Enabled

This architecture prepares for:

1. **Parent Flutter App Authentication**
   - Guardian records can be extended with email/password fields
   - One guardian login → access to all their children's records

2. **Family Dashboard**
   - Query: `SELECT * FROM students WHERE guardian_id = ?`
   - Shows all children under one guardian

3. **Family-Wide Notifications**
   - Query: `SELECT * FROM notifications WHERE guardian_id = ?`
   - Group all student notifications to one guardian

4. **Household Payment History**
   - Aggregate: Sum all payments across students for one guardian
   - Method: `BillingService.getFamilyBillingSummary(guardian_id)`

## Migration Checklist for Production

- [ ] Run migration `202607100009_guardians.sql` during maintenance window
- [ ] Run migration `202607100010_guardian_rls.sql`
- [ ] Run migration `202607100011_guardian_functions.sql`
- [ ] Deploy frontend changes
- [ ] Verify existing students are linked to guardians
- [ ] Update any downstream services that referenced `guardian_phone` on students

## Rollback (if needed)

To rollback:
1. Update applications to not use guardian_id
2. Drop the guardian_id column from students: `ALTER TABLE students DROP COLUMN guardian_id;`
3. Drop the guardians table: `DROP TABLE guardians;`
4. Drop the enum: `DROP TYPE guardian_relationship;`

Note: This would require application-level changes and is not recommended after deployment.
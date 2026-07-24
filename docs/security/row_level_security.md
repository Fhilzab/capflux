# Row Level Security

> **Version:** 1.0 (Phase 1)  
> **Status:** Core Implementation  

---

## Why RLS Is Necessary

RLS is the **primary security boundary** for CAPFLUX. It ensures **multi-tenant isolation** by automatically filtering database rows based on the authenticated user's context. Without RLS, any bug in application code could expose one school's data to another.

### Security Benefits

- **Tenant isolation cannot be bypassed by application bugs**
- **Centralized security policy in the database layer**
- **Zero trust enforcement at query time**
- **Auditable security decisions in one place**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Performance** | RLS adds filter overhead; mitigated by indexes |
| **Complexity** | Complex policies harder to maintain |
| **Debugging** | Must test policies thoroughly |

### Implementation Complexity: **Medium**
### Timeline: **MVP**

---

## Current RLS Implementation

The existing migration (`202607100005_rls.sql`) establishes basic policies using `current_school_id()` helper function.

### Existing Policies

```sql
-- From: supabase/migrations/202607100005_rls.sql
CREATE POLICY allow_authenticated_students ON students
    FOR SELECT, INSERT, UPDATE
    USING (current_school_id() = students.school_id)
    WITH CHECK (current_school_id() = students.school_id);

CREATE POLICY allow_authenticated_ledger_entries ON ledger_entries
    FOR SELECT, INSERT
    USING (current_school_id() = ledger_entries.school_id)
    WITH CHECK (current_school_id() = ledger_entries.school_id);
```

### Current Gaps

1. **No role-based filtering** — All authenticated users can access all rows in their school
2. **No admin bypass** — Should Platform Admins see all schools?
3. **No explicit RLS on helper tables** — `app_settings`, `sync_queue`, etc.

---

## Complete RLS Policy Suite (MVP)

### Tenant Context Functions

```sql
-- These functions extract values from JWT claims
CREATE OR REPLACE FUNCTION current_school_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT current_setting('jwt.claims.school_id', true)::uuid;
$$;

CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT current_setting('jwt.claims.sub', true)::uuid;
$$;

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS profile_role LANGUAGE SQL STABLE AS $$
    SELECT current_setting('jwt.claims.role', true)::profile_role;
$$;

-- Combined tenant check function
CREATE OR REPLACE FUNCTION tenant_has_access(target_school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT 
        current_profile_role() = 'PLATFORM_ADMIN'
        OR current_school_id() = target_school_id;
$$;
```

### Schools Table Policies

```sql
-- Schools: Owners can read and update their own school
CREATE POLICY "school_owner_access" ON schools
    FOR SELECT
    USING (tenant_has_access(schools.id));

CREATE POLICY "school_owner_modify" ON schools
    FOR UPDATE
    USING (
        current_profile_role() IN ('OWNER', 'PLATFORM_ADMIN')
        AND tenant_has_access(schools.id)
    );

-- Platform admins can see all schools
CREATE POLICY "platform_admin_all_schools" ON schools
    FOR SELECT
    USING (current_profile_role() = 'PLATFORM_ADMIN');
```

### Profiles Table Policies

```sql
CREATE POLICY "profile_school_access" ON profiles
    FOR SELECT
    USING (
        current_profile_role() = 'PLATFORM_ADMIN'
        OR current_school_id() = profiles.school_id
    );

CREATE POLICY "profile_self_update" ON profiles
    FOR UPDATE
    USING (
        id = current_profile_id()
        AND current_school_id() = profiles.school_id
    );
```

### Students Table Policies

```sql
CREATE POLICY "student_read_access" ON students
    FOR SELECT
    USING (tenant_has_access(students.school_id));

CREATE POLICY "student_create_access" ON students
    FOR INSERT
    WITH CHECK (tenant_has_access(students.school_id));

CREATE POLICY "student_update_access" ON students
    FOR UPDATE
    USING (
        current_profile_role() IN ('OWNER', 'REGISTRAR')
        AND tenant_has_access(students.school_id)
    );

-- No DELETE policy - students are soft-deleted via status
-- If hard delete needed, only OWNER should have it
CREATE POLICY "student_delete_access" ON students
    FOR DELETE
    USING (
        current_profile_role() = 'OWNER'
        AND tenant_has_access(students.school_id)
    );
```

### Ledger Entries Table Policies

```sql
-- Ledgers are append-only (no UPDATE/DELETE)
CREATE POLICY "ledger_read_access" ON ledger_entries
    FOR SELECT
    USING (tenant_has_access(ledger_entries.school_id));

CREATE POLICY "ledger_insert_access" ON ledger_entries
    FOR INSERT
    WITH CHECK (
        current_profile_role() IN ('OWNER', 'ACCOUNTANT', 'CASHIER')
        AND tenant_has_access(ledger_entries.school_id)
    );

-- Explicitly deny UPDATE and DELETE
-- (No policies defined for UPDATE/DELETE = implicit deny)
```

### Notifications Table Policies

```sql
CREATE POLICY "notification_access" ON notifications
    FOR ALL
    USING (tenant_has_access(notifications.school_id))
    WITH CHECK (tenant_has_access(notifications.school_id));
```

### Audit Logs Table Policies

```sql
-- Audit logs are read-only via RLS
-- Writes happen through triggers/functions
CREATE POLICY "audit_read_tenant" ON audit_logs
    FOR SELECT
    USING (
        current_profile_role() IN ('OWNER', 'ACCOUNTANT')
        AND tenant_has_access(audit_logs.school_id)
    );

CREATE POLICY "audit_platform_admin" ON audit_logs
    FOR SELECT
    USING (current_profile_role() = 'PLATFORM_ADMIN');
```

### Sync Queue Table Policies

```sql
CREATE POLICY "sync_queue_access" ON sync_queue
    FOR ALL
    USING (tenant_has_access(sync_queue.school_id))
    WITH CHECK (tenant_has_access(sync_queue.school_id));
```

### App Settings Table Policies

```sql
CREATE POLICY "app_settings_access" ON app_settings
    FOR ALL
    USING (tenant_has_access(app_settings.school_id))
    WITH CHECK (tenant_has_access(app_settings.school_id));
```

---

## RLS Policy Enforcement

### Why Policies Don't Use `x-school-id` Header

The current codebase has a critical security flaw in `backend/routes/admin.js`:

```javascript
// ❌ INSECURE - DO NOT USE
const schoolId = req.headers['x-school-id'];  // Easily spoofed!
```

**Correct approach:** Extract `school_id` from JWT claims via `current_school_id()`.

### Migration to Secure Policies

```sql
-- Drop insecure policies that trust headers
-- All policies should use current_school_id() JWT function

-- Verify no UPDATE/DELETE on ledger entries
REVOKE UPDATE, DELETE ON ledger_entries FROM authenticated;

-- Ensure policies are restrictive
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
```

---

## Cross-Tenant Attack Prevention

### Attack Scenario

1. Attacker registers as user for School A
2. Attacker attempts to query School B's students
3. Without RLS, query succeeds if not filtered in code

### Prevention via RLS

```sql
-- This query will return 0 rows for School B
SELECT * FROM students WHERE school_id = 'school-b-uuid';

-- Because RLS evaluates:
-- current_school_id() = students.school_id
-- Which is: 'school-a-uuid' = 'school-b-uuid'
-- Which is FALSE; rows filtered out
```

### Testing RLS

```sql
-- Test as different users
SET ROLE authenticated;
SET jwt.claims.school_id = 'school-a-uuid';
SET jwt.claims.role = 'OWNER';
SET jwt.claims.sub = 'profile-a-uuid';

-- This should only return School A's data
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM ledger_entries;
```

---

## RLS Performance Considerations

### Index Requirements

```sql
-- Every table MUST have index on school_id for RLS performance
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_school_id ON ledger_entries(school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_school_id ON sync_queue(school_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_school_status ON students(school_id, status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_student ON ledger_entries(student_id, created_at DESC);
```

### Query Planning

```sql
-- RLS adds implicit WHERE clause
-- Original: SELECT * FROM students
-- After RLS: SELECT * FROM students WHERE school_id = current_school_id()

-- Ensure this uses index, not sequential scan
EXPLAIN ANALYZE SELECT * FROM students;
-- Should show: Index Scan using idx_students_school_id
```

---

## RLS for Growth Phase

### Role-Based Row Filtering

```sql
-- Future: Different roles see different columns
CREATE POLICY "registrar_limited_student_view" ON students
    FOR SELECT
    USING (
        current_profile_role() = 'REGISTRAR'
        AND current_school_id() = students.school_id
    );

-- Column-level security via views (Phase 2)
CREATE VIEW students_registrar_view AS
SELECT id, first_name, last_name, class_name
FROM students
WHERE current_school_id() = students.school_id;
```

### Time-Based Access

```sql
-- Future: Restrict access during blackout hours
CREATE OR REPLACE FUNCTION school_business_hours(school_uuid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM app_settings
        WHERE school_id = school_uuid
        AND timezone = 'Africa/Lagos'  -- Or school's timezone
    );
$$;
```

---

## RLS for Enterprise Phase

### Dynamic Data Masking

```sql
-- Platform admins can see masked PII
CREATE POLICY "platform_admin_masked_access" ON students
    FOR SELECT
    USING (current_profile_role() = 'PLATFORM_ADMIN')
    WITH CHECK (false);  -- Read-only
```

### Row-Level Security Labels

```sql
-- Future: Security labels on sensitive rows
ALTER TABLE students ADD COLUMN sensitivity_level TEXT DEFAULT 'NORMAL';

CREATE POLICY "high_sensitivity_restricted" ON students
    FOR SELECT
    USING (
        sensitivity_level = 'NORMAL'
        OR (sensitivity_level = 'HIGH' AND current_profile_role() = 'OWNER')
    );
```

---

## RL Security Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | Migrate all policies to JWT-based | Medium | MVP |
| **P0** | Add missing table indexes | Low | MVP |
| **P0** | Remove UPDATE/DELETE on ledger | Low | MVP |
| **P1** | Role-based column filtering | Medium | Growth |
| **P2** | Dynamic data masking | High | Enterprise |
# Audit Logging Security

> **Version:** 1.0 (Phase 1)  
> **Status:** MVP Required  

---

## Why Audit Logging Is Necessary

Financial platforms require complete audit trails for:
- **Forensic investigation** after incidents
- **Compliance** (SOC 2, ISO 27001, NDPA, PCI DSS)
- **Accountability** for all financial actions
- **Fraud detection** through anomaly analysis

### Security Benefits

- **Non-repudiation** of user actions
- **Detection of insider threats**
- **Evidence for investigations**
- **Compliance certification**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Storage** | Audit logs grow rapidly (~10GB/year/school) |
| **Performance** | Every mutation triggers audit write |
| **Privacy** | Must balance audit with PII protection |

### Implementation Complexity: **Medium**
### Timeline: **MVP**

---

## Audit Log Schema

### Enhanced Schema

The current `audit_logs` table needs additional fields for complete auditability.

```sql
-- Enhanced audit log schema
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    
    -- Action classification
    action TEXT NOT NULL,           -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    entity TEXT NOT NULL,           -- students, ledger_entries, etc.
    entity_id UUID NOT NULL,
    
    -- Change tracking
    old_values JSONB,               -- Before change
    new_values JSONB,               -- After change
    
    -- Request context
    request_id TEXT,                -- UUID for request tracing
    correlation_id TEXT,            -- Groups related actions
    ip_address INET,
    user_agent TEXT,
    device_id TEXT,                 -- Browser fingerprint hash
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_request ON audit_logs(request_id);
CREATE INDEX idx_audit_logs_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_time ON audit_logs(created_at DESC);
```

### Log Entry Structure

```typescript
export interface AuditLogEntry {
  id: string;                    // UUID (generated)
  school_id: string;             // Tenant ID
  actor_id: string;              // Who did it
  action: string;                // CREATE/UPDATE/DELETE/LOGIN/etc
  entity: string;                // What type
  entity_id: string;             // What record
  
  // Change tracking
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  
  // Context
  request_id: string;            // Traceability
  correlation_id: string;        // Group related actions
  ip_address?: string;           // Where from
  user_agent?: string;           // How accessed
  device_id?: string;            // What device
  
  // Additional
  metadata: Record<string, unknown>;
  created_at: string;
}
```

---

## Audit Events by Category

### Authentication Events

| Event | Trigger | Notes |
|-------|---------|-------|
| `LOGIN_SUCCESS` | Successful login | Include IP, device |
| `LOGIN_FAILED` | Failed login | Include attempted email |
| `LOGOUT` | User logout | Always log |
| `MFA_ENABLED` | MFA activated | Security milestone |
| `MFA_DISABLED` | MFA deactivated | Alert worthy |
| `PASSWORD_CHANGED` | Password update | Invalidate sessions |
| `ACCOUNT_LOCKED` | Brute force lock | Security incident |

### Financial Events

| Event | Trigger | Notes |
|-------|---------|-------|
| `LEDGER_CREATE` | DEBIT entry created | Who, how much |
| `LEDGER_VERIFY` | Payment verified | External proof |
| `PAYMENT_RECORD` | Payment recorded | Method, amount |
| `PAYMENT_REFUND` | Refund issued | Amount, reason |
| `INVOICE_CREATE` | Invoice generated | Amount, period |
| `INVOICE_FINALIZE` | Invoice locked | No changes allowed |
| `STUDENT_DEBIT` | Fee added to student | Automated billing |

### Administrative Events

| Event | Trigger | Notes |
|-------|---------|-------|
| `USER_INVITE` | Admin invited | Email invited |
| `USER_SUSPEND` | Account suspended | Reason required |
| `USER_REACTIVATE` | Account restored | Log who restored |
| `SCHOOL_UPDATE` | School settings changed | Track changes |
| `SETTINGS_CHANGE` | Config changed | What changed |
| `DATA_EXPORT` | Data exported | GDPR request |

### Security Events

| Event | Trigger | Notes |
|-------|---------|-------|
| `PERMISSION_DENIED` | Access blocked | Log attempt |
| `SUSPICIOUS_LOGIN` | New device/IP | Requires alert |
| `SESSION_REVOKED` | Admin revoked | Session IDs |
| `DATA_ACCESS` | Sensitive view | PII access |

---

## Audit Trigger Implementation

### PostgreSQL Triggers

```sql
-- Trigger function for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_actor_id UUID;
    v_school_id UUID;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- Get actor from session
    SELECT current_setting('jwt.claims.sub', true)::uuid INTO v_actor_id;
    SELECT current_setting('jwt.claims.school_id', true)::uuid INTO v_school_id;
    
    -- Don't audit audit logs
    IF TG_TABLE_NAME = 'audit_logs' THEN
        RETURN NULL;
    END IF;
    
    -- Capture old/new values
    IF TG_OP = 'UPDATE' THEN
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_old_values := to_jsonb(OLD);
        v_new_values := '{}'::jsonb;
    ELSIF TG_OP = 'INSERT' THEN
        v_old_values := '{}'::jsonb;
        v_new_values := to_jsonb(NEW);
    END IF;
    
    -- Insert audit log
    INSERT INTO audit_logs (
        id, school_id, actor_id, action, entity, entity_id,
        old_values, new_values, request_id, correlation_id,
        metadata, created_at
    ) VALUES (
        gen_random_uuid(), v_school_id, v_actor_id, TG_OP, TG_TABLE_NAME, NEW.id,
        v_old_values, v_new_values, 
        current_setting('request_id', true)::TEXT,
        current_setting('correlation_id', true)::TEXT,
        '{}'::jsonb, now()
    );
    
    RETURN NULL;
END;
$$;

-- Apply to sensitive tables
CREATE TRIGGER audit_students 
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_ledger_entries
    AFTER INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_profiles
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## Request Correlation

### Why It Is Necessary

To trace actions across multiple operations.

### Implementation

```typescript
// Generate correlation ID per user action
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

// Set on request context
export async function startRequestContext(
  supabase: SupabaseClient,
  correlationId: string
): Promise<void> {
  // Set in JWT claims context
  await supabase.rpc('set_request_context', {
    p_correlation_id: correlationId,
    p_request_id: crypto.randomUUID()
  });
}

// Usage in Edge Function
const correlationId = generateCorrelationId();
await startRequestContext(supabase, correlationId);

// All subsequent operations log with same correlation_id
```

---

## Audit Log Retention

### Why It Is Necessary

Long retention required for compliance, but storage costs matter.

### Retention Policy

| Data Type | Retention | Notes |
|-----------|-----------|-------|
| Authentication logs | 2 years | SOC 2 requirement |
| Financial logs | 7 years | Tax/regulatory |
| Administrative logs | 3 years | SoD compliance |
| Security events | Permanent | Forensic value |
| Debug logs | 30 days | Operational only |

### Implementation

```sql
-- Partition by month for performance
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Archive old logs
CREATE OR REPLACE FUNCTION archive_audit_logs(cutoff_date DATE)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move to cold storage
    INSERT INTO audit_logs_archive 
    SELECT * FROM audit_logs 
    WHERE created_at < cutoff_date;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Delete from hot storage
    DELETE FROM audit_logs WHERE created_at < cutoff_date;
    
    RETURN archived_count;
END;
$$;
```

---

## Audit Log Access Control

### RLS for Audit Logs

```sql
-- Owners and accountants can read their school's logs
CREATE POLICY "audit_read_access" ON audit_logs
    FOR SELECT
    USING (
        current_profile_role() IN ('OWNER', 'ACCOUNTANT')
        AND current_school_id() = audit_logs.school_id
    );

-- Platform admins can see all logs
CREATE POLICY "audit_platform_admin" ON audit_logs
    FOR SELECT
    USING (current_profile_role() = 'PLATFORM_ADMIN');
```

---

## Audit Log Analysis Queries

### Suspicious Activity Detection

```sql
-- Multiple failed logins
SELECT 
    actor_id,
    ip_address,
    COUNT(*) as failed_attempts,
    MAX(created_at) as last_attempt
FROM audit_logs 
WHERE action = 'LOGIN_FAILED'
    AND created_at > now() - interval '1 hour'
GROUP BY actor_id, ip_address
HAVING COUNT(*) > 5;

-- Large data exports
SELECT 
    actor_id,
    COUNT(*) as records_exported,
    MAX(created_at) as export_time
FROM audit_logs
WHERE action = 'DATA_EXPORT'
    AND created_at > now() - interval '24 hours'
GROUP BY actor_id
HAVING COUNT(*) > 100;
```

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | Enhanced audit schema | Medium | MVP |
| **P0** | Audit triggers on financial tables | Medium | MVP |
| **P0** | Correlation ID tracking | Low | MVP |
| **P1** | Export detection | Medium | Growth |
| **P2** | Audit analytics dashboard | High | Enterprise |
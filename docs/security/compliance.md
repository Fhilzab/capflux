# Compliance Security

> **Version:** 1.0 (Phase 1)  
> **Status:** Required Documentation  

---

## Why Compliance Is Necessary

Financial SaaS in Africa must comply with:
- **NDPA** (Nigeria Data Protection Act)
- **PCI DSS** (if handling card data)
- **Future: SOC 2, ISO 27001**

### Security Benefits

- **Legal compliance**
- **Customer trust**
- **Insurance eligibility**
- **Market access**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Documentation** | Extensive paperwork |
| **Process overhead** | Slower changes |
| **Cost** | Compliance tools |

### Implementation Complexity: **Medium**
### Timeline: **MVP**

---

## Nigeria Data Protection Act (NDPA)

### Key Requirements

| Section | Requirement | Implementation |
|---------|-------------|----------------|
| 3.1 | Consent mechanism | Auth flow with explicit consent |
| 3.2 | Legitimate interest | Data minimization policy |
| 3.3 | Data protection | encryption.md |
| 3.4 | Breach notification | incident_response.md |
| 3.5 | Data retention | backup_strategy.md |

### Data Subject Rights

```typescript
// Right to access
export async function getStudentData(studentId: string): Promise<StudentData> {
  const { data } = await supabase
    .from('students')
    .select('*, ledger_entries(*)')
    .eq('id', studentId);
  return data;
}

// Right to erasure (soft delete)
export async function deleteStudent(studentId: string): Promise<void> {
  // Anonymize, don't delete (required for financial audit)
  await supabase
    .from('students')
    .update({ 
      first_name: 'REDACTED',
      last_name: 'REDACTED',
      guardian_phone: 'REDACTED',
      status: 'LEFT'
    })
    .eq('id', studentId);
}

// Right to data portability
export async function exportStudentData(studentId: string): Promise<Blob> {
  const data = await getStudentData(studentId);
  return new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
}
```

---

## PCI DSS Considerations

### Even though payment processors handle card data

| Requirement | Status | Notes |
|-------------|--------|-------|
| 3.4 Encryption | ⚠️ | See encryption.md |
| 3.5 Key management | ⚠️ | See key_management.md |
| 10.1 Audit trails | ⚠️ | See audit_logging.md |
| 10.2 Log content | ⚠️ | Add user, time, action |
| 10.3 Log integrity | ⚠️ | Add checksums |
| 12.10 Incident response | ⚠️ | See incident_response.md |

---

## GDPR Readiness

### For Future Expansion

| Requirement | Implementation |
|-------------|----------------|
| Consent logging | Auth consent stored in audit |
| Data minimization | Field-level encryption |
| Privacy by design | security_architecture.md |
| DPO designation | Management responsibility |

---

## Data Retention Policy

### Legal Requirements

| Data Type | Retention | Reasoning |
|-----------|-----------|-----------|
| Student records | 7 years after graduation | Educational records |
| Financial records | 7 years | Tax compliance |
| Audit logs | 2 years | SOC 2 |
| Authentication logs | 1 year | Security |
| System logs | 90 days | Operations |

### Implementation

```sql
-- Retention function
CREATE OR REPLACE FUNCTION enforce_retention()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- Anonymize old student data (keep for audit)
    UPDATE students 
    SET first_name = 'ARCHIVED',
        last_name = 'ARCHIVED',
        guardian_phone = '+2340000000000'
    WHERE updated_at < now() - interval '7 years'
    AND status IN ('GRADUATED', 'LEFT');
    
    -- Archive old audit logs
    INSERT INTO audit_logs_archive
    SELECT * FROM audit_logs
    WHERE created_at < now() - interval '2 years';
    
    DELETE FROM audit_logs
    WHERE created_at < now() - interval '2 years';
END;
$$;
```

---

## Compliance Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| NDPA 3.1 Consent | ☐ | auth flow |
| NDPA 3.2 Purpose | ☐ | privacy policy |
| NDPA 3.3 Security | ☐ | encryption.md |
| NDPA 3.4 Breach | ☐ | incident_response.md |
| SOC 2 CC5.1 | ☐ | authorization.md |
| SOC 2 CC6.1 | ☐ | authentication.md |
| SOC 2 CC6.3 | ☐ | audit_logging.md |
| SOC 2 CC7.1 | ☐ | backup_strategy.md |
| PCI 3.4 | ☐ | encryption.md |
| PCI 10.1 | ☐ | audit_logging.md |
| ISO 27001 A.9 | ☐ | authentication.md |

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | NDPA consent flow | Low | MVP |
| **P0** | Data retention policy | Low | MVP |
| **P1** | Privacy policy | Medium | Growth |
| **P2** | SOC 2 audit prep | High | Enterprise |
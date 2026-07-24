# Security Monitoring

> **Version:** 1.0 (Phase 1)  
> **Status:** Growth Required  

---

## Why Security Monitoring Is Necessary

Security controls are ineffective without monitoring. You cannot respond to threats you cannot detect.

### Security Benefits

- **Real-time threat detection**
- **Incident response enablement**
- **Compliance evidence generation**
- **Operational visibility**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Noise** | False positives waste time |
| **Cost** | Monitoring infrastructure |
| **Privacy** | User activity tracked |

### Implementation Complexity: **Medium**
### Timeline: **Growth**

---

## Monitoring Metrics

### Authentication Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Failed logins (15 min) | > 5 | Warning |
| Failed logins (1 hour) | > 20 | Critical |
| MFA failures | > 3 | Warning |
| New device logins | > 5/day | Warning |

### Financial Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Payments (hour) | > 50 | Warning |
| Payment amount (hour) | > 1,000,000 | Critical |
| Refunds (day) | > 10 | Critical |
| Duplicate payments | > 0 | Critical |

### System Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| RLS violations | > 0 | Critical |
| Invalid tokens | > 10/hour | Warning |
| API errors (5xx) | > 5% | Warning |
| Sync queue size | > 1000 | Warning |

---

## Alert Definitions

```yaml
# alerts.yml
alerts:
  - name: "brute_force_login"
    metric: "auth_login_failed"
    condition: "count > 20 in 1 hour"
    severity: "critical"
    channel: "pagerduty"
    message: "Multiple failed login attempts detected"
    
  - name: "large_payment"
    metric: "payment_amount"
    condition: "sum > 1000000 in 1 hour"
    severity: "warning"
    channel: "sms"
    message: "Large payment threshold exceeded"
    
  - name: "rls_violation"
    metric: "database_rls_denied"
    condition: "count > 0"
    severity: "critical"
    channel: "pagerduty"
    message: "RLS policy violation detected"
    
  - name: "tampered_data"
    metric: "database_row_modified"
    condition: "count > 100 in 5 minutes"
    severity: "critical"
    channel: "pagerduty"
    message: "Suspicious database modification rate"
```

---

## Dashboard Requirements

### Executive Dashboard

| Panel | Metric | Frequency |
|-------|--------|-----------|
| Security posture | Overall score | Real-time |
| Incidents today | Count | Real-time |
| Failed logins | Count | Hourly |
| Large payments | Count | Daily |

### Engineering Dashboard

| Panel | Metric | Frequency |
|-------|--------|-----------|
| API latency | p95 response time | Real-time |
| Error rate | 5xx percentage | Real-time |
| Sync success | % successful | Hourly |
| Database load | Connections | Real-time |

---

## Log Aggregation

### What to Log

| Source | Events | Retention |
|--------|--------|-----------|
| Supabase Auth | All logins | 2 years |
| Database | RLS denials, queries | 1 year |
| API | All requests | 90 days |
| Frontend | Errors, actions | 30 days |
| Webhooks | All callbacks | 1 year |

### Central Logging

```bash
# Forward logs to centralized system
supabase functions logs --follow | \
    tee -a /var/log/capflux/functions.log | \
    log-shipper --destination papertrail
```

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P1** | Authentication alerts | Medium | Growth |
| **P1** | Financial alerts | Medium | Growth |
| **P2** | Executive dashboard | High | Enterprise |
| **P2** | Automated response | High | Enterprise |
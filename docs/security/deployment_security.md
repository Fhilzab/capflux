# Deployment Security

> **Version:** 1.0 (Phase 1)  
> **Status:** MVP Required  

---

## Why Deployment Security Is Necessary

Infrastructure misconfigurations cause **the majority of cloud breaches**. Secure deployment ensures:
- **No accidental data exposure**
- **Network segmentation enforcement**
- **Access control at infrastructure level**
- **Compliance with standards**

### Security Benefits

- **Prevents infrastructure breaches**
- **Enforces security boundaries**
- **Enables incident investigation**
- **Supports compliance requirements**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Complexity** | CI/CD pipelines more complex |
| **Speed** | Security checks add deployment time |
| **Cost** | Additional security tooling |

### Implementation Complexity: **Medium**
### Timeline: **MVP**

---

## Infrastructure as Code (IaC)

### Why It Is Necessary

Manual configuration leads to drift and vulnerabilities.

### Security Benefits

- **Reproducible security posture**
- **Version-controlled changes**
- **Automated security scanning**
- **Peer review for changes**

### Implementation

```hcl
# terraform/main.tf
resource "supabase_project" "capflux" {
  name     = "capflux-${var.environment}"
  org_id   = var.org_id
  
  # Security settings
  database_password_encryption = "SCRAM-SHA-256"
  api_external_enabled      = true
  api_external_tls_enabled  = true
  
  # Network isolation
  allowed_cidr_blocks = var.allowed_ips
}

# Edge function secrets
resource "supabase_function_secret" "monnify_api_key" {
  project_ref = supabase_project.capflux.id
  name        = "MONNIFY_API_KEY"
  value       = var.monnify_api_key
}
```

---

## Secrets Management

### Why It Is Necessary

Hardcoded secrets in code or config lead to breaches.

### Security Benefits

- **No credential leakage**
- **Easy key rotation**
- **Audit trail of access**
- **Automatic expiration**

### Implementation

```bash
# GitHub Actions secrets (never in code)
# MONNIFY_API_KEY
# PAYSTACK_SECRET_KEY
# TERMII_API_KEY
# JWT_SIGNING_KEY

# Supabase Vault (for runtime secrets)
supabase secrets set MONNIFY_API_KEY=$MONNIFY_KEY
supabase secrets set PAYSTACK_SECRET_KEY=$PAYSTACK_KEY

# CI/CD access
# Only deploy keys have write access to production
# All other secrets accessed via Vault at runtime
```

---

## Network Security

### WAF Configuration

```nginx
# nginx.conf - WAF rules
location /api/ {
    # Rate limiting
    limit_req zone=api burst=10 nodelay;
    limit_req_status 429;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # SQL injection patterns
    if ($args ~* "(union|select|insert|delete|update|drop|exec)") {
        return 403;
    }
    
    proxy_pass http://capflux-api;
}
```

### CORS Configuration

```typescript
// Supabase Edge Function CORS
export const CORS_CONFIG = {
  allowedOrigins: [
    'https://app.capflux.ng',
    'https://staging.capflux.ng'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token'],
  maxAge: 86400,
  credentials: true
};
```

---

## CI/CD Security

### Pipeline Security

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run security:check
      - run: npm run lint:security
      
  deploy-staging:
    needs: security-scan
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3
      - run: supabase db push --project-ref $STAGING_REF
      - run: supabase functions deploy --project-ref $STAGING_REF
      
  deploy-production:
    needs: security-scan
    runs-on: ubuntu-latest
    environment: production
    # Require manual approval for production
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - run: supabase db push --project-ref $PROD_REF
      - run: supabase functions deploy --project-ref $PROD_REF
```

---

## Container Security

### Why It Is Necessary

Edge functions run in containers that must be secure.

### Security Benefits

- **Isolated execution**
- **Reduced attack surface**
- **Controlled resources**

### Implementation

```dockerfile
# Dockerfile for Edge Functions
FROM node:20-alpine

# Non-root user
USER node

# Immutable filesystem
RUN chmod 755 /app

# Security updates only
RUN apk --no-cache upgrade

# Run as non-root
USER 1001:1001

CMD ["node", "index.js"]
```

---

## Monitoring & Alerting

### Security Events

| Event | Alert | Channel |
|-------|-------|---------|
| Failed login > 5/min | Warning | Slack |
| Failed login > 20/min | Critical | PagerDuty |
| New tenant created | Info | Slack |
| Large payment (>1M) | Warning | SMS |
| Data export > 100 records | Warning | Email |
| RLS policy violation | Critical | PagerDuty |

### Implementation

```yaml
# Alert configuration (Supabase or external)
alerts:
  - name: "brute_force_detection"
    query: "count:login_failed{env:prod} > 20"
    threshold: 20
    window: "1m"
    severity: "critical"
    channel: "pagerduty"
```

---

## Compliance Configuration

### Audit Requirements

| Standard | Requirement | Implementation |
|----------|-------------|----------------|
| **SOC 2** | Log access changes | Audit triggers |
| **ISO 27001** | Access control | RBAC + RLS |
| **NDPA** | Data protection | Encryption |
| **PCI DSS** | Firewall | WAF rules |

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | IaC with terraform | Medium | MVP |
| **P0** | Secrets in Vault | Low | MVP |
| **P0** | Security scanning in CI | Low | MVP |
| **P1** | WAF rules | Medium | Growth |
| **P1** | Monitoring alerts | Medium | Growth |
| **P2** | Container hardening | High | Enterprise |
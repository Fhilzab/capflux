# API Security

> **Version:** 1.0 (Phase 1)  
> **Status:** MVP Required  

---

## Why API Security Is Necessary

Every API endpoint is an **attack surface**. Without proper validation, rate limiting, and security controls, attackers can:
- Extract all tenant data via SQL injection
- Deny service via flood attacks
- Hijack sessions via CSRF
- Steal credentials via XSS

### Security Benefits

- **Prevents data exfiltration**
- **Ensures service availability**
- **Protects session integrity**
- **Validates input before processing**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Latency** | Each request validated (~10-50ms) |
| **Complexity** | Multiple layers of validation |
| **Developer Experience** | Must handle error responses |

### Implementation Complexity: **Medium**
### Timeline: **MVP**

---

## Rate Limiting

### Why It Is Necessary

Africa's internet infrastructure makes DoS attacks easier to execute. Rate limiting protects:
- Authentication endpoints (brute force)
- API endpoints (data scraping)
- Webhook endpoints (spoofing)

### Security Benefits

- Prevents credential stuffing
- Stops data harvesting
- Protects database from overload

### Rate Limit Tiers

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| `/auth/login` | 5 req | 15 min | Account lockout after |
| `/auth/signup` | 3 req | 1 hour | Prevent fake accounts |
| `/api/*` | 100 req | 1 min | Per authenticated user |
| `/webhook/*` | 1000 req | 1 min | Per IP + signature |
| `/api/sync/*` | 50 req | 1 min | Queue processing |

### Implementation (Edge Function)

```typescript
// supabase/functions/_shared/rate-limiter.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export const RateLimiter = {
  async check(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Clean old entries
    await supabase.rpc('clean_rate_limit_window', {
      key_prefix: key,
      before: windowStart
    });

    // Count current requests
    const { data: count } = await supabase.rpc('increment_rate_limit', {
      key: `${key}:${now}`,
      window: windowSeconds
    });

    return {
      allowed: (count ?? 0) <= limit,
      remaining: Math.max(0, limit - (count ?? 0)),
      resetAt: (Math.floor(now / windowSeconds) + 1) * windowSeconds
    };
  }
};

// Middleware usage in Edge Functions
export async function requireRateLimit(
  req: Request,
  res: Response,
  key: string,
  limit: number,
  window: number
): Promise<boolean> {
  const result = await RateLimiter.check(key, limit, window);
  res.headers.set('X-RateLimit-Limit', limit.toString());
  res.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  res.headers.set('X-RateLimit-Reset', result.resetAt.toString());
  
  return result.allowed;
}
```

---

## Request Validation

### Why It Is Necessary

All inputs are **untrusted**. Validation prevents:
- SQL injection
- XSS attacks
- Mass assignment
- Data corruption

### Security Benefits

- Rejects malicious payloads
- Ensures data integrity
- Provides clear error messages

### Implementation (Zod Schema)

```typescript
// supabase/functions/_shared/validation.ts
import { z } from 'zod';

// Student validation schema
export const StudentSchema = z.object({
  first_name: z.string()
    .min(1, 'First name required')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters'),
  
  last_name: z.string()
    .min(1, 'Last name required')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters'),
  
  class_name: z.string()
    .min(1, 'Class required')
    .max(100, 'Class name too long'),
  
  guardian_phone: z.string()
    .regex(/^\+234[0-9]{10}$/, 'Invalid Nigerian phone number'),
  
  status: z.enum(['ACTIVE', 'GRADUATED', 'LEFT']).optional()
});

// Ledger entry validation
export const LedgerEntrySchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  amount: z.number()
    .positive('Amount must be positive')
    .max(100000000, 'Amount exceeds maximum'),
  entry_type: z.enum(['DEBIT', 'CREDIT']),
  entry_category: z.enum(['TUITION', 'TECH_LEVY', 'BOOKS', 'UNIFORM', 'TRANSPORT', 'EXAM', 'OTHER', 'DISCOUNT', 'REFUND', 'ADJUSTMENT']),
  metadata: z.record(z.unknown()).optional()
});

// Validate and sanitize
export function validateStudent(data: unknown): Student {
  const result = StudentSchema.parse(data);
  
  // Sanitize for storage
  return {
    ...result,
    first_name: result.first_name.trim(),
    last_name: result.last_name.trim(),
    class_name: result.class_name.trim().toUpperCase(),
    guardian_phone: result.guardian_phone.replace(/\s+/g, '')
  };
}
```

---

## CORS Configuration

### Why It Is Necessary

Prevents **cross-site request forgery** and **data exfiltration** via malicious websites.

### Security Benefits

- Blocks unauthorized origin access
- Prevents credential leakage
- Protects user sessions

### Implementation

```typescript
// supabase/functions/_shared/cors.ts
export const ALLOWED_ORIGINS = [
  'https://app.capstone.ng',
  'https://staging.capstone.ng',
  'https://www.capstone.ng'
];

export function getCorsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}
```

---

## CSRF Protection

### Why It Is Necessary

Even with JWT tokens, CSRF attacks can occur via malicious forms or redirects.

### Security Benefits

- Prevents cross-site request forgery
- Protects authenticated sessions
- Works with SPA architecture

### Implementation

```typescript
// Double-submit cookie pattern
export const CSRFService = {
  generateToken(): string {
    return crypto.randomUUID();
  },

  validateToken(token: string, cookie: string): boolean {
    return token === cookie && token.length > 0;
  },

  setCookie(res: Response, token: string): void {
    res.headers.set('Set-Cookie', 
      `csrf-token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`
    );
  }
};

// Edge Function handler
export async function handleRequest(req: Request) {
  const csrfToken = req.headers.get('x-csrf-token');
  const cookieToken = getCookie(req, 'csrf-token');
  
  if (!CSRFService.validateToken(csrfToken, cookieToken)) {
    return new Response('CSRF validation failed', { status: 403 });
  }
  
  // Continue processing...
}
```

---

## XSS Prevention

### Why It Is Necessary

Financial data displayed in tables and forms must be sanitized to prevent script injection.

### Security Benefits

- Prevents session hijacking
- Blocks phishing attacks
- Protects other users

### Implementation (Backend Sanitization)

```typescript
// supabase/functions/_shared/sanitizer.ts
export const Sanitizer = {
  html(input: string): string {
    return input
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;');
  },

  sql(input: string): string {
    // Use parameterized queries instead!
    // This is a fallback, not primary defense
    return input.replace(/['";\\]/g, '');
  }
};

// Database queries ALWAYS use parameters
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('id', studentId);  // Parameterized, safe
```

---

## SQL Injection Prevention

### Why It Is Necessary

RLS and parameterized queries together prevent SQL injection.

### Security Benefits

- Prevents data exfiltration
- Protects tenant isolation
- Meets compliance requirements

### Safe vs Unsafe Patterns

```typescript
// ❌ UNSAFE - Never do this
const query = `SELECT * FROM students WHERE class = '${className}'`;

// ✅ SAFE - Parameterized query
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('class_name', className);

// ✅ SAFE - Using RPC
const { data } = await supabase.rpc('get_students_by_class', {
  class_name: className,
  p_school_id: schoolId
});

// ✅ SAFE - Using RLS (automatic filter)
const { data } = await supabase
  .from('students')
  .select('*');  // RLS adds: AND school_id = current_school_id()
```

---

## Secure Error Handling

### Why It Is Necessary

Stack traces and database errors reveal system internals.

### Security Benefits

- Prevents information disclosure
- Blocks fingerprinting
- Maintains user trust

### Implementation

```typescript
// supabase/functions/_shared/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public userMessage: string
  ) {
    super(message);
  }
}

// Generic error response
export function createErrorResponse(error: unknown): Response {
  console.error('[API Error]', error);  // Log internally only
  
  // Never expose internals to client
  return new Response(
    JSON.stringify({
      error: 'An error occurred. Please try again.',
      code: 'INTERNAL_ERROR'
    }),
    { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Validation error
export function validationError(errors: string[]): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors
    }),
    { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

---

## Response Filtering

### Why It Is Necessary

API responses may contain sensitive fields not meant for certain roles.

### Security Benefits

- Enforces data minimization
- Prevents field-level leakage
- Complies with privacy regulations

### Implementation

```typescript
// supabase/functions/_shared/responses.ts
export const FieldFilter = {
  // What fields are safe for each role
  studentFields: {
    OWNER: '*',  // All fields
    ACCOUNTANT: 'id,first_name,last_name,class_name,status',
    CASHIER: 'id,first_name,last_name,class_name',
    REGISTRAR: '*',
    PARENT: 'id,first_name,last_name,class_name'
  },

  filter<T>(data: T, fields: string): T {
    if (fields === '*') return data;
    
    const allowed = new Set(fields.split(','));
    const filtered: Record<string, unknown> = {};
    
    for (const key of Object.keys(data as object)) {
      if (allowed.has(key)) {
        filtered[key] = (data as Record<string, unknown>)[key];
      }
    }
    
    return filtered as T;
  }
};
```

---

## Pagination Security

### Why It Is Necessary

Large datasets can be extracted via pagination enumeration.

### Security Benefits

- Limits data exposure
- Prevents scraping
- Reduces query load

### Implementation

```typescript
// supabase/functions/_shared/pagination.ts
export interface PaginationParams {
  page: number;
  limit: number;
  maxLimit: number;
}

export function validatePagination(params: {
  page?: string;
  limit?: string;
}): PaginationParams {
  const maxLimit = 100;
  const defaultLimit = 20;
  
  const page = Math.max(1, parseInt(params.page ?? '1'));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(params.limit ?? String(defaultLimit)))
  );

  return { page, limit, maxLimit };
}

// Usage in API
const { page, limit } = validatePagination(req.query);
const from = (page - 1) * limit;
const to = from + limit - 1;

const { data } = await supabase
  .from('students')
  .select()
  .range(from, to);  // Hard limit applied
```

---

## File Upload Security

### Why It Is Necessary

Photos of students, receipts, and documents require strict controls.

### Security Benefits

- Prevents malware upload
- Blocks data exfiltration
- Ensures file integrity

### Implementation

```sql
-- Supabase Storage policies
CREATE POLICY "school_files_isolated" ON storage.objects
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (
        current_school_id()::text = (storage.foldername(name))[0]
    );

CREATE POLICY "files_size_limited" ON storage.objects
    FOR INSERT
    WITH CHECK (
        (metadata->>'size')::integer < 5242880  -- 5MB limit
    );

CREATE POLICY "files_type_restricted" ON storage.objects
    FOR INSERT
    WITH CHECK (
        metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'application/pdf')
    );
```

---

## API Security Checklist

| Control | Status |
|---------|--------|
| Rate limiting on auth endpoints | ☐ |
| Rate limiting on API endpoints | ☐ |
| Input validation with schemas | ☐ |
| Parameterized queries only | ✅ (via Supabase) |
| CORS restricted to known origins | ☐ |
| CSRF tokens implemented | ☐ |
| XSS sanitization applied | ☐ |
| Error messages sanitized | ☐ |
| Response field filtering | ☐ |
| Pagination limits enforced | ☐ |
| File upload restrictions | ☐ |

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | Rate limiting on auth | Low | MVP |
| **P0** | Input validation schemas | Medium | MVP |
| **P0** | Error sanitization | Low | MVP |
| **P1** | CORS configuration | Low | Growth |
| **P1** | Response filtering | Medium | Growth |
| **P2** | File upload policies | Medium | Growth |
# Frontend Security

> **Version:** 1.0 (Phase 1)  
> **Status:** MVP Required  

---

## Why Frontend Security Is Necessary

The frontend is the **first line of defense** and often the **primary attack surface**. XSS, clickjacking, and insecure storage can compromise the entire application.

### Security Benefits

- **Prevents client-side attacks**
- **Protects session tokens**
- **Blocks UI manipulation**
- **Ensures data integrity**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Bundle Size** | Security libraries add ~50KB |
| **Complexity** | Content Security Policy requires careful configuration |
| **Development Speed** | Security headers block some integrations |

### Implementation Complexity: **Medium**
### Timeline: **MVP**

---

## Content Security Policy (CSP)

### Why It Is Necessary

CSP prevents XSS by restricting script sources. Critical for financial applications.

### Security Benefits

- Blocks inline script injection
- Prevents external script loading
- Mitigates XSS impact

### Implementation

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Remove unsafe-inline when possible
        "style-src 'self' 'unsafe-inline'", // Tailwind needs unsafe-inline
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }
  }
});

// Production CSP (stricter)
// Remove 'unsafe-inline' after refactoring inline styles
// build: { headers: { ... } }
```

---

## Secure Storage Architecture

### Why It Is Necessary

Sensitive data in localStorage/sessionStorage can be stolen via XSS.

### Security Benefits

- Reduces XSS impact
- Prevents token theft
- Enables secure session handling

### Storage Rules

| Data Type | Storage | Encryption | Notes |
|-----------|---------|------------|-------|
| JWT Token | Memory only | N/A | Never persisted to localStorage |
| School data | IndexedDB (Dexie) | ✅ Yes | Encrypted, see offline_security.md |
| User preferences | localStorage | ❌ No | Non-sensitive only |
| Form state | sessionStorage | ❌ No | Cleared on tab close |
| CSRF token | HttpOnly cookie | N/A | Set by backend |

### Implementation

```typescript
// Secure session management
export class SecureSessionManager {
  private session: JWT | null = null;
  
  // Never store in localStorage
  setSession(token: string) {
    this.session = this.parseJWT(token);
  }
  
  getSession(): JWT | null {
    return this.session;
  }
  
  clearSession() {
    this.session = null;
  }
  
  private parseJWT(token: string): JWT | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        school_id: payload.school_id,
        role: payload.role,
        exp: payload.exp,
        // Ignore sensitive claims like email in memory
      };
    } catch {
      return null;
    }
  }
}
```

---

## Route Guards

### Why It Is Necessary

Unauthenticated users must not access protected routes. Role-based access must be enforced.

### Security Benefits

- Prevents unauthorized navigation
- Enforces authentication requirements
- Protects route-specific data

### Implementation

```typescript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { PERMISSIONS } from '@/constants/permissions';

const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.STUDENT_READ }
  },
  {
    path: '/students',
    component: () => import('@/views/StudentListView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.STUDENT_READ }
  },
  {
    path: '/payments',
    component: () => import('@/views/PaymentsView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.PAYMENT_RECORD }
  },
  {
    path: '/reports',
    component: () => import('@/views/ReportsView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.REPORT_GENERATE }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Global navigation guard
router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();
  
  // Check authentication
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }
  
  // Check permission
  if (to.meta.permission) {
    const authz = new AuthorizationService();
    const hasPermission = await authz.can(to.meta.permission);
    if (!hasPermission) {
      next({ name: 'unauthorized' });
      return;
    }
  }
  
  next();
});
```

---

## Input Sanitization

### Why It Is Necessary

User input displayed in tables/charts can contain malicious scripts.

### Security Benefits

- Prevents XSS attacks
- Protects other users
- Maintains data integrity

### Implementation

```typescript
// src/utils/sanitize.ts
export const Sanitizer = {
  // For display in templates (Vue auto-escapes by default)
  text(input: string): string {
    // Additional sanitization for rich text contexts
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '');
  },

  // For form inputs (before storage)
  formInput(input: string): string {
    return input.trim();
  },

  // For URLs
  url(input: string): string {
    try {
      const url = new URL(input);
      // Only allow specific protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        return '';
      }
      return url.toString();
    } catch {
      return '';
    }
  }
};
```

---

## Secure Component Patterns

### Why It Is Necessary

Components must not expose sensitive data or functionality.

### Security Benefits

- Prevents data leakage
- Enforces RBAC at UI level
- Reduces attack surface

### Component Guard Mixin

```typescript
// src/components/SecureComponent.ts
export function useSecureComponent(requiredPermission: string) {
  const auth = useAuthStore();
  const authz = new AuthorizationService();
  
  const canAccess = ref(false);
  const isLoading = ref(true);
  
  onMounted(async () => {
    if (!auth.isAuthenticated) {
      canAccess.value = false;
    } else {
      canAccess.value = await authz.can(requiredPermission);
    }
    isLoading.value = false;
  });
  
  return { canAccess, isLoading };
}

// Usage in component
<script setup lang="ts">
import { useSecureComponent } from '@/components/SecureComponent';
import { PERMISSIONS } from '@/constants/permissions';

const { canAccess } = useSecureComponent(PERMISSIONS.PAYMENT_RECORD);
</script>

<template>
  <div v-if="canAccess">
    <!-- Secure payment recording UI -->
  </div>
  <CmAlert v-else type="error">
    Access denied. Contact your administrator.
  </CmAlert>
</template>
```

---

## Security Headers Configuration

### Via Nginx (Production)

```nginx
# nginx.conf
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "clipboard-read=(), clipboard-write=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
```

---

## Error Handling Security

### Why It Is Necessary

Error messages can leak implementation details.

### Security Benefits

- Prevents fingerprinting
- Blocks information disclosure
- Maintains professional appearance

### Implementation

```typescript
// src/utils/error-handler.ts
export function sanitizeErrorMessage(error: unknown): string {
  // Never expose raw errors to users
  const safeErrors: Record<string, string> = {
    'AuthApiError': 'Authentication failed',
    'PostgresError': 'Database error',
    'FetchError': 'Network error'
  };
  
  if (error && typeof error === 'object' && 'code' in error) {
    return safeErrors[error.code as string] || 'An error occurred';
  }
  
  return 'An error occurred. Please try again.';
}
```

---

## Frontend Security Checklist

| Control | Status |
|---------|--------|
| CSP headers configured | ☐ |
| X-Frame-Options set | ☐ |
| Route guards implemented | ☐ |
| Input sanitization applied | ☐ |
| Secure storage (no localStorage for tokens) | ☐ |
| Error messages sanitized | ☐ |
| Permission guards in components | ☐ |
| Security headers in production | ☐ |

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | Route guards | Low | MVP |
| **P0** | CSP headers | Medium | MVP |
| **P0** | Secure session storage | Low | MVP |
| **P1** | Component permission guards | Medium | Growth |
| **P1** | Production security headers | Low | Growth |
| **P2** | Security testing automation | High | Enterprise |
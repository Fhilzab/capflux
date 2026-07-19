# Encryption Security

> **Version:** 1.0 (Phase 1)  
> **Status:** Critical for Compliance  

---

## Why Encryption Is Necessary

Financial data stored in browsers and databases must be protected. NDPA (Nigeria Data Protection Act) and PCI DSS require encryption for personal and financial data.

### Security Benefits

- **Protects data at rest** on stolen devices
- **Encrypts data in transit** over networks
- **Meets compliance requirements**
- **Prevents insider threats**

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Performance** | WebCrypto operations add ~50-100ms |
| **Key Management** | Key loss = data unrecoverable |
| **Memory** | Encryption keys in memory can be dumped |
| **Debugging** | Encrypted data harder to debug |

### Implementation Complexity: **High**
### Timeline: **MVP**

---

## Encryption Algorithms

### Data in Transit

| Layer | Algorithm | Key Length | Notes |
|-------|-----------|------------|-------|
| **TLS** | TLS 1.3 | Negotiated | Supabase managed |
| **API** | HTTPS only | - | All endpoints HTTPS |
| **WebSocket** | WSS | - | Realtime sync |

### Data at Rest (Database)

| Data Type | Algorithm | Key Source | Notes |
|-----------|-----------|------------|-------|
| **Backups** | AES-256-GCM | Supabase managed | Automated |
| **Logs** | AES-256-GCM | Supabase managed | At-rest |
| **Database** | AES-256 | Supabase managed | Transparent |

### Data at Rest (Client)

| Data Type | Algorithm | Key Source | Notes |
|-----------|-----------|------------|-------|
| **PII fields** | AES-256-GCM | PBKDF2(user+device) | See offline_security.md |
| **Financial records** | AES-256-GCM | PBKDF2(user+device) | See offline_security.md |
| **Session tokens** | Memory only | N/A | Never persisted |

---

## Key Management

### Why It Is Necessary

Encryption is only as strong as key management. Poor key management undermines all encryption.

### Security Benefits

- **Enables key rotation**
- **Prevents key compromise**
- **Supports compliance auditing**

### Implementation

```typescript
// Frontend key derivation for Dexie encryption
export class EncryptionKeyManager {
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 256;

  // Derive encryption key from user password + device fingerprint
  static async deriveKey(
    password: string, 
    salt: string,
    deviceId: string
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const combined = `${password}-${deviceId}`;
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(combined),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate device-specific salt
  static generateSalt(): string {
    return crypto.getRandomValues(new Uint8Array(16))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  }

  // Store encrypted key in sessionStorage (not localStorage)
  static storeWrappedKey(key: string, sessionKey: string): void {
    const wrapped = this.wrapKey(key, sessionKey);
    sessionStorage.setItem('wrapped-key', wrapped);
  }
}

// Server-side key rotation (Edge Function)
export async function rotateEncryptionKeys() {
  // This would be called periodically
  // Supabase handles database encryption key rotation automatically
  
  // For application-level keys:
  // 1. Generate new key
  // 2. Re-encrypt data (background job)
  // 3. Update key references
  // 4. Invalidate old keys after grace period
}
```

---

## Field-Level Encryption

### Why It Is Necessary

Some fields (like guardian phone numbers) require additional protection beyond database encryption.

### Security Benefits

- **PII protection even from DBAs**
- **Granular access control**
- **Compliance with data minimization**

### Encrypted Fields Matrix

| Table | Field | Encrypted? | Reason |
|-------|-------|------------|--------|
| students | `guardian_phone` | ✅ Yes | PII + financial contact |
| students | `dva_account_number` | ✅ Yes | Payment identifier |
| guardians | `primary_phone` | ✅ Yes | PII |
| guardians | `secondary_phone` | ✅ Yes | PII |
| guardians | `email` | ✅ Yes | PII |
| profiles | `full_name` | ✅ Yes | PII |
| notifications | `recipient_phone` | ✅ Yes | PII |
| notifications | `message_body` | ✅ Yes | Financial message |

### Implementation Pattern

```typescript
// Encryption decorator for sensitive fields
export const FieldEncryption = {
  async encryptFields(
    record: Record<string, unknown>,
    sensitiveFields: string[]
  ): Promise<Record<string, unknown>> {
    const key = await this.getEncryptionKey();
    const encrypted: Record<string, unknown> = { ...record };
    
    for (const field of sensitiveFields) {
      if (record[field] !== undefined) {
        encrypted[`encrypted_${field}`] = await this.encrypt(
          String(record[field]), 
          key
        );
        delete encrypted[field];
      }
    }
    
    return encrypted;
  },

  async decryptFields(
    record: Record<string, unknown>,
    encryptedFields: string[]
  ): Promise<Record<string, unknown>> {
    const key = await this.getEncryptionKey();
    const decrypted: Record<string, unknown> = { ...record };
    
    for (const field of encryptedFields) {
      const encryptedField = `encrypted_${field}`;
      if (record[encryptedField] !== undefined) {
        decrypted[field] = await this.decrypt(
          String(record[encryptedField]), 
          key
        );
        delete decrypted[encryptedField];
      }
    }
    
    return decrypted;
  }
};
```

---

## Secret Management

### Supabase Vault

All secrets stored in Supabase Vault, never in environment variables.

```sql
-- Store payment gateway secrets
SELECT vault.create_secret(
    'monnify-api-key',
    'sk_live_...',
    'Monnify API key for school ' || school_id
);

-- Retrieve in Edge Function
SELECT vault.read_secret('monnify-api-key');
```

### Rate Limiting Secrets

Secrets should have TTL and rotation schedule.

```typescript
// Secret caching with TTL
export class SecretCache {
  private secrets: Map<string, { value: string; expires: number }> = new Map();
  private readonly TTL = 5 * 60 * 1000;  // 5 minutes

  async getSecret(name: string): Promise<string> {
    const cached = this.secrets.get(name);
    const now = Date.now();

    if (cached && cached.expires > now) {
      return cached.value;
    }

    const { data } = await supabase.rpc('get_cached_secret', { secret_name: name });
    this.secrets.set(name, { value: data, expires: now + this.TTL });
    return data;
  }
}
```

---

## Key Rotation Strategy

### Why It Is Necessary

Compromised keys must be revoked without data loss.

### Security Benefits

- **Limits breach impact**
- **Enables compliance**
- **Maintains security posture**

### Rotation Timeline

| Key Type | Rotation Period | Notes |
|----------|-----------------|-------|
| Database encryption | 365 days | Supabase managed |
| API secrets | 90 days | Automated |
| JWT signing | 365 days | Supabase managed |
| Client encryption keys | 180 days | On login |
| Recovery codes | On-demand | When requested |

### Implementation

```sql
-- Key metadata table
CREATE TABLE encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retired_at TIMESTAMPTZ,
    key_hash TEXT NOT NULL  -- Hash only, never the key itself
);

-- Track key usage
CREATE TABLE key_usage_log (
    key_id UUID REFERENCES encryption_keys(id),
    profile_id UUID REFERENCES profiles(id),
    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    operation TEXT NOT NULL
);
```

---

## Client-Side Encryption Implementation

### Web Crypto API Pattern

```typescript
// AES-GCM encryption
export async function encrypt(
  plaintext: string, 
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Return IV + ciphertext as base64
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(
  ciphertext: string, 
  key: CryptoKey
): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}
```

---

## Encryption Verification

### Why It Is Necessary

Encrypted data must be verified for integrity.

### Security Benefits

- **Detects tampering**
- **Prevents corruption**
- **Ensures decryption works**

### Implementation

```typescript
// HMAC for integrity verification
export async function createHMAC(
  data: string, 
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyHMAC(
  data: string,
  hmac: string,
  key: CryptoKey
): Promise<boolean> {
  const encoder = new TextEncoder();
  const signature = Uint8Array.from(atob(hmac), c => c.charCodeAt(0));
  
  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    encoder.encode(data)
  );
}
```

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | Dexie encryption for PII | High | MVP |
| **P0** | HTTPS everywhere | Low | MVP |
| **P1** | Key derivation from password | Medium | Growth |
| **P2** | Automatic key rotation | High | Enterprise |
| **P2** | Hardware security module | High | Enterprise |
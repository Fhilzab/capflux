# Offline Security

> **Version:** 1.0 (Phase 1)  
> **Status:** Critical for African Market  

---

## Why Offline Security Is Necessary

Africa has unreliable internet connectivity. Schools lose power frequently. Offline-first architecture is essential, but it introduces unique threats:
- **Device theft** exposing all school financial data
- **Tampered offline data** replayed when connection returns
- **Queue manipulation** causing duplicate payments
- **Clock drift** affecting financial ordering

### Security Benefits

- Protects data on stolen/lost devices
- Ensures data integrity during sync
- Prevents financial manipulation
- Maintains audit trail integrity

### Trade-offs

| Aspect | Trade-off |
|--------|-----------|
| **Performance** | Encryption/decryption adds ~100ms latency |
| **Storage** | Encrypted data ~20% larger |
| **Complexity** | Sync conflict resolution more complex |
| **Recovery** | Lost recovery keys = unrecoverable data |

### Implementation Complexity: **High**
### Timeline: **MVP**

---

## Dexie Database Encryption

### Why It Is Necessary

IndexedDB is readable by any JavaScript running in the browser. Device theft in Africa is common; encryption is mandatory.

### Security Benefits

- Prevents data theft on stolen laptops
- Complies with NDPA/GDPR data protection
- Protects financial records offline

### Implementation Strategy

Use **Dexie Encrypt** extension or **Web Crypto API** for field-level encryption.

```typescript
// src/offline/localDb.ts (enhanced with encryption)
import Dexie, { Table } from 'dexie';
import { EncryptStorage } from 'dexie-encrypted';

// Encryption key derivation
async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password + salt),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypted student record
interface EncryptedStudent extends Student {
  encrypted_fields: {
    guardian_phone: string;  // AES-GCM encrypted
    dva_account_number?: string;
  };
}

// Dexie schema with encryption
class EncryptedCapstoneDB extends Dexie {
  students!: Table<EncryptedStudent, string>;
  
  constructor(encryptionKey: string) {
    super('capstone_local_db');
    
    // Apply encryption middleware
    this.use({
      hooks: {
        beforeCreate: (primKey, obj) => this.encryptSensitiveFields(obj),
        beforeUpdate: (modifications, id, transaction) => {
          const obj = transaction.objectStore('students').get(id);
          return this.encryptSensitiveFields(modifications);
        }
      }
    });
  }
  
  private async encryptSensitiveFields(record: any): Promise<any> {
    if (record.guardian_phone) {
      record.encrypted_fields = record.encrypted_fields || {};
      record.encrypted_fields.guardian_phone = await this.encrypt(record.guardian_phone);
      delete record.guardian_phone;
    }
    return record;
  }
  
  private async encrypt(plaintext: string): Promise<string> {
    // Implementation using Web Crypto API
    // Store encrypted value as base64
  }
}
```

### Fields Requiring Encryption

| Table | Field | Reason |
|-------|-------|--------|
| students | `guardian_phone` | PII, financial contact |
| students | `dva_account_number` | Payment identifier |
| guardians | `primary_phone`, `secondary_phone` | PII |
| guardians | `email` | PII |
| profiles | `full_name` | PII |
| notifications | `recipient_phone`, `message_body` | PII + financial data |

---

## Queue Signing & Integrity

### Why It Is Necessary

Offline sync queue can be manipulated to replay transactions or modify data. Each queue item must be **cryptographically signed**.

### Security Benefits

- Detects queue tampering
- Prevents replay attacks
- Ensures data authenticity

### Implementation

```typescript
// src/offline/syncQueue.ts (enhanced)
import { sign, verify } from '@/utils/crypto';

interface SignedSyncQueueItem extends SyncQueueItem {
  signature: string;  // HMAC-SHA256
  signed_at: number;  // Unix timestamp
  nonce: string;      // Unique per operation
}

export const SecureSyncQueue = {
  // ... existing methods ...

  async enqueueSecure(item: {
    school_id: string;
    entity_type: string;
    entity_id: string;
    payload: Record<string, unknown>;
    device_id: string;
  }): Promise<string> {
    const deviceKey = await this.getDeviceSigningKey();
    const nonce = crypto.randomUUID();
    const signedAt = Date.now();
    
    const dataToSign = {
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      payload: item.payload,
      device_id: item.device_id,
      nonce,
      signed_at: signedAt
    };
    
    const signature = await sign(JSON.stringify(dataToSign), deviceKey);
    
    return LocalRepository.enqueueSyncItem({
      ...item,
      operation: 'UPSERT',
      signature,
      signed_at: signedAt,
      status: 'PENDING'
    });
  },

  async verifyQueueItem(id: string): Promise<boolean> {
    const item = await LocalRepository.getSyncItemById(id);
    if (!item?.signature) return false;
    
    const deviceKey = await this.getDeviceSigningKey();
    const dataToVerify = {
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      payload: item.payload,
      device_id: item.school_id,  // Note: device_id stored differently
      nonce: 'extracted',  // From original signature
      signed_at: item.signed_at
    };
    
    return verify(JSON.stringify(dataToVerify), item.signature, deviceKey);
  },

  private async getDeviceSigningKey(): Promise<string> {
    // Derived from device fingerprint + user session
    // Rotated on login
    const stored = localStorage.getItem('device-signing-key');
    if (stored) return stored;
    
    const key = await this.generateDeviceKey();
    localStorage.setItem('device-signing-key', key);
    return key;
  }
};
```

---

## Replay Attack Prevention

### Why It Is Necessary

Offline device might replay old transactions when back online. Server must detect and reject duplicates.

### Security Benefits

- Prevents duplicate payments
- Blocks transaction manipulation
- Maintains financial integrity

### Implementation Strategy

1. **Client-side**: Include nonce and timestamp in queue items
2. **Server-side**: Track processed nonces with TTL
3. **Server-side**: Validate timestamps within acceptable drift

```sql
-- Server-side nonce tracking
CREATE TABLE sync_nonces (
    nonce TEXT PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id),
    entity_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_sync_nonces_expires ON sync_nonces(expires_at);

-- Cleanup expired nonces (cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void LANGUAGE SQL AS $$
    DELETE FROM sync_nonces WHERE expires_at < now();
$$;
```

```typescript
// Server-side duplicate detection (Edge Function)
export async function processSyncQueueItem(item: SyncQueueItem) {
  // Check if nonce already processed
  const { data: existing } = await supabase
    .from('sync_nonces')
    .select('nonce')
    .eq('nonce', item.nonce)
    .single();
  
  if (existing) {
    return { error: 'Duplicate operation detected', code: 'DUPLICATE' };
  }
  
  // Validate timestamp drift (max 5 minutes)
  const itemTime = new Date(item.signed_at || 0);
  const now = new Date();
  const drift = Math.abs(now.getTime() - itemTime.getTime());
  
  if (drift > 5 * 60 * 1000) {
    return { error: 'Timestamp drift too large', code: 'TIMESTAMP_INVALID' };
  }
  
  // Record nonce for future duplicate detection
  await supabase.from('sync_nonces').insert({
    nonce: item.nonce,
    school_id: item.school_id,
    entity_type: item.entity_type
  });
  
  // Process the actual operation
  return executeSyncItem(item);
}
```

---

## Conflict Detection

### Why It Is Necessary

Multiple devices used by different school staff can create conflicting updates.

### Security Benefits

- Prevents data loss
- Detects malicious overwrites
- Maintains data consistency

### Implementation

```typescript
// src/offline/conflictDetection.ts
interface VectorTimestamp {
  device_id: string;
  sequence: number;
  timestamp: number;
}

export const ConflictDetector = {
  // Lamport timestamp for causality
  async detectAndResolve(
    localItem: SyncQueueItem,
    serverItem: Record<string, unknown>
  ): Promise<'LOCAL' | 'SERVER' | 'CONFLICT'> {
    const localVector = localItem.metadata?.vector as VectorTimestamp;
    const serverVector = serverItem?.metadata?.vector as VectorTimestamp;
    
    if (!localVector || !serverVector) return 'CONFLICT';
    
    // Check if local is newer
    if (localVector.timestamp > serverVector.timestamp) {
      return 'LOCAL';
    }
    
    // Check if server is newer
    if (serverVector.timestamp > localVector.timestamp) {
      return 'SERVER';
    }
    
    // Same timestamp - check device sequence
    if (localVector.device_id === serverVector.device_id) {
      return localVector.sequence >= serverVector.sequence ? 'LOCAL' : 'SERVER';
    }
    
    // Genuine conflict - needs resolution
    return 'CONFLICT';
  },

  async resolveConflict(
    type: 'CONFLICT',
    localItem: SyncQueueItem,
    serverItem: Record<string, unknown>
  ): Promise<'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE'> {
    // For immutable ledgers: always prefer server (newer transaction)
    if (localItem.entity_type === 'ledger_entries') {
      return 'KEEP_SERVER';
    }
    
    // For students: merge changes
    // Use latest non-conflicting fields
    
    // Log conflict for audit
    await this.logConflict(localItem, serverItem);
    
    return 'MERGE';
  }
};
```

---

## Clock Drift Handling

### Why It Is Necessary

Device clocks may be wrong. Financial ordering must be preserved.

### Security Benefits

- Maintains transaction order
- Prevents timestamp manipulation
- Ensures audit integrity

### Implementation

```typescript
// Server authoritative timestamps
export const TimestampService = {
  // Client sends its local time
  // Server returns authoritative time
  async syncTime(): Promise<{
    server_time: string;
    client_offset: number;  // Milliseconds to add
  }> {
    const { data } = await supabase.rpc('get_server_time');
    
    const serverTime = new Date(data?.server_time || '');
    const clientTime = new Date();
    const offset = serverTime.getTime() - clientTime.getTime();
    
    return { server_time: data?.server_time, client_offset: offset };
  },

  // Apply offset to future timestamps
  getAdjustedTime(baseTime?: Date): Date {
    const offset = this.getStoredOffset();
    return new Date((baseTime || new Date()).getTime() + offset);
  }
};

// PostgreSQL function
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE AS $$
    SELECT now();
$$;
```

---

## Offline Authentication & Device Trust

### Why It Is Necessary

Users work offline for days. System must verify device trust.

### Security Benefits

- Prevents unauthorized offline access
- Detects compromised devices
- Enables device recovery

### Implementation

```typescript
// Device trust verification
export interface DeviceTrust {
  device_id: string;
  first_seen: number;
  last_seen: number;
  is_trusted: boolean;
  trust_token?: string;  // Valid for offline periods
}

export const OfflineAuth = {
  async canWorkOffline(): Promise<boolean> {
    const device = await this.getDeviceInfo();
    const profile = await this.getProfile();
    
    if (!device || !profile) return false;
    
    // Owner accounts get 7-day offline trust
    if (profile.role === 'OWNER') {
      return this.isTrustValid(device, 7);  // 7 days
    }
    
    // Other roles need online verification within 24 hours
    return this.isTrustValid(device, 1);  // 1 day
  },

  private isTrustValid(device: DeviceTrust, days: number): boolean {
    if (!device.last_seen) return false;
    
    const expiry = new Date(device.last_seen + days * 24 * 60 * 60 * 1000);
    return new Date() < expiry;
  }
};
```

---

## Tamper Detection

### Why It Is Necessary

Attackers with device access could modify local database.

### Security Benefits

- Detects malicious modifications
- Preserves data integrity
- Enables incident response

### Implementation

```typescript
// Merkle tree for tamper detection
class TamperDetection {
  async calculateMerkleRoot(table: string): Promise<string> {
    const records = await db[table].toArray();
    const hashes = records.map(r => this.hashRecord(r));
    
    // Build merkle tree
    return this.buildMerkleTree(hashes);
  }

  async verifyIntegrity(): Promise<{
    table: string;
    valid: boolean;
    expected: string;
    actual: string;
  }[]> {
    const results = await Promise.all(
      ['students', 'ledger_entries', 'guardians'].map(async table => {
        const knownRoot = localStorage.getItem(`merkle-${table}`);
        const actualRoot = await this.calculateMerkleRoot(table);
        
        return {
          table,
          valid: knownRoot === actualRoot,
          expected: knownRoot || 'none',
          actual: actualRoot
        };
      })
    );
    
    return results.filter(r => !r.valid);
  }

  private hashRecord(record: Record<string, unknown>): string {
    // Deterministic hash excluding timestamp/sequence
    const { created_at, updated_at, ...data } = record;
    return crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(JSON.stringify(data))
    ).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));
  }
}
```

---

## Implementation Priority

| Priority | Feature | Effort | Target |
|----------|---------|--------|--------|
| **P0** | Dexie encryption for PII | High | MVP |
| **P0** | Queue signing | High | MVP |
| **P0** | Replay attack prevention | Medium | MVP |
| **P1** | Conflict detection | Medium | Growth |
| **P1** | Clock drift handling | Medium | Growth |
| **P2** | Tamper detection | High | Enterprise |
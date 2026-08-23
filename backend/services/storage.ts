/**
 * storage — private document storage for sensitive uploads (CAC certificates).
 *
 * Binary documents are NEVER stored in PostgreSQL and NEVER in a public
 * bucket. By default documents are written to a private server directory
 * (CAPFLUX_STORAGE_DIR) with metadata returned to the caller.
 *
 * A Supabase Storage adapter can replace the filesystem backend by setting
 * CAPFLUX_STORAGE_BACKEND=supabase and configuring storage credentials; the
 * interface below (putObject / getSignedUrl) is the seam for that adapter.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const readFileAsync = promisify(fs.readFile);

export const STORAGE_DIR = process.env.CAPFLUX_STORAGE_DIR || path.resolve(process.cwd(), 'storage');
export const BACKEND = process.env.CAPFLUX_STORAGE_BACKEND || 'local';

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Compute a SHA-256 checksum of a buffer.
 */
export function checksum(buffer: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export interface StoredCacDocument {
  storage_path: string;
  mime_type: string;
  file_size: number;
  checksum: string;
}

/**
 * Store a CAC certificate (or any sensitive document).
 * Path: kyc/{schoolId}/{kycRecordId}/cac-certificate.{ext}
 */
export async function storeCacDocument({
  buffer,
  mimeType,
  extension,
  schoolId,
  kycRecordId,
}: {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  schoolId: string;
  kycRecordId: string;
}): Promise<StoredCacDocument> {
  const relPath = path.posix.join('kyc', schoolId, kycRecordId, `cac-certificate.${extension}`);
  const checksumValue = checksum(buffer);
  const size = buffer.length;

  if (BACKEND === 'local') {
    const absPath = path.join(STORAGE_DIR, relPath);
    ensureDir(path.dirname(absPath));
    fs.writeFileSync(absPath, buffer);
  } else if (BACKEND === 'supabase') {
    // Adapter seam: upload to a PRIVATE bucket (never public).
    throw new Error(
      'Supabase Storage backend is not configured. Set CAPFLUX_STORAGE_BUCKET and credentials, or use local backend.'
    );
  } else {
    throw new Error(`Unknown storage backend: ${BACKEND}`);
  }

  return {
    storage_path: relPath,
    mime_type: mimeType,
    file_size: size,
    checksum: checksumValue,
  };
}

export interface SignedDocumentUrl {
  url: string;
}

/**
 * Return a short-lived signed URL for an authorized reviewer.
 * Local backend: serves via a signed token (expiry enforced server-side).
 */
export async function getCacSignedUrl(storagePath: string): Promise<SignedDocumentUrl> {
  if (BACKEND === 'local') {
    // Short-lived signed token (HMAC of path + expiry).
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    const secret = process.env.CAPFLUX_STORAGE_SIGNING_SECRET || process.env.WORKOS_COOKIE_PASSWORD || 'dev-secret';
    const token = crypto
      .createHmac('sha256', secret)
      .update(`${storagePath}:${expiresAt}`)
      .digest('hex')
      .slice(0, 24);
    return { url: `/api/kyc/documents/serve?path=${encodeURIComponent(storagePath)}&expires=${expiresAt}&token=${token}` };
  }
  throw new Error('Signed URL generation is only supported on the local backend currently.');
}

/**
 * Verify a signed URL token and return the absolute file path (local backend).
 */
export function verifySignedUrl({
  path: storagePath,
  expires,
  token,
}: {
  path: unknown;
  expires: unknown;
  token: unknown;
}): string | null {
  const secret = process.env.CAPFLUX_STORAGE_SIGNING_SECRET || process.env.WORKOS_COOKIE_PASSWORD || 'dev-secret';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${storagePath}:${expires}`)
    .digest('hex')
    .slice(0, 24);
  if (token !== expected || Number(expires) < Date.now()) {
    return null;
  }
  const absPath = path.join(STORAGE_DIR, String(storagePath));
  if (!absPath.startsWith(path.resolve(STORAGE_DIR))) {
    return null; // path traversal guard
  }
  if (!fs.existsSync(absPath)) return null;
  return absPath;
}

export async function readStoredFile(absPath: string): Promise<Buffer> {
  return readFileAsync(absPath);
}

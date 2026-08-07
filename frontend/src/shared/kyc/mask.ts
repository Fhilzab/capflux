/**
 * KYC Identifier Masking Utilities
 */
export function maskBvn(bvnLast4?: string | null): string | null {
  if (!bvnLast4) return null;
  return '*'.repeat(6) + ' ' + bvnLast4;
}
export function maskNin(ninLast4?: string | null): string | null {
  if (!ninLast4) return null;
  return '*'.repeat(7) + ' ' + ninLast4;
}
export function maskIdentifier(value: string, visibleStart: number = 3, visibleEnd: number = 3): string {
  if (!value) return '';
  const str = String(value);
  if (str.length <= visibleStart + visibleEnd) return '*'.repeat(str.length);
  return str.slice(0, visibleStart) + '*'.repeat(str.length - visibleStart - visibleEnd) + str.slice(-visibleEnd);
}
export function isKycVerified(status: string | null | undefined): boolean {
  return status === 'VERIFIED';
}
export function isKycPending(status: string | null | undefined): boolean {
  return status === 'PENDING' || status === 'UNDER_REVIEW';
}
export function isKycRejected(status: string | null | undefined): boolean {
  return status === 'REJECTED';
}

import type { AuditError } from './types';

export function createAuditError(code: string, message: string, raw?: unknown): AuditError {
  return { code: code as any, message, raw };
}

export function mapAuditError(error: unknown, fallbackCode: string): AuditError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeError = error as { code?: unknown; message?: unknown };
    if (typeof maybeError.code === 'string') {
      return { code: maybeError.code as any, message: typeof maybeError.message === 'string' ? maybeError.message : 'Unknown audit error', raw: error };
    }
  }
  if (error instanceof Error) {
    return { code: fallbackCode as any, message: error.message, raw: error };
  }
  return { code: fallbackCode as any, message: 'Unknown audit error', raw: error };
}
import type { ReportingError } from './types';

export function createReportingError(code: string, message: string, raw?: unknown): ReportingError {
  return { code: code as any, message, raw };
}

export function mapReportingError(error: unknown, fallbackCode: string): ReportingError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeError = error as { code?: unknown; message?: unknown };
    if (typeof maybeError.code === 'string') {
      return {
        code: maybeError.code as any,
        message: typeof maybeError.message === 'string' ? maybeError.message : 'Unknown reporting error',
        raw: error,
      };
    }
  }

  if (error instanceof Error) {
    return { code: fallbackCode as any, message: error.message, raw: error };
  }

  return { code: fallbackCode as any, message: 'Unknown reporting error', raw: error };
}
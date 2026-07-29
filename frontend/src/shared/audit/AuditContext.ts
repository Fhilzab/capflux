/**
 * AuditContext
 * Captures contextual information for audit entries.
 */

import type { SourceModule } from './types';

export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  correlationId?: string;
  sourceModule: SourceModule;
}

export function createAuditContext(
  sourceModule: SourceModule,
  context: Partial<Omit<AuditContext, 'sourceModule'>> = {},
): AuditContext {
  return {
    sourceModule,
    ...context,
  };
}
import type { AuditEntry, AuditAction, AuditEntity, AuditSeverity, AuditResultStatus, SourceModule } from './types';
import type { AuditContext } from './AuditContext';
import { generateReference } from '../core/IdGenerator';

export class AuditEngine {
  static buildEntry(input: {
    organizationId: string;
    schoolId?: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId?: string;
    description: string;
    severity: AuditSeverity;
    result: AuditResultStatus;
    failureReason?: string;
    context: AuditContext;
    metadata?: Record<string, unknown>;
  }): Omit<AuditEntry, 'id' | 'auditNumber' | 'createdAt'> {
    return {
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      userId: input.context.userId,
      sessionId: input.context.sessionId,
      correlationId: input.context.correlationId,
      sourceModule: input.context.sourceModule,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      description: input.description,
      severity: input.severity,
      result: input.result,
      failureReason: input.failureReason,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      deviceId: input.context.deviceId,
      metadata: input.metadata,
      occurredAt: new Date().toISOString(),
    };
  }

  static generateAuditNumber(): string {
    return generateReference('AUD');
  }
}
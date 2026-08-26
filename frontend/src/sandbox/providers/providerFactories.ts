/**
 * Execution-mode provider factories.
 *
 * THE single place where production and sandbox persistence adapters are
 * selected. Domain services receive providers through these factories so no
 * component, store or service ever branches on the mode itself.
 */

import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import type { StudentProvider } from '../../shared/students/StudentProvider';
import { SupabaseStudentProvider } from '../../shared/students/SupabaseStudentProvider';
import type { AcademicProvider } from '../../shared/academic/AcademicProvider';
import { SupabaseAcademicProvider } from '../../shared/academic/SupabaseAcademicProvider';
import type { DivisionProvider } from '../../shared/divisions/DivisionProvider';
import { SupabaseDivisionProvider } from '../../shared/divisions/SupabaseDivisionProvider';
import type { FeeProvider } from '../../shared/fees/FeeProvider';
import { SupabaseFeeProvider } from '../../shared/fees/SupabaseFeeProvider';
import type { LedgerProvider } from '../../shared/ledger/LedgerProvider';
import { SupabaseLedgerProvider } from '../../shared/ledger/SupabaseLedgerProvider';
import type { AuditProvider } from '../../shared/audit/AuditProvider';
import { SupabaseAuditProvider } from '../../shared/audit/SupabaseAuditProvider';

import {
  SandboxStudentProvider,
  SandboxAcademicProvider,
  SandboxDivisionProvider,
  SandboxFeeProvider,
  SandboxLedgerProvider,
  SandboxAuditProvider,
} from './sandboxProviders';

export function createStudentProvider(): StudentProvider {
  return runtimeEnvironment.isSandbox ? new SandboxStudentProvider() : new SupabaseStudentProvider();
}

export function createAcademicProvider(): AcademicProvider {
  return runtimeEnvironment.isSandbox ? new SandboxAcademicProvider() : new SupabaseAcademicProvider();
}

export function createDivisionProvider(): DivisionProvider {
  return runtimeEnvironment.isSandbox ? new SandboxDivisionProvider() : new SupabaseDivisionProvider();
}

export function createFeeProvider(): FeeProvider {
  return runtimeEnvironment.isSandbox ? new SandboxFeeProvider() : new SupabaseFeeProvider();
}

export function createLedgerProvider(): LedgerProvider {
  return runtimeEnvironment.isSandbox ? new SandboxLedgerProvider() : new SupabaseLedgerProvider();
}

export function createAuditProvider(): AuditProvider {
  return runtimeEnvironment.isSandbox ? new SandboxAuditProvider() : new SupabaseAuditProvider();
}

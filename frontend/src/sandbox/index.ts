/**
 * CAPFLUX Sandbox execution mode — install & lifecycle.
 *
 * installSandboxMode() runs FIRST during bootstrap (before stores touch any
 * provider). It:
 *  1. seeds the isolated sandbox database deterministically when empty;
 *  2. swaps the audit provider to the sandbox trail;
 *  3. overrides external notification channels with the demo inbox provider.
 *
 * Nothing here touches production databases, sessions or network providers;
 * every construct fails closed outside sandbox mode (see ./runtime/sandboxGuard).
 */

import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';
import { assertSandboxMode } from './runtime/sandboxGuard';
import { getSandboxDb, deleteSandboxDatabase, type SandboxCapfluxDB } from './sandboxDb';
import { seedSandboxDatabase, type SeedResult } from './seed/seedSandbox';
import { SandboxAuditProvider } from './providers/sandboxProviders';
import { auditService } from '../shared/audit/AuditService';
import { notificationService } from '../shared/notifications/NotificationService';
import type {
  Notification as DomainNotification,
  NotificationProvider as DomainNotificationProvider,
  NotificationChannel,
  NotificationResult,
} from '../shared/notifications/types';

const SESSION_KEY = 'capflux_sandbox_session';
const DRAFT_KEY = 'capflux:kycSubmissionDraft';
const SANDBOX_NOTIFICATIONS_DB = 'capflux_sandbox_notifications_db';

/**
 * Demo delivery provider: marks EMAIL/SMS/WHATSAPP/PUSH notifications as
 * DELIVERED into the local inbox. No message ever leaves the browser.
 */
class DemoInboxDeliveryProvider implements DomainNotificationProvider {
  async send(
    notification: DomainNotification,
    channel: NotificationChannel,
  ): Promise<NotificationResult<DomainNotification>> {
    const delivered: DomainNotification = {
      ...notification,
      status: 'DELIVERED',
      sentAt: notification.sentAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    void channel;
    return { data: delivered, error: null };
  }

  async getStatus(notificationId: string): Promise<NotificationResult<DomainNotification | null>> {
    void notificationId;
    return { data: null, error: null };
  }

  async cancel(notificationId: string): Promise<NotificationResult<DomainNotification>> {
    void notificationId;
    return { data: null, error: null };
  }
}

let seedPromise: Promise<void> | null = null;

/** Seed on first run; subsequent boots verify the seed version only. */
async function ensureSandboxSeeded(): Promise<SeedResult | null> {
  const db = getSandboxDb();
  const meta = await db.sandbox_meta.get('seed_version');
  if (meta && Number(meta.value) >= 3) return null;
  const result = await seedSandboxDatabase(db);
  return result;
}

/**
 * Install sandbox mode. Idempotent; safe to await at bootstrap.
 */
export async function installSandboxMode(): Promise<{ seeded: SeedResult | null; datasetHash?: string; seedVersion?: number | null }> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'installSandboxMode');

  if (!seedPromise) {
    seedPromise = (async () => {
      await getSandboxDb().open();
      await ensureSandboxSeeded();
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;

  // Audit trail → sandbox persistence.
  auditService.setProvider(new SandboxAuditProvider());

  // External channels → demo inbox (nothing leaves the browser).
  const inbox = new DemoInboxDeliveryProvider();
  notificationService.setDispatcherOverrides({
    EMAIL: inbox,
    SMS: inbox,
    WHATSAPP: inbox,
    PUSH: inbox,
  });

  const meta = await getSandboxDb().sandbox_meta.get('seed_version');
  const hashRow = await getSandboxDb().sandbox_meta.get('dataset_hash');
  return {
    seeded: null,
    datasetHash: hashRow ? String(hashRow.value) : undefined,
    seedVersion: meta ? Number(meta.value) : null,
  };
}

/**
 * Reset Sandbox: wipes the isolated database (+ demo session and inbox),
 * reseeds deterministically and returns a fresh dataset summary.
 * PRODUCTION DATA IS UNREACHABLE FROM THIS CODE PATH BY CONSTRUCTION:
 * only the sandbox database name is ever deleted.
 */
export async function resetSandbox(): Promise<{ students: number; guardians: number; payments: number; ledgerEntries: number }> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'resetSandbox');

  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }

  await deleteSandboxDatabase();
  try {
    const { default: Dexie } = await import('dexie');
    await Dexie.delete(SANDBOX_NOTIFICATIONS_DB);
  } catch { /* dexie unavailable or db absent */ }

  seedPromise = null;
  await installSandboxMode();

  const db = getSandboxDb();
  const [students, guardians, payments, ledgerEntries] = await Promise.all([
    db.students.count(),
    db.guardians.count(),
    db.payment_transactions.count(),
    db.ledger_entries.count(),
  ]);
  return { students, guardians, payments, ledgerEntries };
}

/**
 * Deterministic re-seed WITHOUT deleting the physical database — used by the
 * release-gate tests (jsdom has no IndexedDB) and available as a fast reset
 * primitive. Clears every sandbox table first (seedSandboxDatabase does this),
 * so the result is identical to a full delete-and-recreate.
 */
export async function reseedSandboxInPlace(db?: SandboxCapfluxDB): Promise<SeedResult> {
  assertSandboxMode(runtimeEnvironment.isSandbox, 'reseedSandboxInPlace');
  return seedSandboxDatabase(db ?? getSandboxDb());
}

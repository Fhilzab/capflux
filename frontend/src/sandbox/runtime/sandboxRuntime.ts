/**
 * Sandbox runtime kernel.
 *
 * Central, reactive state for the demo controls:
 *  - ONLINE/OFFLINE toggle: when offline, network-bound sandbox operations
 *    (the API simulator and gateway) throw a connection error exactly like
 *    production axios would, while local-first mutations keep working and
 *    queue into the outbox.
 *  - Failure scenarios: deterministic switches that make specific flows fail
 *    so the full UX around errors can be exercised (payment failed/pending/
 *    reversed, sync failed, KYC rejected, settlement delayed…).
 *  - Event bus + counters for the control panel and sync indicators.
 */

import { reactive } from 'vue';

export type SandboxScenario =
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PENDING'
  | 'SYNC_FAILURE'
  | 'KYC_REJECT'
  | 'SETTLEMENT_DELAYED'
  | 'DUPLICATE_STUDENT'
  | 'IMPORT_VALIDATION';

export type SandboxEventType =
  | 'online-changed'
  | 'scenario-changed'
  | 'sync-started'
  | 'sync-completed'
  | 'outbox-changed'
  | 'reset-completed'
  | 'payment-simulated'
  | 'notification-created';

export interface SandboxEventListener {
  (event: SandboxEventType, detail?: unknown): void;
}

export interface SyncCounters {
  pending: number;
  synced: number;
  failed: number;
}

const ALL_SCENARIOS: SandboxScenario[] = [
  'PAYMENT_FAILED',
  'PAYMENT_PENDING',
  'SYNC_FAILURE',
  'KYC_REJECT',
  'SETTLEMENT_DELAYED',
  'DUPLICATE_STUDENT',
  'IMPORT_VALIDATION',
];

class SandboxRuntimeState {
  online = true;
  scenarios: Record<SandboxScenario, boolean> = ALL_SCENARIOS.reduce(
    (acc, key) => ({ ...acc, [key]: false }),
    {} as Record<SandboxScenario, boolean>,
  );
  counters: SyncCounters = { pending: 0, synced: 0, failed: 0 };
  lastSyncedAt: string | null = null;

  private listeners = new Set<SandboxEventListener>();

  setOnline(online: boolean): void {
    this.online = online;
    this.emit('online-changed', online);
  }

  isOnline(): boolean {
    return this.online;
  }

  setScenario(scenario: SandboxScenario, active: boolean): void {
    this.scenarios[scenario] = active;
    this.emit('scenario-changed', { scenario, active });
  }

  toggleScenario(scenario: SandboxScenario): boolean {
    const next = !this.scenarios[scenario];
    this.setScenario(scenario, next);
    return next;
  }

  isScenarioActive(scenario: SandboxScenario): boolean {
    return this.scenarios[scenario];
  }

  setCounters(counters: SyncCounters): void {
    this.counters.pending = counters.pending;
    this.counters.synced = counters.synced;
    this.counters.failed = counters.failed;
  }

  markSynced(atIso: string): void {
    this.lastSyncedAt = atIso;
  }

  on(listener: SandboxEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: SandboxEventType, detail?: unknown): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event, detail);
      } catch {
        // Listener failures must never break the runtime kernel.
      }
    }
  }

  resetControls(): void {
    this.setOnline(true);
    for (const key of ALL_SCENARIOS) {
      this.scenarios[key] = false;
    }
    this.counters.pending = 0;
    this.counters.synced = 0;
    this.counters.failed = 0;
    this.lastSyncedAt = null;
    this.emit('reset-completed');
  }
}

/** Reactive singleton consumed by the control panel, engines and simulator. */
export const sandboxRuntime: SandboxRuntimeState = reactive(new SandboxRuntimeState());

/** Error thrown by sandbox "network" operations when toggled offline. */
export class SandboxOfflineError extends Error {
  readonly code = 'NETWORK_UNAVAILABLE';
  constructor() {
    super('Sandbox is offline — request not sent.');
    this.name = 'SandboxOfflineError';
  }
}

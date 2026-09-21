/**
 * useModuleLock — capability-based module gating (Phase 8.2 progressive access).
 *
 * Each capability is tracked independently so that the correct
 * ModuleLockOverlay variant is shown:
 *
 *   • Onboarding incomplete  → 'setup'  gate  → /kyc/submit
 *   • KYC not verified        → 'kyc'    gate  → /kyc/submit?section=identity
 *   • Settlement not verified → 'settlement'  → /kyc/submit?section=settlement
 *   • Payment not activated   → 'payment' gate  → /kyc/submit?section=settlement
 *
 * If verification status cannot be loaded (network failure, etc.),
 * the gates fail OPEN for the *page content* but the underlying feature
 * still requires backend authorization. Non-sensitive features remain
 * accessible; sensitive financial features remain protected by the
 * backend requirePaymentReady middleware.
 */
import { computed, onMounted, watch } from 'vue';
import { getActivePinia } from 'pinia';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Authoritative financial-access gate reason, evaluated in precedence order:
 * setup → kyc → settlement → payment → granted (null).
 *
 * 'payment' preserves the pre-existing payment-activation overlay that pages
 * showed when onboarding.paymentStatus !== 'READY'. It is part of the single
 * centralized decision — pages must not re-derive it locally.
 */
export type FinancialLockReason = 'setup' | 'kyc' | 'settlement' | 'payment' | null;

export function useModuleLock() {
  const onboardingStore = useOnboardingStore();
  const financialStore = useFinancialActivationStore();

  // ── Payment lifecycle ─────────────────────────────────────
  // Distinguish VERIFIED vs UNKNOWN: only assert "not ready" when status is known.
  const paymentReady = computed(() => onboardingStore.statusLoaded && onboardingStore.paymentStatus === 'READY');
  const paymentsLocked = computed(() => {
    if (!onboardingStore.statusLoaded) return false;
    if (!onboardingStore.status) return false; // UNKNOWN (network/auth) — do not misrepresent as locked
    return onboardingStore.paymentStatus !== 'READY';
  });
  const requiresSetup = computed(() => {
    if (!onboardingStore.statusLoaded) return false;
    if (!onboardingStore.status) return false;
    return onboardingStore.requiresSetup;
  });

  // ── KYC / identity verification ─────────────────────────────
  const kycVerified = computed(() => financialStore.kycVerified);
  const kycState = computed(() => financialStore.kycState || 'NONE');
  // Only require KYC when we KNOW it is not verified; UNKNOWN must not be shown as "KYC required".
  const requiresKyc = computed(() => {
    if (!financialStore.kycStatusLoaded) return false;
    if (!financialStore.kycStatus?.kyc) return false; // UNKNOWN — status unavailable
    return !financialStore.kycVerified;
  });

  // ── Settlement account verification ────────────────────────
  const settlementVerified = computed(() => financialStore.settlementVerified);
  const requiresSettlement = computed(() => {
    if (!financialStore.settlementStatusLoaded) return false;
    if (!financialStore.settlementStatus?.settlement) return false;
    return !financialStore.settlementVerified;
  });

  // ── Payment activation (KYC + settlement + gateway + ACTIVE) ─
  const requiresPaymentActivation = computed(() => {
    if (!onboardingStore.statusLoaded) return false;
    if (!onboardingStore.status) return false;
    return !paymentReady.value;
  });

  // ── Unknown / unavailable states — honest presentation vs secure fail-closed
  const isKycStatusUnknown = computed(() =>
    financialStore.kycStatusLoaded && !financialStore.kycStatus?.kyc && !!financialStore.error
  );
  const isSettlementStatusUnknown = computed(() =>
    financialStore.settlementStatusLoaded && !financialStore.settlementStatus?.settlement && !!financialStore.error
  );
  const isOnboardingStatusUnknown = computed(() =>
    onboardingStore.statusLoaded && !onboardingStore.status && !!onboardingStore.error
  );
  const hasStatusError = computed(() =>
    !!(financialStore.error || onboardingStore.error)
  );

  // ── Combined loading ───────────────────────────────────────
  const loading = computed(() => onboardingStore.loading || onboardingStore.statusLoading || financialStore.loading);

  // ── Centralized financial-access gate ──────────────────────────
  // Fail-closed: unknown, missing, or failed verification status is never
  // treated as verified. While statuses are still loading the gate stays
  // locked so financial content cannot flash before verification resolves.
  // Pages must consume locked/lockReason/canAccessFinancials instead of
  // re-deriving Setup/KYC/Settlement checks locally.
  const isLoading = computed(() => loading.value);

  // Unknown = loaded but no status object. For onboarding/KYC this means the
  // account has no resolvable state (error or no record) → locked.
  // Settlement keeps its established semantics (no settlement on file means
  // nothing to verify; backend requirePaymentReady still enforces writes) and
  // only locks when the load itself failed.
  const setupUnknown = computed(
    () => onboardingStore.statusLoaded && !onboardingStore.status,
  );
  const kycUnknown = computed(
    () => financialStore.kycStatusLoaded && !financialStore.kycStatus?.kyc,
  );
  const settlementUnknown = computed(
    () =>
      financialStore.settlementStatusLoaded &&
      !financialStore.settlementStatus?.settlement &&
      !!financialStore.error,
  );

  const lockReason = computed<FinancialLockReason>(() => {
    // No reason is reported while verification is unresolved — consumers must
    // use showLock (overlay) and canAccessFinancials (content) instead.
    if (isLoading.value || awaitingInitial.value) return null;
    if (requiresSetup.value || setupUnknown.value) return 'setup';
    if (requiresKyc.value || kycUnknown.value) return 'kyc';
    if (requiresSettlement.value || settlementUnknown.value) return 'settlement';
    if (paymentsLocked.value) return 'payment';
    return null;
  });

  // Never-loaded stores mean verification has not resolved yet (e.g. first
  // render before onMounted loads kick in, or a manual store reset). Treat as
  // locked with no reason so pages show a loading state instead of flashing
  // financial content — or worse, briefly unlocking.
  const awaitingInitial = computed(
    () => !onboardingStore.statusLoaded && !financialStore.kycStatusLoaded,
  );

  const locked = computed(
    () => isLoading.value || awaitingInitial.value || lockReason.value !== null,
  );
  // Overlay visibility: only once loading has resolved (a reason exists then).
  const showLock = computed(() => locked.value && !isLoading.value && !awaitingInitial.value);
  const canAccessFinancials = computed(() => !isLoading.value && !locked.value);

  // ── Session guard ──────────────────────────────────────────────
  // Verification state belongs to one account. When the authenticated identity
  // changes, drop cached verification and reload so a previous account's result
  // can never unlock another account's pages. Skipped when no Pinia is active
  // (e.g. isolated unit tests) so the gate stays usable without a store.
  // Note: demo-persona switches that bypass authStore are not observable here;
  // demo auth-layer changes are out of scope for this gate.
  const installSessionGuard = () => {
    if (!getActivePinia()) return;
    const authStore = useAuthStore();
    let lastIdentity: string | null = authStore.user?.id ?? null;
    watch(
      () => authStore.user?.id ?? null,
      (current) => {
        if (current === lastIdentity) return;
        lastIdentity = current;
        onboardingStore.reset();
        financialStore.reset();
        onboardingStore.loadStatus().catch(() => {
          // Non-fatal: gate resolves fail-closed on the reset (unknown) state.
        });
        financialStore.loadAll().catch(() => {
          // Non-fatal: gate resolves fail-closed on the reset (unknown) state.
        });
      },
    );
  };

  onMounted(() => {
    installSessionGuard();
    if (!onboardingStore.status && !onboardingStore.statusLoaded) {
      onboardingStore.loadStatus().catch(() => {
        // Non-fatal: module lock resolves to safe defaults when offline.
      });
    }
    // Coalesce KYC + settlement + readiness + documents into a single
    // loadAll() call (internally deduplicated) instead of three separate
    // fire-and-forget requests that could race with the Setup Center.
    if (!financialStore.kycStatusLoaded || !financialStore.readinessLoaded) {
      financialStore.loadAll().catch(() => {
        // Backend returns 400 for inactive schools; the gate simply
        // resolves to "not verified" which is the correct fail-safe.
      });
    }
  });

  return {
    paymentReady,
    paymentsLocked,
    requiresSetup,
    requiresKyc,
    requiresSettlement,
    requiresPaymentActivation,
    kycVerified,
    kycState,
    settlementVerified,
    isKycStatusUnknown,
    isSettlementStatusUnknown,
    isOnboardingStatusUnknown,
    hasStatusError,
    loading,
    // Centralized gate contract (authoritative — prefer over the flags above).
    isLoading,
    locked,
    lockReason,
    showLock,
    canAccessFinancials,
    awaitingInitial,
    onboardingStore,
    financialStore,
  };
}

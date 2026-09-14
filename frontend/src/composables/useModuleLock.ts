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
import { computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';

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

  onMounted(() => {
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
    onboardingStore,
    financialStore,
  };
}

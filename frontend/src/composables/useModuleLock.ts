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
  const paymentReady = computed(() => onboardingStore.paymentStatus === 'READY');
  const paymentsLocked = computed(() => !paymentReady.value);
  const requiresSetup = computed(() => onboardingStore.requiresSetup);

  // ── KYC / identity verification ─────────────────────────────
  const kycVerified = computed(() => financialStore.kycVerified);
  const kycState = computed(() => financialStore.kycState || 'NONE');
  const requiresKyc = computed(() => !kycVerified.value);

  // ── Settlement account verification ────────────────────────
  const settlementVerified = computed(() => financialStore.settlementVerified);
  const requiresSettlement = computed(() => !settlementVerified.value);

  // ── Payment activation (KYC + settlement + gateway + ACTIVE) ─
  const requiresPaymentActivation = computed(() => !paymentReady.value);

  // ── Combined loading ───────────────────────────────────────
  const loading = computed(() => onboardingStore.loading || financialStore.loading);

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
    loading,
    onboardingStore,
    financialStore,
  };
}

/**
 * useModuleLock — module locking based on the school payment lifecycle.
 *
 * Operational modules stay accessible once the school is ACTIVE.
 * Payment modules (Payments, Virtual Accounts, Daily Collections,
 * Outstanding Fees, Revenue Dashboard, Reconciliation) are locked until
 * payment_status === READY.
 */
import { computed, onMounted } from 'vue';
import { useOnboardingStore } from '@/stores/onboardingStore';

export function useModuleLock() {
  const onboardingStore = useOnboardingStore();

  const paymentReady = computed(() => onboardingStore.paymentStatus === 'READY');
  const paymentsLocked = computed(() => onboardingStore.paymentStatus !== 'READY');
  const requiresSetup = computed(() => onboardingStore.requiresSetup);
  const loading = computed(() => onboardingStore.loading);

  onMounted(() => {
    if (!onboardingStore.status) {
      onboardingStore.loadStatus().catch(() => {
        // Non-fatal: module lock resolves to a safe default when offline.
      });
    }
  });

  return {
    paymentReady,
    paymentsLocked,
    requiresSetup,
    loading,
    onboardingStore,
  };
}

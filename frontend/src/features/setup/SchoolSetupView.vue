<script setup lang="ts">
/**
 * SetupCenterView — resilient "Setup & Verification Center".
 *
 * Phase 8.3 hardened: the full shell (branding, title, all four sections) is
 * ALWAYS rendered. Connection errors appear as a contextual banner INSIDE the
 * shell — never as a full-page replacement. This prevents the blank
 * "Connection problem" screen that occurred when the API failed and no cached
 * status existed.
 *
 * Sections:
 *   1. Account Setup  — 4-step operational onboarding (Profile, Org, School, Owner)
 *   2. Identity Verification (KYC) — compliance status via financial store
 *   3. Settlement — bank account for payouts via financial store
 *   4. Payment Activation — readiness gate via financial store
 *
 * Progressive-access model (Phase 8.2) is preserved: nothing here is forced.
 * The user can complete steps now or return later; sensitive features gate
 * individually via ModuleLockOverlay.
 */
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useAuthStore } from '@/stores/authStore';
import OnboardingChecklist from '@/features/onboarding/OnboardingChecklist.vue';
import ProfileStep from '@/features/onboarding/steps/ProfileStep.vue';
import OrganizationStep from '@/features/onboarding/steps/OrganizationStep.vue';
import SchoolStep from '@/features/onboarding/steps/SchoolStep.vue';
import OwnerInfoStep from '@/features/onboarding/steps/OwnerInfoStep.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const onboardingStore = useOnboardingStore();
const financialStore = useFinancialActivationStore();

// ─── Combined loading / error ───────────────────────────────────────
const isRetrying = computed(() => onboardingStore.statusLoading || financialStore.loading);
const hasCachedStatus = computed(() => !!onboardingStore.status);
// Skeleton only on the very first load when there is no cached data at all.
const showSkeleton = computed(
  () => onboardingStore.statusLoading && !hasCachedStatus.value,
);
const hasError = computed(
  () => !!onboardingStore.error || !!financialStore.error,
);

const errorTitle = computed(() => {
  const cat = onboardingStore.errorCategory || financialStore.errorCategory;
  if (cat === 'NETWORK_ERROR') return 'Connection problem';
  if (cat === 'AUTH_ERROR') return 'Authentication required';
  if (cat === 'SERVER_ERROR') return 'CAPFLUX is temporarily unavailable';
  if (cat === 'VALIDATION_ERROR') return 'Attention needed';
  return 'Unable to load setup status';
});

const errorDescription = computed(() => {
  const cat = onboardingStore.errorCategory || financialStore.errorCategory;
  if (cat === 'NETWORK_ERROR')
    return "We couldn't refresh your setup status right now. Check your connection and try again. Your saved setup information has not been deleted.";
  if (cat === 'AUTH_ERROR')
    return 'Your session could not be verified. Please sign in again.';
  if (cat === 'SERVER_ERROR')
    return 'CAPFLUX is temporarily unavailable. Please try again in a few minutes.';
  if (cat === 'VALIDATION_ERROR')
    return 'Some setup information needs attention before you can continue.';
  return onboardingStore.error || financialStore.error || 'An unexpected error occurred.';
});

const bannerVariant = computed(() => {
  const cat = onboardingStore.errorCategory || financialStore.errorCategory;
  return cat === 'AUTH_ERROR' ? 'danger' : 'warning';
});

const isRecoverable = computed(() => {
  const cat = onboardingStore.errorCategory || financialStore.errorCategory;
  return cat === 'NETWORK_ERROR' || cat === 'SERVER_ERROR';
});

// ─── Account Setup (onboarding steps) ───────────────────────────────
const currentStep = computed(() => onboardingStore.currentStep);
const onboardingNotComplete = computed(() => !onboardingStore.isOnboardingComplete);
const showCompleteButton = computed(
  () => currentStep.value === 4 && onboardingStore.isOnboardingComplete,
);

const stepSubtitles: Record<number, string> = {
  1: 'We use your profile to personalize your CAPFLUX experience.',
  2: 'Your organization is the parent entity for all your schools.',
  3: 'Enter your school details to set up fee structures later.',
  4: 'Provide owner contact details for verification and communication.',
};

// ─── Verification (KYC) section ──────────────────────────────────────
const kycBadgeVariant = computed(() => {
  switch (financialStore.kycState) {
    case 'VERIFIED':
      return 'success';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    case 'SUBMITTED':
      return 'info';
    default:
      return 'muted';
  }
});

const kycLabel = computed(() => {
  switch (financialStore.kycState) {
    case 'VERIFIED':
      return 'Verified';
    case 'UNDER_REVIEW':
      return 'Under review';
    case 'REJECTED':
      return 'Rejected';
    case 'SUBMITTED':
      return 'Submitted';
    default:
      return 'Not started';
  }
});

const kycRejectionReason = computed(
  () => financialStore.kycStatus?.kyc?.rejectionReason ?? null,
);

const kycCta = computed(() => {
  const state = financialStore.kycState;
  if (state === 'VERIFIED') return null;
  if (state === 'UNDER_REVIEW') return { text: 'View status', to: '/kyc/status' };
  if (state === 'REJECTED') return { text: 'Fix verification', to: '/kyc/submit' };
  if (state === 'SUBMITTED') return { text: 'Continue', to: '/kyc/status' };
  return { text: 'Start verification', to: '/kyc/submit' };
});

// ─── Settlement section ──────────────────────────────────────────────
const settlementBadgeVariant = computed(() => {
  const state = financialStore.settlementState;
  if (state === 'VERIFIED') return 'success';
  if (state === 'REJECTED') return 'danger';
  if (state === 'SUBMITTED') return 'warning';
  return 'muted';
});

const settlementLabel = computed(() => {
  const state = financialStore.settlementState;
  if (state === 'VERIFIED') return 'Verified';
  if (state === 'REJECTED') return 'Requires action';
  if (state === 'SUBMITTED') return 'Pending review';
  return 'Not configured';
});

const settlementCta = computed(() => {
  const state = financialStore.settlementState;
  if (state === 'VERIFIED') return null;
  if (state === 'REJECTED') return { text: 'Fix settlement', to: '/kyc/submit?section=settlement' };
  if (state === 'SUBMITTED') return { text: 'View details', to: '/kyc/submit?section=settlement' };
  return { text: 'Set up settlement', to: '/kyc/submit?section=settlement' };
});

// ─── Payment Activation section ──────────────────────────────────────
const paymentBadgeVariant = computed(() => {
  if (financialStore.isReady) return 'success';
  if (financialStore.readiness?.ready === false) return 'warning';
  return 'muted';
});

const paymentLabel = computed(() => {
  if (financialStore.isReady) return 'Ready';
  if (financialStore.readiness?.ready === false) return 'Waiting for verification';
  return 'Not ready';
});

const gatewayLabel = computed(() => {
  if (financialStore.gatewayAssigned) return financialStore.gatewayProvider || 'Assigned';
  return 'Not configured';
});

// ─── Lifecycle ───────────────────────────────────────────────────────
onMounted(async () => {
  if (authStore.isAuthenticated) {
    // Concurrent dedup lives in the stores; the guard here prevents
    // re-fetching when data already exists.
    const loads: Promise<unknown>[] = [];
    if (!onboardingStore.status && !onboardingStore.statusLoaded) {
      loads.push(onboardingStore.loadStatus());
    }
    if (!financialStore.kycStatusLoaded || !financialStore.readinessLoaded) {
      loads.push(financialStore.loadAll());
    }
    await Promise.allSettled(loads);

    // A step query param (from OnboardingChecklist navigation) takes precedence
    const stepQuery = route.query.step;
    if (stepQuery) {
      const stepNum = parseInt(stepQuery as string, 10);
      if (stepNum >= 1 && stepNum <= 4) onboardingStore.setStep(stepNum);
    }
    if (!stepQuery && onboardingStore.status) {
      onboardingStore.restoreStepFromStatus();
    }
  }
});

watch(
  () => route.query.step,
  (val) => {
    if (val) {
      const stepNum = parseInt(val as string, 10);
      if (stepNum >= 1 && stepNum <= 4) onboardingStore.setStep(stepNum);
    }
  },
);

// ─── Actions ─────────────────────────────────────────────────────────
function goToDashboard() {
  router.push('/dashboard');
}

function navigateTo(to: string) {
  if (isRetrying.value) return;
  router.push(to);
}

async function handleCompleteSetup() {
  try {
    await onboardingStore.completeOnboarding();
    router.push('/dashboard');
  } catch {
    // Error is surfaced via the contextual banner above.
  }
}

async function retryLoadStatus() {
  if (isRetrying.value) return;
  onboardingStore.clearError();
  financialStore.clearError();
  await Promise.allSettled([
    onboardingStore.loadStatus(),
    financialStore.loadAll(),
  ]);
}
</script>

<template>
  <div class="min-h-screen bg-surface text-text-primary font-sans">
    <!-- ===== Header — always visible (CAPFLUX branding + title) ===== -->
    <header class="border-b border-border bg-surface">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand">
              <span class="text-xl font-bold text-background">C</span>
            </div>
            <div>
              <h1 class="text-3xl font-bold text-text-primary">Setup &amp; Verification</h1>
              <p class="mt-1 text-sm text-text-muted">
                Manage your school setup, identity verification, settlement,
                and financial activation from one place.
              </p>
            </div>
          </div>
          <CmButton variant="secondary" @click="goToDashboard">
            Back to Dashboard
          </CmButton>
        </div>
      </div>
    </header>

    <!-- ===== Contextual error banner — inside the shell, never replaces page ===== -->
    <div
      v-if="hasError && !isRetrying"
      class="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8"
    >
      <CmAlert :variant="bannerVariant" :title="errorTitle" :description="errorDescription">
        <div class="mt-3 flex gap-2">
          <CmButton
            variant="primary"
            size="sm"
            :loading="isRetrying"
            :disabled="isRetrying"
            @click="retryLoadStatus"
          >
            Try again
          </CmButton>
          <CmButton
            v-if="isRecoverable"
            variant="secondary"
            size="sm"
            @click="goToDashboard"
          >
            Continue to Dashboard
          </CmButton>
        </div>
      </CmAlert>
    </div>

    <!-- ===== Main content — always rendered ===== -->
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <!-- Progressive-access explanation -->
      <CmAlert
        variant="info"
        title="You can complete verification when you need it"
        description="You can continue using the parts of CAPFLUX that are available to you. Verification is only required when you access features that handle sensitive financial operations."
        class="mb-8"
      />

      <!-- ===== Section 1: Account Setup ===== -->
      <section class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary">Account Setup</h2>
        <p class="mt-1 text-sm text-text-muted">
          Complete your school setup steps in order. You can return later.
        </p>

        <!-- Step progress navigation -->
        <div class="mt-6">
          <OnboardingChecklist v-if="!showSkeleton" />
          <div v-else class="animate-pulse space-y-3">
            <div v-for="i in 4" :key="i" class="flex items-center gap-2">
              <div class="h-7 w-7 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        </div>

        <!-- Step form / content -->
        <div class="mt-8">
          <template v-if="showSkeleton">
            <div class="animate-pulse rounded-card border border-border bg-card p-6 sm:p-8">
              <div class="space-y-4">
                <div class="h-6 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div class="h-10 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
                <div class="h-10 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <ProfileStep v-if="currentStep === 1" />
            <OrganizationStep v-else-if="currentStep === 2" />
            <SchoolStep v-else-if="currentStep === 3" />
            <OwnerInfoStep v-else-if="currentStep === 4" />
            <div v-else class="text-sm text-text-muted">
              Setup is complete.
            </div>
          </template>
        </div>

        <!-- Step subtitle -->
        <p v-if="!showSkeleton" class="mt-4 text-sm text-text-muted">
          {{ stepSubtitles[currentStep] }}
        </p>

        <!-- Step navigation -->
        <div
          v-if="!showSkeleton"
          class="mt-8 flex items-center justify-between border-t border-border pt-6"
        >
          <CmButton
            v-if="currentStep > 1"
            variant="secondary"
            @click="onboardingStore.goToPreviousStep()"
          >
            Back
          </CmButton>
          <CmButton
            v-if="showCompleteButton"
            variant="primary"
            :loading="onboardingStore.loading"
            @click="handleCompleteSetup"
          >
            Complete Setup
          </CmButton>
        </div>
      </section>

      <!-- ===== Section 2: Identity Verification (KYC) ===== -->
      <section class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary">Identity Verification</h2>
        <p class="mt-1 text-sm text-text-muted">
          Verify your business identity. Required before financial features
          can be activated. KYC is only requested when a feature needs it.
        </p>

        <div class="mt-6 rounded-card border border-border bg-card p-6">
          <div v-if="showSkeleton" class="animate-pulse space-y-3">
            <div class="h-5 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-8 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>

          <template v-else>
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-text-muted">Status</p>
                <div class="mt-1 flex items-center gap-2">
                  <CmBadge :variant="kycBadgeVariant" :label="kycLabel" />
                  <span
                    v-if="financialStore.kycState === 'REJECTED' && kycRejectionReason"
                    class="text-xs text-text-muted"
                  >
                    &mdash; {{ kycRejectionReason }}
                  </span>
                  <span
                    v-if="onboardingNotComplete"
                    class="text-xs text-text-muted"
                  >
                    (available after completing school setup)
                  </span>
                </div>
              </div>

              <CmButton
                v-if="kycCta && !onboardingNotComplete"
                variant="primary"
                size="sm"
                @click="navigateTo(kycCta.to)"
              >
                {{ kycCta.text }}
              </CmButton>
              <CmButton
                v-else-if="onboardingNotComplete"
                variant="secondary"
                size="sm"
                disabled
              >
                Complete school setup first
              </CmButton>
            </div>

            <div class="text-xs text-text-muted">
              You can complete verification now or return later. CAPFLUX will
              only ask when a feature requires it.
            </div>
          </template>
        </div>
      </section>

      <!-- ===== Section 3: Settlement ===== -->
      <section class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary">Settlement Account</h2>
        <p class="mt-1 text-sm text-text-muted">
          Your bank account for payouts. Required before financial settlement
          features can be activated.
        </p>

        <div class="mt-6 rounded-card border border-border bg-card p-6">
          <div v-if="showSkeleton" class="animate-pulse space-y-3">
            <div class="h-5 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-8 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>

          <template v-else>
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-text-muted">Status</p>
                <div class="mt-1 flex items-center gap-2">
                  <CmBadge :variant="settlementBadgeVariant" :label="settlementLabel" />
                  <span v-if="onboardingNotComplete" class="text-xs text-text-muted">
                    (available after completing school setup)
                  </span>
                </div>
              </div>

              <CmButton
                v-if="settlementCta && !onboardingNotComplete"
                variant="primary"
                size="sm"
                @click="navigateTo(settlementCta.to)"
              >
                {{ settlementCta.text }}
              </CmButton>
              <CmButton
                v-else-if="onboardingNotComplete"
                variant="secondary"
                size="sm"
                disabled
              >
                Complete school setup first
              </CmButton>
            </div>

            <div class="text-xs text-text-muted">
              Settlement information is needed before financial settlement
              features can become active.
            </div>
          </template>
        </div>
      </section>

      <!-- ===== Section 4: Payment Activation ===== -->
      <section class="mb-10">
        <h2 class="text-xl font-semibold text-text-primary">Financial Activation</h2>
        <p class="mt-1 text-sm text-text-muted">
          Your school is ready for payment processing once all prerequisites
          are met.
        </p>

        <div class="mt-6 rounded-card border border-border bg-card p-6">
          <div v-if="showSkeleton" class="animate-pulse space-y-4">
            <div class="h-5 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>

          <template v-else>
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-text-muted">Status</p>
                <div class="mt-1 flex items-center gap-2">
                  <CmBadge :variant="paymentBadgeVariant" :label="paymentLabel" />
                </div>
              </div>
            </div>

            <!-- Prerequisites checklist -->
            <div class="mt-4 space-y-3">
              <p class="text-xs font-medium text-text-muted">Prerequisites:</p>
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">
                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full"
                    :class="
                      onboardingStore.isOnboardingComplete
                        ? 'bg-success/10 text-success'
                        : 'bg-text-muted/10 text-text-muted'
                    "
                  >
                    <svg
                      v-if="onboardingStore.isOnboardingComplete"
                      class="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span
                    :class="
                      onboardingStore.isOnboardingComplete ? 'text-success' : 'text-text-muted'
                    "
                  >
                    School setup completed
                  </span>
                </li>
                <li class="flex items-center gap-2">
                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full"
                    :class="
                      financialStore.kycVerified
                        ? 'bg-success/10 text-success'
                        : 'bg-text-muted/10 text-text-muted'
                    "
                  >
                    <svg
                      v-if="financialStore.kycVerified"
                      class="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span
                    :class="
                      financialStore.kycVerified ? 'text-success' : 'text-text-muted'
                    "
                  >
                    Identity verification verified
                  </span>
                </li>
                <li class="flex items-center gap-2">
                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full"
                    :class="
                      financialStore.settlementVerified
                        ? 'bg-success/10 text-success'
                        : 'bg-text-muted/10 text-text-muted'
                    "
                  >
                    <svg
                      v-if="financialStore.settlementVerified"
                      class="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span
                    :class="
                      financialStore.settlementVerified ? 'text-success' : 'text-text-muted'
                    "
                  >
                    Settlement account verified
                  </span>
                </li>
                <li class="flex items-center gap-2">
                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full"
                    :class="
                      financialStore.gatewayAssigned
                        ? 'bg-success/10 text-success'
                        : 'bg-text-muted/10 text-text-muted'
                    "
                  >
                    <svg
                      v-if="financialStore.gatewayAssigned"
                      class="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span
                    :class="
                      financialStore.gatewayAssigned ? 'text-success' : 'text-text-muted'
                    "
                  >
                    Payment provider configured ({{ gatewayLabel }})
                  </span>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </section>

      <!-- ===== Status unavailable footer ===== -->
      <div
        v-if="!showSkeleton && !hasCachedStatus && !hasError"
        class="text-center text-sm text-text-muted"
      >
        No setup data loaded yet. Check your connection and try again.
      </div>
    </main>
  </div>
</template>

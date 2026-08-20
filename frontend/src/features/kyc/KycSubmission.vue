<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

import ProfileStep from '../onboarding/steps/ProfileStep.vue';
import IdentityVerificationStep from './steps/IdentityVerificationStep.vue';
import OrganisationStep from '../onboarding/steps/OrganizationStep.vue';
import SchoolStep from '../onboarding/steps/SchoolStep.vue';
import PrincipalStep from './steps/PrincipalStep.vue';
import OrganisationDocumentsStep from './steps/OrganisationDocumentsStep.vue';
import SettlementAccountStep from './steps/SettlementAccountStep.vue';
import ReviewStep from './steps/ReviewStep.vue';
import KycStatusStep from './steps/KycStatusStep.vue';

const router = useRouter();
const route = useRoute();

const onboardingStore = useOnboardingStore();
const activationStore = useFinancialActivationStore();

interface SectionDef {
  id: string;
  label: string;
  component: unknown;
}

const sections: SectionDef[] = [
  { id: 'personal', label: 'Personal', component: ProfileStep },
  { id: 'identity', label: 'Identity', component: IdentityVerificationStep },
  { id: 'organisation', label: 'Organisation', component: OrganisationStep },
  { id: 'school', label: 'School', component: SchoolStep },
  { id: 'principal', label: 'Principal', component: PrincipalStep },
  { id: 'documents', label: 'Documents', component: OrganisationDocumentsStep },
  { id: 'settlement', label: 'Settlement', component: SettlementAccountStep },
  { id: 'review', label: 'Review', component: ReviewStep },
];

const currentSectionIndex = ref(0);
const showStatus = ref(false);

// ── Section completion tracking ──────────────────────────────────

const sectionComplete = computed(() => {
  const personal = !!onboardingStore.personalInfo;
  const identity = !!activationStore.kycStatus?.kyc?.identityDocumentType;
  const organisation = !!onboardingStore.status?.organization;
  const school = !!onboardingStore.status?.school;
  const principal = onboardingStore.status?.principal?.invited === true ||
                     !!onboardingStore.personalInfo; // same-as-owner defaults to complete
  const documents = !!activationStore.kycStatus?.kyc?.cacRegistrationNumber;
  const settlement = !!activationStore.settlement;
  const review = settlement; // review is the final confirmation

  return {
    personal,
    identity,
    organisation,
    school,
    principal,
    documents,
    settlement,
    review,
  };
});

onMounted(() => {
  resumeFromQuery();
  onboardingStore.loadStatus();
  onboardingStore.loadProfile();
  activationStore.loadKycDraft();
  activationStore.loadKycStatus();
  activationStore.loadSettlementStatus();
  activationStore.loadReadiness();
});

// Resume from ?section=<id>
function resumeFromQuery() {
  const sectionId = route.query.section as string | undefined;
  if (sectionId) {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx >= 0) {
      currentSectionIndex.value = idx;
    }
  }
}

// ── Navigation ───────────────────────────────────────────────────

function nextSection() {
  if (currentSectionIndex.value < sections.length - 1) {
    currentSectionIndex.value++;
    updateUrl();
  }
}

function prevSection() {
  if (currentSectionIndex.value > 0) {
    currentSectionIndex.value--;
    updateUrl();
  }
}

function goToSection(index: number) {
  // Allow navigating to already-completed sections or the next one
  const complete = sectionComplete.value;
  const completedIds = Object.keys(complete).filter((k) => complete[k as keyof typeof complete]);
  const sectionId = sections[index]?.id;
  if (sectionId && (completedIds.includes(sectionId) || index <= findNextIncompleteIndex())) {
    currentSectionIndex.value = index;
    updateUrl();
  }
}

function findNextIncompleteIndex(): number {
  const c = sectionComplete.value;
  const order = ['personal', 'identity', 'organisation', 'school', 'principal', 'documents', 'settlement', 'review'];
  for (let i = 0; i < order.length; i++) {
    if (!c[order[i] as keyof typeof c]) {
      return Math.min(i, sections.length - 1);
    }
  }
  return sections.length - 1;
}

function updateUrl() {
  const sectionId = sections[currentSectionIndex.value].id;
  router.replace({ query: { section: sectionId } });
}

// ── Final submission ─────────────────────────────────────────────

const isSubmitting = ref(false);

async function doFinalSubmission() {
  isSubmitting.value = true;
  activationStore.clearError();
  try {
    // 1. Complete onboarding (activate school)
    await onboardingStore.completeOnboarding();

    // 2. Assemble KYC submission from collected wizard data
    const personalInfo = onboardingStore.personalInfo;
    const draft = activationStore.kycSubmissionDraft as {
      nin?: string | null;
      bvn?: string | null;
      identityDocumentType?: string | null;
      cacRegistrationNumber?: string | null;
      officialEmail?: string | null;
      officialPhone?: string | null;
      principalName?: string | null;
      principalPhone?: string | null;
      settlementBankCode?: string | null;
      settlementAccountNumber?: string | null;
    } | null;

    await activationStore.submitKyc({
      principalName: personalInfo
        ? [personalInfo.firstName, personalInfo.middleName, personalInfo.lastName]
            .filter(Boolean)
            .join(' ')
        : '',
      principalPhone: personalInfo?.phone || '',
      nin: draft?.nin || '',
      bvn: draft?.bvn || '',
      identityDocumentType: draft?.identityDocumentType || '',
      officialEmail: draft?.officialEmail || '',
      officialPhone: draft?.officialPhone || '',
      cacRegistrationNumber: draft?.cacRegistrationNumber || '',
      personalInfo: personalInfo
        ? {
            firstName: personalInfo.firstName,
            lastName: personalInfo.lastName,
            dateOfBirth: personalInfo.dateOfBirth || '',
          }
        : undefined,
    });

    // 3. Attempt settlement submission (may fail if KYC not yet verified)
    if (draft?.bvn) {
      try {
        // Settlement can only be submitted once KYC is verified.
        // If it fails here, the status screen will allow retry.
        await activationStore.submitSettlement(
          draft?.settlementBankCode || activationStore.settlement?.bankCode || '',
          draft?.settlementAccountNumber || '',
          draft.bvn,
        );
      } catch {
        // Settlement submission may fail if KYC is still under review.
        // Non-fatal — the status screen will handle it.
      }
    }

    showStatus.value = true;
  } catch {
    // Error is surfaced via activationStore.error
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-text-primary">
    <!-- Error banner -->
    <div v-if="activationStore.error" class="fixed top-4 left-1/2 -translate-x-1/2 z-30 max-w-md">
      <div class="rounded-card bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
        {{ activationStore.error }}
      </div>
    </div>

    <!-- Status screen after final submission -->
    <KycStatusStep v-if="showStatus" @back-to-review="showStatus = false" />

    <!-- Wizard -->
    <div v-else class="flex flex-col lg:flex-row min-h-screen">
      <!-- Progress sidebar (desktop) / top (mobile) -->
      <aside class="w-full lg:w-64 bg-card border-r border-border p-6 overflow-y-auto">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-8 h-8 rounded-card bg-brand flex items-center justify-center">
            <span class="text-white font-bold text-sm">C</span>
          </div>
          <span class="font-bold text-lg text-text-primary">CAPFLUX</span>
        </div>

        <p class="text-xs font-semibold text-text-muted uppercase mb-4">
          Setup &amp; Verification
        </p>

        <nav class="space-y-2">
          <div
            v-for="(section, idx) in sections"
            :key="section.id"
            @click="goToSection(idx)"
            class="cursor-pointer transition-colors"
            :class="{
              'opacity-50': idx > currentSectionIndex.value && !sectionComplete[section.id as keyof typeof sectionComplete],
            }"
          >
            <div class="flex items-center gap-3 py-2">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                :class="{
                  'bg-brand text-white': idx === currentSectionIndex.value,
                  'bg-success text-white': sectionComplete[section.id as keyof typeof sectionComplete],
                  'bg-surface border border-border text-text-muted':
                    idx !== currentSectionIndex.value && !sectionComplete[section.id as keyof typeof sectionComplete],
                }"
              >
                {{ idx + 1 }}
              </div>
              <span
                class="text-sm"
                :class="{
                  'font-semibold text-brand': idx === currentSectionIndex.value,
                  'text-text-primary': sectionComplete[section.id as keyof typeof sectionComplete],
                  'text-text-muted':
                    idx !== currentSectionIndex.value && !sectionComplete[section.id as keyof typeof sectionComplete],
                }"
              >
                {{ section.label }}
              </span>
              <CmBadge
                v-if="sectionComplete[section.id as keyof typeof sectionComplete]"
                variant="success"
                class="ml-auto"
              >
                ✓
              </CmBadge>
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main content -->
      <main class="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
        <div class="max-w-2xl mx-auto">
          <component
            :is="sections[currentSectionIndex].component"
            @next-step="nextSection"
            @prev-step="prevSection"
            @complete-section="showStatus ? null : null"
          />

          <!-- Final submission button (Review step) -->
          <div
            v-if="currentSectionIndex === sections.length - 1"
            class="mt-8 pt-6 border-t border-border space-y-4"
          >
            <CmAlert variant="info">
              Review your information and submit for verification. You can edit any section
              using the sidebar.
            </CmAlert>

            <div
              v-if="activationStore.error"
              class="rounded-card bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger"
            >
              {{ activationStore.error }}
            </div>

            <CmButton
              variant="primary"
              :loading="isSubmitting || onboardingStore.loading || activationStore.loading"
              @click="doFinalSubmission"
              class="w-full sm:w-auto"
            >
              Confirm &amp; Submit KYC
            </CmButton>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Ensure progress sidebar fits on mobile without overflow */
@media (max-width: 640px) {
  .overflow-y-auto {
    max-height: 20vh;
  }
}
</style>

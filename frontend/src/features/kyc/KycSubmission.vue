<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';
import ProfileStep from '@/features/onboarding/steps/ProfileStep.vue';
import OrganizationStep from '@/features/onboarding/steps/OrganizationStep.vue';
import SchoolStep from '@/features/onboarding/steps/SchoolStep.vue';
import OwnerInfoStep from '@/features/onboarding/steps/OwnerInfoStep.vue';
import IdentityVerificationStep from '@/features/kyc/steps/IdentityVerificationStep.vue';
import OrganisationDocumentsStep from '@/features/kyc/steps/OrganisationDocumentsStep.vue';
import PrincipalStep from '@/features/kyc/steps/PrincipalStep.vue';
import SettlementAccountStep from '@/features/kyc/steps/SettlementAccountStep.vue';
import ReviewStep from '@/features/kyc/steps/ReviewStep.vue';
import KycStatusStep from '@/features/kyc/steps/KycStatusStep.vue';

const router = useRouter();
const route = useRoute();
const onboardingStore = useOnboardingStore();
const activationStore = useFinancialActivationStore();

// Section definitions — the canonical linear journey order
const sections = [
  { id: 'personal', label: 'Personal Information', description: 'Your personal details' },
  { id: 'identity', label: 'Identity Verification', description: 'Verify your identity document (NIN)' },
  { id: 'organization', label: 'Organisation Information', description: 'Business / organisation details' },
  { id: 'documents', label: 'Organisation Documents', description: 'CAC certificate and registration' },
  { id: 'school', label: 'School Information', description: 'School setup (levels, category, gender)' },
  { id: 'principal', label: 'Principal Information', description: 'School principal details' },
  { id: 'settlement', label: 'Settlement Account', description: 'Bank account for settlements' },
  { id: 'review', label: 'Review & Confirmation', description: 'Review all information' },
];

// Current section — driven by ?section= query param on first load or entry
const currentSectionIndex = ref(
  Math.max(
    0,
    sections.findIndex((s) => s.id === route.query.section),
  ),
);
if (currentSectionIndex.value < 0) currentSectionIndex.value = 0;

// Track completed sections for the progress indicator
const completedSections = ref<Set<string>>(new Set());
const submitting = ref(false);
const alertError = ref('');
const alertSuccess = ref('');
const showStatus = ref(false);

const currentSection = computed(() => sections[currentSectionIndex.value]);

// Dynamically render the right component per section
const sectionComponents = {
  personal: ProfileStep,
  identity: IdentityVerificationStep,
  organization: OrganizationStep,
  documents: OrganisationDocumentsStep,
  school: SchoolStep,
  principal: PrincipalStep,
  settlement: SettlementAccountStep,
  review: ReviewStep,
};

const currentComponent = shallowRef(sectionComponents.personal);
watch(currentSectionIndex, (newIdx) => {
  currentComponent.value = sectionComponents[sections[newIdx].id];
});

function goToNextSection() {
  const idx = currentSectionIndex.value + 1;
  if (idx < sections.length) {
    completedSections.value.add(sections[currentSectionIndex.value].id);
    currentSectionIndex.value = idx;
  } else if (sections[currentSectionIndex.value].id === 'review') {
    // Final submission triggered from ReviewStep via emit
    doFinalSubmission();
  }
}

function goToPrevSection() {
  if (currentSectionIndex.value > 0) {
    currentSectionIndex.value--;
  }
}

function goToSection(id: string) {
  const idx = sections.findIndex((s) => s.id === id);
  if (idx >= 0) {
    currentSectionIndex.value = idx;
  }
}

async function doFinalSubmission() {
  alertError.value = '';
  alertSuccess.value = '';
  submitting.value = true;
  try {
    // Finalize: complete onboarding (school activation) then complete KYC
    await onboardingStore.completeOnboarding();
    await activationStore.submitKyc({
      principalName: '',
      principalPhone: '',
      bvn: '',
      nin: '',
    });
    showStatus.value = true;
    alertSuccess.value = 'Your KYC and school registration have been submitted successfully.';
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Submission failed. Please try again.';
  } finally {
    submitting.value = false;
  }
}

// Listen for events from step components
function handleNextStep() {
  goToNextSection();
}

function handlePrevStep() {
  goToPrevSection();
}

function handleEditSection(sectionId: string) {
  goToSection(sectionId);
}

function handleSubmitAll() {
  doFinalSubmission();
}

// On mount, load status to populate progress indicator
onMounted(() => {
  activationStore.loadKycStatus();
  onboardingStore.loadStatus();
});
</script>

<template>
  <main class="min-h-screen bg-surface-50">
    <div class="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <!-- CAPFLUX Branding + Title -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-brand sm:text-3xl">CAPFLUX</h1>
        <p class="mt-2 text-lg font-semibold text-text-primary">Setup &amp; Verification</p>
      </div>

      <!-- Progress Indicator -->
      <nav aria-label="Progress" class="mb-8">
        <ol role="list" class="flex items-center justify-center space-x-2 sm:space-x-4">
          <li v-for="(section, idx) in sections" :key="section.id" class="flex items-center">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
              :class="{
                'bg-brand text-white': completedSections.has(section.id) || currentSectionIndex === idx,
                'bg-surface text-text-secondary': !completedSections.has(section.id) && currentSectionIndex !== idx,
                'border border-divider': !completedSections.has(section.id) && currentSectionIndex !== idx,
              }"
            >
              {{ idx + 1 }}
            </div>
            <span
              v-if="idx < sections.length - 1"
              class="mx-2 hidden h-px w-6 sm:mx-4 sm:w-12"
              :class="completedSections.has(section.id) ? 'bg-brand' : 'bg-divider'"
            ></span>
            <span
              v-if="idx === currentSectionIndex"
              class="ml-2 text-xs font-medium text-text-secondary hidden sm:inline"
            >
              {{ section.label }}
            </span>
          </li>
        </ol>
      </nav>

      <!-- Global alert messages -->
      <CmAlert v-if="alertError" variant="danger" class="mb-4">{{ alertError }}</CmAlert>
      <CmAlert v-if="alertSuccess" variant="success" class="mb-4">{{ alertSuccess }}</CmAlert>

      <!-- Section Title + Helper Text -->
      <div class="mb-6 text-center sm:text-left">
        <h2 class="text-xl font-semibold text-text-primary">{{ currentSection.label }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ currentSection.description }}</p>
      </div>

      <!-- Step Component -->
      <div class="rounded-card bg-card p-6 sm:p-8 shadow-card">
        <component
          :is="currentComponent"
          @next-step="handleNextStep"
          @prev-step="handlePrevStep"
          @edit-section="handleEditSection"
          @submit-all="handleSubmitAll"
          v-show="!showStatus"
        />

        <!-- Status view (after submission) -->
        <KycStatusStep v-if="showStatus" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.bg-surface-50 { background-color: #f8fafc; }
.bg-surface { background-color: #ffffff; }
.bg-surface-50.border { border-color: #e2e8f0; }
.bg-surface-50.text-text-secondary { color: #64748b; }
.bg-brand { background-color: #3b82f6; color: #ffffff; }
.bg-brand.text-white { color: #ffffff; }
.text-brand { color: #3b82f6; }
</style>

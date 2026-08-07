<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const form = ref({
  principalName: '',
  principalPhone: '',
  officialEmail: '',
  officialPhone: '',
  cacRegistrationNumber: '',
  cacCertificatePath: '',
  bvn: '',
  nin: '',
});

const submitting = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

const isResubmitMode = computed(() => onboardingStore.paymentStatus === 'REJECTED');

function maskBvnDisplay(val: string): string {
  if (!val || val.length < 4) return '';
  return '*'.repeat(Math.max(0, val.length - 3)) + val.slice(-3);
}

async function handleSubmit() {
  if (!form.value.principalName || !form.value.principalPhone) {
    alertError.value = 'Principal name and phone are required';
    return;
  }
  if (!form.value.bvn || !form.value.nin) {
    alertError.value = 'Both BVN and NIN are required';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    if (isResubmitMode.value) {
      await onboardingStore.resubmitKyc({
        principalName: form.value.principalName,
        principalPhone: form.value.principalPhone,
        officialEmail: form.value.officialEmail || undefined,
        officialPhone: form.value.officialPhone || undefined,
        cacRegistrationNumber: form.value.cacRegistrationNumber || undefined,
        cacCertificatePath: form.value.cacCertificatePath || undefined,
        bvn: form.value.bvn,
        nin: form.value.nin,
      });
      alertSuccess.value = 'KYC resubmitted successfully. Under review.';
    } else {
      await onboardingStore.submitKyc({
        principalName: form.value.principalName,
        principalPhone: form.value.principalPhone,
        officialEmail: form.value.officialEmail || undefined,
        officialPhone: form.value.officialPhone || undefined,
        cacRegistrationNumber: form.value.cacRegistrationNumber || undefined,
        cacCertificateUrl: form.value.cacCertificatePath || undefined,
        bvn: form.value.bvn,
        nin: form.value.nin,
      });
      alertSuccess.value = 'KYC submitted successfully. Under review.';
    }
    // Mask the fields after submission for security
    form.value.bvn = '';
    form.value.nin = '';
    setTimeout(() => router.push({ name: 'KycDashboard' }), 1500);
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to submit KYC';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 class="text-4xl font-semibold mb-2">
          {{ isResubmitMode ? 'Resubmit KYC' : 'Submit KYC for Verification' }}
        </h1>
        <p class="text-text-muted">
          Provide the following information to activate fee collection.
          BVN and NIN are encrypted at the application layer and never
          stored in plaintext.
        </p>
      </div>

      <CmAlert v-if="alertError" variant="error">{{ alertError }}</CmAlert>
      <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

      <section class="rounded-card bg-card p-8 shadow-card space-y-6">
        <h2 class="text-xl font-semibold text-text-primary">Principal Details</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmInput v-model="form.principalName" label="Principal Full Name" required />
          <CmInput v-model="form.principalPhone" label="Principal Phone" type="tel" required />
        </div>

        <h2 class="text-xl font-semibold text-text-primary">School Contact</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmInput v-model="form.officialEmail" label="Official Email" type="email" :helper-text="'School official email address'" />
          <CmInput v-model="form.officialPhone" label="Official Phone" type="tel" :helper-text="'School official phone number'" />
        </div>

        <h2 class="text-xl font-semibold text-text-primary">Organization</h2>
        <CmInput v-model="form.cacRegistrationNumber" label="CAC Registration Number" :helper-text="'Enter exactly as it appears on your CAC certificate'" />
        <CmInput v-model="form.cacCertificatePath" label="CAC Certificate URL" :helper-text="'Link to uploaded PDF/JPG/JPEG/PNG (max 10MB)'" />
      </section>

      <section class="rounded-card bg-card p-8 shadow-card space-y-6">
        <h2 class="text-xl font-semibold text-text-primary">Owner Identity Verification</h2>
        <p class="text-sm text-text-muted">
          Both BVN and NIN are required for future re-verification.
          They are encrypted with AES-256-GCM before storage.
          After submission, only masked versions are displayed.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmInput v-model="form.bvn" label="Bank Verification Number (BVN)" type="number" required />
          <CmInput v-model="form.nin" label="National Identification Number (NIN)" type="number" required />
        </div>

        <div v-if="isResubmitMode" class="text-sm text-warning bg-warning/10 p-3 rounded">
          Your previous KYC was rejected. Please review and resubmit with corrected information.
        </div>
      </section>

      <div class="flex justify-end pt-4 gap-4">
        <CmButton variant="ghost" @click="router.push({ name: 'KycDashboard' })">
          Back to Dashboard
        </CmButton>
        <CmButton variant="primary" :loading="submitting" @click="handleSubmit">
          {{ isResubmitMode ? 'Resubmit KYC' : 'Submit KYC' }}
        </CmButton>
      </div>
    </div>
  </main>
</template>

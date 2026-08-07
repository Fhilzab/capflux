<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';

const router = useRouter();
const activationStore = useFinancialActivationStore();

const form = ref({
  principalName: '',
  principalPhone: '',
  officialEmail: '',
  officialPhone: '',
  cacRegistrationNumber: '',
  bvn: '',
  nin: '',
});

const cacFile = ref<File | null>(null);
const cacUploading = ref(false);

const submitting = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

const isResubmitMode = computed(() => activationStore.kycRejected);

const bvnError = computed(() =>
  form.value.bvn && !/^\d{11}$/.test(form.value.bvn) ? 'BVN must be exactly 11 digits' : ''
);
const ninError = computed(() =>
  form.value.nin && !/^\d{11}$/.test(form.value.nin) ? 'NIN must be exactly 11 digits' : ''
);

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  cacFile.value = file;
}

async function uploadCac() {
  if (!cacFile.value) return;
  cacUploading.value = true;
  alertError.value = '';
  try {
    await activationStore.uploadCacDocument(cacFile.value);
    alertSuccess.value = 'CAC certificate uploaded.';
  } catch (e) {
    alertError.value = (e as Error).message || 'Failed to upload CAC certificate';
  } finally {
    cacUploading.value = false;
  }
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
  if (bvnError.value || ninError.value) {
    alertError.value = 'BVN and NIN must each be exactly 11 digits';
    return;
  }
  alertError.value = '';
  submitting.value = true;
  try {
    if (isResubmitMode.value) {
      await activationStore.resubmitKyc({
        principalName: form.value.principalName,
        principalPhone: form.value.principalPhone,
        officialEmail: form.value.officialEmail || undefined,
        officialPhone: form.value.officialPhone || undefined,
        cacRegistrationNumber: form.value.cacRegistrationNumber || undefined,
        bvn: form.value.bvn,
        nin: form.value.nin,
      });
      alertSuccess.value = 'KYC resubmitted successfully. Under review.';
    } else {
      await activationStore.submitKyc({
        principalName: form.value.principalName,
        principalPhone: form.value.principalPhone,
        officialEmail: form.value.officialEmail || undefined,
        officialPhone: form.value.officialPhone || undefined,
        cacRegistrationNumber: form.value.cacRegistrationNumber || undefined,
        bvn: form.value.bvn,
        nin: form.value.nin,
      });
      alertSuccess.value = 'KYC submitted successfully. Under review.';
    }
    // Mask the fields after submission for security
    form.value.bvn = '';
    form.value.nin = '';
    setTimeout(() => router.push({ name: 'KycDashboard' }), 1200);
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to submit KYC';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  activationStore.loadKycDocuments();
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 class="text-4xl font-semibold mb-2">
          {{ isResubmitMode ? 'Resubmit KYC' : 'Submit KYC for Verification' }}
        </h1>
        <p class="text-text-muted">
          Your NIN/BVN are encrypted at the application layer and never stored
          in plaintext. They are used only for identity verification and are
          never shown in full after submission.
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
          <CmInput v-model="form.officialEmail" label="Official Email" type="email" helper-text="School official email address" />
          <CmInput v-model="form.officialPhone" label="Official Phone" type="tel" helper-text="School official phone number" />
        </div>

        <h2 class="text-xl font-semibold text-text-primary">Organization</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmInput
            v-model="form.cacRegistrationNumber"
            label="CAC Registration Number"
            helper-text="As it appears on your CAC certificate"
          />
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-text-primary">CAC Certificate <span class="text-danger">*</span></label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              class="block w-full text-sm text-text-secondary file:mr-4 file:rounded-button file:border-0 file:bg-surface file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface/80"
              @change="onFileChange"
            />
            <p class="text-xs text-text-muted">PDF, JPG, or PNG up to 10MB.</p>
            <CmButton
              v-if="cacFile"
              variant="secondary"
              size="sm"
              :loading="cacUploading"
              @click="uploadCac"
            >
              {{ activationStore.cacDocument ? 'Replace Certificate' : 'Upload Certificate' }}
            </CmButton>
            <p v-if="activationStore.cacDocument" class="text-xs text-success">
              Certificate uploaded · {{ activationStore.cacDocument.status }}
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card space-y-6">
        <h2 class="text-xl font-semibold text-text-primary">Owner Identity Verification</h2>
        <p class="text-sm text-text-muted">
          Your NIN and BVN are required for identity verification. They are
          encrypted before storage and only masked values are shown after
          submission.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CmInput v-model="form.bvn" label="Bank Verification Number (BVN)" type="text" :error="bvnError" required helper-text="11 digits" />
          <CmInput v-model="form.nin" label="National Identification Number (NIN)" type="text" :error="ninError" required helper-text="11 digits" />
        </div>

        <div v-if="isResubmitMode" class="text-sm text-warning bg-warning/10 p-3 rounded">
          Your previous KYC was rejected. Please review the reason and resubmit
          with corrected information.
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

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import CmInput from '@/components/ui/CmInput.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const activationStore = useFinancialActivationStore();

const cacFile = ref<File | null>(null);
const uploading = ref(false);
const alertError = ref('');
const alertSuccess = ref('');

const form = ref({
  cacRegistrationNumber: '',
});

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  cacFile.value = input.files?.[0] || null;
}

const isFormValid = computed(() => {
  // CAC upload is optional if a document is already on record
  return !!form.value.cacRegistrationNumber;
});

const hasDocument = computed(() => !!activationStore.cacDocument);
const documentStatus = computed(() => activationStore.cacDocument?.status || null);

const statusVariant = computed(() => {
  if (!documentStatus.value) return 'info';
  if (documentStatus.value === 'VERIFIED') return 'success';
  if (documentStatus.value === 'REJECTED') return 'danger';
  return 'warning';
});

async function uploadCac() {
  if (!cacFile.value) return;
  uploading.value = true;
  alertError.value = '';
  try {
    await activationStore.uploadCacDocument(cacFile.value);
    alertSuccess.value = 'CAC certificate uploaded successfully.';
    cacFile.value = null;
  } catch (e) {
    alertError.value = (e as Error)?.message || 'Failed to upload CAC certificate';
  } finally {
    uploading.value = false;
  }
}

function removeFile() {
  cacFile.value = null;
}

onMounted(() => {
  activationStore.loadKycDocuments();
});

function canProceed(): boolean {
  // User can proceed if they have a CAC number entered
  // (certificate upload is optional but recommended)
  return !!form.value.cacRegistrationNumber;
}
</script>

<template>
  <section class="rounded-card bg-card p-8 shadow-card space-y-6">
    <h2 class="text-xl font-semibold text-text-primary">Organisation Documents</h2>
    <p class="text-sm text-text-muted">
      Provide your CAC registration details and upload your certificate.
      Documents are stored in private storage and never exposed publicly.
    </p>

    <CmAlert v-if="alertError" variant="danger">{{ alertError }}</CmAlert>
    <CmAlert v-if="alertSuccess" variant="success">{{ alertSuccess }}</CmAlert>

    <CmInput
      v-model="form.cacRegistrationNumber"
      label="CAC Registration Number"
      helper-text="As it appears on your CAC certificate"
    />

    <div>
      <label class="block text-sm font-medium text-text-primary mb-1">
        CAC Certificate
      </label>
      <input
        v-if="!hasDocument"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        class="block w-full text-sm text-text-secondary file:mr-4 file:rounded-button file:border-0 file:bg-surface file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface/80"
        @change="onFileChange"
      />
      <div v-else class="flex items-center justify-between rounded-card border border-divider bg-surface p-4">
        <div>
          <p class="text-sm font-medium text-text-primary">Certificate on file</p>
          <p class="text-xs text-text-secondary">
            Uploaded: {{ cacDocument?.uploaded_at || '—' }}
          </p>
        </div>
        <CmBadge :variant="statusVariant" :label="documentStatus || 'Pending'" />
      </div>

      <div v-if="cacFile" class="mt-2 flex items-center justify-between text-sm">
        <span class="text-text-secondary">{{ cacFile.name }} ({{ (cacFile.size / 1024).toFixed(1) }} KB)</span>
        <button @click="removeFile" class="text-danger hover:text-danger/80 transition-colors">Remove</button>
      </div>

      <p class="mt-1 text-xs text-text-muted">PDF, JPG, or PNG up to 10MB.</p>
    </div>

    <div v-if="hasDocument && cacDocument" class="grid gap-3 sm:grid-cols-2 text-sm">
      <div class="flex justify-between py-2 border-b border-divider">
        <span class="text-text-secondary">File size</span>
        <span class="text-text-primary">{{ cacDocument.file_size ? `${(cacDocument.file_size / 1024).toFixed(1)} KB` : '—' }}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-divider">
        <span class="text-text-secondary">MIME type</span>
        <span class="text-text-primary">{{ cacDocument.mime_type || '—' }}</span>
      </div>
    </div>

    <CmButton v-if="cacFile" variant="secondary" size="sm" :loading="uploading" @click="uploadCac">
      {{ hasDocument ? 'Replace Certificate' : 'Upload Certificate' }}
    </CmButton>

    <div class="flex justify-between pt-4 gap-4">
      <CmButton variant="ghost" @click="$emit('prev-step')">Back</CmButton>
      <CmButton variant="primary" :disabled="!canProceed()" @click="$emit('next-step')">
        Save & Continue
      </CmButton>
    </div>
  </section>
</template>

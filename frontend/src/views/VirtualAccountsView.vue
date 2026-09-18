<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePaymentsStore } from '@/stores/paymentsStore';
import { useStudentStore } from '@/stores/studentStore';
import { useModuleLock } from '@/composables/useModuleLock';
import ModuleLockOverlay from '@/features/onboarding/ModuleLockOverlay.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue';

const store = usePaymentsStore();
const studentStore = useStudentStore();
const route = useRoute();
const { paymentsLocked, requiresSetup, requiresKyc, requiresSettlement, loading: lockLoading } = useModuleLock();

/** Student context preserved from Student Detail (?student=<id>). */
const scopedStudentId = computed(() =>
  typeof route.query.student === 'string' && route.query.student ? route.query.student : '',
);

const accounts = computed(() => {
  if (!scopedStudentId.value) return store.dvAccounts;
  return store.dvAccounts.filter((a: any) => {
    const sid = a.student_id ?? a.studentId ?? a.students?.id ?? '';
    return sid === scopedStudentId.value;
  });
});
const loading = computed(() => store.loading);
const error = computed(() => store.error);
const students = computed(() => studentStore.students);

const selectedStudentId = ref('');
const provisioning = ref(false);

const studentOptions = computed(() =>
  students.value.map((student) => ({
    value: student.id,
    label: `${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}`.trim() || student.id,
  })),
);

function statusChip(status: string) {
  switch (status) {
    case 'ACTIVE': return { status: 'success' as const, label: 'Active' };
    case 'PENDING':
    case 'PROVISIONING': return { status: 'pending' as const, label: status };
    case 'FAILED': return { status: 'error' as const, label: 'Failed' };
    case 'DISABLED': return { status: 'warning' as const, label: 'Disabled' };
    default: return { status: 'neutral' as const, label: status };
  }
}

async function provision() {
  if (!selectedStudentId.value) return;
  provisioning.value = true;
  try {
    await store.provisionDVA(selectedStudentId.value);
  } catch {
    // Error surfaced via store.error.
  } finally {
    provisioning.value = false;
  }
}

onMounted(() => {
  store.loadDVAccounts();
  studentStore.loadStudents();
  if (scopedStudentId.value) selectedStudentId.value = scopedStudentId.value;
});

watch(scopedStudentId, (id) => {
  if (id) selectedStudentId.value = id;
});
</script>

<template>
  <div class="p-6">
    <ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
    <ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
    <ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
    <ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
    <template v-else>
      <div class="mb-6">
        <h1 class="text-headline">Virtual Accounts</h1>
        <p class="text-slate-500">Student dedicated virtual accounts (DVA), provisioned by CAPFLUX.</p>
        <p v-if="scopedStudentId" class="mt-1 text-sm text-slate-500">
          Filtered to this student — <RouterLink class="font-medium text-brand hover:underline" :to="{ name: 'StudentDetail', params: { id: scopedStudentId } }">back to student</RouterLink>
        </p>
      </div>

      <ErrorState
        v-if="error"
        title="Unable to load virtual accounts"
        :description="error"
        @retry="store.loadDVAccounts()"
      />

      <div v-if="loading && accounts.length === 0" class="space-y-6">
        <SkeletonLoader type="table" :count="5" />
      </div>

      <template v-else>
        <div class="rounded-card bg-card shadow-card p-6 mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-title">Provision a new DVA</h2>
            <p class="text-sm text-slate-500 mt-1">Select a student to provision a dedicated virtual account.</p>
            <CmSelect
              v-model="selectedStudentId"
              :options="studentOptions"
              placeholder="Select student"
              class="mt-3 max-w-sm"
            />
          </div>
          <CmButton
            variant="primary"
            :disabled="!selectedStudentId || provisioning"
            @click="provision"
          >
            {{ provisioning ? 'Provisioning...' : 'Provision DVA' }}
          </CmButton>
        </div>

        <CmAlert v-if="error" variant="danger">{{ error }}</CmAlert>

        <div class="rounded-card bg-card shadow-card overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-divider text-text-muted">
                <th class="py-3 px-6">Student</th>
                <th class="py-3 px-6">Account</th>
                <th class="py-3 px-6">Bank</th>
                <th class="py-3 px-6">Status</th>
                <th class="py-3 px-6">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in accounts" :key="a.id" class="border-b border-divider">
                <td class="py-3 px-6">{{ a.students?.first_name }} {{ a.students?.last_name }}</td>
                <td class="py-3 px-6">
                  <span v-if="a.virtual_account_number_last4" class="font-mono text-xs">
                    •••• {{ a.virtual_account_number_last4 }}
                  </span>
                  <span v-else class="text-text-muted text-xs">—</span>
                </td>
                <td class="py-3 px-6">{{ a.bank_name || '-' }}</td>
                <td class="py-3 px-6">
                  <CmStatusChip v-bind="statusChip(a.status)" size="sm" />
                </td>
                <td class="py-3 px-6">
                  <CmButton
                    v-if="a.status === 'ACTIVE'"
                    variant="secondary"
                    size="sm"
                    @click="store.deactivateDVA(a.id)"
                  >
                    Disable
                  </CmButton>
                </td>
              </tr>
              <tr v-if="accounts.length === 0">
                <td colspan="5" class="py-8 text-center text-text-muted">
                  No virtual accounts yet. Provision DVAs above.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>
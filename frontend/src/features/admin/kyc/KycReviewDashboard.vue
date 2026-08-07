<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStaffFinancialStore } from '@/stores/staffFinancialStore';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmBadge from '@/components/ui/CmBadge.vue';

const router = useRouter();
const store = useStaffFinancialStore();

const kycList = computed(() => store.kycList as any[]);
const loading = computed(() => store.loading);
const error = computed(() => store.error);

function badgeVariant(status: string) {
  if (status === 'VERIFIED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'UNDER_REVIEW') return 'info';
  return 'muted';
}

function openDetail(id: string) {
  router.push({ name: 'StaffKycDetail', params: { id } });
}

onMounted(() => {
  store.loadKycList();
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-semibold">KYC Review</h1>
          <p class="text-text-muted mt-1">CAPFLUX staff review queue</p>
        </div>
        <CmButton variant="secondary" @click="store.loadKycList()">Refresh</CmButton>
      </div>

      <CmAlert v-if="error" variant="danger">{{ error }}</CmAlert>

      <section class="rounded-card bg-card p-6 shadow-card overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-divider text-text-muted">
              <th class="py-3">School</th>
              <th class="py-3">Principal</th>
              <th class="py-3">Status</th>
              <th class="py-3">Submitted</th>
              <th class="py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="k in kycList" :key="k.id" class="border-b border-divider">
              <td class="py-3">{{ k.schools?.name || k.school_id }}</td>
              <td class="py-3">{{ k.principal_name }}</td>
              <td class="py-3">
                <CmBadge :variant="badgeVariant(k.status)" :label="k.status" size="sm" />
              </td>
              <td class="py-3 text-text-muted">{{ k.submitted_at ? new Date(k.submitted_at).toLocaleDateString() : '-' }}</td>
              <td class="py-3">
                <CmButton variant="secondary" size="sm" @click="openDetail(k.id)">Review</CmButton>
              </td>
            </tr>
            <tr v-if="kycList.length === 0 && !loading">
              <td colspan="5" class="py-8 text-center text-text-muted">No KYC records in the queue.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>

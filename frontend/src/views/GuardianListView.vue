<template>
  <div class="flex min-h-[calc(100vh-56px)] flex-col bg-background">
    <!-- Header -->
    <div class="border-b border-divider bg-card px-6 py-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">Guardians</h1>
          <p class="mt-1 text-sm text-text-secondary">
            Manage guardians and their student relationships.
          </p>
        </div>
        <CmButton variant="primary" size="sm" @click="showAdd = true">
          <span class="flex items-center gap-1.5"><UserPlus class="size-4" /> Add guardian</span>
        </CmButton>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="space-y-4 p-6">
        <!-- Error -->
        <CmAlert
          v-if="guardianStore.error"
          variant="danger"
          title="Error loading guardians"
          :description="guardianStore.error"
          :dismissible="true"
          @dismiss="guardianStore.error = null"
        />

        <!-- Loading -->
        <div v-if="guardianStore.loading && guardians.length === 0" class="flex justify-center py-12">
          <CmLoading text="Loading guardians..." />
        </div>

        <template v-else>
          <!-- Stats -->
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <MetricCard label="Total Guardians" :value="guardianStats.total" />
            <MetricCard label="Multiple Students" :value="guardianStats.multiStudent" />
            <MetricCard label="With Email" :value="guardianStats.withEmail" />
            <MetricCard label="Linked Students" :value="guardianStats.linkedStudents" />
          </div>

          <!-- Search -->
          <CmInput
            v-model="search"
            label=""
            placeholder="Search guardians by name, phone or email..."
          />

          <!-- Empty state -->
          <div v-if="filtered.length === 0" class="rounded-card border border-divider bg-card px-6 py-12 text-center">
            <p class="text-sm font-medium text-text-primary">No guardians found</p>
            <p class="mt-1 text-sm text-text-muted">
              Guardians are created when you register a student, or via Import students.
            </p>
          </div>

          <!-- List (table on desktop, cards on mobile) -->
          <div v-else class="overflow-x-auto rounded-card border border-divider bg-card">
            <table class="min-w-full divide-y divide-divider">
              <thead class="bg-surface/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Guardian</th>
                  <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary sm:table-cell">Phone</th>
                  <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary md:table-cell">Email</th>
                  <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">Students</th>
                  <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary lg:table-cell">Status</th>
                  <th class="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody class="divide-y divide-divider/50">
                <tr
                  v-for="g in paginated"
                  :key="g.id"
                  class="cursor-pointer transition-colors hover:bg-surface/40"
                  @click="goToGuardianDetail(g.id)"
                >
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-text-primary">{{ g.full_name || '—' }}</p>
                    <p class="text-xs text-text-muted sm:hidden">{{ g.primary_phone }}</p>
                  </td>
                  <td class="hidden px-4 py-3 text-sm text-text-secondary sm:table-cell">{{ g.primary_phone }}</td>
                  <td class="hidden px-4 py-3 text-sm text-text-secondary md:table-cell">{{ g.email || '—' }}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
                      {{ studentCounts[g.id] ?? 0 }}
                    </span>
                  </td>
                  <td class="hidden px-4 py-3 lg:table-cell">
                    <span
                      class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      :class="(studentCounts[g.id] ?? 0) > 0 ? 'bg-success/10 text-success' : 'bg-surface text-text-muted'"
                    >
                      {{ (studentCounts[g.id] ?? 0) > 0 ? 'Linked' : 'No students' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <CmButton variant="link" size="sm" @click.stop="goToGuardianDetail(g.id)">View</CmButton>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination footer -->
            <div
              v-if="totalPages > 1"
              class="flex items-center justify-between border-t border-divider px-4 py-3 text-xs text-text-muted"
            >
              <span>Page {{ currentPage }} of {{ totalPages }}</span>
              <div class="flex gap-2">
                <CmButton variant="secondary" size="sm" :disabled="currentPage <= 1" @click="currentPage--">
                  Previous
                </CmButton>
                <CmButton variant="secondary" size="sm" :disabled="currentPage >= totalPages" @click="currentPage++">
                  Next
                </CmButton>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Add guardian -->
    <CmModal v-model="showAdd" title="Add guardian" size="md">
      <form class="space-y-4" @submit.prevent="submitAdd">
        <CmInput v-model="addForm.full_name" label="Full name" required placeholder="e.g. John Doe" />
        <CmInput v-model="addForm.primary_phone" label="Phone" required placeholder="e.g. 0803 000 0000" />
        <CmInput v-model="addForm.email" type="email" label="Email" placeholder="optional" />
        <CmSelect v-model="addForm.relationship" label="Default relationship" :options="relationshipOptions" />
        <p class="text-xs text-text-muted">
          New guardians are saved offline first and synced automatically. Link them to students
          from each student's Guardians tab.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <CmButton type="button" variant="secondary" @click="showAdd = false">Cancel</CmButton>
          <CmButton
            type="submit"
            variant="primary"
            :disabled="addSaving || !addForm.full_name.trim() || !addForm.primary_phone.trim()"
          >
            {{ addSaving ? 'Saving…' : 'Save guardian' }}
          </CmButton>
        </div>
      </form>
    </CmModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { UserPlus } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmLoading from '@/components/ui/CmLoading.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import { useGuardianStore } from '@/stores/guardianStore';
import { GUARDIAN_RELATIONSHIP_OPTIONS, type GuardianRelationship } from '@/shared/guardians/relationshipTypes';

const PAGE_SIZE = 20;

const router = useRouter();
const guardianStore = useGuardianStore();

const search = ref('');
const currentPage = ref(1);

// ── Add guardian ────────────────────────────────────────────────────
const showAdd = ref(false);
const addSaving = ref(false);
const addForm = ref({
  full_name: '',
  primary_phone: '',
  email: '',
  relationship: 'GUARDIAN' as GuardianRelationship,
});
const relationshipOptions = GUARDIAN_RELATIONSHIP_OPTIONS;

async function submitAdd() {
  if (!addForm.value.full_name.trim() || !addForm.value.primary_phone.trim()) return;
  addSaving.value = true;
  try {
    const created = await guardianStore.createGuardian({
      full_name: addForm.value.full_name.trim(),
      primary_phone: addForm.value.primary_phone.trim(),
      email: addForm.value.email.trim() || undefined,
      relationship: addForm.value.relationship,
    });
    if (created) {
      showAdd.value = false;
      addForm.value = { full_name: '', primary_phone: '', email: '', relationship: 'GUARDIAN' };
      studentCounts.value = await guardianStore.refreshStudentCounts();
    }
  } finally {
    addSaving.value = false;
  }
}

// ── Registry list ───────────────────────────────────────────────────
const guardians = computed(() => guardianStore.guardians);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return guardians.value;
  return guardians.value.filter(
    (g) =>
      (g.full_name ?? '').toLowerCase().includes(q) ||
      (g.primary_phone ?? '').includes(q) ||
      (g.email ?? '').toLowerCase().includes(q)
  );
});

const totalPages = computed(() => Math.ceil(filtered.value.length / PAGE_SIZE) || 1);
const paginated = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filtered.value.slice(start, start + PAGE_SIZE);
});

/** Linked-student counts — one indexed scan over student_guardians. */
const studentCounts = ref<Record<string, number>>({});

const guardianStats = computed(() => ({
  total: guardians.value.length,
  multiStudent: Object.values(studentCounts.value).filter((c) => c > 1).length,
  withEmail: guardians.value.filter((g) => g.email).length,
  linkedStudents: Object.values(studentCounts.value).reduce((a, b) => a + b, 0),
}));

function goToGuardianDetail(guardianId: string) {
  router.push({ name: 'GuardianDetail', params: { id: guardianId } });
}

onMounted(async () => {
  await guardianStore.initialize();
  studentCounts.value = await guardianStore.refreshStudentCounts();
});
</script>

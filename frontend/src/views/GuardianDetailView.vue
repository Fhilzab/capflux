<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import { useGuardianStore, type GuardianRow } from '@/stores/guardianStore';
import { guardianRelationshipLabel } from '@/shared/guardians/relationshipTypes';
import { db } from '@/offline/localDb';

const route = useRoute();
const router = useRouter();
const guardianStore = useGuardianStore();

const loadState = ref<'loading' | 'ready' | 'error'>('loading');
const guardian = ref<GuardianRow | null>(null);

interface DetailRow {
  link: {
    id: string;
    student_id: string;
    relationship: string;
    is_primary: boolean;
    created_at: string;
  };
  student: any | null;
}
const rows = ref<DetailRow[]>([]);

async function load() {
  loadState.value = 'loading';
  try {
    await guardianStore.initialize();
    const id = route.params.id as string;
    guardian.value = ((await db.guardians.get(id)) as GuardianRow | undefined) ?? null;
    if (!guardian.value) {
      loadState.value = 'error';
      return;
    }
    rows.value = await guardianStore.loadGuardianDetail(id);
    loadState.value = 'ready';
  } catch {
    loadState.value = 'error';
  }
}
onMounted(load);

const primaryRows = computed(() => rows.value.filter((r) => r.link.is_primary));
const additionalRows = computed(() => rows.value.filter((r) => !r.link.is_primary));

function goToStudent(studentId: string) {
  router.push({ name: 'StudentDetail', params: { id: studentId } });
}

function backToRegistry() {
  router.push({ name: 'Guardians' });
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-56px)] flex-col bg-background">
    <!-- Header -->
    <div class="border-b border-divider bg-card px-6 py-4">
      <div class="mx-auto max-w-5xl">
        <CmButton variant="link" size="sm" @click="backToRegistry">
          <span class="flex items-center gap-1.5"><ArrowLeft class="size-4" /> Back to guardians</span>
        </CmButton>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-5xl space-y-6 p-6">
        <CmAlert
          v-if="loadState === 'error'"
          variant="danger"
          title="Unable to load guardian"
          description="The guardian record could not be found locally."
          :dismissible="false"
        />

        <div v-if="loadState === 'loading'" class="flex justify-center py-12 text-sm text-text-muted">
          Loading guardian…
        </div>

        <template v-else-if="guardian">
          <!-- Identity + contact -->
          <section class="rounded-card bg-card p-6 shadow-card sm:p-8">
            <h1 class="text-2xl font-semibold text-text-primary">{{ guardian.full_name }}</h1>
            <p class="mt-1 text-sm text-text-secondary">Guardian</p>
            <div class="mt-4 grid gap-3 rounded-card border border-divider bg-background p-4 sm:grid-cols-2">
              <div>
                <p class="text-xs uppercase tracking-wider text-text-muted">Primary phone</p>
                <p class="mt-1 text-sm text-text-primary">{{ guardian.primary_phone }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wider text-text-muted">Alternative phone</p>
                <p class="mt-1 text-sm text-text-primary">{{ guardian.secondary_phone || '—' }}</p>
              </div>
              <div class="sm:col-span-2">
                <p class="text-xs uppercase tracking-wider text-text-muted">Email</p>
                <p class="mt-1 text-sm text-text-primary">{{ guardian.email || '—' }}</p>
              </div>
            </div>
          </section>

          <!-- Students -->
          <section class="rounded-card bg-card p-6 shadow-card sm:p-8">
            <h2 class="text-lg font-semibold text-text-primary">
              Students ({{ rows.length }})
            </h2>
            <p class="mt-1 text-sm text-text-muted">
              Each row shows this guardian's relationship to that student.
            </p>

            <div v-if="rows.length > 0" class="mt-4 space-y-2">
              <p
                v-if="primaryRows.length > 0"
                class="text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Primary contact for
              </p>
              <button
                v-for="r in primaryRows"
                :key="`p-${r.link.id}`"
                type="button"
                class="flex w-full items-center justify-between rounded-card border border-divider bg-background px-4 py-3 text-left hover:bg-surface/50"
                @click="goToStudent(r.link.student_id)"
              >
                <span>
                  <span class="block text-sm font-medium text-text-primary">
                    {{ r.student ? `${r.student.first_name} ${r.student.last_name}` : r.link.student_id }}
                  </span>
                  <span class="block text-xs text-text-muted">
                    {{ r.student?.class_name || '' }}
                    {{ guardianRelationshipLabel(r.link.relationship) }}
                  </span>
                </span>
                <CmStatusChip :status="r.student?.status ?? 'ACTIVE'" />
              </button>

              <template v-if="additionalRows.length > 0">
                <p class="pt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Additional relationships
                </p>
                <button
                  v-for="r in additionalRows"
                  :key="`a-${r.link.id}`"
                  type="button"
                  class="flex w-full items-center justify-between rounded-card border border-divider bg-background px-4 py-3 text-left hover:bg-surface/50"
                  @click="goToStudent(r.link.student_id)"
                >
                  <span>
                    <span class="block text-sm font-medium text-text-primary">
                      {{ r.student ? `${r.student.first_name} ${r.student.last_name}` : r.link.student_id }}
                    </span>
                    <span class="block text-xs text-text-muted">
                      {{ r.student?.class_name || '' }}
                      {{ guardianRelationshipLabel(r.link.relationship) }}
                    </span>
                  </span>
                  <CmStatusChip :status="r.student?.status ?? 'ACTIVE'" />
                </button>
              </template>
            </div>

            <p v-else class="mt-4 rounded-card border border-divider bg-background px-4 py-8 text-center text-sm text-text-muted">
              No student relationships yet. Link this guardian from a student's Guardians tab.
            </p>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

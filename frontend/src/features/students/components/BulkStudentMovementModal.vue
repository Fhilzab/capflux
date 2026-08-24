<template>
  <CmModal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="mode === 'PROMOTION' ? 'Promote students' : 'Move students'"
    size="lg"
  >
    <div class="space-y-5">
      <!-- From / To panels -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-card border border-divider bg-background p-4">
          <p class="text-xs font-medium uppercase tracking-wider text-text-muted">From</p>
          <p class="mt-2 text-sm font-semibold text-text-primary">{{ fromSessionName }}</p>
          <p class="text-sm text-text-secondary">{{ fromSectionName }} · {{ fromLevelName }}</p>
        </div>
        <div class="rounded-card border border-divider bg-background p-4">
          <p class="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">To</p>
          <CmSelect v-model="targetSessionId" label="Session" :options="sessionOptions" class="mb-3" />
          <CmSelect v-model="targetSectionId" label="Section" :options="sectionOptions" class="mb-3" />
          <CmSelect v-model="targetLevelId" label="Academic level" :options="levelOptions" />
        </div>
      </div>

      <!-- Affected students -->
      <div v-if="plan" class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-text-primary">
            {{ selectedCount }} student{{ selectedCount === 1 ? '' : 's' }} will be
            {{ mode === 'PROMOTION' ? 'promoted' : 'moved' }}
          </p>
          <span class="text-xs text-text-muted">{{ plan.eligible.length }} eligible</span>
        </div>

        <ul
          v-if="plan.skipped.length > 0"
          class="max-h-40 space-y-1 overflow-y-auto rounded-card bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <li v-for="s in plan.skipped" :key="s.studentId">
            {{ s.name || s.studentId }} — {{ s.reason }}
          </li>
        </ul>

        <details v-if="plan.eligible.length > 0" class="rounded-card border border-divider bg-background px-3 py-2">
          <summary class="cursor-pointer text-xs font-medium text-text-secondary">
            Review students ({{ plan.eligible.length }})
          </summary>
          <ul class="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-text-secondary">
            <li v-for="s in plan.eligible" :key="s.studentId">{{ s.name || s.studentId }}</li>
          </ul>
          <label class="mt-2 flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" v-model="excludeMode" class="rounded border-border" />
            Exclude individual students before applying
          </label>
          <div v-if="excludeMode" class="mt-2 space-y-1">
            <label
              v-for="s in plan.eligible"
              :key="`ex-${s.studentId}`"
              class="flex items-center gap-2 text-xs text-text-secondary"
            >
              <input type="checkbox" :value="s.studentId" v-model="excludedIds" class="rounded border-border" />
              {{ s.name || s.studentId }}
            </label>
          </div>
        </details>
      </div>

      <!-- Warnings -->
      <div class="rounded-card bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning">
        «This changes the students' current academic placement. Previous enrollment and financial
        history will not be modified.» Historical charges, payments and receipts remain untouched.
      </div>

      <p v-if="applyError" class="rounded-card bg-danger/10 px-3 py-2 text-xs text-danger">{{ applyError }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <CmButton variant="secondary" @click="close">Cancel</CmButton>
        <CmButton :disabled="!canApply || applying" :loading="applying" @click="apply">
          Confirm {{ mode === 'PROMOTION' ? 'promotion' : 'movement' }}
        </CmButton>
      </div>
    </div>
  </CmModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import { useEnrollmentStore } from '@/stores/enrollmentStore';
import { useAcademicStore } from '@/stores/academicStore';
import { EnrollmentService } from '@/shared/enrollment/EnrollmentService';
import { db } from '@/offline/localDb';
import type { SchoolDivisionRow, AcademicLevelRow } from '@/offline/localDb';

const props = defineProps<{
  modelValue: boolean;
  mode: 'MOVEMENT' | 'PROMOTION';
  fromLevelId: string;
  sections: SchoolDivisionRow[];
  /** Optional register-selection scope: only these students are planned/applied. */
  selectedStudentIds?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'applied', result: { moved: number; failed: number }): void;
}>();

const enrollmentStore = useEnrollmentStore();
const academicStore = useAcademicStore();

const targetSessionId = ref('');
const targetSectionId = ref('');
const targetLevelId = ref('');
const applying = ref(false);
const applyError = ref('');
const excludeMode = ref(false);
const excludedIds = ref<string[]>([]);

const fromSessionName = ref('—');
const fromSectionName = ref('—');
const fromLevelName = ref('—');

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    applyError.value = '';
    excludedIds.value = [];
    excludeMode.value = false;

    // Resolve source placement context from any enrollment at this level.
    const sample = await db.student_enrollments.where('level_id').equals(props.fromLevelId).first();
    fromLevelName.value = (await db.academic_levels.get(props.fromLevelId))?.name ?? '—';

    if (sample) {
      targetSessionId.value = sample.academic_session_id;
      const session = await db.academic_sessions.get(sample.academic_session_id);
      fromSessionName.value = session?.name ?? '—';
    }

    const fromLevel = await db.academic_levels.get(props.fromLevelId);
    if (fromLevel) {
      targetSectionId.value = fromLevel.section_id;
      const section = await db.school_divisions.get(fromLevel.section_id);
      fromSectionName.value = section?.name ?? '—';

      // Promotion pre-fills the next level by explicit display order.
      if (props.mode === 'PROMOTION') {
        const result = await EnrollmentService.getNextLevelInSection(fromLevel.section_id, props.fromLevelId);
        if (result.ok) {
          targetLevelId.value = result.data.id;
        }
        else {
          applyError.value = result.error.message;
        }
      } else {
        targetLevelId.value = '';
      }
    }

    await recomputePlan();
  }
);

// Recompute the eligibility plan whenever the destination changes.
watch([targetSessionId, targetSectionId, targetLevelId], () => {
  if (props.modelValue) void recomputePlan();
});

const sessionOptions = computed(() =>
  [...academicStore.sessions]
    .sort((a, b) => Number(b.is_current) - Number(a.is_current))
    .map((s) => ({ value: s.id, label: s.name }))
);

const sectionOptions = computed(() =>
  [...props.sections]
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => ({ value: s.id, label: s.name }))
);

const levelOptions = computed(() =>
  (academicStore.levelsBySection[targetSectionId.value] ?? [])
    .filter((l) => l.status === 'ACTIVE')
    .map((l) => ({ value: l.id, label: l.name }))
);

watch(targetSectionId, () => {
  if (!levelOptions.value.some((o) => o.value === targetLevelId.value)) {
    targetLevelId.value = '';
  }
});

const plan = computed(() => enrollmentStore.lastPlan);

const selectedCount = computed(() =>
  Math.max(0, (plan.value?.eligible.length ?? 0) - (excludeMode.value ? excludedIds.value.length : 0))
);

const canApply = computed(
  () => Boolean(targetSessionId.value && targetSectionId.value && targetLevelId.value && selectedCount.value > 0)
);

function close() {
  emit('update:modelValue', false);
}

async function recomputePlan() {
  if (!props.fromLevelId || !targetLevelId.value) return;
  await enrollmentStore.planBulkMove(
    props.fromLevelId,
    {
      sessionId: targetSessionId.value,
      sectionId: targetSectionId.value,
      levelId: targetLevelId.value,
    },
    props.selectedStudentIds
  );
}

async function apply() {
  applying.value = true;
  applyError.value = '';
  try {
    const ids = (plan.value?.eligible ?? [])
      .filter((s) => !excludeMode.value || !excludedIds.value.includes(s.studentId))
      .map((s) => s.studentId);
    if (ids.length === 0) {
      applyError.value = 'No students selected.';
      return;
    }
    const result = await enrollmentStore.applyMove(
      ids,
      {
        sessionId: targetSessionId.value,
        sectionId: targetSectionId.value,
        levelId: targetLevelId.value,
      },
      props.mode
    );
    close();
    emit('applied', { moved: result.moved.length, failed: result.failed.length });
  } catch (e: any) {
    applyError.value = e?.message ?? 'Failed to apply movement';
  } finally {
    applying.value = false;
  }
}
</script>

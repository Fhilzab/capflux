<template>
  <CmModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" title="Change academic placement" size="md">
    <div class="space-y-5">
      <!-- Current placement -->
      <div class="rounded-card border border-divider bg-background p-4">
        <p class="text-xs font-medium uppercase tracking-wider text-text-muted">Current placement</p>
        <p class="mt-2 text-sm font-semibold text-text-primary">
          {{ current?.session?.name ?? 'No session' }}
        </p>
        <p class="text-sm text-text-secondary">
          {{ current?.section?.name ?? '—' }} · {{ current?.level?.name ?? '—' }}
        </p>
      </div>

      <!-- New placement -->
      <div class="space-y-3">
        <p class="text-xs font-medium uppercase tracking-wider text-text-muted">New placement</p>
        <CmSelect v-model="targetSessionId" label="Session" :options="sessionOptions" />
        <CmSelect v-model="targetSectionId" label="Section" :options="sectionOptions" />
        <CmSelect v-model="targetLevelId" label="Academic level" :options="levelOptions" />
      </div>

      <div class="rounded-card bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning">
        «This changes the student's current academic placement. Previous enrollment and financial
        history will not be modified.»
      </div>

      <p v-if="errorMessage" class="rounded-card bg-danger/10 px-3 py-2 text-xs text-danger">{{ errorMessage }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <CmButton variant="secondary" @click="close">Cancel</CmButton>
        <CmButton
          :disabled="!canApply || applying"
          :loading="applying"
          @click="applyMove"
        >
          Confirm placement change
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
import { useEnrollmentStore, type HydratedEnrollment } from '@/stores/enrollmentStore';
import { useAcademicStore } from '@/stores/academicStore';
import type { SchoolDivisionRow } from '@/offline/localDb';

const props = defineProps<{
  modelValue: boolean;
  studentId: string;
  current: HydratedEnrollment | null;
  sections: SchoolDivisionRow[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'moved'): void;
}>();

const enrollmentStore = useEnrollmentStore();
const academicStore = useAcademicStore();

const targetSessionId = ref('');
const targetSectionId = ref('');
const targetLevelId = ref('');
const applying = ref(false);
const errorMessage = ref('');

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      errorMessage.value = '';
      targetSessionId.value =
        props.current?.enrollment.academic_session_id ?? academicStore.currentSession?.id ?? '';
      targetSectionId.value = props.current?.enrollment.section_id ?? '';
      targetLevelId.value = props.current?.enrollment.level_id ?? '';
    }
  }
);

const sessionOptions = computed(() =>
  [...academicStore.sessions]
    .sort((a, b) => Number(b.is_current) - Number(a.is_current))
    .map((s) => ({ value: s.id, label: s.name }))
);

const sectionOptions = computed(() =>
  props.sections
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => ({ value: s.id, label: s.name }))
);

const levelOptions = computed(() =>
  academicStore.levelsBySection[targetSectionId.value]?.filter((l) => l.status === 'ACTIVE') ?? []
).map((l) => ({ value: l.id, label: l.name }));

watch(targetSectionId, () => {
  if (!levelOptions.value.some((o) => o.value === targetLevelId.value)) {
    targetLevelId.value = '';
  }
});

const canApply = computed(
  () => Boolean(targetSessionId.value && targetSectionId.value && targetLevelId.value)
);

function close() {
  emit('update:modelValue', false);
}

async function applyMove() {
  applying.value = true;
  errorMessage.value = '';
  try {
    const ok = await enrollmentStore.moveStudent(props.studentId, {
      sessionId: targetSessionId.value,
      sectionId: targetSectionId.value,
      levelId: targetLevelId.value,
    }, 'MOVEMENT');
    if (!ok) {
      errorMessage.value = enrollmentStore.error ?? 'Failed to move student';
      return;
    }
    close();
    emit('moved');
  } finally {
    applying.value = false;
  }
}
</script>

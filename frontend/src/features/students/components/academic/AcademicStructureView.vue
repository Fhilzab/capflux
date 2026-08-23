<template>
  <div class="flex min-h-[calc(100vh-56px)] flex-col bg-background">
    <div class="border-b border-divider bg-card px-6 py-4">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Academic Structure</h1>
        <p class="mt-1 text-sm text-text-secondary">
          Configure sessions, sections and academic levels. Levels drive placement, movement and
          promotion.
        </p>
      </div>
    </div>
    <StudentsAreaNav />

    <div class="flex-1 overflow-y-auto">
      <div class="p-6 space-y-6">
        <CmAlert
          v-if="academic.error"
          variant="danger"
          title="Academic structure error"
          :description="academic.error"
          :dismissible="true"
          @dismiss="academic.error = null"
        />

        <!-- Sessions -->
        <section class="rounded-card border border-divider bg-card">
          <header
            class="flex items-center justify-between px-4 py-3 border-b border-divider cursor-pointer select-none"
            @click="sessionsOpen = !sessionsOpen"
          >
            <h2 class="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <CalendarRange class="h-4 w-4 text-brand" />
              Academic Sessions
              <span class="text-xs font-normal text-text-muted">({{ academic.sessions.length }})</span>
            </h2>
            <CmButton v-if="sessionsOpen" variant="secondary" size="sm" @click.stop="showSessionForm = true">
              <Plus class="mr-1 h-3.5 w-3.5" />
              New session
            </CmButton>
          </header>

          <div v-if="sessionsOpen" class="divide-y divide-divider">
            <p v-if="academic.sessions.length === 0 && !academic.loading" class="px-4 py-6 text-sm text-text-muted">
              No academic sessions yet. Create one to start enrolling students.
            </p>
            <div
              v-for="session in sortedSessions"
              :key="session.id"
              class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-text-primary">{{ session.name }}</span>
                  <CmStatusChip :status="session.is_current ? 'ACTIVE' : 'INACTIVE'" />
                </div>
                <p class="mt-0.5 text-xs text-text-muted">
                  {{ session.start_date || '—' }} → {{ session.end_date || '—' }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="text-xs font-medium"
                  :class="session.status === 'ACTIVE' ? 'text-success' : 'text-text-muted'"
                >{{ session.status }}</span>
                <CmButton
                  v-if="!session.is_current"
                  variant="secondary"
                  size="sm"
                  :loading="activatingId === session.id"
                  @click="confirmActivate(session)"
                >
                  Set current
                </CmButton>
              </div>
            </div>
          </div>
        </section>

        <!-- Sections -->
        <section class="rounded-card border border-divider bg-card">
          <header
            class="flex items-center justify-between px-4 py-3 border-b border-divider cursor-pointer select-none"
            @click="sectionsOpen = !sectionsOpen"
          >
            <h2 class="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <LayoutGrid class="h-4 w-4 text-brand" />
              Sections
              <span class="text-xs font-normal text-text-muted">({{ divisionStore.divisions.length }})</span>
            </h2>
            <CmButton v-if="sectionsOpen" variant="secondary" size="sm" @click.stop="showSectionForm = true">
              <Plus class="mr-1 h-3.5 w-3.5" />
              New section
            </CmButton>
          </header>

          <div v-if="sectionsOpen" class="divide-y divide-divider">
            <p v-if="divisionStore.divisions.length === 0 && !divisionStore.loading" class="px-4 py-6 text-sm text-text-muted">
              No sections yet (e.g. Nursery, Primary, Secondary).
            </p>
            <div
              v-for="section in sortedDivisions"
              :key="section.id"
              class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-center gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-text-primary">{{ section.name }}</span>
                    <code v-if="section.code" class="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">{{ section.code }}</code>
                  </div>
                  <p class="mt-0.5 text-xs text-text-muted">Order {{ section.displayOrder }}</p>
                </div>
              </div>
              <span
                class="text-xs font-medium"
                :class="section.status === 'ACTIVE' ? 'text-success' : 'text-danger'"
              >{{ section.status }}</span>
            </div>
          </div>
        </section>

        <!-- Levels -->
        <section class="rounded-card border border-divider bg-card">
          <header
            class="flex items-center justify-between px-4 py-3 border-b border-divider cursor-pointer select-none"
            @click="levelsOpen = !levelsOpen"
          >
            <h2 class="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <ListOrdered class="h-4 w-4 text-brand" />
              Academic Levels
              <span class="text-xs font-normal text-text-muted">({{ academic.levels.length }})</span>
            </h2>
            <CmButton
              v-if="levelsOpen"
              variant="secondary"
              size="sm"
              :disabled="divisionStore.divisions.length === 0"
              @click.stop="openLevelForm()"
            >
              <Plus class="mr-1 h-3.5 w-3.5" />
              New level
            </CmButton>
          </header>

          <div v-if="levelsOpen" class="px-4 py-3">
            <p
              v-if="divisionStore.divisions.length === 0"
              class="mb-3 rounded-card bg-warning/10 px-3 py-2 text-xs text-warning"
            >
              Create a section first — levels belong to sections.
            </p>
            <div v-for="section in sortedDivisions" :key="`lvl-${section.id}`" class="mb-5 last:mb-0">
              <div class="mb-2 flex items-center justify-between">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-text-secondary">{{ section.name }}</h3>
                <CmStatusChip :status="section.status" />
              </div>
              <div class="space-y-1">
                <p
                  v-if="(academic.levelsBySection[section.id] ?? []).length === 0"
                  class="py-1 text-sm text-text-muted"
                >
                  No levels configured for this section.
                </p>
                <div
                  v-for="(level, idx) in academic.levelsBySection[section.id] ?? []"
                  :key="level.id"
                  class="flex items-center justify-between rounded-button border border-divider bg-background px-3 py-2"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-6 shrink-0 text-center text-xs font-semibold text-text-muted">{{ idx + 1 }}</span>
                    <div class="min-w-0">
                      <span class="block truncate text-sm text-text-primary">{{ level.name }}</span>
                      <code v-if="level.code" class="text-[10px] uppercase tracking-wide text-text-muted">{{ level.code }}</code>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      class="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary disabled:opacity-30"
                      :disabled="idx === 0"
                      title="Move up"
                      @click="moveLevel(level, -1)"
                    >
                      <ArrowUp class="h-3.5 w-3.5" />
                    </button>
                    <button
                      class="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary disabled:opacity-30"
                      :disabled="idx === (academic.levelsBySection[section.id]?.length ?? 0) - 1"
                      title="Move down"
                      @click="moveLevel(level, 1)"
                    >
                      <ArrowDown class="h-3.5 w-3.5" />
                    </button>
                    <button
                      class="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary"
                      :title="level.status === 'ACTIVE' ? 'Deactivate' : 'Activate'"
                      @click="toggleLevel(level)"
                    >
                      <Power class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Session form modal -->
    <CmModal v-model="showSessionForm" title="New academic session" size="md">
      <form class="space-y-4" @submit.prevent="createSession">
        <CmInput v-model="sessionForm.name" label="Session name" placeholder="e.g. 2026/2027" required />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CmInput v-model="sessionForm.startDate" label="Start date" type="date" required />
          <CmInput v-model="sessionForm.endDate" label="End date" type="date" required />
        </div>
        <p class="text-xs text-text-muted">
          The session becomes ACTIVE when you set it as the current session.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <CmButton variant="secondary" @click="showSessionForm = false">Cancel</CmButton>
          <CmButton type="submit" :loading="saving">Create session</CmButton>
        </div>
      </form>
    </CmModal>

    <!-- Section form modal -->
    <CmModal v-model="showSectionForm" title="New section" size="md">
      <form class="space-y-4" @submit.prevent="createSection">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CmInput v-model="sectionForm.name" label="Section name" placeholder="e.g. Primary" required />
          <CmInput v-model="sectionForm.code" label="Code" placeholder="e.g. PRI" required />
        </div>
        <CmInput v-model.number="sectionForm.displayOrder" label="Display order" type="number" required />
        <div class="flex justify-end gap-2 pt-2">
          <CmButton variant="secondary" @click="showSectionForm = false">Cancel</CmButton>
          <CmButton type="submit" :loading="saving">Create section</CmButton>
        </div>
      </form>
    </CmModal>

    <!-- Level form modal -->
    <CmModal v-model="showLevelForm" title="New academic level" size="md">
      <form class="space-y-4" @submit.prevent="createLevel">
        <CmSelect
          v-model="levelForm.sectionId"
          label="Section"
          :options="divisionOptions"
          required
        />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CmInput v-model="levelForm.name" label="Level name" placeholder="e.g. Primary 1" required />
          <CmInput v-model="levelForm.code" label="Code (optional)" placeholder="e.g. P1" />
        </div>
        <CmInput v-model.number="levelForm.displayOrder" label="Display order (progression order)" type="number" required />
        <p class="text-xs text-text-muted">
          Display order defines promotion progression (Primary 1 → Primary 2 → ...). Lower numbers come first.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <CmButton variant="secondary" @click="showLevelForm = false">Cancel</CmButton>
          <CmButton type="submit" :loading="saving">Create level</CmButton>
        </div>
      </form>
    </CmModal>

    <!-- Activate-session confirmation -->
    <CmModal v-model="showActivateConfirm" title="Set current session" size="md">
      <div class="space-y-4">
        <p class="text-sm text-text-secondary">
          Make <span class="font-semibold text-text-primary">{{ pendingSession?.name }}</span> the
          current active session?
        </p>
        <p v-if="currentSessionName" class="rounded-card bg-warning/10 px-3 py-2 text-xs text-warning">
          «{{ currentSessionName }}» will be marked COMPLETED. Only one session can be current.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <CmButton variant="secondary" @click="showActivateConfirm = false">Cancel</CmButton>
          <CmButton :loading="saving" @click="activateSession">Set as current</CmButton>
        </div>
      </div>
    </CmModal>

    <CmToast
      v-if="toast"
      :variant="toast.variant"
      :title="toast.title"
      :description="toast.description"
      :duration="toast.duration"
      @close="toast = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  CalendarRange,
  LayoutGrid,
  ListOrdered,
  Plus,
  ArrowUp,
  ArrowDown,
  Power,
} from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import CmToast from '@/components/ui/CmToast.vue';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import StudentsAreaNav from '@/features/students/components/StudentsAreaNav.vue';
import { useAcademicStore } from '@/stores/academicStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useEnrollmentStore } from '@/stores/enrollmentStore';
import { useSchoolStore } from '@/stores/schoolStore';
import type { AcademicSessionRow, AcademicLevelRow } from '@/offline/localDb';

const academic = useAcademicStore();
const divisionStore = useDivisionStore();
const enrollmentStore = useEnrollmentStore();

const sessionsOpen = ref(true);
const sectionsOpen = ref(true);
const levelsOpen = ref(true);
const saving = ref(false);
const activatingId = ref<string | null>(null);

const showSessionForm = ref(false);
const showSectionForm = ref(false);
const showLevelForm = ref(false);
const showActivateConfirm = ref(false);

const pendingSession = ref<AcademicSessionRow | null>(null);

const sessionForm = ref({ name: '', startDate: '', endDate: '' });
const sectionForm = ref({ name: '', code: '', displayOrder: 1 });
const levelForm = ref({ sectionId: '', name: '', code: '', displayOrder: 1 });

const toast = ref<{
  variant: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  duration: number;
} | null>(null);

function showToast(variant: 'success' | 'warning' | 'danger' | 'info', title: string, description: string, duration = 4000) {
  toast.value = { variant, title, description, duration };
}

const sortedSessions = computed(() =>
  [...academic.sessions].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
);
const sortedDivisions = computed(() =>
  [...divisionStore.divisions].sort((a, b) => a.displayOrder - b.displayOrder)
);
const divisionOptions = computed(() =>
  sortedDivisions.value.map((d) => ({ value: d.id, label: d.name }))
);
const currentSessionName = computed(
  () => academic.currentSession?.name ?? null
);

onMounted(async () => {
  await Promise.all([academic.initialize(), divisionStore.initialize()]);
});

async function createSession() {
  saving.value = true;
  try {
    const ok = await academic.createSession(sessionForm.value);
    if (ok) {
      showSessionForm.value = false;
      sessionForm.value = { name: '', startDate: '', endDate: '' };
      showToast('success', 'Session created', 'The academic session was created.');
    } else {
      showToast('danger', 'Error', academic.error ?? 'Failed to create session');
    }
  } finally {
    saving.value = false;
  }
}

function confirmActivate(session: AcademicSessionRow) {
  pendingSession.value = listingDisplacedSession(session) ?? session;
  showActivateConfirm.value = true;
}

function listingDisplacedSession(session: AcademicSessionRow): AcademicSessionRow | null {
  const current = academic.currentSession;
  return current && current.id !== session.id ? session : null;
}

async function activateSession() {
  if (!pendingSession.value) return;
  saving.value = true;
  try {
    const ok = await academic.activateSession(pendingSession.value.id);
    showActivateConfirm.value = false;
    if (ok) showToast('success', 'Session activated', `${pendingSession.value.name} is now the current session.`);
    else showToast('danger', 'Error', academic.error ?? 'Failed to activate session');
  } finally {
    saving.value = false;
  }
}

async function createSection() {
  const schoolStore = useSchoolStore();
  const schoolId = schoolStore.currentSchoolId;
  if (!schoolId) {
    showToast('danger', 'Error', 'No school context available');
    return;
  }
  saving.value = true;
  try {
    const ok = await divisionStore.createDivision({
      schoolId,
      name: sectionForm.value.name,
      code: sectionForm.value.code.toUpperCase(),
      displayOrder: sectionForm.value.displayOrder,
    });
    if (ok) {
      showSectionForm.value = false;
      sectionForm.value = { name: '', code: '', displayOrder: sortedDivisions.value.length + 1 };
      showToast('success', 'Section created', 'The section was added to your academic structure.');
    } else {
      showToast('danger', 'Error', divisionStore.error ?? 'Failed to create section');
    }
  } finally {
    saving.value = false;
  }
}

async function createLevel() {
  saving.value = true;
  try {
    const ok = await academic.createLevel({
      sectionId: levelForm.value.sectionId,
      name: levelForm.value.name,
      code: levelForm.value.code,
      displayOrder: levelForm.value.displayOrder,
    });
    if (ok) {
      showLevelForm.value = false;
      showToast('success', 'Level created', 'The academic level was added.');
    } else {
      showToast('danger', 'Error', academic.error ?? 'Failed to create level');
    }
  } finally {
    saving.value = false;
  }
}

function openLevelForm() {
  levelForm.value.sectionId = divisionOptions.value[0]?.value ?? '';
  levelForm.value.displayOrder =
    Math.max(0, ...(academic.levels.map((l) => l.display_order) ?? [0])) + 1;
  showLevelForm.value = true;
}

/** Reorder within its section by swapping display_order with the neighbor. */
async function moveLevel(level: AcademicLevelRow, direction: -1 | 1) {
  const siblings = academic.levelsBySection[level.section_id] ?? [];
  const idx = siblings.findIndex((l) => l.id === level.id);
  const neighbor = siblings[idx + direction];
  if (!neighbor || idx === -1) return;

  const swapped = await swapOrders(level, neighbor);
  if (swapped) showToast('success', 'Order updated', 'Level progression order updated.');
}

async function swapOrders(a: AcademicLevelRow, b: AcademicLevelRow): Promise<boolean> {
  const aOrder = a.display_order;
  const bOrder = b.display_order;
  const okA = await academic.reorderLevel(a.id, bOrder);
  const okB = await academic.reorderLevel(b.id, aOrder);
  return okA && okB;
}

async function toggleLevel(level: AcademicLevelRow) {
  if (level.status === 'ACTIVE') {
    const count = await countActiveEnrollments(level.id);
    if (count > 0) {
      showToast(
        'warning',
        'Cannot deactivate',
        `${count} student${count === 1 ? '' : 's'} currently enrolled at this level. Move them first.`
      );
      return;
    }
    await academic.setLevelStatus(level.id, 'INACTIVE');
    showToast('info', 'Level deactivated', `«${level.name}» is now inactive.`);
  } else {
    await academic.setLevelStatus(level.id, 'ACTIVE');
    showToast('info', 'Level activated', `«${level.name}» is now active.`);
  }
}

async function countActiveEnrollments(levelId: string): Promise<number> {
  await enrollmentStore.planBulkMove(levelId, { sessionId: '', sectionId: '', levelId }, []);
  const plan = enrollmentStore.lastPlan;
  return plan?.eligible.length ?? 0;
}
</script>

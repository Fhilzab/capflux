<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { UserPlus, Link2, Star, Pencil, Trash2, RefreshCw } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmModal from '@/components/ui/CmModal.vue';
import CmAlert from '@/components/ui/CmAlert.vue';
import { useGuardianStore, type GuardianRow } from '@/stores/guardianStore';
import { useSchoolStore } from '@/stores/schoolStore';
import {
  GUARDIAN_RELATIONSHIP_OPTIONS,
  guardianRelationshipLabel,
  type GuardianRelationship,
} from '@/shared/guardians/relationshipTypes';

const props = defineProps<{ studentId: string }>();

const router = useRouter();
const guardianStore = useGuardianStore();
const schoolStore = useSchoolStore();

const loadState = ref<'loading' | 'ready' | 'error'>('loading');
const actionError = ref('');
const busy = ref(false);

interface HydratedLink {
  link: { id: string; guardian_id: string; relationship: GuardianRelationship; is_primary: boolean; created_at: string };
  guardian: GuardianRow | null;
}

const hydrated = ref<HydratedLink[]>([]);
const primary = computed(() => hydrated.value.find((h) => h.link.is_primary) ?? null);
const additional = computed(() => hydrated.value.filter((h) => !h.link.is_primary));

async function load() {
  loadState.value = 'loading';
  actionError.value = '';
  try {
    await guardianStore.initialize();
    await guardianStore.loadLinksForStudent(props.studentId);
    const links = guardianStore.linksByStudent[props.studentId] ?? [];
    const guardians = await Promise.all(links.map((l) => guardianStore.guardians.find((g) => g.id === l.guardian_id) ?? null));
    hydrated.value = links.map((link, i) => ({
      link: {
        id: link.id,
        guardian_id: link.guardian_id,
        relationship: link.relationship,
        is_primary: link.is_primary,
        created_at: link.created_at,
      },
      guardian: guardians[i],
    }));
    loadState.value = 'ready';
  } catch (e: any) {
    loadState.value = 'error';
  }
}
onMounted(load);

// ── Add new guardian ────────────────────────────────────────────────
const showAddNew = ref(false);
const addForm = ref({ full_name: '', primary_phone: '', email: '', relationship: 'GUARDIAN' as GuardianRelationship });
const addSaving = ref(false);

async function submitAddNew() {
  if (!addForm.value.full_name.trim() || !addForm.value.primary_phone.trim()) return;
  const schoolId = schoolStore.currentSchoolId;
  if (!schoolId) return;
  addSaving.value = true;
  actionError.value = '';
  try {
    const guardian = await guardianStore.createGuardian({
      full_name: addForm.value.full_name.trim(),
      primary_phone: addForm.value.primary_phone.trim(),
      email: addForm.value.email.trim() || undefined,
      relationship: addForm.value.relationship,
    });
    if (!guardian) throw new Error(guardianStore.error || 'Failed to create guardian');
    const linked = await guardianStore.linkGuardian({
      schoolId,
      studentId: props.studentId,
      guardianId: guardian.id,
      relationship: addForm.value.relationship,
    });
    if (!linked) throw new Error(guardianStore.error || 'Failed to link guardian');
    showAddNew.value = false;
    addForm.value = { full_name: '', primary_phone: '', email: '', relationship: 'GUARDIAN' };
    await load();
  } catch (e: any) {
    actionError.value = e?.message || 'Unable to add guardian.';
  } finally {
    addSaving.value = false;
  }
}

// ── Link existing guardian ──────────────────────────────────────────
const showLinkExisting = ref(false);
const linkQuery = ref('');
const linkResults = ref<GuardianRow[]>([]);
const linkRelationship = ref<GuardianRelationship>('GUARDIAN');
const linkSearching = ref(false);

async function searchLinkCandidates() {
  linkSearching.value = true;
  try {
    linkResults.value = await guardianStore.searchGuardians(linkQuery.value);
  } finally {
    linkSearching.value = false;
  }
}

async function openLinkExisting() {
  showLinkExisting.value = true;
  await searchLinkCandidates();
}

async function linkCandidate(guardianId: string) {
  const schoolId = schoolStore.currentSchoolId;
  if (!schoolId) return;
  busy.value = true;
  actionError.value = '';
  try {
    const ok = await guardianStore.linkGuardian({
      schoolId,
      studentId: props.studentId,
      guardianId,
      relationship: linkRelationship.value,
    });
    if (!ok) throw new Error(guardianStore.error || 'Failed to link guardian');
    showLinkExisting.value = false;
    await load();
  } catch (e: any) {
    actionError.value = e?.message || 'Unable to link guardian.';
  } finally {
    busy.value = false;
  }
}

// ── Change primary (with confirmation) ──────────────────────────────
const confirmPrimary = ref<HydratedLink | null>(null);
const showConfirmPrimary = computed({
  get: () => confirmPrimary.value !== null,
  set: (v: boolean) => { if (!v) confirmPrimary.value = null; },
});

async function makePrimary() {
  if (!confirmPrimary.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const ok = await guardianStore.setPrimaryGuardian(props.studentId, confirmPrimary.value.link.id);
    if (!ok) throw new Error(guardianStore.error || 'Failed to change primary guardian');
    confirmPrimary.value = null;
    await load();
  } catch (e: any) {
    actionError.value = e?.message || 'Unable to change primary guardian.';
  } finally {
    busy.value = false;
  }
}

// ── Edit guardian ───────────────────────────────────────────────────
const editTarget = ref<HydratedLink | null>(null);
const showEdit = computed({
  get: () => editTarget.value !== null,
  set: (v: boolean) => { if (!v) editTarget.value = null; },
});
const editForm = ref({ full_name: '', primary_phone: '', email: '', relationship: 'GUARDIAN' as GuardianRelationship });
const editSaving = ref(false);

function openEdit(h: HydratedLink) {
  if (!h.guardian) return;
  editTarget.value = h;
  editForm.value = {
    full_name: h.guardian.full_name ?? '',
    primary_phone: h.guardian.primary_phone ?? '',
    email: h.guardian.email ?? '',
    relationship: h.link.relationship,
  };
}

async function submitEdit() {
  if (!editTarget.value?.guardian) return;
  editSaving.value = true;
  actionError.value = '';
  try {
    const contactOk = await guardianStore.updateGuardian(editTarget.value.guardian.id, {
      full_name: editForm.value.full_name.trim(),
      primary_phone: editForm.value.primary_phone.trim(),
      email: editForm.value.email.trim() || null,
    });
    if (!contactOk) throw new Error(guardianStore.error || 'Failed to update guardian');
    const relOk = await guardianStore.updateRelationshipType(
      props.studentId,
      editTarget.value.link.id,
      editForm.value.relationship
    );
    if (!relOk) throw new Error(guardianStore.error || 'Failed to update relationship');
    editTarget.value = null;
    await load();
  } catch (e: any) {
    actionError.value = e?.message || 'Unable to update guardian.';
  } finally {
    editSaving.value = false;
  }
}

// ── Remove relationship (never deletes the guardian record) ─────────
const confirmRemove = ref<HydratedLink | null>(null);
const showConfirmRemove = computed({
  get: () => confirmRemove.value !== null,
  set: (v: boolean) => { if (!v) confirmRemove.value = null; },
});

async function removeRelationship() {
  if (!confirmRemove.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const ok = await guardianStore.unlinkGuardian(confirmRemove.value.link.id, props.studentId);
    if (!ok) throw new Error(guardianStore.error || 'Failed to remove guardian relationship');
    confirmRemove.value = null;
    await load();
  } catch (e: any) {
    actionError.value = e?.message || 'Unable to remove guardian relationship.';
  } finally {
    busy.value = false;
  }
}

// ── Navigation ──────────────────────────────────────────────────────
function goToGuardian(guardianId: string) {
  router.push({ name: 'GuardianDetail', params: { id: guardianId } });
}

function relOptions(exclude?: GuardianRelationship) {
  return GUARDIAN_RELATIONSHIP_OPTIONS.filter((o) => o.value !== exclude);
}
</script>

<template>
  <div>
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-lg font-semibold text-text-primary">Guardians</h2>
        <p class="mt-1 text-sm text-text-muted">
          People responsible for this student. Billing and notifications use the primary guardian.
        </p>
      </div>
      <div class="flex gap-2">
        <CmButton variant="secondary" size="sm" @click="openLinkExisting">
          <span class="flex items-center gap-1.5"><Link2 class="size-4" /> Link existing</span>
        </CmButton>
        <CmButton variant="primary" size="sm" @click="showAddNew = true">
          <span class="flex items-center gap-1.5"><UserPlus class="size-4" /> Add guardian</span>
        </CmButton>
      </div>
    </div>

    <CmAlert
      v-if="actionError"
      variant="danger"
      title="Action failed"
      :description="actionError"
      :dismissible="true"
      class="mt-4"
      @dismiss="actionError = ''"
    />

    <!-- Loading / error states keep the rest of Student Detail intact -->
    <div v-if="loadState === 'loading'" class="mt-6 py-8 text-center text-sm text-text-muted">
      Loading guardians…
    </div>
    <div v-else-if="loadState === 'error'" class="mt-6 rounded-card border border-divider bg-background px-4 py-6 text-center">
      <p class="text-sm text-text-primary">Unable to load guardian relationships.</p>
      <CmButton variant="secondary" size="sm" class="mt-3" @click="load">
        <span class="flex items-center gap-1.5"><RefreshCw class="size-4" /> Retry</span>
      </CmButton>
    </div>

    <template v-else>
      <!-- Primary -->
      <div v-if="primary" class="mt-5 rounded-card border border-divider bg-background p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">Primary</p>
        <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" class="text-left" @click="goToGuardian(primary.guardian?.id ?? primary.link.guardian_id)">
            <p class="text-base font-semibold text-text-primary hover:underline">{{ primary.guardian?.full_name || 'Unknown guardian' }}</p>
            <p class="text-sm text-text-secondary">
              {{ guardianRelationshipLabel(primary.link.relationship) }}
              <template v-if="primary.guardian?.primary_phone"> · {{ primary.guardian.primary_phone }}</template>
            </p>
            <p v-if="primary.guardian?.email" class="text-sm text-text-muted">{{ primary.guardian.email }}</p>
          </button>
          <div class="flex shrink-0 gap-2">
            <CmButton variant="secondary" size="sm" @click="openEdit(primary)">
              <span class="flex items-center gap-1.5"><Pencil class="size-4" /> Edit</span>
            </CmButton>
            <CmButton variant="danger" size="sm" @click="confirmRemove = primary">
              <span class="flex items-center gap-1.5"><Trash2 class="size-4" /> Remove</span>
            </CmButton>
          </div>
        </div>
      </div>

      <!-- Additional -->
      <div v-if="additional.length > 0" class="mt-4 space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">Additional guardians</p>
        <div
          v-for="h in additional"
          :key="h.link.id"
          class="flex flex-col gap-3 rounded-card border border-divider bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <button type="button" class="text-left" @click="goToGuardian(h.guardian?.id ?? h.link.guardian_id)">
            <p class="text-sm font-medium text-text-primary hover:underline">{{ h.guardian?.full_name || 'Unknown guardian' }}</p>
            <p class="text-xs text-text-muted">
              {{ guardianRelationshipLabel(h.link.relationship) }}
              <template v-if="h.guardian?.primary_phone"> · {{ h.guardian.primary_phone }}</template>
            </p>
          </button>
          <div class="flex shrink-0 gap-2">
            <CmButton variant="secondary" size="sm" @click="confirmPrimary = h">
              <span class="flex items-center gap-1.5"><Star class="size-4" /> Make primary</span>
            </CmButton>
            <CmButton variant="secondary" size="sm" @click="openEdit(h)">Edit</CmButton>
            <CmButton variant="danger" size="sm" @click="confirmRemove = h">Remove</CmButton>
          </div>
        </div>
      </div>

      <p v-if="!primary && additional.length === 0" class="mt-6 rounded-card border border-divider bg-background px-4 py-8 text-center text-sm text-text-muted">
        No guardians linked yet. Add a guardian or link an existing one.
      </p>
    </template>

    <!-- Add new guardian -->
    <CmModal v-model="showAddNew" title="Add new guardian" size="md">
      <form class="space-y-4" @submit.prevent="submitAddNew">
        <CmInput v-model="addForm.full_name" label="Full name" required placeholder="e.g. Jane Doe" />
        <CmInput v-model="addForm.primary_phone" label="Phone" required placeholder="e.g. 0803 000 0000" />
        <CmInput v-model="addForm.email" label="Email" type="email" placeholder="optional" />
        <CmSelect v-model="addForm.relationship" label="Relationship" :options="relOptions()" />
        <div class="flex justify-end gap-2 pt-2">
          <CmButton type="button" variant="secondary" @click="showAddNew = false">Cancel</CmButton>
          <CmButton type="submit" variant="primary" :disabled="addSaving || !addForm.full_name.trim() || !addForm.primary_phone.trim()">
            {{ addSaving ? 'Adding…' : 'Add & link' }}
          </CmButton>
        </div>
      </form>
    </CmModal>

    <!-- Link existing guardian -->
    <CmModal v-model="showLinkExisting" title="Link existing guardian" size="md">
      <div class="space-y-4">
        <CmSelect v-model="linkRelationship" label="Relationship" :options="relOptions()" />
        <CmInput v-model="linkQuery" label="" placeholder="Search by name, phone or email…" @update:model-value="searchLinkCandidates" />
        <div class="max-h-72 space-y-2 overflow-y-auto">
          <p v-if="linkSearching" class="py-4 text-center text-sm text-text-muted">Searching…</p>
          <p v-else-if="linkResults.length === 0" class="py-4 text-center text-sm text-text-muted">
            No guardians match. Use “Add guardian” to create a new one.
          </p>
          <button
            v-for="g in linkResults"
            :key="g.id"
            type="button"
            :disabled="busy"
            class="flex w-full items-center justify-between rounded-card border border-divider bg-background px-4 py-3 text-left hover:bg-surface/50 disabled:opacity-50"
            @click="linkCandidate(g.id)"
          >
            <span>
              <span class="block text-sm font-medium text-text-primary">{{ g.full_name }}</span>
              <span class="block text-xs text-text-muted">{{ g.primary_phone }}</span>
            </span>
            <span class="text-sm font-medium text-brand">Link</span>
          </button>
        </div>
      </div>
    </CmModal>

    <!-- Change primary confirmation -->
    <CmModal v-model="showConfirmPrimary" title="Change primary guardian" size="sm">
      <div v-if="confirmPrimary" class="space-y-4">
        <p class="text-sm text-text-secondary">
          This guardian will become the student's primary guardian. Existing billing and notification
          references will use this guardian.
        </p>
        <p class="rounded-card border border-divider bg-background px-4 py-3 text-sm font-medium text-text-primary">
          {{ confirmPrimary.guardian?.full_name }}
        </p>
        <div class="flex justify-end gap-2">
          <CmButton variant="secondary" @click="confirmPrimary = null">Cancel</CmButton>
          <CmButton variant="primary" :disabled="busy" @click="makePrimary">{{ busy ? 'Updating…' : 'Make primary' }}</CmButton>
        </div>
      </div>
    </CmModal>

    <!-- Edit guardian -->
    <CmModal v-model="showEdit" title="Edit guardian" size="md">
      <form v-if="editTarget" class="space-y-4" @submit.prevent="submitEdit">
        <CmInput v-model="editForm.full_name" label="Full name" required />
        <CmInput v-model="editForm.primary_phone" label="Phone" required />
        <CmInput v-model="editForm.email" label="Email" type="email" placeholder="optional" />
        <CmSelect v-model="editForm.relationship" label="Relationship to student" :options="relOptions()" />
        <div class="flex justify-end gap-2 pt-2">
          <CmButton type="button" variant="secondary" @click="editTarget = null">Cancel</CmButton>
          <CmButton type="submit" variant="primary" :disabled="editSaving">
            {{ editSaving ? 'Saving…' : 'Save changes' }}
          </CmButton>
        </div>
      </form>
    </CmModal>

    <!-- Remove relationship confirmation -->
    <CmModal v-model="showConfirmRemove" title="Remove guardian relationship" size="sm">
      <div v-if="confirmRemove" class="space-y-4">
        <p class="text-sm text-text-secondary">
          Remove <span class="font-medium text-text-primary">{{ confirmRemove.guardian?.full_name }}</span>'s
          relationship with this student? The guardian record is kept — only the link is removed.
        </p>
        <div class="flex justify-end gap-2">
          <CmButton variant="secondary" @click="confirmRemove = null">Cancel</CmButton>
          <CmButton variant="danger" :disabled="busy" @click="removeRelationship">{{ busy ? 'Removing…' : 'Remove relationship' }}</CmButton>
        </div>
      </div>
    </CmModal>
  </div>
</template>

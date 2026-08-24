<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <!-- Search -->
    <div class="relative flex-1">
      <input
        :value="searchQuery"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="text"
        placeholder="Search by name, ID, admission no, guardian, phone..."
        class="w-full rounded-input border border-border bg-surface px-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
    </div>

    <!-- Desktop: Filters + Sort + Actions -->
    <div class="flex flex-wrap items-center gap-2">
      <CmSelect
        v-model="internalFilters.class"
        :options="classOptions"
        placeholder="Class"
        :class="filterSelectClass"
        @update:model-value="emitFilterChange('class', $event)"
      />
      <CmSelect
        v-model="internalFilters.gender"
        :options="genderOptions"
        placeholder="Gender"
        :class="filterSelectClass"
        @update:model-value="emitFilterChange('gender', $event)"
      />
      <CmSelect
        v-model="internalFilters.status"
        :options="statusOptions"
        placeholder="Status"
        :class="filterSelectClass"
        @update:model-value="emitFilterChange('status', $event)"
      />
      <CmSelect
        v-model="internalFilters.academicSession"
        :options="sessionOptions"
        placeholder="Academic session"
        :class="filterSelectClass"
        @update:model-value="emitFilterChange('academicSession', $event)"
      />
      <CmSelect
        v-model="internalFilters.relationship"
        :options="relationshipOptions"
        placeholder="Relationship"
        :class="filterSelectClass"
        @update:model-value="emitFilterChange('relationship', $event)"
      />

      <div class="h-6 w-px bg-divider" />

      <CmSelect
        v-model="internalSortField"
        :options="sortFieldOptions"
        placeholder="Sort by"
        :class="filterSelectClass"
        @update:model-value="emitSortField($event)"
      />
      <button
        @click="toggleSortOrder"
        class="rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface/80 focus-ring"
      >
        {{ sortOrderLabel }}
        <ChevronDown v-if="sortOrder === 'asc'" class="ml-1 h-3 w-3" />
        <ChevronUp v-else class="ml-1 h-3 w-3" />
      </button>

      <!-- Clear filters -->
      <button
        v-if="hasActiveFilters"
        @click="clearAllFilters"
        class="rounded-button border border-border bg-surface px-2 py-2 text-sm text-text-muted hover:bg-surface/80 focus-ring"
        title="Clear all filters"
      >
        <X class="h-4 w-4" />
      </button>

      <!-- Bulk actions -->
      <template v-if="selectedCount > 0">
        <div class="h-6 w-px bg-divider" />
        <span class="text-sm text-text-secondary">
          {{ selectedCount }} selected
        </span>
        <CmButton variant="secondary" size="sm" @click="$emit('move-selected')">
          <ArrowRightLeft class="mr-1 h-4 w-4" />
          Move
        </CmButton>
        <CmButton variant="secondary" size="sm" @click="$emit('export-selected')">
          <FileSpreadsheet class="mr-1 h-4 w-4" />
          Export
        </CmButton>
        <CmButton variant="danger" size="sm" @click="$emit('archive-selected')">
          <Archive class="mr-1 h-4 w-4" />
          Archive
        </CmButton>
        <CmButton variant="secondary" size="sm" @click="$emit('clear-selection')">
          <X class="h-4 w-4" />
        </CmButton>
      </template>

      <!-- Action buttons -->
      <template v-else>
        <CmButton variant="secondary" size="sm" @click="$emit('export')">
          <FileSpreadsheet class="mr-1 h-4 w-4" />
          Export
        </CmButton>
        <!-- Mobile More menu -->
        <div class="sm:hidden">
          <CmDropdown
            :options="[
              { value: 'import', label: 'Import students' },
              { value: 'add', label: 'Add student' },
            ]"
            @change="handleMoreAction"
          >
            <template #default="{ open }">
              <button
                @click="open()"
                class="rounded-button border border-border bg-surface px-2 py-2 text-sm text-text-secondary hover:bg-surface/80 focus-ring"
              >
                <MoreHorizontal class="h-4 w-4" />
              </button>
            </template>
          </CmDropdown>
        </div>
        <!-- Desktop Import + Add -->
        <div class="hidden sm:flex sm:gap-2">
          <CmButton variant="secondary" size="sm" @click="$emit('import')">
            <Upload class="mr-1 h-4 w-4" />
            Import
          </CmButton>
          <CmButton variant="primary" size="sm" @click="$emit('add')">
            <UserPlus class="h-4 w-4" />
          </CmButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Search, X, ChevronDown, ChevronUp, MoreHorizontal, Upload, UserPlus, FileSpreadsheet, Archive, ArrowRightLeft } from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmDropdown from '@/components/ui/CmDropdown.vue';
import type { FilterState } from '../types';

interface Props {
  searchQuery: string;
  filters: FilterState;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  classOptions: { value: string; label: string }[];
  genderOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  sessionOptions: { value: string; label: string }[];
  relationshipOptions: { value: string; label: string }[];
  sortFieldOptions: { value: string; label: string }[];
  selectedCount: number;
}

interface Emits {
  (e: 'update:searchQuery', query: string): void;
  (e: 'filter-change', filters: Partial<FilterState>): void;
  (e: 'clear-filters'): void;
  (e: 'sort-change', field: string, order: 'asc' | 'desc'): void;
  (e: 'export'): void;
  (e: 'export-selected'): void;
  (e: 'move-selected'): void;
  (e: 'import'): void;
  (e: 'add'): void;
  (e: 'archive-selected'): void;
  (e: 'clear-selection'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const filterSelectClass = 'min-w-[140px] w-full';

// Local copies for v-model on CmSelect
const internalFilters = ref({ ...props.filters });
const internalSortField = ref(props.sortField);

// Sync from parent
watch(() => props.filters, (val) => {
  internalFilters.value = { ...val };
});
watch(() => props.sortField, (val) => {
  internalSortField.value = val;
});

const hasActiveFilters = computed(() => {
  return Boolean(
    internalFilters.value.class ||
    internalFilters.value.gender ||
    internalFilters.value.status ||
    internalFilters.value.academicSession ||
    internalFilters.value.relationship,
  );
});

const sortOrderLabel = computed(() => {
  return props.sortOrder === 'asc' ? 'Ascending' : 'Descending';
});

function emitFilterChange(key: string, value: string): void {
  internalFilters.value[key as keyof FilterState] = value || (key === 'status' ? 'ALL' : '');
  emit('filter-change', { [key]: value || (key === 'status' ? 'ALL' : '') });
}

function emitSortField(field: string): void {
  internalSortField.value = field;
  emit('sort-change', field, props.sortOrder);
}

function toggleSortOrder(): void {
  emit('sort-change', props.sortField, props.sortOrder === 'asc' ? 'desc' : 'asc');
}

function clearAllFilters(): void {
  internalFilters.value = {
    class: '',
    gender: '',
    status: 'ALL',
    academicSession: '',
    relationship: '',
  };
  emit('clear-filters');
}

function handleMoreAction(value: string | number): void {
  if (value === 'import') emit('import');
  if (value === 'add') emit('add');
}
</script>

<style scoped>
/* CmSelect renders a native <select> which needs explicit width */
.filter-select {
  min-width: 140px;
}
</style>

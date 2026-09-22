<template>
  <div class="space-y-3">
    <!-- Search + sort + record actions -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <!-- Search -->
      <div class="relative w-full sm:max-w-md" data-testid="student-search">
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          type="search"
          placeholder="Search name, ID, admission no, guardian, phone..."
          aria-label="Search students"
          class="w-full rounded-input border border-border bg-surface py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
          data-testid="student-search-input"
        />
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <button
          v-if="searchQuery"
          @click="$emit('update:searchQuery', '')"
          class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-text-muted hover:text-text-primary focus-ring"
          aria-label="Clear search"
          data-testid="student-search-clear"
          type="button"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Sort + export / add -->
      <div class="flex flex-wrap items-center gap-2">
        <CmSelect
          :model-value="internalSortField"
          :options="sortFieldOptions"
          label=""
          @update:model-value="emitSortField($event)"
          class="w-[170px]"
          data-testid="student-sort-field"
        />
        <button
          @click="toggleSortOrder"
          :aria-label="`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`"
          class="rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface/80 focus-ring"
          data-testid="student-sort-order"
        >
          {{ sortOrderLabel }}
          <ChevronDown v-if="sortOrder === 'asc'" class="ml-1 h-3 w-3" />
          <ChevronUp v-else class="ml-1 h-3 w-3" />
        </button>

        <div class="h-6 w-px bg-divider" />

        <!-- Export -->
        <CmButton variant="secondary" size="md" @click="$emit('export')" data-testid="export-students">
          <FileSpreadsheet class="mr-2 h-4 w-4" />
          Export
        </CmButton>
      </div>
    </div>

    <!-- Primary filters row -->
    <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2" data-testid="student-filters">
      <CmSelect
        :model-value="internalFilters.class"
        :options="classOptions"
        placeholder="Class"
        data-testid="filter-class"
        class="sm:w-[150px]"
        @update:model-value="emitFilterChange('class', $event)"
      />
      <CmSelect
        :model-value="internalFilters.gender"
        :options="genderOptions"
        placeholder="Gender"
        data-testid="filter-gender"
        class="sm:w-[130px]"
        @update:model-value="emitFilterChange('gender', $event)"
      />
      <CmSelect
        :model-value="internalFilters.status"
        :options="statusOptions"
        data-testid="filter-status"
        class="sm:w-[150px]"
        @update:model-value="emitFilterChange('status', $event)"
      />

      <!-- More Filters -->
      <CmButton
        variant="secondary"
        size="md"
        :class="{ 'border-brand text-brand': hasSecondaryActive }"
        aria-haspopup="dialog"
        :aria-expanded="showMoreFilters"
        data-testid="more-filters-toggle"
        @click="showMoreFilters = !showMoreFilters"
      >
        <SlidersHorizontal class="mr-2 h-4 w-4" />
        More
        <span
          v-if="secondaryFilterCount > 0"
          class="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-background"
          data-testid="more-filters-count"
        >
          {{ secondaryFilterCount }}
        </span>
      </CmButton>

      <!-- Clear filters -->
      <button
        v-if="hasActiveFilters"
        @click="clearAllFilters"
        class="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface/80 focus-ring"
        title="Clear all filters"
        data-testid="clear-filters"
      >
        <X class="h-4 w-4" />
        Clear
      </button>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <!-- Bulk actions -->
        <template v-if="selectedCount > 0">
          <div class="h-6 w-px bg-divider" />
          <span class="text-sm text-text-secondary">
            {{ selectedCount }} selected
          </span>
          <CmButton variant="secondary" size="sm" @click="$emit('move-selected')" data-testid="move-selected">
            <ArrowRightLeft class="mr-1 h-4 w-4" />
            Move
          </CmButton>
          <CmButton variant="secondary" size="sm" @click="$emit('export-selected')" data-testid="export-selected">
            <FileSpreadsheet class="mr-1 h-4 w-4" />
            Export
          </CmButton>
          <CmButton variant="danger" size="sm" @click="$emit('archive-selected')" data-testid="archive-selected">
            <Archive class="mr-1 h-4 w-4" />
            Archive
          </CmButton>
          <CmButton variant="secondary" size="sm" @click="$emit('clear-selection')" aria-label="Clear selection" data-testid="clear-selection">
            <X class="h-4 w-4" />
          </CmButton>
        </template>

        <!-- Import -->
        <template v-else>
          <CmButton variant="secondary" size="md" @click="$emit('import')" data-testid="import-students">
            <Upload class="mr-2 h-4 w-4" />
            Import
          </CmButton>
        </template>
      </div>
    </div>

    <!-- More Filters drawer -->
    <CmDrawer
      :model-value="showMoreFilters"
      title="More filters"
      placement="right"
      size="md"
      data-testid="more-filters-drawer"
      @update:model-value="showMoreFilters = $event"
    >
      <div class="space-y-4">
        <div>
          <span
            class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-secondary"
          >
            Academic session
          </span>
          <CmSelect
            :model-value="internalFilters.academicSession"
            :options="sessionOptions"
            placeholder="All sessions"
            data-testid="filter-session"
            class="w-full"
            @update:model-value="emitFilterChange('academicSession', $event)"
          />
        </div>
        <div>
          <span
            class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-secondary"
          >
            Relationship
          </span>
          <CmSelect
            :model-value="internalFilters.relationship"
            :options="relationshipOptions"
            placeholder="All relationships"
            data-testid="filter-relationship"
            class="w-full"
            @update:model-value="emitFilterChange('relationship', $event)"
          />
        </div>
        <button
          v-if="hasActiveFilters"
          @click="clearAllFilters"
          class="mt-2 w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface/80 focus-ring"
          data-testid="clear-filters-drawer"
        >
          Clear all filters
        </button>
      </div>
    </CmDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Upload,
  FileSpreadsheet,
  Archive,
  ArrowRightLeft,
  SlidersHorizontal,
} from '@lucide/vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import CmDrawer from '@/components/ui/CmDrawer.vue';
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

const showMoreFilters = ref(false);

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
    (internalFilters.value.status !== 'ALL') ||
    internalFilters.value.academicSession ||
    internalFilters.value.relationship,
  );
});

const secondaryFilterCount = computed(() => {
  let n = 0;
  if (internalFilters.value.academicSession) n += 1;
  if (internalFilters.value.relationship) n += 1;
  return n;
});

const hasSecondaryActive = computed(() => secondaryFilterCount.value > 0);

const sortOrderLabel = computed(() => {
  return props.sortOrder === 'asc' ? 'Asc' : 'Desc';
});

function emitFilterChange(key: string, value: string): void {
  const normalized = value || (key === 'status' ? 'ALL' : '');
  internalFilters.value[key as keyof FilterState] = normalized;
  emit('filter-change', { [key]: normalized });
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
  showMoreFilters.value = false;
  emit('clear-filters');
}
</script>

<style scoped>
/* Nothing needed here — spacing comes from the CEMDS utility classes. */
</style>
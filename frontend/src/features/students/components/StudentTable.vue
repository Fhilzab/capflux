<template>
  <div class="space-y-3">
    <!-- Table -->
    <div class="overflow-x-auto rounded-card border border-border bg-card">
      <table class="student-responsive-table min-w-full divide-y divide-divider">
        <!-- Header -->
        <thead class="bg-surface/50">
          <tr>
            <th class="w-12 px-4 py-3 text-left">
              <input
                type="checkbox"
                class="rounded border-border text-success focus:ring-success"
                :checked="isAllSelected()"
                :indeterminate="isSomeSelected() && !isAllSelected()"
                @change="toggleSelectAll($event)"
              />
            </th>
            <th
              v-for="col in visibleColumns"
              :key="col.key"
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
              :class="[
                col.sortable ? 'cursor-pointer hover:text-text-primary' : '',
              ]"
              @click="col.sortable && sortBy(col.key)"
            >
              <div class="flex items-center gap-1">
                {{ col.label }}
                <svg
                  v-if="col.sortable && sortField === col.key"
                  class="h-3 w-3 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :d="
                      sortOrder === 'asc'
                        ? 'M19.5 8.25l-7.5 7.5-7.5-7.5'
                        : 'M19.5 15.75l-7.5-7.5-7.5 7.5'
                    "
                  />
                </svg>
              </div>
            </th>
            <th class="w-16 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
              Actions
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody
          v-if="!loading"
          class="divide-y divide-divider/50"
        >
          <tr
            v-for="student in students"
            :key="student.id"
            class="transition-colors duration-150"
            :class="[
              selectedIds.has(student.id) ? 'bg-brand/10' : '',
              'group cursor-pointer',
            ]"
            @click="$emit('row-click', student)"
          >
            <!-- Checkbox -->
            <td class="px-4 py-3" data-label="Select">
              <input
                type="checkbox"
                class="rounded border-border text-success focus:ring-success"
                :checked="selectedIds.has(student.id)"
                @click.stop
                @change="$emit('toggle-select', student.id, $event)"
              />
            </td>

            <!-- Student -->
            <td class="px-4 py-3" data-label="Student">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-sm font-medium text-text-primary"
                >
                  {{ studentInitials(student) }}
                </div>
                <div>
                  <div class="font-medium text-text-primary">
                    {{ student.firstName }} {{ student.lastName }}
                  </div>
                  <div v-if="student.admissionNumber || student.studentId" class="text-xs text-text-muted">
                    {{ student.admissionNumber || student.studentId }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Academic placement: level with section subtext -->
            <td class="hidden px-4 py-3 md:table-cell" data-label="Class">
              <template v-if="student.levelName || student.class">
                <div class="text-sm text-text-primary">{{ student.levelName || student.class }}</div>
                <div v-if="student.sectionName" class="text-xs text-text-muted">{{ student.sectionName }}</div>
              </template>
              <span v-else class="text-sm text-text-muted">—</span>
            </td>

            <!-- Guardian -->
            <td class="hidden px-4 py-3 md:table-cell" data-label="Guardian">
              <div v-if="student.guardian">
                <div class="text-sm text-text-primary">{{ student.guardian.fullName }}</div>
                <div v-if="student.guardian.relationship" class="text-xs text-text-muted">
                  {{ relationshipLabel(student.guardian.relationship) }}
                </div>
              </div>
              <span v-else class="text-sm text-text-muted">—</span>
            </td>

            <!-- Phone -->
            <td class="hidden px-4 py-3 lg:table-cell" data-label="Phone">
              <span v-if="student.guardian?.phone" class="text-sm text-text-primary">
                {{ student.guardian.phone }}
              </span>
              <span v-else class="text-sm text-text-muted">—</span>
            </td>

            <!-- Status -->
            <td class="px-4 py-3" data-label="Status">
              <CmStatusChip
                :variant="statusChipVariant(student.status)"
                :label="statusLabel(student.status)"
                size="sm"
              />
            </td>

            <!-- Date -->
            <td class="hidden px-4 py-3 md:table-cell" data-label="Date Registered">
              <span class="text-sm text-text-muted">{{ formatDate(student.registeredAt || student.createdAt) }}</span>
            </td>

            <!-- Actions -->
            <td
              class="px-4 py-3"
              data-label="Actions"
              @click.stop
            >
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
                <button
                  @click.stop="$emit('view', student)"
                  class="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface focus-ring"
                  title="View student"
                >
                  <Eye class="h-4 w-4" />
                </button>
                <button
                  @click.stop="$emit('edit', student)"
                  class="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface focus-ring"
                  title="Edit student"
                >
                  <Pencil class="h-4 w-4" />
                </button>
                <div class="relative">
                  <button
                    @click.stop="openMenu(student.id)"
                    class="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface focus-ring"
                    title="More actions"
                  >
                    <Ellipsis class="h-4 w-4" />
                  </button>
                  <transition
                    enter-from-class="opacity-0 scale-95 -translate-y-2"
                    enter-active-class="transition duration-150"
                    leave-to-class="opacity-0 scale-95 -translate-y-2"
                    leave-active-class="transition duration-150"
                  >
                    <div
                      v-show="openMenuId === student.id"
                      data-action-menu
                      class="absolute right-0 z-dropdown mt-2 w-40 rounded-card border border-border bg-card shadow-elevated"
                    >
                      <button
                        @click.stop="$emit('financial-record', student); closeMenu()"
                        class="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface transition-colors"
                      >
                        <ReceiptText class="mr-2 h-4 w-4 inline" />
                        Financial record
                      </button>
                      <button
                        @click.stop="$emit('archive', student); closeMenu()"
                        class="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Archive class="mr-2 h-4 w-4 inline" />
                        Archive student
                      </button>
                    </div>
                  </transition>
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Loading state -->
        <tbody v-if="loading">
          <tr>
            <td
              :colspan="visibleColumns.length + 2"
              class="px-4 py-8 text-center text-text-secondary"
            >
              <CmLoading :text="loadingText" />
            </td>
          </tr>
        </tbody>

        <!-- Empty state in table -->
        <tbody v-if="!loading && !students.length">
          <tr>
            <td
              :colspan="visibleColumns.length + 2"
              class="px-4 py-8 text-center"
            >
              <slot name="empty" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between rounded-card border border-border bg-card px-4 py-3"
    >
      <div class="text-sm text-text-secondary">
        Page {{ currentPage }} of {{ totalPages }}
        <span v-if="totalItems !== undefined">({{ totalItems }} records)</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="$emit('page-change', 1)"
          :disabled="currentPage === 1"
          class="rounded-button border border-border bg-surface px-2 py-1 text-sm text-text-secondary hover:bg-surface/80 disabled:opacity-50 focus-ring"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <button
          @click="$emit('page-change', currentPage - 1)"
          :disabled="currentPage === 1"
          class="rounded-button border border-border bg-surface px-2 py-1 text-sm text-text-secondary hover:bg-surface/80 disabled:opacity-50 focus-ring"
        >
          Prev
        </button>
        <span class="px-2 text-sm text-text-secondary">
          {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          @click="$emit('page-change', currentPage + 1)"
          :disabled="currentPage >= totalPages"
          class="rounded-button border border-border bg-surface px-2 py-1 text-sm text-text-secondary hover:bg-surface/80 disabled:opacity-50 focus-ring"
        >
          Next
        </button>
        <button
          @click="$emit('page-change', totalPages)"
          :disabled="currentPage >= totalPages"
          class="rounded-button border border-border bg-surface px-2 py-1 text-sm text-text-secondary hover:bg-surface/80 disabled:opacity-50 focus-ring"
        >
          <ChevronRight class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Eye, Pencil, Archive, Ellipsis, ReceiptText, ChevronLeft, ChevronRight } from '@lucide/vue';
import dayjs from 'dayjs';
import CmStatusChip from '@/components/ui/CmStatusChip.vue';
import CmLoading from '@/components/ui/CmLoading.vue';
import type { NormalizedStudent } from '../types';
import {
  STATUS_LABELS,
  STATUS_CHIP_VARIANTS,
  relationshipLabel,
} from '../utils/normalizeStudent';

interface Column {
  key: string;
  label: string;
  sortable: boolean;
}

interface Props {
  students: NormalizedStudent[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  selectedIds: Set<string>;
  loading?: boolean;
  loadingText?: string;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
}

interface Emits {
  (e: 'sort', field: string, order: 'asc' | 'desc'): void;
  (e: 'toggle-select', id: string, checked: boolean): void;
  (e: 'toggle-select-all', checked: boolean): void;
  (e: 'view', student: NormalizedStudent): void;
  (e: 'edit', student: NormalizedStudent): void;
  (e: 'archive', student: NormalizedStudent): void;
  (e: 'financial-record', student: NormalizedStudent): void;
  (e: 'row-click', student: NormalizedStudent): void;
  (e: 'page-change', page: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingText: 'Loading students...',
  currentPage: 1,
  totalPages: 1,
});

const emit = defineEmits<Emits>();

const openMenuId = ref<string | null>(null);

const visibleColumns: Column[] = [
  { key: 'student', label: 'Student', sortable: false },
  { key: 'admissionNumber', label: 'ID / Admission #', sortable: true },
  { key: 'class', label: 'Class', sortable: true },
  { key: 'guardian', label: 'Guardian', sortable: false },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'dateRegistered', label: 'Date Registered', sortable: true },
];

function statusChipVariant(status: string): string {
  return STATUS_CHIP_VARIANTS[status] || 'info';
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function formatDate(date: string | undefined): string {
  if (!date) return '—';
  const d = dayjs(date);
  if (!d.isValid()) return '—';
  return d.format('MMM D, YYYY');
}

function studentInitials(student: NormalizedStudent): string {
  const f = student.firstName?.[0] || '';
  const l = student.lastName?.[0] || '';
  return (f + l).toUpperCase() || '?';
}

function isAllSelected(): boolean {
  return props.students.length > 0 && props.students.every((s) => props.selectedIds.has(s.id));
}

function isSomeSelected(): boolean {
  return props.students.some((s) => props.selectedIds.has(s.id));
}

function toggleSelectAll(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  emit('toggle-select-all', checked);
}

function sortBy(field: string): void {
  if (props.sortField === field) {
    emit('sort', field, props.sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
    emit('sort', field, 'asc');
  }
}

function openMenu(id: string): void {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function closeMenu(): void {
  openMenuId.value = null;
}

// Close menu on outside click
function handleOutsideClick(event: MouseEvent): void {
  const target = event.target as Node;
  if (!target.closest('[data-action-menu]')) {
    openMenuId.value = null;
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
});
</script>

<style>
/* Responsive table-to-cards on mobile (max-width: 768px / md breakpoint) */
.student-responsive-table,
.student-responsive-table thead,
.student-responsive-table tbody,
.student-responsive-table th,
.student-responsive-table td,
.student-responsive-table tr {
  display: block;
}
.student-responsive-table thead {
  position: absolute;
  top: -9999px;
  left: -9999px;
}
.student-responsive-table tr {
  margin-bottom: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.5rem;
  background: #fff;
}
.student-responsive-table td {
  text-align: right;
  padding: 0.5rem 0.75rem 0.5rem 40%;
  border-bottom: 1px solid #f3f4f6;
  position: relative;
}
.student-responsive-table td:last-child {
  border-bottom: 0;
}
.student-responsive-table td::before {
  content: attr(data-label);
  position: absolute;
  left: 0.75rem;
  width: calc(40% - 1.5rem);
  text-align: left;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #9ca3af;
}

/* On desktop (md+), restore normal table layout */
@media (min-width: 768px) {
  .student-responsive-table,
  .student-responsive-table thead,
  .student-responsive-table tbody,
  .student-responsive-table th,
  .student-responsive-table td,
  .student-responsive-table tr {
    display: table;
  }
  .student-responsive-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .student-responsive-table td {
    display: table-cell;
    text-align: left;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    position: static;
    width: auto;
  }
  .student-responsive-table td::before {
    display: none;
  }
  .student-responsive-table tr {
    display: table-row;
    margin-bottom: 0;
    border: none;
    padding: 0;
    background: transparent;
  }
}
</style>

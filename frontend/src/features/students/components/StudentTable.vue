<template>
  <div class="space-y-3">
    <!-- Table -->
    <div
      class="student-table-scroll rounded-card border border-border bg-card"
      data-testid="students-table-container"
    >
      <table class="student-table min-w-full divide-y divide-divider">
        <!-- Header -->
        <thead class="bg-surface/50">
          <tr>
            <th class="student-col-check w-12 px-4 py-3 text-left">
              <input
                type="checkbox"
                class="rounded border-border text-success focus:ring-success"
                :checked="isAllSelected()"
                :indeterminate="isSomeSelected() && !isAllSelected()"
                aria-label="Select all students"
                data-testid="select-all-students"
                @change="toggleSelectAll($event)"
              />
            </th>
            <th
              v-for="col in visibleColumns"
              :key="col.key"
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
              :class="[
                `student-col-${col.key}`,
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
                  aria-hidden="true"
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
            <th class="student-col-actions w-16 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
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
            <td class="student-col-check px-4 py-3">
              <input
                type="checkbox"
                class="rounded border-border text-success focus:ring-success"
                :checked="selectedIds.has(student.id)"
                :aria-label="`Select ${student.firstName} ${student.lastName}`"
                data-testid="select-student"
                @click.stop
                @change="$emit('toggle-select', student.id, $event)"
              />
            </td>

            <!-- Student -->
            <td class="student-col-student px-4 py-3">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-sm font-medium text-text-primary"
                  aria-hidden="true"
                >
                  {{ studentInitials(student) }}
                </div>
                <div class="min-w-0">
                  <div
                    class="font-medium text-text-primary"
                    data-testid="student-name"
                  >
                    {{ student.firstName }} {{ student.lastName }}
                  </div>
                  <div
                    v-if="student.admissionNumber || student.studentId"
                    class="truncate text-xs text-text-muted"
                    data-testid="student-id"
                  >
                    {{ student.admissionNumber || student.studentId }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Academic placement: level with section subtext -->
            <td class="student-col-class px-4 py-3" data-job-label="Class">
              <template v-if="student.levelName || student.class">
                <div class="text-sm text-text-primary">{{ student.levelName || student.class }}</div>
                <div v-if="student.sectionName" class="text-xs text-text-muted">{{ student.sectionName }}</div>
              </template>
              <span v-else class="text-sm text-text-muted">—</span>
            </td>

            <!-- Guardian -->
            <td class="student-col-guardian px-4 py-3" data-job-label="Guardian">
              <div v-if="student.guardian">
                <div class="text-sm text-text-primary">{{ student.guardian.fullName }}</div>
                <div v-if="student.guardian.relationship" class="text-xs text-text-muted">
                  {{ relationshipLabel(student.guardian.relationship) }}
                </div>
              </div>
              <span v-else class="text-sm text-text-muted">—</span>
            </td>

            <!-- Phone -->
            <td class="student-col-phone px-4 py-3" data-job-label="Phone">
              <span v-if="student.guardian?.phone" class="text-sm text-text-primary">
                {{ student.guardian.phone }}
              </span>
              <span v-else class="text-sm text-text-muted">—</span>
            </td>

            <!-- Status -->
            <td class="student-col-status px-4 py-3">
              <CmStatusChip
                :variant="statusChipVariant(student.status)"
                :label="statusLabel(student.status)"
                size="sm"
              />
            </td>

            <!-- Date -->
            <td class="student-col-date px-4 py-3" data-job-label="Registered">
              <span class="text-sm text-text-muted">{{ formatDate(student.registeredAt || student.createdAt) }}</span>
            </td>

            <!-- Actions -->
            <td
              class="student-col-actions px-4 py-3"
              @click.stop
            >
              <div
                class="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100"
                data-testid="student-row-actions"
              >
                <button
                  @click.stop="$emit('view', student)"
                  class="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface focus-ring"
                  title="View student"
                  aria-label="View student"
                  data-testid="view-student"
                >
                  <Eye class="h-4 w-4" />
                </button>
                <button
                  @click.stop="$emit('edit', student)"
                  class="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface focus-ring"
                  title="Edit student"
                  aria-label="Edit student"
                  data-testid="edit-student"
                >
                  <Pencil class="h-4 w-4" />
                </button>
                <div class="relative">
                  <button
                    @click.stop="openMenu(student.id)"
                    class="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface focus-ring"
                    title="More actions"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    :aria-expanded="openMenuId === student.id"
                    data-testid="student-more-actions"
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
                        class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface transition-colors"
                      >
                        <ReceiptText class="mr-2 inline h-4 w-4" />
                        Financial record
                      </button>
                      <button
                        @click.stop="$emit('archive', student); closeMenu()"
                        class="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Archive class="mr-2 inline h-4 w-4" />
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
      class="flex flex-col gap-2 rounded-card border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="students-pagination"
    >
      <div class="text-sm text-text-secondary">
        Page {{ currentPage }} of {{ totalPages }}
        <span v-if="totalItems !== undefined">({{ totalItems }} records)</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="$emit('page-change', 1)"
          :disabled="currentPage === 1"
          aria-label="First page"
          class="rounded-button border border-border bg-surface px-2 py-1 text-sm text-text-secondary hover:bg-surface/80 disabled:opacity-50 focus-ring"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <button
          @click="$emit('page-change', currentPage - 1)"
          :disabled="currentPage === 1"
          aria-label="Previous page"
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
          aria-label="Next page"
          class="rounded-button border border-border bg-surface px-2 py-1 text-sm text-text-secondary hover:bg-surface/80 disabled:opacity-50 focus-ring"
        >
          Next
        </button>
        <button
          @click="$emit('page-change', totalPages)"
          :disabled="currentPage >= totalPages"
          aria-label="Last page"
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
.student-table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.student-table {
  min-width: 860px;
  border-collapse: separate;
  border-spacing: 0;
}

/* Column visibility is entirely CSS-driven so the mobile card layout
   never competes with responsive utility visibility. */
@media (min-width: 640px) {
  .student-col-admissionNumber,
  .student-col-dateRegistered,
  .student-col-actions {
    display: table-cell;
  }
}
@media (min-width: 768px) {
  .student-col-class,
  .student-col-guardian {
    display: table-cell;
  }
}
@media (min-width: 1024px) {
  .student-col-phone {
    display: table-cell;
  }
}

@media (min-width: 768px) {
  /* Prevent headers from wrapping word-by-word on reduced widths. */
  .student-table th:not(.student-col-check) {
    white-space: nowrap;
  }
}

/* ── Mobile (below md): record cards instead of a compressed table ── */
@media (max-width: 767px) {
  .student-table-scroll {
    overflow-x: visible;
    border: none;
    background: transparent;
    box-shadow: none;
  }
  .student-table,
  .student-table thead,
  .student-table tbody,
  .student-table th,
  .student-table td,
  .student-table tr {
    display: block;
  }
  .student-table {
    min-width: 0;
  }
  .student-table > thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
  .student-table > tbody {
    display: grid;
    gap: 0.75rem;
  }
  .student-table > tbody > tr {
    margin: 0;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 0.75rem;
    background: var(--color-card, #fff);
    box-shadow: var(--shadow-card, 0 4px 24px rgba(0, 0, 0, 0.08));
    cursor: pointer;
  }
  .student-table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--color-divider, #f3f4f6);
    text-align: left;
  }
  .student-table > tbody > tr > td:last-child {
    border-bottom: 0;
  }
  .student-table td.student-col-check,
  .student-table td.student-col-status {
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }
  .student-table td.student-col-status {
    justify-content: flex-end;
  }

  /* Mobile label rail — duplicates the column label to keep the
     card self-describing. Root cells stay accessible. */
  .student-table td[data-job-label]::before {
    content: attr(data-job-label);
    flex: 0 0 auto;
    min-width: 5.5rem;
    margin-right: 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted, #9ca3af);
  }

  .student-table td.student-col-student {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
  }
  .student-table td.student-col-student::before,
  .student-table td.student-col-check::before,
  .student-table td.student-col-status::before,
  .student-table td.student-col-actions::before {
    display: none;
  }
  .student-table td.student-col-actions {
    justify-content: flex-end;
    padding-top: 0.5rem;
  }
  .student-table td.student-col-actions > div {
    opacity: 1 !important;
  }
  /* 44px touch targets for the primary row actions on mobile. */
  .student-table td.student-col-actions button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
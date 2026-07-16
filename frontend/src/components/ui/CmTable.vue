<script setup lang="ts">
import { ref } from 'vue';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface Props {
  columns: Column[];
  data: Record<string, any>[];
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  selectable?: boolean;
  loading?: boolean;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  sort: [field: string, order: 'asc' | 'desc'];
  select: [selected: Record<string, any>[]];
}>();

const selectedRows = ref<Record<string, any>[]>([]);

const toggleRow = (row: Record<string, any>) => {
  const index = selectedRows.value.findIndex(r => r === row);
  if (index > -1) {
    selectedRows.value.splice(index, 1);
  } else {
    selectedRows.value.push(row);
  }
  emit('select', selectedRows.value);
};

const toggleAll = () => {
  if (selectedRows.value.length === props.data.length) {
    selectedRows.value = [];
  } else {
    selectedRows.value = [...props.data];
  }
  emit('select', selectedRows.value);
};

const sortBy = (field: string) => {
  if (!props.sortField) return;
  const order = props.sortOrder === 'asc' ? 'desc' : 'asc';
  emit('sort', field, order);
};
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border bg-card">
    <table class="min-w-full divide-y divide-divider">
      <thead class="sticky top-0 bg-surface z-sticky">
        <tr>
          <th v-if="selectable" class="w-12 px-4 py-3">
            <input
              type="checkbox"
              class="rounded border-border text-primary focus:ring-primary"
              :checked="selectedRows.length === data.length && data.length > 0"
              @change="toggleAll"
            />
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
            :class="[
              column.align === 'center' ? 'text-center' : '',
              column.align === 'right' ? 'text-right' : '',
              column.sortable ? 'cursor-pointer hover:text-text-primary' : '',
            ]"
            :style="{ width: column.width }"
            @click="column.sortable && sortBy(column.key)"
          >
            <div class="flex items-center gap-1">
              {{ column.label }}
              <svg
                v-if="column.sortable && sortField === column.key"
                class="h-3 w-3 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :d="sortOrder === 'asc' ? 'M19.5 8.25l-7.5 7.5-7.5-7.5' : 'M19.5 15.75l-7.5-7.5-7.5 7.5'"
                />
              </svg>
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-divider">
        <tr
          v-for="(row, index) in data"
          :key="index"
          class="transition-colors duration-150"
          :class="[
            striped && index % 2 === 1 ? 'bg-surface/30' : '',
            hoverable ? 'hover:bg-surface' : '',
            compact ? 'py-2' : 'py-3',
            selectable && selectedRows.includes(row) ? 'bg-primary/10' : '',
          ]"
        >
          <td v-if="selectable" class="px-4 py-3">
            <input
              type="checkbox"
              class="rounded border-border text-primary focus:ring-primary"
              :checked="selectedRows.includes(row)"
              @change="toggleRow(row)"
            />
          </td>
          <td
            v-for="column in columns"
            :key="column.key"
            class="px-4 text-sm text-text-primary"
            :class="[
              column.align === 'center' ? 'text-center' : '',
              column.align === 'right' ? 'text-right' : '',
            ]"
          >
            <slot :name="column.key" :row="row" :value="row[column.key]">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
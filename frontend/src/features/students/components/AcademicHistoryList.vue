<template>
  <div class="space-y-3">
    <p v-if="history.length === 0" class="text-sm text-text-muted">No academic history recorded yet.</p>
    <div
      v-for="item in history"
      :key="item.enrollment.id"
      class="flex flex-col gap-1 rounded-card border border-divider bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-text-primary">{{ item.session?.name ?? 'Unknown session' }}</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="
              item.enrollment.status === 'ACTIVE'
                ? 'bg-success/10 text-success'
                : item.enrollment.status === 'SUPERSEDED'
                  ? 'bg-surface text-text-muted'
                  : 'bg-warning/10 text-warning'
            "
          >
            {{ item.enrollment.status }}
          </span>
        </div>
        <p class="mt-0.5 text-sm text-text-secondary">
          {{ item.section?.name ?? '—' }} · {{ item.level?.name ?? '—' }}
        </p>
      </div>
      <div class="text-right">
        <p v-if="item.enrollment.reason" class="text-xs font-medium text-text-secondary">{{ item.enrollment.reason }}</p>
        <p class="text-xs text-text-muted">Effective {{ formatDate(item.enrollment.effective_date) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HydratedEnrollment } from '@/stores/enrollmentStore';

defineProps<{ history: HydratedEnrollment[] }>();

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
</script>

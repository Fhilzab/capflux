<script setup lang="ts">
import MetricCard from '@/components/ui/MetricCard.vue';

interface StatItem {
  key: string;
  label: string;
  value: number;
  description: string;
  icon: string;
}

interface Props {
  stats: StatItem[];
}

const props = defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
    <MetricCard
      v-for="stat in props.stats ?? []"
      :key="stat.key"
      :label="stat.label"
      :value="stat.value"
      :icon-path="stat.icon"
    >
      <template #description>
        <span class="text-xs text-text-muted">{{ stat.description }}</span>
      </template>
    </MetricCard>
  </div>
</template>

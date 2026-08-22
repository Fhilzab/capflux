<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
    <MetricCard
      v-for="stat in stats"
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

<script setup lang="ts">
import { computed } from 'vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import type { NormalizedStudent } from '../types';
import { isStudentActive, isStudentArchived } from '../utils/normalizeStudent';

interface Props {
  students: NormalizedStudent[];
}

const props = defineProps<Props>();

const stats = computed(() => {
  const list = props.students;
  const uniqueClasses = new Set<string>();
  const uniqueGuardians = new Set<string>();

  for (const s of list) {
    if (s.class) uniqueClasses.add(s.class);
    const key = s.guardian?.phone || s.guardian?.id || s.guardian?.fullName;
    if (key) uniqueGuardians.add(key);
  }

  const total = list.length;
  const active = list.filter((s) => isStudentActive(s.status)).length;
  const archived = list.filter((s) => isStudentArchived(s.status)).length;

  return [
    {
      key: 'total',
      label: 'Total Students',
      value: total,
      description: 'All registered students',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    },
    {
      key: 'active',
      label: 'Active Students',
      value: active,
      description: 'Currently enrolled',
      icon: 'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8z',
    },
    {
      key: 'archived',
      label: 'Archived Students',
      value: archived,
      description: 'Inactive / left',
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    },
    {
      key: 'classes',
      label: 'Classes',
      value: uniqueClasses.size,
      description: 'Distinct classes',
      icon: 'M4 6h16v2H4V6zm0 4h16v2H4v-2zm0 4h10v2H4v-2z',
    },
    {
      key: 'guardians',
      label: 'Guardians',
      value: uniqueGuardians.size,
      description: 'Unique guardians',
      icon: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-5.8 2.6-5.8 5.8V22h11.6v-1.8c0-3.2-2.6-5.8-5.8-5.8z',
    },
  ];
});
</script>

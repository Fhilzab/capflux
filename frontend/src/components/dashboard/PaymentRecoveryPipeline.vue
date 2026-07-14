<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  totalStudents?: number;
  studentsPaid?: number;
  studentsInstallment?: number;
  studentsOverdue?: number;
  studentsReminded?: number;
  studentsRecovered?: number;
  loading?: boolean;
}

const props = defineProps<Props>();

const stages = computed(() => [
  { label: 'Invoiced', value: props.totalStudents || 0, color: 'text-cyan-400' },
  { label: 'Paid', value: props.studentsPaid || 0, conversion: props.totalStudents ? ((props.studentsPaid || 0) / props.totalStudents * 100).toFixed(1) : 0, color: 'text-emerald-400' },
  { label: 'Installments', value: props.studentsInstallment || 0, conversion: props.studentsPaid ? ((props.studentsInstallment || 0) / props.studentsPaid * 100).toFixed(1) : 0, color: 'text-amber-400' },
  { label: 'Overdue', value: props.studentsOverdue || 0, conversion: props.studentsInstallment ? ((props.studentsOverdue || 0) / props.studentsInstallment * 100).toFixed(1) : 0, color: 'text-rose-400' },
  { label: 'Reminded', value: props.studentsReminded || 0, conversion: props.studentsOverdue ? ((props.studentsReminded || 0) / props.studentsOverdue * 100).toFixed(1) : 0, color: 'text-violet-400' },
  { label: 'Recovered', value: props.studentsRecovered || 0, conversion: props.studentsReminded ? ((props.studentsRecovered || 0) / props.studentsReminded * 100).toFixed(1) : 0, color: 'text-emerald-400' },
]);
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Payment Recovery Pipeline</h2>
      <p class="text-sm text-slate-500">Collection funnel visualization</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div v-for="(stage, i) in stages" :key="stage.label" class="premium-card p-4 text-center">
        <p class="text-2xl font-mono font-bold" :class="stage.color">{{ stage.value }}</p>
        <p class="text-xs text-slate-400 mt-1">{{ stage.label }}</p>
        <p v-if="i > 0 && stage.conversion" class="text-xs font-medium text-slate-500 mt-1">{{ stage.conversion }}%</p>
      </div>
    </div>
  </section>
</template>
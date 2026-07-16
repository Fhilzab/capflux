<script setup lang="ts">
import { computed } from 'vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';

interface Student {
  student_id: string;
  student_name: string;
  class_name?: string;
  phone?: string;
  outstanding: number;
  percentage_paid: number;
}

interface Props {
  students?: Student[];
  loading?: boolean;
}

defineProps<Props>();

const severityColor = (percentage: number) => {
  if (percentage < 30) return 'text-danger';
  if (percentage < 60) return 'text-warning';
  return 'text-success';
};

const urgencyClass = (percentage: number) => {
  if (percentage < 30) return 'border-danger/30 bg-danger/5';
  if (percentage < 60) return 'border-warning/30 bg-warning/5';
  return 'border-success/30 bg-success/5';
};
</script>

<template>
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-headline">Outstanding Balances</h2>
      <router-link to="/reports/outstanding-fees" class="text-xs font-medium text-primary hover:text-primary-hover">View all →</router-link>
    </div>

    <!-- Loading state -->
    <SkeletonLoader v-if="loading" type="table" :count="5" />

    <!-- Empty state -->
    <EmptyState 
      v-else-if="!students || students.length === 0"
      title="No outstanding balances"
      description="All students have paid their fees"
    />

    <!-- Data table -->
    <div v-else class="overflow-x-auto rounded-card border border-divider bg-surface transition-colors duration-200">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-divider">
            <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Student</th>
            <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Class</th>
            <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Phone</th>
            <th class="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">Outstanding</th>
            <th class="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-text-muted">Progress</th>
            <th class="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students.slice(0, 10)" :key="student.student_id" class="border-t border-divider hover:bg-card/50 transition-colors duration-200">
            <td class="px-5 py-3.5 font-bold uppercase text-text-primary">{{ student.student_name }}</td>
            <td class="px-5 py-3.5 text-text-secondary">{{ student.class_name || 'N/A' }}</td>
            <td class="px-5 py-3.5 font-mono text-xs text-text-muted">{{ student.phone || '-' }}</td>
            <td class="px-5 py-3.5 text-right font-mono font-medium" :class="severityColor(student.percentage_paid)">
              ₦{{ student.outstanding.toLocaleString() }}
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center justify-center gap-2">
                <div class="h-1.5 w-16 rounded-full bg-divider overflow-hidden">
                  <div 
                    class="h-full rounded-full transition-all duration-500"
                    :class="{
                      'bg-danger': student.percentage_paid < 30,
                      'bg-warning': student.percentage_paid >= 30 && student.percentage_paid < 60,
                      'bg-success': student.percentage_paid >= 60
                    }"
                    :style="{ width: `${100 - student.percentage_paid}%` }"
                  ></div>
                </div>
                <span class="text-xs font-medium text-text-muted">{{ Math.round(100 - student.percentage_paid) }}%</span>
              </div>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex justify-end gap-1.5">
                <button class="flex h-7 w-7 items-center justify-center rounded-card bg-card/50 text-text-muted hover:bg-card transition-colors" title="WhatsApp">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.001 2.002c5.523 0 10 4.477 10 10s-4.477 10-10 10c-1.71 0-3.313-.436-4.688-1.18l-2.689.78.78-2.563A9.96 9.96 0 012 12.002c0-5.523 4.477-10 10-10zm0 2c-4.411 0-8 3.589-8 8 0 1.486.447 2.868 1.216 4.047l.224.355.55-.17c.418-.14.863-.21 1.306-.21h.292l.5-.5c.73-.73 1.72-1.125 2.787-1.125s2.058.395 2.787 1.125l.5.5h.292c.444 0 .888-.07 1.306-.21l.55-.17.224-.355A7.96 7.96 0 0020 12.002c0-4.411-3.589-8-8-8z" />
                  </svg>
                </button>
                <button class="flex h-7 w-7 items-center justify-center rounded-card bg-card/50 text-text-muted hover:bg-card transition-colors" title="SMS">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l1.5 1.5 3-3m0 0l3 3-3 3m3-3V3.75M19.5 12l-1.5 1.5-3-3m0 0l-3 3 3 3M4.5 19.5h15a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H4.5a2.25 2.25 0 00-2.25 2.25v15A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </button>
                <button class="flex h-7 w-7 items-center justify-center rounded-card bg-card/50 text-text-muted hover:bg-card transition-colors" title="Call">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.25 6.25 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-2.25c0-.621-.504-1.125-1.125-1.125H18V9.75a2.25 2.25 0 00-2.25-2.25h-2.25a2.25 2.25 0 00-2.25 2.25v2.25H6.75a2.25 2.25 0 00-2.25 2.25v2.25c0 .621.504 1.125 1.125 1.125H6" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
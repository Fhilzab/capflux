<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  currentStep: number;
  totalSteps?: number;
}

const props = withDefaults(defineProps<Props>(), {
  totalSteps: 3,
});

const steps = [
  { id: 1, name: 'School Profile', key: 'school_profile' },
  { id: 2, name: 'Financial Setup', key: 'financial_setup' },
  { id: 3, name: 'Activate Collections', key: 'activate' },
];

const progressPercentage = computed(() => ((props.currentStep - 1) / (props.totalSteps - 1)) * 100);
</script>

<template>
  <div class="w-full">
    <!-- Progress Bar -->
    <div class="flex items-center gap-4 mb-8">
      <div class="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div 
          class="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
          :style="{ width: progressPercentage + '%' }"
        ></div>
      </div>
      <span class="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
        Step {{ currentStep }} of {{ totalSteps }}
      </span>
    </div>

    <!-- Step Indicators -->
    <div class="flex justify-between">
      <div v-for="step in steps" :key="step.id" class="flex flex-col items-center">
        <div 
          class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium"
          :class="step.id === currentStep 
            ? 'bg-cyan-500 text-slate-950' 
            : step.id < currentStep 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'"
        >
          <svg v-if="step.id < currentStep" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else>{{ step.id }}</span>
        </div>
        <span class="mt-2 text-xs font-medium" :class="step.id <= currentStep ? 'text-slate-900 dark:text-white' : 'text-slate-500'">
          {{ step.name }}
        </span>
      </div>
    </div>
  </div>
</template>
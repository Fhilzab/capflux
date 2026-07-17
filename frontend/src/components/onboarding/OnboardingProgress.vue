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
  { id: 1, label: 'School Information' },
  { id: 2, label: 'Administrator Account' },
  { id: 3, label: 'Confirmation' },
];

const progressPercentage = computed(() => ((props.currentStep - 1) / (props.totalSteps - 1)) * 100);
</script>

<template>
  <div class="w-full">
    <!-- Step Indicators -->
    <div class="flex items-center justify-between mb-8">
      <div v-for="step in steps" :key="step.id" class="flex flex-col items-center">
        <!-- Step Circle -->
        <div 
          class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-300"
          :class="step.id === currentStep 
            ? 'bg-primary text-background' 
            : step.id < currentStep 
              ? 'bg-primary/10 text-primary' 
              : 'border border-border text-text-muted'"
        >
          <svg v-if="step.id < currentStep" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else class="w-5 h-5 flex items-center justify-center">{{ step.id }}</span>
        </div>
        
        <!-- Step Label -->
        <span class="mt-2 text-xs font-medium text-center" :class="step.id <= currentStep ? 'text-text-primary' : 'text-text-muted'">
          {{ step.label }}
        </span>
      </div>
    </div>

    <!-- Connecting Lines -->
    <div class="flex items-center gap-4 mb-8">
      <div 
        v-for="i in totalSteps - 1" 
        :key="i"
        class="flex-1 h-0.5 transition-colors duration-300"
        :class="i < currentStep ? 'bg-primary' : 'bg-border'"
      ></div>
    </div>

    <!-- Step Counter -->
    <div class="text-center">
      <span class="text-sm text-text-muted">
        Step {{ currentStep }} of {{ totalSteps }}
      </span>
    </div>
  </div>
</template>
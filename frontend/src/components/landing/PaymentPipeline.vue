<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useScrollAnimation } from '../../composables/useScrollAnimation';

const pipelineSteps = [
  { id: 1, label: 'Parent', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 2, label: 'Bank App', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0h6' },
  { id: 3, label: 'USSD', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { id: 4, label: 'POS', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m8 0h2a2 2 0 002-2v-6a2 2 0 002 2v6a2 2 0 00-2 2h-2m-8 0h8' },
  { id: 5, label: 'DVA', icon: 'M3 10h18M7 15h1m4 0h1m4 0h1M3 7h18c.552 0 1 .448 1 1s-.448 1-1 1H3c-.552 0-1-.448-1-1s0.448-1 1-1z' },
  { id: 6, label: 'Gateway', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 7, label: 'Webhook', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 8, label: 'Ledger', icon: 'M9 5l7 7-7 7' },
  { id: 9, label: 'Sync', icon: 'M4 4v5h5M19 20v-5h-5M4 20L20 4' },
  { id: 10, label: 'Dashboard', icon: 'M9 19v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5m12-12V7a2 2 0 012-2h2a2 2 0 012-2v10a2 2 0 01-2 2H9a2 2 0 01-2-2z' },
];

const activeStep = ref(0);
let animationTimer: ReturnType<typeof setInterval> | null = null;

const startAnimation = () => {
  if (animationTimer) return;
  
  let stepIndex = 0;
  animationTimer = setInterval(() => {
    activeStep.value = stepIndex;
    stepIndex = (stepIndex + 1) % (pipelineSteps.length + 1);
    if (stepIndex === 0) {
      // Brief pause at the end
      clearInterval(animationTimer);
      animationTimer = null;
      setTimeout(() => startAnimation(), 2000);
    }
  }, 600);
};

const stopAnimation = () => {
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
};

onMounted(() => {
  // Start animation after a brief delay
  setTimeout(() => startAnimation(), 1000);
});

onUnmounted(() => {
  stopAnimation();
});
</script>

<template>
  <div class="relative">
    <!-- Pipeline visualization -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
      <div
        v-for="(step, index) in pipelineSteps"
        :key="step.id"
        class="relative transition-opacity duration-300"
        :class="{
          'opacity-100': activeStep >= index,
          'opacity-30': activeStep < index
        }"
      >
        <!-- Connection line -->
        <div
          v-if="index > 0"
          class="absolute top-6 -left-3 w-6 h-0.5 bg-border hidden md:block"
          :class="{
            'bg-primary': activeStep >= index - 1
          }"
        />

        <!-- Step card -->
        <div class="flex flex-col items-center text-center">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300"
            :class="{
              'border-primary bg-primary/10': activeStep >= index,
              'border-border bg-card': activeStep < index
            }"
          >
            <svg
              class="h-6 w-6 transition-colors duration-300"
              :class="{
                'text-primary': activeStep >= index,
                'text-text-secondary': activeStep < index
              }"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" :d="step.icon" />
            </svg>
          </div>
          <p
            class="mt-3 text-xs font-medium transition-colors duration-300"
            :class="{
              'text-text-primary': activeStep >= index,
              'text-text-secondary': activeStep < index
            }"
          >
            {{ step.label }}
          </p>
        </div>
      </div>
    </div>

    <!-- Animated flow indicator -->
    <div class="mt-12 flex justify-center">
      <div class="relative h-1 w-full max-w-md bg-border rounded-full overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 bg-primary transition-all duration-500 rounded-full"
          :style="{ width: `${((activeStep + 1) / pipelineSteps.length) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .transition-all,
  .transition-opacity {
    transition: none;
  }
}
</style>
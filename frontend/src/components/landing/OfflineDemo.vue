<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{
  isActive?: boolean;
}>();

const phase = ref<'online' | 'offline' | 'syncing' | 'healthy'>('online');
const queueCount = ref(0);

const phases: Array<'online' | 'offline' | 'syncing' | 'healthy'> = ['online', 'offline', 'syncing', 'healthy'];
let animationInterval: ReturnType<typeof setInterval> | null = null;

const startAnimation = () => {
  let phaseIndex = 0;
  
  const runPhase = () => {
    phase.value = phases[phaseIndex];
    
    if (phase.value === 'offline') {
      queueCount.value = Math.floor(Math.random() * 5) + 1;
    } else if (phase.value === 'syncing') {
      queueCount.value = Math.max(0, queueCount.value - 1);
    } else if (phase.value === 'healthy') {
      queueCount.value = 0;
    }
    
    phaseIndex = (phaseIndex + 1) % phases.length;
  };
  
  runPhase();
  animationInterval = setInterval(runPhase, 2000);
};

const stopAnimation = () => {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  phase.value = 'online';
  queueCount.value = 0;
};

watch(() => props.isActive, (newVal) => {
  if (newVal) {
    startAnimation();
  } else {
    stopAnimation();
  }
}, { immediate: true });

onUnmounted(() => {
  stopAnimation();
});
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Status visualization -->
    <div class="relative flex items-center justify-center">
      <!-- Online indicator -->
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-300"
        :class="{
          'border-success bg-success/10': phase === 'online' || phase === 'syncing' || phase === 'healthy',
          'border-border bg-card': phase === 'offline'
        }"
      >
        <svg class="h-8 w-8 transition-colors duration-300" :class="{
          'text-success': phase === 'online' || phase === 'syncing' || phase === 'healthy',
          'text-text-secondary': phase === 'offline'
        }" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <!-- Queue badge -->
      <div
        v-if="phase === 'offline' && queueCount > 0"
        class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-background"
      >
        {{ queueCount }}
      </div>
    </div>

    <!-- Phase label -->
    <p class="mt-4 text-sm font-medium text-text-secondary">
      {{ phase === 'online' ? 'Online' : phase === 'offline' ? 'Offline' : phase === 'syncing' ? 'Syncing...' : 'Healthy' }}
    </p>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .transition-all {
    transition-duration: 300ms;
  }
}
</style>
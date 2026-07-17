<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface Props {
  value: number;
  label: string;
  prefix?: string;
  decimals?: number;
  isVisible?: boolean;
}

const props = defineProps<Props>();

const displayValue = ref(0);
const hasAnimated = ref(false);

const easeOutQuad = (t: number) => t * (2 - t);

const animateValue = () => {
  if (hasAnimated.value) return;
  hasAnimated.value = true;
  
  const duration = 1500;
  const startTime = performance.now();
  const startValue = 0;
  const change = props.value - startValue;
  
  const tick = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutQuad(progress);
    
    displayValue.value = startValue + change * easedProgress;
    
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      displayValue.value = props.value;
    }
  };
  
  requestAnimationFrame(tick);
};

watch(() => props.isVisible, (newVal) => {
  if (newVal && !hasAnimated.value) {
    animateValue();
  }
});

onMounted(() => {
  if (props.isVisible) {
    animateValue();
  }
});
</script>

<template>
  <div class="text-center">
    <p class="text-4xl md:text-5xl font-bold font-mono text-text-primary">
      {{ prefix }}{{ decimals !== undefined ? displayValue.toFixed(decimals) : displayValue.toLocaleString() }}
    </p>
    <p class="mt-2 text-sm text-text-secondary">{{ label }}</p>
  </div>
</template>
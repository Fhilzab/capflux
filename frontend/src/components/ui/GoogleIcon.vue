<script setup lang="ts">
import googleIcon from '@/assets/google.png';
import { computed } from 'vue';

interface Props {
  size?: number;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
});

const sizeClass = computed(() => `${props.size}px`);
</script>

<template>
  <img
    :src="googleIcon"
    alt="Google"
    :width="sizeClass"
    :height="sizeClass"
    class="flex-shrink-0"
    :class="props.class"
  />
</template>
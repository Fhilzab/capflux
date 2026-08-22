<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  text: string;
  placement?: 'right' | 'left' | 'top' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'right',
});

const show = ref(false);

const placementClasses = {
  right: 'left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2 whitespace-nowrap',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap',
};
</script>

<template>
  <div
    class="relative inline-block"
    @mouseenter="show = true"
    @mouseleave="show = false"
    @focusin="show = true"
    @focusout="show = false"
  >
    <slot />
    <transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-show="show"
        :aria-hidden="!show"
        class="absolute z-tooltip pointer-events-none rounded-md bg-card px-2 py-1 text-xs font-medium text-text-primary opacity-95 shadow-elevated border border-divider"
        :class="placementClasses[props.placement]"
      >
        {{ props.text }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface Props {
  options: DropdownOption[];
  modelValue?: string | number;
  placeholder?: string;
  disabled?: boolean;
  placement?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  change: [value: string | number];
}>();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const placementClasses = {
  'bottom-left': 'top-full left-0',
  'bottom-right': 'top-full right-0',
  'top-left': 'bottom-full left-0',
  'top-right': 'bottom-full right-0',
};

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue);
});

const selectOption = (option: DropdownOption) => {
  if (!option.disabled) {
    emit('update:modelValue', option.value);
    emit('change', option.value);
    isOpen.value = false;
  }
};

const closeOnOutsideClick = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', closeOnOutsideClick);
});
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block">
    <slot :open="() => isOpen = true" />
    <transition
      enter-from-class="opacity-0 scale-95 -translate-y-2"
      enter-active-class="transition duration-200"
      leave-to-class="opacity-0 scale-95 -translate-y-2"
      leave-active-class="transition duration-150"
    >
      <div
        v-show="isOpen"
        class="absolute z-dropdown mt-2 w-56 rounded-card border border-border bg-card shadow-elevated"
        :class="placementClasses[placement]"
      >
        <div class="py-1.5 max-h-64 overflow-y-auto">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            @click="selectOption(option)"
            class="w-full text-left px-3 py-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            :class="[
              option.value === modelValue
                ? 'bg-brand/10 text-brand'
                : 'text-text-primary hover:bg-surface',
              option.disabled && 'opacity-50',
            ]"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
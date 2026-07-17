<script setup lang="ts">
import { computed } from 'vue';

interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface Props {
  modelValue: string | number;
  options: Option[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  id?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();

const inputId = computed(() => props.id || `select-${Math.random().toString(36).slice(2, 9)}`);

const selectedLabel = computed(() => {
  const option = props.options.find(opt => opt.value === props.modelValue);
  return option ? option.label : '';
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-text-primary">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>
    <div class="relative">
      <select
        :id="inputId"
        :value="modelValue"
        :disabled="disabled"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
        class="w-full appearance-none rounded-input border bg-surface px-3 py-2.5 text-sm text-text-primary transition-all focus:outline-none focus:ring-2 focus:ring-success disabled:cursor-not-allowed disabled:opacity-50 shadow-float"
        :class="[
          error ? 'border-danger' : 'border-border hover:border-border/80',
        ]"
      >
        <option v-if="placeholder" value="" disabled hidden>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <svg
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
    <p v-else-if="helperText" class="text-xs text-text-muted">{{ helperText }}</p>
  </div>
</template>
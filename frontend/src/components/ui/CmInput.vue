<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface Props {
  modelValue: string | number;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  id?: string;
  autofocus?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();

const inputId = computed(() => props.id || `input-${Math.random().toString(36).slice(2, 9)}`);
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  if (props.autofocus && inputRef.value) {
    inputRef.value.focus();
  }
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', props.type === 'number' ? Number(target.value) : target.value);
};
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-text-primary">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>
    <div class="relative">
      <input
        ref="inputRef"
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="handleInput"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
        class="w-full rounded-button border bg-surface px-4 py-3 text-sm transition-shadow focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
        :class="[
          error ? 'border-danger focus:ring-danger' : 'border-border',
        ]"
      />
    </div>
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
    <p v-else-if="helperText" class="text-xs text-text-muted">{{ helperText }}</p>
  </div>
</template>
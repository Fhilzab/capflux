<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  modelValue?: boolean | string | undefined;
  checked?: boolean;
  label?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  checked: false,
  label: '',
  id: undefined,
  name: undefined,
  disabled: false,
  error: '',
  required: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:checked', value: boolean): void;
}>();

const checkboxRef = ref<HTMLInputElement | null>(null);
const inputId = computed(() => props.id || `checkbox-${Math.random().toString(36).slice(2, 9)}`);
const isChecked = computed(() => props.checked ?? (props.modelValue === true));

const handleChange = () => {
  const next = !isChecked.value;
  emit('update:modelValue', next);
  emit('update:checked', next);
};
</script>

<template>
  <div class="inline-flex items-start gap-2">
    <div class="relative flex items-start pt-0.5">
      <input
        ref="checkboxRef"
        :id="inputId"
        :name="name"
        type="checkbox"
        :checked="isChecked"
        :disabled="disabled"
        @change="handleChange"
        class="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
        :class="[error ? 'border-danger' : 'border-border']"
      />
    </div>
    <label
      v-if="label"
      :for="inputId"
      class="text-sm text-text-secondary"
      :class="[error ? 'text-danger' : 'text-text-secondary']"
    >
      <slot />
      <span v-if="required && label && !label.includes('*')"></span>
    </label>
  </div>
</template>

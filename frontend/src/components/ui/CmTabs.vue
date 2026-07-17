<script setup lang="ts">
interface Tab {
  key: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  tabs: Tab[];
  modelValue: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selectTab = (key: string) => {
  const tab = props.tabs.find(t => t.key === key);
  if (tab?.disabled) return;
  emit('update:modelValue', key);
};
</script>

<template>
  <div class="w-full">
    <div class="border-b border-divider">
      <nav class="flex space-x-6" aria-label="Tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          @click="selectTab(tab.key)"
          :disabled="tab.disabled"
          class="relative py-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          :class="[
            modelValue === tab.key
              ? 'text-brand'
              : 'text-text-secondary hover:text-text-primary',
          ]"
        >
          {{ tab.label }}
          <span
            v-if="modelValue === tab.key"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full transition-transform duration-300"
          ></span>
        </button>
      </nav>
    </div>
    <div class="pt-4">
      <slot />
    </div>
  </div>
</template>
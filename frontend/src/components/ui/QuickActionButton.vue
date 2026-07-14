<script setup lang="ts">
interface Props {
  label: string;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  disabled?: boolean;
  shortcut?: string;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [];
}>();

const variantClasses = {
  default: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20',
  error: 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20',
  info: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20',
};
</script>

<template>
  <button
    @click="emit('click')"
    :disabled="disabled"
    class="flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
    :class="variantClasses[variant || 'default']"
  >
    <svg v-if="icon" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" :d="icon" />
    </svg>
    <span class="truncate">{{ label }}</span>
    <kbd v-if="shortcut" class="hidden sm:inline-flex items-center rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{{ shortcut }}</kbd>
  </button>
</template>
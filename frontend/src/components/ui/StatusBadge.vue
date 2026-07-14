<script setup lang="ts">
interface Props {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';
  label: string;
}

defineProps<Props>();
</script>

<template>
  <span 
    class="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200"
    :class="{
      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': status === 'success',
      'bg-amber-500/10 text-amber-400 border border-amber-500/20': status === 'warning',
      'bg-rose-500/10 text-rose-400 border border-rose-500/20': status === 'error',
      'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20': status === 'info',
      'bg-slate-500/10 text-slate-400 border border-slate-500/20': status === 'neutral',
      'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse': status === 'pending'
    }"
  >
    <span 
      class="h-1.5 w-1.5 rounded-full" 
      :class="{
        'bg-emerald-400': status === 'success',
        'bg-amber-400': status === 'warning',
        'bg-rose-400': status === 'error',
        'bg-cyan-400': status === 'info',
        'bg-slate-400': status === 'neutral',
        'bg-cyan-400': status === 'pending'
      }"
    ></span>
    {{ label }}
  </span>
</template>
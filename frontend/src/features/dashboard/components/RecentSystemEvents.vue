<script setup lang="ts">
import { computed } from 'vue';

interface Event {
  id: string;
  type: 'student' | 'guardian' | 'dva' | 'payment' | 'reminder' | 'sync' | 'webhook' | 'settlement';
  title: string;
  description: string;
  timestamp: string;
}

interface Props {
  events?: Event[];
  loading?: boolean;
}

defineProps<Props>();

const eventIcons = {
  student: 'text-cyan-400',
  guardian: 'text-emerald-400',
  dva: 'text-violet-400',
  payment: 'text-amber-400',
  reminder: 'text-rose-400',
  sync: 'text-cyan-400',
  webhook: 'text-emerald-400',
  settlement: 'text-violet-400',
};
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Recent System Events</h2>
      <p class="text-sm text-slate-500">Timeline of operations</p>
    </div>

    <div v-if="!events || events.length === 0" class="premium-card p-6">
      <p class="text-sm text-slate-400">No recent events to display.</p>
    </div>

    <div v-else class="premium-card divide-y divide-slate-800/50">
      <div v-for="event in events.slice(0, 10)" :key="event.id" class="flex items-start gap-3 p-4">
        <div class="flex h-8 w-8 items-center justify-center rounded-xl" :class="eventIcons[event.type]">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path v-if="event.type === 'student'" stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.628 9.628 0 00-3.77-.88c-1.18 0-2.37.2-3.44.55a5.99 5.99 0 00-2.84-.97c-1.31 0-2.55.36-3.66.97a9.03 9.03 0 00-3.77.88c0 .34.03.68.08 1.01h15.84c.05-.33.08-.67.08-1z" />
            <path v-else-if="event.type === 'guardian'" stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            <path v-else-if="event.type === 'dva'" stroke-linecap="round" stroke-linejoin="round" d="M3 10.5h18M3 14.25h18M5.25 6a2.25 2.25 0 012.25-2.25h10.5A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H7.5A2.25 2.25 0 015.25 18V6z" />
            <path v-else-if="event.type === 'payment'" stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9" />
            <path v-else-if="event.type === 'reminder'" stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a7 7 0 00-5.714 0A2.25 2.25 0 013 15.75V9.125a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9.125v6.625c0 .441-.204.857-.543 1.143l-2.24.962" />
            <path v-else-if="event.type === 'sync'" stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            <path v-else-if="event.type === 'webhook'" stroke-linecap="round" stroke-linejoin="round" d="M12 12V8m0 4v4m4-4h1m-6 4v1m6-1V8m-3 4l3-3 3 3" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 3" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">{{ event.title }}</p>
          <p class="text-xs text-slate-400 mt-0.5">{{ event.description }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ event.timestamp }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
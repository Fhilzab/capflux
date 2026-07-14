<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '../../stores/onboardingStore';

const router = useRouter();
const onboardingStore = useOnboardingStore();

const nextSteps = [
  { id: 1, label: 'Configure Tuition', route: '/billing' },
  { id: 2, label: 'Register First Student', route: '/students' },
  { id: 3, label: 'Invite First Bursar', route: '/settings' },
  { id: 4, label: 'Generate First Virtual Account', route: '/virtual-accounts' },
  { id: 5, label: 'Go To Dashboard', route: '/dashboard' },
];

const goToStep = (route: string) => {
  onboardingStore.reset();
  router.push(route);
};
</script>

<template>
  <div class="premium-card p-8 text-center">
    <div class="mb-8">
      <div class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mx-auto mb-4">
        <svg class="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 class="text-headline mb-2">Congratulations!</h2>
      <p class="text-slate-500">Your school is ready to collect fees.</p>
    </div>

    <div class="mb-8">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">Next Steps</p>
      <div class="space-y-3">
        <button
          v-for="step in nextSteps"
          :key="step.id"
          @click="goToStep(step.route)"
          class="w-full flex items-center justify-between rounded-xl bg-slate-100/50 dark:bg-slate-800/50 p-4 text-left hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors focus-ring"
        >
          <span class="text-slate-900 dark:text-white">{{ step.label }}</span>
          <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
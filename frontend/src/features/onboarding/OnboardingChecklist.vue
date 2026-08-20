<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboardingStore';

const router = useRouter();
const onboarding = useOnboardingStore();

const steps = [
  { number: 1, label: 'Profile' },
  { number: 2, label: 'Organization' },
  { number: 3, label: 'School' },
  { number: 4, label: 'Owner Info' },
];

const stepStatus = computed(() => {
  return steps.map((s) => ({
    number: s.number,
    label: s.label,
    completed: onboarding.completedSteps.includes(s.number),
    current: onboarding.currentStep === s.number,
    clickable: onboarding.completedSteps.includes(s.number),
  }));
});

function goToStep(stepNum: number) {
  if (!stepStatus.value[stepNum - 1]?.clickable) return;
  onboarding.setStep(stepNum);
  router.push({ name: 'KycSubmission' });
}
</script>

<template>
  <nav class="w-full overflow-x-auto" aria-label="Onboarding progress">
    <ol class="flex items-center justify-center gap-1.5 py-4 sm:gap-2 sm:py-6">
      <li
        v-for="(step, index) in stepStatus"
        :key="step.number"
        class="flex items-center"
      >
        <button
          type="button"
          :disabled="!step.clickable"
          @click="goToStep(step.number)"
          :class="[
            'relative flex items-center justify-center rounded-full text-xs font-medium transition-all duration-200',
            'h-8 w-8 sm:h-10 sm:w-10',
            step.completed
              ? 'bg-brand text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-ring'
              : step.current
              ? 'bg-brand text-white ring-2 ring-brand-ring'
              : 'bg-surface border border-border text-text-muted',
          ]"
          :aria-label="`${step.label} step ${step.completed ? 'completed' : step.current ? 'current' : 'upcoming'}`"
        >
          <svg
            v-if="step.completed"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else>{{ step.number }}</span>
        </button>

        <span
          class="hidden sm:ml-2 sm:block sm:text-xs sm:font-medium"
          :class="[
            step.current
              ? 'text-brand'
              : step.completed
              ? 'text-text-secondary'
              : 'text-text-muted',
          ]"
        >
          {{ step.label }}
        </span>

        <span
          v-if="index < stepStatus.length - 1"
          class="mx-1.5 h-0.5 bg-border sm:mx-3 sm:w-8"
          :class="[step.completed ? 'bg-brand' : 'bg-border']"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>

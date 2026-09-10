<script setup lang="ts">
import { runtimeEnvironment } from '../../../shared/environment/runtimeEnvironment';
import { CmBadge } from '@/components/ui';

defineProps<{
  illustration?: boolean;
}>();

const homeUrl = runtimeEnvironment.isSandbox ? 'https://capflux.vercel.app' : '/';
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-background">
    <!-- Left Panel - Illustration (40%) - Visible on desktop -->
    <div class="hidden lg:block lg:w-[40%] bg-surface">
      <slot name="illustration"></slot>
    </div>

    <!-- Right Panel - Form (60%) -->
    <div class="flex w-full flex-col items-center justify-start lg:justify-center lg:w-[60%] p-5 sm:p-6 lg:p-12 overflow-y-auto">
      <div class="w-full max-w-md">
        <!-- Mobile / compact branded home link -->
        <div class="mb-5 lg:hidden">
          <div class="flex items-center justify-between">
            <a
              :href="homeUrl"
              aria-label="Go to CAPFLUX home"
              class="inline-flex items-center gap-2 text-text-primary font-bold text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
            >
              <img src="/icons.svg" alt="" class="h-9 w-auto" />
              <span>CAPFLUX</span>
            </a>
            <CmBadge
              variant="brand"
              label="Financial OS"
              size="sm"
              pill
            />
          </div>
        </div>

        <!-- Mobile Header -->
        <div class="lg:hidden text-center mb-6 sm:mb-8">
          <h2 class="text-headline mb-2">Every Naira Accounted For.</h2>
          <p class="text-sm text-text-muted">Financial Operating System for African Private Schools.</p>
        </div>

        <!-- Desktop Card -->
        <div class="premium-card bg-card p-6 lg:p-10 w-full">
          <slot name="form"></slot>
        </div>

        <!-- Footer -->
        <slot name="footer"></slot>
      </div>
    </div>
  </div>

  <!-- Mobile Illustration (below form, outside flex row to prevent width split) -->
  <div class="lg:hidden bg-surface w-full py-6 sm:py-8 px-5 sm:px-6">
    <slot name="illustration-mobile"></slot>
  </div>
</template>

<style scoped>
/* Ensure no scrolling on desktop */
@media (min-width: 1024px) {
  .overflow-y-auto {
    overflow-y: visible;
  }
}
</style>
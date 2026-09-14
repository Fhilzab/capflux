<script setup lang="ts">
import { runtimeEnvironment } from '../../../shared/environment/runtimeEnvironment';
import { CmBadge } from '@/components/ui';
import CapfluxMark from '@/components/branding/CapfluxMark.vue';

const homeUrl = runtimeEnvironment.isSandbox ? 'https://capflux.vercel.app' : '/';
</script>

<template>
  <div class="min-h-screen flex bg-background">
    <!-- Left Panel - Brand Experience (55-60%) - Visible on desktop -->
    <div class="hidden lg:flex lg:w-[58%] flex-col">
      <slot name="brand"></slot>
    </div>

    <!-- Right Panel - Authentication (40-45%) -->
    <div class="flex w-full flex-col items-center justify-center lg:w-[42%] lg:justify-center p-4 lg:p-8 overflow-y-auto">
      <div class="w-full max-w-[480px]">
        <!-- Mobile Header (hidden on desktop) -->
        <div class="lg:hidden text-center mb-8">
          <a
            :href="homeUrl"
            aria-label="Go to CAPFLUX home"
            class="inline-flex items-center gap-2 text-text-primary font-bold text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded mb-6"
          >
            <CapfluxMark :size="36" />
            <span>CAPFLUX</span>
          </a>
          <h2 class="text-headline mb-2">Every Naira Accounted For.</h2>
          <p class="text-sm text-text-muted">Financial Operating System for Nigerian Private Schools.</p>
        </div>

        <!-- Mobile Illustration -->
        <div class="lg:hidden">
          <slot name="illustration-mobile"></slot>
        </div>

        <!-- Authentication Card -->
        <div class="bg-card border border-divider rounded-[16px] shadow-sm p-6 lg:p-8 w-full max-w-[480px] mx-auto">
          <slot name="form"></slot>
        </div>

        <!-- Footer -->
        <slot name="footer"></slot>
      </div>
    </div>
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
<script setup lang="ts">
import authViewIllustration from '@/assets/authview_illustration.png';
import { runtimeEnvironment } from '../../../shared/environment/runtimeEnvironment';
import { CmBadge } from '@/components/ui';

const homeUrl = runtimeEnvironment.isSandbox ? 'https://capflux.vercel.app' : '/';
</script>

<template>
  <div class="flex flex-col justify-between min-h-screen p-8 lg:p-16 bg-surface">
    <!-- Logo -->
    <div class="mb-10 lg:mb-16">
      <a
        :href="homeUrl"
        aria-label="Go to CAPFLUX home"
        class="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
      >
        <img src="/icons.svg" alt="" class="h-7 w-auto lg:h-10" />
        <span class="font-bold text-xl text-text-primary lg:text-2xl">CAPFLUX</span>
      </a>
    </div>

    <!-- Brand Message -->
    <div class="max-w-xl">
      <h1 class="text-display lg:text-[48px] lg:leading-[1.05] font-extrabold text-text-primary mb-6">
        Every Naira Accounted For.
      </h1>
      <p class="text-base lg:text-lg leading-relaxed text-text-secondary">
        Financial Operating System for Nigerian Private Schools.
      </p>
    </div>

    <!-- Illustration -->
    <div class="flex justify-center my-10 lg:my-16">
      <img
        :src="authViewIllustration"
        alt="CAPFLUX infrastructure: School to CAPFLUX to student financial accounts to verification"
        class="w-full max-w-[540px] h-auto"
        style="max-width: 80%;"
      />
    </div>

    <!-- Trust Message -->
    <div class="text-center">
      <p class="text-sm lg:text-base text-text-muted">
        Built for the realities of Nigerian private schools.
      </p>
      <CmBadge
        v-if="runtimeEnvironment.isSandbox"
        variant="brand"
        label="Sandbox"
        size="sm"
        pill
        class="mt-3 inline-block"
      />
    </div>

    <!-- Spacer for bottom alignment -->
    <div class="flex-1 min-h-[60px]" />
  </div>
</template>
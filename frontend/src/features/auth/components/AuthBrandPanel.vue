<script setup lang="ts">
import authViewIllustration from '@/assets/authview_illustration.png';
import { runtimeEnvironment } from '../../../shared/environment/runtimeEnvironment';
import { CmBadge } from '@/components/ui';

const homeUrl = runtimeEnvironment.isSandbox ? 'https://capflux.vercel.app' : '/';
</script>

<template>
  <div class="flex flex-col justify-center min-h-screen p-8 lg:p-16 bg-surface">
    <!-- Logo -->
    <div class="mb-8 lg:mb-10">
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
    <div class="max-w-[500px]">
      <h1 class="text-[44px] lg:text-[48px] leading-[1.05] tracking-tight font-extrabold text-text-primary mb-4 lg:mb-6">
        Every Naira Accounted For.
      </h1>
      <p class="text-base lg:text-lg leading-relaxed text-text-secondary max-w-[500px]">
        Financial Operating System for Nigerian Private Schools.
      </p>
    </div>

    <!-- Illustration -->
    <div class="flex justify-center my-6 lg:my-10">
      <img
        :src="authViewIllustration"
        alt="CAPFLUX infrastructure: School to CAPFLUX to student financial accounts to verification"
        class="w-full max-w-[540px] h-auto"
        style="max-width: 85%; max-height: 400px;"
      />
    </div>

    <!-- Trust Message -->
    <div class="text-center mt-6 lg:mt-8">
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
  </div>
</template>
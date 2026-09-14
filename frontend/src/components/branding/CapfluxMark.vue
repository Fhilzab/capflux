<script setup lang="ts">
/**
 * CapfluxMark — canonical CAPFLUX C-monogram.
 * Single source of truth for branding across AppHeader, LandingNav, Auth, favicon.
 * Simple circle + C, no raster, no Inkscape payload.
 */
withDefaults(
  defineProps<{
    size?: number
    variant?: 'circle' | 'plain'
    ariaLabel?: string
  }>(),
  {
    size: 28,
    variant: 'circle',
    ariaLabel: 'CAPFLUX',
  }
)
</script>

<template>
  <span
    v-if="variant === 'circle'"
    class="inline-flex items-center justify-center rounded-full bg-brand text-white font-bold shadow-card select-none"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.52)}px` }"
    :aria-label="ariaLabel"
    role="img"
  >
    C
  </span>
  <svg
    v-else
    :width="size"
    :height="size"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :aria-label="ariaLabel"
    role="img"
  >
    <circle cx="14" cy="14" r="14" fill="var(--color-brand, #0F766E)" />
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="15" font-weight="700" font-family="Inter, system-ui, sans-serif">C</text>
  </svg>
</template>

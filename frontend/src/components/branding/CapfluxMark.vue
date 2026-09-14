<script setup lang="ts">
import capfluxLogo from '../../assets/capflux-logo.png'

/**
 * CapfluxMark — canonical CAPFLUX geometric interlocking logo.
 * Single source of truth for branding across AppHeader, LandingNav, Auth, favicon.
 * Uses the official raster asset extracted from the approved visual concept.
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
  <img
    :src="capfluxLogo"
    :width="size"
    :height="size"
    :alt="ariaLabel"
    class="inline-block select-none"
    :class="variant === 'circle' ? 'rounded-full' : ''"
    role="img"
  />
</template>

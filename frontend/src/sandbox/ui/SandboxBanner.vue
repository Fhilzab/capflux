<script setup lang="ts">
/**
 * Persistent sandbox banner — visible on every authed screen.
 * Professional informational styling (not an error): uses the CEMDS
 * design tokens and stays out of the way of the fixed header.
 */
import { FlaskConical } from '@lucide/vue';
</script>

<template>
  <div
    data-testid="sandbox-banner"
    class="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-text-secondary"
    role="status"
  >
    <FlaskConical class="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
    <span>
      SANDBOX MODE — No real transactions are processed.
      <span class="hidden sm:inline text-text-tertiary">
        Demo data only · payments, KYC, notifications &amp; messages are simulated.
      </span>
    </span>
    <RouterLink
      :to="{ name: 'SandboxControl' }"
      class="ml-2 rounded border border-divider px-1.5 py-0.5 text-[11px] hover:bg-background-hover"
    >
      Controls
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
/**
 * AuthIllustration — structured, responsive SVG recreation of the approved
 * AuthView raster artwork (school → CAPFLUX core → verified account cards).
 *
 * The artwork is real SVG (inspectable / animatable), not an embedded PNG.
 * The central mark is the geometric/interlocking CAPFLUX mark, reused
 * verbatim from CapfluxMark.vue (single source of truth). It is never
 * animated, rotated, morphed, or distorted.
 */
import CapfluxMark from '@/components/branding/CapfluxMark.vue';

withDefaults(
  defineProps<{
    /** `panel` = desktop brand-panel sizing, `mobile` = compact sizing. */
    variant?: 'panel' | 'mobile';
  }>(),
  { variant: 'panel' },
);
</script>

<template>
  <div
    class="auth-illustration"
    :class="variant === 'mobile' ? 'auth-illustration--mobile' : 'auth-illustration--panel'"
  >
    <svg
      class="auth-illustration-svg"
      viewBox="0 0 980 620"
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="authCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#a7f3d0" stop-opacity="0.55" />
          <stop offset="45%" stop-color="#6ee7b7" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#6ee7b7" stop-opacity="0" />
        </radialGradient>
        <filter id="authCardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#065f46" flood-opacity="0.18" />
        </filter>
      </defs>

      <g id="auth-illustration">
        <!-- Soft ambient light behind the whole composition -->
        <ellipse cx="490" cy="320" rx="330" ry="195" fill="#ffffff" opacity="0.1" />

        <!-- ============ NETWORK CONNECTIONS (behind cards / core) ============ -->
        <g id="network-connections">
          <!-- school → core -->
          <path class="auth-network-line" d="M 344 320 H 392" />
          <path class="auth-network-flow" d="M 344 320 H 392" pathLength="100" style="animation-delay: 0s" />
          <!-- top status card ↔ core -->
          <path class="auth-network-line" d="M 490 222 V 166" />
          <path class="auth-network-line" d="M 490 108 V 44" />
          <path class="auth-network-flow" d="M 490 222 V 44" pathLength="100" style="animation-delay: -1.2s" />
          <!-- bottom status card ↔ core -->
          <path class="auth-network-line" d="M 490 418 V 454" />
          <path class="auth-network-line" d="M 490 512 V 576" />
          <path class="auth-network-flow" d="M 490 418 V 576" pathLength="100" style="animation-delay: -2.4s" />
          <!-- core → account cards -->
          <path class="auth-network-line" d="M 559 251 C 612 242, 648 150, 712 150" />
          <path class="auth-network-line" d="M 583 290 C 628 288, 662 268, 712 268" />
          <path class="auth-network-line" d="M 583 350 C 628 352, 662 386, 712 386" />
          <path class="auth-network-line" d="M 559 389 C 612 398, 648 504, 712 504" />
          <path class="auth-network-flow" d="M 559 251 C 612 242, 648 150, 712 150" pathLength="100" style="animation-delay: -0.6s" />
          <path class="auth-network-flow" d="M 583 290 C 628 288, 662 268, 712 268" pathLength="100" style="animation-delay: -1.8s" />
          <path class="auth-network-flow" d="M 583 350 C 628 352, 662 386, 712 386" pathLength="100" style="animation-delay: -3s" />
          <path class="auth-network-flow" d="M 559 389 C 612 398, 648 504, 712 504" pathLength="100" style="animation-delay: -4.2s" />
        </g>

        <!-- ============ SCHOOL ============ -->
        <g id="school-network" class="auth-school">
          <g class="auth-school-trees">
            <line x1="56" y1="402" x2="56" y2="374" stroke="#065f46" stroke-width="4" stroke-linecap="round" />
            <ellipse cx="56" cy="361" rx="13" ry="18" fill="#10b981" opacity="0.85" />
            <line x1="362" y1="402" x2="362" y2="374" stroke="#065f46" stroke-width="4" stroke-linecap="round" />
            <ellipse cx="362" cy="361" rx="13" ry="18" fill="#10b981" opacity="0.85" />
            <ellipse cx="120" cy="395" rx="24" ry="9" fill="#10b981" opacity="0.9" />
            <ellipse cx="292" cy="395" rx="24" ry="9" fill="#10b981" opacity="0.9" />
          </g>
          <g class="auth-school-building" fill="#ffffff" stroke="#cfe3d9" stroke-width="1.5">
            <rect x="88" y="318" width="64" height="84" />
            <rect x="152" y="286" width="108" height="116" />
            <rect x="260" y="318" width="64" height="84" />
          </g>
          <g class="auth-school-roof" fill="#046c4e" stroke="#04573f" stroke-width="1.5" stroke-linejoin="round">
            <polygon points="80,318 120,294 160,318" />
            <polygon points="140,286 206,250 272,286" />
            <polygon points="252,318 292,294 332,318" />
          </g>
          <circle cx="206" cy="306" r="10" fill="#0d9d6c" />
          <g class="auth-school-windows" fill="#0d9d6c">
            <rect x="98" y="330" width="12" height="12" rx="1.5" />
            <rect x="122" y="330" width="12" height="12" rx="1.5" />
            <rect x="98" y="354" width="12" height="12" rx="1.5" />
            <rect x="122" y="354" width="12" height="12" rx="1.5" />
            <rect x="162" y="326" width="12" height="12" rx="1.5" />
            <rect x="238" y="326" width="12" height="12" rx="1.5" />
            <rect x="270" y="330" width="12" height="12" rx="1.5" />
            <rect x="294" y="330" width="12" height="12" rx="1.5" />
            <rect x="270" y="354" width="12" height="12" rx="1.5" />
            <rect x="294" y="354" width="12" height="12" rx="1.5" />
          </g>
          <g class="auth-school-entrance">
            <rect x="180" y="340" width="52" height="8" rx="2" fill="#046c4e" />
            <rect x="188" y="348" width="36" height="54" fill="#065f46" />
            <line x1="206" y1="348" x2="206" y2="402" stroke="#ffffff" stroke-width="2" opacity="0.55" />
          </g>
          <g class="auth-school-flag">
            <line x1="206" y1="250" x2="206" y2="218" stroke="#065f46" stroke-width="3" stroke-linecap="round" />
            <polygon points="206,218 234,225 206,233" fill="#059669" />
          </g>
          <line class="auth-school-baseline" x1="36" y1="402" x2="386" y2="402" stroke="#8fb3a4" stroke-width="2" stroke-linecap="round" />
        </g>

        <!-- ============ CENTRAL CAPFLUX CORE ============ -->
        <g id="central-network" class="auth-core">
          <ellipse class="auth-core-glow" cx="490" cy="320" rx="165" ry="150" fill="url(#authCoreGlow)" />
          <circle class="auth-core-ring auth-core-ring--outer" cx="490" cy="320" r="114" />
          <circle class="auth-core-ring" cx="490" cy="320" r="98" />
          <circle class="auth-core-disc" cx="490" cy="320" r="76" />
          <circle class="auth-core-inner" cx="490" cy="320" r="63" />
          <!-- AuthView center mark: exact geometric CAPFLUX mark reused from
               CapfluxMark.vue (single source of truth). Never animated. -->
          <g transform="translate(458,288)">
            <CapfluxMark :size="64" variant="plain" class="auth-core-icon" />
          </g>
        </g>

        <!-- ============ ACCOUNT + STATUS CARDS ============ -->
        <g id="account-cards">
          <!-- four right-side account cards -->
          <g class="auth-account-card" transform="translate(712,112)">
            <rect width="216" height="76" rx="14" fill="#ffffff" stroke="#d9e9e1" stroke-width="1.5" filter="url(#authCardShadow)" />
            <g class="auth-account-avatar" transform="translate(34,38)">
              <circle r="17" fill="#dcefe6" />
              <path d="M -11 11 A 12.5 12.5 0 0 1 11 11 Z" fill="#065f46" />
              <circle cy="-4.5" r="6.5" fill="#065f46" />
            </g>
            <rect class="auth-account-line" x="62" y="22" width="88" height="8" rx="4" fill="#d3e0d9" />
            <rect class="auth-account-line" x="62" y="36" width="66" height="8" rx="4" fill="#dde8e2" />
            <rect class="auth-account-line" x="62" y="50" width="78" height="8" rx="4" fill="#d3e0d9" />
            <g transform="translate(186,38)"><g class="auth-account-check" style="animation-delay: 0.45s">
              <circle r="13" fill="#059669" />
              <path d="M -5.5 0 L -1.2 4.6 L 6 -5" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g></g>
          </g>
          <g class="auth-account-card" transform="translate(712,230)">
            <rect width="216" height="76" rx="14" fill="#ffffff" stroke="#d9e9e1" stroke-width="1.5" filter="url(#authCardShadow)" />
            <g class="auth-account-avatar" transform="translate(34,38)">
              <circle r="17" fill="#dcefe6" />
              <path d="M -11 11 A 12.5 12.5 0 0 1 11 11 Z" fill="#065f46" />
              <circle cy="-4.5" r="6.5" fill="#065f46" />
            </g>
            <rect class="auth-account-line" x="62" y="22" width="88" height="8" rx="4" fill="#d3e0d9" />
            <rect class="auth-account-line" x="62" y="36" width="66" height="8" rx="4" fill="#dde8e2" />
            <rect class="auth-account-line" x="62" y="50" width="78" height="8" rx="4" fill="#d3e0d9" />
            <g transform="translate(186,38)"><g class="auth-account-check" style="animation-delay: 0.57s">
              <circle r="13" fill="#059669" />
              <path d="M -5.5 0 L -1.2 4.6 L 6 -5" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g></g>
          </g>
          <g class="auth-account-card" transform="translate(712,348)">
            <rect width="216" height="76" rx="14" fill="#ffffff" stroke="#d9e9e1" stroke-width="1.5" filter="url(#authCardShadow)" />
            <g class="auth-account-avatar" transform="translate(34,38)">
              <circle r="17" fill="#dcefe6" />
              <path d="M -11 11 A 12.5 12.5 0 0 1 11 11 Z" fill="#065f46" />
              <circle cy="-4.5" r="6.5" fill="#065f46" />
            </g>
            <rect class="auth-account-line" x="62" y="22" width="88" height="8" rx="4" fill="#d3e0d9" />
            <rect class="auth-account-line" x="62" y="36" width="66" height="8" rx="4" fill="#dde8e2" />
            <rect class="auth-account-line" x="62" y="50" width="78" height="8" rx="4" fill="#d3e0d9" />
            <g transform="translate(186,38)"><g class="auth-account-check" style="animation-delay: 0.69s">
              <circle r="13" fill="#059669" />
              <path d="M -5.5 0 L -1.2 4.6 L 6 -5" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g></g>
          </g>
          <g class="auth-account-card" transform="translate(712,466)">
            <rect width="216" height="76" rx="14" fill="#ffffff" stroke="#d9e9e1" stroke-width="1.5" filter="url(#authCardShadow)" />
            <g class="auth-account-avatar" transform="translate(34,38)">
              <circle r="17" fill="#dcefe6" />
              <path d="M -11 11 A 12.5 12.5 0 0 1 11 11 Z" fill="#065f46" />
              <circle cy="-4.5" r="6.5" fill="#065f46" />
            </g>
            <rect class="auth-account-line" x="62" y="22" width="88" height="8" rx="4" fill="#d3e0d9" />
            <rect class="auth-account-line" x="62" y="36" width="66" height="8" rx="4" fill="#dde8e2" />
            <rect class="auth-account-line" x="62" y="50" width="78" height="8" rx="4" fill="#d3e0d9" />
            <g transform="translate(186,38)"><g class="auth-account-check" style="animation-delay: 0.81s">
              <circle r="13" fill="#059669" />
              <path d="M -5.5 0 L -1.2 4.6 L 6 -5" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g></g>
          </g>

          <!-- top + bottom status cards -->
          <g class="auth-status-card" transform="translate(434,108)">
            <rect width="112" height="58" rx="12" fill="#ffffff" stroke="#d9e9e1" stroke-width="1.5" filter="url(#authCardShadow)" />
            <rect class="auth-status-line" x="12" y="14" width="54" height="7" rx="3.5" fill="#d3e0d9" />
            <rect class="auth-status-line" x="12" y="26" width="40" height="7" rx="3.5" fill="#dde8e2" />
            <rect class="auth-status-line" x="12" y="38" width="48" height="7" rx="3.5" fill="#d3e0d9" />
            <g transform="translate(88,29)"><g class="auth-status-check" style="animation-delay: 0.35s">
              <circle r="11" fill="#059669" />
              <path d="M -4.5 0 L -1 3.8 L 5 -4" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g></g>
          </g>
          <g class="auth-status-card" transform="translate(434,454)">
            <rect width="112" height="58" rx="12" fill="#ffffff" stroke="#d9e9e1" stroke-width="1.5" filter="url(#authCardShadow)" />
            <rect class="auth-status-line" x="12" y="14" width="54" height="7" rx="3.5" fill="#d3e0d9" />
            <rect class="auth-status-line" x="12" y="26" width="40" height="7" rx="3.5" fill="#dde8e2" />
            <rect class="auth-status-line" x="12" y="38" width="48" height="7" rx="3.5" fill="#d3e0d9" />
            <g transform="translate(88,29)"><g class="auth-status-check" style="animation-delay: 0.9s">
              <circle r="11" fill="#059669" />
              <path d="M -4.5 0 L -1 3.8 L 5 -4" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g></g>
          </g>
        </g>

        <!-- ============ CONNECTION NODES ============ -->
        <g id="nodes" fill="#047857" stroke="#ffffff" stroke-width="1.5">
          <circle class="auth-network-node" cx="344" cy="320" r="5" style="animation-delay: 0s" />
          <circle class="auth-network-node" cx="392" cy="320" r="5" style="animation-delay: 0.35s" />
          <circle class="auth-network-node" cx="490" cy="222" r="5" style="animation-delay: 0.7s" />
          <circle class="auth-network-node" cx="490" cy="418" r="5" style="animation-delay: 1.05s" />
          <circle class="auth-network-node" cx="559" cy="251" r="5" style="animation-delay: 0.2s" />
          <circle class="auth-network-node" cx="583" cy="290" r="5" style="animation-delay: 0.55s" />
          <circle class="auth-network-node" cx="583" cy="350" r="5" style="animation-delay: 0.9s" />
          <circle class="auth-network-node" cx="559" cy="389" r="5" style="animation-delay: 1.25s" />
          <circle class="auth-network-node" cx="712" cy="150" r="5" style="animation-delay: 0.4s" />
          <circle class="auth-network-node" cx="712" cy="268" r="5" style="animation-delay: 0.75s" />
          <circle class="auth-network-node" cx="712" cy="386" r="5" style="animation-delay: 1.1s" />
          <circle class="auth-network-node" cx="712" cy="504" r="5" style="animation-delay: 1.45s" />
          <circle class="auth-network-node" cx="490" cy="44" r="6.5" style="animation-delay: 0.9s" />
          <circle class="auth-network-node" cx="490" cy="576" r="6.5" style="animation-delay: 1.2s" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.auth-illustration {
  display: flex;
  justify-content: center;
  width: 100%;
}

.auth-illustration-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.auth-illustration--panel .auth-illustration-svg {
  max-width: 560px;
  max-height: 440px;
}

.auth-illustration--mobile .auth-illustration-svg {
  max-width: 300px;
  max-height: 240px;
  margin-inline: auto;
}

/* ---- base connector / core styling ---- */
.auth-network-line {
  fill: none;
  stroke: #059669;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.9;
}

.auth-network-flow {
  fill: none;
  stroke: #5df7da;
  stroke-width: 2.5;
  stroke-linecap: round;
  opacity: 0.8;
  stroke-dasharray: 10 90;
  animation: auth-flow 4.8s linear infinite;
}

.auth-core-glow {
  opacity: 0.75;
  transform-box: fill-box;
  transform-origin: center;
  animation: auth-core-breathe 5.5s ease-in-out infinite;
}

.auth-core-ring {
  fill: none;
  stroke: #059669;
  stroke-width: 2;
  opacity: 0.55;
}

.auth-core-ring--outer {
  stroke-width: 1.5;
  opacity: 0.35;
  animation: auth-ring-breathe 5.5s ease-in-out infinite;
}

.auth-core-disc {
  fill: #ffffff;
  stroke: #e3efe9;
  stroke-width: 1.5;
}

.auth-core-inner {
  fill: none;
  stroke: #dfe9e4;
  stroke-width: 1;
}

/* The canonical CAPFLUX icon stays stable: never animated. */
.auth-core-icon {
  overflow: hidden;
}

.auth-network-node {
  animation: auth-node-pulse 2.8s ease-in-out infinite;
}

.auth-account-check,
.auth-status-check {
  transform-box: fill-box;
  transform-origin: center;
  animation: auth-badge-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* ---- entrance ---- */
.auth-illustration-svg {
  animation: auth-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes auth-enter {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes auth-core-breathe {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.035);
  }
}

@keyframes auth-ring-breathe {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes auth-node-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@keyframes auth-badge-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes auth-flow {
  to {
    stroke-dashoffset: -100;
  }
}

/* Calmer motion on small screens */
@media (max-width: 640px) {
  .auth-core-glow {
    animation-duration: 7s;
  }
  .auth-network-flow {
    animation-duration: 6.5s;
  }
}

/* Decorative artwork: fully static when reduced motion is requested. */
@media (prefers-reduced-motion: reduce) {
  .auth-illustration-svg,
  .auth-illustration-svg * {
    animation: none !important;
  }
  .auth-network-flow {
    opacity: 0 !important;
  }
  .auth-core-glow,
  .auth-core-ring,
  .auth-core-ring--outer,
  .auth-network-node,
  .auth-account-check,
  .auth-status-check {
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>

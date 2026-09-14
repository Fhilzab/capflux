<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

/**
 * CapfluxPaymentFlow — Illustrative SVG visualization of CAPFLUX payment infrastructure.
 *
 * This is a marketing visualization only. All student names, amounts and
 * transaction data are illustrative and do not represent real customer data.
 *
 * Animation cycle:
 * 1. Payment originates at school node
 * 2. Particle travels along path to CAPFLUX core
 * 3. CAPFLUX core activates
 * 4. Verification state appears
 * 5. Student account card highlights
 * 6. Transaction row updates
 * 7. Pause, then repeat
 */

const isReducedMotion = ref(false);
let mediaQuery: MediaQueryList | null = null;

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  isReducedMotion.value = mediaQuery.matches;
  mediaQuery.addEventListener('change', handleMotionChange);
});

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', handleMotionChange);
});

const handleMotionChange = (e: MediaQueryListEvent) => {
  isReducedMotion.value = e.matches;
};

// Illustrative student data — not real customer data
const students = [
  { name: 'Tunde A.', klass: '10A · JSS 1', amount: '₦120,000' },
  { name: 'Amina B.', klass: '8B · JSS 2', amount: '₦95,000' },
  { name: 'Chidi K.', klass: '11C · SS 1', amount: '₦120,000' },
  { name: 'Zainab S.', klass: '9A · JSS 3', amount: '₦75,000' },
];

const transactions = [
  { name: 'Tunde A.', fee: 'School Fees · Term 1', amount: '₦120,000', time: 'Just now' },
  { name: 'Amina B.', fee: 'School Fees · Term 1', amount: '₦95,000', time: '12 mins ago' },
  { name: 'Chidi K.', fee: 'School Fees · Term 1', amount: '₦120,000', time: '1 hour ago' },
  { name: 'Zainab S.', fee: 'School Fees · Term 1', amount: '₦75,000', time: '2 hours ago' },
];
</script>

<template>
  <div class="capflux-payment-flow" :class="{ 'reduced-motion': isReducedMotion }" aria-hidden="true">
    <svg
      viewBox="0 0 520 380"
      class="payment-flow-svg"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <!-- Subtle glow filter for CAPFLUX core -->
        <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- Gradient for connection path -->
        <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.6" />
        </linearGradient>

        <!-- Gradient for particle -->
        <radialGradient id="particle-gradient">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.6" />
        </radialGradient>
      </defs>

      <!-- LAYER 1: School Payment Origin -->
      <g class="payment-origin">
        <rect x="10" y="140" width="100" height="80" rx="10" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1.5" />
        <g transform="translate(22, 152)">
          <!-- Simplified school building icon -->
          <rect x="6" y="12" width="32" height="28" rx="2" fill="var(--color-brand-soft)" stroke="var(--color-brand)" stroke-width="1" />
          <path d="M22 4 L38 12 L6 12 Z" fill="var(--color-brand)" opacity="0.6" />
          <rect x="18" y="28" width="8" height="12" rx="1" fill="var(--color-brand)" opacity="0.4" />
        </g>
        <text x="60" y="178" text-anchor="middle" class="label-school">School Payment</text>
        <text x="60" y="198" text-anchor="middle" class="text-amount">₦120,000</text>
        <text x="60" y="212" text-anchor="middle" class="text-muted-small">Parent payment</text>
      </g>

      <!-- LAYER 2: Payment Path -->
      <g class="payment-path">
        <!-- Connection path from school to CAPFLUX -->
        <path
          d="M 110 180 C 160 180, 180 180, 210 180"
          stroke="url(#path-gradient)"
          stroke-width="2"
          stroke-dasharray="4 3"
          class="connection-path"
        />
        <!-- Secondary path from CAPFLUX to student accounts -->
        <path
          d="M 310 180 C 340 180, 360 180, 390 180"
          stroke="url(#path-gradient)"
          stroke-width="2"
          stroke-dasharray="4 3"
          class="connection-path"
        />

        <!-- Animated payment particle -->
        <circle r="5" fill="url(#particle-gradient)" class="payment-particle" filter="url(#core-glow)">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            begin="0s"
            keyPoints="0;0;1;1;0;0"
            keyTimes="0;0.15;0.45;0.5;0.7;1"
            calcMode="linear"
            path="M 110 180 C 160 180, 180 180, 310 180"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0;0"
            keyTimes="0;0.1;0.4;0.55;0.7;1"
            dur="6s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      <!-- LAYER 3: CAPFLUX Core -->
      <g class="capflux-core" transform="translate(210, 130)">
        <!-- Outer ring -->
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-brand)" stroke-width="1" opacity="0.2" class="capflux-core-ring" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-brand)" stroke-width="1" opacity="0.15" class="capflux-core-ring-inner" />

        <!-- Core background -->
        <circle cx="50" cy="50" r="32" fill="var(--color-brand-soft)" stroke="var(--color-brand)" stroke-width="1.5" />

        <!-- CAPFLUX mark (simplified "cf" monogram) -->
        <text x="50" y="46" text-anchor="middle" class="capflux-mark">cf</text>
        <text x="50" y="64" text-anchor="middle" class="capflux-label">CAPFLUX</text>

        <!-- Pulse animation on core -->
        <circle cx="50" cy="50" r="32" fill="none" stroke="var(--color-brand)" stroke-width="2" class="capflux-pulse" opacity="0" />
      </g>

      <!-- Verification badge near core -->
      <g class="verification-state" transform="translate(248, 80)">
        <circle cx="12" cy="12" r="11" fill="var(--color-success-soft)" stroke="var(--color-success)" stroke-width="1.5" />
        <path d="M7 12.5 L10.5 16 L17 9" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="verification-check" />
      </g>

      <!-- LAYER 4: Student Account Cards -->
      <g class="student-accounts">
        <g class="student-card" transform="translate(390, 100)">
          <rect width="120" height="48" rx="8" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" />
          <circle cx="16" cy="20" r="8" fill="var(--color-brand-soft)" />
          <text x="16" y="23" text-anchor="middle" class="avatar-text">T</text>
          <text x="30" y="18" class="student-name">Tunde A.</text>
          <text x="30" y="30" class="student-class">10A · JSS 1</text>
          <text x="30" y="42" class="student-amount">₦120,000</text>
          <circle cx="106" cy="24" r="6" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M103 24 L105.5 26.5 L109.5 22" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <g class="student-card" transform="translate(390, 156)">
          <rect width="120" height="48" rx="8" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" />
          <circle cx="16" cy="20" r="8" fill="var(--color-brand-soft)" />
          <text x="16" y="23" text-anchor="middle" class="avatar-text">A</text>
          <text x="30" y="18" class="student-name">Amina B.</text>
          <text x="30" y="30" class="student-class">8B · JSS 2</text>
          <text x="30" y="42" class="student-amount">₦95,000</text>
          <circle cx="106" cy="24" r="6" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M103 24 L105.5 26.5 L109.5 22" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <g class="student-card" transform="translate(390, 212)">
          <rect width="120" height="48" rx="8" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" />
          <circle cx="16" cy="20" r="8" fill="var(--color-brand-soft)" />
          <text x="16" y="23" text-anchor="middle" class="avatar-text">C</text>
          <text x="30" y="18" class="student-name">Chidi K.</text>
          <text x="30" y="30" class="student-class">11C · SS 1</text>
          <text x="30" y="42" class="student-amount">₦120,000</text>
          <circle cx="106" cy="24" r="6" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M103 24 L105.5 26.5 L109.5 22" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <g class="student-card student-card-last" transform="translate(390, 268)">
          <rect width="120" height="48" rx="8" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" />
          <circle cx="16" cy="20" r="8" fill="var(--color-brand-soft)" />
          <text x="16" y="23" text-anchor="middle" class="avatar-text">Z</text>
          <text x="30" y="18" class="student-name">Zainab S.</text>
          <text x="30" y="30" class="student-class">9A · JSS 3</text>
          <text x="30" y="42" class="student-amount">₦75,000</text>
          <circle cx="106" cy="24" r="6" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M103 24 L105.5 26.5 L109.5 22" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>
      </g>

      <!-- LAYER 5: Verification Status Bar -->
      <g class="verification-bar" transform="translate(10, 350)">
        <rect x="0" y="0" width="500" height="24" rx="6" fill="var(--color-success-soft)" />
        <circle cx="14" cy="12" r="5" fill="var(--color-success)" />
        <path d="M11.5 12 L13.5 14 L17 10" stroke="var(--color-card)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        <text x="26" y="15" class="verification-text">All payments verified and reconciled</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.capflux-payment-flow {
  --cycle-duration: 6s;
  --payment-duration: 1.2s;
  --verification-duration: 0.25s;
  --card-highlight-duration: 0.3s;
  --easing: cubic-bezier(0.22, 1, 0.36, 1);
  --brand: var(--color-brand);
  --brand-soft: var(--color-brand-soft);
  --success: var(--color-success);
  --success-soft: var(--color-success-soft);
  --card: var(--color-card);
  --border: var(--color-border);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --text-muted: var(--color-text-muted);
}

.payment-flow-svg {
  width: 100%;
  height: auto;
  max-width: 520px;
  display: block;
}

/* Typography within SVG */
.label-school {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.text-amount {
  font-size: 11px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-mono);
}

.text-muted-small {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.capflux-mark {
  font-size: 18px;
  font-weight: 800;
  fill: var(--brand);
  font-family: var(--font-family-sans);
  letter-spacing: -0.5px;
}

.capflux-label {
  font-size: 7px;
  font-weight: 600;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
  letter-spacing: 0.5px;
}

.student-name {
  font-size: 8px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.student-class {
  font-size: 6.5px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.student-amount {
  font-size: 7.5px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-mono);
}

.avatar-text {
  font-size: 7px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-sans);
}

.verification-text {
  font-size: 8px;
  font-weight: 500;
  fill: var(--success);
  font-family: var(--font-family-sans);
}

/* ================================================================
   ANIMATIONS
   ================================================================ */

/* CAPFLUX core ring pulse */
.capflux-core-ring {
  animation: ring-pulse var(--cycle-duration) var(--easing) infinite;
  transform-origin: center;
}

.capflux-core-ring-inner {
  animation: ring-pulse-inner var(--cycle-duration) var(--easing) infinite;
  transform-origin: center;
}

@keyframes ring-pulse {
  0%, 40%, 100% { opacity: 0.2; transform: scale(1); }
  50%, 60% { opacity: 0.4; transform: scale(1.03); }
}

@keyframes ring-pulse-inner {
  0%, 40%, 100% { opacity: 0.15; transform: scale(1); }
  50%, 60% { opacity: 0.3; transform: scale(1.02); }
}

/* CAPFLUX pulse burst on activation */
.capflux-pulse {
  animation: core-activate var(--cycle-duration) var(--easing) infinite;
  transform-origin: center;
}

@keyframes core-activate {
  0%, 42%, 100% { opacity: 0; r: 32; }
  48% { opacity: 0.5; r: 36; }
  55% { opacity: 0; r: 42; }
}

/* Verification check animation */
.verification-state {
  animation: verification-appear var(--cycle-duration) var(--easing) infinite;
}

@keyframes verification-appear {
  0%, 45%, 100% { opacity: 0; transform: translate(248px, 80px) scale(0.85); }
  50% { opacity: 1; transform: translate(248px, 80px) scale(1); }
  90% { opacity: 1; transform: translate(248px, 80px) scale(1); }
}

.verification-check {
  animation: check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 12;
  stroke-dashoffset: 12;
}

@keyframes check-draw {
  0%, 48%, 100% { stroke-dashoffset: 12; }
  52% { stroke-dashoffset: 0; }
  90% { stroke-dashoffset: 0; }
}

/* Student card highlight sequence */
.student-card {
  animation: card-highlight var(--cycle-duration) var(--easing) infinite;
}

.student-card:nth-child(2) {
  animation-delay: calc(var(--cycle-duration) * 0.125);
}

.student-card:nth-child(3) {
  animation-delay: calc(var(--cycle-duration) * 0.25);
}

.student-card:nth-child(4) {
  animation-delay: calc(var(--cycle-duration) * 0.375);
}

@keyframes card-highlight {
  0%, 55%, 100% {
    opacity: 1;
    transform: translateX(0);
  }
  60%, 65% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
}

/* Connection path subtle animation */
.connection-path {
  animation: path-flow var(--cycle-duration) linear infinite;
}

@keyframes path-flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -14; }
}

/* ================================================================
   REDUCED MOTION — Static fallback
   ================================================================ */
.reduced-motion .capflux-core-ring,
.reduced-motion .capflux-core-ring-inner,
.reduced-motion .capflux-pulse,
.reduced-motion .verification-state,
.reduced-motion .verification-check,
.reduced-motion .student-card,
.reduced-motion .connection-path,
.reduced-motion .payment-particle {
  animation: none;
}

.reduced-motion .verification-state {
  opacity: 1;
}

.reduced-motion .verification-check {
  stroke-dashoffset: 0;
}

.reduced-motion .payment-particle {
  opacity: 0;
}

/* ================================================================
   RESPONSIVE
   ================================================================ */

/* Hide last student card on smaller widths to prevent overflow */
@media (max-width: 1280px) {
  .student-card-last {
    display: none;
  }
}

/* Mobile: simplify the graphic */
@media (max-width: 768px) {
  .capflux-payment-flow {
    max-width: 320px;
    margin: 0 auto;
  }

  .payment-flow-svg {
    max-width: 320px;
  }
}
</style>

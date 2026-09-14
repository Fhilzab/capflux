<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

/**
 * CapfluxPaymentFlow — Payment infrastructure visualization.
 *
 * Illustrative data only — not real customer data.
 *
 * Animation cycle:
 * 1. Payment particle travels school → CAPFLUX
 * 2. CAPFLUX core activates
 * 3. Verification badge appears
 * 4. Student card highlights sequentially
 * 5. Transaction row highlights
 * 6. Pause, then repeat
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
</script>

<template>
  <div class="capflux-payment-flow" :class="{ 'reduced-motion': isReducedMotion }" aria-hidden="true">
    <svg
      viewBox="0 0 880 400"
      class="payment-flow-svg"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.25" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.55" />
        </linearGradient>

        <radialGradient id="particle-gradient">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.4" />
        </radialGradient>

        <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-card)" />
          <stop offset="100%" stop-color="var(--color-sidebar)" />
        </linearGradient>
      </defs>

      <!-- ====== LAYER 1: SCHOOL PAYMENT ORIGIN ====== -->
      <g class="payment-origin" transform="translate(0, -20)">
        <!-- Payment card -->
        <rect x="20" y="120" width="130" height="80" rx="12" fill="url(#card-bg)" stroke="var(--color-border)" stroke-width="1.5" />
        <rect x="20" y="120" width="130" height="28" rx="12" fill="var(--color-brand-soft)" />
        <rect x="20" y="36" width="130" height="28" rx="12" fill="var(--color-brand-soft)" />
        <!-- School building icon -->
        <g transform="translate(35, 52)">
          <rect x="10" y="20" width="30" height="22" rx="2" fill="var(--color-brand)" opacity="0.12" stroke="var(--color-brand)" stroke-width="1" />
          <path d="M25 2 L45 20 L5 20 Z" fill="var(--color-brand)" opacity="0.5" />
          <rect x="20" y="30" width="10" height="12" rx="1" fill="var(--color-brand)" opacity="0.35" />
        </g>
        <text x="85" y="148" text-anchor="middle" class="label-school">School Payment</text>
        <text x="85" y="166" text-anchor="middle" class="text-amount">₦120,000</text>
        <text x="85" y="182" text-anchor="middle" class="text-muted-small">Parents pay school fees</text>
      </g>

      <!-- ====== LAYER 2: PAYMENT PATH ====== -->
      <g class="payment-path">
        <!-- Path: school → CAPFLUX -->
        <path
          d="M 150 160 C 220 160, 270 155, 340 155"
          stroke="url(#path-gradient)"
          stroke-width="1.5"
          stroke-dasharray="5 4"
          class="connection-path"
        />
        <!-- Small connection node at school end -->
        <circle cx="150" cy="160" r="3" fill="var(--color-brand)" opacity="0.6" />
        <!-- Small connection node at CAPFLUX end -->
        <circle cx="340" cy="155" r="3" fill="var(--color-brand)" opacity="0.6" />

        <!-- Animated payment particle -->
        <circle r="5" fill="url(#particle-gradient)" class="payment-particle" filter="url(#core-glow)">
          <animateMotion
            dur="1.8s"
            repeatCount="indefinite"
            begin="0.6s"
            calcMode="spline"
            keySplines="0.22 1 0.36 1"
            keyPoints="0;0;1;1;0;0"
            keyTimes="0;0.1;0.5;0.55;0.9;1"
            path="M 150 160 C 220 160, 270 155, 340 155"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0;0"
            keyTimes="0;0.08;0.45;0.55;0.85;1"
            dur="1.8s"
            repeatCount="indefinite"
            begin="0.6s"
          />
        </circle>
      </g>

      <!-- ====== LAYER 3: CAPFLUX CORE ====== -->
      <g class="capflux-core" transform="translate(355, 60)">
        <!-- Outer pulse ring -->
        <circle cx="65" cy="65" r="58" fill="none" stroke="var(--color-brand)" stroke-width="1.5" opacity="0.15" class="capflux-core-ring" />
        <!-- Inner ring -->
        <circle cx="65" cy="65" r="48" fill="none" stroke="var(--color-brand)" stroke-width="1" opacity="0.1" class="capflux-core-ring-inner" />

        <!-- Core background -->
        <circle cx="65" cy="65" r="40" fill="var(--color-card)" stroke="var(--color-brand)" stroke-width="2" class="capflux-core-bg" />

        <!-- CAPFLUX logo text -->
        <text x="65" y="56" text-anchor="middle" class="capflux-mark">cf</text>
        <text x="65" y="74" text-anchor="middle" class="capflux-label">CAPFLUX</text>

        <!-- Pulse burst on activation -->
        <circle cx="65" cy="65" r="40" fill="none" stroke="var(--color-brand)" stroke-width="2" class="capflux-pulse" opacity="0" />
      </g>

      <!-- Verification badge near CAPFLUX -->
      <g class="verification-badge" transform="translate(420, 10)">
        <rect x="-8" y="-14" width="100" height="28" rx="8" fill="var(--color-card)" stroke="var(--color-success)" stroke-width="1.5" />
        <circle cx="6" cy="0" r="5" fill="var(--color-success-soft)" class="check-bg" />
        <path d="M3.5 0 L6.5 3 L10.5 -3" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="verification-check" />
        <text x="18" y="4" class="verification-text">Payment Verified</text>
        <text x="18" y="14" class="verification-subtext">in seconds</text>
      </g>

      <!-- Processing label under CAPFLUX -->
      <g class="processing-label" transform="translate(355, 125)">
        <text x="65" y="0" text-anchor="middle" class="processing-title">CAPFLUX</text>
        <text x="65" y="14" text-anchor="middle" class="processing-subtitle">Verifies, allocates and reconciles automatically</text>
        <text x="65" y="28" text-anchor="middle" class="processing-arrow">↓</text>
      </g>

      <!-- ====== LAYER 4: STUDENT ACCOUNT CARDS ====== -->
      <g class="student-accounts">
        <!-- Card 1: Tunde A. -->
        <g class="student-card active-card-1" transform="translate(540, 40)">
          <rect width="160" height="52" rx="10" fill="var(--color-card)" stroke="var(--color-brand)" stroke-width="1.5" class="card-border" />
          <circle cx="22" cy="22" r="10" fill="var(--color-brand-soft)" />
          <text x="22" y="26" text-anchor="middle" class="avatar-text">T</text>
          <text x="40" y="18" class="student-name">Tunde A.</text>
          <text x="40" y="30" class="student-class">10A · JSS 1</text>
          <text x="40" y="42" class="student-amount">₦120,000</text>
          <circle cx="142" cy="22" r="7" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M139 22 L141 24.5 L145.5 19" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 2: Amina B. -->
        <g class="student-card active-card-2" transform="translate(540, 100)">
          <rect width="160" height="52" rx="10" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="22" cy="22" r="10" fill="var(--color-brand-soft)" />
          <text x="22" y="26" text-anchor="middle" class="avatar-text">A</text>
          <text x="40" y="18" class="student-name">Amina B.</text>
          <text x="40" y="30" class="student-class">8B · JSS 2</text>
          <text x="40" y="42" class="student-amount">₦95,000</text>
          <circle cx="142" cy="22" r="7" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M139 22 L141 24.5 L145.5 19" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 3: Chidi K. -->
        <g class="student-card active-card-3" transform="translate(540, 160)">
          <rect width="160" height="52" rx="10" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="22" cy="22" r="10" fill="var(--color-brand-soft)" />
          <text x="22" y="26" text-anchor="middle" class="avatar-text">C</text>
          <text x="40" y="18" class="student-name">Chidi K.</text>
          <text x="40" y="30" class="student-class">11C · SS 1</text>
          <text x="40" y="42" class="student-amount">₦120,000</text>
          <circle cx="142" cy="22" r="7" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M139 22 L141 24.5 L145.5 19" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 4: Zainab S. -->
        <g class="student-card active-card-4" transform="translate(540, 220)">
          <rect width="160" height="52" rx="10" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="22" cy="22" r="10" fill="var(--color-brand-soft)" />
          <text x="22" y="26" text-anchor="middle" class="avatar-text">Z</text>
          <text x="40" y="18" class="student-name">Zainab S.</text>
          <text x="40" y="30" class="student-class">9A · JSS 3</text>
          <text x="40" y="42" class="student-amount">₦75,000</text>
          <circle cx="142" cy="22" r="7" fill="var(--color-success-soft)" class="check-bg" />
          <path d="M139 22 L141 24.5 L145.5 19" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>
      </g>

      <!-- ====== LAYER 5: CONNECTIONS TO STUDENT ACCOUNTS ====== -->
      <g class="account-connections">
        <path d="M 440 100 C 480 100, 520 80, 540 66" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" opacity="0.3" class="account-path" />
        <path d="M 440 100 C 480 100, 520 120, 540 126" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" opacity="0.3" class="account-path" />
        <path d="M 440 100 C 480 100, 520 170, 540 186" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" opacity="0.3" class="account-path" />
        <path d="M 440 100 C 480 100, 520 230, 540 246" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" opacity="0.3" class="account-path" />
      </g>

      <!-- ====== LAYER 6: RECENT TRANSACTIONS PANEL ====== -->
      <g class="transaction-panel">
        <rect x="710" y="40" width="170" height="340" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1.5" />

        <!-- Panel header -->
        <text x="795" y="68" text-anchor="middle" class="panel-header">Recent Transactions</text>
        <text x="865" y="68" class="panel-link">View all →</text>

        <!-- Header underline -->
        <line x1="725" y1="76" x2="865" y2="76" stroke="var(--color-divider)" stroke-width="1" />

        <!-- Column headers -->
        <text x="730" y="92" class="tx-col-header">Student</text>
        <text x="800" y="92" class="tx-col-header">Fee Type</text>
        <text x="860" y="92" class="tx-col-header">Amount</text>

        <!-- Row 1: Tunde A. -->
        <g class="transaction-row row-1">
          <circle cx="732" cy="112" r="5" fill="var(--color-brand-soft)" />
          <text x="744" y="115" class="tx-name">Tunde A.</text>
          <text x="800" y="115" class="tx-fee">School Fees · Term 1</text>
          <text x="860" y="115" class="tx-amount">₦120,000</text>
          <text x="860" y="130" class="tx-time">Just now</text>
        </g>

        <!-- Row 2: Amina B. -->
        <g class="transaction-row row-2">
          <circle cx="732" cy="142" r="5" fill="var(--color-brand-soft)" />
          <text x="744" y="145" class="tx-name">Amina B.</text>
          <text x="800" y="145" class="tx-fee">School Fees · Term 1</text>
          <text x="860" y="145" class="tx-amount">₦95,000</text>
          <text x="860" y="160" class="tx-time">12 mins ago</text>
        </g>

        <!-- Row 3: Chidi K. -->
        <g class="transaction-row row-3">
          <circle cx="732" cy="172" r="5" fill="var(--color-brand-soft)" />
          <text x="744" y="175" class="tx-name">Chidi K.</text>
          <text x="800" y="175" class="tx-fee">School Fees · Term 1</text>
          <text x="860" y="175" class="tx-amount">₦120,000</text>
          <text x="860" y="190" class="tx-time">1 hour ago</text>
        </g>

        <!-- Row 4: Zainab S. -->
        <g class="transaction-row row-4">
          <circle cx="732" cy="202" r="5" fill="var(--color-brand-soft)" />
          <text x="744" y="205" class="tx-name">Zainab S.</text>
          <text x="800" y="205" class="tx-fee">School Fees · Term 1</text>
          <text x="860" y="205" class="tx-amount">₦75,000</text>
          <text x="860" y="220" class="tx-time">2 hours ago</text>
        </g>

        <!-- Divider -->
        <line x1="725" y1="240" x2="865" y2="240" stroke="var(--color-divider)" stroke-width="1" />

        <!-- Reconciliation state -->
        <g class="reconciliation-state">
          <circle cx="735" cy="258" r="6" fill="var(--color-success-soft)" />
          <path d="M732.5 258 L735 261 L737.5 257" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="recon-check" />
          <text x="748" y="261" class="recon-text">All payments verified</text>
          <text x="748" y="274" class="recon-subtext">No manual checks. No missing payments.</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.capflux-payment-flow {
  --cycle-duration: 6s;
  --payment-duration: 1.8s;
  --verification-duration: 0.25s;
  --card-highlight-duration: 0.3s;
  --easing: cubic-bezier(0.22, 1, 0.36, 1);
  --brand: var(--color-brand);
  --brand-soft: var(--color-brand-soft);
  --success: var(--color-success);
  --success-soft: var(--color-success-soft);
  --card: var(--color-card);
  --border: var(--color-border);
  --divider: var(--color-divider);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --text-muted: var(--color-text-muted);
}

.payment-flow-svg {
  width: 100%;
  height: auto;
  max-width: 900px;
  display: block;
}

/* ====== TYPOGRAPHY ====== */
.label-school {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.text-amount {
  font-size: 13px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-mono);
}

.text-muted-small {
  font-size: 8px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.capflux-mark {
  font-size: 22px;
  font-weight: 800;
  fill: var(--brand);
  font-family: var(--font-family-sans);
  letter-spacing: -0.5px;
}

.capflux-label {
  font-size: 8px;
  font-weight: 600;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
  letter-spacing: 0.5px;
}

.student-name {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.student-class {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.student-amount {
  font-size: 9px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-mono);
}

.avatar-text {
  font-size: 8px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-sans);
}

.verification-text {
  font-size: 9px;
  font-weight: 600;
  fill: var(--success);
  font-family: var(--font-family-sans);
}

.verification-subtext {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.processing-title {
  font-size: 9px;
  font-weight: 700;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
  letter-spacing: 0.3px;
}

.processing-subtitle {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.processing-arrow {
  font-size: 10px;
  fill: var(--brand);
  font-family: var(--font-family-sans);
}

.panel-header {
  font-size: 10px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.panel-link {
  font-size: 8px;
  fill: var(--brand);
  font-family: var(--font-family-sans);
}

.tx-col-header {
  font-size: 7px;
  font-weight: 600;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tx-name {
  font-size: 8px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.tx-fee {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.tx-amount {
  font-size: 8px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-mono);
}

.tx-time {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.recon-text {
  font-size: 8px;
  font-weight: 600;
  fill: var(--success);
  font-family: var(--font-family-sans);
}

.recon-subtext {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

/* ====== ANIMATIONS ====== */

/* CAPFLUX core ring pulse */
.capflux-core-ring {
  animation: ring-pulse var(--cycle-duration) var(--easing) infinite;
  transform-origin: 65px 65px;
}

.capflux-core-ring-inner {
  animation: ring-pulse-inner var(--cycle-duration) var(--easing) infinite;
  transform-origin: 65px 65px;
}

@keyframes ring-pulse {
  0%, 40%, 100% { opacity: 0.15; transform: scale(1); }
  50%, 60% { opacity: 0.35; transform: scale(1.04); }
}

@keyframes ring-pulse-inner {
  0%, 40%, 100% { opacity: 0.1; transform: scale(1); }
  50%, 60% { opacity: 0.2; transform: scale(1.03); }
}

/* CAPFLUX pulse burst */
.capflux-pulse {
  animation: core-activate var(--cycle-duration) var(--easing) infinite;
  transform-origin: 65px 65px;
}

@keyframes core-activate {
  0%, 42%, 100% { opacity: 0; r: 40; }
  48% { opacity: 0.4; r: 44; }
  55% { opacity: 0; r: 48; }
}

/* Verification badge */
.verification-badge {
  animation: verification-in var(--cycle-duration) var(--easing) infinite;
}

@keyframes verification-in {
  0%, 48%, 100% { opacity: 0; transform: translate(420px, 10px) scale(0.85); }
  52%, 90% { opacity: 1; transform: translate(420px, 10px) scale(1); }
}

.verification-check {
  animation: check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 10;
  stroke-dashoffset: 10;
}

@keyframes check-draw {
  0%, 50%, 100% { stroke-dashoffset: 10; }
  54%, 88% { stroke-dashoffset: 0; }
}

/* Connection path flow */
.connection-path {
  animation: path-flow var(--cycle-duration) linear infinite;
}

@keyframes path-flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -18; }
}

/* Account paths subtle animation */
.account-path {
  animation: account-flow var(--cycle-duration) linear infinite;
}

@keyframes account-flow {
  0% { stroke-dashoffset: 0; opacity: 0.3; }
  50% { opacity: 0.5; }
  100% { stroke-dashoffset: -14; opacity: 0.3; }
}

/* Student card highlight sequence */
.student-card {
  animation: card-highlight var(--cycle-duration) var(--easing) infinite;
}

.active-card-1 { animation-delay: 0s; }
.active-card-2 { animation-delay: calc(var(--cycle-duration) * 0.2); }
.active-card-3 { animation-delay: calc(var(--cycle-duration) * 0.4); }
.active-card-4 { animation-delay: calc(var(--cycle-duration) * 0.6); }

@keyframes card-highlight {
  0%, 55%, 100% { transform: translateY(0); }
  60%, 70% { transform: translateY(-2px); }
}

.active-card-1 .card-border { animation: border-emphasis 6s var(--easing) infinite; }
.active-card-2 .card-border { animation: border-emphasis 6s var(--easing) infinite; animation-delay: 1.2s; }
.active-card-3 .card-border { animation: border-emphasis 6s var(--easing) infinite; animation-delay: 2.4s; }
.active-card-4 .card-border { animation: border-emphasis 6s var(--easing) infinite; animation-delay: 3.6s; }

@keyframes border-emphasis {
  0%, 55%, 100% { stroke: var(--border); stroke-width: 1; }
  60%, 70% { stroke: var(--brand); stroke-width: 2; }
}

/* Transaction row highlight */
.transaction-row {
  animation: tx-highlight var(--cycle-duration) var(--easing) infinite;
}

.row-1 { animation-delay: 0s; }
.row-2 { animation-delay: calc(var(--cycle-duration) * 0.2); }
.row-3 { animation-delay: calc(var(--cycle-duration) * 0.4); }
.row-4 { animation-delay: calc(var(--cycle-duration) * 0.6); }

@keyframes tx-highlight {
  0%, 55%, 100% { opacity: 1; }
  60%, 70% { opacity: 1; }
}

/* Reconciliation state */
.reconciliation-state {
  animation: recon-in var(--cycle-duration) var(--easing) infinite;
}

.recon-check {
  animation: recon-check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 8;
  stroke-dashoffset: 8;
}

@keyframes recon-in {
  0%, 52%, 100% { opacity: 0; }
  56%, 90% { opacity: 1; }
}

@keyframes recon-check-draw {
  0%, 54%, 100% { stroke-dashoffset: 8; }
  58%, 88% { stroke-dashoffset: 0; }
}

/* ====== REDUCED MOTION ====== */
.reduced-motion .payment-particle,
.reduced-motion .capflux-core-ring,
.reduced-motion .capflux-core-ring-inner,
.reduced-motion .capflux-pulse,
.reduced-motion .verification-badge,
.reduced-motion .verification-check,
.reduced-motion .connection-path,
.reduced-motion .account-path,
.reduced-motion .student-card,
.reduced-motion .card-border,
.reduced-motion .transaction-row,
.reduced-motion .reconciliation-state,
.reduced-motion .recon-check {
  animation: none !important;
}

.reduced-motion .verification-badge {
  opacity: 1;
}

.reduced-motion .verification-check {
  stroke-dashoffset: 0;
}

.reduced-motion .payment-particle {
  opacity: 0;
}

.reduced-motion .card-border {
  stroke: var(--border) !important;
  stroke-width: 1 !important;
}

/* ====== RESPONSIVE ====== */
@media (max-width: 1024px) {
  .payment-flow-svg {
    max-width: 700px;
  }
}

@media (max-width: 768px) {
  .capflux-payment-flow {
    max-width: 420px;
    margin: 0 auto;
  }

  .payment-flow-svg {
    max-width: 420px;
  }

  /* Hide last student card on mobile */
  .student-card:nth-child(4) {
    display: none;
  }

  /* Hide transaction panel on mobile */
  .transaction-panel {
    display: none;
  }

  /* Hide account connections on mobile */
  .account-connections {
    display: none;
  }
}

@media (max-width: 430px) {
  .capflux-payment-flow {
    max-width: 350px;
  }

  .payment-flow-svg {
    max-width: 350px;
  }

  .student-card:nth-child(3) {
    display: none;
  }
}
</style>
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import capfluxLogo from '../../assets/capflux-logo.png';

/**
 * CapfluxPaymentFlow — Payment infrastructure visualization.
 * Matches the approved visual concept exactly.
 *
 * Animation cycle (6s total):
 * 0.0s  Complete static system visible
 * 0.8s  Payment particle appears at School Payment
 * 1.0s  Particle travels along payment route
 * 2.0s  Particle reaches CAPFLUX
 * 2.0s  CAPFLUX core pulses
 * 2.2s  Payment Verified activates
 * 2.4s  Student account highlights
 * 2.6s  Transaction highlights
 * 3.0s  System remains visible
 * 4.0s  Pause, then repeat
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
      viewBox="0 0 720 480"
      class="payment-flow-svg"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.08)" />
        </filter>

        <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.6" />
        </linearGradient>

        <radialGradient id="particle-gradient">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.3" />
        </radialGradient>

        <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-card)" />
          <stop offset="100%" stop-color="var(--color-sidebar)" />
        </linearGradient>
      </defs>

      <!-- ====== SCHOOL PAYMENT ====== -->
      <g class="school-payment" filter="url(#card-shadow)">
        <rect x="0" y="50" width="180" height="140" rx="14" fill="url(#card-bg)" stroke="var(--color-border)" stroke-width="1.5" />
        <rect x="0" y="50" width="180" height="36" rx="14" fill="var(--color-brand-soft)" />
        <rect x="0" y="72" width="180" height="14" fill="var(--color-brand-soft)" />

        <!-- School building illustration -->
        <g transform="translate(55, 92)">
          <rect x="15" y="28" width="40" height="30" rx="3" fill="var(--color-brand)" opacity="0.15" stroke="var(--color-brand)" stroke-width="1.2" />
          <path d="M35 4 L60 28 L10 28 Z" fill="var(--color-brand)" opacity="0.5" />
          <rect x="28" y="40" width="14" height="18" rx="2" fill="var(--color-brand)" opacity="0.3" />
          <rect x="18" y="34" width="8" height="8" rx="1" fill="var(--color-brand)" opacity="0.25" />
          <rect x="44" y="34" width="8" height="8" rx="1" fill="var(--color-brand)" opacity="0.25" />
        </g>

        <text x="90" y="152" text-anchor="middle" class="label-school">School Payment</text>
        <text x="90" y="172" text-anchor="middle" class="text-amount">₦120,000</text>
      </g>

      <text x="90" y="210" text-anchor="middle" class="text-muted">Parents pay school fees</text>
      <text x="90" y="226" text-anchor="middle" class="text-muted-small">Via bank transfer, card or USSD</text>

      <!-- ====== PAYMENT ROUTE ====== -->
      <g class="payment-route">
        <path
          d="M 180 120 C 220 120, 240 120, 270 120"
          stroke="url(#path-gradient)"
          stroke-width="2"
          stroke-dasharray="6 4"
          class="connection-path"
        />
        <circle cx="180" cy="120" r="4" fill="var(--color-brand)" opacity="0.5" />
        <circle cx="270" cy="120" r="4" fill="var(--color-brand)" opacity="0.5" />

        <!-- Animated payment particle -->
        <circle r="6" fill="url(#particle-gradient)" class="payment-particle" filter="url(#core-glow)">
          <animateMotion
            dur="1.2s"
            repeatCount="indefinite"
            begin="0.8s"
            calcMode="spline"
            keySplines="0.22 1 0.36 1"
            keyPoints="0;0;1;1;0;0"
            keyTimes="0;0.05;0.5;0.55;0.95;1"
            path="M 180 120 C 220 120, 240 120, 270 120"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0;0"
            keyTimes="0;0.08;0.45;0.55;0.85;1"
            dur="1.2s"
            repeatCount="indefinite"
            begin="0.8s"
          />
        </circle>
      </g>

      <!-- ====== CAPFLUX CORE ====== -->
      <g class="capflux-core">
        <!-- Outer pulse rings -->
        <circle cx="330" cy="120" r="72" fill="none" stroke="var(--color-brand)" stroke-width="1.5" opacity="0.12" class="core-ring-outer" />
        <circle cx="330" cy="120" r="62" fill="none" stroke="var(--color-brand)" stroke-width="1" opacity="0.08" class="core-ring-inner" />

        <!-- Core background -->
        <circle cx="330" cy="120" r="52" fill="var(--color-card)" stroke="var(--color-brand)" stroke-width="2.5" class="core-bg" />

        <!-- CAPFLUX geometric logo -->
        <image :href="capfluxLogo" x="298" y="88" width="64" height="64" class="core-logo" />

        <!-- Pulse burst -->
        <circle cx="330" cy="120" r="52" fill="none" stroke="var(--color-brand)" stroke-width="2" class="capflux-pulse" opacity="0" />
      </g>

      <!-- ====== VERIFICATION BADGE ====== -->
      <g class="verification-badge">
        <rect x="270" y="18" width="150" height="40" rx="20" fill="var(--color-card)" stroke="var(--color-success)" stroke-width="1.5" />
        <circle cx="296" cy="38" r="12" fill="var(--color-success-soft)" />
        <path d="M291 38 L294.5 41.5 L302 34" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="verification-check" />
        <text x="314" y="35" class="verification-text">Payment Verified</text>
        <text x="314" y="50" class="verification-subtext">in seconds</text>
      </g>

      <!-- CAPFLUX label -->
      <text x="330" y="208" text-anchor="middle" class="capflux-label-text">CAPFLUX</text>
      <text x="330" y="226" text-anchor="middle" class="capflux-subtext">Verifies, allocates and</text>
      <text x="330" y="240" text-anchor="middle" class="capflux-subtext">reconciles automatically</text>

      <!-- Down arrow from CAPFLUX -->
      <path d="M330 250 L330 270" stroke="var(--color-brand)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.4" />
      <path d="M325 266 L330 274 L335 266" fill="var(--color-brand)" opacity="0.4" />

      <!-- ====== STUDENT ACCOUNTS ====== -->
      <g class="student-accounts">
        <text x="490" y="22" text-anchor="middle" class="section-label">Individual Student Accounts</text>
        <text x="490" y="38" text-anchor="middle" class="section-sublabel">Each student gets a dedicated bank account</text>

        <!-- Card 1: Tunde A. -->
        <g class="student-card active-card-1" filter="url(#card-shadow)">
          <rect x="405" y="52" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-brand)" stroke-width="1.5" class="card-border" />
          <circle cx="432" cy="81" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="86" text-anchor="middle" class="avatar-text">T</text>
          <text x="456" y="72" class="student-name">Tunde A.</text>
          <text x="456" y="86" class="student-class">10A · JSS 1</text>
          <text x="456" y="100" class="student-amount">₦120,000</text>
          <circle cx="562" cy="81" r="10" fill="var(--color-success-soft)" />
          <path d="M558 81 L561 84 L567 77" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 2: Amina B. -->
        <g class="student-card active-card-2" filter="url(#card-shadow)">
          <rect x="405" y="120" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="432" cy="149" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="154" text-anchor="middle" class="avatar-text">A</text>
          <text x="456" y="140" class="student-name">Amina B.</text>
          <text x="456" y="154" class="student-class">8B · JSS 2</text>
          <text x="456" y="168" class="student-amount">₦95,000</text>
          <circle cx="562" cy="149" r="10" fill="var(--color-success-soft)" />
          <path d="M558 149 L561 152 L567 145" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 3: Chidi K. -->
        <g class="student-card active-card-3" filter="url(#card-shadow)">
          <rect x="405" y="188" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="432" cy="217" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="222" text-anchor="middle" class="avatar-text">C</text>
          <text x="456" y="208" class="student-name">Chidi K.</text>
          <text x="456" y="222" class="student-class">11C · SS 1</text>
          <text x="456" y="236" class="student-amount">₦120,000</text>
          <circle cx="562" cy="217" r="10" fill="var(--color-success-soft)" />
          <path d="M558 217 L561 220 L567 213" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 4: Zainab S. -->
        <g class="student-card active-card-4" filter="url(#card-shadow)">
          <rect x="405" y="256" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="432" cy="285" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="290" text-anchor="middle" class="avatar-text">Z</text>
          <text x="456" y="276" class="student-name">Zainab S.</text>
          <text x="456" y="290" class="student-class">9A · JSS 3</text>
          <text x="456" y="304" class="student-amount">₦75,000</text>
          <circle cx="562" cy="285" r="10" fill="var(--color-success-soft)" />
          <path d="M558 285 L561 288 L567 281" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>
      </g>

      <!-- ====== CONNECTIONS TO STUDENTS ====== -->
      <g class="student-connections" opacity="0.35">
        <path d="M 382 120 C 400 120, 405 81, 405 81" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
        <path d="M 382 120 C 400 120, 405 149, 405 149" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
        <path d="M 382 120 C 400 120, 405 217, 405 217" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
        <path d="M 382 120 C 400 120, 405 285, 405 285" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
      </g>

      <!-- ====== RECENT TRANSACTIONS PANEL ====== -->
      <g class="transaction-panel" filter="url(#card-shadow)">
        <rect x="600" y="10" width="115" height="310" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" />
        <text x="657" y="34" text-anchor="middle" class="panel-header">Recent Transactions</text>
        <line x1="612" y1="42" x2="702" y2="42" stroke="var(--color-divider)" stroke-width="0.5" />

        <!-- Row 1 -->
        <g class="transaction-row row-1">
          <circle cx="618" cy="62" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="65" class="tx-name">Tunde A.</text>
          <text x="695" y="65" text-anchor="end" class="tx-amount">₦120k</text>
          <text x="695" y="77" text-anchor="end" class="tx-time">Just now</text>
        </g>

        <!-- Row 2 -->
        <g class="transaction-row row-2">
          <circle cx="618" cy="100" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="103" class="tx-name">Amina B.</text>
          <text x="695" y="103" text-anchor="end" class="tx-amount">₦95k</text>
          <text x="695" y="115" text-anchor="end" class="tx-time">12 mins ago</text>
        </g>

        <!-- Row 3 -->
        <g class="transaction-row row-3">
          <circle cx="618" cy="138" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="141" class="tx-name">Chidi K.</text>
          <text x="695" y="141" text-anchor="end" class="tx-amount">₦120k</text>
          <text x="695" y="153" text-anchor="end" class="tx-time">1 hour ago</text>
        </g>

        <!-- Row 4 -->
        <g class="transaction-row row-4">
          <circle cx="618" cy="176" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="179" class="tx-name">Zainab S.</text>
          <text x="695" y="179" text-anchor="end" class="tx-amount">₦75k</text>
          <text x="695" y="191" text-anchor="end" class="tx-time">2 hours ago</text>
        </g>

        <line x1="612" y1="205" x2="702" y2="205" stroke="var(--color-divider)" stroke-width="0.5" />

        <!-- Reconciliation state -->
        <g class="reconciliation-state">
          <circle cx="620" cy="228" r="8" fill="var(--color-success-soft)" />
          <path d="M617 228 L619.5 231 L624 225" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="recon-check" />
          <text x="634" y="231" class="recon-text">All payments verified</text>
          <text x="634" y="245" class="recon-subtext">No manual checks. No missing payments.</text>
        </g>
      </g>

    </svg>
  </div>
</template>

<style scoped>
.capflux-payment-flow {
  --cycle-duration: 6s;
  --payment-duration: 1.2s;
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
  max-width: 720px;
  display: block;
}

/* ====== TYPOGRAPHY ====== */
.label-school {
  font-size: 13px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.text-amount {
  font-size: 16px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-mono);
}

.text-muted {
  font-size: 10px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.text-muted-small {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.verification-text {
  font-size: 11px;
  font-weight: 600;
  fill: var(--success);
  font-family: var(--font-family-sans);
}

.verification-subtext {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.capflux-label-text {
  font-size: 13px;
  font-weight: 700;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
  letter-spacing: 0.5px;
}

.capflux-subtext {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
}

.section-sublabel {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.student-name {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.student-class {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.student-amount {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-mono);
}

.avatar-text {
  font-size: 11px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-sans);
}

.panel-header {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.tx-name {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.tx-amount {
  font-size: 9px;
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
  font-size: 9px;
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
.core-ring-outer {
  animation: ring-pulse var(--cycle-duration) var(--easing) infinite;
  transform-origin: 330px 120px;
}

.core-ring-inner {
  animation: ring-pulse-inner var(--cycle-duration) var(--easing) infinite;
  transform-origin: 330px 120px;
}

@keyframes ring-pulse {
  0%, 40%, 100% { opacity: 0.12; transform: scale(1); }
  50%, 60% { opacity: 0.25; transform: scale(1.04); }
}

@keyframes ring-pulse-inner {
  0%, 40%, 100% { opacity: 0.08; transform: scale(1); }
  50%, 60% { opacity: 0.15; transform: scale(1.03); }
}

/* CAPFLUX pulse burst */
.capflux-pulse {
  animation: core-activate var(--cycle-duration) var(--easing) infinite;
  transform-origin: 330px 120px;
}

@keyframes core-activate {
  0%, 42%, 100% { opacity: 0; r: 52; }
  48% { opacity: 0.35; r: 58; }
  55% { opacity: 0; r: 68; }
}

/* Verification badge */
.verification-badge {
  animation: verification-in var(--cycle-duration) var(--easing) infinite;
}

@keyframes verification-in {
  0%, 48%, 100% { opacity: 0; transform: translateY(6px); }
  54%, 92% { opacity: 1; transform: translateY(0); }
}

.verification-check {
  animation: check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 14;
  stroke-dashoffset: 14;
}

@keyframes check-draw {
  0%, 52%, 100% { stroke-dashoffset: 14; }
  58%, 90% { stroke-dashoffset: 0; }
}

/* Connection path flow */
.connection-path {
  animation: path-flow var(--cycle-duration) linear infinite;
}

@keyframes path-flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -20; }
}

/* Account paths */
.account-path {
  animation: account-flow var(--cycle-duration) linear infinite;
}

@keyframes account-flow {
  0% { stroke-dashoffset: 0; opacity: 0.35; }
  50% { opacity: 0.55; }
  100% { stroke-dashoffset: -14; opacity: 0.35; }
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
  60%, 70% { opacity: 0.7; }
}

/* Reconciliation state */
.reconciliation-state {
  animation: recon-in var(--cycle-duration) var(--easing) infinite;
}

.recon-check {
  animation: recon-check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 10;
  stroke-dashoffset: 10;
}

@keyframes recon-in {
  0%, 54%, 100% { opacity: 0; }
  58%, 92% { opacity: 1; }
}

@keyframes recon-check-draw {
  0%, 56%, 100% { stroke-dashoffset: 10; }
  60%, 90% { stroke-dashoffset: 0; }
}

/* ====== REDUCED MOTION ====== */
.reduced-motion .payment-particle,
.reduced-motion .core-ring-outer,
.reduced-motion .core-ring-inner,
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

.reduced-motion .reconciliation-state {
  opacity: 1;
}

.reduced-motion .recon-check {
  stroke-dashoffset: 0;
}

/* ====== RESPONSIVE ====== */
@media (max-width: 1024px) {
  .payment-flow-svg {
    max-width: 600px;
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

  .student-card:nth-child(4) {
    display: none;
  }

  .transaction-panel {
    display: none;
  }

  .student-connections {
    display: none;
  }
}

@media (max-width: 430px) {
  .capflux-payment-flow {
    max-width: 340px;
  }

  .payment-flow-svg {
    max-width: 340px;
  }

  .student-card:nth-child(3) {
    display: none;
  }
}
</style>

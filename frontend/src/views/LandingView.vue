<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import LandingNav from '../components/landing/LandingNav.vue';
import FinancialNetwork from '../components/landing/FinancialNetwork.vue';
import PaymentPipeline from '../components/landing/PaymentPipeline.vue';
import OfflineDemo from '../components/landing/OfflineDemo.vue';
import FeatureCard from '../components/landing/FeatureCard.vue';
import CmBadge from '../components/ui/CmBadge.vue';
import CmButton from '../components/ui/CmButton.vue';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const isAuthenticated = computed(() => authStore.isAuthenticated);

// Section visibility for animations
const visibleSections = ref<Record<string, boolean>>({});

// Feature icons (simplified inline SVG paths)
const featureIcons = {
  accounts: 'M3 10h18M7 15h1m4 0h1m4 0h1M3 7h18c.552 0 1 .448 1 1s-.448 1-1 1H3c-.552 0-1-.448-1-1s0.448-1 1-1z',
  reconciliation: 'M9 5l7 7-7 7',
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0h6',
  guardians: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  offline: 'M4 4v5h5M19 20v-5h-5M4 20L20 4',
  verification: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  receipts: 'M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  tracking: 'M9 19v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5m12-12V7a2 2 0 012-2h2a2 2 0 012-2v10a2 2 0 01-2 2H9a2 2 0 01-2-2z',
  audit: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

// Trust features for hero badges
const trustFeatures = [
  { id: 'offline', title: 'Zero Setup Fee' },
  { id: 'accounts', title: 'Dedicated Virtual Account (DVA) per Student' },
  { id: 'reconciliation', title: 'Automatic Payment Verification' },
  { id: 'verification', title: 'Built for Nigerian Private Schools (Offline-First Ready)' },
];

// Target segments for hero trust bar
const targetSegments = [
  'Nursery & Primary Schools',
  'Secondary Schools',
  'Faith-Based Institutions',
  'Private Academies',
];

// Problem section comparison ("The Old Way" vs "The CAPFLUX Way")
const oldWayPainPoints = [
  'Payment screenshots scattered across WhatsApp groups',
  'Fake alerts and unverified receipts treated as proof of payment',
  'Hours spent auditing bank statements against ledger books',
  'Misallocated payments and endless dispute resolution',
  'Records that go missing when staff or systems change',
];

const capfluxWayPoints = [
  'Every student pays into their own Dedicated Virtual Account',
  'Payments verified automatically through the banking system',
  'Balances, receipts and ledgers update in real time',
  'Zero manual reconciliation — no screenshots, no guesswork',
  'Immutable audit records that never go missing',
];

// Founder's Story Block (trust element)
const founderStory = {
  quote: 'My parents owned Fairwell Academy. I saw firsthand how manual reconciliation, unverified receipts, and missing records slowly eroded our financial stability... We built CAPFLUX to be the financial bedrock that protects private schools.',
  name: 'Philips Douglas',
  role: 'Founder & Lead Engineer',
};

// Pricing zero-cost anchors
const zeroCostAnchors = [
  { label: 'Setup' },
  { label: 'Onboarding' },
  { label: 'License fees' },
];

// Pilot program perk cards
const pilotPerks = [
  {
    icon: 'M9.813 15.904L9.5 18l-.313-2.096a4 4 0 00-2.091-2.09L5 13.5l2.096-.313a4 4 0 002.091-2.091L9.5 9l.313 2.096a4 4 0 002.091 2.091L14 13.5l-2.096.313a4 4 0 00-2.091 2.091zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
    title: '1-on-1 Dedicated Onboarding',
    body: 'Our team personally handles your student roster imports, class structures, and account provisioning within 24 hours.',
  },
  {
    icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
    title: 'Direct Product Influence',
    body: 'Work directly with our engineering founders to request custom workflow features tailored to your school\'s exact bursary needs.',
  },
  {
    icon: 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
    title: 'Founding Partner Status',
    body: 'Enjoy priority system routing, early access to new accounting features, and locked-in platform benefits.',
  },
];

// Bento grid data (What You Get With CAPFLUX)
const capabilities = [
  { id: 'accounts', title: 'Dedicated Virtual Accounts', description: 'Every student gets their own payment account. No confusion. No misallocated payments.' },
  { id: 'verification', title: 'Automatic Payment Verification', description: 'Payments are verified through the banking system automatically. No manual checks required.' },
  { id: 'dashboard', title: 'Real-Time Executive Dashboard', description: 'See exactly who has paid and who hasn\'t. Live updates as payments come in.' },
  { id: 'receipts', title: 'Digital Payment Receipts', description: 'Receipts are generated automatically for every transaction. Parents get instant confirmation.' },
  { id: 'tracking', title: 'Automated Balance Tracking', description: 'Know every outstanding balance. Track payment history per student.' },
  { id: 'offline', title: 'Offline-First Synchronisation', description: 'Continue collecting fees during network outages. Syncs automatically when connectivity returns.' },
  { id: 'guardians', title: 'Guardian Multi-Child View', description: 'Parents with multiple children see every balance, receipt and payment in one consolidated view.' },
  { id: 'audit', title: 'Immutable Audit Ledger', description: 'Every financial action is recorded permanently. Full traceability for audits, disputes and compliance.' },
];

// FAQ items (security, DVA operation, parent banking app independence, offline usage, pricing, onboarding timeline)
const faqItems = ref([
  { question: 'Is our school\'s money and data safe?', answer: 'Yes. CAPFLUX handles only payment reconciliation and data. Funds are processed through secure licensed payment gateways and bank transfers. Schools maintain full ownership and control of their accounts — we never hold school funds. All records are encrypted, access-controlled and backed by an immutable audit ledger.', open: false },
  { question: 'What is a Dedicated Virtual Account (DVA) and how does it work?', answer: 'A DVA is a unique bank account number assigned to each student. When a parent pays into that account, the banking system automatically identifies the payer and matches the payment to the correct student. No reference numbers, no screenshots, no manual matching required.', open: false },
  { question: 'Do parents need a specific banking app to pay?', answer: 'No. Parents pay from any Nigerian banking channel they already use — bank transfer, USSD, mobile app, or POS. The DVA works with every bank, so there is nothing new for parents to install or learn.', open: false },
  { question: 'Does CAPFLUX work when the internet goes down?', answer: 'Yes. CAPFLUX is offline-first: attendance, balances, receipts and records keep working during network outages. Everything queues locally and synchronizes automatically when connectivity returns. Only payment processing requires a live connection.', open: false },
  { question: 'How much does CAPFLUX cost?', answer: 'Schools pay ₦0 — no setup fee, no onboarding fee, no licence fee. Parents pay a small, transparent platform levy attached to each fee invoice. That levy covers payment processing, DVA infrastructure, automatic verification and platform maintenance.', open: false },
  { question: 'How long does onboarding take?', answer: 'Under 24 hours. Register your school workspace free of charge, import your students, and Dedicated Virtual Accounts are provisioned automatically. No installation, no hardware, no lengthy implementation projects.', open: false },
]);

const toggleFaq = (index: number) => {
  faqItems.value[index].open = !faqItems.value[index].open;
};

const navigateToAuth = (mode: 'login' | 'signup' = 'login') => {
  router.push({ name: 'Auth', query: { mode } });
};

const navigateToSandboxDemo = () => {
  window.location.href = 'https://capflux-sandbox.vercel.app/auth';
};

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

// Initialize theme on mount
onMounted(() => {
  if (!themeStore.initialized) {
    themeStore.initTheme();
  }
});
</script>

<template>
  <div class="min-h-screen bg-background text-text-primary font-sans antialiased">
    <!-- Navigation -->
    <LandingNav />

    <!-- HERO SECTION -->
    <section class="relative min-h-screen flex items-center justify-center px-6 pt-16">
      <FinancialNetwork class="absolute inset-0 -z-10" />
      
      <div class="mx-auto max-w-4xl text-center">
        <CmBadge
          variant="primary"
          label="Financial Operating System for African Private Schools"
          class="mb-8 mx-auto"
        />

        <h1 class="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-text-primary mb-6">
          School Fee Collection,<br>Finally Without the Stress.
        </h1>

        <p class="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-12">
          Every student receives a Dedicated Virtual Account. Payments are verified automatically through the banking system. Every kobo is accounted for in real time—even when your internet goes down.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <CmButton
            @click="navigateToAuth('signup')"
            variant="primary"
            size="lg"
            class="px-8 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Get Started Free
          </CmButton>
          <CmButton
            @click="navigateToSandboxDemo"
            variant="secondary"
            size="lg"
            class="px-8"
          >
            Try CAPFLUX Demo
          </CmButton>
        </div>

        <div class="mb-12">
          <span class="text-text-secondary">Built by FHILZAB NIG LTD (RC-1656168)</span>
        </div>

        <!-- Hero Bullet Points - Clean badges -->
        <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-16 border-t border-divider">
          <div
            v-for="feature in trustFeatures"
            :key="feature.id"
            class="flex items-center gap-2 text-sm text-text-muted"
          >
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">{{ feature.title }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- TARGET SEGMENT TRUST BAR -->
    <section id="school-spotlight" class="py-16 px-6 border-y border-divider bg-sidebar/50">
      <div class="mx-auto max-w-6xl">
        <p class="text-center text-sm uppercase tracking-wider text-text-muted mb-8">Built for Nigerian private schools</p>
        <div class="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <span
            v-for="segment in targetSegments"
            :key="segment"
            class="text-2xl font-bold text-text-secondary"
          >{{ segment }}</span>
        </div>
      </div>
    </section>

    <!-- PROBLEM & AGITATION SECTION -->
    <section id="problem" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Fee collection shouldn't feel like a second job.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            Every term, school owners and bursars spend hundreds of hours chasing payments, auditing bank statements, and resolving disputes instead of focusing on education.
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-8 items-stretch">
          <!-- The Old Way -->
          <div class="premium-card bg-card p-8">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">The Old Way</h3>
            <ul class="space-y-4">
              <li
                v-for="point in oldWayPainPoints"
                :key="point"
                class="flex items-start gap-3"
              >
                <svg class="h-5 w-5 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span class="text-text-secondary">{{ point }}</span>
              </li>
            </ul>
          </div>

          <!-- The CAPFLUX Way -->
          <div class="premium-card bg-card p-8 border-brand/30">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-brand mb-6">The CAPFLUX Way</h3>
            <ul class="space-y-4">
              <li
                v-for="point in capfluxWayPoints"
                :key="point"
                class="flex items-start gap-3"
              >
                <svg class="h-5 w-5 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-text-primary">{{ point }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- FOUNDER'S STORY BLOCK -->
    <section id="founder-story" class="py-16 px-6">
      <div class="mx-auto max-w-4xl">
        <figure class="bg-zinc-950 rounded-card p-10 md:p-14 shadow-elevated">
          <svg class="h-10 w-10 text-emerald-500 mb-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" />
          </svg>
          <blockquote class="text-xl md:text-2xl font-semibold leading-relaxed text-white mb-8">
            "{{ founderStory.quote }}"
          </blockquote>
          <figcaption class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <span class="text-lg font-bold text-emerald-500">PD</span>
            </div>
            <div>
              <p class="font-bold text-white">{{ founderStory.name }}</p>
              <p class="text-sm text-zinc-400">{{ founderStory.role }}</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- SOLUTION SECTION -->
    <section id="solution" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-6xl text-center">
        <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
          CAPFLUX makes school fee collection automatic.
        </h2>
        <p class="text-lg text-text-secondary max-w-3xl mx-auto mb-16">
          Dedicated virtual accounts. Automatic payment verification. Real-time visibility. Every payment finds its match without human intervention.
        </p>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div
            v-for="(item, index) in ['Dedicated Virtual Account', 'Automatic Verification', 'Real-Time Updates', 'No Manual Reconciliation']"
            :key="item"
            class="opacity-0 animate-fade-in"
            :style="{ animationDelay: `${index * 150}ms` }"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto mb-4">
              <svg class="h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p class="font-semibold text-text-primary">{{ item }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS SECTION -->
    <section id="how-it-works" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Get started in three simple steps.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            Three simple steps. From school registration to automatic fee collection. No complexity. No hidden costs.
          </p>
        </div>
        
        <div class="grid md:grid-cols-3 gap-8 mb-16">
          <div class="text-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto mb-4">
              <span class="text-2xl font-bold text-brand">1</span>
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">Configure Your School Workspace (Free)</h3>
            <p class="text-text-secondary">
              Configure your school. Register your students. No setup costs. No installation. No lengthy onboarding.
            </p>
          </div>
          <div class="text-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto mb-4">
              <span class="text-2xl font-bold text-brand">2</span>
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">Auto-Provision Dedicated Virtual Accounts</h3>
            <p class="text-text-secondary">
              Each student receives a Dedicated Virtual Account. Parents pay using any Nigerian banking channel. Payments are automatically matched.
            </p>
          </div>
          <div class="text-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto mb-4">
              <span class="text-2xl font-bold text-brand">3</span>
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">Watch Payments Reconcile in Real Time</h3>
            <p class="text-text-secondary">
              Balances update instantly. Receipts are generated. Parents receive confirmations. No reconciliation. No disputes.
            </p>
          </div>
        </div>
        
        <PaymentPipeline />
      </div>
    </section>

    <!-- WHY SCHOOLS CHOOSE CAPFLUX SECTION -->
    <section id="why-capflux" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-4xl text-center">
        <blockquote class="text-3xl md:text-4xl font-bold tracking-tight text-text-primary mb-8">
          We don't build school management software.<br>
          We build financial confidence.
        </blockquote>
        
        <p class="text-lg text-text-secondary mb-16">
          Every feature answers one question: Does this help a school collect and understand its revenue more reliably?
        </p>
        
        <!-- CEMDS Manifesto -->
        <div class="grid md:grid-cols-3 gap-8 text-left">
          <div>
            <h3 class="text-2xl font-bold text-brand mb-3">Clarity</h3>
            <p class="text-text-secondary">over Aesthetic.</p>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-brand mb-3">Confidence</h3>
            <p class="text-text-secondary">over Color.</p>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-brand mb-3">Structure</h3>
            <p class="text-text-secondary">over Decoration.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- OFFLINE-FIRST SECTION -->
    <section id="offline-first" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-6xl grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Works when infrastructure doesn't.
          </h2>
          <p class="text-lg text-text-secondary mb-6">
            Internet disconnects? Your school operations don't stop.
          </p>
          <p class="text-sm text-text-muted font-mono">
            Only payment processing requires a live connection.<br>
            Everything else operates continuously offline.
          </p>
        </div>
        
        <OfflineDemo :is-active="true" />
      </div>
    </section>

    <!-- BENTO GRID SECTION (What You Get With CAPFLUX) -->
    <section id="features" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            What you get with CAPFLUX.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            No fabricated metrics. No vanity features. Just raw financial infrastructure purpose-built for Nigerian schools.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            v-for="(capability, index) in capabilities"
            :key="capability.id"
            :icon="featureIcons[capability.id as keyof typeof featureIcons]"
            :title="capability.title"
            :description="capability.description"
            :delay="index * 100"
          />
        </div>
      </div>
    </section>

    <!-- PRICING SECTION -->
    <section id="pricing" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
          Start today without paying for software.
        </h2>
        
        <div class="max-w-3xl mx-auto text-left space-y-10 mb-12">
          <div>
            <p class="text-lg font-semibold text-text-primary mb-6">Schools pay:</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div
                v-for="zero in zeroCostAnchors"
                :key="zero.label"
                class="premium-card bg-card p-6 text-center"
              >
                <p class="text-4xl font-extrabold tracking-tight text-brand mb-1">₦0</p>
                <p class="text-sm font-medium text-text-secondary">{{ zero.label }}</p>
              </div>
            </div>
          </div>

          <div class="text-center">
            <p class="text-lg text-text-secondary">
              Parents pay a small, transparent platform levy attached to the fee invoice — covering payment processing, Dedicated Virtual Account infrastructure, automatic verification and platform maintenance.
            </p>
          </div>
        </div>

        <p class="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary mt-8">
          Simple. Predictable. Risk-Free.
        </p>
      </div>
    </section>

    <!-- PILOT PROGRAM SECTION -->
    <section id="pilot" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="bg-zinc-950 rounded-card px-8 py-16 md:p-20 text-center shadow-elevated">
          <span class="inline-flex items-center text-xs font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Pilot Program • Limited Cohort
          </span>

          <h2 class="text-3xl md:text-4xl font-extrabold tracking-tight text-white mt-4">
            Shape the Future of Fee Management. Join Our Pilot Program.
          </h2>
          <p class="text-zinc-400 text-lg max-w-2xl mx-auto mt-3">
            We are partnering with a limited cohort of progressive private schools in Nigeria. Get white-glove setup support, direct access to our core engineering team, and early access to the CAPFLUX Financial OS.
          </p>

          <div class="mt-12 grid gap-6 text-left md:grid-cols-3">
            <div
              v-for="perk in pilotPerks"
              :key="perk.title"
              class="bg-zinc-900/60 border border-zinc-800 p-6 rounded-xl"
            >
              <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <svg class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="perk.icon" />
                </svg>
              </div>
              <h3 class="font-semibold text-white mb-2">{{ perk.title }}</h3>
              <p class="text-sm leading-relaxed text-zinc-400">{{ perk.body }}</p>
            </div>
          </div>

          <div class="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              @click="navigateToAuth('signup')"
              class="rounded-lg bg-emerald-500 px-6 py-3 font-bold text-zinc-950 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Apply for Pilot Access
            </button>
            <button
              @click="navigateToAuth('signup')"
              class="rounded-lg border border-zinc-700 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Book Founder Call
            </button>
          </div>

          <p class="mt-6 text-sm text-zinc-400">
            🟢 Currently accepting 10 private schools for Term 1 rollout.
          </p>
        </div>
      </div>
    </section>

    <!-- FAQ SECTION -->
    <section id="faq" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-4xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Frequently Asked Questions
          </h2>
        </div>
        
        <div class="space-y-4">
          <div
            v-for="(item, index) in faqItems"
            :key="index"
            class="bg-card border border-border rounded-card overflow-hidden"
          >
            <button
              @click="toggleFaq(index)"
              :aria-expanded="item.open"
              :aria-controls="`faq-answer-${index}`"
              class="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-surface transition-colors focus-ring"
            >
              <span class="font-semibold text-text-primary">{{ item.question }}</span>
              <svg
                class="h-5 w-5 text-text-secondary transition-transform"
                :class="{ 'rotate-180': item.open }"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <transition
              enter-active-class="transition ease-out duration-200"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition ease-in duration-150"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-show="item.open"
                :id="`faq-answer-${index}`"
                class="px-6 pb-4"
              >
                <p class="text-text-secondary">{{ item.answer }}</p>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA SECTION -->
    <section id="demo" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="bg-zinc-950 rounded-card px-8 py-16 md:p-20 text-center shadow-elevated">
          <h2 class="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6">
            Stop Chasing School Fees. Start Managing Them with Confidence.
          </h2>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <CmButton
              @click="navigateToAuth('signup')"
              variant="primary"
              size="lg"
              class="px-8 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Get Started Free Today
            </CmButton>
            <CmButton
              @click="navigateToSandboxDemo"
              variant="secondary"
              size="lg"
              class="px-8"
            >
              Try CAPFLUX Demo
            </CmButton>
          </div>

          <p class="text-sm md:text-base text-zinc-400 mt-10">
            CAPFLUX by FHILZAB NIG LTD — The Financial Operating System for Private Schools in Africa.
          </p>
        </div>
      </div>
    </section>

    <!-- FOOTER SECTION -->
    <footer class="border-t border-divider py-20 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="grid md:grid-cols-4 gap-8 mb-16">
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text-primary mb-4">Product</h3>
            <ul class="space-y-3">
              <li><a href="#features" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Features</a></li>
              <li><a href="#pricing" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Pricing</a></li>
              <li><a href="#faq" class="text-text-secondary hover:text-text-primary transition-colors text-sm">FAQ</a></li>
              <li><CmButton @click="navigateToAuth('login')" variant="link" class="text-sm">Log In</CmButton></li>
            </ul>
          </div>
          
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text-primary mb-4">Resources</h3>
            <ul class="space-y-3">
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Documentation</a></li>
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">API Reference</a></li>
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Support</a></li>
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Status</a></li>
            </ul>
          </div>
          
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text-primary mb-4">Company</h3>
            <ul class="space-y-3">
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">About</a></li>
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Contact</a></li>
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Privacy</a></li>
              <li><a href="#" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Terms</a></li>
            </ul>
          </div>

          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-text-primary mb-4">Connect</h3>
            <div class="flex space-x-4">
              <a href="#" class="text-text-secondary hover:text-brand transition-colors" aria-label="Twitter">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.549-2.447 4.125-7.573 0-9.997C4.125 8.678 8.29 3.751 8.29 20.251z" />
                </svg>
              </a>
              <a href="#" class="text-text-secondary hover:text-brand transition-colors" aria-label="LinkedIn">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.338-5-5-5zm-11 19h-3v-11h3v11zm0-15.5c-1.1 0-2 .9-2 2v2.5h-1v-2.5c0-1.66 1.34-3 3-3v3c0 .55-.45 1-1 1h-3v11h3v-11h2l.5.5v15.5h3v-15.5c0-.55-.45-1-1-1z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Closing statement -->
        <div class="text-center pt-8 border-t border-divider">
          <p class="text-text-muted text-sm">
            CAPFLUX — Africa's School Fee Collection Platform
          </p>
          <p class="mt-2 text-text-muted text-sm">
            A Product by FHILZAB NIG LTD
          </p>
          <p class="mt-4 text-xs text-text-muted">
            © 2025 FHILZAB NIG LTD. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .transition-all,
  .transition-colors {
    animation: none;
    transition: none;
  }
}
</style>
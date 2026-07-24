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
  billing: 'M3 10h18M7 15h1m4 0h1m4 0h1M3 7h18c.552 0 1 .448 1 1s-.448 1-1 1H3c-.552 0-1-.448-1-1s0.448-1 1-1z',
  accounts: 'M3 10h18M7 15h1m4 0h1m4 0h1M3 7h18c.552 0 1 .448 1 1s-.448 1-1 1H3c-.552 0-1-.448-1-1s0.448-1 1-1z',
  reconciliation: 'M9 5l7 7-7 7',
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0h6',
  guardians: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  offline: 'M4 4v5h5M19 20v-5h-5M4 20L20 4',
  reporting: 'M9 19v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5m12-12V7a2 2 0 012-2h2a2 2 0 012-2v10a2 2 0 01-2 2H9a2 2 0 01-2-2z',
  verification: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  receipts: 'M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  tracking: 'M9 19v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5m12-12V7a2 2 0 012-2h2a2 2 0 012-2v10a2 2 0 01-2 2H9a2 2 0 01-2-2z',
  notifications: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
};

// Trust features for hero badges
const trustFeatures = [
  { id: 'offline', title: 'No Setup Fee', description: 'Zero cost to deploy. Schools never pay for software.' },
  { id: 'accounts', title: 'Dedicated Virtual Account for Every Student', description: 'Unique account numbers eliminate payment confusion.' },
  { id: 'reconciliation', title: 'Automatic Payment Verification', description: 'Every payment is verified and matched automatically.' },
  { id: 'verification', title: 'Built for Nigerian Private Schools', description: 'Designed specifically for Nigerian school financial workflows.' },
];

// Feature list for feature grid
const features = [
  { id: 'accounts', title: 'Dedicated Virtual Account for Every Student', description: 'Each student receives a unique account number. Parents pay using any Nigerian banking channel. Payments match themselves.' },
  { id: 'verification', title: 'Automatic Payment Verification', description: 'No screenshots. No fake alerts. Every payment is verified through the banking system and matched to the correct student.' },
  { id: 'dashboard', title: 'Live Collections Dashboard', description: 'Real-time visibility into who has paid, who hasn\'t, and exactly how much revenue your school has collected.' },
  { id: 'tracking', title: 'Outstanding Balance Tracking', description: 'Know every outstanding balance instantly. No more manual spreadsheet tracking or uncertain revenue projections.' },
  { id: 'receipts', title: 'Digital Receipts', description: 'Automatically generated receipts for every payment. Parents receive confirmations. Your records stay complete.' },
  { id: 'notifications', title: 'Guardian Notifications', description: 'Parents receive automatic payment confirmations and balance reminders. Reduce follow-up calls and WhatsApp messages.' },
  { id: 'cloud', title: 'Secure Cloud Records', description: 'Your financial data is encrypted and securely stored. Access your records from anywhere, anytime.' },
  { id: 'offline', title: 'Offline-First Architecture', description: 'Operates without reliable internet. Changes queue locally and sync automatically when connectivity returns.' },
  { id: 'billing', title: 'Zero Setup Cost', description: 'No setup fees. No onboarding fees. No annual licence fees. Deploy your school in minutes at no cost.' },
  { id: 'guardians', title: 'Built for Nigerian Private Schools', description: 'Designed specifically for Nigerian school fee collection workflows. Not a generic ERP forced into education.' },
];

// Capabilities section data (replaces fabricated metrics)
const capabilities = [
  { title: 'Dedicated Virtual Accounts', description: 'Every student gets their own payment account. No confusion. No misallocated payments.' },
  { title: 'Automatic Payment Verification', description: 'Payments are verified through the banking system automatically. No manual checks required.' },
  { title: 'Real-Time Collections Dashboard', description: 'See exactly who has paid and who hasn\'t. Live updates as payments come in.' },
  { title: 'Digital Payment Receipts', description: 'Receipts are generated automatically for every transaction. Parents get instant confirmation.' },
  { title: 'Outstanding Balance Tracking', description: 'Know every outstanding balance. Track payment history per student.' },
  { title: 'Offline-First Operation', description: 'Continue collecting fees during network outages. Syncs automatically when connectivity returns.' },
];

// FAQ items
const faqItems = ref([
  { question: 'Is our school\'s money safe?', answer: 'Yes. CAPFLUX handles only payment reconciliation and data. Funds are processed through secure licensed payment gateways and bank transfers. Schools maintain full ownership and control of their accounts. We never hold school funds.', open: false },
  { question: 'What is a Dedicated Virtual Account?', answer: 'A Dedicated Virtual Account (DVA) is a unique bank account number assigned to each student. When a parent pays into that account, the payment is automatically identified and matched to the correct student. No payment reference numbers needed.', open: false },
  { question: 'How do parents pay?', answer: 'Parents pay directly into their child\'s Dedicated Virtual Account using any Nigerian banking channel — bank transfer, USSD, mobile app, or POS. The payment is automatically verified and matched without any manual work from the school.', open: false },
  { question: 'Who pays the Platform Levy?', answer: 'Parents pay a small transparent CAPFLUX Platform Levy. Schools never pay setup fees, installation fees, onboarding fees, or annual licence fees. The levy covers payment processing, Dedicated Virtual Account infrastructure, automatic verification, and platform maintenance.', open: false },
  { question: 'How are payments verified?', answer: 'When a parent pays into a Dedicated Virtual Account, the payment gateway sends a webhook notification to CAPFLUX. The system automatically matches the payment to the correct student and updates the balance. No manual review required.', open: false },
  { question: 'Does CAPFLUX work with poor internet?', answer: 'Yes. CAPFLUX is built with an offline-first architecture. The application continues working during network outages. All changes queue locally and synchronize automatically when connectivity returns. Only payment processing requires a live connection.', open: false },
  { question: 'How long does implementation take?', answer: 'Most schools are set up within minutes. Register your school, import your students, and each student gets a Dedicated Virtual Account. No installation, no hardware, no lengthy onboarding processes. Deploy in minutes with zero setup cost.', open: false },
]);

const toggleFaq = (index: number) => {
  faqItems.value[index].open = !faqItems.value[index].open;
};

const navigateToAuth = (mode: 'login' | 'signup' = 'login') => {
  router.push({ name: 'Auth', query: { mode } });
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
          label="Africa's School Fee Collection Platform"
          class="mb-8 mx-auto"
        />
        
        <h1 class="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-text-primary mb-6">
          School Fee Collection,<br>Finally Without the Stress.
        </h1>
        
        <p class="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-12">
          Every student gets a dedicated bank account.<br>
          Every payment is verified automatically.<br>
          Every kobo is accounted for.
        </p>
        
        <p class="text-base text-text-secondary max-w-2xl mx-auto mb-8">
          CAPFLUX eliminates manual fee reconciliation, fake payment alerts and endless follow-ups with parents. 
          Deploy your school in minutes with zero setup cost and let fee collection run itself.
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
            @click="navigateToAuth('signup')"
            variant="secondary"
            size="lg"
            class="px-8"
          >
            Book a Live Demo
          </CmButton>
        </div>
        
        <div class="mb-16">
          <span class="text-text-secondary">Already have an account?</span>
          <CmButton
            @click="navigateToAuth('login')"
            variant="link"
          >
            Log In
          </CmButton>
        </div>

        <!-- Feature Highlights - Clean badges -->
        <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-16 border-t border-divider">
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">No Setup Fee</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Dedicated Virtual Account for Every Student</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Automatic Payment Verification</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Built for Nigerian Private Schools</span>
          </div>
        </div>
        
        <!-- Small caption -->
        <p class="mt-8 text-xs text-text-muted">
          A Product by FHILZAB NIG LTD
        </p>
      </div>
    </section>

    <!-- SCHOOL SPOTLIGHT SECTION -->
    <section id="school-spotlight" class="py-16 px-6 border-y border-divider bg-surface/50">
      <div class="mx-auto max-w-6xl">
        <p class="text-center text-sm uppercase tracking-wider text-text-muted mb-8">Built for Nigerian private schools</p>
        <div class="flex flex-wrap items-center justify-center gap-12">
          <span class="text-2xl font-bold text-text-secondary">Nursery & Primary Schools</span>
          <span class="text-2xl font-bold text-text-secondary">Secondary Schools</span>
          <span class="text-2xl font-bold text-text-secondary">Faith-Based Schools</span>
          <span class="text-2xl font-bold text-text-secondary">Private Academies</span>
        </div>
      </div>
    </section>

    <!-- PROBLEM SECTION -->
    <section id="problem" class="py-32 px-6">
      <div class="mx-auto max-w-6xl grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Fee collection should not feel like a second job.
          </h2>
          <p class="text-lg text-text-secondary mb-6">
            Fake payment alerts. Manual reconciliation. Spreadsheet tracking. Cash payments. Uncertainty. Delayed cash flow.
          </p>
          <p class="text-text-secondary">
            Schools waste hundreds of hours monthly chasing payments, verifying transactions against bank statements, and updating ledger books. Every fake alert creates a dispute. Every unmatched payment requires hours of investigation. This is time that should be spent on education, not accounting.
          </p>
        </div>
        
        <div class="relative h-80">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="grid grid-cols-3 gap-4">
              <div
                v-for="i in 6"
                :key="i"
                class="h-20 w-20 rounded-lg border-2 border-border bg-card animate-pulse"
                :style="{ animationDelay: `${i * 100}ms` }"
              ></div>
            </div>
          </div>
        </div>
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
            How CAPFLUX works.
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
            <h3 class="text-xl font-semibold text-text-primary mb-3">Set Up Your School — Free</h3>
            <p class="text-text-secondary">
              Configure your school. Register your students. No setup costs. No installation. No lengthy onboarding.
            </p>
          </div>
          <div class="text-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto mb-4">
              <span class="text-2xl font-bold text-brand">2</span>
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">Every Student Gets Their Own Payment Account</h3>
            <p class="text-text-secondary">
              Each student receives a Dedicated Virtual Account. Parents pay using any Nigerian banking channel. Payments are automatically matched.
            </p>
          </div>
          <div class="text-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 mx-auto mb-4">
              <span class="text-2xl font-bold text-brand">3</span>
            </div>
            <h3 class="text-xl font-semibold text-text-primary mb-3">Watch Payments Update Automatically</h3>
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

    <!-- FEATURE GRID SECTION -->
    <section id="features" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Everything you need to collect school fees.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            CAPFLUX is purpose-built for school fee collection. Every feature earns its place by making fee collection simpler, faster, or more reliable.
          </p>
        </div>
        
        <div class="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <FeatureCard
            v-for="(feature, index) in features"
            :key="feature.id"
            :icon="featureIcons[feature.id as keyof typeof featureIcons]"
            :title="feature.title"
            :description="feature.description"
            :delay="index * 100"
          />
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
            Internet disconnects? The application continues. Changes queue locally. When connectivity returns, synchronization happens automatically.
          </p>
          <p class="text-sm text-text-muted font-mono">
            Only payment processing requires a live connection.<br>
            Everything else works offline.
          </p>
        </div>
        
        <OfflineDemo :is-active="true" />
      </div>
    </section>

    <!-- CAPABILITIES SECTION (replaces fabricated metrics) -->
    <section id="capabilities" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            What you get with CAPFLUX.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            No fabricated statistics. No inflated numbers. Just real capabilities that work for Nigerian private schools.
          </p>
        </div>
        
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(capability, index) in capabilities"
            :key="index"
            class="premium-card bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            :style="{ animationDelay: `${index * 100}ms` }"
          >
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 mb-4">
              <svg class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-text-primary mb-2">{{ capability.title }}</h3>
            <p class="text-sm text-text-secondary">{{ capability.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- PRICING SECTION -->
    <section id="pricing" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
          Start today without paying for software.
        </h2>
        
        <div class="max-w-2xl mx-auto text-left space-y-6 mb-12">
          <p class="text-lg text-text-secondary">
            Schools never pay:
          </p>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Setup fees</span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Onboarding fees</span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Installation fees</span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-success flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Annual licence fees</span>
            </li>
          </ul>
          
          <p class="text-lg text-text-secondary pt-4">
            Instead, parents pay a small transparent CAPFLUX Platform Levy. The levy covers:
          </p>
          <ul class="space-y-3">
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Payment processing</span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Dedicated Virtual Accounts</span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Automatic payment verification</span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="h-6 w-6 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-text-secondary">Platform maintenance and continuous improvements</span>
            </li>
          </ul>
        </div>
        
        <p class="text-2xl font-bold text-text-primary mt-8">
          Simple. Predictable. Risk-free.
        </p>
      </div>
    </section>

    <!-- TESTIMONIALS SECTION -->
    <section id="testimonials" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Trusted by school administrators.
          </h2>
        </div>
        
        <div class="grid md:grid-cols-2 gap-8">
          <div class="bg-card border border-border rounded-card p-8 shadow-card">
            <p class="text-lg text-text-secondary mb-6">
              "CAPFLUX eliminated our monthly reconciliation headaches. Payments now reconcile themselves, and we finally have real visibility into our cash flow."
            </p>
            <div>
              <p class="font-semibold text-text-primary">Mrs. Adesola Johnson</p>
              <p class="text-sm text-text-muted">Admin Officer, Grace High School</p>
            </div>
          </div>
          <div class="bg-card border border-border rounded-card p-8 shadow-card">
            <p class="text-lg text-text-secondary mb-6">
              "The offline-first approach saved us during last month's network outage. We continued operating while other schools shut down."
            </p>
            <div>
              <p class="font-semibold text-text-primary">Mr. Chinedu Okonkwo</p>
              <p class="text-sm text-text-muted">Finance Director, Royal Academy</p>
            </div>
          </div>
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
              <div v-show="item.open" class="px-6 pb-4">
                <p class="text-text-secondary">{{ item.answer }}</p>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA SECTION -->
    <section id="demo" class="py-32 px-6">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
          Stop Chasing School Fees.<br>
          Start Managing Them with Confidence.
        </h2>
        
        <p class="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
          Join Nigerian private schools simplifying fee collection with CAPFLUX.
          No setup fees. No fake alerts. No manual reconciliation.
          Just faster collections, predictable cash flow and accurate financial records.
        </p>
        
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
            variant="secondary"
            size="lg"
            class="px-8"
            @click="navigateToAuth('signup')"
          >
            Book a Live Demo
          </CmButton>
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
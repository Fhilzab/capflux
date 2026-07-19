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
import CountUpMetric from '../components/landing/CountUpMetric.vue';
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
  intelligence: 'M13 10V3L4 14h7v7l9-11h-7z',
};

// Feature list for trust section
const trustFeatures = [
  { id: 'offline', title: 'Built for Nigerian Private Schools', description: 'Designed specifically for African private school financial workflows.' },
  { id: 'offline', title: 'Offline-First Architecture', description: 'Operates without internet. Changes sync automatically when connectivity returns.' },
  { id: 'accounts', title: 'Dedicated Virtual Accounts', description: 'Unique account numbers for each student eliminate payment confusion.' },
  { id: 'reconciliation', title: 'Automatic Payment Reconciliation', description: 'Bank payments match themselves with zero manual effort.' },
  { id: 'security', title: 'Multi-Tenant Security', description: 'Bank-level isolation between schools and their financial data.' },
  { id: 'offline', title: 'Works with Poor Internet', description: 'Continue operations during network outages.' },
];

// Feature list
const features = [
  { id: 'billing', title: 'Configuration-Driven Billing', description: "Flexible fee structures that adapt to your school's needs, from tuition to one-time charges." },
  { id: 'accounts', title: 'Dedicated Virtual Accounts', description: 'Unique account numbers for each student, eliminating payment confusion and fraud.' },
  { id: 'reconciliation', title: 'Automatic Reconciliation', description: 'Payments match themselves. Every naira finds its ledger entry automatically.' },
  { id: 'guardians', title: 'Guardian Management', description: 'Keep parent contact information organized and accessible for all payment flows.' },
  { id: 'dashboard', title: 'Financial Dashboard', description: 'Real-time visibility into collections, outstanding balances, and reconciliation status.' },
  { id: 'offline', title: 'Offline-First Sync', description: 'Operate without internet. Changes queue locally and sync when connectivity returns.' },
  { id: 'reporting', title: 'Smart Reporting', description: 'Export-ready financial reports with drill-down capability for auditors and administrators.' },
  { id: 'intelligence', title: 'Payment Intelligence', description: 'AI-powered insights detect payment patterns and flag anomalies before they become problems.' },
];

// FAQ items
const faqItems = ref([
  { question: 'How does Capstone collect fees?', answer: 'Parents pay through dedicated virtual accounts via bank transfer, USSD, or POS. Payments are automatically reconciled and appear in your dashboard.', open: false },
  { question: 'What happens if the internet goes down?', answer: 'The application continues working offline. All changes queue locally and synchronize automatically when connectivity returns.', open: false },
  { question: 'How much does it cost?', answer: 'We operate on a micro-levy model. See our pricing section for details based on student count.', open: false },
  { question: 'How long does setup take?', answer: 'Most schools are onboarded within 48 hours. Our team handles the heavy lifting.', open: false },
]);

const toggleFaq = (index: number) => {
  faqItems.value[index].open = !faqItems.value[index].open;
};

const navigateToAuth = (mode: 'login' | 'signup' = 'login', provider?: string) => {
  const query: Record<string, string> = { mode };
  if (provider) query.provider = provider;
  router.push({ name: 'Auth', query });
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
  <div
  class="min-h-screen"
  style="
    background: var(--color-background);
    color: var(--color-text-primary);
  ">
<!-- class="min-h-screen bg-background text-text-primary font-sans antialiased" -->
    <!-- Navigation -->
    <LandingNav />

    <!-- HERO SECTION -->
    <section class="relative min-h-screen flex items-center justify-center px-6 pt-16">
      <FinancialNetwork class="absolute inset-0 -z-10" />
      
      <div class="mx-auto max-w-4xl text-center">
        <CmBadge
          variant="primary"
          label="Built for African Private Schools • Offline-First • Fee-First"
          class="mb-8 mx-auto"
        />
        
        <h1 class="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-text-primary mb-6">
          Every Naira.<br>Accounted For.
        </h1>
        
        <p class="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-12">
          Stop chasing school fees.<br>
          Capstone automatically tracks tuition, reconciles every bank payment, assigns each student a Dedicated Virtual Account, and gives your school complete financial visibility—built specifically for Nigerian private schools.
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <CmButton
            @click="navigateToAuth('signup')"
            variant="primary"
            size="lg"
            class="px-8 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Create Free Account
          </CmButton>
          <CmButton
            @click="navigateToAuth('signup', 'google')"
            variant="secondary"
            size="lg"
            class="px-8"
          >
            Continue with Google
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

        <!-- Trust Section - Clean badges -->
        <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-16 border-t border-divider">
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Offline-First</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Dedicated Virtual Accounts</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Automatic Reconciliation</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-text-muted">
            <div class="h-2 w-2 rounded-full bg-success"></div>
            <span class="font-mono">Multi-Tenant Security</span>
          </div>
        </div>
      </div>
    </section>

    <!-- TRUSTED BY SECTION -->
    <section id="trusted-by" class="py-16 px-6 border-y border-divider bg-surface/50">
      <div class="mx-auto max-w-6xl">
        <p class="text-center text-sm uppercase tracking-wider text-text-muted mb-8">Trusted by leading private schools</p>
        <div class="flex flex-wrap items-center justify-center gap-12 opacity-60">
          <span class="text-2xl font-bold text-text-secondary">GRACE HIGH</span>
          <span class="text-2xl font-bold text-text-secondary">ROYAL ACADEMY</span>
          <span class="text-2xl font-bold text-text-secondary">MERCY COLLEGE</span>
          <span class="text-2xl font-bold text-text-secondary">TRINITY SCHOOL</span>
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
            Manual reconciliation. Scattered payments across multiple channels. Endless WhatsApp messages. Spreadsheets riddled with errors. Uncertain revenue projections.
          </p>
          <p class="text-text-secondary">
            Schools waste hundreds of hours monthly chasing payments, verifying transactions, and updating ledger books. This is time that should be spent on education, not accounting.
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
          Payments organize themselves.
        </h2>
        <p class="text-lg text-text-secondary max-w-3xl mx-auto mb-16">
          Dedicated virtual accounts. Automatic reconciliation. Real-time visibility. Every payment finds its place without human intervention.
        </p>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div
            v-for="(item, index) in ['Account Numbers', 'Automatic Matching', 'Real-time Updates', 'Zero Manual Work']"
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
            Money flows through the Capstone pipeline.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            From parent payment to your dashboard, every transaction follows a predictable, auditable path.
          </p>
        </div>
        
        <PaymentPipeline />
      </div>
    </section>

    <!-- WHY CAPSTONE SECTION -->
    <section id="why-capstone" class="py-32 px-6 bg-surface/30">
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
            Built for financial operations.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            Every feature serves one purpose: helping schools collect and understand tuition revenue.
          </p>
        </div>
        
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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

    <!-- FINANCIAL INTELLIGENCE SECTION -->
    <section id="intelligence" class="py-32 px-6">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Financial intelligence that acts.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            Predictive analytics detect payment patterns, flag anomalies, and optimize your collection strategy.
          </p>
        </div>
        
        <div class="grid md:grid-cols-3 gap-8">
          <CountUpMetric :value="99.97" :label="'Uptime %'" :decimals="2" />
          <CountUpMetric :value="250" :label="'M₦+ Collected'" prefix="₦" />
          <CountUpMetric :value="500" :label="'Schools Served'" />
        </div>
      </div>
    </section>

    <!-- REPORTS SECTION -->
    <section id="reports" class="py-32 px-6 bg-surface/30">
      <div class="mx-auto max-w-6xl">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
            Reports that tell the story.
          </h2>
          <p class="text-lg text-text-secondary max-w-3xl mx-auto">
            Export-ready financial reports for auditors, administrators, and board meetings.
          </p>
        </div>
        
        <div class="bg-card border border-border rounded-card p-8 shadow-card max-w-4xl mx-auto">
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="h-4 bg-border rounded-full"></div>
            <div class="h-4 bg-brand/30 rounded-full w-2/3"></div>
            <div class="h-4 bg-border rounded-full"></div>
          </div>
          <div class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-12 bg-border/50 rounded-lg"></div>
          </div>
        </div>
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
              "Capstone eliminated our monthly reconciliation headaches. Payments now reconcile themselves, and we finally have real visibility into our cash flow."
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
            Questions & Answers
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
          Stop managing payments.<br>
          Start managing your school's financial future.
        </h2>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <CmButton
            @click="navigateToAuth('signup')"
            variant="primary"
            size="lg"
            class="px-8 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Create Free Account
          </CmButton>
          <CmButton
            variant="secondary"
            size="lg"
            class="px-8"
            @click="navigateToAuth('login')"
          >
            Log In
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
              <li><a href="#security" class="text-text-secondary hover:text-text-primary transition-colors text-sm">Security</a></li>
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
            Clarity over Aesthetic. Confidence over Color. Structure over Decoration.
          </p>
          <p class="mt-4 text-xs text-text-muted">
            © 2024 Capstone Software Solutions Ltd. All rights reserved.
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
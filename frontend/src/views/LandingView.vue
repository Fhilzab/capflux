<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const isAuthenticated = computed(() => authStore.isAuthenticated);

const goToLogin = () => router.push({ name: 'Login' });
const goToDashboard = () => router.push({ name: 'Home' });
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white">
    <section class="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-6 py-16 sm:px-10">
      <div class="absolute inset-x-0 top-0 h-56 bg-cyan-500/10 blur-3xl"></div>
      <div class="relative mx-auto max-w-6xl">
        <div class="grid gap-12 lg:grid-cols-[1.3fr_0.7fr] items-center">
          <div class="space-y-8">
            <p class="inline-flex rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/20">
              Offline-first school finance
            </p>
            <h1 class="text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
              Capstone helps Nigerian schools manage fees, billing, and payments even when the network does not.
            </h1>
            <p class="max-w-2xl text-lg leading-8 text-slate-300">
              Built for schools with unreliable internet, power outages, and aging computers. Capstone puts financial integrity and easy fee collection first with local-first sync, Supabase-backed persistence, and simple school cash flow workflows.
            </p>
            <div class="flex flex-col gap-4 sm:flex-row">
              <button
                @click="goToLogin"
                class="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Sign in
              </button>
              <button
                @click="goToDashboard"
                class="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-300"
              >
                {{ isAuthenticated ? 'Open dashboard' : 'Preview dashboard' }}
              </button>
            </div>
          </div>

          <div class="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div class="space-y-6">
              <div>
                <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Capstone in a glance</p>
                <h2 class="mt-4 text-3xl font-semibold text-white">Solo-ready school finance</h2>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-3xl bg-slate-900 p-5">
                  <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Offline billing</p>
                  <p class="mt-3 text-xl font-semibold text-white">Work locally, sync later</p>
                </div>
                <div class="rounded-3xl bg-slate-900 p-5">
                  <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Financial integrity</p>
                  <p class="mt-3 text-xl font-semibold text-white">Immutable ledgers, audit-safe</p>
                </div>
                <div class="rounded-3xl bg-slate-900 p-5">
                  <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Multi-tenant safety</p>
                  <p class="mt-3 text-xl font-semibold text-white">School-level isolation</p>
                </div>
                <div class="rounded-3xl bg-slate-900 p-5">
                  <p class="text-sm uppercase tracking-[0.24em] text-slate-500">Sync visibility</p>
                  <p class="mt-3 text-xl font-semibold text-white">Queue and retry status</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 py-16 sm:px-10">
      <div class="grid gap-12 lg:grid-cols-3">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h3 class="text-xl font-semibold text-white">Why Capstone?</h3>
          <p class="mt-4 text-slate-400 leading-7">
            Capstone is built for schools that need reliable fee collection and reporting without depending on perfect internet or new hardware.
          </p>
        </div>
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h3 class="text-xl font-semibold text-white">Key outcomes</h3>
          <ul class="mt-4 space-y-3 text-slate-400">
            <li>Keep billing and payments accurate even offline.</li>
            <li>Use a fee-first SaaS model for sustainable school revenue.</li>
            <li>Protect each school's data with tenant-aware design.</li>
          </ul>
        </div>
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h3 class="text-xl font-semibold text-white">Target audience</h3>
          <p class="mt-4 text-slate-400 leading-7">
            Nigerian and African primary and secondary schools, business offices, bursars, and school managers who need simple, dependable finance operations.
          </p>
        </div>
      </div>
    </section>

    <section class="border-t border-slate-800 bg-slate-950 px-6 py-16 sm:px-10">
      <div class="mx-auto max-w-6xl">
        <div class="grid gap-12 lg:grid-cols-3">
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-cyan-300">How it works</p>
            <h2 class="mt-4 text-3xl font-semibold text-white">Simple school finance in three steps</h2>
          </div>
          <div class="space-y-4">
            <div class="rounded-3xl bg-slate-900 p-6">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">1. Register students</p>
              <p class="mt-3 text-slate-300">Capture student and guardian data with instant search and local persistence.</p>
            </div>
            <div class="rounded-3xl bg-slate-900 p-6">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">2. Record charges & payments</p>
              <p class="mt-3 text-slate-300">Create fee entries, post payments, and keep the ledger accurate without waiting for the cloud.</p>
            </div>
            <div class="rounded-3xl bg-slate-900 p-6">
              <p class="text-sm uppercase tracking-[0.24em] text-slate-500">3. Sync when ready</p>
              <p class="mt-3 text-slate-300">Background sync reconciles local changes with Supabase once connectivity returns.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

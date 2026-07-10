<script setup>
import LogoutButton from '../components/LogoutButton.vue';
import SyncStatus from '../components/SyncStatus.vue';

const title = 'Capstone Dashboard';
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-4xl font-semibold">{{ title }}</h1>
          <LogoutButton />
        </div>
        <p class="text-slate-400">This is the authenticated home screen for Capstone.</p>
      </div>

      <SyncStatus />
    </div>
  </main>
</template>

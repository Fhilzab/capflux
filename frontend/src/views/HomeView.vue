<script setup>
import NavigationBar from '../components/NavigationBar.vue';
import SyncStatus from '../components/SyncStatus.vue';

const title = 'Capstone Dashboard';
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <NavigationBar />

      <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-4">{{ title }}</h1>
        <p class="text-slate-400">This is the authenticated home screen for Capstone.</p>
      </div>

      <SyncStatus />
    </div>
  </main>
</template>

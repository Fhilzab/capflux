<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { StudentService } from '../services/StudentService';
import { BillingService } from '../services/BillingService';

const route = useRoute();
const student = ref(null);
const ledgerItems = ref([]);
const loading = ref(true);
const error = ref('');

const loadStudent = async () => {
  try {
    loading.value = true;
    error.value = '';
    student.value = await StudentService.getStudentById(route.params.id);
    if (!student.value) {
      error.value = 'Student not found.';
      return;
    }
    ledgerItems.value = await BillingService.getStudentLedgerEntries(student.value.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
};

onMounted(loadStudent);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-3">
          <h1 class="text-4xl font-semibold">Student details</h1>
          <p class="text-slate-400">Review selected student and local billing ledger.</p>
        </div>
      </section>

      <section v-if="loading" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-slate-400">Loading student details...</p>
      </section>

      <section v-else-if="error" class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <p class="text-rose-400">{{ error }}</p>
      </section>

      <section v-else class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">{{ student.first_name }} {{ student.last_name }}</h2>
          <div class="space-y-3 text-slate-200">
            <p><span class="text-slate-400">Class:</span> {{ student.class_name }}</p>
            <p><span class="text-slate-400">Guardian phone:</span> {{ student.guardian_phone }}</p>
            <p><span class="text-slate-400">Status:</span> {{ student.status }}</p>
          </div>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Ledger entries</h2>
          <p class="text-slate-400">Transactions saved locally for this student.</p>
          <div class="mt-6 space-y-4">
            <div v-for="entry in ledgerItems" :key="entry.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div class="flex items-center justify-between gap-4">
                <p class="font-semibold">{{ entry.entry_type }}</p>
                <p class="text-cyan-400">₦{{ entry.amount }}</p>
              </div>
              <p class="text-slate-400">{{ entry.entry_description || 'No description' }}</p>
              <p class="text-xs text-slate-500 mt-2">Created: {{ new Date(entry.created_at).toLocaleString() }}</p>
            </div>
            <p v-if="ledgerItems.length === 0" class="text-slate-500">No local ledger entries available.</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

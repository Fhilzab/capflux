<script setup>
import { ref, onMounted } from 'vue';
import { BillingService } from '../services/BillingService';

const items = ref([]);
const balance = ref(0);

const loadBilling = async () => {
  const result = await BillingService.getBillingSummary('demo-school');
  items.value = result.items;
  balance.value = result.balance;
};

onMounted(loadBilling);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-2">Billing</h1>
        <p class="text-slate-400">Local billing summary and ledger preview.</p>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Charges</h2>
          <table class="w-full border-collapse text-left text-sm text-slate-200">
            <thead>
              <tr class="border-b border-slate-700 text-slate-400">
                <th class="py-3">Student</th>
                <th class="py-3">Amount</th>
                <th class="py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id" class="border-b border-slate-800 hover:bg-slate-950/50">
                <td class="py-3">{{ item.student_name }}</td>
                <td class="py-3">₦{{ item.amount }}</td>
                <td class="py-3">{{ item.entry_type }}</td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="3" class="py-8 text-center text-slate-500">No billing items available.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Outstanding balance</h2>
          <p class="text-5xl font-bold text-cyan-400">₦{{ balance }}</p>
        </div>
      </section>
    </div>
  </main>
</template>

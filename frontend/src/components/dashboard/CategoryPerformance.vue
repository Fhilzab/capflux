<script setup lang="ts">
import MetricCard from '../ui/MetricCard.vue';

interface Category {
  name: string;
  students: number;
  expected: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
}

interface Props {
  categories?: Category[];
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Category Performance</h2>
      <p class="text-sm text-slate-500">Compare collection performance across levels</p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-800/50">
            <th class="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase">Students</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase">Expected</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase">Collected</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase">Outstanding</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-slate-400 uppercase">Collection %</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="category in categories || []" :key="category.name" class="border-t border-slate-800/30">
            <td class="px-5 py-3.5 font-medium text-white">{{ category.name }}</td>
            <td class="px-5 py-3.5 text-right font-mono text-slate-300">{{ category.students }}</td>
            <td class="px-5 py-3.5 text-right font-mono text-cyan-400">₦{{ category.expected.toLocaleString() }}</td>
            <td class="px-5 py-3.5 text-right font-mono text-emerald-400">₦{{ category.collected.toLocaleString() }}</td>
            <td class="px-5 py-3.5 text-right font-mono" :class="category.outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'">₦{{ category.outstanding.toLocaleString() }}</td>
            <td class="px-5 py-3.5 text-right font-mono font-medium" :class="category.collectionRate >= 80 ? 'text-emerald-400' : category.collectionRate >= 60 ? 'text-amber-400' : 'text-rose-400'">{{ category.collectionRate }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
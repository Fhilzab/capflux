<script setup lang="ts">
import MetricCard from '../../../components/ui/MetricCard.vue';

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
      <p class="text-sm text-text-muted">Compare collection performance across levels</p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-divider">
            <th class="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase">Category</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-text-muted uppercase">Students</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-text-muted uppercase">Expected</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-text-muted uppercase">Collected</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-text-muted uppercase">Outstanding</th>
            <th class="px-5 py-3 text-right text-xs font-medium text-text-muted uppercase">Collection %</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="category in categories || []" :key="category.name" class="border-t border-divider">
            <td class="px-5 py-3.5 font-medium text-text-primary">{{ category.name }}</td>
            <td class="px-5 py-3.5 text-right font-mono text-text-secondary">{{ category.students }}</td>
            <td class="px-5 py-3.5 text-right font-mono text-brand">₦{{ category.expected.toLocaleString() }}</td>
            <td class="px-5 py-3.5 text-right font-mono text-success">₦{{ category.collected.toLocaleString() }}</td>
            <td class="px-5 py-3.5 text-right font-mono" :class="category.outstanding > 0 ? 'text-danger' : 'text-success'">₦{{ category.outstanding.toLocaleString() }}</td>
            <td class="px-5 py-3.5 text-right font-mono font-medium" :class="category.collectionRate >= 80 ? 'text-success' : category.collectionRate >= 60 ? 'text-warning' : 'text-danger'">{{ category.collectionRate }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import EmptyState from '../../../components/ui/EmptyState.vue';
import SkeletonLoader from '../../../components/ui/SkeletonLoader.vue';
import StatusBadge from '../../../components/ui/StatusBadge.vue';

interface Payment {
  id: string;
  student_name: string;
  guardian_name: string;
  amount: number;
  reference?: string;
  status?: string;
  created_at: string;
  payment_method?: string;
}

interface Props {
  payments?: Payment[];
  loading?: boolean;
}

const props = defineProps<Props>();

const sortedPayments = computed(() => {
  return [...(props.payments || [])].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
});

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
};

const copyReference = (ref?: string) => {
  if (ref) navigator.clipboard.writeText(ref);
};
</script>

<template>
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-headline">Recent Payments</h2>
      <router-link to="/payments" class="text-xs font-medium text-primary hover:text-primary-hover">View all →</router-link>
    </div>

    <!-- Loading state -->
    <SkeletonLoader v-if="loading" type="table" :count="5" />

    <!-- Empty state -->
    <EmptyState 
      v-else-if="sortedPayments.length === 0"
      title="No recent payments"
      description="Payments will appear here once they are recorded"
    />

    <!-- Data table -->
    <div v-else class="overflow-x-auto rounded-card border border-divider bg-surface transition-colors duration-200">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-divider">
            <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Student</th>
            <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Guardian</th>
            <th class="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">Amount</th>
            <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">Reference</th>
            <th class="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
            <th class="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-text-muted">Time</th>
            <th class="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-text-muted">Method</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in sortedPayments.slice(0, 10)" :key="payment.id" class="border-t border-divider hover:bg-card/50 transition-colors duration-200">
            <td class="px-5 py-3.5">
              <span class="font-bold uppercase text-text-primary">{{ payment.student_name }}</span>
            </td>
            <td class="px-5 py-3.5 text-text-secondary">{{ payment.guardian_name }}</td>
            <td class="px-5 py-3.5 text-right font-mono font-medium text-success">
              ₦{{ payment.amount.toLocaleString() }}
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-xs text-text-muted truncate max-w-24" :title="payment.reference">
                  {{ payment.reference || '-' }}
                </span>
                <button 
                  v-if="payment.reference"
                  @click="copyReference(payment.reference)"
                  class="text-text-muted hover:text-text-primary"
                >
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 0V9m0 3l3 3m6-3V9m0 3l-3-3" />
                  </svg>
                </button>
              </div>
            </td>
            <td class="px-5 py-3.5 text-center">
              <StatusBadge :status="payment.status === 'verified' ? 'success' : 'pending'" :label="payment.status || 'pending'" />
            </td>
            <td class="px-5 py-3.5 text-right font-mono text-xs text-text-muted">
              {{ formatTime(payment.created_at) }}
            </td>
            <td class="px-5 py-3.5 text-center">
              <svg class="h-4 w-4 mx-auto text-text-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5h18M3 14.25h18M5.25 6a2.25 2.25 0 012.25-2.25h10.5A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H7.5A2.25 2.25 0 015.25 18V6z" />
              </svg>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
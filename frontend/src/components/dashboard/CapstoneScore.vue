<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  collectionRate?: number;
  paymentSuccess?: number;
  outstandingBalance?: number;
  notificationSuccess?: number;
  offlineSyncHealth?: number;
  guardianReachability?: number;
  verificationSuccess?: number;
}

const props = defineProps<Props>();

const score = computed(() => {
  const weights = {
    collectionRate: 0.25,
    paymentSuccess: 0.15,
    outstandingBalance: 0.15,
    notificationSuccess: 0.15,
    offlineSyncHealth: 0.10,
    guardianReachability: 0.10,
    verificationSuccess: 0.10,
  };

  const collectionScore = Math.min(100, (props.collectionRate || 0) / 100 * 100);
  const paymentScore = props.paymentSuccess || 0;
  const balanceScore = Math.max(0, 100 - (props.outstandingBalance || 0) / 100);
  const notificationScore = props.notificationSuccess || 0;
  const syncScore = props.offlineSyncHealth || 0;
  const reachScore = props.guardianReachability || 0;
  const verifyScore = props.verificationSuccess || 0;

  return Math.round(
    collectionScore * weights.collectionRate +
    paymentScore * weights.paymentSuccess +
    balanceScore * weights.outstandingBalance +
    notificationScore * weights.notificationSuccess +
    syncScore * weights.offlineSyncHealth +
    reachScore * weights.guardianReachability +
    verifyScore * weights.verificationSuccess
  );
});

const status = computed(() => {
  const s = score.value;
  if (s >= 90) return { label: 'Excellent', color: 'text-emerald-400' };
  if (s >= 75) return { label: 'Good', color: 'text-amber-400' };
  if (s >= 60) return { label: 'Fair', color: 'text-cyan-400' };
  return { label: 'Needs Attention', color: 'text-rose-400' };
});

const aiExplanation = computed(() => {
  const s = score.value;
  if (s >= 90) return 'Your school is performing excellently. All systems are operating at peak efficiency.';
  if (s >= 75) return 'Good performance overall. Consider improving payment verification rates.';
  if (s >= 60) return 'Collection rate is below optimal. Consider running reminder campaigns.';
  return 'Critical attention needed. Review outstanding balances and payment processes.';
});
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Capstone Score</h2>
      <p class="text-sm text-slate-500">Overall operational health score</p>
    </div>

    <div class="premium-card--glow p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-label">Score</p>
          <p class="text-5xl font-bold font-mono text-white">{{ score }}<span class="text-lg text-slate-400">/100</span></p>
        </div>
        <div class="text-right">
          <p class="text-label">Status</p>
          <p class="text-xl font-semibold" :class="status.color">{{ status.label }}</p>
        </div>
      </div>

      <div class="h-3 rounded-full bg-slate-800 overflow-hidden mb-4">
        <div class="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 transition-all duration-500" :style="{ width: `${score}%` }"></div>
      </div>

      <p class="text-sm text-slate-300">{{ aiExplanation }}</p>
    </div>
  </section>
</template>
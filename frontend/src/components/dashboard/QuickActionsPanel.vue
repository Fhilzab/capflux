<script setup lang="ts">
import { useRouter } from 'vue-router';
import QuickActionButton from '../ui/QuickActionButton.vue';

interface Props {
  loading?: boolean;
}

defineProps<Props>();

const router = useRouter();

const actions = [
  { label: 'Register Student', icon: 'user-plus', shortcut: 'N', route: 'Students' },
  { label: 'Register Guardian', icon: 'user-group-plus', shortcut: 'G', route: 'Guardians' },
  { label: 'Configure Fees', icon: 'currency-dollar', shortcut: 'F', route: 'Billing' },
  { label: 'Generate DVA', icon: 'banknotes', shortcut: 'D', route: 'VirtualAccounts' },
  { label: 'Record Payment', icon: 'credit-card', shortcut: 'P', route: 'Payments' },
  { label: 'Send Reminder', icon: 'bell', shortcut: 'R', route: 'Notifications' },
  { label: 'Import Students', icon: 'document-arrow-up', shortcut: 'I', route: 'Students' },
  { label: 'Export Report', icon: 'document-arrow-down', shortcut: 'E', route: 'Reports' },
];

const navigate = (routeName: string) => {
  router.push({ name: routeName });
};
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="text-headline">Quick Actions</h2>
      <p class="text-sm text-slate-500">Common tasks in two clicks</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <QuickActionButton
        v-for="action in actions"
        :key="action.label"
        :label="action.label"
        :shortcut="action.shortcut"
        @click="navigate(action.route)"
      />
    </div>
  </section>
</template>
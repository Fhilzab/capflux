<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';

const authStore = useAuthStore();
const router = useRouter();

const visible = computed(() => !authStore.isSchoolSetupComplete);

const handleCompleteSetup = () => {
  router.push({ name: 'SchoolSetup' });
};
</script>

<template>
  <div
    v-if="visible"
    class="bg-brand/10 border border-brand/20 rounded-card p-4 mb-6 flex items-center justify-between gap-4 premium-card transition-all duration-300 hover:shadow-elevated"
  >
    <div class="flex-1">
      <p class="text-sm font-medium text-text-primary">
        Welcome to Capstone. Complete your school profile to activate fee collection.
      </p>
    </div>
    <CmButton
      @click="handleCompleteSetup"
      variant="primary"
      size="sm"
    >
      Activate
    </CmButton>
  </div>
</template>
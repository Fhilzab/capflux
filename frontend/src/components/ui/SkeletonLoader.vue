<script setup lang="ts">
interface Props {
  type?: 'card' | 'row' | 'chart' | 'metric' | 'table';
  count?: number;
}

withDefaults(defineProps<Props>(), {
  count: 1,
});
</script>

<template>
  <div v-if="type === 'card'" :class="`space-y-4 ${type}`">
    <div v-for="i in count" :key="i" class="skeleton h-32 rounded-2xl"></div>
  </div>
  
  <div v-else-if="type === 'row'" :class="`space-y-3 ${type}`">
    <div v-for="i in count" :key="i" class="skeleton h-12 rounded-xl w-full"></div>
  </div>
  
  <div v-else-if="type === 'chart'" :class="`space-y-4 ${type}`">
    <div v-for="i in count" :key="i" class="skeleton h-64 rounded-2xl"></div>
  </div>
  
  <div v-else-if="type === 'metric'" :class="`space-y-4 ${type}`">
    <div v-for="i in count" :key="i" class="skeleton h-24 rounded-2xl"></div>
  </div>
  
  <div v-else-if="type === 'table'" :class="`space-y-2 ${type}`">
    <div v-for="i in count" :key="i" class="skeleton h-10 rounded-xl w-full"></div>
  </div>
  
  <div v-else class="skeleton h-6 rounded-xl w-3/4"></div>
</template>
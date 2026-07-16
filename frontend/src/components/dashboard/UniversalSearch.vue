<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface SearchResult {
  id: string;
  type: 'student' | 'guardian' | 'payment' | 'receipt' | 'virtual-account' | 'phone' | 'reference';
  title: string;
  subtitle: string;
  route: string;
}

const isOpen = ref(false);
const searchQuery = ref('');
const results = ref<SearchResult[]>([]);

const openSearch = () => {
  isOpen.value = true;
  searchQuery.value = '';
  results.value = [];
};

const closeSearch = () => {
  isOpen.value = false;
};

const performSearch = () => {
  if (searchQuery.value.length < 2) {
    results.value = [];
    return;
  }
  
  const allResults: SearchResult[] = [
    { id: '1', type: 'student', title: 'John Doe', subtitle: 'Class 5A • Outstanding: ₦45,000', route: '/students/1' },
    { id: '2', type: 'guardian', title: 'Jane Smith', subtitle: '2 children • Last payment: 2 days ago', route: '/guardians/2' },
    { id: '3', type: 'payment', title: 'Payment #PAY-001', subtitle: '₦150,000 • Verified', route: '/payments/1' },
  ];
  
  results.value = allResults.filter(r => r.title.toLowerCase().includes(searchQuery.value.toLowerCase()));
};

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (isOpen.value) {
      closeSearch();
    } else {
      openSearch();
    }
  }
  if (e.key === 'Escape' && isOpen.value) {
    closeSearch();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!-- Search Trigger Button - inline workflow -->
  <div class="w-full max-w-md">
    <div class="relative">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        @focus="openSearch"
        @input="performSearch"
        type="text"
        placeholder="Search students, invoices, payments..."
        class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800/50 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
      />
    </div>
  </div>

  <!-- Search Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50" @click.self="closeSearch">
        <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
          <div class="p-4 border-b border-slate-200 dark:border-slate-700">
            <input
              v-model="searchQuery"
              @input="performSearch"
              type="text"
              placeholder="Search students, invoices, payments..."
              class="w-full bg-transparent text-lg placeholder:text-slate-500 focus:outline-none"
              autofocus
            />
          </div>
          <div class="max-h-96 overflow-y-auto p-2">
            <div v-if="results.length > 0" class="space-y-1">
              <a
                v-for="result in results"
                :key="result.id"
                :href="result.route"
                class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <p class="font-medium text-slate-900 dark:text-white">{{ result.title }}</p>
                  <p class="text-sm text-slate-500">{{ result.subtitle }}</p>
                </div>
                <span class="ml-auto text-xs text-slate-500 capitalize">{{ result.type }}</span>
              </a>
            </div>
            <div v-else-if="searchQuery.length >= 2" class="py-8 text-center">
              <p class="text-slate-500">No results found</p>
              <p class="text-sm text-slate-400 mt-1">Try searching for a student name, payment reference, or phone number</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
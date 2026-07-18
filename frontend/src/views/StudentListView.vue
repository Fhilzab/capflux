<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { StudentService } from '../shared/services/StudentService';
import CmButton from '../components/ui/CmButton.vue';

const router = useRouter();
const DEFAULT_SCHOOL_ID = 'demo-school';
const students = ref([]);
const search = ref('');
const showArchived = ref(false);
const form = ref({
  first_name: '',
  last_name: '',
  class_name: '',
  guardian_full_name: '',
  guardian_phone: '',
  guardian_secondary_phone: '',
  guardian_email: '',
  relationship: 'GUARDIAN',
});
const saving = ref(false);
const message = ref('');

const loadStudents = async (query = '') => {
  const result = await StudentService.getStudentsWithGuardians(DEFAULT_SCHOOL_ID, showArchived.value);
  students.value = result.filter(s => !query || showArchived.value || s.status === 'ACTIVE');
};

const toggleArchived = () => {
  showArchived.value = !showArchived.value;
  loadStudents(search.value);
};

const saveStudent = async () => {
  saving.value = true;
  message.value = '';

  await StudentService.registerStudentWithGuardian(DEFAULT_SCHOOL_ID, {
    first_name: form.value.first_name,
    last_name: form.value.last_name,
    class_name: form.value.class_name,
    guardian_full_name: form.value.guardian_full_name,
    guardian_phone: form.value.guardian_phone,
    guardian_secondary_phone: form.value.guardian_secondary_phone || undefined,
    guardian_email: form.value.guardian_email || undefined,
    relationship: form.value.relationship,
  });

  await loadStudents();
  saving.value = false;
  message.value = 'Student registered locally.';
  form.value = {
    first_name: '',
    last_name: '',
    class_name: '',
    guardian_full_name: '',
    guardian_phone: '',
    guardian_secondary_phone: '',
    guardian_email: '',
    relationship: 'GUARDIAN',
  };
};

const goToStudent = (id) => {
  router.push({ name: 'StudentDetail', params: { id } });
};

onMounted(loadStudents);
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8 transition-colors duration-200">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold text-text-primary">Students</h1>
            <p class="text-text-muted mt-2">Register and review students in the local offline store.</p>
          </div>
          <p class="text-sm text-text-muted">School ID: demo-school</p>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-2xl font-semibold text-text-primary">Student register</h2>
            <p class="text-text-muted">Search by name or class to filter the local student list.</p>
          </div>
          <div class="flex items-center gap-3">
            <input
              v-model="search"
              @input="() => loadStudents(search)"
              placeholder="Search students"
              class="rounded-button border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow"
            />
            <CmButton @click="() => loadStudents(search)" variant="primary">
              Search
            </CmButton>
          </div>
        </div>
        <div class="mt-6 space-y-4">
          <label class="block">
            <span class="text-sm text-text-muted">First name</span>
            <input v-model="form.first_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Last name</span>
            <input v-model="form.last_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Class</span>
            <input v-model="form.class_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Guardian full name</span>
            <input v-model="form.guardian_full_name" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Primary phone</span>
            <input v-model="form.guardian_phone" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Secondary phone (optional)</span>
            <input v-model="form.guardian_secondary_phone" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Email (optional)</span>
            <input v-model="form.guardian_email" type="email" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow" />
          </label>
          <label class="block">
            <span class="text-sm text-text-muted">Relationship</span>
            <select v-model="form.relationship" class="mt-2 w-full rounded-button border border-border bg-surface px-4 py-3 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-glow transition-shadow">
              <option value="GUARDIAN">Guardian</option>
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <CmButton @click="saveStudent" :disabled="saving" variant="primary">
            {{ saving ? 'Saving...' : 'Register student' }}
          </CmButton>
          <p v-if="message" class="text-sm text-success">{{ message }}</p>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card transition-colors duration-200">
        <h2 class="text-2xl font-semibold mb-4 text-text-primary">Student count</h2>
        <p class="text-5xl font-bold text-text-primary">{{ students.length }}</p>
        <p class="mt-2 text-text-muted">Stored locally in Dexie.</p>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto transition-colors duration-200">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 class="text-2xl font-semibold text-text-primary">Student list</h2>
          <label class="flex items-center gap-2 cursor-pointer">
            <span class="text-sm text-text-muted">Show archived</span>
            <button
              @click="toggleArchived"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="showArchived ? 'bg-primary' : 'bg-border'"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-background transition-transform"
                :class="showArchived ? 'translate-x-6' : 'translate-x-1'"
              ></span>
            </button>
          </label>
        </div>
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-divider text-text-muted">
              <th class="py-3 text-xs font-bold uppercase tracking-wider">First</th>
              <th class="py-3 text-xs font-bold uppercase tracking-wider">Last</th>
              <th class="py-3 text-xs font-bold uppercase tracking-wider">Class</th>
              <th class="py-3 text-xs font-bold uppercase tracking-wider">Guardian</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.id" class="cursor-pointer border-b border-divider hover:bg-card/50 transition-colors" @click="goToStudent(student.id)">
              <td class="py-3 font-bold uppercase text-text-primary">{{ student.first_name }}</td>
              <td class="py-3 font-bold uppercase text-text-primary">{{ student.last_name }}</td>
              <td class="py-3 text-text-secondary">{{ student.class_name }}</td>
              <td class="py-3 text-text-secondary">{{ student.guardian?.full_name || student.guardian?.primary_phone || '-' }}</td>
            </tr>
            <tr v-if="students.length === 0">
              <td colspan="4" class="py-8 text-center text-text-muted">No local students yet.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>
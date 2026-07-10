<script setup>
import { ref, onMounted } from 'vue';
import { StudentService } from '../services/StudentService';

const DEFAULT_SCHOOL_ID = 'demo-school';
const students = ref([]);
const form = ref({
  first_name: '',
  last_name: '',
  class_name: '',
  guardian_phone: '',
});
const saving = ref(false);
const message = ref('');

const loadStudents = async () => {
  students.value = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
};

const saveStudent = async () => {
  saving.value = true;
  message.value = '';

  const student = {
    school_id: DEFAULT_SCHOOL_ID,
    ...form.value,
    status: 'ACTIVE',
    client_sequence: 0,
    device_id: 'local-client',
  };

  await StudentService.saveStudent(student);
  await loadStudents();
  saving.value = false;
  message.value = 'Student registered locally.';
  form.value = {
    first_name: '',
    last_name: '',
    class_name: '',
    guardian_phone: '',
  };
};

onMounted(loadStudents);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold">Students</h1>
            <p class="text-slate-400 mt-2">Register and review students in the local offline store.</p>
          </div>
          <p class="text-sm text-slate-500">School ID: demo-school</p>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Student register</h2>
          <div class="space-y-4">
            <label class="block">
              <span class="text-sm text-slate-400">First name</span>
              <input v-model="form.first_name" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Last name</span>
              <input v-model="form.last_name" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Class</span>
              <input v-model="form.class_name" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <label class="block">
              <span class="text-sm text-slate-400">Guardian phone</span>
              <input v-model="form.guardian_phone" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>
            <button @click="saveStudent" :disabled="saving" class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
              {{ saving ? 'Saving...' : 'Register student' }}
            </button>
            <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
          </div>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Student count</h2>
          <p class="text-5xl font-bold">{{ students.length }}</p>
          <p class="mt-2 text-slate-400">Stored locally in Dexie.</p>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
        <h2 class="text-2xl font-semibold mb-4">Student list</h2>
        <table class="w-full border-collapse text-left text-sm text-slate-200">
          <thead>
            <tr class="border-b border-slate-700 text-slate-400">
              <th class="py-3">First</th>
              <th class="py-3">Last</th>
              <th class="py-3">Class</th>
              <th class="py-3">Guardian</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.id" class="border-b border-slate-800 hover:bg-slate-950/50">
              <td class="py-3">{{ student.first_name }}</td>
              <td class="py-3">{{ student.last_name }}</td>
              <td class="py-3">{{ student.class_name }}</td>
              <td class="py-3">{{ student.guardian_phone }}</td>
            </tr>
            <tr v-if="students.length === 0">
              <td colspan="4" class="py-8 text-center text-slate-500">No local students yet.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </main>
</template>

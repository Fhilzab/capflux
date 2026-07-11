<script setup>
import { ref, onMounted, computed } from 'vue';
import { NotificationService } from '../services/NotificationService';
import { StudentService } from '../services/StudentService';

const DEFAULT_SCHOOL_ID = 'demo-school';
const students = ref([]);
const notifications = ref([]);
const form = ref({
  student_id: '',
  recipient_phone: '',
  message_body: '',
  delivery_method: 'SMS',
});
const sending = ref(false);
const message = ref('');
const selectedTemplate = ref('');
const selectedStudentName = ref('');

const templates = ref({
  fee_reminder: 'Fee Reminder',
  receipt_notice: 'Payment Receipt Notice',
  outstanding_balance: 'Outstanding Balance Notice',
  general_update: 'General Update',
});

const loadStudents = async () => {
  students.value = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
};

const loadNotifications = async () => {
  const allStudents = await StudentService.getStudentsBySchool(DEFAULT_SCHOOL_ID);
  const allNotifications = [];

  for (const student of allStudents) {
    const studentNotifications = await NotificationService.getNotificationsForStudent(student.id);
    allNotifications.push(
      ...studentNotifications.map((notification) => ({
        ...notification,
        student_name: `${student.first_name} ${student.last_name}`,
      }))
    );
  }

  notifications.value = allNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const onStudentSelect = () => {
  const student = students.value.find((s) => s.id === form.value.student_id);
  if (student) {
    form.value.recipient_phone = student.guardian_phone || '';
    selectedStudentName.value = `${student.first_name} ${student.last_name}`;
    selectedTemplate.value = '';
  }
};

const applyTemplate = () => {
  if (!selectedTemplate.value || !selectedStudentName.value) return;
  const student = students.value.find((s) => s.id === form.value.student_id);
  if (!student) return;

  const templates = NotificationService.generateTemplates(
    selectedStudentName.value,
    student.class_name
  );

  if (templates[selectedTemplate.value]) {
    form.value.message_body = templates[selectedTemplate.value];
  }
};

const submitNotification = async () => {
  if (!form.value.student_id || !form.value.recipient_phone || !form.value.message_body) {
    message.value = 'Fill out student, phone, and message to send a notification.';
    return;
  }

  sending.value = true;
  message.value = '';

  await NotificationService.sendNotification({
    id: `${form.value.student_id}-${Date.now()}`,
    school_id: DEFAULT_SCHOOL_ID,
    student_id: form.value.student_id,
    recipient_phone: form.value.recipient_phone,
    message_body: form.value.message_body,
    delivery_method: form.value.delivery_method,
    delivery_status: 'PENDING',
    created_at: new Date().toISOString(),
  });

  await loadNotifications();
  sending.value = false;
  message.value = 'Notification recorded locally.';
  form.value = {
    student_id: '',
    recipient_phone: '',
    message_body: '',
    delivery_method: 'SMS',
  };
  selectedStudentName.value = '';
  selectedTemplate.value = '';
};

const retryNotification = async (id) => {
  try {
    await NotificationService.retryFailedNotification(id);
    await loadNotifications();
  } catch (err) {
    message.value = err instanceof Error ? err.message : String(err);
  }
};

const statusBadgeClass = (status) => {
  switch (status) {
    case 'SENT': return 'bg-emerald-500/10 text-emerald-400';
    case 'FAILED': return 'bg-rose-500/10 text-rose-400';
    case 'PENDING':
    default: return 'bg-amber-500/10 text-amber-400';
  }
};

onMounted(async () => {
  await loadStudents();
  await loadNotifications();
});
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl">
        <h1 class="text-4xl font-semibold mb-2">Notifications</h1>
        <p class="text-slate-400">Create local notifications with provider delivery and track status.</p>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl space-y-6">
          <div>
            <h2 class="text-2xl font-semibold mb-4">New notification</h2>
            <p class="text-slate-400">Record a notification to a guardian or family contact.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-slate-400">Student</span>
              <select
                v-model="form.student_id"
                @change="onStudentSelect"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="" disabled>Select student</option>
                <option v-for="student in students" :key="student.id" :value="student.id">
                  {{ student.first_name }} {{ student.last_name }}
                </option>
              </select>
            </label>

            <label class="block">
              <span class="text-sm text-slate-400">Delivery method</span>
              <select
                v-model="form.delivery_method"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="SMS">SMS (Termii)</option>
                <option value="WHATSAPP">WhatsApp (Termii)</option>
                <option value="EMAIL">Email</option>
              </select>
            </label>

            <label class="block">
              <span class="text-sm text-slate-400">Recipient phone</span>
              <input v-model="form.recipient_phone" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </label>

            <label class="block">
              <span class="text-sm text-slate-400">Template (optional)</span>
              <select
                v-model="selectedTemplate"
                @change="applyTemplate"
                class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">Select a template</option>
                <option v-for="(label, key) in templates" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </label>

            <label class="block sm:col-span-2">
              <span class="text-sm text-slate-400">Message</span>
              <textarea v-model="form.message_body" rows="4" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"></textarea>
            </label>
          </div>

          <button @click="submitNotification" :disabled="sending" class="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
            {{ sending ? 'Saving...' : 'Save notification' }}
          </button>
          <p v-if="message" class="text-sm text-emerald-400">{{ message }}</p>
        </div>

        <div class="rounded-3xl bg-slate-900 p-8 shadow-xl">
          <h2 class="text-2xl font-semibold mb-4">Notification count</h2>
          <p class="text-5xl font-bold text-cyan-400">{{ notifications.length }}</p>
          <p class="mt-4 text-slate-400">Notifications are stored locally and sent via provider when online.</p>
        </div>
      </section>

      <section class="rounded-3xl bg-slate-900 p-8 shadow-xl overflow-x-auto">
        <h2 class="text-2xl font-semibold mb-4">Notification history</h2>
        <div class="grid gap-3">
          <div v-for="notification in notifications" :key="notification.id" class="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <p class="font-semibold">{{ notification.student_name }}</p>
                  <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusBadgeClass(notification.delivery_status)">
                    {{ notification.delivery_status }}
                  </span>
                  <span class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                    {{ notification.delivery_method || 'SMS' }}
                  </span>
                </div>
                <p class="text-slate-400">{{ notification.message_body }}</p>
                <div class="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>To: {{ notification.recipient_phone }}</span>
                  <span v-if="notification.provider_msg_id">Provider ID: {{ notification.provider_msg_id }}</span>
                  <span>{{ new Date(notification.created_at).toLocaleString() }}</span>
                </div>
              </div>
              <button
                v-if="notification.delivery_status === 'FAILED'"
                @click="retryNotification(notification.id)"
                class="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              >
                Retry
              </button>
            </div>
          </div>
          <p v-if="notifications.length === 0" class="text-slate-500">No notifications recorded yet.</p>
        </div>
      </section>
    </div>
  </main>
</template>
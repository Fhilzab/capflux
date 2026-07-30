<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useNotificationStore } from '../stores/notificationStore';
import { useStudentStore } from '../stores/studentStore';
import { NotificationService } from '../shared/services/NotificationService';
import CmButton from '../components/ui/CmButton.vue';
import CmSelect from '../components/ui/CmSelect.vue';
import CmInput from '../components/ui/CmInput.vue';

const DEFAULT_SCHOOL_ID = 'demo-school';
const notificationStore = useNotificationStore();
const studentStore = useStudentStore();
const students = ref([]) as any;
const notifications = ref([]) as any;
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
  await studentStore.loadStudents();
  students.value = studentStore.students;
};

const loadNotifications = async () => {
  const allStudents = studentStore.students;
  const allNotifications = [] as any[];

  for (const student of allStudents) {
    await notificationStore.loadNotifications(student.id);
    const studentNotifications = notificationStore.notifications;
    allNotifications.push(
      ...studentNotifications.map((notification: any) => ({
        ...notification,
        student_name: `${student.firstName} ${student.lastName}`,
      }))
    );
  }

  notifications.value = allNotifications.sort((a: any, b: any) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime());
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
    case 'SENT': return 'bg-success/10 text-success';
    case 'FAILED': return 'bg-danger/10 text-danger';
    case 'PENDING':
    default: return 'bg-warning/10 text-warning';
  }
};

onMounted(async () => {
  await loadStudents();
  await loadNotifications();
});
</script>

<template>
  <main class="min-h-screen bg-background text-text-primary p-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <section class="rounded-card bg-card p-8 shadow-card">
        <h1 class="text-display mb-2">Notifications</h1>
        <p class="text-text-secondary">Create local notifications with provider delivery and track status.</p>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div class="rounded-card bg-card p-8 shadow-card space-y-6">
          <div>
            <h2 class="text-headline mb-4">New notification</h2>
            <p class="text-text-secondary">Record a notification to a guardian or family contact.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm text-text-muted">Student</span>
              <CmSelect
                v-model="form.student_id"
                @change="onStudentSelect"
                :options="students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))"
                placeholder="Select student"
                class="mt-2"
              />
            </label>

            <label class="block">
              <span class="text-sm text-text-muted">Delivery method</span>
              <CmSelect
                v-model="form.delivery_method"
                :options="[
                  { value: 'SMS', label: 'SMS (Termii)' },
                  { value: 'WHATSAPP', label: 'WhatsApp (Termii)' },
                  { value: 'EMAIL', label: 'Email' },
                ]"
                class="mt-2"
              />
            </label>

            <label class="block">
              <span class="text-sm text-text-muted">Recipient phone</span>
              <CmInput v-model="form.recipient_phone" class="mt-2" />
            </label>

            <label class="block">
              <span class="text-sm text-text-muted">Template (optional)</span>
              <CmSelect
                v-model="selectedTemplate"
                @change="applyTemplate"
                :options="Object.entries(templates).map(([key, label]) => ({ value: key, label }))"
                placeholder="Select a template"
                class="mt-2"
              />
            </label>

            <label class="block sm:col-span-2">
              <span class="text-sm text-text-muted">Message</span>
              <textarea v-model="form.message_body" rows="4" class="mt-2 w-full rounded-input border border-border bg-surface px-4 py-3.5 text-text-primary placeholder:text-text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"></textarea>
            </label>
          </div>

          <CmButton @click="submitNotification" :disabled="sending">
            {{ sending ? 'Saving...' : 'Save notification' }}
          </CmButton>
          <p v-if="message" class="text-sm text-success">{{ message }}</p>
        </div>

        <div class="rounded-card bg-card p-8 shadow-card">
          <h2 class="text-headline mb-4">Notification count</h2>
          <p class="text-metric text-brand">{{ notifications.length }}</p>
          <p class="mt-4 text-text-secondary">Notifications are stored locally and sent via provider when online.</p>
        </div>
      </section>

      <section class="rounded-card bg-card p-8 shadow-card overflow-x-auto">
        <h2 class="text-headline mb-4">Notification history</h2>
        <div class="grid gap-3">
          <div v-for="notification in notifications" :key="notification.id" class="rounded-card border border-divider bg-surface p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <p class="font-semibold">{{ notification.student_name }}</p>
                  <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusBadgeClass(notification.delivery_status)">
                    {{ notification.delivery_status }}
                  </span>
                  <span class="rounded-full bg-surface px-3 py-1 text-xs text-text-muted">
                    {{ notification.delivery_method || 'SMS' }}
                  </span>
                </div>
                <p class="text-text-secondary">{{ notification.message_body }}</p>
                <div class="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
                  <span>To: {{ notification.recipient_phone }}</span>
                  <span v-if="notification.provider_msg_id">Provider ID: {{ notification.provider_msg_id }}</span>
                  <span>{{ new Date(notification.created_at).toLocaleString() }}</span>
                </div>
              </div>
              <CmButton
                v-if="notification.delivery_status === 'FAILED'"
                @click="retryNotification(notification.id)"
                variant="warning"
                size="sm"
              >
                Retry
              </CmButton>
            </div>
          </div>
          <p v-if="notifications.length === 0" class="text-text-muted">No notifications recorded yet.</p>
        </div>
      </section>
    </div>
  </main>
</template>
<script setup lang="ts">
/**
 * ContactForm — public contact page form (Phase 18C).
 *
 * Posts to /api/v1/public/contact with a hidden `_website` honeypot.
 * Submissions land in the staff contact inbox; the response is a bare
 * acknowledgement (the API never echoes the stored message).
 */
import { sendPublicContactMessage } from '~/services/public'
import type { ContactMessageCreate } from '~/shared/schemas/public'

/** Generic routing hints only — free text server-side, no school policy. */
const DEPARTMENT_OPTIONS = [
  { label: 'Admissions', value: 'Admissions' },
  { label: 'Academics', value: 'Academics' },
  { label: 'Fees & finance', value: 'Fees & finance' },
  { label: 'General enquiry', value: 'General enquiry' },
]

const form = reactive({
  name: '',
  email: '',
  phone: '',
  department: '',
  subject: '',
  body: '',
  // Honeypot — invisible to humans, must stay empty.
  _website: '',
})

const errors = reactive<Record<string, string>>({})
const sending = ref(false)
const sent = ref(false)
const sendError = ref('')

function validate(): boolean {
  for (const key of Object.keys(errors)) delete errors[key]
  if (!form.name.trim()) errors.name = 'Your name is required.'
  if (!form.email.trim()) {
    errors.email = 'Your email is required.'
  } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!form.subject.trim()) errors.subject = 'A subject is required.'
  if (!form.body.trim()) errors.body = 'Tell us how we can help.'
  return Object.keys(errors).length === 0
}

async function submit() {
  sendError.value = ''
  if (!validate()) return
  sending.value = true
  try {
    const payload: ContactMessageCreate = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      department: form.department || null,
      subject: form.subject.trim(),
      body: form.body.trim(),
      _website: form._website,
    }
    await sendPublicContactMessage(payload)
    sent.value = true
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    sendError.value =
      status === 429
        ? 'Too many messages. Please wait a few minutes and try again.'
        : 'Your message could not be sent. Please try again.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <VcsCard v-if="sent" class="border-success/30 bg-success/10">
    <h3 class="font-display text-h4 text-brand-primary">
      Message received
    </h3>
    <p class="mt-3 text-body text-text-secondary">
      Thank you for reaching out. The school office will respond using the
      email address you provided.
    </p>
  </VcsCard>

  <VcsCard v-else>
    <form class="grid gap-5" novalidate @submit.prevent="submit">
      <!-- Honeypot: hidden from humans, bots fill it. -->
      <div class="hidden" aria-hidden="true">
        <label>
          Website
          <input v-model="form._website" type="text" name="_website" tabindex="-1" autocomplete="off">
        </label>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <VcsInput v-model="form.name" label="Your name" required :error="errors.name" autocomplete="name" />
        <VcsInput v-model="form.email" label="Email address" type="email" inputmode="email" required :error="errors.email" autocomplete="email" />
        <VcsInput v-model="form.phone" label="Phone (optional)" type="tel" inputmode="tel" autocomplete="tel" />
        <VcsSelect v-model="form.department" label="Topic (optional)" :options="DEPARTMENT_OPTIONS" placeholder="Choose a topic" />
      </div>
      <VcsInput v-model="form.subject" label="Subject" required :error="errors.subject" />

      <div class="space-y-1.5">
        <label for="contact-body" class="block text-body-sm font-semibold text-text-primary">
          Message
          <span class="text-danger" aria-hidden="true">*</span>
          <span class="sr-only"> (required)</span>
        </label>
        <textarea
          id="contact-body"
          v-model="form.body"
          rows="5"
          class="block w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-body text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          :aria-invalid="Boolean(errors.body) || undefined"
        />
        <p v-if="errors.body" class="text-body-sm text-danger">
          {{ errors.body }}
        </p>
      </div>

      <p
        v-if="sendError"
        role="alert"
        class="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-body-sm text-danger"
      >
        {{ sendError }}
      </p>

      <div>
        <VcsButton type="submit" :loading="sending">
          Send message
        </VcsButton>
      </div>
    </form>
  </VcsCard>
</template>

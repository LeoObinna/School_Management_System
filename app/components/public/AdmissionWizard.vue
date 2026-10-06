<script setup lang="ts">
/**
 * AdmissionWizard — public multi-step application form (Phase 18C).
 *
 * Steps: child → guardian → academic → review → success. Per-step
 * validation uses the shared publicApplicationSchema field shapes; the
 * final submit posts to /api/v1/public/admissions/applications. The
 * hidden `_website` honeypot is always submitted empty by real users.
 *
 * On success only the application number is shown — the API never
 * echoes applicant data. The parent is told to keep the number + the
 * guardian contact used, which the status checker requires.
 */
import { submitPublicApplication } from '~/services/public'
import type { PublicApplication } from '~/shared/schemas/public'

const props = defineProps<{
  classes: { id: string; name: string; level: string | null }[]
}>()

const emit = defineEmits<{
  submitted: [applicationNumber: string]
}>()

const STEP_TITLES = ['Child', 'Guardian', 'Academic', 'Review'] as const
const step = ref(0)
const submitting = ref(false)
const submitError = ref('')
const applicationNumber = ref('')

const form = reactive({
  firstName: '',
  lastName: '',
  otherNames: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  dateOfBirth: '',
  nationality: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  address: '',
  previousSchool: '',
  intendedClassId: '',
  // Honeypot — invisible to humans, must stay empty.
  _website: '',
})

const errors = reactive<Record<string, string>>({})

const classOptions = computed(() =>
  props.classes.map((c) => ({
    label: c.level ? `${c.level} — ${c.name}` : c.name,
    value: c.id,
  })),
)

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

function validateStep(current: number): boolean {
  clearErrors()
  if (current === 0) {
    if (!form.firstName.trim()) errors.firstName = 'First name is required.'
    if (!form.lastName.trim()) errors.lastName = 'Last name is required.'
  } else if (current === 1) {
    if (!form.guardianName.trim()) {
      errors.guardianName = 'Guardian name is required.'
    }
    if (!form.guardianEmail.trim() && !form.guardianPhone.trim()) {
      errors.guardianEmail = 'Provide an email address or phone number.'
    }
    if (form.guardianEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.guardianEmail.trim())) {
      errors.guardianEmail = 'Enter a valid email address.'
    }
  }
  return Object.keys(errors).length === 0
}

function next() {
  if (!validateStep(step.value)) return
  step.value = Math.min(step.value + 1, STEP_TITLES.length - 1)
}

function back() {
  clearErrors()
  step.value = Math.max(step.value - 1, 0)
}

function orNull(value: string): string | null {
  const v = value.trim()
  return v === '' ? null : v
}

async function submit() {
  if (!validateStep(0) || !validateStep(1)) {
    step.value = 0
    return
  }
  submitting.value = true
  submitError.value = ''
  try {
    const payload: PublicApplication = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      otherNames: orNull(form.otherNames),
      gender: form.gender === '' ? null : form.gender,
      dateOfBirth: orNull(form.dateOfBirth),
      nationality: orNull(form.nationality),
      guardianName: form.guardianName.trim(),
      guardianPhone: orNull(form.guardianPhone),
      guardianEmail: orNull(form.guardianEmail),
      address: orNull(form.address),
      previousSchool: orNull(form.previousSchool),
      intendedClassId: orNull(form.intendedClassId),
      _website: form._website,
    }
    const res = await submitPublicApplication(payload)
    applicationNumber.value = res.applicationNumber
    emit('submitted', res.applicationNumber)
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    submitError.value =
      status === 429
        ? 'Too many attempts. Please wait a while and try again, or contact the school office.'
        : 'The application could not be submitted. Please check the details and try again.'
  } finally {
    submitting.value = false
  }
}

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
]

const reviewRows = computed(() => [
  { label: 'Child', value: `${form.firstName} ${form.otherNames} ${form.lastName}`.replace(/\s+/g, ' ').trim() },
  { label: 'Gender', value: form.gender || '—' },
  { label: 'Date of birth', value: form.dateOfBirth || '—' },
  { label: 'Nationality', value: form.nationality || '—' },
  { label: 'Guardian', value: form.guardianName },
  { label: 'Guardian phone', value: form.guardianPhone || '—' },
  { label: 'Guardian email', value: form.guardianEmail || '—' },
  { label: 'Address', value: form.address || '—' },
  { label: 'Previous school', value: form.previousSchool || '—' },
  {
    label: 'Intended class',
    value:
      props.classes.find((c) => c.id === form.intendedClassId)?.name ?? '—',
  },
])
</script>

<template>
  <!-- Success state -->
  <VcsCard v-if="applicationNumber" class="border-success/30 bg-success/10">
    <h3 class="font-display text-h4 text-brand-primary">
      Application received
    </h3>
    <p class="mt-3 text-body text-text-secondary">
      Your application number is
      <strong class="font-mono text-body-lg text-text-primary">{{ applicationNumber }}</strong>
    </p>
    <p class="mt-3 text-body text-text-secondary">
      Keep this number safe. Together with the guardian email or phone number
      you provided, it lets you check the application status at any time on
      this page.
    </p>
    <p class="mt-3 text-body-sm text-text-muted">
      The school will contact you about the next steps (documents and
      assessment).
    </p>
  </VcsCard>

  <VcsCard v-else>
    <!-- Step indicator -->
    <ol class="flex flex-wrap items-center gap-2" aria-label="Application progress">
      <li
        v-for="(title, i) in STEP_TITLES"
        :key="title"
        class="flex items-center gap-2"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full text-body-sm font-semibold"
          :class="
            i < step
              ? 'bg-brand-accent text-white'
              : i === step
                ? 'bg-brand-primary text-text-inverse'
                : 'bg-surface-muted text-text-muted'
          "
          :aria-current="i === step ? 'step' : undefined"
        >
          {{ i + 1 }}
        </span>
        <span
          class="text-body-sm"
          :class="i === step ? 'font-semibold text-text-primary' : 'text-text-muted'"
        >
          {{ title }}
        </span>
        <span v-if="i < STEP_TITLES.length - 1" class="mx-1 text-text-muted" aria-hidden="true">›</span>
      </li>
    </ol>

    <form class="mt-8" novalidate @submit.prevent>
      <!-- Honeypot: hidden from humans, bots fill it. -->
      <div class="hidden" aria-hidden="true">
        <label>
          Website
          <input v-model="form._website" type="text" name="_website" tabindex="-1" autocomplete="off">
        </label>
      </div>

      <!-- Step 1: child -->
      <fieldset v-show="step === 0">
        <legend class="sr-only">Child information</legend>
        <div class="grid gap-5 md:grid-cols-2">
          <VcsInput v-model="form.firstName" label="First name" required :error="errors.firstName" autocomplete="given-name" />
          <VcsInput v-model="form.lastName" label="Last name" required :error="errors.lastName" autocomplete="family-name" />
          <VcsInput v-model="form.otherNames" label="Other names" autocomplete="additional-name" />
          <VcsSelect v-model="form.gender" label="Gender" :options="genderOptions" placeholder="Select gender" />
          <VcsInput v-model="form.dateOfBirth" label="Date of birth" type="date" />
          <VcsInput v-model="form.nationality" label="Nationality" autocomplete="country-name" />
        </div>
      </fieldset>

      <!-- Step 2: guardian -->
      <fieldset v-show="step === 1">
        <legend class="sr-only">Guardian information</legend>
        <div class="grid gap-5 md:grid-cols-2">
          <VcsInput v-model="form.guardianName" label="Guardian full name" required :error="errors.guardianName" autocomplete="name" />
          <VcsInput v-model="form.guardianPhone" label="Guardian phone" type="tel" inputmode="tel" autocomplete="tel" />
          <VcsInput
            v-model="form.guardianEmail"
            label="Guardian email"
            type="email"
            inputmode="email"
            autocomplete="email"
            :error="errors.guardianEmail"
            description="At least one of email or phone is required — you will use it to check the application status."
          />
          <VcsInput v-model="form.address" label="Home address" autocomplete="street-address" />
        </div>
      </fieldset>

      <!-- Step 3: academic -->
      <fieldset v-show="step === 2">
        <legend class="sr-only">Academic information</legend>
        <div class="grid gap-5 md:grid-cols-2">
          <VcsSelect
            v-model="form.intendedClassId"
            label="Intended class"
            :options="classOptions"
            placeholder="Select a class"
            description="The class you are applying for."
          />
          <VcsInput v-model="form.previousSchool" label="Previous school (if any)" />
        </div>
      </fieldset>

      <!-- Step 4: review -->
      <fieldset v-show="step === 3">
        <legend class="sr-only">Review and submit</legend>
        <dl class="grid gap-x-8 gap-y-3 md:grid-cols-2">
          <div v-for="row in reviewRows" :key="row.label" class="flex flex-col">
            <dt class="text-caption font-semibold uppercase tracking-wide text-text-muted">
              {{ row.label }}
            </dt>
            <dd class="text-body text-text-primary">{{ row.value }}</dd>
          </div>
        </dl>
        <p
          v-if="submitError"
          role="alert"
          class="mt-5 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-body-sm text-danger"
        >
          {{ submitError }}
        </p>
      </fieldset>

      <!-- Navigation -->
      <div class="mt-8 flex items-center justify-between">
        <VcsButton v-if="step > 0" variant="ghost" :disabled="submitting" @click="back">
          Back
        </VcsButton>
        <span v-else />
        <VcsButton v-if="step < STEP_TITLES.length - 1" @click="next">
          Continue
        </VcsButton>
        <VcsButton v-else :loading="submitting" @click="submit">
          Submit application
        </VcsButton>
      </div>
    </form>
  </VcsCard>
</template>

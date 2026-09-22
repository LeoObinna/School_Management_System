<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { schoolSettingsApi } from '~/services/school-settings'
import { formatApiError } from '~/utils/errors'
import type { SchoolSettings } from '~/shared/types'

definePageMeta({ permissions: ['school.settings.view'] })

const auth = useAuthStore()
const canUpdate = computed(() => auth.can('school.settings.update'))

const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const savedAt = ref<string | null>(null)

const form = reactive<SchoolSettings>({
  name: '',
  motto: '',
  address: '',
  email: '',
  phone: '',
  logoKey: '',
  primaryColor: '',
  secondaryColor: '',
  currency: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  academicYearStartMonth: null,
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const data = await schoolSettingsApi.get()
    Object.assign(form, data)
  } catch (err) {
    loadError.value = formatApiError(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  savedAt.value = null
  try {
    const patch: Record<string, unknown> = { ...form }
    if (
      form.academicYearStartMonth === null ||
      form.academicYearStartMonth === undefined
    ) {
      patch.academicYearStartMonth = null
    }
    const updated = await schoolSettingsApi.update(patch)
    Object.assign(form, updated)
    savedAt.value = new Date().toLocaleTimeString()
  } catch (err) {
    saveError.value = formatApiError(err)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-page">
    <header class="page-header">
      <div>
        <h1>School Settings</h1>
        <p class="muted">School identity, branding and bank details. Changes take effect immediately.</p>
      </div>
    </header>

    <p v-if="loading" class="muted">Loading settings…</p>
    <p v-else-if="loadError" class="error">Could not load settings: {{ loadError }}</p>

    <form v-if="!loading && !loadError" class="settings-form" @submit.prevent="save">
      <section class="settings-group">
        <h2>Identity</h2>
        <label>
          <span>School name</span>
          <input v-model="form.name" type="text" maxlength="200" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Motto</span>
          <input v-model="form.motto" type="text" maxlength="300" :disabled="!canUpdate" />
        </label>
      </section>

      <section class="settings-group">
        <h2>Contact</h2>
        <label>
          <span>Address</span>
          <input v-model="form.address" type="text" maxlength="500" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Email</span>
          <input v-model="form.email" type="email" maxlength="255" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Phone</span>
          <input v-model="form.phone" type="tel" maxlength="50" :disabled="!canUpdate" />
        </label>
      </section>

      <section class="settings-group">
        <h2>Branding</h2>
        <label>
          <span>Logo (R2 object key)</span>
          <input v-model="form.logoKey" type="text" maxlength="300" :disabled="!canUpdate" placeholder="e.g. logos/school.png" />
        </label>
        <label>
          <span>Primary color</span>
          <input v-model="form.primaryColor" type="color" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Secondary color</span>
          <input v-model="form.secondaryColor" type="color" :disabled="!canUpdate" />
        </label>
      </section>

      <section class="settings-group">
        <h2>Bank details</h2>
        <label>
          <span>Bank name</span>
          <input v-model="form.bankName" type="text" maxlength="200" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Account name</span>
          <input v-model="form.accountName" type="text" maxlength="200" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Account number</span>
          <input v-model="form.accountNumber" type="text" maxlength="50" :disabled="!canUpdate" />
        </label>
      </section>

      <section class="settings-group">
        <h2>Academics &amp; Finance</h2>
        <label>
          <span>Currency (ISO 4217)</span>
          <input v-model="form.currency" type="text" maxlength="3" :disabled="!canUpdate" />
        </label>
        <label>
          <span>Academic year start month</span>
          <select v-model.number="form.academicYearStartMonth" :disabled="!canUpdate">
            <option :value="null">— not set —</option>
            <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
      </section>

      <div class="form-actions">
        <button type="submit" :disabled="!canUpdate || saving">
          {{ saving ? 'Saving…' : 'Save settings' }}
        </button>
        <span v-if="savedAt" class="saved">Saved at {{ savedAt }}</span>
        <span v-if="saveError" class="error">{{ saveError }}</span>
        <span v-if="!canUpdate" class="muted">You do not have permission to change settings.</span>
      </div>
    </form>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem;
}
.page-header h1 {
  margin: 0 0 0.25rem;
}
.muted {
  color: #666;
  font-size: 0.9rem;
}
.error {
  color: #b71c1c;
}
.settings-group {
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}
.settings-group h2 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #1a237e;
}
label {
  display: block;
  margin-bottom: 0.75rem;
}
label span {
  display: block;
  font-size: 0.85rem;
  color: #333;
  margin-bottom: 0.25rem;
}
input[type='text'],
input[type='email'],
input[type='tel'],
input[type='color'],
select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
input[type='color'] {
  height: 2.5rem;
  padding: 2px;
}
.form-actions {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
button {
  padding: 0.5rem 1.25rem;
  background: #1a237e;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.saved {
  color: #2e7d32;
  font-size: 0.9rem;
}
</style>

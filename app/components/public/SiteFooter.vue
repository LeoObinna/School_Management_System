<script setup lang="ts">
/**
 * Public site footer. Deep brand-blue surface with the wordmark,
 * italic motto (08 §10), navigation and portal actions.
 *
 * Content rules (08 §66): only canonical facts — school name, motto,
 * Ojodu • Lagos. No invented phone/email/address lines; contact
 * details live on the contact page once Phase 18C ships them.
 */
import { publicActions, publicNavLinks } from './links'

const year = new Date().getFullYear()

const exploreLinks = publicNavLinks.filter((link) => link.to !== '/')

const portalLinks = publicActions.filter(
  (action) => action.label !== 'Apply Now',
)
</script>

<template>
  <footer class="site-footer bg-brand-primary text-text-inverse">
    <div class="mx-auto max-w-content px-5 py-14 md:px-6 xl:px-8">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Identity -->
        <div>
          <p class="text-h5 font-extrabold tracking-[0.04em]">VICTORIOUS</p>
          <p class="mt-1 text-label font-semibold tracking-[0.2em] text-white/85">
            CHILDREN SCHOOL
          </p>
          <p class="mt-1 text-caption tracking-[0.16em] text-white/75">
            OJODU • LAGOS — NIGERIA
          </p>
          <p class="mt-6 font-display text-xl italic text-brand-accent">
            Not to Equal, But to Excel
          </p>
        </div>

        <!-- Explore -->
        <nav aria-label="Footer">
          <h2 class="text-label uppercase tracking-[0.16em] text-white/75">
            Explore
          </h2>
          <ul class="mt-4 space-y-2">
            <li v-for="link in exploreLinks" :key="link.to">
              <NuxtLink
                :to="link.to"
                class="text-body-sm text-white/90 transition-colors hover:text-brand-accent"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <!-- Portal -->
        <div>
          <h2 class="text-label uppercase tracking-[0.16em] text-white/75">
            Portal
          </h2>
          <ul class="mt-4 space-y-2">
            <li v-for="action in portalLinks" :key="action.label">
              <NuxtLink
                :to="action.to"
                class="text-body-sm text-white/90 transition-colors hover:text-brand-accent"
              >
                {{ action.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h2 class="text-label uppercase tracking-[0.16em] text-white/75">
            Contact
          </h2>
          <p class="mt-4 text-body-sm text-white/90">
            Victorious Children School<br>
            Ojodu, Lagos, Nigeria
          </p>
          <p class="mt-3 text-body-sm text-white/75">
            Enquiries and visits:
            <NuxtLink
              to="/contact"
              class="underline underline-offset-4 hover:text-brand-accent"
            >
              contact the school
            </NuxtLink>
          </p>
        </div>
      </div>

      <div
        class="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-caption text-white/75">
          © {{ year }} Victorious Children School, Ojodu, Lagos.
        </p>
        <p class="font-display text-base italic text-white/85">
          Not to Equal, But to Excel
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
/* Focus must stay visible on the dark footer surface (08 §55). */
.site-footer :focus-visible {
  outline-color: var(--color-brand-accent);
}
</style>

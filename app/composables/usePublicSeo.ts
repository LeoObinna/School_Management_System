/**
 * SEO defaults for public website pages (Phase 18). Applies the school
 * name title template and matching Open Graph/Twitter metadata; every
 * public page should call this once with its description.
 */
export function usePublicSeo(options: {
  title: string
  description: string
  path?: string
}) {
  const school = 'Victorious Children School'
  const fullTitle =
    options.title === school ? school : `${options.title} — ${school}`

  useHead({
    title: fullTitle,
    meta: [{ name: 'description', content: options.description }],
  })

  useSeoMeta({
    ogTitle: fullTitle,
    ogDescription: options.description,
    ogType: 'website',
    ogSiteName: school,
    ogUrl: options.path,
    twitterCard: 'summary_large_image',
    twitterTitle: fullTitle,
    twitterDescription: options.description,
  })
}

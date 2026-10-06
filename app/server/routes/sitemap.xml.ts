/**
 * GET /sitemap.xml — dynamic sitemap (Phase 18D).
 *
 * Static public pages plus the currently published news items and
 * gallery albums (ids only — exactly what the public endpoints would
 * answer; drafts/unpublished never appear). Absolute URLs are built
 * from the request origin so the same route works locally and in
 * production without a hard-coded domain.
 */
import { defineEventHandler, getRequestURL, setHeader } from 'h3'
import { getPublicAlbums, getPublicNews } from '../services/public'

const STATIC_PATHS: { path: string; priority: string; frequency: string }[] = [
  { path: '/', priority: '1.0', frequency: 'weekly' },
  { path: '/about', priority: '0.7', frequency: 'monthly' },
  { path: '/academics', priority: '0.8', frequency: 'monthly' },
  { path: '/admissions', priority: '0.9', frequency: 'monthly' },
  { path: '/fees', priority: '0.8', frequency: 'monthly' },
  { path: '/news', priority: '0.7', frequency: 'daily' },
  { path: '/events', priority: '0.7', frequency: 'weekly' },
  { path: '/gallery', priority: '0.6', frequency: 'weekly' },
  { path: '/results/checker', priority: '0.6', frequency: 'monthly' },
  { path: '/contact', priority: '0.6', frequency: 'yearly' },
]

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  const origin = getRequestURL(event).origin

  // Published content only; generous page size so one call covers a
  // school site. The services apply the publication gates themselves.
  const [news, albums] = await Promise.all([
    getPublicNews({ page: 1, perPage: 1000 }),
    getPublicAlbums({ page: 1, perPage: 1000 }),
  ])

  const urls: string[] = []
  const entry = (
    loc: string,
    options: { lastmod?: string | null; priority?: string; frequency?: string } = {},
  ) => {
    urls.push(
      [
        `<loc>${escapeXml(new URL(loc, origin).href)}</loc>`,
        options.lastmod ? `<lastmod>${escapeXml(options.lastmod)}</lastmod>` : '',
        options.frequency ? `<changefreq>${options.frequency}</changefreq>` : '',
        options.priority ? `<priority>${options.priority}</priority>` : '',
      ]
        .filter(Boolean)
        .join(''),
    )
  }

  for (const page of STATIC_PATHS) {
    entry(page.path, {
      priority: page.priority,
      frequency: page.frequency,
    })
  }
  for (const item of news.data) {
    entry(`/news/${item.id}`, {
      lastmod: item.publishedAt,
      priority: '0.6',
      frequency: 'monthly',
    })
  }
  for (const album of albums.data) {
    entry(`/gallery#${album.id}`, {
      priority: '0.5',
      frequency: 'monthly',
    })
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((body) => `<url>${body}</url>`),
    '</urlset>',
  ].join('\n')

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})

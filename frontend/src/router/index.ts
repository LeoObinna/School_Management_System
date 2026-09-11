import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'

/**
 * Route foundation. Business pages arrive in later phases; guards will be
 * added with authentication in Phase 2. Route guards are UX only — the
 * Laravel API remains the authoritative enforcer.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'system-health',
        name: 'system-health',
        component: () => import('@/views/HealthView.vue'),
        meta: { title: 'System Health' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Not Found' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : null
  document.title = title
    ? `${title} · Victorious Children SMS`
    : 'Victorious Children SMS'
})

export default router

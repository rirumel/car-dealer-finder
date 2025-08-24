import { createRouter, createWebHistory } from 'vue-router'
import DealerFinder  from '../pages/DealerFinder.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
    path: '/',
    name: 'DealerFinder',
    component: DealerFinder,
  },
  ],
})

export default router

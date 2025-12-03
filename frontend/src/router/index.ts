import { createRouter, createWebHistory } from 'vue-router'
import Menu from '@/views/MenuCreate.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{
			path: '/',
			name: 'Menu',
			component: Menu,
		},
  ],
})

export default router

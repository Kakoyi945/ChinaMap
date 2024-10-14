import { createMemoryHistory, createRouter, createWebHashHistory } from 'vue-router'

import ChinaMap from './ChinaMap.vue'
import AboutView from './AboutView.vue'
import CropScene from './CropScene.vue'

const routes = [
  { path: '/', component: ChinaMap },
  { path: '/about', component: AboutView },
  { path: '/crop', component: CropScene },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
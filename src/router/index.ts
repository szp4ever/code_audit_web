import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import { setupPageGuard } from './permission'
import { ChatLayout } from '@/views/chat/layout'
import mjlayout from '@/views/mj/layout.vue'
import lumalayout from '@/views/luma/layout.vue'
import pptlayout from '@/views/ppt/layout.vue'
import musiclayout from '@/views/suno/layout.vue'
import knowledgelayout from '@/views/knowledge/layout.vue'
import tasklayout from '@/views/task/layout.vue'
import projectlayout from '@/views/project/layout.vue'
import knowledgeV2Routes from './modules/knowledge'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Root',
    component: ChatLayout,
    redirect: '/chat',
    children: [
      {
        path: '/chat/:uuid?',
        name: 'Chat',
        component: () => import('@/views/chat/index.vue'),
      },
    ],
  },

   {
    path: '/m',
    name: 'm',
    component: ChatLayout,
    redirect: '/m/gpt-3.5-turbo',
    children: [
      {
        path: '/m/:gid',
        name: 'Model',
        component: () => import('@/views/chat/index.vue'),
      },
    ],
  },

  {
    path: '/draw',
    name: 'Rootdraw',
    component: mjlayout,
    redirect: '/draw/index',
    children: [
      {
        path: '/draw/:uuid?',
        name: 'draw',
        component: () => import('@/views/mj/draw.vue'),
      },
    ],
  },

  {
		path: "/ppt",
		name: "Ppt",
		component: pptlayout,
		redirect: "/ppt/index",
		children: [
			{
				path: "index",
				name: "ppt",
				component: () => import('@/views/ppt/ppt.vue'),
			},
		],
	},

  {
    path: '/video',
    name: 'Video',
    component: lumalayout,
    redirect: '/video/index',
    children: [
      {
        path: '/video/:uuid?',
        name: 'video',
        component: () => import('@/views/luma/video.vue'),
      },
    ],
  },

	{
		path: "/music",
		name: "Music",
		component: musiclayout,
		redirect: "/music/index",
		children: [
			{
				path: "/music/:uuid?",
				name: "music",
				component: () => import('@/views/suno/music.vue'),
			},
		],
	},

  // [DEPRECATED] Old knowledge routes — replaced by v2 knowledgeV2Routes
  // {
  //   path: '/knowledge',
  //   name: 'Knowledge',
  //   component: knowledgelayout,
  //   redirect: '/knowledge/t',
  //   children: [
  //     {
  //       path: 't',
  //       name: 'knowledge1',
  //       component: () => import('@/views/knowledge/index.vue'),
  //     },
  //     {
  //       path: 'item/list',
  //       name: 'knowledgeItemList',
  //       component: () => import('@/views/knowledge/item/list.vue'),
  //     },
  //     {
  //       path: 'item/detail/:itemUuid',
  //       name: 'knowledgeItemDetail',
  //       component: () => import('@/views/knowledge/item/detail.vue'),
  //     },
  //     {
  //       path: 'item/:itemUuid/fragments',
  //       name: 'knowledgeItemFragments',
  //       component: () => import('@/views/knowledge/item/fragments.vue'),
  //     },
  //   ],
  // },

  {
    path: '/workflow',
    name: 'WorkflowRoot',
    component: () => import('@/views/workflow/layout.vue'),
    redirect: '/workflow/index',
    children: [
      {
        path: 'index',
        name: 'Workflow',
        component: () => import('@/views/workflow/index.vue'),
      },
    ],
  },

  {
    path: '/task',
    name: 'TaskRoot',
    component: tasklayout,
    redirect: '/task/index',
    children: [
      {
        path: 'index',
        name: 'Task',
        component: () => import('@/views/task/index.vue'),
      },
    ],
  },

  {
    path: '/project',
    name: 'ProjectRoot',
    component: projectlayout,
    redirect: '/project/index',
    children: [
      {
        path: 'index',
        name: 'Project',
        component: () => import('@/views/project/index.vue'),
      },
    ],
  },

  // [DEPRECATED] Old annex routes — replaced by v2 knowledgeV2Routes
  // {
  //   path: '/annex',
  //   name: 'Annex',
  //   component: knowledgelayout,
  //   redirect: '/annex/t',
  //   children: [
  //     {
  //       path: 't',
  //       name: 'annex1',
  //       component: () => import('@/views/knowledge/annex.vue'),
  //     },
  //     {
  //       path: 'llm-test',
  //       name: 'annexLlmTest',
  //       component: () => import('@/views/knowledge/LlmTest.vue'),
  //     },
  //   ],
  // },

  // [DEPRECATED] Old fragment routes — replaced by v2 knowledgeV2Routes
  // {
  //   path: '/fragment',
  //   name: 'Fragment',
  //   component: knowledgelayout,
  //   redirect: '/fragment/t',
  //   children: [
  //     {
  //       path: 't',
  //       name: 'fragment1',
  //       component: () => import('@/views/knowledge/fragment.vue'),
  //     },
  //   ],
  // },

  {
    path: '/404',
    name: '404',
    component: () => import('@/views/exception/404/index.vue'),
  },

  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
  },

  {
    path: '/regist',
    name: 'regist',
    component: () => import('@/views/login/regist.vue'),
  },
  {
    path: '/resetpassword',
    name: 'resetpassword',
    component: () => import('@/views/login/reset.vue'),
  },
  
  {
    path: '/500',
    name: '500',
    component: () => import('@/views/exception/500/index.vue'),
  },

  // v2 知识库模块路由
  ...knowledgeV2Routes,

  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    redirect: '/404',
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    } else {
      return { left: 0, top: 0, behavior: 'smooth' }
    }
  },
})

// ═══════════════════════════════════════════════════════
// 全局路由进度条与微交互
// ═══════════════════════════════════════════════════════
let progressTimer: ReturnType<typeof setTimeout> | null = null
const progressBar = document.createElement('div')
progressBar.id = 'router-progress'
progressBar.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, #0078d4, #005a9e);
  z-index: 9999;
  transition: width 0.2s ease, opacity 0.3s ease;
  width: 0%;
  opacity: 0;
`
document.body.appendChild(progressBar)

router.beforeEach((to, from, next) => {
  progressBar.style.width = '30%'
  progressBar.style.opacity = '1'
  if (progressTimer) clearTimeout(progressTimer)
  progressTimer = setTimeout(() => {
    progressBar.style.width = '70%'
  }, 200)
  next()
})

router.afterEach(() => {
  if (progressTimer) clearTimeout(progressTimer)
  progressBar.style.width = '100%'
  setTimeout(() => {
    progressBar.style.opacity = '0'
    setTimeout(() => {
      progressBar.style.width = '0%'
    }, 300)
  }, 200)
})

router.onError(() => {
  progressBar.style.background = '#d13438'
  progressBar.style.width = '100%'
  setTimeout(() => {
    progressBar.style.opacity = '0'
    setTimeout(() => {
      progressBar.style.width = '0%'
      progressBar.style.background = 'linear-gradient(90deg, #0078d4, #005a9e)'
    }, 300)
  }, 300)
})

setupPageGuard(router)

export async function setupRouter(app: App) {
  app.use(router)
  await router.isReady()
}


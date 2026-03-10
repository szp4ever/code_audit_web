/**
 * 知识库模块路由（v2）
 *
 * 页面结构：
 * /knowledge-v2                    → 知识库列表
 * /knowledge-v2/:kid               → 知识库详情（Tab 布局，通过 ?tab=xxx 切换）
 * /knowledge-v2/:kid/items/:uuid   → 条目详情页
 *
 * 使用 knowledgelayout 包裹，保留全局左侧导航栏（aiSider）
 */
import type { RouteRecordRaw } from 'vue-router'
import knowledgelayout from '@/views/knowledge/layout.vue'

const knowledgeV2Routes: RouteRecordRaw[] = [
  {
    path: '/knowledge-v2',
    name: 'KnowledgeV2',
    component: knowledgelayout,
    redirect: '/knowledge-v2/list',
    children: [
      {
        path: 'list',
        name: 'KnowledgeV2List',
        component: () => import('@/views/knowledge-v2/KnowledgeListPage.vue'),
        meta: { title: '知识库', icon: 'mdi:book-open-variant' },
      },
      {
        path: ':kid',
        name: 'KnowledgeV2Detail',
        component: () => import('@/views/knowledge-v2/KnowledgeDetailPage.vue'),
        meta: { title: '知识库详情' },
      },
      {
        path: ':kid/items/:uuid',
        name: 'KnowledgeV2ItemDetail',
        component: () => import('@/views/knowledge-v2/ItemDetailPage.vue'),
        meta: { title: '条目详情' },
      },
    ],
  },
]

export default knowledgeV2Routes

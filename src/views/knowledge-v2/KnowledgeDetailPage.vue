<script setup lang="ts">
/**
 * 知识库详情页（v2）
 *
 * 功能：面包屑导航、知识库头部信息、5-Tab 布局（文档/片段/条目/AI工作台/设置）、
 *       URL 同步当前 Tab、provide 注入知识库信息给子 Tab、实时统计刷新
 */
import { ref, computed, watch, provide, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NBreadcrumb, NBreadcrumbItem, NTabs, NTabPane, NTag, NSpace,
  NButton, NTooltip, NSpin, NSkeleton, NEllipsis, NDivider,
  useMessage,
} from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { getKnowledgeBase, type KnowledgeVo } from '@/api/v2/knowledgeBase'
import { getDictDataByType } from '@/api/dict'

// 子 Tab 组件
import DocumentTab from './tabs/DocumentTab.vue'
import FragmentTab from './tabs/FragmentTab.vue'
import ItemTab from './tabs/ItemTab.vue'
import MonitorTab from './tabs/MonitorTab.vue'
import AiWorkbenchTab from './tabs/AiWorkbenchTab.vue'
import SettingsTab from './tabs/SettingsTab.vue'
import UploadTrigger from '@/components/knowledge/upload/UploadTrigger.vue'
import UploadTaskDrawer from '@/components/knowledge/upload/UploadTaskDrawer.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

// ========== 状态 ==========

const loading = ref(true)
const loadError = ref(false)
const knowledgeBase = ref<KnowledgeVo | null>(null)
const kid = computed(() => route.params.kid as string)

// 分类字典映射
const categoryOptions = ref<Array<{ label: string; value: string }>>([])
const categoryLabelMap = computed<Record<string, string>>(() => {
  return Object.fromEntries(categoryOptions.value.map(opt => [opt.value, opt.label]))
})
// 根据分类值获取中文标签
const categoryLabel = computed(() => {
  if (!knowledgeBase.value?.category) return ''
  return categoryLabelMap.value[knowledgeBase.value.category] || knowledgeBase.value.category
})

// Tab 状态：从 URL hash 或 query 恢复，默认 documents
const tabNameMap: Record<string, string> = {
  documents: '文档',
  fragments: '片段',
  items: '条目',
  monitor: '监控',
  ai: 'AI 工作台',
  settings: '设置',
}
const validTabs = Object.keys(tabNameMap)

const activeTab = ref<string>('documents')

/** 可见的 Tab 列表（AI 工作台入口已隐藏，仅保留逻辑） */
const visibleTabs = ['documents', 'fragments', 'items', 'monitor', 'settings'] as const
/** 可见 Tab 的 [name, label] 列表，用于渲染（排除 ai） */
const visibleTabEntries = computed(() =>
  Object.entries(tabNameMap).filter(([name]) => name !== 'ai')
)

// 从 URL 恢复 Tab
function initTabFromRoute() {
  let targetTab = 'documents'
  // 优先从子路由 path 推断
  const childPath = route.path.split('/').pop()
  if (childPath && validTabs.includes(childPath)) {
    targetTab = visibleTabs.includes(childPath as any) ? childPath : 'documents'
  } else {
    // 其次从 query 参数
    const tabQuery = route.query.tab as string
    if (tabQuery && validTabs.includes(tabQuery)) {
      targetTab = visibleTabs.includes(tabQuery as any) ? tabQuery : 'documents'
    }
  }
  activeTab.value = targetTab
  // 若 URL 指向已隐藏的 ai，同步清除
  if (route.query.tab === 'ai') {
    router.replace({ path: route.path, query: { ...route.query, tab: targetTab } })
  }
}

// Tab 切换时同步 URL
function handleTabChange(tabName: string) {
  activeTab.value = tabName
  router.replace({
    path: route.path,
    query: { ...route.query, tab: tabName },
  })
}

// ========== 数据加载 ==========

async function fetchKnowledgeBase() {
  if (!kid.value) return
  loading.value = true
  loadError.value = false
  try {
    const res: any = await getKnowledgeBase(kid.value)
    if (res.code === 200 && res.data) {
      knowledgeBase.value = res.data
    } else {
      loadError.value = true
      message.error('加载知识库信息失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    loadError.value = true
    message.error('加载失败：' + (error.message || '网络错误'))
  } finally {
    loading.value = false
  }
}

// 加载分类字典
async function loadCategoryOptions() {
  try {
    const res: any = await getDictDataByType('knowledge_category')
    if (res.code === 200 && Array.isArray(res.data)) {
      categoryOptions.value = res.data.map((item: any) => ({
        label: item.dictLabel,
        value: item.dictValue,
      }))
    }
  } catch {
    // 字典加载失败不阻塞页面
  }
}

/** 供子 Tab 调用，刷新知识库统计信息 */
async function refreshKnowledgeBase() {
  await fetchKnowledgeBase()
}

// ========== Provide 给子组件 ==========

provide('kid', kid)
provide('knowledgeBase', knowledgeBase)
provide('refreshKnowledgeBase', refreshKnowledgeBase)

// ========== 统计项 ==========

interface StatBadge {
  label: string
  value: number | string
  icon: string
  color: string
  tab?: string
}

const statBadges = computed<StatBadge[]>(() => {
  const kb = knowledgeBase.value
  if (!kb) return []
  return [
    { label: '文档', value: kb.attachCount ?? 0, icon: 'mdi:file-document-multiple-outline', color: '#ca5010', tab: 'documents' },
    { label: '片段', value: kb.fragmentCount ?? 0, icon: 'mdi:puzzle-outline', color: '#8764b8', tab: 'fragments' },
    { label: '条目', value: kb.itemCount ?? 0, icon: 'mdi:file-document-edit-outline', color: '#0078d4', tab: 'items' },
  ]
})

// ========== Tab 图标映射 ==========

const tabIcons: Record<string, string> = {
  documents: 'mdi:file-upload-outline',
  fragments: 'mdi:puzzle-outline',
  items: 'mdi:file-document-edit-outline',
  monitor: 'mdi:chart-areaspline',
  ai: 'mdi:robot-outline',
  settings: 'mdi:cog-outline',
}

// ========== 生命周期 ==========

onMounted(() => {
  initTabFromRoute()
  loadCategoryOptions()
  fetchKnowledgeBase()
})

// 路由参数变化时重新加载
watch(kid, (newKid) => {
  if (newKid) fetchKnowledgeBase()
})

// 路由 query 变化时同步 Tab（如 DocumentTab "查看片段" 跳转）
watch(() => route.query, () => {
  initTabFromRoute()
}, { deep: true })
</script>

<template>
  <div class="knowledge-detail-page">
    <!-- 面包屑 -->
    <NBreadcrumb class="breadcrumb">
      <NBreadcrumbItem class="breadcrumb-clickable" @click="router.push('/knowledge-v2/list')">
        <span class="breadcrumb-item-content">
          <SvgIcon icon="mdi:book-open-variant" style="margin-right: 4px; flex-shrink: 0" />
          <span>知识库</span>
        </span>
      </NBreadcrumbItem>
      <NBreadcrumbItem>
        <span class="breadcrumb-item-content">
          <template v-if="knowledgeBase">{{ knowledgeBase.kname }}</template>
          <NSkeleton v-else :width="80" :height="14" text />
        </span>
      </NBreadcrumbItem>
    </NBreadcrumb>

    <!-- 知识库头部信息 -->
    <div class="kb-header">
      <div v-if="loading && !knowledgeBase" class="kb-header-skeleton">
        <NSkeleton :width="200" :height="24" style="margin-bottom: 8px" />
        <NSkeleton :width="400" :height="14" />
      </div>
      <div v-else-if="loadError && !knowledgeBase" style="text-align: center; padding: 40px 0">
        <p style="color: #a19f9d; margin-bottom: 12px">加载知识库信息失败</p>
        <NButton type="primary" @click="fetchKnowledgeBase">
          <template #icon><SvgIcon icon="mdi:refresh" /></template>
          重试
        </NButton>
      </div>
      <template v-else-if="knowledgeBase">
        <div class="kb-header-main">
          <div class="kb-header-left">
            <h1 class="kb-name">
              <NEllipsis :line-clamp="1" :tooltip="{ width: 400 }">{{ knowledgeBase.kname }}</NEllipsis>
            </h1>
            <NTag
              v-if="knowledgeBase.category"
              size="small"
              round
              :bordered="false"
              type="info"
            >
              {{ categoryLabel }}
            </NTag>
            <NTag
              v-if="knowledgeBase.vectorModelName"
              size="small"
              round
              :bordered="false"
              type="success"
            >
              <template #icon><SvgIcon icon="mdi:vector-polyline" style="font-size: 12px" /></template>
              {{ knowledgeBase.vectorModelName }}
            </NTag>
          </div>
          <NSpace :size="12" align="center">
            <NTooltip v-for="stat in statBadges" :key="stat.label" trigger="hover">
              <template #trigger>
                <div
                  class="stat-badge stat-badge--clickable"
                  @click="stat.tab && handleTabChange(stat.tab)"
                >
                  <SvgIcon :icon="stat.icon" :style="{ color: stat.color, fontSize: '14px' }" />
                  <span class="stat-badge-value">{{ stat.value }}</span>
                  <span class="stat-badge-label">{{ stat.label }}</span>
                </div>
              </template>
              {{ stat.tab ? `查看${stat.label}` : stat.label }}
            </NTooltip>
            <NDivider vertical style="margin: 0 4px" />
            <UploadTrigger show-label />
          </NSpace>
        </div>
        <NEllipsis v-if="knowledgeBase.description" :line-clamp="2" :tooltip="{ width: 500 }" class="kb-description">
          {{ knowledgeBase.description }}
        </NEllipsis>
      </template>
    </div>

    <!-- 5-Tab 导航（KeepAlive 保持切换时状态） -->
    <NTabs
      :value="activeTab"
      type="line"
      animated
      class="kb-tabs"
      @update:value="handleTabChange"
    >
      <NTabPane
        v-for="[name, label] in visibleTabEntries"
        :key="name"
        :name="name"
        :tab="label"
      >
        <template #tab>
          <NSpace :size="6" align="center">
            <SvgIcon :icon="tabIcons[name]" style="font-size: 16px" />
            <span>{{ label }}</span>
          </NSpace>
        </template>

        <!-- Tab 内容：每 Pane 独立 KeepAlive，切换时缓存状态 -->
        <div class="tab-content">
          <KeepAlive v-if="name === 'documents'" :max="1">
            <DocumentTab />
          </KeepAlive>
          <KeepAlive v-else-if="name === 'fragments'" :max="1">
            <FragmentTab />
          </KeepAlive>
          <KeepAlive v-else-if="name === 'items'" :max="1">
            <ItemTab />
          </KeepAlive>
          <KeepAlive v-else-if="name === 'monitor'" :max="1">
            <MonitorTab />
          </KeepAlive>
          <KeepAlive v-else-if="name === 'ai'" :max="1">
            <AiWorkbenchTab />
          </KeepAlive>
          <KeepAlive v-else-if="name === 'settings'" :max="1">
            <SettingsTab />
          </KeepAlive>
        </div>
      </NTabPane>
    </NTabs>

    <!-- 传输列表抽屉（常驻入口，各 Tab 均可打开） -->
    <UploadTaskDrawer />
  </div>
</template>

<style scoped>
.knowledge-detail-page {
  padding: 16px 32px;
  max-width: 1800px;
  margin: 0 auto;
}

.breadcrumb {
  margin-bottom: 16px;
}
.breadcrumb :deep(.n-breadcrumb-item__link) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.breadcrumb :deep(.n-breadcrumb-item__separator) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.breadcrumb-item-content {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.breadcrumb-clickable {
  cursor: pointer;
}
.breadcrumb-clickable:hover {
  color: #0078d4;
}

.kb-header {
  margin-bottom: 20px;
}

.kb-header-skeleton {
  padding: 8px 0;
}

.kb-header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.kb-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kb-name {
  font-size: 22px;
  font-weight: 600;
  color: #323130;
  margin: 0;
}

.kb-description {
  font-size: 13px;
  color: #605e5c;
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f3f2f1;
  border-radius: 12px;
  font-size: 13px;
  transition: all 0.2s ease;
}

.stat-badge--clickable {
  cursor: pointer;
}
.stat-badge--clickable:hover {
  background: #edebe9;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}

.stat-badge-value {
  font-weight: 600;
  color: #323130;
  font-variant-numeric: tabular-nums;
}

.stat-badge-label {
  color: #605e5c;
}

.kb-tabs {
  margin-top: 4px;
}

.tab-content {
  padding: 16px 0;
  min-height: 400px;
}
</style>

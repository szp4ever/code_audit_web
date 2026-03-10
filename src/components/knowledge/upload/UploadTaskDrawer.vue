<script setup lang="ts">
/**
 * 上传任务抽屉组件
 *
 * 任务管理面板，按知识库分组展示任务列表
 */
import { ref, computed } from 'vue'
import {
  NDrawer, NDrawerContent,
  NButton, NSpace, NInput, NTag,
  NEmpty, NDivider,
} from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { useUploadStore, type UploadTask } from '@/store/modules/upload'
import { uploadService } from '@/services/uploadService'
import UploadTaskCard from './UploadTaskCard.vue'

const store = useUploadStore()

// 搜索关键词
const searchKeyword = ref('')

// 活跃筛选标签
const filterTag = ref<'all' | 'active' | 'completed' | 'error'>('all')

// 折叠的知识库组
const collapsedGroups = ref<Set<string>>(new Set())

// 筛选后的任务列表
const filteredTasks = computed(() => {
  let tasks = store.taskList

  // 按状态筛选
  if (filterTag.value === 'active') {
    tasks = tasks.filter(t => t.status === 'uploading' || t.status === 'processing')
  } else if (filterTag.value === 'completed') {
    tasks = tasks.filter(t => t.status === 'completed')
  } else if (filterTag.value === 'error') {
    tasks = tasks.filter(t => t.status === 'error')
  }

  // 按关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase()
    tasks = tasks.filter(t => t.fileName.toLowerCase().includes(keyword))
  }

  return tasks
})

// 按知识库分组
const groupedTasks = computed(() => {
  const groups = new Map<string, UploadTask[]>()
  filteredTasks.value.forEach(task => {
    const list = groups.get(task.kid) || []
    list.push(task)
    groups.set(task.kid, list)
  })
  return groups
})

// 知识库列表（保持原始顺序）
const knowledgeBaseList = computed(() => Array.from(groupedTasks.value.keys()))

// 切换组折叠状态
function toggleGroup(kid: string) {
  if (collapsedGroups.value.has(kid)) {
    collapsedGroups.value.delete(kid)
  } else {
    collapsedGroups.value.add(kid)
  }
}

// 展开所有组
function expandAll() {
  collapsedGroups.value.clear()
}

// 折叠所有组
function collapseAll() {
  knowledgeBaseList.value.forEach(kid => collapsedGroups.value.add(kid))
}

// 展开有进行中的组
function expandActive() {
  collapsedGroups.value.clear()
  knowledgeBaseList.value.forEach(kid => {
    const tasks = groupedTasks.value.get(kid) || []
    const hasActive = tasks.some(t => t.status === 'uploading' || t.status === 'processing')
    if (!hasActive) {
      collapsedGroups.value.add(kid)
    }
  })
}

// 清空已完成
function clearCompleted() {
  store.clearCompleted()
}

// 清空失败
function clearFailed() {
  store.clearFailed()
}

// 重试所有失败
function retryAllFailed() {
  uploadService.retryAllFailed()
}

// 获取知识库标题
function getGroupTitle(kid: string, tasks: UploadTask[]): string {
  const firstTask = tasks[0]
  return firstTask?.knowledgeBaseName || `知识库 ${kid.slice(0, 8)}...`
}

// 获取组统计
function getGroupStats(tasks: UploadTask[]) {
  return {
    uploading: tasks.filter(t => t.status === 'uploading').length,
    processing: tasks.filter(t => t.status === 'processing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    error: tasks.filter(t => t.status === 'error').length,
  }
}

// 关闭抽屉
function closeDrawer() {
  store.closeDrawer()
}
</script>

<template>
  <NDrawer
    :show="store.drawerVisible"
    :width="620"
    placement="right"
    :mask-closable="true"
    :trap-focus="false"
    :block-scroll="false"
    @update:show="(show) => { if (!show) closeDrawer() }"
  >
    <NDrawerContent title="上传任务管理器" closable @close="closeDrawer">
      <!-- 统计栏 -->
      <div class="stats-bar">
        <NTag
          :checked="filterTag === 'all'"
          checkable
          @update:checked="filterTag = 'all'"
        >
          全部 {{ store.stats.total }}
        </NTag>
        <NTag
          :checked="filterTag === 'active'"
          checkable
          type="primary"
          @update:checked="filterTag = 'active'"
        >
          进行中 {{ store.stats.active }}
        </NTag>
        <NTag
          :checked="filterTag === 'completed'"
          checkable
          type="success"
          @update:checked="filterTag = 'completed'"
        >
          已完成 {{ store.stats.completed }}
        </NTag>
        <NTag
          :checked="filterTag === 'error'"
          checkable
          type="error"
          @update:checked="filterTag = 'error'"
        >
          失败 {{ store.stats.error }}
        </NTag>
      </div>

      <!-- 工具栏 -->
      <div class="toolbar">
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索文件..."
          clearable
          size="small"
          style="width: 160px"
        >
          <template #prefix>
            <SvgIcon icon="mdi:magnify" />
          </template>
        </NInput>

        <NSpace>
          <NButton quaternary size="tiny" @click="expandAll">
            <template #icon><SvgIcon icon="mdi:expand-all" /></template>
            全部展开
          </NButton>
          <NButton quaternary size="tiny" @click="collapseAll">
            <template #icon><SvgIcon icon="mdi:collapse-all" /></template>
            全部折叠
          </NButton>
          <NButton quaternary size="tiny" @click="expandActive">
            <template #icon><SvgIcon icon="mdi:play-circle" /></template>
            展开进行中
          </NButton>
        </NSpace>
      </div>

      <NDivider style="margin: 12px 0" />

      <!-- 任务列表 -->
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <NEmpty description="暂无上传任务">
          <template #icon>
            <SvgIcon icon="mdi:cloud-upload-outline" style="font-size: 48px; color: #d9d9d9" />
          </template>
        </NEmpty>
      </div>

      <div v-else class="task-groups">
        <div
          v-for="[kid, tasks] in groupedTasks"
          :key="kid"
          class="task-group"
        >
          <!-- 组标题 -->
          <div class="group-header" @click="toggleGroup(kid)">
            <div class="group-title">
              <SvgIcon
                :icon="collapsedGroups.has(kid) ? 'mdi:chevron-down' : 'mdi:chevron-up'"
              />
              <span>{{ getGroupTitle(kid, tasks) }}</span>
              <span class="group-count">({{ tasks.length }})</span>
            </div>
            <div class="group-stats">
              <template v-if="getGroupStats(tasks).uploading > 0">
                <NTag size="tiny" type="primary">
                  {{ getGroupStats(tasks).uploading }} 上传
                </NTag>
              </template>
              <template v-if="getGroupStats(tasks).processing > 0">
                <NTag size="tiny" type="info">
                  {{ getGroupStats(tasks).processing }} 处理
                </NTag>
              </template>
              <template v-if="getGroupStats(tasks).completed > 0">
                <NTag size="tiny" type="success">
                  {{ getGroupStats(tasks).completed }} 完成
                </NTag>
              </template>
              <template v-if="getGroupStats(tasks).error > 0">
                <NTag size="tiny" type="error">
                  {{ getGroupStats(tasks).error }} 失败
                </NTag>
              </template>
            </div>
          </div>

          <!-- 组内容 -->
          <div v-show="!collapsedGroups.has(kid)" class="group-content">
            <UploadTaskCard
              v-for="task in tasks"
              :key="task.id"
              :task="task"
              :search-keyword="searchKeyword"
            />
          </div>
        </div>
      </div>

      <NDivider style="margin: 12px 0" />

      <!-- 底部操作 -->
      <div class="footer-actions">
        <NSpace>
          <NButton
            v-if="store.stats.completed > 0"
            quaternary
            size="small"
            @click="clearCompleted"
          >
            <template #icon><SvgIcon icon="mdi:broom" /></template>
            清空已完成
          </NButton>
          <NButton
            v-if="store.stats.error > 0"
            quaternary
            size="small"
            type="error"
            @click="clearFailed"
          >
            <template #icon><SvgIcon icon="mdi:delete-sweep" /></template>
            清空失败
          </NButton>
          <NButton
            v-if="store.stats.error > 0"
            quaternary
            size="small"
            type="primary"
            @click="retryAllFailed"
          >
            <template #icon><SvgIcon icon="mdi:refresh" /></template>
            全部重试
          </NButton>
        </NSpace>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.task-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-group {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fafafa;
  cursor: pointer;
  transition: background 0.2s ease;
}

.group-header:hover {
  background: #f5f5f5;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #262626;
}

.group-title :deep(svg) {
  font-size: 18px;
  color: #8c8c8c;
}

.group-count {
  color: #8c8c8c;
  font-weight: normal;
}

.group-stats {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fff;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
}
</style>

<script setup lang="ts">
/**
 * 知识库卡片组件
 *
 * 功能：名称/描述搜索高亮、分类徽章、统计数据网格（条目/片段/文档/数据量）、
 *       操作按钮（进入/编辑/删除）、悬停效果、响应式布局
 */
import { computed, h } from 'vue'
import { NCard, NTag, NButton, NTooltip, NPopconfirm, NSpace, NGrid, NGi, NEllipsis } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import type { KnowledgeVo } from '@/api/v2/knowledgeBase'

const props = defineProps<{
  data: KnowledgeVo
  searchKeyword?: string
  categoryMap?: Record<string, string>  // 分类值到标签的映射
}>()

// 获取分类中文标签
const categoryLabel = computed(() => {
  if (!props.data.category) return ''
  return props.categoryMap?.[props.data.category] || props.data.category
})

const emit = defineEmits<{
  (e: 'enter', kid: string): void
  (e: 'edit', data: KnowledgeVo): void
  (e: 'delete', kid: string, name: string): void
}>()

// ========== 搜索高亮 ==========

function highlightText(text: string | undefined | null): string {
  if (!text) return ''
  const keyword = props.searchKeyword?.trim()
  if (!keyword) return escapeHtml(text)
  const escaped = escapeKeyword(keyword)
  const regex = new RegExp(`(${escaped})`, 'gi')
  return escapeHtml(text).replace(
    new RegExp(`(${escapeHtml(escaped)})`, 'gi'),
    '<mark class="search-hl">$1</mark>'
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeKeyword(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ========== 格式化 ==========

function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ========== 分类颜色 ==========

const categoryColorMap: Record<string, string> = {
  '安全漏洞': '#d13438',
  '代码规范': '#0078d4',
  '最佳实践': '#107c10',
  '架构设计': '#8764b8',
  '性能优化': '#ca5010',
  '测试用例': '#008272',
}

const categoryColor = computed(() => {
  const cat = props.data.category
  if (!cat) return undefined
  return categoryColorMap[cat] || '#605e5c'
})

// ========== 统计项 ==========

interface StatItem {
  label: string
  value: string | number
  icon: string
  color: string
}

const stats = computed<StatItem[]>(() => [
  {
    label: '条目',
    value: props.data.itemCount ?? 0,
    icon: 'mdi:file-document-outline',
    color: '#0078d4',
  },
  {
    label: '片段',
    value: props.data.fragmentCount ?? 0,
    icon: 'mdi:puzzle-outline',
    color: '#8764b8',
  },
  {
    label: '文档',
    value: props.data.attachCount ?? 0,
    icon: 'mdi:paperclip',
    color: '#ca5010',
  },
  {
    label: '数据量',
    value: formatFileSize(props.data.dataSize),
    icon: 'mdi:database-outline',
    color: '#107c10',
  },
])
</script>

<template>
  <NCard
    class="knowledge-card"
    hoverable
    :bordered="true"
    @click="emit('enter', data.kid)"
  >
    <!-- 头部：名称 + 分类 -->
    <div class="card-header">
      <div class="card-title-row">
        <h3 class="card-title" v-html="highlightText(data.kname)" />
        <NTag
          v-if="data.category"
          :color="{ color: categoryColor + '1a', textColor: categoryColor, borderColor: categoryColor + '40' }"
          size="small"
          round
        >
          {{ categoryLabel }}
        </NTag>
      </div>
      <NEllipsis
        :line-clamp="2"
        class="card-description"
      >
        <span v-html="highlightText(data.description || '暂无描述')" />
      </NEllipsis>
    </div>

    <!-- 统计网格 -->
    <div class="stats-grid">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="stat-item"
      >
        <SvgIcon :icon="stat.icon" :style="{ color: stat.color, fontSize: '16px' }" />
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>

    <!-- 底部：时间 + 操作 -->
    <div class="card-footer">
      <span class="update-time">
        <SvgIcon icon="mdi:clock-outline" style="font-size: 12px; margin-right: 4px;" />
        {{ formatTime(data.updateTime) }}
      </span>
      <NSpace :size="4" @click.stop>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              text
              type="primary"
              size="small"
              @click.stop="emit('enter', data.kid)"
            >
              <template #icon>
                <SvgIcon icon="mdi:arrow-right-circle-outline" />
              </template>
            </NButton>
          </template>
          进入知识库
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              text
              type="info"
              size="small"
              @click.stop="emit('edit', data)"
            >
              <template #icon>
                <SvgIcon icon="mdi:pencil-outline" />
              </template>
            </NButton>
          </template>
          编辑
        </NTooltip>
        <NPopconfirm
          :positive-text="'确认删除'"
          :negative-text="'取消'"
          @positive-click="emit('delete', data.kid, data.kname)"
        >
          <template #trigger>
            <NTooltip trigger="hover">
              <template #trigger>
                <NButton
                  text
                  type="error"
                  size="small"
                  @click.stop
                >
                  <template #icon>
                    <SvgIcon icon="mdi:delete-outline" />
                  </template>
                </NButton>
              </template>
              删除
            </NTooltip>
          </template>
          确定要删除知识库「{{ data.kname }}」吗？此操作不可恢复。
        </NPopconfirm>
      </NSpace>
    </div>
  </NCard>
</template>

<style scoped>
.knowledge-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  border: 1px solid #edebe9;
}

.knowledge-card:hover {
  border-color: #0078d4;
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.15);
  transform: translateY(-2px);
}

.card-header {
  margin-bottom: 16px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #323130;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-description {
  font-size: 13px;
  color: #605e5c;
  line-height: 1.5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid #f3f2f1;
  border-bottom: 1px solid #f3f2f1;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #323130;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 11px;
  color: #a19f9d;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.update-time {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #a19f9d;
}

/* 搜索高亮 */
:deep(.search-hl) {
  background: linear-gradient(120deg, rgba(255, 235, 59, 0.3) 0%, rgba(255, 235, 59, 0.5) 100%);
  padding: 0 1px;
  border-radius: 2px;
}
</style>

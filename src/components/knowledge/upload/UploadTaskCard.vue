<script setup lang="ts">
/**
 * 上传任务卡片组件
 *
 * 展示单个上传任务的进度、状态、操作按钮
 */
import { computed } from 'vue'
import { NProgress, NTag, NButton, NTooltip } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import type { UploadTask, ProcessingStage } from '@/store/modules/upload'
import { useUploadStore } from '@/store/modules/upload'
import { extractKeywords, highlightTextHtml } from '@/utils/searchHighlight'
import { uploadService } from '@/services/uploadService'

const props = withDefaults(
  defineProps<{
    task: UploadTask
    searchKeyword?: string
  }>(),
  { searchKeyword: '' }
)

const store = useUploadStore()

// 文件类型图标映射
const fileTypeIconMap: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'mdi:file-pdf-box', color: '#d13438' },
  doc: { icon: 'mdi:file-word-box', color: '#0078d4' },
  docx: { icon: 'mdi:file-word-box', color: '#0078d4' },
  xls: { icon: 'mdi:file-excel-box', color: '#107c10' },
  xlsx: { icon: 'mdi:file-excel-box', color: '#107c10' },
  md: { icon: 'mdi:language-markdown', color: '#323130' },
  txt: { icon: 'mdi:file-document-outline', color: '#605e5c' },
  java: { icon: 'mdi:language-java', color: '#d13438' },
  js: { icon: 'mdi:language-javascript', color: '#ca5010' },
  ts: { icon: 'mdi:language-typescript', color: '#0078d4' },
  py: { icon: 'mdi:language-python', color: '#0078d4' },
  html: { icon: 'mdi:language-html5', color: '#ca5010' },
  css: { icon: 'mdi:language-css3', color: '#0078d4' },
}

const fileTypeInfo = computed(() => {
  const ext = props.task.fileName.split('.').pop()?.toLowerCase() || ''
  return fileTypeIconMap[ext] || { icon: 'mdi:file-document-outline', color: '#605e5c' }
})

const displayFileName = computed(() => {
  const raw = props.task.fileName || ''
  const keywords = props.searchKeyword?.trim() ? extractKeywords(props.searchKeyword) : []
  return highlightTextHtml(raw, keywords)
})

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

// 格式化速度
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s'
  if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(1) + ' KB/s'
  return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB/s'
}

// 格式化ETA
function formatETA(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`
  return `${Math.ceil(seconds / 3600)}小时`
}

// 状态标签配置
const statusConfig = computed(() => {
  const config: Record<string, { type: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'; label: string; icon: string }> = {
    pending: { type: 'default', label: '等待中', icon: 'mdi:clock-outline' },
    uploading: { type: 'primary', label: '上传中', icon: 'mdi:upload' },
    processing: { type: 'info', label: '处理中', icon: 'mdi:cog-outline' },
    completed: { type: 'success', label: '已完成', icon: 'mdi:check-circle' },
    error: { type: 'error', label: '失败', icon: 'mdi:alert-circle' },
    paused: { type: 'warning', label: '已暂停', icon: 'mdi:pause-circle' },
    cancelled: { type: 'default', label: '已取消', icon: 'mdi:close-circle' },
  }
  return config[props.task.status] || config.pending
})

// 处理阶段标签
const stageLabels: Record<ProcessingStage, string> = {
  parsing: '解析',
  chunking: '切片',
  vectorizing: '向量化',
}

// 是否可以暂停
const canPause = computed(() => props.task.status === 'uploading')

// 是否可以恢复
const canResume = computed(() => props.task.status === 'paused')

// 是否可以重试
const canRetry = computed(() => props.task.status === 'error')

// 是否可以取消
const canCancel = computed(() => ['pending', 'uploading', 'paused'].includes(props.task.status))

// 操作处理
function handlePause() {
  uploadService.pauseTask(props.task.id)
}

function handleResume() {
  uploadService.resumeTask(props.task.id)
}

function handleRetry() {
  uploadService.retryTask(props.task.id)
}

function handleCancel() {
  uploadService.cancelTask(props.task.id)
}

function handleRemove() {
  store.removeTask(props.task.id)
}
</script>

<template>
  <div class="task-card" :class="[`status-${task.status}`]">
    <!-- 文件信息 -->
    <div class="file-info">
      <div class="file-icon" :style="{ color: fileTypeInfo.color }">
        <SvgIcon :icon="fileTypeInfo.icon" />
      </div>
      <div class="file-details">
        <div class="file-name" :title="task.fileName" v-html="displayFileName"></div>
        <div class="file-meta">
          <span class="file-size">{{ formatFileSize(task.fileSize) }}</span>
          <NTag :type="statusConfig.type" size="tiny" round>
            <template #icon>
              <SvgIcon :icon="statusConfig.icon" />
            </template>
            {{ statusConfig.label }}
          </NTag>
        </div>
      </div>
    </div>

    <!-- 进度信息 -->
    <div v-if="task.status === 'uploading'" class="progress-section">
      <div class="progress-header">
        <span class="progress-percentage">{{ task.progress }}%</span>
        <span v-if="task.uploadSpeed && task.uploadSpeed > 0" class="progress-speed">
          {{ formatSpeed(task.uploadSpeed) }}
        </span>
        <span v-if="task.eta && task.eta > 0" class="progress-eta">
          剩余 {{ formatETA(task.eta) }}
        </span>
      </div>
      <NProgress
        :percentage="task.progress"
        :show-indicator="false"
        :height="6"
        :border-radius="3"
        :fill-border-radius="3"
      />
      <div v-if="task.totalChunks && task.totalChunks > 1" class="chunk-info">
        分片 {{ task.completedChunks?.length || 0 }} / {{ task.totalChunks }}
      </div>
    </div>

    <!-- 处理阶段 -->
    <div v-else-if="task.status === 'processing' && task.processingStage" class="processing-section">
      <div class="stage-flow">
        <span
          v-for="(label, stage) in stageLabels"
          :key="stage"
          class="stage-item"
          :class="{
            'is-completed': ['parsing', 'chunking', 'vectorizing'].indexOf(stage) < ['parsing', 'chunking', 'vectorizing'].indexOf(task.processingStage!),
            'is-active': stage === task.processingStage,
          }"
        >
          <SvgIcon
            :icon="['parsing', 'chunking', 'vectorizing'].indexOf(stage) < ['parsing', 'chunking', 'vectorizing'].indexOf(task.processingStage!)
              ? 'mdi:check-circle'
              : stage === task.processingStage
                ? 'mdi:loading'
                : 'mdi:circle-outline'"
            :class="{ 'spin': stage === task.processingStage }"
          />
          {{ label }}
        </span>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-else-if="task.status === 'error' && task.error" class="error-section">
      <div class="error-message">
        <SvgIcon icon="mdi:alert" />
        {{ task.error }}
      </div>
      <div v-if="task.retryCount > 0" class="retry-count">
        已重试 {{ task.retryCount }} 次
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <NTooltip v-if="canPause" trigger="hover">
        <template #trigger>
          <NButton quaternary size="tiny" @click="handlePause">
            <template #icon><SvgIcon icon="mdi:pause" /></template>
          </NButton>
        </template>
        暂停
      </NTooltip>

      <NTooltip v-if="canResume" trigger="hover">
        <template #trigger>
          <NButton quaternary size="tiny" @click="handleResume">
            <template #icon><SvgIcon icon="mdi:play" /></template>
          </NButton>
        </template>
        恢复
      </NTooltip>

      <NTooltip v-if="canRetry" trigger="hover">
        <template #trigger>
          <NButton quaternary size="tiny" type="primary" @click="handleRetry">
            <template #icon><SvgIcon icon="mdi:refresh" /></template>
          </NButton>
        </template>
        重试
      </NTooltip>

      <NTooltip v-if="canCancel" trigger="hover">
        <template #trigger>
          <NButton quaternary size="tiny" type="error" @click="handleCancel">
            <template #icon><SvgIcon icon="mdi:close" /></template>
          </NButton>
        </template>
        取消
      </NTooltip>

      <NTooltip v-if="['completed', 'error', 'cancelled'].includes(task.status)" trigger="hover">
        <template #trigger>
          <NButton quaternary size="tiny" @click="handleRemove">
            <template #icon><SvgIcon icon="mdi:delete-outline" /></template>
          </NButton>
        </template>
        删除
      </NTooltip>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  transition: all 0.2s ease;
}

.task-card:hover {
  border-color: #d9d9d9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.task-card.status-error {
  border-color: #ffccc7;
  background: #fff2f0;
}

.task-card.status-completed {
  border-color: #b7eb8f;
  background: #f6ffed;
}

/* 文件信息 */
.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.file-size {
  font-size: 12px;
  color: #8c8c8c;
}

/* 进度区域 */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.progress-percentage {
  font-weight: 600;
  color: #262626;
}

.progress-speed {
  color: #1890ff;
}

.progress-eta {
  color: #8c8c8c;
}

.chunk-info {
  font-size: 11px;
  color: #8c8c8c;
}

/* 处理阶段 */
.processing-section {
  padding: 4px 0;
}

.stage-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.stage-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #bfbfbf;
  transition: color 0.2s ease;
}

.stage-item.is-completed {
  color: #52c41a;
}

.stage-item.is-active {
  color: #1890ff;
  font-weight: 500;
}

.stage-item :deep(svg) {
  font-size: 14px;
}

.stage-item .spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 错误信息 */
.error-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #ff4d4f;
}

.error-message :deep(svg) {
  font-size: 14px;
}

.retry-count {
  font-size: 11px;
  color: #8c8c8c;
}

/* 操作按钮 */
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}
</style>

<script setup lang="ts">
/**
 * 保存状态指示器
 * 
 * 创新设计：保存状态可视化
 * - 保存中动画
 * - 已保存成功提示
 * - 保存失败警告
 */
import { computed } from 'vue'
import { NTooltip, NSpin, NSpace } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const props = defineProps<{
  status: SaveStatus
  lastSaved?: number  // 时间戳
}>()

const statusText = computed(() => {
  switch (props.status) {
    case 'saving': return '保存中...'
    case 'saved': return '已保存'
    case 'error': return '保存失败'
    default: return ''
  }
})

const statusIcon = computed(() => {
  switch (props.status) {
    case 'saving': return 'mdi:sync'
    case 'saved': return 'mdi:check-circle'
    case 'error': return 'mdi:alert-circle'
    default: return ''
  }
})

const statusColor = computed(() => {
  switch (props.status) {
    case 'saving': return '#0078d4'
    case 'saved': return '#107c10'
    case 'error': return '#d13438'
    default: return '#605e5c'
  }
})

const lastSavedText = computed(() => {
  if (!props.lastSaved || props.status !== 'saved') return ''
  
  const date = new Date(props.lastSaved)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})
</script>

<template>
  <NTooltip trigger="hover" :disabled="status === 'idle'">
    <template #trigger>
      <div class="save-indicator" :class="`is-${status}`">
        <NSpace :size="4" align="center">
          <!-- 保存中动画 -->
          <NSpin v-if="status === 'saving'" size="small" />
          
          <!-- 状态图标 -->
          <SvgIcon
            v-else-if="statusIcon"
            :icon="statusIcon"
            :style="{ color: statusColor, fontSize: '16px' }"
          />
          
          <!-- 状态文字 -->
          <span v-if="status !== 'idle'" class="status-text" :style="{ color: statusColor }">
            {{ statusText }}
          </span>
          
          <!-- 保存时间 -->
          <span v-if="lastSavedText" class="saved-time">
            {{ lastSavedText }}
          </span>
        </NSpace>
      </div>
    </template>
    
    <div v-if="status === 'saved' && lastSaved">
      上次保存: {{ new Date(lastSaved).toLocaleString('zh-CN') }}
    </div>
    <div v-else-if="status === 'error'">
      保存失败，请检查网络连接
    </div>
    <div v-else-if="status === 'saving'">
      正在自动保存...
    </div>
  </NTooltip>
</template>

<style scoped>
.save-indicator {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.save-indicator.is-saved {
  background: rgba(16, 124, 16, 0.08);
}

.save-indicator.is-error {
  background: rgba(209, 52, 56, 0.08);
}

.status-text {
  font-weight: 500;
}

.saved-time {
  color: #8a8886;
  font-size: 11px;
}

/* 保存成功动画 */
@keyframes save-success {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.save-indicator.is-saved .icon-check {
  animation: save-success 0.3s ease;
}

/* 保存中旋转 */
@keyframes saving-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.save-indicator.is-saving .icon-sync {
  animation: saving-spin 1s linear infinite;
}
</style>

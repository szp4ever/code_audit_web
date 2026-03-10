<script setup lang="ts">
/**
 * 上传触发器组件
 *
 * 全局上传按钮，带徽标显示进行中的任务数
 */
import { computed } from 'vue'
import { NButton, NBadge, NTooltip } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { useUploadStore } from '@/store/modules/upload'

const store = useUploadStore()

const props = defineProps<{
  showLabel?: boolean
  type?: 'default' | 'fab'
}>()

const hasActiveTasks = computed(() => store.hasActiveTasks)
const activeCount = computed(() => store.activeCount ?? 0)
const errorCount = computed(() => (store.errorTasks ?? []).length)
const successCount = computed(() => (store.successTasks ?? []).length)
const waitingCount = computed(() => (store.waitingTasks ?? []).length)

const hasTasks = computed(() =>
  activeCount.value > 0 || errorCount.value > 0 || successCount.value > 0 || waitingCount.value > 0
)

/** 角标优先：失败 > 进行中 > 等待 > 成功 */
const badgeValue = computed(() => {
  if (errorCount.value > 0) return errorCount.value
  if (activeCount.value > 0) return activeCount.value
  if (waitingCount.value > 0) return waitingCount.value
  if (successCount.value > 0) return successCount.value
  return 0
})

const tooltipText = computed(() => {
  if (!hasTasks.value) return '上传任务管理器'
  const parts: string[] = []
  if (activeCount.value > 0) parts.push(`${activeCount.value} 进行中`)
  if (waitingCount.value > 0) parts.push(`${waitingCount.value} 等待`)
  if (errorCount.value > 0) parts.push(`${errorCount.value} 失败`)
  if (successCount.value > 0) parts.push(`${successCount.value} 完成`)
  return `上传任务管理器 · ${parts.join('、')}`
})

function openDrawer() {
  store.openDrawer()
}
</script>

<template>
  <!-- 默认头部触发器 -->
  <template v-if="type === 'default'">
    <NTooltip trigger="hover">
      <template #trigger>
        <NBadge
          :value="badgeValue"
          :show-zero="false"
          :max="99"
          :offset="[-4, 4]"
        >
          <NButton
            quaternary
            :type="hasActiveTasks || errorCount > 0 ? 'primary' : 'default'"
            @click="openDrawer"
          >
            <template #icon>
              <SvgIcon icon="mdi:cloud-upload" />
            </template>
            <span v-if="showLabel">上传任务</span>
          </NButton>
        </NBadge>
      </template>
      {{ tooltipText }}
    </NTooltip>
  </template>

  <!-- 浮动操作按钮 (FAB) -->
  <template v-else>
    <Transition name="fab">
      <div
        v-if="hasActiveTasks"
        class="upload-fab"
        @click="openDrawer"
      >
        <NBadge
          :value="activeCount"
          :show-zero="false"
          :max="99"
        >
          <div class="fab-button">
            <SvgIcon icon="mdi:cloud-upload" />
          </div>
        </NBadge>
      </div>
    </Transition>
  </template>
</template>

<style scoped>
/* FAB 样式 */
.upload-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  cursor: pointer;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #1890ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.fab-button:hover {
  background: #40a9ff;
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* 过渡动画 */
.fab-enter-active,
.fab-leave-active {
  transition: all 0.3s ease;
}

.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}

/* 脉冲动画 */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(24, 144, 255, 0.4);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(24, 144, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(24, 144, 255, 0);
  }
}

.upload-fab :deep(.n-badge) .fab-button {
  animation: pulse 2s infinite;
}

@media (max-width: 768px) {
  .upload-fab {
    bottom: 80px;
    right: 16px;
  }

  .fab-button {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
}
</style>

<script setup lang="ts">
/**
 * 跨页批量选择操作栏
 * 
 * 创新设计：「浮动指挥中心」
 * - 底部浮动卡片，显示已选数量和可用操作
 * - 支持跨页全选（当前页/所有页/清空）
 * - 智能推荐：根据选中内容动态调整操作按钮
 */
import { computed, h } from 'vue'
import {
  NCard, NSpace, NButton, NTag, NPopconfirm, NTooltip,
  NDropdown, type DropdownOption
} from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'

export interface BatchAction {
  key: string
  label: string
  icon?: string
  type?: 'primary' | 'info' | 'success' | 'warning' | 'error'
  disabled?: (selectedCount: number) => boolean
  danger?: boolean
  tooltip?: string
}

const props = defineProps<{
  visible: boolean
  selectedCount: number
  totalCount: number
  currentPageCount: number
  actions: BatchAction[]
  showSelectAllPages?: boolean  // 是否显示"选择所有页"选项
}>()

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'selectAllPages'): void
  (e: 'selectCurrentPage'): void
  (e: 'action', key: string, count: number): void
}>()

// ========== 计算属性 ==========
const hasSelection = computed(() => props.selectedCount > 0)

// 是否显示"选择所有页"提示
const showSelectAllHint = computed(() => 
  props.showSelectAllPages && 
  props.selectedCount === props.currentPageCount && 
  props.selectedCount < props.totalCount
)

// 下拉菜单选项
const selectOptions: DropdownOption[] = [
  {
    key: 'current',
    label: '选择当前页',
    icon: () => h(SvgIcon, { icon: 'mdi:page-layout-header' })
  },
  {
    key: 'all',
    label: `选择全部 (${props.totalCount})`,
    icon: () => h(SvgIcon, { icon: 'mdi:select-all' })
  },
  {
    type: 'divider',
    key: 'd1'
  },
  {
    key: 'clear',
    label: '清空选择',
    icon: () => h(SvgIcon, { icon: 'mdi:selection-remove' })
  }
]

// ========== 方法 ==========
function handleSelectOption(key: string) {
  if (key === 'current') {
    emit('selectCurrentPage')
  } else if (key === 'all') {
    emit('selectAllPages')
  } else if (key === 'clear') {
    emit('clear')
  }
}

function handleAction(action: BatchAction) {
  emit('action', action.key, props.selectedCount)
}
</script>

<template>
  <Transition name="batch-bar-slide">
    <div v-show="visible && hasSelection" class="batch-selection-wrapper">
      <NCard
        size="small"
        class="batch-selection-bar"
        :bordered="false"
        :segmented="{ content: true }"
      >
        <div class="batch-bar-content">
          <!-- 左侧：选择信息 -->
          <div class="batch-bar-left">
            <NDropdown
              :options="selectOptions"
              placement="top-start"
              @select="handleSelectOption"
            >
              <NButton text type="primary" size="small">
                <template #icon>
                  <SvgIcon icon="mdi:chevron-up" />
                </template>
                已选 {{ selectedCount }} 项
              </NButton>
            </NDropdown>
            
            <!-- 跨页选择提示 -->
            <NTag
              v-if="showSelectAllHint"
              size="small"
              type="info"
              style="cursor: pointer"
              @click="$emit('selectAllPages')"
            >
              <template #icon>
                <SvgIcon icon="mdi:information-outline" />
              </template>
              选择全部 {{ totalCount }} 项？
            </NTag>
            
            <span v-else-if="selectedCount === totalCount && totalCount > 0" class="all-selected-hint">
              (已选择全部)
            </span>
          </div>

          <!-- 右侧：操作按钮 -->
          <NSpace :size="8" align="center">
            <NButton text size="tiny" @click="$emit('clear')">
              <template #icon>
                <SvgIcon icon="mdi:close" />
              </template>
              清空
            </NButton>
            
            <template v-for="action in actions" :key="action.key">
              <NTooltip v-if="action.tooltip" trigger="hover">
                <template #trigger>
                  <NPopconfirm
                    v-if="action.danger"
                    @positive-click="handleAction(action)"
                  >
                    <template #trigger>
                      <NButton
                        :type="action.type || 'default'"
                        size="small"
                        :disabled="action.disabled?.(selectedCount)"
                      >
                        <template #icon v-if="action.icon">
                          <SvgIcon :icon="action.icon" />
                        </template>
                        {{ action.label }}
                      </NButton>
                    </template>
                    确定要对 {{ selectedCount }} 项执行"{{ action.label }}"操作吗？
                  </NPopconfirm>
                  <NButton
                    v-else
                    :type="action.type || 'default'"
                    size="small"
                    :disabled="action.disabled?.(selectedCount)"
                    @click="handleAction(action)"
                  >
                    <template #icon v-if="action.icon">
                      <SvgIcon :icon="action.icon" />
                    </template>
                    {{ action.label }}
                  </NButton>
                </template>
                {{ action.tooltip }}
              </NTooltip>
              <NPopconfirm
                v-else-if="action.danger"
                @positive-click="handleAction(action)"
              >
                <template #trigger>
                  <NButton
                    :type="action.type || 'default'"
                    size="small"
                    :disabled="action.disabled?.(selectedCount)"
                  >
                    <template #icon v-if="action.icon">
                      <SvgIcon :icon="action.icon" />
                    </template>
                    {{ action.label }}
                  </NButton>
                </template>
                确定要对 {{ selectedCount }} 项执行"{{ action.label }}"操作吗？
              </NPopconfirm>
              <NButton
                v-else
                :type="action.type || 'default'"
                size="small"
                :disabled="action.disabled?.(selectedCount)"
                @click="handleAction(action)"
              >
                <template #icon v-if="action.icon">
                  <SvgIcon :icon="action.icon" />
                </template>
                {{ action.label }}
              </NButton>
            </template>
          </NSpace>
        </div>
      </NCard>
    </div>
  </Transition>
</template>

<style scoped>
.batch-selection-wrapper {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

.batch-selection-bar {
  width: auto;
  min-width: 400px;
  max-width: 800px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border-radius: 12px;
}

.batch-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 8px;
}

.batch-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.all-selected-hint {
  font-size: 12px;
  color: #107c10;
}

/* 入场动画 */
.batch-bar-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.batch-bar-slide-leave-active {
  transition: all 0.2s ease-in;
}

.batch-bar-slide-enter-from,
.batch-bar-slide-leave-to {
  transform: translateX(-50%) translateY(100px);
  opacity: 0;
}

/* 选中项脉冲动画 */
@keyframes selection-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>

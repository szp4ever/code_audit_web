<script setup lang="ts">
/**
 * 表格列配置组件
 * 
 * 功能：列显示/隐藏、拖拽排序、重置、持久化
 * 创新点：场景化模板、智能推荐列
 */
import { ref, computed, watch } from 'vue'
import {
  NButton, NPopover, NCheckbox, NDivider, NSpace, NTag,
  NRadioGroup, NRadioButton, NTooltip
} from 'naive-ui'
import { useSortable } from '@vueuse/integrations/useSortable'
import SvgIcon from '@/components/common/SvgIcon/index.vue'

export interface ColumnSetting {
  key: string
  title: string
  visible: boolean
  width?: number
  fixed?: 'left' | 'right' | false
  order: number
}

export interface ColumnTemplate {
  key: string
  name: string
  icon: string
  description: string
  columns: string[]  // 列key数组，按此顺序显示
}

const props = defineProps<{
  modelValue: ColumnSetting[]
  templates?: ColumnTemplate[]
  storageKey: string  // 持久化key
  defaultVisible?: string[]  // 默认显示的列
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ColumnSetting[]): void
  (e: 'reset'): void
}>()

// ========== 状态 ==========
const popoverVisible = ref(false)
const activeTemplate = ref<string>('custom')

// 拖拽排序
const draggableRef = ref<HTMLElement | null>(null)
const localColumns = ref<ColumnSetting[]>([])

// 初始化本地列配置
watch(() => props.modelValue, (val) => {
  localColumns.value = [...val].sort((a, b) => a.order - b.order)
}, { immediate: true, deep: true })

// 使用 vueuse 拖拽排序
useSortable(draggableRef, localColumns, {
  animation: 200,
  handle: '.drag-handle',
  onUpdate: () => {
    // 更新order
    localColumns.value.forEach((col, idx) => {
      col.order = idx
    })
    emitUpdate()
  }
})

// ========== 计算属性 ==========
const visibleCount = computed(() => localColumns.value.filter(c => c.visible).length)
const totalCount = computed(() => localColumns.value.length)

// 是否显示"应用模板"提示
const showTemplateHint = computed(() => activeTemplate.value !== 'custom')

// ========== 方法 ==========
function emitUpdate() {
  emit('update:modelValue', [...localColumns.value])
  saveToStorage()
}

function toggleColumn(key: string) {
  const col = localColumns.value.find(c => c.key === key)
  if (col) {
    col.visible = !col.visible
    activeTemplate.value = 'custom'  // 自定义模式
    emitUpdate()
  }
}

function showAll() {
  localColumns.value.forEach(c => c.visible = true)
  activeTemplate.value = 'custom'
  emitUpdate()
}

function hideAll() {
  localColumns.value.forEach(c => c.visible = false)
  activeTemplate.value = 'custom'
  emitUpdate()
}

function applyTemplate(templateKey: string) {
  const template = props.templates?.find(t => t.key === templateKey)
  if (!template) return
  
  activeTemplate.value = templateKey
  
  // 按模板顺序重新排列
  const newColumns: ColumnSetting[] = []
  template.columns.forEach((key, idx) => {
    const col = localColumns.value.find(c => c.key === key)
    if (col) {
      newColumns.push({ ...col, visible: true, order: idx })
    }
  })
  
  // 添加不在模板中的列（隐藏状态）
  localColumns.value.forEach((col, idx) => {
    if (!template.columns.includes(col.key)) {
      newColumns.push({ ...col, visible: false, order: template.columns.length + idx })
    }
  })
  
  localColumns.value = newColumns
  emitUpdate()
}

function resetColumns() {
  if (props.defaultVisible) {
    localColumns.value.forEach(col => {
      col.visible = props.defaultVisible!.includes(col.key)
      col.order = props.modelValue.findIndex(c => c.key === col.key)
    })
  }
  activeTemplate.value = 'custom'
  localColumns.value = [...localColumns.value].sort((a, b) => a.order - b.order)
  emitUpdate()
  emit('reset')
}

// 持久化到 localStorage
function saveToStorage() {
  try {
    const data = {
      columns: localColumns.value,
      template: activeTemplate.value,
      timestamp: Date.now()
    }
    localStorage.setItem(`table-columns-${props.storageKey}`, JSON.stringify(data))
  } catch {
    // 忽略存储失败
  }
}

// 从 localStorage 恢复
function restoreFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(`table-columns-${props.storageKey}`)
    if (!raw) return false
    
    const data = JSON.parse(raw)
    if (data.columns && Array.isArray(data.columns)) {
      // 合并存储的配置和当前可用列
      const storedMap = new Map(data.columns.map((c: ColumnSetting) => [c.key, c]))
      
      localColumns.value = props.modelValue.map(col => {
        const stored = storedMap.get(col.key)
        if (stored) {
          return { ...col, visible: stored.visible, order: stored.order }
        }
        return col
      }).sort((a, b) => a.order - b.order)
      
      activeTemplate.value = data.template || 'custom'
      emitUpdate()
      return true
    }
  } catch {
    // 恢复失败
  }
  return false
}

// 暴露恢复方法
defineExpose({ restoreFromStorage })
</script>

<template>
  <NPopover
    v-model:show="popoverVisible"
    trigger="click"
    placement="bottom-end"
    :width="320"
    @show="restoreFromStorage"
  >
    <template #trigger>
      <NButton quaternary size="small">
        <template #icon>
          <SvgIcon icon="mdi:table-cog" />
        </template>
        列配置
        <NTag v-if="visibleCount < totalCount" size="small" round type="info" style="margin-left: 4px">
          {{ visibleCount }}/{{ totalCount }}
        </NTag>
      </NButton>
    </template>

    <div class="column-settings-panel">
      <!-- 场景化模板 -->
      <div v-if="templates && templates.length > 0" class="template-section">
        <div class="section-title">场景模板</div>
        <NRadioGroup v-model:value="activeTemplate" size="small" @update:value="applyTemplate">
          <NSpace :size="4" wrap>
            <NRadioButton value="custom">自定义</NRadioButton>
            <NRadioButton v-for="t in templates" :key="t.key" :value="t.key">
              <NTooltip trigger="hover">
                <template #trigger>
                  <span>{{ t.name }}</span>
                </template>
                {{ t.description }}
              </NTooltip>
            </NRadioButton>
          </NSpace>
        </NRadioGroup>
        <NDivider style="margin: 12px 0" />
      </div>

      <!-- 操作按钮 -->
      <div class="actions-bar">
        <NButton text size="tiny" @click="showAll">全选</NButton>
        <NButton text size="tiny" @click="hideAll">清空</NButton>
        <NButton text size="tiny" type="warning" @click="resetColumns">重置</NButton>
      </div>

      <!-- 列列表（可拖拽排序） -->
      <div ref="draggableRef" class="columns-list">
        <div
          v-for="col in localColumns"
          :key="col.key"
          class="column-item"
          :class="{ 'is-hidden': !col.visible }"
        >
          <span class="drag-handle">
            <SvgIcon icon="mdi:drag-vertical" style="font-size: 16px; color: #a19f9d" />
          </span>
          <NCheckbox
            :checked="col.visible"
            @update:checked="() => toggleColumn(col.key)"
          >
            <span :class="{ 'text-disabled': !col.visible }">{{ col.title }}</span>
          </NCheckbox>
          <NTag v-if="col.fixed" size="small" type="info" style="margin-left: auto">
            {{ col.fixed === 'left' ? '左固定' : '右固定' }}
          </NTag>
        </div>
      </div>

      <!-- 底部提示 -->
      <div v-if="showTemplateHint" class="template-hint">
        <SvgIcon icon="mdi:information-outline" style="font-size: 14px; color: #0078d4" />
        已应用模板，拖拽可自定义顺序
      </div>
    </div>
  </NPopover>
</template>

<style scoped>
.column-settings-panel {
  padding: 8px 0;
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: #605e5c;
  margin-bottom: 8px;
  padding: 0 12px;
}

.template-section {
  padding: 0 4px;
}

.actions-bar {
  display: flex;
  gap: 12px;
  padding: 0 12px 8px;
  border-bottom: 1px solid #f3f2f1;
}

.columns-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 8px;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border-radius: 4px;
  cursor: grab;
  transition: background 0.2s;
}

.column-item:hover {
  background: #f3f2f1;
}

.column-item.is-hidden {
  opacity: 0.6;
}

.drag-handle {
  cursor: grab;
  display: flex;
  align-items: center;
  padding: 2px;
}

.drag-handle:active {
  cursor: grabbing;
}

.text-disabled {
  color: #a19f9d;
  text-decoration: line-through;
}

.template-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-top: 8px;
  background: #f0f9ff;
  border-radius: 4px;
  font-size: 12px;
  color: #0078d4;
}
</style>

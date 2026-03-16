<script setup lang="ts">
/**
 * 智能搜索组件（带历史记录和自动建议）
 * 
 * 借鉴旧前端 search-panel.vue 精华：
 * - 键盘导航（上下箭头、Enter确认、ESC关闭）
 * - 搜索历史记忆（localStorage）
 * - 悬停删除历史项
 * - 高亮匹配文本
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  NInput, NPopover, NEmpty, NScrollbar, NIcon, NButton,
  type InputInst
} from 'naive-ui'
import { useLocalStorage, onKeyStroke } from '@vueuse/core'
import SvgIcon from '@/components/common/SvgIcon/index.vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  historyKey: string  // localStorage key前缀
  maxHistory?: number  // 最大历史记录数，默认10
  maxSuggestions?: number  // 最大建议数，默认5
  fetchSuggestions?: (keyword: string) => Promise<string[]> | string[]  // 获取建议的函数
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string): void
  (e: 'clear'): void
}>()

// ========== 状态 ==========
const inputRef = ref<InputInst | null>(null)
const popoverVisible = ref(false)
const activeIndex = ref(-1)  // 键盘导航当前激活项
const suggestions = ref<string[]>([])
const loadingSuggestions = ref(false)

// 搜索历史（持久化）
const searchHistory = useLocalStorage<string[]>(
  `search-history-${props.historyKey}`,
  []
)

// ========== 计算属性 ==========
const hasHistory = computed(() => searchHistory.value.length > 0)
const hasSuggestions = computed(() => suggestions.value.length > 0)

// 合并历史和建议（去重）
const displayItems = computed(() => {
  const keyword = props.modelValue.trim().toLowerCase()
  const items: Array<{ type: 'history' | 'suggestion'; text: string }> = []
  
  // 历史记录（仅当有关键词时过滤，否则显示全部）
  if (keyword) {
    const matchedHistory = searchHistory.value.filter(h => 
      h.toLowerCase().includes(keyword)
    ).slice(0, props.maxHistory || 5)
    matchedHistory.forEach(h => items.push({ type: 'history', text: h }))
  } else {
    searchHistory.value.slice(0, props.maxHistory || 5).forEach(h => {
      items.push({ type: 'history', text: h })
    })
  }
  
  // 建议（排除已在历史中的）
  const historySet = new Set(searchHistory.value)
  suggestions.value
    .filter(s => !historySet.has(s))
    .slice(0, props.maxSuggestions || 5)
    .forEach(s => items.push({ type: 'suggestion', text: s }))
  
  return items
})

const hasDisplayItems = computed(() => displayItems.value.length > 0)

// ========== 方法 ==========
function saveToHistory(keyword: string) {
  if (!keyword.trim()) return
  
  // 去重并移到最前
  const newHistory = [keyword, ...searchHistory.value.filter(h => h !== keyword)]
  searchHistory.value = newHistory.slice(0, props.maxHistory || 10)
}

function removeHistoryItem(index: number, event: Event) {
  event.stopPropagation()
  const realIndex = displayItems.value[index].type === 'history' 
    ? searchHistory.value.indexOf(displayItems.value[index].text)
    : -1
  if (realIndex >= 0) {
    searchHistory.value.splice(realIndex, 1)
  }
  // 调整激活索引
  if (activeIndex.value >= index) {
    activeIndex.value = Math.max(-1, activeIndex.value - 1)
  }
}

function clearHistory() {
  searchHistory.value = []
  activeIndex.value = -1
}

function selectItem(text: string) {
  emit('update:modelValue', text)
  saveToHistory(text)
  popoverVisible.value = false
  emit('search', text)
}

function handleInput(value: string) {
  emit('update:modelValue', value)
  activeIndex.value = -1
  
  // 获取建议
  if (props.fetchSuggestions && value.trim()) {
    loadSuggestions(value)
  } else {
    suggestions.value = []
  }
  
  // 显示下拉
  if (hasHistory.value || hasSuggestions.value) {
    popoverVisible.value = true
  }
}

async function loadSuggestions(keyword: string) {
  loadingSuggestions.value = true
  try {
    const result = await props.fetchSuggestions!(keyword)
    suggestions.value = Array.isArray(result) ? result : []
  } catch {
    suggestions.value = []
  } finally {
    loadingSuggestions.value = false
  }
}

function handleEnter() {
  if (activeIndex.value >= 0 && activeIndex.value < displayItems.value.length) {
    // 选择当前激活项
    selectItem(displayItems.value[activeIndex.value].text)
  } else {
    // 直接搜索当前输入
    saveToHistory(props.modelValue)
    popoverVisible.value = false
    emit('search', props.modelValue)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!popoverVisible.value || !hasDisplayItems.value) return
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % displayItems.value.length
      scrollIntoView()
      break
    case 'ArrowUp':
      e.preventDefault()
      activeIndex.value = activeIndex.value <= 0 
        ? displayItems.value.length - 1 
        : activeIndex.value - 1
      scrollIntoView()
      break
    case 'Escape':
      popoverVisible.value = false
      activeIndex.value = -1
      break
  }
}

function scrollIntoView() {
  nextTick(() => {
    const element = document.querySelector(`[data-search-item="${activeIndex.value}"]`)
    if (element) {
      element.scrollIntoView({ block: 'nearest' })
    }
  })
}

function highlightText(text: string): string {
  const keyword = props.modelValue.trim()
  if (!keyword) return text
  
  const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi')
  return text.replace(regex, '<mark style="background: rgba(255, 235, 59, 0.4); padding: 0 2px; border-radius: 2px;">$1</mark>')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function handleClear() {
  emit('update:modelValue', '')
  emit('clear')
  suggestions.value = []
  popoverVisible.value = false
}

// ========== 键盘快捷键 ==========
onKeyStroke('Enter', (e) => {
  if (document.activeElement === inputRef.value?.inputElRef) {
    handleEnter()
  }
})

// 点击外部关闭
let clickOutsideHandler: ((e: MouseEvent) => void) | null = null

onMounted(() => {
  clickOutsideHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.search-with-history')) {
      popoverVisible.value = false
    }
  }
  document.addEventListener('click', clickOutsideHandler)
})

onBeforeUnmount(() => {
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler)
  }
})

// 暴露方法
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  saveToHistory
})
</script>

<template>
  <div class="search-with-history">
    <NPopover
      v-model:show="popoverVisible"
      trigger="manual"
      placement="bottom-start"
      :show-arrow="false"
      :width="320"
      class="search-popover"
    >
      <template #trigger>
        <NInput
          ref="inputRef"
          :value="modelValue"
          :placeholder="placeholder || '搜索...'"
          clearable
          @update:value="handleInput"
          @keydown="handleKeyDown"
          @clear="handleClear"
        >
          <template #prefix>
            <SvgIcon icon="mdi:magnify" />
          </template>
        </NInput>
      </template>

      <div class="search-dropdown">
        <!-- 历史和建议列表 -->
        <NScrollbar v-if="hasDisplayItems" style="max-height: 280px">
          <div
            v-for="(item, index) in displayItems"
            :key="`${item.type}-${item.text}`"
            :data-search-item="index"
            class="search-item"
            :class="{ 
              'is-active': activeIndex === index,
              'is-history': item.type === 'history',
              'is-suggestion': item.type === 'suggestion'
            }"
            @click="selectItem(item.text)"
            @mouseenter="activeIndex = index"
          >
            <NIcon class="item-icon">
              <SvgIcon :icon="item.type === 'history' ? 'mdi:history' : 'mdi:magnify'" />
            </NIcon>
            <span class="item-text" v-html="highlightText(item.text)"></span>
            <NButton
              v-if="item.type === 'history'"
              text
              size="tiny"
              class="delete-btn"
              @click.stop="removeHistoryItem(index, $event)"
            >
              <SvgIcon icon="mdi:close" />
            </NButton>
          </div>
        </NScrollbar>

        <NEmpty v-else description="输入关键词开始搜索" size="small" />

        <!-- 底部操作 -->
        <div v-if="hasHistory" class="dropdown-footer">
          <NButton text size="tiny" @click="clearHistory">
            <template #icon>
              <SvgIcon icon="mdi:delete-sweep-outline" />
            </template>
            清空历史
          </NButton>
        </div>
      </div>
    </NPopover>
  </div>
</template>

<style scoped>
.search-with-history {
  display: inline-block;
}

.search-dropdown {
  padding: 4px 0;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 4px;
  margin: 0 4px;
}

.search-item:hover,
.search-item.is-active {
  background: #f3f2f1;
}

.search-item.is-history .item-icon {
  color: #605e5c;
}

.search-item.is-suggestion .item-icon {
  color: #0078d4;
}

.item-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
  padding: 2px;
}

.search-item:hover .delete-btn {
  opacity: 1;
}

.dropdown-footer {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid #edebe9;
  margin-top: 4px;
}
</style>

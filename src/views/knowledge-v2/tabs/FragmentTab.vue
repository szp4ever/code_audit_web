<script setup lang="ts">
/**
 * 片段浏览 Tab（v2）
 *
 * 新业务模型核心：片段与条目的 N:M 自由关联
 * 功能：关键词搜索（500ms debounce + 高亮）、来源文档筛选、"仅未关联"开关、
 *       排序（含动态「相关程度」：有搜索时显示并默认选中，无搜索时隐藏）、
 *       片段卡片列表（展开/收起）、关联条目列表、关联/取消关联操作、
 *       条目选择器弹窗、分页、空状态
 */
import { ref, reactive, computed, inject, onMounted, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  NButton, NSpace, NInput, NSelect, NSwitch, NTag, NCard, NBadge,
  NPagination, NEmpty, NSpin, NPopconfirm, NTooltip, NModal,
  NDataTable, NScrollbar, NDivider, NEllipsis,
  useMessage, useDialog,
} from 'naive-ui'
import type { SelectOption, DataTableColumns } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import request from '@/utils/request/req'
import type { KnowledgeVo } from '@/api/v2/knowledgeBase'
import { extractKeywords, highlightTextHtml, extractSnippetAroundKeyword } from '@/utils/searchHighlight'

const message = useMessage()
const dialog = useDialog()
const route = useRoute()

// ========== 注入 ==========

const kid = inject<Ref<string>>('kid')!
const knowledgeBase = inject<Ref<KnowledgeVo | null>>('knowledgeBase')
const refreshKnowledgeBase = inject<() => Promise<void>>('refreshKnowledgeBase')

// ========== 状态 ==========

const loading = ref(false)
const fragments = ref<any[]>([])
const searchKeyword = ref('')
const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const filterDocId = ref<string | null>(null)
const onlyUnassociated = ref(false)
const expandedIds = ref<Set<number>>(new Set())

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  pageSizes: [10, 20, 50, 100],
})

// 来源文档选项
const docOptions = ref<SelectOption[]>([])

// 排序（无搜索时的基础选项）
const baseSortOptions: SelectOption[] = [
  { label: '索引', value: 'idx' },
  { label: '更新时间', value: 'update_time' },
  { label: '创建时间', value: 'create_time' },
  { label: '内容长度', value: 'content_length' },
]

/** 有搜索时在首位加入「相关程度」并默认选中 */
const sortOptions = computed<SelectOption[]>(() => {
  if (searchKeyword.value.trim()) {
    return [{ label: '相关程度', value: 'relevance' }, ...baseSortOptions]
  }
  return baseSortOptions
})

/** 清空搜索时恢复的排序状态 */
const previousSortState = ref<{ orderBy: string; order: 'asc' | 'desc' }>({
  orderBy: 'update_time',
  order: 'desc',
})

const filterState = reactive<{
  orderBy: string
  order: 'asc' | 'desc'
}>({
  orderBy: 'update_time',
  order: 'desc',
})

// 严重程度中文映射
const severityLabelMap: Record<string, string> = {
  'Critical': '严重',
  'High': '高危',
  'Medium': '中危',
  'Low': '低危',
  'None': '无风险',
}

// 条目选择器弹窗
const associateDialogVisible = ref(false)
const associatingFragmentId = ref<number | null>(null)
const associatingItemUuid = ref<string | null>(null)
const disassociatingKey = ref<string | null>(null) // "fragId_itemUuid"
const itemSearchKeyword = ref('')
const itemSearchResults = ref<any[]>([])
const itemSearchLoading = ref(false)

// ========== 数据加载 ==========

async function fetchFragments() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      kid: kid.value,
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      orderBy: filterState.orderBy === 'relevance' ? 'relevance' : filterState.orderBy,
      order: filterState.order,
    }
    if (searchKeyword.value.trim()) {
      params.searchKeyword = searchKeyword.value.trim()
    }
    if (filterDocId.value) {
      params.docId = filterDocId.value
    }
    if (onlyUnassociated.value) {
      params.hasItem = false
    }
    const res: any = await request({ url: '/knowledge/fragment/list', method: 'get', params })
    if (res.code === 200) {
      fragments.value = res.rows || []
      pagination.itemCount = res.total || 0
    } else {
      message.error('加载片段列表失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('加载失败：' + (error.message || '网络错误'))
  } finally {
    loading.value = false
  }
}

async function fetchDocOptions() {
  try {
    const res: any = await request({
      url: '/knowledge/document/attach/list',
      method: 'get',
      params: { kid: kid.value, pageSize: 999 },
    })
    if (res.code === 200 && Array.isArray(res.rows)) {
      docOptions.value = res.rows.map((doc: any) => ({
        label: doc.docName || doc.fileName || `文档 ${doc.id}`,
        value: doc.docId || String(doc.id),
      }))
    }
  } catch { /* 不阻塞 */ }
}

// ========== 搜索（300ms debounce） ==========

function handleSearchInput(value: string) {
  const wasSearching = !!searchKeyword.value.trim()
  searchKeyword.value = value
  const isSearching = !!value.trim()
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(() => {
    if (!wasSearching && isSearching) {
      previousSortState.value = { orderBy: filterState.orderBy, order: filterState.order }
      filterState.orderBy = 'relevance'
      filterState.order = 'desc'
    } else if (wasSearching && !isSearching) {
      const prev = previousSortState.value.orderBy
      filterState.orderBy = prev === 'relevance' ? 'update_time' : prev
      filterState.order = previousSortState.value.order
    } else if (wasSearching && isSearching && filterState.orderBy !== 'relevance') {
      filterState.orderBy = 'relevance'
      filterState.order = 'desc'
    }
    pagination.page = 1
    fetchFragments()
  }, 300)
}

function handleSearchClear() {
  const wasSearching = !!searchKeyword.value.trim()
  searchKeyword.value = ''
  if (wasSearching) {
    const prev = previousSortState.value.orderBy
    filterState.orderBy = prev === 'relevance' ? 'update_time' : prev
    filterState.order = previousSortState.value.order
  }
  pagination.page = 1
  fetchFragments()
}

// ========== 排序 ==========

function handleSortChange(value: string) {
  filterState.orderBy = value
  pagination.page = 1
  fetchFragments()
}

function toggleSortOrder() {
  filterState.order = filterState.order === 'asc' ? 'desc' : 'asc'
  pagination.page = 1
  fetchFragments()
}

// ========== 筛选 ==========

function handleDocFilterChange(value: string | null) {
  filterDocId.value = value
  pagination.page = 1
  fetchFragments()
}

function handleUnassociatedToggle(value: boolean) {
  onlyUnassociated.value = value
  pagination.page = 1
  fetchFragments()
}

// ========== 分页 ==========

function handlePageChange(page: number) {
  pagination.page = page
  fetchFragments()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  fetchFragments()
}

// ========== 展开/收起 ==========

function toggleExpand(id: number) {
  // 若用户正在选中文字，不触发折叠（避免误触）
  const sel = window.getSelection?.()
  if (sel?.type === 'Range' && sel.toString().length > 0) return
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
    // 展开时加载关联条目
    loadFragmentItems(id)
  }
}

// ========== 关联条目数据 ==========

const fragmentItemsMap = ref<Record<number, any[]>>({})
const fragmentItemsLoading = ref<Record<number, boolean>>({})

async function loadFragmentItems(fragmentId: number) {
  if (fragmentItemsMap.value[fragmentId]) return // 已加载
  fragmentItemsLoading.value[fragmentId] = true
  try {
    const res: any = await request({
      url: `/knowledge/fragment/${fragmentId}/items`,
      method: 'get',
    })
    if (res.code === 200) {
      fragmentItemsMap.value[fragmentId] = res.data || []
    }
  } catch { /* 静默 */ }
  finally {
    fragmentItemsLoading.value[fragmentId] = false
  }
}

// ========== 关联操作 ==========

function openAssociateDialog(fragmentId: number) {
  associatingFragmentId.value = fragmentId
  itemSearchKeyword.value = ''
  itemSearchResults.value = []
  associateDialogVisible.value = true
}

async function searchItems() {
  if (!itemSearchKeyword.value.trim()) {
    itemSearchResults.value = []
    return
  }
  itemSearchLoading.value = true
  try {
    const res: any = await request({
      url: '/knowledge/item/list',
      method: 'post',
      data: {
        kid: kid.value,
        title: itemSearchKeyword.value.trim(),
        pageNum: 1,
        pageSize: 20,
      },
    })
    if (res.code === 200) {
      itemSearchResults.value = res.rows || []
    }
  } catch { /* 静默 */ }
  finally {
    itemSearchLoading.value = false
  }
}

async function handleAssociate(itemUuid: string) {
  if (!associatingFragmentId.value) return
  associatingItemUuid.value = itemUuid
  try {
    const res: any = await request({
      url: `/knowledge/fragment/${associatingFragmentId.value}/associate/${itemUuid}`,
      method: 'post',
    })
    if (res.code === 200) {
      message.success('关联成功')
      // 刷新该片段的关联列表
      delete fragmentItemsMap.value[associatingFragmentId.value]
      await loadFragmentItems(associatingFragmentId.value)
      associateDialogVisible.value = false
      // 刷新列表以更新关联计数
      await fetchFragments()
      refreshKnowledgeBase?.()
    } else {
      message.error('关联失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('关联失败：' + (error.message || '网络错误'))
  } finally {
    associatingItemUuid.value = null
  }
}

async function handleDisassociate(fragmentId: number, itemUuid: string) {
  const key = `${fragmentId}_${itemUuid}`
  disassociatingKey.value = key
  try {
    const res: any = await request({
      url: `/knowledge/fragment/${fragmentId}/associate/${itemUuid}`,
      method: 'delete',
    })
    if (res.code === 200) {
      message.success('已取消关联')
      delete fragmentItemsMap.value[fragmentId]
      await loadFragmentItems(fragmentId)
      await fetchFragments()
      refreshKnowledgeBase?.()
    } else {
      message.error('取消关联失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('取消关联失败：' + (error.message || '网络错误'))
  } finally {
    disassociatingKey.value = null
  }
}

async function handleDeleteFragment(fragmentId: number) {
  try {
    const res: any = await request({
      url: `/knowledge/fragment/${fragmentId}`,
      method: 'delete',
    })
    if (res.code === 200) {
      message.success('片段已删除')
      await fetchFragments()
      refreshKnowledgeBase?.()
    } else {
      message.error('删除失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('删除失败：' + (error.message || '网络错误'))
  }
}

// ========== 搜索高亮 ==========

function highlightContent(text: string): string {
  if (!text) return ''
  const kw = searchKeyword.value.trim()
  const escaped = escapeHtml(text)
  if (!kw) return escaped
  const regex = new RegExp(`(${escapeRegex(kw)})`, 'gi')
  return escaped.replace(regex, '<mark class="search-hl">$1</mark>')
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text
}

/** 获取展示文本：有搜索词时以关键词为中心截取，否则截取前 N 字 */
function getPreviewText(content: string, maxLen: number): string {
  if (!content) return ''
  const kw = searchKeyword.value.trim()
  const keywords = kw ? extractKeywords(kw) : []
  if (content.length <= maxLen) return content
  return keywords.length
    ? extractSnippetAroundKeyword(content, keywords, maxLen)
    : truncateText(content, maxLen)
}

async function copyFragmentContent(frag: any) {
  const text = frag.content || ''
  if (!text) {
    message.warning('片段内容为空')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

/** 条目搜索关键词高亮（关联弹窗用） */
function highlightItemTitle(text: string): string {
  const kw = itemSearchKeyword.value.trim()
  if (!kw || !text) return text || ''
  return highlightTextHtml(text, extractKeywords(kw))
}

// ========== 严重程度颜色 ==========

const severityColors: Record<string, string> = {
  Critical: '#d13438',
  High: '#ca5010',
  Medium: '#ffb900',
  Low: '#0078d4',
  None: '#8a8886',
}

// ========== 生命周期 ==========

onMounted(() => {
  // 从 URL query 读取 docId 筛选（DocumentTab "查看片段"按钮跳转时带入）
  const queryDocId = route.query.docId as string | undefined
  if (queryDocId) {
    filterDocId.value = queryDocId
  }
  fetchFragments()
  fetchDocOptions()
})

// kid 变化时重新加载
watch(kid, () => {
  pagination.page = 1
  fragments.value = []
  fragmentItemsMap.value = {}
  expandedIds.value.clear()
  fetchFragments()
  fetchDocOptions()
})
</script>

<template>
  <div class="fragment-tab">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <NInput
        :value="searchKeyword"
        placeholder="搜索片段内容..."
        clearable
        maxlength="100"
        style="width: 280px"
        @input="handleSearchInput"
        @clear="handleSearchClear"
      >
        <template #prefix><SvgIcon icon="mdi:magnify" /></template>
      </NInput>

      <NSelect
        :value="filterDocId"
        :options="docOptions"
        placeholder="按来源文档筛选"
        clearable
        filterable
        style="width: 200px"
        @update:value="handleDocFilterChange"
      />

      <div class="filter-switch">
        <NSwitch
          :value="onlyUnassociated"
          size="small"
          @update:value="handleUnassociatedToggle"
        />
        <span class="filter-switch-label">仅未关联</span>
      </div>

      <NDivider vertical />

      <NSelect
        :value="filterState.orderBy"
        :options="sortOptions"
        size="small"
        style="width: 130px"
        @update:value="handleSortChange"
      />
      <NTooltip trigger="hover">
        <template #trigger>
          <NButton quaternary size="small" @click="toggleSortOrder">
            <template #icon>
              <SvgIcon :icon="filterState.order === 'asc' ? 'mdi:sort-ascending' : 'mdi:sort-descending'" />
            </template>
          </NButton>
        </template>
        {{ filterState.order === 'asc' ? '升序' : '降序' }}
      </NTooltip>

      <div style="flex: 1" />

      <NTag size="small" :bordered="false">
        共 {{ pagination.itemCount }} 个片段
      </NTag>
    </div>

    <!-- 片段列表 -->
    <NSpin :show="loading">
      <div v-if="fragments.length > 0" class="fragment-list">
        <div
          v-for="(frag, index) in fragments"
          :key="frag.id"
          class="fragment-card"
          :class="{ expanded: expandedIds.has(frag.id) }"
        >
          <!-- 卡片头部 -->
          <div class="frag-header" @click="toggleExpand(frag.id)">
            <div class="frag-content-preview">
              <span
                v-if="!expandedIds.has(frag.id)"
                v-html="highlightContent(getPreviewText(frag.content || '', 200))"
              />
              <NScrollbar v-else style="max-height: 400px">
                <span v-html="highlightContent(frag.content)" />
              </NScrollbar>
            </div>
            <div class="frag-meta">
              <span class="frag-index" :title="`片段 #${(pagination.page - 1) * pagination.pageSize + index + 1}`">
                #{{ (pagination.page - 1) * pagination.pageSize + index + 1 }}
              </span>
              <NTag size="tiny" :bordered="false" type="default">
                <span class="frag-doc-inline">
                  <SvgIcon icon="mdi:file-document-outline" class="frag-doc-icon" />
                  {{ frag.docName || '未知文档' }}
                </span>
              </NTag>
              <NTag size="tiny" :bordered="false">
                {{ frag.wordCount || (frag.content?.length || 0) }} 字
              </NTag>
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton
                    text
                    size="tiny"
                    quaternary
                    class="frag-copy-btn"
                    @click.stop="copyFragmentContent(frag)"
                  >
                    <template #icon>
                      <SvgIcon icon="mdi:content-copy" style="font-size: 14px" />
                    </template>
                  </NButton>
                </template>
                复制片段内容
              </NTooltip>
              <NBadge
                :value="frag.itemCount || 0"
                :type="(frag.itemCount || 0) > 0 ? 'info' : 'default'"
                :max="99"
                :offset="[-4, 0]"
              >
                <NTag
                  size="tiny"
                  :type="(frag.itemCount || 0) > 0 ? 'info' : 'default'"
                  :bordered="false"
                >
                  {{ (frag.itemCount || 0) > 0 ? `${frag.itemCount} 个条目` : '未关联' }}
                </NTag>
              </NBadge>
              <SvgIcon
                :icon="expandedIds.has(frag.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                style="font-size: 18px; color: #a19f9d; cursor: pointer"
              />
            </div>
          </div>

          <!-- 展开区域：关联条目列表 + 操作 -->
          <div v-if="expandedIds.has(frag.id)" class="frag-expanded">
            <NDivider style="margin: 8px 0" />

            <!-- 关联的条目列表 -->
            <div class="associated-items">
              <div class="associated-items-header">
                <span class="section-label">关联的条目</span>
                <NButton
                  size="tiny"
                  type="primary"
                  @click.stop="openAssociateDialog(frag.id)"
                >
                  <template #icon><SvgIcon icon="mdi:link-plus" /></template>
                  关联条目
                </NButton>
              </div>

              <NSpin
                v-if="fragmentItemsLoading[frag.id]"
                :show="true"
                size="small"
                style="min-height: 40px"
              />
              <div
                v-else-if="fragmentItemsMap[frag.id]?.length"
                class="item-list"
              >
                <div
                  v-for="assoc in fragmentItemsMap[frag.id]"
                  :key="assoc.id || assoc.itemUuid"
                  class="item-row"
                >
                  <div class="item-row-left">
                    <SvgIcon icon="mdi:file-document-edit-outline" class="item-row-icon" />
                    <span class="item-title">{{ assoc.itemTitle || assoc.itemUuid }}</span>
                    <NTag
                      v-if="assoc.createdBy === 'ai'"
                      size="tiny"
                      type="info"
                      :bordered="false"
                    >
                      AI
                    </NTag>
                    <NTag
                      v-if="assoc.relevanceScore != null"
                      size="tiny"
                      :bordered="false"
                    >
                      {{ (assoc.relevanceScore * 100).toFixed(0) }}%
                    </NTag>
                  </div>
                  <NPopconfirm
                    positive-text="取消关联"
                    negative-text="保留"
                    @positive-click="handleDisassociate(frag.id, assoc.itemUuid)"
                  >
                    <template #trigger>
                      <NSpin v-if="disassociatingKey === `${frag.id}_${assoc.itemUuid}`" size="small" />
                      <NButton v-else text type="error" size="tiny" @click.stop>
                        <template #icon><SvgIcon icon="mdi:link-off" /></template>
                      </NButton>
                    </template>
                    确定取消此片段与条目「{{ assoc.itemTitle || assoc.itemUuid }}」的关联？
                  </NPopconfirm>
                </div>
              </div>
              <div v-else class="no-items-hint">
                暂无关联条目，点击上方按钮关联
              </div>
            </div>

            <!-- 片段操作 -->
            <div class="frag-actions">
              <NPopconfirm
                positive-text="确认删除"
                negative-text="取消"
                @positive-click="handleDeleteFragment(frag.id)"
              >
                <template #trigger>
                  <NButton text type="error" size="tiny" @click.stop>
                    <template #icon><SvgIcon icon="mdi:delete-outline" /></template>
                    删除片段
                  </NButton>
                </template>
                确定要删除此片段吗？关联关系也会一并删除。
              </NPopconfirm>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <NEmpty
        v-else-if="!loading"
        :description="searchKeyword || filterDocId || onlyUnassociated ? '没有匹配的片段' : '暂无片段'"
      >
        <template #extra>
          <NButton
            v-if="searchKeyword || filterDocId || onlyUnassociated"
            size="small"
            @click="searchKeyword = ''; filterDocId = null; onlyUnassociated = false; fetchFragments()"
          >
            清除筛选条件
          </NButton>
          <span v-else style="font-size: 13px; color: #a19f9d">上传文档后，系统会自动生成片段</span>
        </template>
      </NEmpty>
    </NSpin>

    <!-- 分页 -->
    <div v-if="pagination.itemCount > 0" class="pagination-wrapper">
      <NPagination
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :item-count="pagination.itemCount"
        :page-sizes="pagination.pageSizes"
        show-size-picker
        @update:page="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </div>

    <!-- 条目选择器弹窗 -->
    <NModal
      v-model:show="associateDialogVisible"
      preset="card"
      title="关联到条目"
      :style="{ width: '560px' }"
      :mask-closable="true"
    >
      <NInput
        v-model:value="itemSearchKeyword"
        placeholder="搜索条目标题..."
        clearable
        maxlength="100"
        @keyup.enter="searchItems"
      >
        <template #prefix><SvgIcon icon="mdi:magnify" /></template>
        <template #suffix>
          <NButton text size="tiny" @click="searchItems">搜索</NButton>
        </template>
      </NInput>

      <NSpin :show="itemSearchLoading" style="min-height: 120px; margin-top: 12px">
        <div v-if="itemSearchResults.length > 0" class="item-search-results">
          <div
            v-for="item in itemSearchResults"
            :key="item.itemUuid"
            class="item-search-row"
            :class="{ 'item-search-row--loading': associatingItemUuid === item.itemUuid }"
            @click="!associatingItemUuid && handleAssociate(item.itemUuid)"
          >
            <div class="item-search-info">
              <span class="item-search-title" v-html="highlightItemTitle(item.title || '')"></span>
              <NSpace :size="4">
                <NTag
                  v-if="item.severity"
                  size="tiny"
                  :style="{ color: severityColors[item.severity] || '#605e5c' }"
                  :bordered="false"
                >
                  {{ severityLabelMap[item.severity] || item.severity }}
                </NTag>
                <NTag v-if="item.vulnerabilityType" size="tiny" :bordered="false">
                  {{ item.vulnerabilityType }}
                </NTag>
              </NSpace>
            </div>
            <NSpin v-if="associatingItemUuid === item.itemUuid" size="small" />
            <NButton v-else text type="primary" size="tiny">
              <template #icon><SvgIcon icon="mdi:link-plus" /></template>
              关联
            </NButton>
          </div>
        </div>
        <NEmpty
          v-else-if="!itemSearchLoading && itemSearchKeyword"
          description="未找到匹配的条目"
          style="margin-top: 20px"
        />
        <div v-else-if="!itemSearchLoading" class="search-hint">
          输入条目标题关键词进行搜索
        </div>
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
.fragment-tab {
  min-height: 300px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-switch-label {
  font-size: 13px;
  color: #605e5c;
}

.fragment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fragment-card {
  background: #fff;
  border: 1px solid #edebe9;
  border-radius: 8px;
  padding: 12px 16px;
  transition: all 0.2s ease;
}

.fragment-card:hover {
  border-color: #c8c6c4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.fragment-card.expanded {
  border-color: #0078d4;
  box-shadow: 0 2px 12px rgba(0, 120, 212, 0.15);
}

.fragment-card.expanded:hover {
  box-shadow: 0 2px 14px rgba(0, 120, 212, 0.2);
}

.frag-header {
  cursor: pointer;
}

.frag-content-preview {
  font-size: 13px;
  color: #323130;
  line-height: 1.6;
  margin-bottom: 8px;
  word-break: break-word;
}

.frag-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.frag-index {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 500;
  color: #8a8886;
  padding: 2px 6px;
  background: #f3f2f1;
  border-radius: 4px;
  min-width: 28px;
  text-align: center;
}

.frag-doc-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.frag-doc-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.frag-copy-btn {
  color: #8a8886;
  padding: 2px 4px;
}
.frag-copy-btn:hover {
  color: #0078d4;
}

.frag-expanded {
  animation: slideDown 0.25s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.associated-items {
  margin-bottom: 8px;
}

.associated-items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: #605e5c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  background: #faf9f8;
}

.item-row:hover {
  background: #f3f2f1;
}

.item-row-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.item-row-icon {
  color: #0078d4;
  font-size: 14px;
  flex-shrink: 0;
}

.item-title {
  font-size: 13px;
  color: #323130;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-items-hint {
  font-size: 12px;
  color: #a19f9d;
  padding: 8px 0;
  text-align: center;
}

.frag-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* 条目选择器弹窗 */
.item-search-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
}

.item-search-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}

.item-search-row:hover {
  background: #f3f2f1;
}

.item-search-row--loading {
  pointer-events: none;
  opacity: 0.85;
}

.item-search-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.item-search-title {
  font-size: 14px;
  font-weight: 500;
  color: #323130;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-hint {
  text-align: center;
  color: #a19f9d;
  font-size: 13px;
  padding: 24px 0;
}

/* 搜索高亮 */
:deep(.search-hl) {
  background: linear-gradient(120deg, rgba(255, 235, 59, 0.3) 0%, rgba(255, 235, 59, 0.5) 100%);
  padding: 0 1px;
  border-radius: 2px;
}
</style>

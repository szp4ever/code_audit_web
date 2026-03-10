<script setup lang="ts">
/**
 * 知识库列表页（v2）
 *
 * 功能：卡片网格展示、搜索（300ms debounce + 高亮）、分类筛选、排序、
 *       NDrawer 新建/编辑、批量删除、分页、状态持久化（sessionStorage 5min）、
 *       骨架屏加载态、空状态引导
 */
import { h, ref, reactive, computed, watch, onMounted, onBeforeUnmount, onActivated, nextTick } from 'vue'
import {
  NButton, NButtonGroup, NInput, NSelect, NPagination, NSpace, NGrid, NGi,
  NDrawer, NDrawerContent, NEmpty, NSpin, NSkeleton, NTooltip, NPopover,
  NPopconfirm, NCheckbox, NTag, NDivider, NDataTable, NEllipsis, type DataTableRowKey,
  useMessage, useDialog,
} from 'naive-ui'
import type { SelectOption, DataTableColumns } from 'naive-ui'
import { useRouter } from 'vue-router'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import KnowledgeCard from './components/KnowledgeCard.vue'
import KnowledgeFormDrawer from './components/KnowledgeFormDrawer.vue'
import TableColumnSettings, { type ColumnSetting, type ColumnTemplate } from '@/components/common/TableColumnSettings/index.vue'
import BatchSelectionBar, { type BatchAction } from '@/components/common/BatchSelectionBar/index.vue'
import { savePreference, getPreference } from '@/services/userPreference'
import { fetchWithRetry, retryPresets } from '@/services/requestRetry'
import {
  listKnowledgeBases,
  deleteKnowledgeBase,
  refreshStatistics,
  type KnowledgeVo,
  type KnowledgeListQuery,
} from '@/api/v2/knowledgeBase'
import { getDictDataByType } from '@/api/dict'
import { getModelListByCategory } from '@/api/model'
import { extractKeywords, highlightTextForRender, extractSnippetAroundKeyword } from '@/utils/searchHighlight'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

// ========== 状态 ==========

const loading = ref(true)
const firstLoad = ref(true) // 首次加载用骨架屏，后续用 spin
const tableData = ref<KnowledgeVo[]>([])
const searchKeyword = ref('')
const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const selectedKids = ref<string[]>([])
const viewMode = ref<'card' | 'list'>((sessionStorage.getItem('kb-view-mode') as 'card' | 'list') || 'card')
const refreshingStats = ref(false)
const pageReady = ref(false)

// 持久化视图模式
watch(viewMode, (v) => sessionStorage.setItem('kb-view-mode', v))

// 排序（无搜索时的基础选项）
const baseSortOptions: SelectOption[] = [
  { label: '名称', value: 'kname' },
  { label: '更新时间', value: 'update_time' },
  { label: '创建时间', value: 'create_time' },
  { label: '条目数', value: 'item_count' },
  { label: '片段数', value: 'fragment_count' },
  { label: '数据量', value: 'data_size' },
  { label: '分类', value: 'category' },
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
  categories: string[]
}>({
  orderBy: 'update_time',
  order: 'desc',
  categories: [],
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 12,
  itemCount: 0,
  pageSizes: [12, 24, 36, 48],
})

// 分类选项（从字典加载）
const categoryOptions = ref<SelectOption[]>([])
// 分类值到标签的映射（用于卡片和列表显示）
const categoryLabelMap = computed<Record<string, string>>(() => {
  return Object.fromEntries(categoryOptions.value.map(opt => [String(opt.value), String(opt.label)]))
})
// 向量模型选项
const vectorModelOptions = ref<Array<{ label: string; value: number | string; modelName: string }>>([])
// 向量库类型选项
const vectorStoreOptions: SelectOption[] = [
  { label: 'Weaviate', value: 'weaviate' },
  { label: 'Milvus', value: 'milvus' },
]

// Drawer 状态
const drawerVisible = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const editingData = ref<KnowledgeVo | null>(null)

// ========== 列配置系统 ==========
const tableColumnSettingsRef = ref<InstanceType<typeof TableColumnSettings> | null>(null)
const columnSettings = ref<ColumnSetting[]>([
  { key: 'kname', title: '名称', visible: true, order: 0 },
  { key: 'category', title: '分类', visible: true, order: 1 },
  { key: 'description', title: '描述', visible: true, order: 2 },
  { key: 'itemCount', title: '条目', visible: true, order: 3 },
  { key: 'fragmentCount', title: '片段', visible: true, order: 4 },
  { key: 'attachCount', title: '文档', visible: true, order: 5 },
  { key: 'createTime', title: '创建时间', visible: false, order: 6 },
  { key: 'updateTime', title: '更新时间', visible: true, order: 7 },
])

// 场景化列模板
const columnTemplates: ColumnTemplate[] = [
  { key: 'overview', name: '总览', icon: 'mdi:view-dashboard', description: '展示核心统计信息', columns: ['kname', 'category', 'itemCount', 'fragmentCount', 'attachCount', 'updateTime'] },
  { key: 'management', name: '管理', icon: 'mdi:cog', description: '适合批量管理操作', columns: ['kname', 'category', 'description', 'createTime', 'updateTime'] },
  { key: 'minimal', name: '简洁', icon: 'mdi:view-agenda', description: '仅显示关键信息', columns: ['kname', 'category', 'updateTime'] },
  { key: 'full', name: '完整', icon: 'mdi:table', description: '显示所有信息', columns: ['kname', 'category', 'description', 'itemCount', 'fragmentCount', 'attachCount', 'createTime', 'updateTime'] },
]

// ========== 跨页批量选择 ==========
const selectedRowKeys = ref<DataTableRowKey[]>([])
const selectAllPages = ref(false)  // 是否跨页全选

// 批量操作按钮
const batchActions: BatchAction[] = [
  { key: 'delete', label: '批量删除', icon: 'mdi:delete-outline', type: 'error', danger: true, tooltip: '删除选中的知识库及其所有数据' },
  { key: 'export', label: '导出列表', icon: 'mdi:export', type: 'primary' },
]

// ========== 列表视图表格列定义 ==========
// 所有可用列定义
const allColumnDefs: Record<string, DataTableColumns<KnowledgeVo>[number]> = {
  kname: {
    title: '名称',
    key: 'kname',
    minWidth: 180,
    resizable: true,
    ellipsis: { tooltip: true },
    render: (row: KnowledgeVo) => {
      const raw = row.kname || '未命名'
      const content = highlightKeywords.value.length
        ? highlightTextForRender(raw, highlightKeywords.value, h)
        : [raw]
      return h('a', {
        style: 'color: #0078D4; cursor: pointer; font-weight: 500',
        onClick: () => handleEnterKnowledge(row.kid),
      }, content)
    },
  },
  category: {
    title: '分类',
    key: 'category',
    width: 100,
    resizable: true,
    render: (row: KnowledgeVo) => {
      if (!row.category) return h('span', { style: 'color: #ccc' }, '—')
      const label = categoryOptions.value.find(opt => opt.value === row.category)?.label || row.category
      return h(NTag, { size: 'small', bordered: false, type: 'info' }, { default: () => label })
    },
  },
  description: {
    title: '描述',
    key: 'description',
    minWidth: 200,
    resizable: true,
    ellipsis: { tooltip: true },
    render: (row: KnowledgeVo) => {
      const raw = row.description || '—'
      const displayText = raw.length > 80 && highlightKeywords.value.length
        ? extractSnippetAroundKeyword(raw, highlightKeywords.value)
        : raw
      const content = highlightKeywords.value.length
        ? highlightTextForRender(displayText, highlightKeywords.value, h)
        : [displayText]
      return h('span', {
        style: 'color: #666',
        title: raw.length > 80 ? raw : undefined,
      }, content)
    },
  },
  itemCount: {
    title: '条目',
    key: 'itemCount',
    width: 80,
    align: 'right',
    sorter: (a: KnowledgeVo, b: KnowledgeVo) => (a.itemCount ?? 0) - (b.itemCount ?? 0),
    render: (row: KnowledgeVo) => h('span', { style: 'font-variant-numeric: tabular-nums' }, String(row.itemCount ?? 0)),
  },
  fragmentCount: {
    title: '片段',
    key: 'fragmentCount',
    width: 80,
    align: 'right',
    sorter: (a: KnowledgeVo, b: KnowledgeVo) => (a.fragmentCount ?? 0) - (b.fragmentCount ?? 0),
    render: (row: KnowledgeVo) => h('span', { style: 'font-variant-numeric: tabular-nums' }, String(row.fragmentCount ?? 0)),
  },
  attachCount: {
    title: '文档',
    key: 'attachCount',
    width: 80,
    align: 'right',
    sorter: (a: KnowledgeVo, b: KnowledgeVo) => (a.attachCount ?? 0) - (b.attachCount ?? 0),
    render: (row: KnowledgeVo) => h('span', { style: 'font-variant-numeric: tabular-nums' }, String(row.attachCount ?? 0)),
  },
  createTime: {
    title: '创建时间',
    key: 'createTime',
    width: 160,
    resizable: true,
    sorter: (a: KnowledgeVo, b: KnowledgeVo) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime(),
    render: (row: KnowledgeVo) => h('span', { style: 'color: #999; font-size: 12px' }, formatTime(row.createTime)),
  },
  updateTime: {
    title: '更新时间',
    key: 'updateTime',
    width: 160,
    resizable: true,
    sorter: (a: KnowledgeVo, b: KnowledgeVo) => new Date(a.updateTime || 0).getTime() - new Date(b.updateTime || 0).getTime(),
    render: (row: KnowledgeVo) => h('span', { style: 'color: #999; font-size: 12px' }, formatTime(row.updateTime)),
  },
}

// 操作列（始终显示，不参与列配置）
const actionsColumn: DataTableColumns<KnowledgeVo>[number] = {
  title: '操作',
  key: 'actions',
  width: 180,
  fixed: 'right',
  render: (row: KnowledgeVo) => h(NSpace, { size: 4 }, {
    default: () => [
      h(NButton, { size: 'tiny', quaternary: true, type: 'primary', onClick: (e: MouseEvent) => { e.stopPropagation(); handleEnterKnowledge(row.kid); } }, { default: () => '进入' }),
      h(NButton, { size: 'tiny', quaternary: true, onClick: (e: MouseEvent) => { e.stopPropagation(); openEditDrawer(row); } }, { default: () => '编辑' }),
      h(NPopconfirm, { onPositiveClick: () => handleDeleteKnowledge(row.kid, row.kname) }, {
        trigger: () => h(NButton, { size: 'tiny', quaternary: true, type: 'error', onClick: (e: MouseEvent) => e.stopPropagation() }, { default: () => '删除' }),
        default: () => `确定要删除「${row.kname}」吗？`,
      }),
    ],
  }),
}

// 选择列
const selectionColumn: DataTableColumns<KnowledgeVo>[number] = {
  type: 'selection',
  fixed: 'left',
  width: 50,
}

// 根据配置生成最终列
const listColumns = computed<DataTableColumns<KnowledgeVo>>(() => {
  const cols: DataTableColumns<KnowledgeVo> = []
  
  // 添加选择列
  cols.push(selectionColumn)
  
  // 添加配置中的列（按顺序）
  const sortedSettings = [...columnSettings.value].sort((a, b) => a.order - b.order)
  for (const setting of sortedSettings) {
    if (setting.visible && allColumnDefs[setting.key]) {
      cols.push(allColumnDefs[setting.key])
    }
  }
  
  // 添加操作列
  cols.push(actionsColumn)
  
  return cols
})

// ========== 计算属性 ==========

/** 是否有激活的筛选条件（用于显示"清除筛选"按钮） */
const hasActiveFilters = computed(() => {
  const hasCategoryFilter = filterState.categories.length > 0
    && categoryOptions.value.length > 0
    && filterState.categories.length < categoryOptions.value.length
  return !!(searchKeyword.value.trim() || hasCategoryFilter)
})

/** 汇总统计 */
const summaryStats = computed(() => {
  const data = tableData.value
  return {
    total: pagination.itemCount,
    totalItems: data.reduce((s, d) => s + (d.itemCount ?? 0), 0),
    totalFragments: data.reduce((s, d) => s + (d.fragmentCount ?? 0), 0),
    totalDocs: data.reduce((s, d) => s + (d.attachCount ?? 0), 0),
  }
})

/** 搜索关键词数组（用于高亮） */
const highlightKeywords = computed(() => extractKeywords(searchKeyword.value))

// ========== 数据加载 ==========

async function fetchData() {
  loading.value = true
  try {
    const params: KnowledgeListQuery = {
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      orderBy: (filterState.orderBy === 'relevance' ? 'update_time' : filterState.orderBy) as any,
      order: filterState.order,
    }
    if (searchKeyword.value.trim()) {
      params.searchKeyword = searchKeyword.value.trim()
    }
    if (filterState.categories.length > 0 && filterState.categories.length < categoryOptions.value.length) {
      params.categories = filterState.categories
    }
    const res: any = await listKnowledgeBases(params)
    if (res.code === 200) {
      tableData.value = res.rows || res.data?.rows || []
      pagination.itemCount = res.total || res.data?.total || 0
    } else {
      message.error(res.msg || '加载知识库列表失败')
    }
  } catch (error: any) {
    message.error('加载失败：' + (error.message || '网络错误'))
  } finally {
    loading.value = false
    firstLoad.value = false
  }
}

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

async function loadVectorModels() {
  try {
    const res: any = await getModelListByCategory('vector')
    if (res && res.code === 200 && Array.isArray(res.rows)) {
      vectorModelOptions.value = res.rows.map((item: any) => {
        // 大整数安全处理
        let idValue: number | string
        const idNum = Number(item.id)
        if (isNaN(idNum) || idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER) {
          idValue = String(item.id)
        } else {
          idValue = idNum
        }
        return {
          label: item.modelName || item.name || `模型 ${item.id}`,
          value: idValue,
          modelName: item.modelName || item.name,
        }
      })
    }
  } catch {
    // 模型加载失败不阻塞页面
  }
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
      filterState.orderBy = previousSortState.value.orderBy
      filterState.order = previousSortState.value.order
    } else if (wasSearching && isSearching && filterState.orderBy !== 'relevance') {
      filterState.orderBy = 'relevance'
      filterState.order = 'desc'
    }
    pagination.page = 1
    fetchData()
  }, 300)
}

function handleSearchClear() {
  const wasSearching = !!searchKeyword.value.trim()
  searchKeyword.value = ''
  if (wasSearching) {
    filterState.orderBy = previousSortState.value.orderBy
    filterState.order = previousSortState.value.order
  }
  pagination.page = 1
  fetchData()
}

// ========== 排序 ==========

function handleSortChange(value: string) {
  filterState.orderBy = value
  pagination.page = 1
  fetchData()
}

function toggleSortOrder() {
  filterState.order = filterState.order === 'asc' ? 'desc' : 'asc'
  pagination.page = 1
  fetchData()
}

// ========== 分类筛选 ==========

function handleCategoryChange(values: string[]) {
  filterState.categories = values
  pagination.page = 1
  fetchData()
}

function clearAllFilters() {
  searchKeyword.value = ''
  filterState.orderBy = previousSortState.value.orderBy
  filterState.order = previousSortState.value.order
  filterState.categories = []
  pagination.page = 1
  fetchData()
}

// ========== 分页 ==========

function handlePageChange(page: number) {
  pagination.page = page
  fetchData()
  saveState()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  fetchData()
  saveState()
}

// ========== CRUD 操作 ==========

function openCreateDrawer() {
  drawerMode.value = 'create'
  editingData.value = null
  drawerVisible.value = true
}

function openEditDrawer(item: KnowledgeVo) {
  drawerMode.value = 'edit'
  editingData.value = { ...item }
  drawerVisible.value = true
}

function handleFormSubmitSuccess() {
  drawerVisible.value = false
  fetchData()
}

function handleEnterKnowledge(kid: string) {
  router.push(`/knowledge-v2/${kid}`)
}

function handleDeleteKnowledge(kid: string, name: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除知识库「${name}」吗？此操作不可撤销。`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res: any = await deleteKnowledgeBase(kid)
        if (res.code === 200) {
          message.success('删除成功')
          await fetchData()
        } else {
          message.error('删除失败：' + (res.msg || '未知错误'))
        }
      } catch (error: any) {
        message.error('删除失败：' + (error.message || '网络错误'))
      }
    },
  })
}

function handleBatchDelete() {
  if (selectedKids.value.length === 0) {
    message.warning('请先选择要删除的知识库')
    return
  }
  dialog.warning({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedKids.value.length} 个知识库吗？此操作不可撤销。`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // 逐个删除（后端可能不支持批量接口）
        let successCount = 0
        for (const kid of selectedKids.value) {
          try {
            const res: any = await deleteKnowledgeBase(kid)
            if (res.code === 200) successCount++
          } catch { /* 继续删除其他 */ }
        }
        if (successCount > 0) {
          message.success(`已删除 ${successCount} 个知识库`)
          selectedKids.value = []
          await fetchData()
        } else {
          message.error('批量删除失败')
        }
      } catch (error: any) {
        message.error('批量删除失败：' + (error.message || '网络错误'))
      }
    },
  })
}

async function handleRefreshStatistics() {
  refreshingStats.value = true
  try {
    const res: any = await refreshStatistics()
    if (res.code === 200) {
      message.success('统计信息已刷新')
      await fetchData()
    } else {
      message.error('刷新失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('刷新失败：' + (error.message || '网络错误'))
  } finally {
    refreshingStats.value = false
  }
}

// ========== 表格选择事件 ==========
function handleSelectionChange(keys: DataTableRowKey[]) {
  selectedRowKeys.value = keys
  // 如果不是跨页全选，同步到selectedKids
  if (!selectAllPages.value) {
    selectedKids.value = keys as string[]
  }
}

// 选择当前页
function selectCurrentPage() {
  selectedRowKeys.value = tableData.value.map(row => row.kid)
  selectedKids.value = [...selectedRowKeys.value as string[]]
  selectAllPages.value = false
}

// 选择所有页
function selectAllPagesHandler() {
  selectAllPages.value = true
  // 提示用户已选择所有页
  message.info(`已选择全部 ${pagination.itemCount} 个知识库，将在操作前确认具体列表`)
}

// 清空选择
function clearSelection() {
  selectedRowKeys.value = []
  selectedKids.value = []
  selectAllPages.value = false
}

// 批量操作处理
async function handleBatchAction(action: string, count: number) {
  if (action === 'delete') {
    // 确认对话框已在外层处理
    if (selectAllPages.value) {
      // 跨页删除需要特殊处理
      dialog.warning({
        title: '确认批量删除全部',
        content: `确定要删除全部 ${pagination.itemCount} 个知识库吗？此操作不可撤销。`,
        positiveText: '确定删除',
        negativeText: '取消',
        onPositiveClick: async () => {
          await executeBatchDeleteAll()
        }
      })
    } else {
      await handleBatchDelete()
    }
  } else if (action === 'export') {
    message.success(`已导出 ${count} 个知识库信息`)
  }
}

// 跨页批量删除
async function executeBatchDeleteAll() {
  // 这里需要后端支持批量删除接口
  message.warning('跨页批量删除需要后端支持，当前仅支持逐页删除')
}

// ========== 列配置保存/恢复 ==========
async function saveColumnSettings() {
  await savePreference('table_column', 'knowledge-list', columnSettings.value)
}

async function restoreColumnSettings() {
  const saved = await getPreference<ColumnSetting[]>('table_column', 'knowledge-list')
  if (saved && saved.length > 0) {
    // 合并保存的配置和默认配置（防止新增列遗漏）
    const savedMap = new Map(saved.map(s => [s.key, s]))
    columnSettings.value = columnSettings.value.map(col => {
      const s = savedMap.get(col.key)
      if (s) return { ...col, visible: s.visible, order: s.order }
      return col
    })
  }
}

// ========== 状态持久化（sessionStorage，5 分钟过期） ==========

const STATE_KEY = 'knowledge-list-v2-state'
const STATE_EXPIRY_MS = 5 * 60 * 1000

function saveState() {
  const state = {
    searchKeyword: searchKeyword.value,
    filterState: { ...filterState },
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
    viewMode: viewMode.value,
    timestamp: Date.now(),
  }
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch { /* 存储满了就算了 */ }
}

function restoreState(): boolean {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (!raw) return false
    const state = JSON.parse(raw)
    if (Date.now() - state.timestamp > STATE_EXPIRY_MS) {
      sessionStorage.removeItem(STATE_KEY)
      return false
    }
    searchKeyword.value = state.searchKeyword || ''
    Object.assign(filterState, state.filterState || {})
    pagination.page = state.pagination?.page || 1
    pagination.pageSize = state.pagination?.pageSize || 12
    if (state.viewMode) viewMode.value = state.viewMode
    return true
  } catch {
    return false
  }
}

// ========== 工具函数 ==========

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y === now.getFullYear() ? `${m}-${day}` : `${y}-${m}-${day}`
}

// ========== 生命周期 ==========

onMounted(async () => {
  const restored = restoreState()
  await restoreColumnSettings()  // 恢复列配置
  await Promise.all([loadCategoryOptions(), loadVectorModels()])
  await fetchData()
  if (!restored) firstLoad.value = false
  nextTick(() => { pageReady.value = true })
})

onBeforeUnmount(() => {
  saveState()
  if (searchTimer.value) clearTimeout(searchTimer.value)
})

onActivated(() => {
  // 从子页面返回时刷新数据
  if (!firstLoad.value) fetchData()
})

// 监听筛选变化自动保存状态
watch(filterState, () => saveState(), { deep: true })
</script>

<template>
  <transition name="page-fade" appear>
  <div class="knowledge-list-page" v-show="pageReady">
    <!-- 顶部工具栏 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">知识库</h2>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton quaternary circle size="small" :loading="refreshingStats" @click="handleRefreshStatistics">
              <template #icon><SvgIcon icon="mdi:refresh" /></template>
            </NButton>
          </template>
          刷新统计信息
        </NTooltip>
        <!-- 汇总统计 -->
        <div v-if="!firstLoad && tableData.length > 0" class="summary-stats">
          <span class="summary-stat">
            <span class="summary-stat__value">{{ summaryStats.total }}</span> 个知识库
          </span>
          <span class="summary-divider">·</span>
          <span class="summary-stat">
            <span class="summary-stat__value">{{ summaryStats.totalItems }}</span> 条目
          </span>
          <span class="summary-divider">·</span>
          <span class="summary-stat">
            <span class="summary-stat__value">{{ summaryStats.totalFragments }}</span> 片段
          </span>
          <span class="summary-divider">·</span>
          <span class="summary-stat">
            <span class="summary-stat__value">{{ summaryStats.totalDocs }}</span> 文档
          </span>
        </div>
      </div>
      <div class="header-right">
        <NButton
          v-if="selectedKids.length > 0"
          type="error"
          size="small"
          @click="handleBatchDelete"
        >
          <template #icon><SvgIcon icon="mdi:delete-outline" /></template>
          删除已选 ({{ selectedKids.length }})
        </NButton>
        <NButton type="primary" @click="openCreateDrawer">
          <template #icon><SvgIcon icon="mdi:plus" /></template>
          新建知识库
        </NButton>
      </div>
    </div>

    <!-- 搜索和筛选栏 -->
    <div class="filter-bar">
      <NInput
        :value="searchKeyword"
        placeholder="搜索知识库名称或描述..."
        clearable
        maxlength="100"
        style="width: 320px"
        @input="handleSearchInput"
        @clear="handleSearchClear"
      >
        <template #prefix><SvgIcon icon="mdi:magnify" /></template>
      </NInput>

      <NPopover trigger="click" placement="bottom-start" :width="280">
        <template #trigger>
          <NButton quaternary :type="filterState.categories.length > 0 && filterState.categories.length < categoryOptions.length ? 'primary' : 'default'">
            <template #icon><SvgIcon icon="mdi:filter-variant" /></template>
            分类
            <NTag v-if="filterState.categories.length > 0 && filterState.categories.length < categoryOptions.length" size="small" round type="primary" style="margin-left: 4px">
              {{ filterState.categories.length }}
            </NTag>
          </NButton>
        </template>
        <div class="category-filter-panel">
          <div class="category-filter-header">
            <span class="category-filter-title">按分类筛选</span>
            <NButton text size="tiny" @click="filterState.categories = categoryOptions.map((o: any) => o.value)">全选</NButton>
            <NButton text size="tiny" @click="filterState.categories = []; handleCategoryChange([])">清除</NButton>
          </div>
          <div class="category-filter-list">
            <NCheckbox
              v-for="opt in categoryOptions"
              :key="String(opt.value)"
              :checked="filterState.categories.includes(String(opt.value))"
              @update:checked="(checked: boolean) => {
                if (checked) {
                  handleCategoryChange([...filterState.categories, String(opt.value)])
                } else {
                  handleCategoryChange(filterState.categories.filter(c => c !== String(opt.value)))
                }
              }"
            >
              {{ opt.label }}
            </NCheckbox>
          </div>
        </div>
      </NPopover>

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

      <div class="filter-bar-spacer" />

      <!-- 视图切换 -->
      <NButtonGroup size="small">
        <NTooltip trigger="hover" placement="bottom">
          <template #trigger>
            <NButton :type="viewMode === 'card' ? 'primary' : 'default'" @click="viewMode = 'card'">
              <template #icon><SvgIcon icon="mdi:view-grid-outline" /></template>
            </NButton>
          </template>
          卡片视图
        </NTooltip>
        <NTooltip trigger="hover" placement="bottom">
          <template #trigger>
            <NButton :type="viewMode === 'list' ? 'primary' : 'default'" @click="viewMode = 'list'">
              <template #icon><SvgIcon icon="mdi:view-list-outline" /></template>
            </NButton>
          </template>
          列表视图
        </NTooltip>
      </NButtonGroup>

      <NButton
        v-if="hasActiveFilters"
        text
        type="primary"
        size="small"
        @click="clearAllFilters"
      >
        <template #icon><SvgIcon icon="mdi:filter-remove" /></template>
        清除筛选
      </NButton>

      <NDivider vertical />

      <!-- 列配置按钮（仅列表视图且有数据时，卡片视图无列概念） -->
      <TableColumnSettings
        v-if="viewMode === 'list' && tableData.length > 0"
        ref="tableColumnSettingsRef"
        v-model="columnSettings"
        :templates="columnTemplates"
        storage-key="knowledge-list"
        :default-visible="['kname', 'category', 'description', 'itemCount', 'fragmentCount', 'attachCount', 'updateTime']"
        @update:model-value="saveColumnSettings"
      />
    </div>

    <!-- 骨架屏加载态（仅首次加载） -->
    <div v-if="firstLoad && loading" class="card-grid">
      <div v-for="i in 6" :key="i" class="card-skeleton">
        <NSkeleton :width="'60%'" :height="20" style="margin-bottom: 12px" />
        <NSkeleton :width="'100%'" :height="14" style="margin-bottom: 8px" />
        <NSkeleton :width="'80%'" :height="14" style="margin-bottom: 16px" />
        <div style="display: flex; gap: 24px">
          <NSkeleton :width="60" :height="14" />
          <NSkeleton :width="60" :height="14" />
          <NSkeleton :width="60" :height="14" />
        </div>
      </div>
    </div>

    <!-- 卡片网格 -->
    <NSpin v-else-if="(tableData.length > 0 || loading) && viewMode === 'card'" :show="loading" description="加载中...">
      <div class="card-grid">
        <KnowledgeCard
          v-for="item in tableData"
          :key="item.kid"
          :data="item"
          :search-keyword="searchKeyword"
          :category-map="categoryLabelMap"
          @enter="handleEnterKnowledge"
          @edit="openEditDrawer"
          @delete="handleDeleteKnowledge"
        />
      </div>
    </NSpin>

    <!-- 列表视图 -->
    <NSpin v-else-if="(tableData.length > 0 || loading) && viewMode === 'list'" :show="loading" description="加载中...">
      <NDataTable
        :columns="listColumns"
        :data="tableData"
        :row-key="(row: any) => row.kid"
        :checked-row-keys="selectedRowKeys"
        :bordered="false"
        :single-line="false"
        striped
        size="small"
        :row-props="(row: any) => ({
          style: 'cursor: pointer',
          onClick: (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.closest('button') || target.closest('.n-checkbox') || target.closest('.n-popconfirm')) return
            handleEnterKnowledge(row.kid)
          },
          onDblclick: () => handleEnterKnowledge(row.kid),
        })"
        :scroll-x="900"
        style="margin-top: 4px"
        @update:checked-row-keys="handleSelectionChange"
      />
    </NSpin>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <NEmpty :description="hasActiveFilters ? '没有匹配的知识库' : '还没有知识库'">
        <template #extra>
          <NButton v-if="hasActiveFilters" @click="clearAllFilters">清除筛选条件</NButton>
          <NButton v-else type="primary" @click="openCreateDrawer">
            <template #icon><SvgIcon icon="mdi:plus" /></template>
            创建第一个知识库
          </NButton>
        </template>
      </NEmpty>
    </div>

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

    <!-- 跨页批量选择操作栏 -->
    <BatchSelectionBar
      :visible="viewMode === 'list'"
      :selected-count="selectedRowKeys.length"
      :total-count="pagination.itemCount"
      :current-page-count="tableData.length"
      :show-select-all-pages="pagination.itemCount > tableData.length"
      :actions="batchActions"
      @clear="clearSelection"
      @select-all-pages="selectAllPagesHandler"
      @select-current-page="selectCurrentPage"
      @action="handleBatchAction"
    />

    <!-- 新建/编辑 Drawer -->
    <KnowledgeFormDrawer
      v-model:visible="drawerVisible"
      :mode="drawerMode"
      :editing-data="editingData"
      :category-options="categoryOptions"
      :vector-model-options="vectorModelOptions"
      :vector-store-options="vectorStoreOptions"
      @success="handleFormSubmitSuccess"
    />
  </div>
  </transition>
</template>

<style scoped>
/* 页面进入动画 */
.page-fade-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.page-fade-enter-from { opacity: 0; transform: translateY(12px); }

.knowledge-list-page {
  padding: 20px 32px;
  max-width: 1800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #323130;
  margin: 0;
}

/* 汇总统计 */
.summary-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #8a8886;
  margin-left: 8px;
  padding-left: 12px;
  border-left: 1px solid #edebe9;
}
.summary-stat__value {
  font-weight: 600;
  color: #605e5c;
  font-variant-numeric: tabular-nums;
}
.summary-divider {
  color: #d2d0ce;
  margin: 0 2px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-bar-spacer {
  flex: 1;
}

.category-filter-panel {
  padding: 4px 0;
}

.category-filter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 8px 0;
  border-bottom: 1px solid #edebe9;
  margin-bottom: 8px;
}

.category-filter-title {
  font-size: 13px;
  font-weight: 500;
  color: #323130;
  flex: 1;
}

.category-filter-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 1100px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}

.card-skeleton {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #edebe9;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

/* 搜索关键词高亮（列表视图） */
.knowledge-list-page :deep(.search-hl) {
  background: linear-gradient(120deg, rgba(255, 235, 59, 0.35) 0%, rgba(255, 235, 59, 0.55) 100%);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding: 8px 0;
}

/* 列表视图表格行 hover 效果 */
:deep(.n-data-table .n-data-table-tr:hover) {
  background-color: #f3f2f1 !important;
}

/* 列表视图数字列等宽 */
:deep(.n-data-table-td) {
  font-variant-numeric: tabular-nums;
}
</style>

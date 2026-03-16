<script setup lang="ts">
/**
 * 文档管理 Tab（v2）
 *
 * 新业务流程：上传 → 解析 → 切片 → 向量化 → 完成（3 步核心，不碰条目、不调 LLM）
 * 功能：拖拽上传区、文档列表表格、3 步进度实时轮询、文件类型图标、
 *       批量删除、重新处理、下载、空状态引导
 */
import { ref, reactive, computed, inject, onMounted, onActivated, onBeforeUnmount, watch, h } from 'vue'
import type { Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton, NSpace, NDataTable, NTag,
  NEmpty, NSpin, NPopconfirm, NTooltip,
  NInput, NSelect, NPagination, NAlert, NDatePicker,
  useMessage, useDialog,
} from 'naive-ui'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { extractKeywords, highlightTextForRender } from '@/utils/searchHighlight'
import type { KnowledgeVo } from '@/api/v2/knowledgeBase'
import request from '@/utils/request/req'
import { eventBus } from '@/utils/eventBus'

// 新上传组件
import DocumentUploader from '@/components/knowledge/upload/DocumentUploader.vue'

const message = useMessage()
const dialogInst = useDialog()
const route = useRoute()
const router = useRouter()

// ========== 注入知识库上下文 ==========

const kid = inject<Ref<string>>('kid')!
const knowledgeBase = inject<Ref<KnowledgeVo | null>>('knowledgeBase')!
const refreshKnowledgeBase = inject<() => Promise<void>>('refreshKnowledgeBase')!

// ========== 状态 ==========

const loading = ref(false)
const documents = ref<any[]>([])
const selectedRowKeys = ref<DataTableRowKey[]>([])

// 搜索
const searchKeyword = ref('')
const docTypeFilter = ref<string | null>(null)
const highlightDocId = ref<string | undefined>(undefined)

// 上传时间日期范围筛选
const docDateRange = ref<[number, number] | null>(null)
const docDateShortcuts = {
  '今天': () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return [start, Date.now()] as [number, number]
  },
  '近7天': () => [Date.now() - 7 * 86400000, Date.now()] as [number, number],
  '近30天': () => [Date.now() - 30 * 86400000, Date.now()] as [number, number],
}

// 文档类型选项
const docTypeOptions = [
  { label: 'PDF', value: 'pdf' },
  { label: 'Word', value: 'docx' },
  { label: 'Excel', value: 'xlsx' },
  { label: 'PPT', value: 'pptx' },
  { label: '文本', value: 'txt' },
  { label: 'Markdown', value: 'md' },
  { label: 'CSV', value: 'csv' },
]

function onDocTypeChange(val?: string | null) {
  const newVal = val ?? null
  // 防止冗余调用：NSelect 在 :value 被外部改为 null 时会自动 emit null，值未变则跳过
  if (newVal === docTypeFilter.value) return
  docTypeFilter.value = newVal
  pagination.page = 1
  fetchDocuments()
}

function clearDocType() {
  docTypeFilter.value = null
  pagination.page = 1
  fetchDocuments()
}

function clearDocDateRange() {
  docDateRange.value = null
  pagination.page = 1
  fetchDocuments()
}

function onDocDateChange(val: [number, number] | null) {
  docDateRange.value = val
  pagination.page = 1
  fetchDocuments()
}

const hasActiveDocFilters = computed(() => !!docTypeFilter.value || !!docDateRange.value)

function clearDocFilters() {
  const hadFilters = docTypeFilter.value || docDateRange.value || searchKeyword.value || highlightDocId.value
  docTypeFilter.value = null
  docDateRange.value = null
  searchKeyword.value = ''
  highlightDocId.value = undefined
  if (hadFilters) {
    pagination.page = 1
    fetchDocuments()
  }
}

// 行高亮（从 MonitorTab Top 占用表跳转过来时）
function getRowProps(row: any) {
  const isHighlighted = highlightDocId.value && (
    String(row.id) === highlightDocId.value ||
    String(row.docId) === highlightDocId.value
  )
  return {
    style: isHighlighted
      ? 'background: #eff6fc; box-shadow: inset 3px 0 0 #0078d4; transition: background 600ms ease;'
      : '',
  }
}

// 进度轮询（用于传输列表实时更新处理进度）
const pollingTimers = ref<Map<string, ReturnType<typeof setInterval>>>(new Map())

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  pageSizes: [10, 20, 50],
})

// ========== 文件类型图标映射 ==========

const fileTypeIconMap: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'mdi:file-pdf-box', color: '#d13438' },
  doc: { icon: 'mdi:file-word-box', color: '#0078d4' },
  docx: { icon: 'mdi:file-word-box', color: '#0078d4' },
  xls: { icon: 'mdi:file-excel-box', color: '#107c10' },
  xlsx: { icon: 'mdi:file-excel-box', color: '#107c10' },
  ppt: { icon: 'mdi:file-powerpoint-box', color: '#ca5010' },
  pptx: { icon: 'mdi:file-powerpoint-box', color: '#ca5010' },
  md: { icon: 'mdi:language-markdown', color: '#323130' },
  txt: { icon: 'mdi:file-document-outline', color: '#605e5c' },
  csv: { icon: 'mdi:file-delimited-outline', color: '#107c10' },
  json: { icon: 'mdi:code-json', color: '#ca5010' },
  xml: { icon: 'mdi:file-xml-box', color: '#8764b8' },
  html: { icon: 'mdi:language-html5', color: '#ca5010' },
  java: { icon: 'mdi:language-java', color: '#d13438' },
  py: { icon: 'mdi:language-python', color: '#0078d4' },
  js: { icon: 'mdi:language-javascript', color: '#ca5010' },
  ts: { icon: 'mdi:language-typescript', color: '#0078d4' },
  c: { icon: 'mdi:language-c', color: '#605e5c' },
  cpp: { icon: 'mdi:language-cpp', color: '#605e5c' },
  go: { icon: 'mdi:language-go', color: '#008272' },
  rs: { icon: 'mdi:language-rust', color: '#323130' },
  zip: { icon: 'mdi:folder-zip-outline', color: '#ca5010' },
}

function getFileTypeInfo(fileName: string): { icon: string; color: string } {
  const ext = fileName?.split('.').pop()?.toLowerCase() || ''
  return fileTypeIconMap[ext] || { icon: 'mdi:file-outline', color: '#a19f9d' }
}

// ========== 处理状态映射（新 3 步流水线） ==========

interface StatusInfo {
  label: string
  type: 'default' | 'info' | 'success' | 'warning' | 'error'
  step: number // 0-based step index, -1 for failed
}

// 处理状态映射（用于操作列按钮显示判断）
const statusMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error'; step: number }> = {
  UPLOADING: { label: '上传中', type: 'info', step: 0 },
  PARSING: { label: '解析中', type: 'info', step: 0 },
  CHUNKING: { label: '切片中', type: 'info', step: 1 },
  VECTORIZING: { label: '向量化中', type: 'info', step: 2 },
  COMPLETED: { label: '已完成', type: 'success', step: 3 },
  FAILED: { label: '失败', type: 'error', step: -1 },
  CANCELLED: { label: '已取消', type: 'warning', step: -1 },
}

function isProcessing(status: string): boolean {
  return ['UPLOADING', 'PARSING', 'CHUNKING', 'VECTORIZING'].includes(status)
}

// 文档统计（后端只返回处理完成的文档）
const docStats = computed(() => {
  return { total: documents.value.length }
})

// ========== 格式化 ==========

function formatTime(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ========== 表格列定义 ==========

const highlightKeywords = computed(() => extractKeywords(searchKeyword.value))

const columns = computed<DataTableColumns<any>>(() => [
  { type: 'selection' },
  {
    title: '文件名',
    key: 'docName',
    minWidth: 200,
    resizable: true,
    ellipsis: { tooltip: true },
    render(row: any) {
      const info = getFileTypeInfo(row.docName || '')
      const raw = row.docName || '-'
      const content = highlightKeywords.value.length
        ? highlightTextForRender(raw, highlightKeywords.value, h)
        : [raw]
      return h('div', { style: 'display: flex; align-items: center; gap: 8px' }, [
        h(SvgIcon, { icon: info.icon, style: `color: ${info.color}; font-size: 20px; flex-shrink: 0` }),
        h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap' }, content),
      ])
    },
  },
  {
    title: '大小',
    key: 'fileSize',
    width: 100,
    sorter: (a: any, b: any) => (a.fileSize ?? 0) - (b.fileSize ?? 0),
    render(row: any) {
      return h('span', { style: 'font-variant-numeric: tabular-nums' }, formatFileSize(row.fileSize || 0))
    },
  },
  {
    title: '上传时间',
    key: 'createTime',
    width: 160,
    resizable: true,
    sorter: 'default',
    render(row: any) {
      return formatTime(row.createTime)
    },
  },
  {
    title: '更新时间',
    key: 'updateTime',
    width: 160,
    resizable: true,
    sorter: 'default',
    render(row: any) {
      return formatTime(row.updateTime)
    },
  },
  {
    title: '片段数',
    key: 'fragmentCount',
    width: 80,
    align: 'center',
    sorter: 'default',
    render(row: any) {
      const count = row.fragmentCount || 0
      return h(NTag, { size: 'small', type: count > 0 ? 'info' : 'default' }, { default: () => String(count) })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render(row: any) {
      // 后端只返回处理完成的文档，简化操作列
      return h(NSpace, { size: 4 }, {
        default: () => [
          // 查看片段
          h(NTooltip, { trigger: 'hover' }, {
            trigger: () => h(NButton, {
              text: true, type: 'primary', size: 'small',
              onClick: () => viewFragments(row),
            }, { icon: () => h(SvgIcon, { icon: 'mdi:puzzle-outline' }) }),
            default: () => '查看片段',
          }),
          // 删除
          h(NPopconfirm, {
            positiveText: '确认删除',
            negativeText: '取消',
            onPositiveClick: () => handleDeleteSingle(row),
          }, {
            trigger: () => h(NTooltip, { trigger: 'hover' }, {
              trigger: () => h(NButton, {
                text: true, type: 'error', size: 'small',
              }, { icon: () => h(SvgIcon, { icon: 'mdi:delete-outline' }) }),
              default: () => '删除',
            }),
            default: () => `确定要删除「${row.docName}」吗？关联的片段也会被删除。`,
          }),
        ],
      })
    },
  },
])

// ========== 数据加载 ==========

async function fetchDocuments() {
  loading.value = true
  const params: Record<string, any> = {
    kid: kid.value,
    docName: searchKeyword.value.trim() || undefined,
    docType: docTypeFilter.value || undefined,
    pageNum: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (docDateRange.value?.[0]) {
    params.createTimeStart = new Date(docDateRange.value[0]).toISOString().slice(0, 10) + ' 00:00:00'
  }
  if (docDateRange.value?.[1]) {
    params.createTimeEnd = new Date(docDateRange.value[1]).toISOString().slice(0, 10) + ' 23:59:59'
  }
  try {
    const res: any = await request({
      url: '/knowledge/document/attach/list',
      method: 'get',
      params,
    })
    if (res.code === 200) {
      documents.value = res.rows || []
      pagination.itemCount = res.total || 0
      // 后端只返回处理完成的文档，无需轮询
    }
  } catch (error: any) {
    message.error('加载文档列表失败：' + (error.message || ''))
  } finally {
    loading.value = false
  }
}

/** 格式化文件大小 */
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

// ========== 进度轮询（用于传输列表） ==========

function startPolling(processId: string, docId: string) {
  if (pollingTimers.value.has(processId)) return
  const timer = setInterval(async () => {
    try {
      const res: any = await request({
        url: `/knowledge/document/process/${processId}`,
        method: 'get',
      })
      if (res.code === 200 && res.data) {
        const status = res.data.currentStatus
        // 更新本地文档状态
        const doc = documents.value.find((d: any) => (d.processId === processId) || (d.docId === docId))
        if (doc) {
          doc.status = status
          doc.progress = res.data.progress
        }
        // 终态：停止轮询
        if (!isProcessing(status)) {
          stopPolling(processId)
          if (status === 'COMPLETED') {
            message.success(`文档处理完成`)
            refreshKnowledgeBase()
            fetchDocuments() // 刷新列表
          } else if (status === 'FAILED') {
            message.error(`文档处理失败`)
          }
        }
      }
    } catch {
      // 轮询失败不报错，下次重试
    }
  }, 3000) // 3 秒轮询一次
  pollingTimers.value.set(processId, timer)
}

function stopPolling(processId: string) {
  const timer = pollingTimers.value.get(processId)
  if (timer) {
    clearInterval(timer)
    pollingTimers.value.delete(processId)
  }
}

function stopAllPolling() {
  pollingTimers.value.forEach((timer) => clearInterval(timer))
  pollingTimers.value.clear()
}

// ========== 操作 ==========

function viewFragments(doc: any) {
  // 切换到片段 Tab 并按文档筛选
  router.replace({
    path: `/knowledge-v2/${kid.value}`,
    query: { tab: 'fragments', docId: doc.docId || doc.id },
  })
}

async function reprocessDocument(doc: any) {
  try {
    const res: any = await request({
      url: `/knowledge/document/attach/reprocess/${doc.docId || doc.id}`,
      method: 'post',
    })
    if (res.code === 200) {
      message.success('已重新提交处理')
      await fetchDocuments()
    } else {
      message.error('重新处理失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('操作失败：' + (error.message || ''))
  }
}

async function handleDeleteSingle(doc: any) {
  try {
    // 使用 docId（文档ID字符串），后端接口期望的是 docId 而非 id（主键ID）
    const targetId = doc.docId || doc.id
    const res: any = await request({
      url: `/knowledge/document/attach/${targetId}`,
      method: 'delete',
    })
    if (res.code === 200) {
      message.success('删除成功')
      await fetchDocuments()
      refreshKnowledgeBase()
    } else {
      message.error('删除失败：' + (res.msg || ''))
    }
  } catch (error: any) {
    message.error('删除失败：' + (error.message || ''))
  }
}

async function handleBatchDelete() {
  if (selectedRowKeys.value.length === 0) return
  dialogInst.warning({
    title: '确认批量删除',
    content: `确定要删除选中的 ${selectedRowKeys.value.length} 个文档吗？关联的片段也会被删除。`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // 根据选中的主键ID找到对应的 docId（后端接口期望 docId 而非主键ID）
        const selectedDocIds = documents.value
          .filter((doc: any) => selectedRowKeys.value.includes(doc.id))
          .map((doc: any) => doc.docId || doc.id)
        
        // 逐个删除（后端批量删除接口期望 docId 列表）
        let successCount = 0
        for (const docId of selectedDocIds) {
          try {
            const res: any = await request({
              url: `/knowledge/document/attach/${docId}`,
              method: 'delete',
            })
            if (res.code === 200) successCount++
          } catch { /* 继续删除其他 */ }
        }
        
        if (successCount > 0) {
          message.success(`已删除 ${successCount} 个文档`)
          selectedRowKeys.value = []
          await fetchDocuments()
          refreshKnowledgeBase()
        } else {
          message.error('批量删除失败')
        }
      } catch (error: any) {
        message.error('批量删除失败：' + (error.message || ''))
      }
    },
  })
}

// ========== 搜索 ==========

let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleSearchInput(value: string) {
  searchKeyword.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.page = 1
    fetchDocuments()
  }, 300)
}

// ========== 分页 ==========

function handlePageChange(page: number) {
  pagination.page = page
  fetchDocuments()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  fetchDocuments()
}

// ========== 事件处理 ==========

// 处理上传任务完成事件，自动刷新当前知识库的文档列表
function handleUploadTaskCompleted(event: { taskId: string; kid: string; attachId: string }) {
  if (event.kid === kid.value) {
    // 当前知识库有文档处理完成，刷新列表
    fetchDocuments()
    // 同时刷新知识库上下文中的数据
    refreshKnowledgeBase()
  }
}

// ========== 生命周期 ==========

// ========== URL query 恢复（跨 Tab 联动） ==========
// 设计原则：
// - 只在 URL 里有筛选参数时才覆盖 UI 状态
// - URL 里没有筛选参数时不动现有 UI 状态
// - 用防重入锁避免 router.replace 触发 watch 导致重复调用
let _restoring = false

function restoreFromQuery(): boolean {
  if (_restoring) return false
  const q = route.query
  let changed = false

  if (q.docType && typeof q.docType === 'string') {
    docTypeFilter.value = q.docType
    changed = true
  }

  if (q.q && typeof q.q === 'string') {
    searchKeyword.value = q.q
    changed = true
  }

  if (q.docId && typeof q.docId === 'string') {
    highlightDocId.value = q.docId
    changed = true
  }

  if (q.createTimeStart && typeof q.createTimeStart === 'string') {
    const start = new Date(q.createTimeStart).getTime()
    const end = q.createTimeEnd ? new Date(String(q.createTimeEnd)).getTime() : Date.now()
    if (!isNaN(start) && !isNaN(end)) {
      docDateRange.value = [start, end]
      changed = true
    }
  }

  if (changed) {
    _restoring = true
    const cleanQuery = { ...q }
    delete cleanQuery.docType
    delete cleanQuery.q
    delete cleanQuery.docId
    delete cleanQuery.createTimeStart
    delete cleanQuery.createTimeEnd
    router.replace({ path: route.path, query: cleanQuery }).finally(() => {
      _restoring = false
    })
    pagination.page = 1
    fetchDocuments()
  }

  return changed
}

onMounted(() => {
  const alreadyFetched = restoreFromQuery()
  if (!alreadyFetched) fetchDocuments()
  eventBus.on('upload:task-completed', handleUploadTaskCompleted)
})

// 监听 route.query 变化（跨 Tab 联动：从 MonitorTab 带参数跳过来）
watch(() => route.query, (newQ, oldQ) => {
  if (_restoring) return
  if (newQ.tab !== 'documents') return
  // 只在 tab 刚切到 documents 或有新筛选参数时才响应
  const hasFilterParams = newQ.docType || newQ.q || newQ.docId || newQ.createTimeStart || newQ.createTimeEnd
  const tabJustChanged = oldQ?.tab !== 'documents'
  if (hasFilterParams || tabJustChanged) {
    restoreFromQuery()
  }
})

onBeforeUnmount(() => {
  stopAllPolling()
  if (searchTimer) clearTimeout(searchTimer)
  // 移除事件监听
  eventBus.off('upload:task-completed', handleUploadTaskCompleted)
})
</script>

<template>
  <div class="document-tab">
    <!-- 上传区域（传输列表入口已移至知识库头部，各 Tab 均可访问） -->
    <DocumentUploader
      :kid="kid"
      :knowledge-base-name="knowledgeBase?.kname"
    />

    <!-- 工具栏 -->
    <div class="toolbar">
      <NInput
        :value="searchKeyword"
        placeholder="搜索文件名..."
        clearable
        maxlength="100"
        style="width: 260px"
        size="small"
        @input="handleSearchInput"
        @clear="() => { searchKeyword = ''; pagination.page = 1; fetchDocuments() }"
      >
        <template #prefix><SvgIcon icon="mdi:magnify" /></template>
      </NInput>

      <NSelect
        :value="docTypeFilter"
        placeholder="文档类型"
        clearable
        size="small"
        style="width: 140px; margin-left: 8px"
        :options="docTypeOptions"
        @update:value="onDocTypeChange"
      />

      <NDatePicker
        :value="docDateRange"
        type="daterange"
        size="small"
        clearable
        close-on-select
        :shortcuts="docDateShortcuts"
        start-placeholder="上传起始"
        end-placeholder="上传截止"
        style="width: 260px; margin-left: 8px"
        format="yyyy-MM-dd"
        @update:value="onDocDateChange"
      />

      <!-- 活跃筛选提示 -->
      <div v-if="hasActiveDocFilters" class="doc-active-filters">
        <NTag
          v-if="docTypeFilter"
          closable size="small"
          style="margin-left: 8px"
          @close="clearDocType"
        >类型: {{ docTypeFilter.toUpperCase() }}</NTag>
        <NTag
          v-if="docDateRange"
          closable size="small"
          style="margin-left: 8px"
          @close="clearDocDateRange"
        >上传时间: {{ new Date(docDateRange[0]).toLocaleDateString('zh-CN') }} ~ {{ new Date(docDateRange[1]).toLocaleDateString('zh-CN') }}</NTag>
        <NButton text size="tiny" type="primary" style="margin-left: 4px" @click="clearDocFilters">清除筛选</NButton>
      </div>

      <div style="flex: 1" />

      <NButton
        v-if="selectedRowKeys.length > 0"
        type="error"
        size="small"
        @click="handleBatchDelete"
      >
        <template #icon><SvgIcon icon="mdi:delete-outline" /></template>
        删除已选 ({{ selectedRowKeys.length }})
      </NButton>

      <NTooltip trigger="hover">
        <template #trigger>
          <NButton quaternary size="small" @click="fetchDocuments">
            <template #icon><SvgIcon icon="mdi:refresh" /></template>
          </NButton>
        </template>
        刷新列表
      </NTooltip>
    </div>

    <!-- 文档表格 -->
    <NSpin :show="loading">
      <NDataTable
        v-if="documents.length > 0 || loading"
        :columns="columns"
        :data="documents"
        :row-key="(row: any) => row.id"
        :checked-row-keys="selectedRowKeys"
        :bordered="false"
        :single-line="false"
        :row-props="getRowProps"
        striped
        size="small"
        style="margin-top: 12px"
        @update:checked-row-keys="(keys: DataTableRowKey[]) => selectedRowKeys = keys"
      />
      <NEmpty
        v-else
        description="还没有上传文档"
        style="margin-top: 60px"
      >
        <template #extra>
          <span style="color: #a19f9d; font-size: 13px">拖拽文件到上方区域或点击「选择文件」开始上传</span>
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
        size="small"
        @update:page="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.document-tab {
  padding: 0;
}

.upload-zone {
  transition: all 0.2s ease;
}
.upload-zone--drag-over .upload-dragger {
  border-color: #0078d4 !important;
  background: rgba(0, 120, 212, 0.04) !important;
  box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2);
}
.upload-zone--drag-over .upload-dragger .upload-dragger-content {
  transform: scale(1.02);
}

.upload-dragger {
  border-radius: 8px;
  transition: all 0.2s ease;
}
.upload-dragger:hover {
  border-color: #0078d4;
}

.upload-dragger-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  transition: transform 0.2s ease;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.processing-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.upload-title {
  font-size: 15px;
  font-weight: 500;
  color: #323130;
  margin: 0 0 8px 0;
}

.upload-hint {
  font-size: 12px;
  color: #a19f9d;
  margin: 0;
  text-align: center;
}

/* 格式支持说明 */
.upload-formats {
  margin: 8px 0;
  text-align: center;
}

.format-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-bottom: 6px;
}

.format-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #605e5c;
  padding: 2px 6px;
  background: #f3f2f1;
  border-radius: 4px;
}

.format-item :deep(svg) {
  font-size: 14px;
}

.upload-limits {
  font-size: 11px;
  color: #a19f9d;
  margin: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* 表格行 hover 高亮 */
:deep(.n-data-table .n-data-table-tr) {
  transition: background-color 0.15s ease;
}
:deep(.n-data-table .n-data-table-tr:hover) {
  background-color: #f3f2f1 !important;
}

/* 列宽拖拽手柄 */
:deep(.n-data-table-resize-button:hover),
:deep(.n-data-table-resize-button--active) {
  background-color: #0078D4 !important;
}
</style>

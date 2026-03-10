<script setup lang="ts">
/**
 * 知识条目导出对话框（从旧前端迁移的成熟组件）
 *
 * 功能：两步向导（基本设置 → 字段选择与预览）
 * - 支持 Excel / PDF 两种格式
 * - 三种导出范围（选中 / 当前页 / 全部）
 * - 四组字段分类，支持拖拽排序
 * - 实时预览（样本数据 + 文件大小/耗时预估）
 * - 配置持久化到 localStorage
 */
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import {
  NModal, NSteps, NStep, NForm, NFormItem,
  NRadioGroup, NRadio, NSpace, NButton, NInput,
  NCheckbox, NCheckboxGroup, NSelect, NCard,
  NScrollbar, NSpin, NTag, NDataTable, NEmpty,
  NDivider,
  useMessage,
} from 'naive-ui'
import { format } from 'date-fns'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { exportPreview, exportKnowledgeItems } from '@/api/knowledgeItem'
import type { KnowledgeItemListQuery } from '@/api/knowledgeItem'

// ========== Props ==========
const props = defineProps<{
  /** 选中的条目 UUID 集合 */
  selectedItems: Set<string>
  /** 当前页表格数据 */
  tableData: any[]
  /** 分页信息 */
  pagination: { page: number; pageSize: number; itemCount: number }
  /** 当前筛选条件 */
  filterState: Record<string, any>
  /** 搜索关键词 */
  searchKeyword: string
}>()

const visible = defineModel<boolean>('visible', { default: false })

const message = useMessage()

// ========== State ==========

const currentStep = ref(1)
const exportConfig = ref({
  format: 'excel' as 'pdf' | 'excel',
  exportRange: 'selected' as 'selected' | 'currentPage' | 'all',
  selectedFields: ['title', 'summary', 'severity', 'language', 'createTime', 'cvssScore'] as string[],
  expandedFields: {} as Record<string, string[]>,
  fieldFormats: { vulnerabilityTypes: 'name_only', tags: 'name_only' } as Record<string, string>,
  fieldOrder: [] as string[],
  pdfOptions: {
    includeHeaderFooter: true,
    includeTOC: true,
    codeHighlight: true,
    formatType: null as 'report' | 'table' | null,
  },
  excelOptions: {
    includeFilter: true,
    freezeHeader: true,
    conditionalFormatting: true,
  },
  fileName: '',
  columnWidths: {} as Record<string, number>,
  panelWidth: 350,
})
const previewData = ref<any>(null)
const previewLoading = ref(false)
const isDraggingDivider = ref(false)
const layoutContainerRef = ref<HTMLElement | null>(null)
const previewTableRef = ref<HTMLElement | null>(null)

// ========== Field Definitions ==========

const allExportFields = [
  'title', 'summary', 'severity', 'vulnerabilityTypes', 'language', 'status',
  'cvssScore', 'cvssAttackVector', 'cvssAttackComplexity', 'cvssPrivilegesRequired',
  'cvssUserInteraction', 'cvssConfidentialityImpact', 'cvssIntegrityImpact', 'cvssAvailabilityImpact',
  'problemDescription', 'fixSolution', 'exampleCode',
  'tags', 'fragmentCount', 'createTime', 'updateTime',
  'createBy', 'updateBy', 'kid',
]
const defaultSelectedFields = ['title', 'summary', 'severity', 'language', 'createTime', 'cvssScore']
// ========== Computed ==========

const exportTotal = computed(() => props.pagination.itemCount)

const canProceedToNextStep = computed(() => {
  if (exportConfig.value.exportRange === 'selected' && props.selectedItems.size === 0) return false
  if (exportConfig.value.exportRange === 'currentPage' && props.tableData.length === 0) return false
  if (exportConfig.value.exportRange === 'all' && exportTotal.value === 0) return false
  return true
})

const allowFieldDrag = computed(() => {
  if (exportConfig.value.format === 'excel') return true
  if (exportConfig.value.format === 'pdf') {
    const pdfFormatType = previewData.value?.pdfFormatType
    if (pdfFormatType === 'table') return true
    if (pdfFormatType === 'report') return false
    const formatType = exportConfig.value.pdfOptions?.formatType
    if (formatType === 'table') return true
    return false
  }
  return true
})

// Canvas 文本测量
let textMeasureCanvas: HTMLCanvasElement | null = null
function getTextMeasureContext(fontSize = 12): CanvasRenderingContext2D {
  if (!textMeasureCanvas) textMeasureCanvas = document.createElement('canvas')
  const ctx = textMeasureCanvas.getContext('2d')!
  ctx.font = `${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`
  return ctx
}
function calculateTextWidth(text: string, fontSize = 12): number {
  if (!text) return 0
  try {
    return getTextMeasureContext(fontSize).measureText(text).width
  } catch {
    let w = 0
    for (const char of text) w += /[\u4e00-\u9fa5]/.test(char) ? fontSize * 1.2 : fontSize * 0.6
    return w
  }
}
function isValidSavedWidth(width: number, _fieldKey: string, minWidth = 100): boolean {
  if (!width || width < minWidth) return false
  const rounded = Math.round(width)
  if (Math.abs(width - rounded) > 0.1 && width < 150) return false
  return true
}
function calculateDefaultColumnWidth(field: any, sampleData: any[]): number {
  const fieldKey = field.key
  const savedWidth = exportConfig.value.columnWidths[fieldKey]
  if (savedWidth && isValidSavedWidth(savedWidth, fieldKey)) return savedWidth
  const headerTextWidth = calculateTextWidth(field.label, 13)
  let baseWidth = Math.max(headerTextWidth + 60, 100)
  if (sampleData?.length) {
    let maxContentWidth = headerTextWidth
    for (const row of sampleData) {
      const v = row[fieldKey]
      if (v != null) {
        const cw = calculateTextWidth(String(v), 12)
        if (cw > maxContentWidth) maxContentWidth = cw
      }
    }
    if (maxContentWidth > headerTextWidth) baseWidth = Math.max(baseWidth, maxContentWidth + 60)
  }
  const specialMin: Record<string, number> = { title: 180, summary: 300, problemDescription: 400, fixSolution: 400, exampleCode: 400 }
  if (specialMin[fieldKey]) baseWidth = Math.max(baseWidth, specialMin[fieldKey])
  const maxWidths: Record<string, number> = { title: 400, summary: 600, problemDescription: 800, fixSolution: 800, exampleCode: 800, referenceLink: 500 }
  return Math.max(100, Math.min(baseWidth, maxWidths[fieldKey] || 600))
}

const exportPreviewColumns = computed(() => {
  if (!previewData.value?.selectedFields?.length) return []
  const sampleData = previewData.value.sampleData || []
  return previewData.value.selectedFields.map((field: any) => {
    const defaultWidth = calculateDefaultColumnWidth(field, sampleData)
    const maxWidths: Record<string, number> = { title: 400, summary: 600, problemDescription: 800, fixSolution: 800, exampleCode: 800, referenceLink: 500 }
    const maxWidth = maxWidths[field.key] || 600
    const savedWidth = exportConfig.value.columnWidths[field.key]
    let finalWidth = defaultWidth
    if (savedWidth && isValidSavedWidth(savedWidth, field.key)) finalWidth = Math.min(Math.max(savedWidth, 100), maxWidth)
    else finalWidth = Math.min(Math.max(defaultWidth, 100), maxWidth)
    return {
      title: field.label,
      key: field.key,
      width: finalWidth,
      minWidth: 100,
      maxWidth,
      resizable: exportConfig.value.format === 'excel',
      ellipsis: { tooltip: true },
      render: (row: any) => {
        const value = row[field.key]
        if (value == null) return '-'
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value)
      },
    }
  })
})

const previewTableScrollX = computed(() => {
  if (!exportPreviewColumns.value?.length) return 1200
  return Math.max(1200, exportPreviewColumns.value.reduce((sum: number, col: any) => sum + (col.width || 150), 0))
})
// ========== Functions ==========

// --- 配置持久化 ---
function loadConfigFromStorage() {
  const key = `knowledge_item_export_config_${exportConfig.value.format}`
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return
    const config = JSON.parse(stored)
    const deprecated = ['severityLabel', 'languageLabel', 'statusLabel', 'cvssVector', 'vulnerabilityType']
    if (config.selectedFields) exportConfig.value.selectedFields = config.selectedFields.filter((f: string) => !deprecated.includes(f))
    if (config.expandedFields) {
      const cleaned: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(config.expandedFields)) {
        if (!deprecated.includes(k)) cleaned[k] = (v as string[]).filter((x: string) => !deprecated.includes(x))
      }
      exportConfig.value.expandedFields = cleaned
    }
    if (config.fieldFormats) exportConfig.value.fieldFormats = config.fieldFormats
    if (config.fieldOrder) exportConfig.value.fieldOrder = config.fieldOrder
    if (config.pdfOptions) exportConfig.value.pdfOptions = { ...exportConfig.value.pdfOptions, ...config.pdfOptions }
    if (config.excelOptions) exportConfig.value.excelOptions = { ...exportConfig.value.excelOptions, ...config.excelOptions }
    if (config.columnWidths) exportConfig.value.columnWidths = config.columnWidths
    if (config.panelWidth) exportConfig.value.panelWidth = config.panelWidth
  } catch (e) { console.warn('加载导出配置失败', e) }
}

function saveConfigToStorage() {
  const key = `knowledge_item_export_config_${exportConfig.value.format}`
  try {
    localStorage.setItem(key, JSON.stringify({
      selectedFields: exportConfig.value.selectedFields,
      expandedFields: exportConfig.value.expandedFields,
      fieldFormats: exportConfig.value.fieldFormats,
      fieldOrder: exportConfig.value.fieldOrder,
      pdfOptions: exportConfig.value.pdfOptions,
      excelOptions: exportConfig.value.excelOptions,
      columnWidths: exportConfig.value.columnWidths,
      panelWidth: exportConfig.value.panelWidth,
    }))
  } catch (e) { console.warn('保存导出配置失败', e) }
}

// --- 字段操作 ---
function handleSelectAllFields() {
  exportConfig.value.selectedFields = [...allExportFields]
  saveConfigToStorage()
}
function handleResetFieldsToDefault() {
  exportConfig.value.selectedFields = [...defaultSelectedFields]
  exportConfig.value.expandedFields = {}
  exportConfig.value.fieldFormats = { vulnerabilityTypes: 'name_only', tags: 'name_only' }
  saveConfigToStorage()
  if (currentStep.value === 2) loadPreview()
}
function handleResetColumnWidths() {
  exportConfig.value.columnWidths = {}
  saveConfigToStorage()
  if (currentStep.value === 2) loadPreview()
}

// --- 预览 ---
let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function loadPreview(immediate = false) {
  previewLoading.value = true
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer)
  const delay = immediate ? 0 : 500
  previewDebounceTimer = setTimeout(async () => {
    try {
      const req: any = {
        format: exportConfig.value.format,
        exportRange: exportConfig.value.exportRange,
        selectedFields: exportConfig.value.selectedFields,
        expandedFields: exportConfig.value.expandedFields,
        fieldFormats: exportConfig.value.fieldFormats,
        fieldOrder: exportConfig.value.fieldOrder,
        pdfOptions: exportConfig.value.pdfOptions,
        excelOptions: exportConfig.value.excelOptions,
        columnWidths: exportConfig.value.columnWidths,
      }
      if (exportConfig.value.exportRange === 'selected') req.itemUuids = Array.from(props.selectedItems)
      else if (exportConfig.value.exportRange === 'currentPage') {
        req.pageNum = props.pagination.page
        req.pageSize = props.pagination.pageSize
      }
      if (exportConfig.value.exportRange === 'all') {
        req.filters = { ...props.filterState, searchKeyword: props.searchKeyword.trim() || undefined }
      }
      const response: any = await exportPreview(req)
      if (response.code === 200) previewData.value = response.data
      else message.error(response.msg || '预览加载失败')
    } catch (error: any) {
      message.error('预览加载失败: ' + (error.message || '未知错误'))
    } finally {
      previewLoading.value = false
    }
  }, 500)
}

// --- 拖拽排序 ---
const draggedFieldIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function handleDragStart(index: number, event: DragEvent) {
  draggedFieldIndex.value = index
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/html', String(index)) }
  if (event.target) (event.target as HTMLElement).style.opacity = '0.5'
}
function handleDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}
function handleDragLeave() { dragOverIndex.value = null }
function handleDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (draggedFieldIndex.value === null || !previewData.value?.selectedFields) return
  const fields = [...previewData.value.selectedFields]
  const dragged = fields[draggedFieldIndex.value]
  fields.splice(draggedFieldIndex.value, 1)
  fields.splice(index, 0, dragged)
  previewData.value.selectedFields = fields
  handleFieldOrderChange()
  draggedFieldIndex.value = null
  dragOverIndex.value = null
  if (event.target) (event.target as HTMLElement).style.opacity = '1'
}
function handleDragEnd(event: DragEvent) {
  if (event.target) (event.target as HTMLElement).style.opacity = '1'
  draggedFieldIndex.value = null
  dragOverIndex.value = null
}
function handleFieldOrderChange() {
  if (!previewData.value?.selectedFields) return
  const newOrder = previewData.value.selectedFields.map((f: any) => f.key)
  const current = [...exportConfig.value.selectedFields]
  const ordered: string[] = []
  for (const key of newOrder) { if (current.includes(key)) ordered.push(key) }
  for (const f of current) { if (!ordered.includes(f)) ordered.push(f) }
  exportConfig.value.selectedFields = ordered
  exportConfig.value.fieldOrder = [...ordered]
  saveConfigToStorage()
  loadPreview()
}

// --- 分隔条拖拽 ---
function handleDividerMouseDown(e: MouseEvent) {
  e.preventDefault()
  isDraggingDivider.value = true
  const startX = e.clientX
  const startWidth = exportConfig.value.panelWidth
  const onMove = (ev: MouseEvent) => { exportConfig.value.panelWidth = Math.max(250, Math.min(600, startWidth + ev.clientX - startX)) }
  const onUp = () => { isDraggingDivider.value = false; saveConfigToStorage(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// --- 导出执行 ---
async function handleExport() {
  if (exportConfig.value.selectedFields.length === 0) { message.error('请至少选择一个字段'); return }
  try {
    if (exportConfig.value.format === 'pdf') await handlePdfExport()
    else await handleExcelExport()
    saveConfigToStorage()
    visible.value = false
    currentStep.value = 1
    message.success('导出成功')
  } catch (error: any) {
    message.error('导出失败: ' + (error.message || '未知错误'))
  }
}

function buildExportRequest() {
  const req: any = {
    format: exportConfig.value.format,
    exportRange: exportConfig.value.exportRange,
    selectedFields: exportConfig.value.selectedFields,
    expandedFields: exportConfig.value.expandedFields,
    fieldFormats: exportConfig.value.fieldFormats,
    fieldOrder: exportConfig.value.fieldOrder,
    fileName: exportConfig.value.fileName || undefined,
  }
  if (exportConfig.value.format === 'excel') req.excelOptions = exportConfig.value.excelOptions
  if (exportConfig.value.format === 'excel') req.columnWidths = exportConfig.value.columnWidths
  if (exportConfig.value.format === 'pdf') req.pdfOptions = exportConfig.value.pdfOptions
  if (exportConfig.value.exportRange === 'selected') req.itemUuids = Array.from(props.selectedItems)
  else if (exportConfig.value.exportRange === 'currentPage') { req.pageNum = props.pagination.page; req.pageSize = props.pagination.pageSize }
  if (exportConfig.value.exportRange === 'all') req.filters = { ...props.filterState, searchKeyword: props.searchKeyword.trim() || undefined }
  return req
}

async function handleExcelExport() {
  const req = buildExportRequest()
  const loadingMsg = message.loading('正在导出...', { duration: 0 })
  try {
    const response: any = await exportKnowledgeItems(req)
    loadingMsg.destroy()
    if (!response || (response.status && response.status >= 400)) {
      let errorMsg = 'Excel导出失败'
      if (response instanceof Blob) { try { errorMsg = JSON.parse(await response.text()).msg || errorMsg } catch {} }
      throw new Error(errorMsg)
    }
    const blob = response instanceof Blob ? response : new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    if (!blob || blob.size === 0) throw new Error('Excel导出失败：服务器返回空数据')
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportConfig.value.fileName || `知识条目导出_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error: any) {
    loadingMsg.destroy()
    throw error
  }
}

async function handlePdfExport() {
  const req = buildExportRequest()
  const loadingMsg = message.loading('正在生成PDF...', { duration: 0 })
  try {
    const response: any = await exportKnowledgeItems(req)
    loadingMsg.destroy()
    if (!response || (response.status && response.status >= 400)) {
      let errorMsg = 'PDF生成失败'
      if (response instanceof Blob) { try { errorMsg = JSON.parse(await response.text()).msg || errorMsg } catch {} }
      throw new Error(errorMsg)
    }
    const blob = response instanceof Blob ? response : new Blob([response], { type: 'application/pdf' })
    if (!blob || blob.size === 0) throw new Error('PDF生成失败：服务器返回空数据')
    const warningsHeader = (response as any).headers?.['x-export-warnings']
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportConfig.value.fileName || `知识条目导出_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    if (warningsHeader) {
      const warnings = decodeURIComponent(warningsHeader).split(';')
      if (warnings.length) message.warning(`PDF导出完成，但有以下提示：\n${warnings.join('\n')}`, { duration: 8000 })
    }
  } catch (error: any) {
    loadingMsg.destroy()
    throw error
  }
}

// --- 公开方法 ---
function open(onlySelected = false) {
  if (onlySelected) {
    exportConfig.value.exportRange = 'selected'
  } else if (props.selectedItems.size > 0) {
    exportConfig.value.exportRange = 'selected'
  } else {
    // 无选中条目时，默认导出全部数据
    exportConfig.value.exportRange = 'all'
  }
  exportConfig.value.selectedFields = [...defaultSelectedFields]
  exportConfig.value.expandedFields = {}
  exportConfig.value.fieldFormats = { vulnerabilityTypes: 'name_only', tags: 'name_only' }
  currentStep.value = 1
  loadConfigFromStorage()
  visible.value = true
}

defineExpose({ open })

// --- Watchers ---
watch(currentStep, (newStep) => {
  if (newStep === 2) nextTick(() => loadPreview())
})

watch(() => exportConfig.value.selectedFields, () => {
  saveConfigToStorage()
  if (currentStep.value === 2) loadPreview()
}, { deep: true })

watch(() => exportConfig.value.fieldFormats, () => {
  saveConfigToStorage()
  if (currentStep.value === 2) loadPreview(true)
}, { deep: true })

watch(() => exportConfig.value.format, () => {
  loadConfigFromStorage()
  if (currentStep.value === 2) loadPreview()
})

onBeforeUnmount(() => {
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer)
})
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    title="导出配置"
    style="width: 90%; max-width: 1200px"
    :mask-closable="true"
  >
    <!-- Dialog Content -->
    <div class="export-dialog-content">
      <div class="export-steps-wrapper">
        <NSteps v-model:current="currentStep" status="process">
          <NStep title="基本设置" />
          <NStep title="字段选择与预览" />
        </NSteps>
      </div>

      <!-- Step 1: 基本设置 -->
      <div v-if="currentStep === 1" class="export-step-content">
        <NForm label-placement="left" label-width="120px">
          <NFormItem label="导出格式">
            <NRadioGroup v-model:value="exportConfig.format">
              <NRadio value="excel">Excel (.xlsx)</NRadio>
              <NRadio value="pdf">PDF (.pdf)</NRadio>
            </NRadioGroup>
          </NFormItem>
          <NFormItem label="导出范围">
            <NSpace :size="4">
              <NRadioGroup v-model:value="exportConfig.exportRange">
                <NSpace :size="8">
                  <NRadio v-if="selectedItems.size > 0" value="selected">
                    已选条目 ({{ selectedItems.size }})
                  </NRadio>
                  <NRadio value="currentPage">当前页 ({{ tableData.length }})</NRadio>
                  <NRadio value="all">全部数据 ({{ exportTotal }})</NRadio>
                </NSpace>
              </NRadioGroup>
              <div v-if="selectedItems.size === 0" style="display:flex;align-items:center;font-size:12px;color:#999;margin-top:4px;padding-left:24px">
                <SvgIcon icon="ri:information-line" style="font-size:14px;margin-right:4px" />
                <span>勾选条目列表左侧复选框可批量导出指定条目</span>
              </div>
            </NSpace>
          </NFormItem>
          <NFormItem label="文件名">
            <NInput v-model:value="exportConfig.fileName" placeholder="留空则自动生成" />
          </NFormItem>
          <NFormItem v-if="exportConfig.format === 'pdf'" label="PDF选项">
            <NSpace>
              <NCheckbox v-model:checked="exportConfig.pdfOptions.includeHeaderFooter">包含页眉页脚</NCheckbox>
              <NCheckbox v-model:checked="exportConfig.pdfOptions.includeTOC">包含目录</NCheckbox>
              <NCheckbox v-model:checked="exportConfig.pdfOptions.codeHighlight">代码高亮</NCheckbox>
            </NSpace>
          </NFormItem>
          <NFormItem v-if="exportConfig.format === 'excel'" label="Excel选项">
            <NSpace>
              <NCheckbox v-model:checked="exportConfig.excelOptions.includeFilter">包含筛选器</NCheckbox>
              <NCheckbox v-model:checked="exportConfig.excelOptions.freezeHeader">冻结表头</NCheckbox>
              <NCheckbox v-model:checked="exportConfig.excelOptions.conditionalFormatting">条件格式</NCheckbox>
            </NSpace>
          </NFormItem>
        </NForm>
      </div>

      <!-- Step 2: 字段选择与预览 -->
      <div v-if="currentStep === 2" class="export-step-content">
        <NSpin :show="previewLoading || !previewData">
          <div class="field-selection-preview-layout" ref="layoutContainerRef">
            <!-- 左侧：字段选择 -->
            <div class="field-selection-panel" :style="{ width: exportConfig.panelWidth + 'px' }">
              <NCard size="small" class="field-selection-card">
                <template #header>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>导出字段</span>
                    <NSpace :size="8">
                      <NButton size="small" quaternary @click="handleSelectAllFields">全选</NButton>
                      <NButton size="small" quaternary @click="handleResetFieldsToDefault">恢复默认</NButton>
                    </NSpace>
                  </div>
                </template>
                <NScrollbar>
                  <NCheckboxGroup v-model:value="exportConfig.selectedFields">
                    <NSpace vertical :size="12">
                      <div style="font-weight:600;color:#323130;margin-bottom:8px">条目信息</div>
                      <NCheckbox value="title">标题</NCheckbox>
                      <NCheckbox value="summary">摘要</NCheckbox>
                      <NCheckbox value="severity">风险等级</NCheckbox>
                      <div style="display:flex;align-items:center;gap:8px">
                        <NCheckbox value="vulnerabilityTypes">漏洞类型</NCheckbox>
                        <NSelect v-if="exportConfig.selectedFields.includes('vulnerabilityTypes')" v-model:value="exportConfig.fieldFormats.vulnerabilityTypes" :options="[{label:'仅名称',value:'name_only'},{label:'ID+名称',value:'id_name'},{label:'完整信息',value:'full'}]" size="small" style="width:120px" placeholder="选择格式" />
                      </div>
                      <NCheckbox value="language">编程语言</NCheckbox>
                      <NCheckbox value="status">状态</NCheckbox>
                      <div style="display:flex;align-items:center;gap:8px">
                        <NCheckbox value="tags">标签</NCheckbox>
                        <NSelect v-if="exportConfig.selectedFields.includes('tags')" v-model:value="exportConfig.fieldFormats.tags" :options="[{label:'仅名称',value:'name_only'},{label:'完整信息',value:'full'}]" size="small" style="width:120px" placeholder="选择格式" />
                      </div>
                      <div style="font-weight:600;color:#323130;margin-top:16px;margin-bottom:8px">CVSS评分</div>
                      <NCheckbox value="cvssScore">CVSS评分</NCheckbox>
                      <NCheckbox value="cvssAttackVector">攻击方式</NCheckbox>
                      <NCheckbox value="cvssAttackComplexity">利用复杂度</NCheckbox>
                      <NCheckbox value="cvssPrivilegesRequired">权限需求</NCheckbox>
                      <NCheckbox value="cvssUserInteraction">用户交互</NCheckbox>
                      <NCheckbox value="cvssConfidentialityImpact">机密性影响</NCheckbox>
                      <NCheckbox value="cvssIntegrityImpact">完整性影响</NCheckbox>
                      <NCheckbox value="cvssAvailabilityImpact">可用性影响</NCheckbox>
                      <div style="font-weight:600;color:#323130;margin-top:16px;margin-bottom:8px">详细内容</div>
                      <NCheckbox value="problemDescription">问题描述</NCheckbox>
                      <NCheckbox value="fixSolution">修复方案</NCheckbox>
                      <NCheckbox value="exampleCode">示例代码</NCheckbox>
                      <div style="font-weight:600;color:#323130;margin-top:16px;margin-bottom:8px">时间与记录</div>
                      <NCheckbox value="createTime">创建时间</NCheckbox>
                      <NCheckbox value="updateTime">更新时间</NCheckbox>
                      <NCheckbox value="createBy">创建人</NCheckbox>
                      <NCheckbox value="updateBy">更新人</NCheckbox>
                      <NCheckbox value="kid">知识库</NCheckbox>
                      <NCheckbox value="fragmentCount">片段数量</NCheckbox>
                    </NSpace>
                  </NCheckboxGroup>
                </NScrollbar>
              </NCard>
            </div>

            <!-- 分隔条 -->
            <div class="layout-divider" :class="{ dragging: isDraggingDivider }" @mousedown="handleDividerMouseDown" />

            <!-- 右侧：实时预览 -->
            <div class="preview-panel">
              <NScrollbar style="flex:1;overflow-y:auto">
                <NSpace vertical :size="16">
                  <!-- 导出信息摘要 -->
                  <NCard title="导出信息摘要" size="small">
                    <NSpin :show="previewLoading" :description="false">
                      <NSpace vertical :size="8">
                        <div class="export-summary-row"><span class="summary-label">导出格式：</span><NTag size="small" :type="exportConfig.format === 'excel' ? 'success' : 'info'">{{ exportConfig.format === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)' }}</NTag></div>
                        <div class="export-summary-row"><span class="summary-label">导出范围：</span><span class="summary-value">{{ exportConfig.exportRange === 'selected' ? `已选条目（${selectedItems.size}条）` : exportConfig.exportRange === 'currentPage' ? `当前页（${tableData.length}条）` : `全部数据（${previewData?.totalCount || exportTotal}条）` }}</span></div>
                        <div class="export-summary-row"><span class="summary-label">预计导出：</span><span class="summary-value">{{ previewData?.totalCount || 0 }} 条记录</span></div>
                        <div class="export-summary-row"><span class="summary-label">导出字段：</span><span class="summary-value">{{ previewData?.selectedFields?.length || exportConfig.selectedFields.length }} 个字段</span></div>
                        <div class="export-summary-row"><span class="summary-label">预计文件大小：</span><span class="summary-value">{{ previewData?.estimatedFileSize ? (previewData.estimatedFileSize / 1024).toFixed(2) : '0' }} KB</span></div>
                        <div class="export-summary-row"><span class="summary-label">预计耗时：</span><span class="summary-value">{{ previewData?.estimatedTime || 0 }} 秒</span></div>
                      </NSpace>
                    </NSpin>
                  </NCard>

                  <!-- 字段列表预览 -->
                  <NCard v-if="previewData?.selectedFields?.length" title="字段列表" size="small">
                    <NSpin :show="previewLoading" :description="false">
                      <NSpace vertical :size="4">
                        <div class="field-list-info">
                          <span>已选择 {{ previewData.selectedFields.length }} 个字段<span v-if="allowFieldDrag">（按导出顺序）</span>：</span>
                          <span v-if="allowFieldDrag" style="color:#999;font-size:12px;margin-left:8px">拖拽标签可调整顺序</span>
                        </div>
                        <div class="field-list-tags">
                          <NTag
                            v-for="(field, index) in previewData.selectedFields"
                            :key="field.key"
                            size="small"
                            :type="field.type === 'expanded' ? 'info' : field.type === 'dictConverted' ? 'warning' : 'default'"
                            :draggable="allowFieldDrag"
                            :class="allowFieldDrag ? ['drag-handle', { 'drag-over': dragOverIndex === index, 'dragging': draggedFieldIndex === index }] : ''"
                            :style="allowFieldDrag ? 'margin-right:8px;margin-bottom:8px;cursor:move;user-select:none' : 'margin-right:8px;margin-bottom:8px'"
                            @dragstart="allowFieldDrag && handleDragStart(index, $event)"
                            @dragover="allowFieldDrag && handleDragOver(index, $event)"
                            @dragleave="allowFieldDrag && handleDragLeave()"
                            @drop="allowFieldDrag && handleDrop(index, $event)"
                            @dragend="allowFieldDrag && handleDragEnd($event)"
                          >
                            <span v-if="allowFieldDrag" style="margin-right:4px">⋮⋮</span>
                            {{ index + 1 }}. {{ field.label }}
                            <span v-if="field.type === 'expanded'" style="color:#999;font-size:11px">（展开字段）</span>
                            <span v-else-if="field.type === 'dictConverted'" style="color:#999;font-size:11px">（字典转换）</span>
                          </NTag>
                        </div>
                      </NSpace>
                    </NSpin>
                  </NCard>

                  <!-- 样本数据预览 -->
                  <NCard title="样本数据预览" size="small">
                    <template #header-extra>
                      <NButton size="small" quaternary :loading="previewLoading" @click="loadPreview">
                        <template #icon><SvgIcon icon="ri:refresh-line" /></template>
                        刷新预览
                      </NButton>
                    </template>
                    <NSpin :show="previewLoading" :description="false" style="min-height:200px">
                      <div v-if="previewData">
                        <NEmpty v-if="!previewData.sampleData?.length" description="暂无预览数据" />
                        <div v-else>
                          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                            <span>预览前 {{ previewData.sampleData.length }} 条真实数据，共 {{ previewData.totalCount }} 条</span>
                            <NButton v-if="exportConfig.format === 'excel'" size="small" quaternary @click="handleResetColumnWidths">恢复默认列宽</NButton>
                          </div>
                          <div ref="previewTableRef" class="preview-table-container" :class="{ 'excel-preview': exportConfig.format === 'excel' }">
                            <NScrollbar x-scrollable style="width:100%">
                              <NDataTable :columns="exportPreviewColumns" :data="previewData.sampleData" :scroll-x="previewTableScrollX" bordered size="small" :row-class-name="(_row: any, index: number) => index % 2 === 0 ? 'even-row' : 'odd-row'" />
                            </NScrollbar>
                          </div>
                        </div>
                      </div>
                      <NEmpty v-else description="请先选择至少一个字段" />
                    </NSpin>
                  </NCard>

                  <!-- Excel 格式样式说明 -->
                  <NCard v-if="exportConfig.format === 'excel'" title="Excel格式样式说明" size="small">
                    <NSpace vertical :size="8">
                      <div class="export-summary-row"><NTag size="small" type="info">表头</NTag><span class="summary-value">深色背景，白色文字，自动冻结</span></div>
                      <div class="export-summary-row"><NTag size="small" type="info">数据行</NTag><span class="summary-value">交替行颜色，便于阅读</span></div>
                      <div v-if="exportConfig.excelOptions?.includeFilter" class="export-summary-row"><NTag size="small" type="success">筛选器</NTag><span class="summary-value">表头包含自动筛选功能</span></div>
                      <div v-if="exportConfig.excelOptions?.conditionalFormatting" class="export-summary-row"><NTag size="small" type="warning">条件格式</NTag><span class="summary-value">风险等级字段将根据等级显示不同颜色</span></div>
                    </NSpace>
                  </NCard>

                  <!-- PDF 格式预览 -->
                  <NCard v-if="exportConfig.format === 'pdf'" title="PDF格式预览" size="small">
                    <template #header-extra>
                      <NSpace align="center" :size="8">
                        <NButton size="small" quaternary :loading="previewLoading" @click="loadPreview">
                          <template #icon><SvgIcon icon="ri:refresh-line" /></template>
                          刷新预览
                        </NButton>
                        <NTag v-if="previewData?.pdfFormatType === 'report'" type="info" size="small">报告格式</NTag>
                        <NTag v-else-if="previewData?.pdfFormatType === 'table'" type="success" size="small">表格格式</NTag>
                      </NSpace>
                    </template>
                    <NSpin :show="previewLoading" :description="false" style="min-height:300px">
                      <div v-if="previewData?.previewHtml">
                        <NSpace vertical :size="12">
                          <div style="padding:12px;background:#f5f7fa;border-radius:4px;border:1px solid #e5e7eb">
                            <div style="font-weight:500;font-size:13px;color:#333;margin-bottom:10px">导出格式选择：</div>
                            <NRadioGroup v-model:value="exportConfig.pdfOptions.formatType" size="small" @update:value="loadPreview">
                              <NSpace :size="20">
                                <NRadio :value="null">自动选择</NRadio>
                                <NRadio value="report">报告格式</NRadio>
                                <NRadio value="table">表格格式</NRadio>
                              </NSpace>
                            </NRadioGroup>
                          </div>
                          <div :class="['pdf-preview-container', previewData.pdfFormatType === 'report' ? 'pdf-preview-report' : 'pdf-preview-table']" v-html="previewData.previewHtml" />
                        </NSpace>
                      </div>
                      <NEmpty v-else description="请先选择至少一个字段" />
                    </NSpin>
                  </NCard>
                </NSpace>
              </NScrollbar>
            </div>
          </div>
        </NSpin>
      </div>

      <!-- 底部操作栏 -->
      <div class="export-dialog-actions">
        <NSpace justify="space-between">
          <NButton v-if="currentStep > 1" @click="currentStep--">上一步</NButton>
          <div v-else />
          <NSpace>
            <NButton @click="visible = false">取消</NButton>
            <NButton v-if="currentStep < 2" type="primary" :disabled="!canProceedToNextStep" @click="currentStep++">下一步</NButton>
            <NButton v-else type="primary" :disabled="exportConfig.selectedFields.length === 0" @click="handleExport">开始导出</NButton>
          </NSpace>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.export-dialog-content { padding: 20px 0; }
.export-steps-wrapper { display: flex; justify-content: center; align-items: center; width: 100%; }
.export-steps-wrapper :deep(.n-steps) { width: auto; max-width: 100%; }
.export-steps-wrapper :deep(.n-steps .n-step) { flex: 0 0 auto; }
.export-step-content { margin-top: 24px; min-height: 300px; }
.export-step-content :deep(.n-spin-container) { height: 100%; }

.field-selection-preview-layout { display: flex; gap: 16px; height: 600px; }
.field-selection-panel { flex: 0 0 auto; display: flex; flex-direction: column; overflow: hidden; min-width: 250px; }
.field-selection-card { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.field-selection-card :deep(.n-card__content) { flex: 1 1 0; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.field-selection-card :deep(.n-scrollbar) { flex: 1 1 0; min-height: 0; }

.layout-divider { width: 4px; background-color: #e5e5e5; cursor: col-resize; user-select: none; transition: background-color 0.2s; position: relative; }
.layout-divider:hover, .layout-divider.dragging { background-color: #1890ff; }
.layout-divider::before { content: ''; position: absolute; left: -2px; right: -2px; top: 0; bottom: 0; }

.preview-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.preview-panel :deep(.n-scrollbar) { flex: 1; overflow-y: auto; }
.preview-panel :deep(.n-card) { margin-bottom: 0; }
.preview-panel :deep(.n-spin-container) { position: relative; }
.preview-panel :deep(.n-spin-content) { opacity: 1; transition: opacity 0.2s ease; }
.preview-panel :deep(.n-spin--show .n-spin-content) { opacity: 0.6; }

.export-summary-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.summary-label { color: #666; font-weight: 500; min-width: 100px; }
.summary-value { color: #333; }

.field-list-info { font-size: 13px; color: #666; margin-bottom: 8px; }
.field-list-tags { display: flex; flex-wrap: wrap; align-items: flex-start; min-height: 40px; padding: 4px 0; }
.field-list-tags .drag-handle { cursor: move; transition: opacity 0.2s, transform 0.2s; }
.field-list-tags .drag-handle:hover { opacity: 0.8; }
.field-list-tags .drag-handle.dragging { opacity: 0.5; }
.field-list-tags .drag-handle.drag-over { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }

.preview-table-container { border-radius: 4px; overflow: hidden; }

.pdf-preview-container { border: 1px solid #e1e8ed; border-radius: 6px; padding: 20px; background-color: #fafafa; box-shadow: inset 0 2px 4px rgba(0,0,0,0.04); }
.pdf-preview-table { background-color: #fff; padding: 0; }
.pdf-preview-table :deep(table) { width: 100%; border-collapse: collapse; font-size: 12px; margin: 0; }
.pdf-preview-table :deep(table th), .pdf-preview-table :deep(table td) { border: 1px solid #dee2e6; padding: 11px 10px; text-align: left; }
.pdf-preview-table :deep(table th) { background: linear-gradient(to bottom, #f8f9fa, #e9ecef); font-weight: 600; text-align: center; position: sticky; top: 0; }
.pdf-preview-table :deep(table tbody tr:nth-child(even)) { background-color: #f8f9fa; }
.pdf-preview-table :deep(table tbody tr:hover) { background-color: #e7f3ff; }
.pdf-preview-report { background-color: #fafafa; padding: 8px; }
.pdf-preview-report :deep(h3) { color: #1890ff; font-size: 17px; font-weight: 600; margin: 0; line-height: 1.4; }

.export-dialog-actions { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
</style>

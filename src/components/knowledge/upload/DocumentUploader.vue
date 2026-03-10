<script setup lang="ts">
/**
 * 文档上传组件（v2）
 */
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { useUploadStore } from '@/store/modules/upload'
import { uploadService } from '@/services/uploadService'

const props = defineProps<{
  kid: string
  knowledgeBaseName?: string
  disabled?: boolean
}>()

const message = useMessage()
const store = useUploadStore()

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_BATCH_SIZE = 10

const ALLOWED_FILE_EXTENSIONS = [
  'txt', 'csv', 'properties', 'ini', 'yaml', 'yml', 'log', 'xml',
  'doc', 'docx', 'pdf', 'xls', 'xlsx', 'md',
  'java', 'html', 'htm', 'js', 'py', 'cpp', 'sql', 'php', 'ruby',
  'c', 'h', 'hpp', 'swift', 'ts', 'rs', 'perl', 'shell', 'bat', 'cmd', 'css',
]

const ACCEPT_FILE_TYPES = ALLOWED_FILE_EXTENSIONS.map(ext => `.${ext}`).join(',')

const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const validationModalVisible = ref(false)
const validFiles = ref<File[]>([])
const invalidFiles = ref<Array<{ file: File; reason: string }>>([])

const canUpload = computed(() => !props.disabled && store.hasAvailableSlot)

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

function validateFileExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return false
  return ALLOWED_FILE_EXTENSIONS.includes(ext)
}

function validateFileSize(fileSize: number): { valid: boolean; error?: string } {
  if (fileSize <= 0) return { valid: false, error: '文件不能为空' }
  if (fileSize > MAX_FILE_SIZE) return { valid: false, error: '文件过大' }
  return { valid: true }
}

function getFileIssue(file: File): string | null {
  const reasons: string[] = []
  if (!validateFileExtension(file.name)) reasons.push('格式不支持')
  const sizeValidation = validateFileSize(file.size)
  if (!sizeValidation.valid) reasons.push(sizeValidation.error || '文件过大')
  return reasons.length > 0 ? reasons.join('、') : null
}

function validateSelectedFiles(files: File[]) {
  const valid: File[] = []
  const invalid: Array<{ file: File; reason: string }> = []

  if (files.length > MAX_BATCH_SIZE) {
    message.error(`单次最多选择 ${MAX_BATCH_SIZE} 个文件`, { duration: 5000 })
    return { valid: [], invalid: files.slice(MAX_BATCH_SIZE).map(f => ({ file: f, reason: '超出数量限制' })) }
  }

  const seenNames = new Set<string>()
  for (const file of files) {
    if (seenNames.has(file.name)) {
      invalid.push({ file, reason: '与已选文件重复' })
      continue
    }
    const issue = getFileIssue(file)
    if (issue) invalid.push({ file, reason: issue })
    else valid.push(file)
    seenNames.add(file.name)
  }
  return { valid, invalid }
}

async function handleFileSelect(files: FileList | null) {
  if (!files || files.length === 0) return
  const fileArray = Array.from(files)
  const { valid, invalid } = validateSelectedFiles(fileArray)

  if (valid.length === 0 && invalid.length > 0) {
    message.error(`选择的 ${invalid.length} 个文件均不符合要求`, { duration: 5000 })
    return
  }
  if (invalid.length > 0) {
    validFiles.value = valid
    invalidFiles.value = invalid
    validationModalVisible.value = true
    return
  }
  await uploadFiles(valid)
}

async function uploadFiles(files: File[]) {
  if (files.length === 0) return
  if (!store.hasAvailableSlot) {
    message.warning(`当前已有 ${store.currentConcurrent} 个文件正在上传`, { duration: 5000 })
    return
  }
  const tasks = uploadService.addTasks(files, props.kid, props.knowledgeBaseName)
  message.success(`已添加 ${tasks.length} 个文件到上传队列`, { duration: 3000 })
}

function useValidFiles() {
  validationModalVisible.value = false
  uploadFiles(validFiles.value)
  validFiles.value = []
  invalidFiles.value = []
}

function reselectFiles() {
  validationModalVisible.value = false
  validFiles.value = []
  invalidFiles.value = []
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  if (!canUpload.value) return
  isDragOver.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  if (!canUpload.value) return
  const files = e.dataTransfer?.files
  if (files && files.length > 0) await handleFileSelect(files)
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  handleFileSelect(target.files)
  target.value = ''
}
</script>

<template>
  <div class="document-uploader" :class="{ 'is-drag-over': isDragOver, 'is-disabled': disabled || !store.hasAvailableSlot }" @dragenter="handleDragEnter" @dragleave="handleDragLeave" @dragover="handleDragOver" @drop="handleDrop">
    <input ref="fileInputRef" type="file" :accept="ACCEPT_FILE_TYPES" :disabled="disabled" multiple class="file-input" @change="handleInputChange">
    <div class="upload-zone" @click="triggerFileSelect">
      <div class="upload-content">
        <SvgIcon icon="mdi:cloud-upload-outline" class="upload-icon" :class="{ 'is-dragging': isDragOver }" />
        <p class="upload-title">{{ isDragOver ? '释放以上传文件' : '拖拽文件到此处上传' }}</p>
        <div class="upload-formats">
          <div class="format-list">
            <span class="format-item"><SvgIcon icon="mdi:file-pdf-box" class="format-icon pdf" /><span>PDF</span></span>
            <span class="format-item"><SvgIcon icon="mdi:file-word-box" class="format-icon word" /><span>Word</span></span>
            <span class="format-item"><SvgIcon icon="mdi:file-excel-box" class="format-icon excel" /><span>Excel</span></span>
            <span class="format-item"><SvgIcon icon="mdi:file-document-outline" class="format-icon text" /><span>文本</span></span>
            <span class="format-item"><SvgIcon icon="mdi:language-markdown" class="format-icon markdown" /><span>Markdown</span></span>
            <span class="format-item"><SvgIcon icon="mdi:code-braces" class="format-icon code" /><span>代码文件</span></span>
          </div>
          <p class="upload-limits">单文件最大 50MB · 单次最多 {{ MAX_BATCH_SIZE }} 个文件</p>
        </div>
        <button type="button" class="select-button" :disabled="disabled || !store.hasAvailableSlot" @click.stop="triggerFileSelect"><SvgIcon icon="mdi:plus" /><span>选择文件</span></button>
      </div>
    </div>

    <div v-if="validationModalVisible" class="validation-modal-overlay" @click="validationModalVisible = false">
      <div class="validation-modal" @click.stop>
        <div class="modal-header">
          <h3>文件验证结果</h3>
          <button class="close-btn" @click="validationModalVisible = false"><SvgIcon icon="mdi:close" /></button>
        </div>
        <div class="modal-body">
          <div v-if="validFiles.length > 0" class="file-section valid-section">
            <h4>有效文件 ({{ validFiles.length }}个)</h4>
            <ul class="file-list">
              <li v-for="file in validFiles" :key="file.name" class="file-item"><span class="file-name">{{ file.name }}</span><span class="file-size">{{ formatFileSize(file.size) }}</span></li>
            </ul>
          </div>
          <div v-if="invalidFiles.length > 0" class="file-section invalid-section">
            <h4>无效文件 ({{ invalidFiles.length }}个)</h4>
            <ul class="file-list">
              <li v-for="item in invalidFiles" :key="item.file.name" class="file-item"><span class="file-name">{{ item.file.name }}</span><span class="file-reason">{{ item.reason }}</span></li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button v-if="validFiles.length > 0" type="button" class="primary-btn" @click="useValidFiles">只使用有效文件 ({{ validFiles.length }}个)</button>
          <button type="button" class="secondary-btn" @click="reselectFiles">重新选择</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-uploader { position: relative; width: 100%; }
.file-input { display: none; }
.upload-zone { border: 2px dashed #d9d9d9; border-radius: 8px; padding: 24px; background: #fafafa; cursor: pointer; transition: all 0.2s ease; }
.upload-zone:hover { border-color: #1890ff; background: #f0f5ff; }
.document-uploader.is-drag-over .upload-zone { border-color: #1890ff; border-style: solid; background: #e6f7ff; transform: scale(1.02); }
.document-uploader.is-disabled .upload-zone { opacity: 0.6; cursor: not-allowed; }
.upload-content { display: flex; flex-direction: column; align-items: center; text-align: center; }
.upload-icon { font-size: 48px; color: #8c8c8c; margin-bottom: 12px; transition: all 0.3s ease; }
.upload-icon.is-dragging { color: #1890ff; transform: scale(1.1); }
.upload-title { font-size: 16px; font-weight: 500; color: #262626; margin: 0 0 16px 0; }
.upload-formats { margin-bottom: 16px; }
.format-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 8px; }
.format-item { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #595959; }
.format-icon { font-size: 14px; }
.format-icon.pdf { color: #ff4d4f; }
.format-icon.word { color: #1890ff; }
.format-icon.excel { color: #52c41a; }
.format-icon.text { color: #8c8c8c; }
.format-icon.markdown { color: #722ed1; }
.format-icon.code { color: #fa8c16; }
.upload-limits { font-size: 12px; color: #8c8c8c; margin: 0; }
.select-button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #1890ff; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; transition: all 0.2s ease; }
.select-button:hover:not(:disabled) { background: #40a9ff; }
.select-button:disabled { opacity: 0.6; cursor: not-allowed; }
.validation-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.validation-modal { background: white; border-radius: 8px; width: 90%; max-width: 560px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.modal-header h3 { margin: 0; font-size: 16px; font-weight: 500; }
.close-btn { background: none; border: none; padding: 4px; cursor: pointer; color: #8c8c8c; }
.close-btn:hover { color: #262626; }
.modal-body { padding: 16px 20px; overflow-y: auto; max-height: 50vh; }
.file-section { margin-bottom: 16px; }
.file-section:last-child { margin-bottom: 0; }
.file-section h4 { margin: 0 0 12px 0; font-size: 14px; font-weight: 500; }
.file-list { list-style: none; margin: 0; padding: 0; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f5f5f5; border-radius: 4px; margin-bottom: 8px; font-size: 13px; }
.file-item:last-child { margin-bottom: 0; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #262626; }
.file-size { color: #8c8c8c; font-size: 12px; }
.file-reason { color: #ff4d4f; font-size: 12px; }
.modal-footer { display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid #f0f0f0; }
.primary-btn { padding: 8px 16px; background: #1890ff; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; }
.primary-btn:hover { background: #40a9ff; }
.secondary-btn { padding: 8px 16px; background: white; color: #595959; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; cursor: pointer; }
.secondary-btn:hover { border-color: #1890ff; color: #1890ff; }
@media (max-width: 768px) {
  .upload-zone { padding: 16px; }
  .upload-icon { font-size: 36px; }
  .upload-title { font-size: 14px; }
  .format-list { gap: 6px; }
  .format-item { padding: 3px 6px; font-size: 11px; }
  .validation-modal { width: 95%; }
}
</style>

<template>
	<n-drawer
		v-model:show="show"
		:width="isMobile ? '100%' : 480"
		placement="right"
		:trap-focus="false"
		:mask-closable="true"
	>
		<template #header>
			<div class="detail-header">
				<n-space justify="space-between" align="center">
					<span class="detail-title">任务详情</span>
					<n-button quaternary size="small" @click="show = false">
						<template #icon>
							<SvgIcon icon="ri:close-line" />
						</template>
					</n-button>
				</n-space>
			</div>
		</template>

		<div v-if="task" class="task-detail-content">
			<div class="detail-section">
				<h3 class="section-title">文件信息</h3>
				<n-descriptions :column="1" bordered>
					<n-descriptions-item label="文件名">
						<div class="file-name-row">
							<SvgIcon :icon="getFileTypeIcon(task.fileName)" :style="{ color: getFileTypeColor(task.fileName), fontSize: '20px' }" />
							<span>{{ task.fileName }}</span>
						</div>
					</n-descriptions-item>
					<n-descriptions-item label="文件大小">{{ formatFileSize(task.fileSize) }}</n-descriptions-item>
					<n-descriptions-item label="状态">
						<n-tag :type="getStatusType(task.status)" size="small">
							{{ getStatusLabel() }}
						</n-tag>
					</n-descriptions-item>
					<n-descriptions-item label="创建时间">{{ formatTime(task.createdAt) }}</n-descriptions-item>
					<n-descriptions-item label="更新时间">{{ formatTime(task.updatedAt) }}</n-descriptions-item>
				</n-descriptions>
			</div>

			<div v-if="task.status === 'uploading'" class="detail-section">
				<h3 class="section-title">上传进度</h3>
				<n-progress
					:percentage="task.progress"
					:status="task.status === 'error' ? 'error' : undefined"
				/>
				<div class="progress-details">
					<span>{{ formatFileSize(task.uploadedBytes) }} / {{ formatFileSize(task.fileSize) }}</span>
					<span v-if="task.totalChunks" class="chunk-info">
						分片 {{ getUploadedChunks() }}/{{ task.totalChunks }}
					</span>
				</div>
			</div>

			<div v-if="isProcessingStatus" class="detail-section">
				<h3 class="section-title">处理进度</h3>
				<div class="processing-status">
					<n-tag :type="getStatusTagType()" size="small">{{ getStatusLabel() }}</n-tag>
					<n-progress
						v-if="task.processingProgress !== undefined"
						:percentage="task.processingProgress"
						:show-indicator="false"
						style="margin-top: 8px;"
					/>
				</div>
				<div class="processing-stages">
					<div class="stage-item" :class="{ completed: getProcessingStage() >= 1 }">
						<SvgIcon 
							v-if="getProcessingStage() >= 1" 
							icon="ri:check-circle-line" 
							style="font-size: 16px; color: #52C41A;" 
						/>
						<SvgIcon 
							v-else 
							icon="ri:loader-4-line" 
							style="font-size: 16px; animation: spin 1s linear infinite;" 
						/>
						<span class="stage-label">解析文档</span>
					</div>
					<div class="stage-item" :class="{ completed: getProcessingStage() >= 2 }">
						<SvgIcon 
							v-if="getProcessingStage() >= 2" 
							icon="ri:check-circle-line" 
							style="font-size: 16px; color: #52C41A;" 
						/>
						<SvgIcon 
							v-else 
							icon="ri:loader-4-line" 
							style="font-size: 16px; animation: spin 1s linear infinite;" 
						/>
						<span class="stage-label">文本分块</span>
					</div>
					<div class="stage-item" :class="{ completed: getProcessingStage() >= 3, active: getProcessingStage() === 3 }">
						<SvgIcon 
							v-if="getProcessingStage() > 3" 
							icon="ri:check-circle-line" 
							style="font-size: 16px; color: #52C41A;" 
						/>
						<SvgIcon 
							v-else-if="getProcessingStage() === 3" 
							icon="ri:loader-4-line" 
							style="font-size: 16px; animation: spin 1s linear infinite; color: #1890FF;" 
						/>
						<SvgIcon 
							v-else 
							icon="ri:circle-line" 
							style="font-size: 16px; color: #8C8C8C;" 
						/>
						<span class="stage-label">相似度匹配</span>
					</div>
					<div class="stage-item" :class="{ completed: getProcessingStage() >= 4, active: getProcessingStage() === 4 }">
						<SvgIcon 
							v-if="getProcessingStage() > 4" 
							icon="ri:check-circle-line" 
							style="font-size: 16px; color: #52C41A;" 
						/>
						<SvgIcon 
							v-else-if="getProcessingStage() === 4" 
							icon="ri:loader-4-line" 
							style="font-size: 16px; animation: spin 1s linear infinite; color: #1890FF;" 
						/>
						<SvgIcon 
							v-else 
							icon="ri:circle-line" 
							style="font-size: 16px; color: #8C8C8C;" 
						/>
						<span class="stage-label">创建条目</span>
					</div>
					<div class="stage-item" :class="{ completed: getProcessingStage() >= 5, active: getProcessingStage() === 5 }">
						<SvgIcon 
							v-if="getProcessingStage() > 5" 
							icon="ri:check-circle-line" 
							style="font-size: 16px; color: #52C41A;" 
						/>
						<SvgIcon 
							v-else-if="getProcessingStage() === 5" 
							icon="ri:loader-4-line" 
							style="font-size: 16px; animation: spin 1s linear infinite; color: #1890FF;" 
						/>
						<SvgIcon 
							v-else 
							icon="ri:circle-line" 
							style="font-size: 16px; color: #8C8C8C;" 
						/>
						<span class="stage-label">向量化存储</span>
					</div>
				</div>
			</div>

			<div v-if="(task.status === 'error' || task.status === 'failed') && task.error" class="detail-section">
				<h3 class="section-title">错误信息</h3>
				<n-alert type="error" :title="task.error">
					<div v-if="task.retryCount > 0" style="margin-top: 8px;">
						已重试 {{ task.retryCount }} 次
					</div>
				</n-alert>
			</div>
			
			<div v-if="task.status === 'cancelled'" class="detail-section">
				<h3 class="section-title">任务状态</h3>
				<n-alert type="warning" title="任务已取消">
					该任务已被用户取消
				</n-alert>
			</div>

			<div class="detail-actions">
				<n-space>
					<n-button
						v-if="task.status === 'error' || task.status === 'failed'"
						type="error"
						@click="handleRetry"
					>
						重试
					</n-button>
					<n-button
						v-if="task.status !== 'completed' && task.status !== 'success'"
						type="error"
						@click="handleRemove"
					>
						删除
					</n-button>
					<n-button
						v-if="task.status === 'success' || task.status === 'completed'"
						@click="handleRemove"
					>
						删除
					</n-button>
					<n-button
						v-if="task.attachId && task.status !== 'success' && task.status !== 'completed'"
						type="primary"
						@click="handleDownloadFile"
					>
						下载文件
					</n-button>
					<n-button
						v-if="task.attachId && (task.status === 'success' || task.status === 'completed')"
						type="primary"
						@click="handleViewAttach"
					>
						查看附件
					</n-button>
				</n-space>
			</div>
		</div>
	</n-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NDrawer, NButton, NSpace, NDescriptions, NDescriptionsItem, NProgress, NTag, NAlert, useDialog, useMessage } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useUploadStore } from '@/store/modules/upload'
import { uploadService } from '@/services/uploadService'
import { useRouter } from 'vue-router'
import { downloadKnowledgeAttach } from '@/api/knowledge'
import type { UploadTask } from '@/store/modules/upload/helper'

interface Props {
	task: UploadTask | null
	show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
	'update:show': [value: boolean]
}>()

const store = useUploadStore()
const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const isMobile = ref(window.innerWidth < 768)

const show = computed({
	get: () => props.show,
	set: (value) => emit('update:show', value)
})

function getFileTypeIcon(fileName: string): string {
	const ext = fileName.split('.').pop()?.toLowerCase() || ''
	if (['pdf'].includes(ext)) return 'ri:file-pdf-2-line'
	if (['doc', 'docx'].includes(ext)) return 'ri:file-word-2-line'
	if (['xls', 'xlsx'].includes(ext)) return 'ri:file-excel-2-line'
	if (['txt', 'md'].includes(ext)) return 'ri:file-text-line'
	return 'ri:file-line'
}

function getFileTypeColor(fileName: string): string {
	const ext = fileName.split('.').pop()?.toLowerCase() || ''
	if (['pdf'].includes(ext)) return '#F5222D'
	if (['doc', 'docx'].includes(ext)) return '#1890FF'
	if (['xls', 'xlsx'].includes(ext)) return '#52C41A'
	if (['txt', 'md'].includes(ext)) return '#722ED1'
	return '#808080'
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString('zh-CN')
}

const isProcessingStatus = computed(() => {
	return props.task?.status === 'processing' || props.task?.status === 'parsing' 
		|| props.task?.status === 'chunking' || props.task?.status === 'matching'
		|| props.task?.status === 'creating_items' || props.task?.status === 'vectorizing'
})

function getStatusType(status: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
	if (status === 'success' || status === 'completed') return 'success'
	if (status === 'error' || status === 'failed') return 'error'
	if (status === 'cancelled') return 'warning'
	if (status === 'uploading' || status === 'processing' || status === 'parsing' 
		|| status === 'chunking' || status === 'matching' || status === 'creating_items' 
		|| status === 'vectorizing') return 'info'
	return 'default'
}

function getStatusLabel(status?: string): string {
	if (!status) status = props.task?.status || ''
	const labels: Record<string, string> = {
		waiting: '等待上传',
		uploading: '上传中',
		parsing: '解析文档中',
		chunking: '文本分块中',
		matching: '相似度匹配中',
		user_review_matching: '待审阅匹配结果',
		creating_items: '创建条目中',
		user_review_items: '待审阅新条目',
		vectorizing: '向量化存储中',
		processing: '处理中',
		success: '上传成功',
		completed: '处理完成',
		error: '上传失败',
		failed: '处理失败',
		cancelled: '已取消',
	}
	return labels[status] || status
}

function getStatusTagType(): 'default' | 'info' | 'success' | 'warning' | 'error' {
	const status = props.task?.status
	if (status === 'user_review_matching' || status === 'user_review_items') return 'warning'
	if (status === 'error' || status === 'failed') return 'error'
	if (status === 'success' || status === 'completed') return 'success'
	if (status === 'cancelled') return 'warning'
	return 'info'
}

function getUploadedChunks(): number {
	if (!props.task?.chunks) return 0
	return props.task.chunks.filter(chunk => chunk.uploaded).length
}

function getProcessingStage(): number {
	if (!props.task) return 0
	//优先使用processingStatus（从后端获取的详细状态）
	if (props.task.processingStatus) {
		const status = props.task.processingStatus
		if (status === 'PARSING') return 1
		if (status === 'CHUNKING') return 2
		if (status === 'MATCHING') return 3
		if (status === 'USER_REVIEW_MATCHING') return 3
		if (status === 'CREATING_ITEMS') return 4
		if (status === 'USER_REVIEW_ITEMS') return 4
		if (status === 'VECTORIZING') return 5
		if (status === 'COMPLETED') return 5
		return 0
	}
	//降级使用status（前端状态）
	const status = props.task.status
	if (status === 'parsing') return 1
	if (status === 'chunking') return 2
	if (status === 'matching') return 3
	if (status === 'user_review_matching') return 3
	if (status === 'creating_items') return 4
	if (status === 'user_review_items') return 4
	if (status === 'vectorizing') return 5
	if (status === 'completed') return 5
	return 0
}

function handleRetry() {
	if (props.task) {
		store.retryTask(props.task.id)
		uploadService.uploadTask(props.task.id)
	}
}

async function handleRemove() {
	if (!props.task) return
	
	//判断是否为未完成的任务
	const isUnfinished = props.task.status !== 'success' && props.task.status !== 'completed' && props.task.status !== 'cancelled'
	
	//如果是未完成的任务，显示确认对话框
	if (isUnfinished) {
		dialog.warning({
			title: '确认删除',
			content: `任务 "${props.task.fileName}" 尚未完成，确定要删除吗？删除后无法恢复。`,
			positiveText: '确定删除',
			negativeText: '取消',
			onPositiveClick: () => {
				performRemove()
			}
		})
	} else {
		performRemove()
	}
}

async function performRemove() {
	if (!props.task) return
	
	//停止轮询
	uploadService.stopProcessingPolling(props.task.id)
	
	//如果正在上传，先取消上传
	if (props.task.status === 'uploading' && props.task.xhr) {
		props.task.xhr.abort()
		store.cancelTask(props.task.id)
	}
	
	//删除附件：优先使用docId，如果没有docId但有processId，使用processId
	let deleteSuccess = false
	if (props.task.docId && props.task.kid) {
		//有docId，使用docId删除
		try {
			const { delKnowledgeDetail } = await import('@/api/knowledge')
			const response = await delKnowledgeDetail({ kid: props.task.kid, docId: props.task.docId })
			if (response && (response.code === 200 || response.code === 0)) {
				deleteSuccess = true
			} else {
				const errorMsg = response?.msg || response?.message || '删除失败'
				message.error(errorMsg)
			}
		} catch (error: any) {
			const errorMsg = error?.response?.data?.msg || error?.message || '删除失败，请稍后重试'
			message.error(errorMsg)
		}
	} else if (props.task.processId) {
		//没有docId但有processId，使用processId删除
		try {
			const { delKnowledgeDetailByProcessId } = await import('@/api/knowledge')
			const response = await delKnowledgeDetailByProcessId(props.task.processId)
			if (response && (response.code === 200 || response.code === 0)) {
				deleteSuccess = true
			} else {
				const errorMsg = response?.msg || response?.message || '删除失败'
				message.error(errorMsg)
			}
		} catch (error: any) {
			const errorMsg = error?.response?.data?.msg || error?.message || '删除失败，请稍后重试'
			message.error(errorMsg)
		}
	}
	
	//如果删除成功或没有可删除的记录，从前端移除任务
	if (deleteSuccess || (!props.task.docId && !props.task.processId)) {
		store.removeTask(props.task.id)
		show.value = false
	}
}

async function handleDownloadFile() {
	if (!props.task?.attachId) {
		message.warning('附件ID不存在')
		return
	}
	
	try {
		const response = await downloadKnowledgeAttach(props.task.attachId)
		const blob = new Blob([response as any])
		const url = window.URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = props.task.fileName || 'download'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		window.URL.revokeObjectURL(url)
		message.success('下载成功')
	} catch (error: any) {
		message.error('下载失败: ' + (error.message || '未知错误'))
	}
}

function handleViewAttach() {
	if (props.task?.attachId) {
		router.push({ path: '/knowledge/annex', query: { kid: props.task.kid, attachId: props.task.attachId } })
		show.value = false
	}
}
</script>

<style scoped>
.task-detail-content {
	padding: 16px;
}

.detail-header {
	padding: 16px;
	border-bottom: 1px solid #EDEBE9;
}

.detail-title {
	font-size: 16px;
	font-weight: 600;
	color: #323130;
}

.detail-section {
	margin-bottom: 24px;
}

.section-title {
	font-size: 14px;
	font-weight: 600;
	color: #323130;
	margin-bottom: 12px;
}

.file-name-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.progress-details {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 8px;
	font-size: 12px;
	color: #605E5C;
}

.chunk-info {
	color: #808080;
}

.processing-stages {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.stage-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px;
	border-radius: 4px;
	background: #FAF9F8;
}

.stage-item.completed {
	background: #F6FFED;
}

.stage-icon {
	font-size: 16px;
	display: inline-flex;
	align-items: center;
	margin-right: 8px;
}

.stage-label {
	font-size: 14px;
	color: #323130;
}

.detail-actions {
	margin-top: 24px;
	padding-top: 16px;
	border-top: 1px solid #EDEBE9;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}
</style>

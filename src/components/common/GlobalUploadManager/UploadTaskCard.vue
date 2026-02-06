<template>
	<div class="upload-task-card" :class="{ 'task-error': task.status === 'error', 'task-success': task.status === 'success' }" @click="handleViewDetail">
		<div class="task-header">
			<div class="task-info">
				<SvgIcon :icon="getFileTypeIcon(task.fileName)" :style="{ color: getFileTypeColor(task.fileName), fontSize: '20px' }" />
				<div class="task-details">
					<div class="task-name" v-html="getHighlightedFileName()"></div>
					<div class="task-meta">
						<span>{{ formatFileSize(task.fileSize) }}</span>
						<span v-if="task.status === 'uploading' && task.uploadedBytes > 0">
							· {{ formatFileSize(task.uploadedBytes) }} / {{ formatFileSize(task.fileSize) }}
						</span>
						<span v-if="task.kid && getKnowledgeBaseName(task.kid)" class="knowledge-base-tag">
							· <n-tag size="small" type="default" :bordered="false">{{ getKnowledgeBaseName(task.kid) }}</n-tag>
						</span>
					</div>
				</div>
			</div>
			<div class="task-actions" @click.stop>
				<n-button
					v-if="task.status === 'error'"
					quaternary
					size="small"
					type="error"
					@click="handleRetry"
				>
					重试
				</n-button>
				<n-button
					v-if="task.status !== 'completed' && task.status !== 'success'"
					quaternary
					size="small"
					type="error"
					@click="handleRemove"
				>
					删除
				</n-button>
				<n-button
					v-if="task.status === 'success' || task.status === 'completed'"
					quaternary
					size="small"
					@click="handleRemove"
				>
					删除
				</n-button>
			</div>
		</div>

		<div v-if="task.status === 'uploading'" class="task-progress">
			<n-progress
				:percentage="task.progress"
				:status="task.status === 'error' ? 'error' : undefined"
				:show-indicator="false"
			/>
			<div class="progress-info">
				<span>{{ task.progress }}%</span>
				<span v-if="task.totalChunks" class="chunk-info">
					分片 {{ getUploadedChunks() }}/{{ task.totalChunks }}
				</span>
			</div>
			<div v-if="task.uploadSpeed && task.uploadSpeed > 0" class="speed-info" style="margin-top: 4px; font-size: 12px; color: #8C8C8C; display: flex; justify-content: space-between;">
				<span>{{ formatSpeed(task.uploadSpeed) }}</span>
				<span v-if="task.eta && task.eta > 0 && isFinite(task.eta)">{{ formatETA(task.eta) }}</span>
			</div>
		</div>

		<div v-if="isProcessingStatus" class="task-processing">
			<div class="processing-status">
				<n-tag :type="getStatusTagType()" size="small">{{ getStatusLabel() }}</n-tag>
				<n-progress
					:percentage="getDetailedProgress()"
					:show-indicator="true"
					style="margin-top: 8px;"
				/>
				<div class="progress-info" style="margin-top: 4px; font-size: 12px; color: #8C8C8C; display: flex; justify-content: space-between; align-items: center;">
					<span v-if="getProgressDetailText()">{{ getProgressDetailText() }}</span>
					<span style="font-weight: 500; color: #1890ff;">{{ getDetailedProgress() }}%</span>
				</div>
				<div v-if="shouldShowProcessingSpeed()" class="speed-info" style="margin-top: 4px; font-size: 12px; color: #8C8C8C; display: flex; justify-content: space-between;">
					<span>{{ formatProcessingSpeed(task.processingSpeed!, task.speedUnit) }}</span>
					<span v-if="task.eta && task.eta > 0 && isFinite(task.eta)">{{ formatETA(task.eta) }}</span>
				</div>
			</div>
			<div class="processing-stages">
				<span :class="{ completed: getProcessingStage() >= 1, active: getProcessingStage() === 1 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 1" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 1" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					解析文档
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 2, active: getProcessingStage() === 2 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 2" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 2" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					文本分块
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 3, active: getProcessingStage() === 3 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 3" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 3" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					相似度匹配
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 4, active: getProcessingStage() === 4 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 4" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 4" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					创建条目
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 5, active: getProcessingStage() === 5 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 5" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 5" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					向量化存储
				</span>
			</div>
		</div>

		<div v-if="isReviewPending" class="task-review-pending">
			<div class="review-status-header">
				<n-tag type="warning" size="small" style="margin-bottom: 12px;">
					{{ getStatusLabel() }}
				</n-tag>
			</div>
			<div class="processing-stages">
				<span :class="{ completed: getProcessingStage() >= 1, active: getProcessingStage() === 1 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 1" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 1" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					解析文档
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 2, active: getProcessingStage() === 2 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 2" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 2" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					文本分块
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 3, active: getProcessingStage() === 3, breakpoint: isBreakpointAtStage(3) }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 3" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="isBreakpointAtStage(3)" 
						icon="ri:time-line" 
						class="stage-icon breakpoint-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 3" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					相似度匹配
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 4, active: getProcessingStage() === 4, breakpoint: isBreakpointAtStage(4) }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 4" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="isBreakpointAtStage(4)" 
						icon="ri:time-line" 
						class="stage-icon breakpoint-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 4" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					创建条目
				</span>
				<span class="stage-arrow">→</span>
				<span :class="{ completed: getProcessingStage() >= 5, active: getProcessingStage() === 5 }" class="stage-item">
					<SvgIcon 
						v-if="getProcessingStage() > 5" 
						icon="ri:check-circle-line" 
						class="stage-icon completed-icon"
					/>
					<SvgIcon 
						v-else-if="getProcessingStage() === 5" 
						icon="ri:loader-4-line" 
						class="stage-icon active-icon"
					/>
					<SvgIcon 
						v-else 
						icon="ri:circle-line" 
						class="stage-icon pending-icon"
					/>
					向量化存储
				</span>
			</div>
			<n-button
				type="primary"
				size="small"
				style="width: 100%; margin-top: 12px; background-color: #FA8C16;"
				@click.stop="handleContinueReview"
			>
				继续处理
			</n-button>
		</div>

		<div v-if="(task.status === 'error' || task.status === 'failed') && task.error" class="task-error-message">
			<span style="color: #F5222D; display: inline-flex; align-items: center; gap: 4px;">
				<SvgIcon icon="ri:close-circle-line" style="font-size: 14px;" /> {{ task.error }}
			</span>
		</div>
		
		<div v-if="task.status === 'cancelled'" class="task-cancelled-message">
			<span style="color: #8C8C8C; display: inline-flex; align-items: center; gap: 4px;">
				<SvgIcon icon="ri:close-circle-line" style="font-size: 14px;" /> 已取消
			</span>
		</div>

		<div v-if="task.status === 'success' || task.status === 'completed'" class="task-success-message">
			<span style="color: #52C41A; display: inline-flex; align-items: center; gap: 4px;">
				<SvgIcon icon="ri:check-circle-line" style="font-size: 14px;" /> {{ task.status === 'completed' ? '处理完成' : '上传完成' }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NProgress, NTag, NAlert, useMessage, useDialog } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useUploadStore } from '@/store/modules/upload'
import { uploadService } from '@/services/uploadService'
import type { UploadTask } from '@/store/modules/upload/helper'
import { formatSpeed, formatETA } from '@/utils/speedCalculator'

interface Props {
	task: UploadTask
}

const props = defineProps<Props>()
const store = useUploadStore()
const message = useMessage()
const dialog = useDialog()

const isReviewPending = computed(() => {
	return props.task.status === 'user_review_matching' || props.task.status === 'user_review_items'
})

const isProcessingStatus = computed(() => {
	const result = props.task.status === 'processing' || props.task.status === 'parsing' 
		|| props.task.status === 'chunking' || props.task.status === 'matching'
		|| props.task.status === 'creating_items' || props.task.status === 'vectorizing'
	return result
})

function getStatusLabel(): string {
	//优先使用processingStatus（后端详细状态）
	if (props.task.processingStatus) {
		const statusLabels: Record<string, string> = {
			'PARSING': '解析文档中',
			'CHUNKING': '文本分块中',
			'MATCHING': '相似度匹配中',
			'USER_REVIEW_MATCHING': '待审阅匹配结果',
			'CREATING_ITEMS': '创建条目中',
			'USER_REVIEW_ITEMS': '待审阅新条目',
			'VECTORIZING': '向量化存储中',
			'COMPLETED': '处理完成',
			'FAILED': '处理失败',
			'CANCELLED': '已取消',
		}
		if (statusLabels[props.task.processingStatus]) {
			return statusLabels[props.task.processingStatus]
		}
	}
	//降级使用status（前端状态）
	const labels: Record<string, string> = {
		'waiting': '等待上传',
		'uploading': '上传中',
		'processing': '处理中',
		'parsing': '解析文档中',
		'chunking': '文本分块中',
		'matching': '相似度匹配中',
		'user_review_matching': '待审阅匹配结果',
		'creating_items': '创建条目中',
		'user_review_items': '待审阅新条目',
		'vectorizing': '向量化存储中',
		'completed': '处理完成',
		'success': '上传成功',
		'error': '上传失败',
		'failed': '处理失败',
		'cancelled': '已取消',
	}
	return labels[props.task.status] || '处理中'
}

function getStatusTagType(): 'default' | 'info' | 'success' | 'warning' | 'error' {
	if (isReviewPending.value) return 'warning'
	if (props.task.status === 'error' || props.task.status === 'failed') return 'error'
	if (props.task.status === 'success' || props.task.status === 'completed') return 'success'
	return 'info'
}

function getProcessingStage(): number {
	// 优先使用 processingStatus（从后端获取的详细状态）
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
	// 降级使用 status（前端状态）
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

/**
 * 获取细粒度进度（基于statusData中的实际处理数据）
 */
function getDetailedProgress(): number {
	//优先使用processingProgress（后端计算的详细进度）
	if (props.task.processingProgress !== undefined && props.task.processingProgress > 0) {
		return props.task.processingProgress
	}
	
	//如果没有processingProgress，根据状态计算默认进度
	if (props.task.processingStatus) {
		const status = props.task.processingStatus
		const defaultProgress: Record<string, number> = {
			'PARSING': 15,
			'CHUNKING': 25,
			'MATCHING': 50,
			'USER_REVIEW_MATCHING': 60,
			'CREATING_ITEMS': 75,
			'USER_REVIEW_ITEMS': 85,
			'VECTORIZING': 95,
			'COMPLETED': 100,
		}
		if (defaultProgress[status] !== undefined) {
			return defaultProgress[status]
		}
	}
	//降级使用status
	const status = props.task.status
	const defaultProgress: Record<string, number> = {
		'parsing': 15,
		'chunking': 25,
		'matching': 50,
		'user_review_matching': 60,
		'creating_items': 75,
		'user_review_items': 85,
		'vectorizing': 95,
		'completed': 100,
	}
	if (defaultProgress[status] !== undefined) {
		return defaultProgress[status]
	}
	//默认返回5%，表示处理中
	return 5
}

/**
 * 获取进度详情文本（显示当前处理数量/总数）
 */
function getProgressDetailText(): string {
	if (!props.task.attachProcessData) {
		return ''
	}
	const data = props.task.attachProcessData
	if (data.currentIndex !== undefined && data.totalCount !== undefined && data.totalCount > 0) {
		return `${data.currentIndex}/${data.totalCount}`
	}
	return ''
}

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

function shouldShowProcessingSpeed(): boolean {
	if (!props.task.processingSpeed || props.task.processingSpeed <= 0) return false
	if (!props.task.speedUnit) return false//必须有单位
	if (isBreakpointStatus()) return false
	
	//检查状态：只在非断点状态显示速率
	const status = props.task.processingStatus || props.task.status
	if (!status) return false
	
	//排除断点状态
	if (status === 'USER_REVIEW_MATCHING' || status === 'user_review_matching' ||
		status === 'USER_REVIEW_ITEMS' || status === 'user_review_items') {
		return false
	}
	
	//排除完成/失败状态
	if (status === 'COMPLETED' || status === 'completed' ||
		status === 'FAILED' || status === 'failed' ||
		status === 'CANCELLED' || status === 'cancelled') {
		return false
	}
	
	return true
}

function formatProcessingSpeed(speed: number, unit?: string): string {
	if (speed <= 0) return ''
	if (!unit) return ''
	
	//当速率很低（<1单位/秒）时，转换为"每单位时间"的格式，更友好
	if (speed < 1) {
		const secondsPerUnit = 1 / speed
		if (secondsPerUnit < 60) {
			//小于60秒，显示"约X秒/条目"
			return `约${Math.round(secondsPerUnit)}秒/${unit.replace('条目/秒', '条目').replace('片段/秒', '片段')}`
		} else if (secondsPerUnit < 3600) {
			//小于1小时，显示"约X分钟/条目"
			const minutesPerUnit = secondsPerUnit / 60
			if (minutesPerUnit < 10) {
				return `约${minutesPerUnit.toFixed(1)}分钟/${unit.replace('条目/秒', '条目').replace('片段/秒', '片段')}`
			} else {
				return `约${Math.round(minutesPerUnit)}分钟/${unit.replace('条目/秒', '条目').replace('片段/秒', '片段')}`
			}
		} else {
			//超过1小时，显示"约X小时/条目"
			const hoursPerUnit = secondsPerUnit / 3600
			if (hoursPerUnit < 10) {
				return `约${hoursPerUnit.toFixed(1)}小时/${unit.replace('条目/秒', '条目').replace('片段/秒', '片段')}`
			} else {
				return `约${Math.round(hoursPerUnit)}小时/${unit.replace('条目/秒', '条目').replace('片段/秒', '片段')}`
			}
		}
	} else if (speed < 10) {
		//速率在1-10之间，显示1位小数
		return `${speed.toFixed(1)} ${unit}`
	} else {
		//速率>=10，四舍五入到整数
		return `${Math.round(speed)} ${unit}`
	}
}

function isBreakpointStatus(): boolean {
	if (!props.task) return false
	const status = props.task.processingStatus || props.task.status
	return status === 'USER_REVIEW_MATCHING' || status === 'user_review_matching' ||
		status === 'USER_REVIEW_ITEMS' || status === 'user_review_items'
}

function isBreakpointAtStage(stage: number): boolean {
	if (!isReviewPending.value) return false
	const status = props.task.processingStatus || props.task.status
	if (stage === 3 && (status === 'USER_REVIEW_MATCHING' || status === 'user_review_matching')) {
		return true
	}
	if (stage === 4 && (status === 'USER_REVIEW_ITEMS' || status === 'user_review_items')) {
		return true
	}
	return false
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function getKnowledgeBaseName(kid: string): string {
	return store.getKnowledgeBaseName(kid) || ''
}

function extractKeywords(query: string): string[] {
	if (!query || !query.trim()) return []
	return query.trim().split(/\s+/).filter(w => w.length > 0)
}

function escapeHtml(text: string): string {
	const div = document.createElement('div')
	div.textContent = text
	return div.innerHTML
}

function highlightText(text: string, keywords: string[]): string {
	if (!text || !keywords || keywords.length === 0) {
		return escapeHtml(text)
	}
	const lowerText = text.toLowerCase()
	let result = ''
	let lastIndex = 0
	const matches: Array<{ start: number; end: number; keyword: string }> = []
	for (const keyword of keywords) {
		const lowerKeyword = keyword.toLowerCase().trim()
		if (!lowerKeyword) continue
		let searchIndex = 0
		while (true) {
			const index = lowerText.indexOf(lowerKeyword, searchIndex)
			if (index === -1) break
			const overlap = matches.some(m => 
				(index >= m.start && index < m.end) || 
				(index + lowerKeyword.length > m.start && index + lowerKeyword.length <= m.end) ||
				(index <= m.start && index + lowerKeyword.length >= m.end)
			)
			if (!overlap) {
				matches.push({ 
					start: index, 
					end: index + lowerKeyword.length, 
					keyword: lowerKeyword 
				})
			}
			searchIndex = index + 1
		}
	}
	matches.sort((a, b) => a.start - b.start)
	for (const match of matches) {
		if (lastIndex < match.start) {
			result += escapeHtml(text.substring(lastIndex, match.start))
		}
		result += `<mark style="background-color: #fff4ce; color: #000; padding: 0 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(text.substring(match.start, match.end))}</mark>`
		lastIndex = match.end
	}
	if (lastIndex < text.length) {
		result += escapeHtml(text.substring(lastIndex))
	}
	return result
}

function getHighlightedFileName(): string {
	const fileName = props.task.fileName || ''
	const searchKeyword = store.filters.searchKeyword
	if (!searchKeyword || !searchKeyword.trim()) {
		return escapeHtml(fileName)
	}
	const keywords = extractKeywords(searchKeyword)
	return highlightText(fileName, keywords)
}

function getUploadedChunks(): number {
	if (!props.task.chunks) return 0
	return props.task.chunks.filter(chunk => chunk.uploaded).length
}

function handleRetry() {
	store.retryTask(props.task.id)
	uploadService.uploadTask(props.task.id)
}

async function handleRemove() {
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
	//停止轮询
	uploadService.stopProcessingPolling(props.task.id)
	
	//如果正在上传，先取消上传
	if (props.task.status === 'uploading' && props.task.xhr) {
		props.task.xhr.abort()
	}
	
	//删除附件：最保险的方式是使用kid+fileName，因为文件名始终存在于任务对象中
	//优先级：kid+fileName > docId > processId > attachId查询
	let deleteSuccess = false
	if (props.task.kid && props.task.fileName) {
		//最保险：使用kid+fileName删除
		try {
			const { delKnowledgeDetailByKidAndName } = await import('@/api/knowledge')
			const response = await delKnowledgeDetailByKidAndName(props.task.kid, props.task.fileName)
			if (response && (response.code === 200 || response.code === 0)) {
				deleteSuccess = true
				message.success('删除成功')
			} else {
				const errorMsg = response?.msg || response?.message || '删除失败'
				message.error(errorMsg)
			}
		} catch (error: any) {
			const errorMsg = error?.response?.data?.msg || error?.message || '删除失败，请稍后重试'
			message.error(errorMsg)
		}
	} else if (props.task.docId && props.task.kid) {
		//有docId，使用docId删除
		try {
			const { delKnowledgeDetail } = await import('@/api/knowledge')
			const response = await delKnowledgeDetail({ kid: props.task.kid, docId: props.task.docId })
			if (response && (response.code === 200 || response.code === 0)) {
				deleteSuccess = true
				message.success('删除成功')
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
				message.success('删除成功')
			} else {
				const errorMsg = response?.msg || response?.message || '删除失败'
				message.error(errorMsg)
			}
		} catch (error: any) {
			const errorMsg = error?.response?.data?.msg || error?.message || '删除失败，请稍后重试'
			message.error(errorMsg)
		}
	} else if (props.task.attachId) {
		//没有docId和processId，但有attachId，通过attachId查询docId或processId
		try {
			const { getKnowledgeAttachInfo } = await import('@/api/knowledge')
			const attachInfo = await getKnowledgeAttachInfo(props.task.attachId)
			if (attachInfo && (attachInfo.code === 200 || attachInfo.code === 0) && attachInfo.data) {
				const docId = attachInfo.data.docId
				const processId = attachInfo.data.processId
				if (docId && props.task.kid) {
					//查询到docId，使用docId删除
					const { delKnowledgeDetail } = await import('@/api/knowledge')
					const response = await delKnowledgeDetail({ kid: props.task.kid, docId })
					if (response && (response.code === 200 || response.code === 0)) {
						deleteSuccess = true
						message.success('删除成功')
					} else {
						const errorMsg = response?.msg || response?.message || '删除失败'
						message.error(errorMsg)
					}
				} else if (processId) {
					//查询到processId，使用processId删除
					const { delKnowledgeDetailByProcessId } = await import('@/api/knowledge')
					const response = await delKnowledgeDetailByProcessId(processId)
					if (response && (response.code === 200 || response.code === 0)) {
						deleteSuccess = true
						message.success('删除成功')
					} else {
						const errorMsg = response?.msg || response?.message || '删除失败'
						message.error(errorMsg)
					}
				} else {
					message.warning('无法找到关联的后端记录，仅从前端移除任务')
				}
			} else {
				message.warning('查询附件信息失败，仅从前端移除任务')
			}
		} catch (error: any) {
			message.warning('查询附件信息失败，仅从前端移除任务')
		}
	} else {
	}
	
	//如果删除成功或没有可删除的记录，从前端移除任务
	if (deleteSuccess || (!props.task.docId && !props.task.processId && !props.task.attachId)) {
		store.removeTask(props.task.id)
	} else {
	}
}

function handleContinueReview() {
	emit('continue-review', props.task)
}

const emit = defineEmits<{
	viewDetail: [task: UploadTask]
	continueReview: [task: UploadTask]
}>()

function handleViewDetail() {
	emit('viewDetail', props.task)
}
</script>

<style scoped>
.upload-task-card {
	padding: 12px 16px;
	background: #FFFFFF;
	border: 1px solid #EDEBE9;
	border-radius: 4px;
	margin-bottom: 8px;
	transition: all 0.2s;
	cursor: pointer;
}

.upload-task-card:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.task-error {
	border-color: #FFCCC7;
	background: #FFF1F0;
}

.task-success {
	border-color: #B7EB8F;
	background: #F6FFED;
}

.task-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 8px;
}

.task-info {
	display: flex;
	align-items: center;
	gap: 12px;
	flex: 1;
	min-width: 0;
}

.task-details {
	flex: 1;
	min-width: 0;
}

.task-name {
	font-size: 14px;
	color: #323130;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.task-meta {
	font-size: 12px;
	color: #605E5C;
	margin-top: 4px;
}

.task-actions {
	display: flex;
	gap: 8px;
}

.task-progress {
	margin-top: 8px;
}

.progress-info {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 4px;
	font-size: 12px;
	color: #605E5C;
}

.chunk-info {
	color: #808080;
}

.task-processing {
	margin-top: 8px;
}

.processing-stages {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: #605E5C;
}

.stage-item {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	transition: color 0.3s;
}

.stage-item.completed {
	color: #52C41A;
}

.stage-item.active {
	color: #1890FF;
	font-weight: 500;
}

.stage-item:not(.completed):not(.active) {
	color: #8C8C8C;
}

.stage-icon {
	font-size: 14px;
}

.stage-icon.completed-icon {
	color: #52C41A;
}

.stage-icon.active-icon {
	color: #1890FF;
	animation: spin 1s linear infinite;
}

.stage-icon.pending-icon {
	color: #D9D9D9;
}

.stage-arrow {
	color: #D9D9D9;
	margin: 0 4px;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.task-error-message {
	margin-top: 8px;
	font-size: 12px;
}

.task-success-message {
	margin-top: 8px;
	font-size: 12px;
}

.task-review-pending {
	margin-top: 8px;
	padding: 12px;
	background: #FFF7E6;
	border: 1px solid #FFE7BA;
	border-radius: 4px;
}

.review-status-header {
	margin-bottom: 12px;
}

.stage-item.breakpoint {
	position: relative;
	padding: 4px 8px;
	background: #FFF7E6;
	border: 1px dashed #FA8C16;
	border-radius: 4px;
	font-weight: 500;
}

.stage-icon.breakpoint-icon {
	color: #FA8C16;
	animation: blink 1.5s ease-in-out infinite;
}

.knowledge-base-tag {
	margin-left: 4px;
}

@keyframes blink {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}
</style>

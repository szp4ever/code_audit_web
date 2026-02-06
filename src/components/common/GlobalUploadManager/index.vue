<template>
	<div class="global-upload-manager">
		<n-drawer
			v-model:show="showPanel"
			:width="isMobile ? '100%' : 620"
			placement="right"
			:trap-focus="false"
			:block-scroll="false"
			:mask-closable="true"
		>
			<template #header>
				<div class="panel-header">
					<n-space justify="space-between" align="center">
						<span class="panel-title">上传任务管理器</span>
						<n-space :size="8">
							<n-button quaternary size="small" @click="handleSettings">
								<template #icon>
									<SvgIcon icon="ri:settings-3-line" />
								</template>
							</n-button>
							<n-button quaternary size="small" @click="showPanel = false">
								<template #icon>
									<SvgIcon icon="ri:close-line" />
								</template>
							</n-button>
						</n-space>
					</n-space>
				</div>
			</template>

			<div class="panel-content">
				<UploadStatsBar />
				<TaskFilterBar />

				<div class="task-groups">
					<template v-for="[kid, tasks] in Array.from(store.groupedTasksByKnowledgeBase.entries())" :key="kid">
						<div v-if="tasks.length > 0" class="task-group">
							<div class="group-header" @click="toggleKnowledgeBaseGroup(kid)">
								<n-space justify="space-between" align="center">
									<span class="group-title">
										<SvgIcon :icon="knowledgeBaseCollapsed.get(kid) ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" />
										<span>{{ getGroupTitle(kid, tasks) }}</span>
									</span>
								</n-space>
							</div>
							<div v-show="!knowledgeBaseCollapsed.get(kid)" class="group-content">
								<UploadTaskCard
									v-for="task in tasks"
									:key="task.id"
									:task="task"
									@view-detail="handleViewTaskDetail"
									@continue-review="handleContinueReview"
								/>
							</div>
						</div>
					</template>

					<n-empty v-if="store.tasks.length === 0" description="暂无上传任务" />
				</div>

				<div class="panel-footer">
					<n-space justify="space-between">
						<n-space :size="8">
							<n-button size="small" @click="expandAll">全部展开</n-button>
							<n-button size="small" @click="collapseAll">全部折叠</n-button>
							<n-button size="small" @click="expandActiveGroups">展开有进行中的知识库</n-button>
						</n-space>
						<n-space :size="8">
							<n-button v-if="hasCompletedTasks" size="small" @click="handleClearCompleted">清空已完成</n-button>
							<n-button v-if="hasErrorTasks" size="small" @click="handleClearErrors">清空失败</n-button>
						</n-space>
					</n-space>
				</div>
			</div>
		</n-drawer>
		
		<UploadTaskDetail
			v-model:show="showTaskDetail"
			:task="selectedTask"
		/>
		
		<MatchingReview
			v-model:show="showMatchingReview"
			:task="selectedTask"
			:tasks="selectedReviewTasks"
			@confirmed="handleReviewConfirmed"
		/>
		
		<ItemsReview
			v-model:show="showItemsReview"
			:task="selectedTask"
			:tasks="selectedReviewTasks"
			@confirmed="handleReviewConfirmed"
		/>
		
		<n-modal
			v-model:show="showSettingsModal"
			preset="card"
			title="上传设置"
			style="width: 500px"
			:mask-closable="true"
			:close-on-esc="true"
		>
			<n-form :model="settingsForm" label-placement="left" label-width="140">
				<n-form-item label="自动重试">
					<n-switch v-model:value="settingsForm.autoRetry" />
				</n-form-item>
				<n-form-item label="最大重试次数">
					<n-input-number
						v-model:value="settingsForm.retryCount"
						:min="0"
						:max="10"
						:disabled="!settingsForm.autoRetry"
					/>
				</n-form-item>
				<n-form-item label="分片上传">
					<n-switch v-model:value="settingsForm.chunkedUpload" />
				</n-form-item>
				<n-form-item label="分片大小 (MB)">
					<n-input-number
						v-model:value="chunkSizeMB"
						:min="1"
						:max="10"
						:disabled="!settingsForm.chunkedUpload"
					/>
				</n-form-item>
				<n-form-item label="桌面通知">
					<n-switch v-model:value="settingsForm.notifications" />
				</n-form-item>
			</n-form>
			<template #footer>
				<n-space justify="end">
					<n-button @click="handleResetSettings">恢复默认</n-button>
					<n-button type="primary" @click="handleSaveSettings">保存</n-button>
				</n-space>
			</template>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, computed } from 'vue'
import { NDrawer, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NSwitch, NInputNumber } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useUploadStore } from '@/store/modules/upload'
import type { UploadTask } from '@/store/modules/upload/helper'
import { uploadService } from '@/services/uploadService'
import UploadStatsBar from './UploadStatsBar.vue'
import TaskFilterBar from './TaskFilterBar.vue'
import UploadTaskCard from './UploadTaskCard.vue'
import UploadTaskDetail from './UploadTaskDetail.vue'
import MatchingReview from '@/views/knowledge/review/MatchingReview.vue'
import ItemsReview from '@/views/knowledge/review/ItemsReview.vue'

const store = useUploadStore()
const showPanel = ref(false)
const isMobile = ref(window.innerWidth < 768)
const selectedTask = ref<UploadTask | null>(null)
const showTaskDetail = ref(false)
const showMatchingReview = ref(false)
const showItemsReview = ref(false)
const selectedReviewTasks = ref<UploadTask[]>([])
const showSettingsModal = ref(false)

const settingsForm = reactive({
	autoRetry: store.settings.autoRetry,
	retryCount: store.settings.retryCount,
	chunkedUpload: store.settings.chunkedUpload,
	chunkSize: store.settings.chunkSize,
	notifications: store.settings.notifications,
})

const chunkSizeMB = computed({
	get: () => Math.round(settingsForm.chunkSize / (1024 * 1024)),
	set: (val) => { settingsForm.chunkSize = val * 1024 * 1024 }
})

const knowledgeBaseCollapsed = ref<Map<string, boolean>>(new Map())

function getGroupTitle(kid: string, tasks: UploadTask[]): string {
	const stats = store.groupStats(kid)
	const kbName = kid === '__UNKNOWN__' ? '未指定知识库' : (store.getKnowledgeBaseName(kid) || '未知知识库')
	const parts: string[] = []
	if (stats.active > 0) parts.push(`${stats.active}进行中`)
	if (stats.completed > 0) parts.push(`${stats.completed}已完成`)
	if (stats.failed > 0) parts.push(`${stats.failed}失败`)
	if (stats.pending > 0) parts.push(`${stats.pending}待审阅`)
	const statsText = parts.length > 0 ? ` [${parts.join(' ')}]` : ''
	return `${kbName} (${stats.total})${statsText}`
}

function isActiveTask(task: UploadTask): boolean {
	return task.status === 'uploading' || task.status === 'processing' || task.status === 'waiting'
		|| task.status === 'parsing' || task.status === 'chunking' || task.status === 'matching'
		|| task.status === 'creating_items' || task.status === 'vectorizing'
		|| task.status === 'user_review_matching' || task.status === 'user_review_items'
}

function getDefaultCollapsedState(kid: string, tasks: UploadTask[]): boolean {
	const hasActive = tasks.some(task => isActiveTask(task))
	return !hasActive
}

function toggleKnowledgeBaseGroup(kid: string) {
	const current = knowledgeBaseCollapsed.value.get(kid) ?? getDefaultCollapsedState(kid, store.groupedTasksByKnowledgeBase.get(kid) || [])
	knowledgeBaseCollapsed.value.set(kid, !current)
}

function expandAll() {
	store.groupedTasksByKnowledgeBase.forEach((tasks, kid) => {
		knowledgeBaseCollapsed.value.set(kid, false)
	})
}

function collapseAll() {
	store.groupedTasksByKnowledgeBase.forEach((tasks, kid) => {
		knowledgeBaseCollapsed.value.set(kid, true)
	})
}

function expandActiveGroups() {
	store.groupedTasksByKnowledgeBase.forEach((tasks, kid) => {
		knowledgeBaseCollapsed.value.set(kid, getDefaultCollapsedState(kid, tasks))
	})
}

const hasCompletedTasks = computed(() => store.successTasks.length > 0)
const hasErrorTasks = computed(() => store.errorTasks.length > 0)

function handleClearCompleted() {
	store.clearCompletedTasks()
}

function handleClearErrors() {
	store.clearErrorTasks()
}

function handleSettings() {
	settingsForm.autoRetry = store.settings.autoRetry
	settingsForm.retryCount = store.settings.retryCount
	settingsForm.chunkedUpload = store.settings.chunkedUpload
	settingsForm.chunkSize = store.settings.chunkSize
	settingsForm.notifications = store.settings.notifications
	showSettingsModal.value = true
}

function handleSaveSettings() {
	store.updateSettings({
		autoRetry: settingsForm.autoRetry,
		retryCount: settingsForm.retryCount,
		chunkedUpload: settingsForm.chunkedUpload,
		chunkSize: settingsForm.chunkSize,
		notifications: settingsForm.notifications,
	})
	showSettingsModal.value = false
}

function handleResetSettings() {
	const defaultSettings = {
		autoRetry: true,
		retryCount: 3,
		chunkedUpload: true,
		chunkSize: 2 * 1024 * 1024,
		notifications: true,
	}
	settingsForm.autoRetry = defaultSettings.autoRetry
	settingsForm.retryCount = defaultSettings.retryCount
	settingsForm.chunkedUpload = defaultSettings.chunkedUpload
	settingsForm.chunkSize = defaultSettings.chunkSize
	settingsForm.notifications = defaultSettings.notifications
}

function handleViewTaskDetail(task: UploadTask) {
	selectedTask.value = task
	showTaskDetail.value = true
}

function handleContinueReview(task: UploadTask) {
	selectedTask.value = task
	selectedReviewTasks.value = []
	if (task.status === 'user_review_matching') {
		showMatchingReview.value = true
	} else if (task.status === 'user_review_items') {
		showItemsReview.value = true
	}
}

function handleReviewConfirmed() {
	const tasksToPoll: UploadTask[] = []
	//处理批量任务
	selectedReviewTasks.value.forEach(task => {
		if (task.processId) {
			tasksToPoll.push(task)
		}
	})
	//处理单个任务
	if (selectedTask.value?.processId) {
		tasksToPoll.push(selectedTask.value)
	}
	//启动轮询
	tasksToPoll.forEach(task => {
		console.log('[GlobalUploadManager] 启动任务轮询:', {
			taskId: task.id,
			processId: task.processId,
			attachId: task.attachId,
			status: task.status
		})
		uploadService.startProcessingPolling(task.id, task.attachId || 0)
	})
	//清理状态
	selectedReviewTasks.value = []
	selectedTask.value = null
}

watch(() => store.waitingTasks, (tasks: UploadTask[]) => {
	tasks.forEach((task: UploadTask) => {
		if (task.status === 'waiting' && !task.xhr) {
			uploadService.uploadTask(task.id)
		}
	})
}, { deep: true })

watch(() => store.groupedTasksByKnowledgeBase, () => {
	// 当任务分组变化时，更新新知识库的默认展开状态
	store.groupedTasksByKnowledgeBase.forEach((tasks, kid) => {
		if (!knowledgeBaseCollapsed.value.has(kid)) {
			knowledgeBaseCollapsed.value.set(kid, getDefaultCollapsedState(kid, tasks))
		}
	})
}, { deep: true })

onMounted(() => {
	store.restoreTasks()
	
	// 初始化知识库分组展开状态（智能展开：有进行中的组展开，否则折叠）
	store.groupedTasksByKnowledgeBase.forEach((tasks, kid) => {
		knowledgeBaseCollapsed.value.set(kid, getDefaultCollapsedState(kid, tasks))
	})
	
	store.waitingTasks.forEach(task => {
		if (task.status === 'waiting' && !task.xhr) {
			uploadService.uploadTask(task.id)
		}
	})
	store.processingTasks.forEach(task => {
		if (task.processId) {
			uploadService.startProcessingPolling(task.id, task.attachId || 0)
		} else if (task.attachId) {
			uploadService.startProcessingPolling(task.id, task.attachId)
		}
	})
	uploadService.requestNotificationPermission()
	window.addEventListener('resize', () => {
		isMobile.value = window.innerWidth < 768
	})
})

onUnmounted(() => {
	uploadService.stopAllPolling()
})

defineExpose({
	show: () => { showPanel.value = true },
	hide: () => { showPanel.value = false },
	toggle: () => { showPanel.value = !showPanel.value },
})
</script>

<style scoped>
.global-upload-manager {
	position: relative;
}

.panel-header {
	padding: 16px;
	border-bottom: 1px solid #EDEBE9;
}

.panel-title {
	font-size: 16px;
	font-weight: 600;
	color: #323130;
}

.panel-content {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.task-groups {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
}

.task-group {
	margin-bottom: 16px;
}

.group-header {
	padding: 8px 0;
	cursor: pointer;
	user-select: none;
}

.group-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
	font-weight: 500;
	color: #323130;
}

.group-content {
	margin-top: 8px;
}

.panel-footer {
	padding: 12px 16px;
	border-top: 1px solid #EDEBE9;
	background: #FAF9F8;
}
</style>

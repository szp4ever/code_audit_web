<template>
	<n-modal
		v-model:show="showModal"
		preset="card"
		:title="isBatch ? `批量审阅匹配结果 - ${props.tasks?.length || 0}个文档` : `审阅匹配结果 - ${currentTask?.fileName}`"
		:mask-closable="true"
		:close-on-esc="true"
		style="width: 1400px; max-width: 95vw; max-height: 93vh;"
		:show-footer="true"
	>
	<template #header-extra>
		<n-space>
			<n-statistic label="总片段数" :value="totalCount" />
		</n-space>
	</template>

	<div class="matching-review-container">
		<n-spin :show="loading">
			<!-- 文档信息卡片（单个文档模式） -->
			<n-card v-if="!isBatch && currentTask" size="small" style="margin-bottom: 16px;">
			<n-space justify="space-between" align="center">
				<n-space>
					<SvgIcon icon="ri:file-line" :style="{ fontSize: '20px' }" />
					<div>
						<div style="font-weight: 500;">{{ currentTask.fileName }}</div>
						<div style="font-size: 12px; color: #666;">
							文件大小：{{ formatFileSize(currentTask.fileSize) }} · 
							文档ID：{{ currentTask.docId }} · 
							片段数量：{{ totalCount }}个
						</div>
					</div>
				</n-space>
				<n-radio-group v-model:value="viewMode" size="small">
					<n-radio-button value="fragment">按片段浏览</n-radio-button>
					<n-radio-button value="item">按条目归属浏览</n-radio-button>
				</n-radio-group>
			</n-space>
		</n-card>

		<!-- 批量模式：文档分组 -->
		<div v-if="isBatch" class="batch-documents">
			<n-collapse v-model:expanded-names="expandedDocIds">
				<n-collapse-item
					v-for="docGroup in documentGroups"
					:key="docGroup.docId"
					:name="docGroup.docId"
				>
					<template #header>
						<n-space justify="space-between" style="width: 100%;">
							<span>
								<SvgIcon icon="ri:file-line" />
								{{ docGroup.fileName }} ({{ docGroup.fragments.length }}个片段)
							</span>
						</n-space>
					</template>
					<FragmentList
						:fragments="docGroup.fragments"
						:doc-id="docGroup.docId"
						:kid="docGroup.kid"
						@update="(fragment) => handleFragmentUpdate(fragment)"
					/>
				</n-collapse-item>
			</n-collapse>
		</div>

		<!-- 单个文档模式：两种浏览方式 -->
		<template v-else>
			<ItemGroupedView
				v-if="viewMode === 'item'"
				:fragments="fragments"
				:task="currentTask"
				@update="handleFragmentUpdate"
			/>
			<FragmentList
				v-else
				:fragments="fragments"
				:doc-id="currentTask?.docId"
				:kid="currentTask?.kid"
				@update="handleFragmentUpdate"
			/>
		</template>
		</n-spin>
	</div>

		<template #footer>
			<n-space justify="end">
				<n-button @click="handleClose">关闭</n-button>
				<n-button 
					v-if="hasUserModifications"
					secondary
					@click="handleRestoreOriginal"
				>
					恢复原始识别结果
				</n-button>
				<n-button type="primary" @click="handleConfirm" :loading="confirming">
					继续
				</n-button>
			</n-space>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { NModal, NCard, NSpace, NStatistic, NCollapse, NCollapseItem, NTag, NButton, NRadioGroup, NRadioButton, NSpin, useMessage, useDialog } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { getAttachProcessStatus, confirmMatching, saveDraft, getFragmentBatch, getfragmentList } from '@/api/knowledge'
import type { UploadTask } from '@/store/modules/upload/helper'
import type { MatchingDecision, FragmentBatchQuery } from '@/api/knowledge'
import FragmentList from './FragmentList.vue'
import ItemGroupedView from './ItemGroupedView.vue'

interface Props {
	show: boolean
	task?: UploadTask | null
	tasks?: UploadTask[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
	'update:show': [value: boolean]
	confirmed: []
}>()

const message = useMessage()
const dialog = useDialog()
const showModal = computed({
	get: () => props.show,
	set: (val) => emit('update:show', val)
})

const isBatch = computed(() => props.tasks && props.tasks.length > 0)
const currentTask = computed(() => props.task)
const confirming = ref(false)
const viewMode = ref<'fragment' | 'item'>('fragment')

const fragments = ref<any[]>([])
const documentGroups = ref<any[]>([])
const expandedDocIds = ref<string[]>([])
const loading = ref(false)

const totalCount = computed(() => {
	if (isBatch.value) {
		return documentGroups.value.reduce((sum, group) => sum + group.fragments.length, 0)
	}
	return fragments.value.length
})

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

async function loadData() {
	if (isBatch.value) {
		await loadBatchData()
	} else {
		await loadSingleData()
	}
}

async function loadSingleData() {
	if (!currentTask.value?.processId) {
		message.error('缺少处理任务ID')
		return
	}

	if (!currentTask.value?.docId) {
		message.error('缺少文档ID')
		return
	}

	loading.value = true
	try {
		const response = await getAttachProcessStatus(currentTask.value.processId, false)
		if (response.code === 200 && response.data) {
			const statusData = JSON.parse(response.data.statusData || '{}')
			const matchingResults = statusData.matchingResults || []

			//批量查询片段内容
			const queries: FragmentBatchQuery[] = matchingResults.map((mr: any) => ({
				docId: currentTask.value!.docId!,
				idx: mr.chunkIndex,
			}))

			if (queries.length > 0) {
				const fragmentResponse = await getFragmentBatch(queries)
				if (fragmentResponse.code === 200 && fragmentResponse.data) {
					const fragmentMap = new Map(fragmentResponse.data.map((f: any) => [Number(f.idx), f]))
					
					const loadedFragments = matchingResults.map((mr: any) => {
						const foundFragment = fragmentMap.get(Number(mr.chunkIndex))
						const content = foundFragment?.content || ''
						return {
							...mr,
							content: content,
						}
					})
					
					fragments.value = loadedFragments
					originalFragments.value = JSON.parse(JSON.stringify(loadedFragments))
				}
			}
		}
	} catch (error: any) {
		message.error('加载数据失败: ' + (error.message || '未知错误'))
	} finally {
		loading.value = false
	}
}

async function loadBatchData() {
	if (!props.tasks || props.tasks.length === 0) return

	loading.value = true
	try {
		const groups: any[] = []
		
		for (const task of props.tasks) {
			if (!task.processId || !task.docId) continue
			
			try {
				const response = await getAttachProcessStatus(task.processId, false)
				if (response.code === 200 && response.data) {
					const statusData = JSON.parse(response.data.statusData || '{}')
					const matchingResults = statusData.matchingResults || []

					//批量查询片段内容
					const queries: FragmentBatchQuery[] = matchingResults.map((mr: any) => ({
						docId: task.docId!,
						idx: mr.chunkIndex,
					}))

					let loadedFragments: any[] = []
					if (queries.length > 0) {
						const fragmentResponse = await getFragmentBatch(queries)
						if (fragmentResponse.code === 200 && fragmentResponse.data) {
							const fragmentMap = new Map(fragmentResponse.data.map((f: any) => [Number(f.idx), f]))
							
							loadedFragments = matchingResults.map((mr: any) => {
								const foundFragment = fragmentMap.get(Number(mr.chunkIndex))
								const content = foundFragment?.content || ''
								return {
									...mr,
									content: content,
								}
							})
						}
					}

					groups.push({
						docId: task.docId,
						fileName: task.fileName,
						kid: task.kid,
						processId: task.processId,
						fragments: loadedFragments,
					})
				}
			} catch (error: any) {
				//单个文档加载失败不影响其他文档
			}
		}
		
		documentGroups.value = groups
		expandedDocIds.value = groups.map(g => g.docId)
	} catch (error: any) {
		message.error('加载批量数据失败: ' + (error.message || '未知错误'))
	} finally {
		loading.value = false
	}
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let hasUnsavedChanges = ref(false)
const originalFragments = ref<any[]>([])

function debouncedSave(processId: string, partialData: Record<string, any>) {
	if (saveTimer) {
		clearTimeout(saveTimer)
	}
		saveTimer = setTimeout(() => {
			saveDraft(processId, partialData).catch(err => {
				message.error('保存草稿失败: ' + (err.message || '未知错误'))
			})
			hasUnsavedChanges.value = false
		}, 500)
}

function handleFragmentUpdate(fragment: any) {
	hasUnsavedChanges.value = true
	
	if (isBatch.value) {
		//批量模式：更新对应文档组中的片段
		for (const group of documentGroups.value) {
			const index = group.fragments.findIndex((f: any) => f.chunkIndex === fragment.chunkIndex)
			if (index !== -1) {
				group.fragments[index] = { ...group.fragments[index], ...fragment }
				
				if (group.processId) {
					const partialData = {
						matchingResults: group.fragments
					}
					debouncedSave(group.processId, partialData)
				}
				break
			}
		}
	} else {
		//单个文档模式：更新主片段列表（两个视图共享同一数据源）
		const index = fragments.value.findIndex(f => f.chunkIndex === fragment.chunkIndex)
		if (index !== -1) {
			fragments.value[index] = { ...fragments.value[index], ...fragment }
		}
		if (currentTask.value?.processId) {
			const partialData = {
				matchingResults: fragments.value
			}
			debouncedSave(currentTask.value.processId, partialData)
		}
	}
}

function finalSave() {
	if (hasUnsavedChanges.value && saveTimer) {
		clearTimeout(saveTimer)
		saveTimer = null
		
		if (isBatch.value) {
			//批量模式：保存所有文档组
			documentGroups.value.forEach(group => {
				if (group.processId) {
					const partialData = {
						matchingResults: group.fragments
					}
					saveDraft(group.processId, partialData).catch(() => {})
				}
			})
		} else if (currentTask.value?.processId) {
			//单个文档模式
			const partialData = {
				matchingResults: fragments.value
			}
			saveDraft(currentTask.value.processId, partialData).catch(() => {})
		}
		
		hasUnsavedChanges.value = false
	}
}

async function handleConfirm() {
	confirming.value = true
	try {
		if (isBatch.value) {
			//批量模式：确认所有文档的匹配结果
			const confirmPromises = documentGroups.value.map(async (group) => {
				if (!group.processId) return
				const decisions: MatchingDecision[] = group.fragments.map((f: any) => ({
					chunkIndex: f.chunkIndex,
					fid: f.fid,
					decision: f.userDecision || (f.matchedItemUuid ? 'keep' : 'create_new'),
					selectedItemUuid: f.userSelectedItemUuid || f.matchedItemUuid,
				}))
				return confirmMatching(group.processId, decisions)
			})
			
			const results = await Promise.all(confirmPromises)
			const allSuccess = results.every(r => r.code === 200)
			
			if (allSuccess) {
				message.success('批量确认成功')
				emit('confirmed')
				showModal.value = false
			} else {
				message.error('部分文档确认失败')
			}
		} else {
			//单个文档模式
			if (!currentTask.value?.processId) {
				message.error('缺少处理任务ID')
				return
			}

			const decisions: MatchingDecision[] = fragments.value.map(f => ({
				chunkIndex: f.chunkIndex,
				fid: f.fid,
				decision: f.userDecision || (f.matchedItemUuid ? 'keep' : 'create_new'),
				selectedItemUuid: f.userSelectedItemUuid || f.matchedItemUuid,
			}))

			const response = await confirmMatching(currentTask.value.processId, decisions)
			if (response.code === 200) {
				message.success('确认成功')
				emit('confirmed')
				showModal.value = false
			} else {
				message.error(response.msg || '确认失败')
			}
		}
	} catch (error: any) {
		message.error('确认失败: ' + (error.message || '未知错误'))
	} finally {
		confirming.value = false
	}
}

const hasUserModifications = computed(() => {
	if (originalFragments.value.length === 0) return false
	if (fragments.value.length !== originalFragments.value.length) return true
	
		return fragments.value.some((f, index) => {
		const original = originalFragments.value[index]
		if (!original) return true
		return f.matchedItemUuid !== original.matchedItemUuid ||
		       f.userDecision !== original.userDecision ||
		       f.userSelectedItemUuid !== original.userSelectedItemUuid
	})
})

function handleClose() {
	finalSave()
	showModal.value = false
}

async function handleRestoreOriginal() {
	if (!currentTask.value?.processId) return
	
	dialog.warning({
		title: '确认恢复',
		content: '确定要恢复到系统原始识别的匹配结果吗？这将撤销您的所有修改。',
		positiveText: '确定',
		negativeText: '取消',
		onPositiveClick: async () => {
			try {
				if (originalFragments.value.length > 0) {
					fragments.value = JSON.parse(JSON.stringify(originalFragments.value))
					hasUnsavedChanges.value = true
					
					if (currentTask.value?.processId) {
						const partialData = {
							matchingResults: fragments.value
						}
						await saveDraft(currentTask.value.processId, partialData)
						hasUnsavedChanges.value = false
						message.success('已恢复到原始识别结果')
					}
				} else {
					await loadData()
					message.success('已恢复到原始识别结果')
				}
			} catch (error: any) {
				message.error('恢复失败: ' + (error.message || '未知错误'))
			}
		}
	})
}

watch(() => props.show, (newVal) => {
	if (newVal) {
		if (isBatch.value && props.tasks && props.tasks.length > 0) {
			loadData()
		} else if (currentTask.value) {
			loadData()
		}
		hasUnsavedChanges.value = false
		originalFragments.value = []
		documentGroups.value = []
	} else {
		finalSave()
		if (saveTimer) {
			clearTimeout(saveTimer)
			saveTimer = null
		}
	}
})

onBeforeUnmount(() => {
	finalSave()
	if (saveTimer) {
		clearTimeout(saveTimer)
	}
})

window.addEventListener('beforeunload', () => {
	finalSave()
})
</script>

<style scoped>
.matching-review-container {
	max-height: calc(90vh - 200px);
	overflow-y: auto;
}

.batch-documents {
	margin-top: 16px;
}
</style>

<template>
	<n-modal
		v-model:show="showModal"
		preset="card"
		:title="isBatch ? `批量审阅新条目 - ${selectedTasks.length}个文档` : `审阅新条目 - ${currentTask?.fileName}`"
		:mask-closable="true"
		:close-on-esc="true"
		style="width: 1400px; max-width: 95vw; max-height: 90vh;"
		:show-footer="true"
	>
		<template #header-extra>
			<n-space>
				<n-statistic label="总条目数" :value="totalCount" />
			</n-space>
		</template>

		<div class="items-review-container">
			<!-- 文档信息卡片（单个文档模式） -->
			<n-card v-if="!isBatch && currentTask" size="small" style="margin-bottom: 16px;">
				<n-space>
					<SvgIcon icon="ri:file-line" :style="{ fontSize: '20px' }" />
					<div>
						<div style="font-weight: 500;">{{ currentTask.fileName }}</div>
						<div style="font-size: 12px; color: #666;">
							文件大小：{{ formatFileSize(currentTask.fileSize) }} · 
							文档ID：{{ currentTask.docId }} · 
							条目数量：{{ totalCount }}个
						</div>
					</div>
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
									{{ docGroup.fileName }} ({{ docGroup.items.length }}个条目)
								</span>
							</n-space>
						</template>
						<ItemList
							:items="docGroup.items"
							:is-batch="true"
							:duplicate-item-uuids="duplicateItemUuids"
							@select="handleItemSelect"
							@update="handleItemUpdate"
							@view-fragment="handleViewFragment"
						/>
					</n-collapse-item>
				</n-collapse>
			</div>

			<!-- 单个文档模式：条目列表 -->
			<ItemList
				v-else
				:items="items"
				:is-batch="false"
				@select="handleItemSelect"
				@update="handleItemUpdate"
				@view-fragment="handleViewFragment"
				@delete-item="handleItemDelete"
				@batch-delete="handleBatchDelete"
				@batch-update="handleBatchUpdate"
			/>
		</div>

		<n-drawer
			v-model:show="showDetail"
			:width="600"
			placement="right"
			:mask-closable="true"
		>
			<template #header>
				<div class="detail-panel-header">
					<span class="detail-panel-title">条目详情</span>
				</div>
			</template>
			<div class="detail-panel-content">
				<div class="detail-panel-body">
					<ItemDetailPanel
						v-if="selectedItem"
						ref="itemDetailPanelRef"
						:item="selectedItem"
						:doc-id="getItemDocId(selectedItem)"
						@update="handleItemUpdate"
						@dirty="handleDetailDirty"
						@valid="handleDetailValid"
					/>
				</div>
				<div class="detail-panel-footer">
					<n-space justify="end" :size="12">
						<n-button @click="handleCloseDetail" secondary>
							关闭
						</n-button>
						<n-button 
							v-if="detailIsDirty"
							@click="handleRestoreDetail" 
							secondary
						>
							恢复
						</n-button>
						<n-button 
							v-if="detailIsDirty"
							type="primary" 
							@click="handleSaveDetail" 
							:disabled="!detailIsValid"
						>
							保存
						</n-button>
					</n-space>
				</div>
			</div>
		</n-drawer>

		<!-- 重名处理面板 -->
		<DuplicateResolutionPanel
			v-model:show="showDuplicatePanel"
			:duplicate-groups="duplicateGroups"
			:items="allItems"
			@update:items="handleItemsUpdate"
			@resolved="handleDuplicatesResolved"
		/>

		<!-- 片段信息模态框 -->
		<n-modal
			v-model:show="showFragmentModal"
			preset="card"
			title="原始片段信息"
			:mask-closable="true"
			:close-on-esc="true"
			style="width: 800px; max-width: 90vw; max-height: 85vh;"
		>
			<FragmentInfoPanel
				v-if="selectedFragmentItem"
				:item="selectedFragmentItem"
				:doc-id="getItemDocId(selectedFragmentItem)"
			/>
		</n-modal>

		<template #footer>
			<n-space justify="space-between" align="center" style="width: 100%;">
				<n-space>
					<n-button @click="handleClose">关闭</n-button>
					<n-button 
						v-if="hasUserModifications"
						secondary
						@click="handleRestoreOriginal"
					>
						恢复原结果
					</n-button>
				</n-space>
				<n-space>
					<n-button
						v-if="hasDuplicates"
						type="warning"
						@click="handleOpenDuplicatePanel"
					>
						<template #icon>
							<SvgIcon icon="ri:alert-line" />
						</template>
						发现 {{ duplicateGroups.length }} 个重名组，点此处理共 {{ totalDuplicateItems }} 个条目
					</n-button>
					<n-button 
						type="primary" 
						@click="handleConfirm" 
						:loading="confirming"
						:disabled="hasDuplicates"
					>
						继续
					</n-button>
				</n-space>
			</n-space>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { NModal, NCard, NSpace, NStatistic, NCollapse, NCollapseItem, NTag, NButton, NDrawer, useMessage, useDialog } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { getAttachProcessStatus, confirmItems, saveDraft, getAttachProcessStatusBatch } from '@/api/knowledge'
import { deleteKnowledgeItem } from '@/api/knowledgeItem'
import { getDictDataByType } from '@/api/dict'
import type { UploadTask } from '@/store/modules/upload/helper'
import type { ItemModification } from '@/api/knowledge'
import ItemList from './ItemList.vue'
import ItemDetailPanel from './ItemDetailPanel.vue'
import DuplicateResolutionPanel from './DuplicateResolutionPanel.vue'
import FragmentInfoPanel from './FragmentInfoPanel.vue'

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
const currentTask = computed(() => {
	if (isBatch.value && props.tasks && props.tasks.length > 0) {
		return props.tasks[0]
	}
	return props.task
})
const selectedTasks = computed(() => props.tasks || [])
const confirming = ref(false)

const items = ref<any[]>([])
const documentGroups = ref<any[]>([])
const expandedDocIds = ref<string[]>([])
const selectedItem = ref<any>(null)
const showDetail = ref(false)
const showDuplicatePanel = ref(false)
const duplicateGroups = ref<Array<{ title: string; items: any[]; count: number }>>([])
const selectedFragmentItem = ref<any>(null)
const showFragmentModal = ref(false)
const itemDetailPanelRef = ref<any>(null)
const detailIsDirty = ref(false)
const detailIsValid = ref(false)
const languageOptions = ref<any[]>([])
const severityOptions = ref<any[]>([])

const totalCount = computed(() => {
	if (isBatch.value) {
		return documentGroups.value.reduce((sum, group) => sum + group.items.length, 0)
	}
	return items.value.length
})

const allItems = computed(() => {
	if (isBatch.value) {
		return documentGroups.value.flatMap((group: any) => group.items || [])
	}
	return items.value
})

const totalDuplicateItems = computed(() => {
	return duplicateGroups.value.reduce((sum, group) => sum + group.items.length, 0)
})

const hasDuplicates = computed(() => {
	return duplicateGroups.value.length > 0
})

function detectDuplicates(items: any[]): Array<{ title: string; items: any[]; count: number }> {
	const titleMap = new Map<string, any[]>()
	
	items.forEach(item => {
		const normalizedTitle = (item.title || '').trim().toLowerCase()
		if (normalizedTitle) {
			if (!titleMap.has(normalizedTitle)) {
				titleMap.set(normalizedTitle, [])
			}
			titleMap.get(normalizedTitle)!.push(item)
		}
	})
	
	return Array.from(titleMap.entries())
		.filter(([_, items]) => items.length > 1)
		.map(([title, items]) => ({
			title: items[0].title || title,
			items: [...items],
			count: items.length
		}))
}

let duplicateDetectionTimer: ReturnType<typeof setTimeout> | null = null

function updateDuplicateDetection() {
	if (duplicateDetectionTimer) {
		clearTimeout(duplicateDetectionTimer)
	}
	duplicateDetectionTimer = setTimeout(() => {
		duplicateGroups.value = detectDuplicates(allItems.value)
	}, 300)
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let hasUnsavedChanges = ref(false)
const originalItems = ref<any[]>([])
const originalDocumentGroups = ref<any[]>([])

function parseCvssVector(cvssVector?: string): {
	av?: string
	ac?: string
	pr?: string
	ui?: string
	vc?: string
	vi?: string
	va?: string
} | null {
	if (!cvssVector) return null
	const result: any = {}
	const parts = cvssVector.split('/')
	parts.forEach(part => {
		const [key, value] = part.split(':')
		if (key && value) {
			result[key.toLowerCase()] = value
		}
	})
	return result
}

function extractCvssImpactFromVector(cvssVector?: string): string[] {
	if (!cvssVector) return []
	const parsed = parseCvssVector(cvssVector)
	if (!parsed) return []
	const impacts: string[] = []
	if (parsed.vc === 'H') impacts.push('C')
	if (parsed.vi === 'H') impacts.push('I')
	if (parsed.va === 'H') impacts.push('A')
	return impacts
}

function normalizeItemRiskImpact(item: any): any {
	let riskImpact = item.riskImpact
	if (!riskImpact || riskImpact.length === 0) {
		if (item.cvssVector) {
			riskImpact = extractCvssImpactFromVector(item.cvssVector)
		} else if (item.cvssImpact && item.cvssImpact.length > 0) {
			riskImpact = item.cvssImpact
		} else {
			riskImpact = []
		}
	}
	if (Array.isArray(riskImpact) && riskImpact.length > 0) {
		riskImpact = [...riskImpact].sort()
	}
	return {
		...item,
		riskImpact
	}
}

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

	try {
		const response = await getAttachProcessStatus(currentTask.value.processId, false)
		if (response.code === 200 && response.data) {
			const statusData = JSON.parse(response.data.statusData || '{}')
			const llmCreatedItems = statusData.llmCreatedItems || []
			const loadedItems = llmCreatedItems.map((item: any) => {
				return normalizeItemRiskImpact({
					...item.extractedData,
					itemUuid: item.itemUuid,
					chunkIndex: item.chunkIndex,
					fid: item.fid,
					confirmed: false,
					userModifications: item.userModifications || {},
				})
			})
			items.value = loadedItems
			originalItems.value = JSON.parse(JSON.stringify(loadedItems))
			console.log('[ItemsReview] loadSingleData 完成:', {
				加载条目数: loadedItems.length,
				originalItems长度: originalItems.value.length,
				hasUserModifications: hasUserModifications.value
			})
			updateDuplicateDetection()
		}
	} catch (error: any) {
		message.error('加载数据失败: ' + (error.message || '未知错误'))
	}
}

async function loadBatchData() {
	if (!selectedTasks.value.length) return

	try {
		const processIds = selectedTasks.value.map(t => t.processId).filter(Boolean) as string[]
		const response = await getAttachProcessStatusBatch(processIds)
		if (response.code === 200 && response.data) {
			const groups: any[] = []
			response.data.forEach((processData: any, index: number) => {
				const task = selectedTasks.value[index]
				const statusData = JSON.parse(processData.statusData || '{}')
				const llmCreatedItems = statusData.llmCreatedItems || []
				groups.push({
					docId: task.docId,
					fileName: task.fileName,
					processId: task.processId,
					items: llmCreatedItems.map((item: any) => {
						return normalizeItemRiskImpact({
							...item.extractedData,
							itemUuid: item.itemUuid,
							chunkIndex: item.chunkIndex,
							fid: item.fid,
							confirmed: false,
							userModifications: item.userModifications || {},
						})
					}),
				})
			})
			documentGroups.value = groups
			originalDocumentGroups.value = JSON.parse(JSON.stringify(groups))
			console.log('[ItemsReview] loadBatchData 完成:', {
				文档组数: groups.length,
				originalDocumentGroups长度: originalDocumentGroups.value.length,
				hasUserModifications: hasUserModifications.value
			})
			updateDuplicateDetection()
		}
	} catch (error: any) {
		message.error('加载数据失败: ' + (error.message || '未知错误'))
	}
}

function debouncedSave(processId: string, partialData: Record<string, any>) {
	if (saveTimer) {
		clearTimeout(saveTimer)
	}
	saveTimer = setTimeout(() => {
		saveDraft(processId, partialData).catch(err => {
			console.error('保存草稿失败:', err)
			message.error('保存草稿失败')
		})
		hasUnsavedChanges.value = false
	}, 500)
}

function handleItemSelect(item: any) {
	console.log('[ItemsReview] handleItemSelect 调用:', {
		itemUuid: item.itemUuid,
		itemTitle: item.title,
		当前hasUserModifications: hasUserModifications.value,
		items长度: items.value.length,
		originalItems长度: originalItems.value.length
	})
	if (!isBatch.value && items.value.length > 0 && originalItems.value.length > 0) {
		const currentItem = items.value.find(i => i.itemUuid === item.itemUuid)
		const originalItem = originalItems.value.find(i => i.itemUuid === item.itemUuid)
		if (currentItem && originalItem) {
			const currentCopy = { ...currentItem }
			const originalCopy = { ...originalItem }
			if (Array.isArray(currentCopy.riskImpact)) {
				currentCopy.riskImpact = [...currentCopy.riskImpact].sort()
			}
			if (Array.isArray(originalCopy.riskImpact)) {
				originalCopy.riskImpact = [...originalCopy.riskImpact].sort()
			}
			if (Array.isArray(currentCopy.cvssImpact)) {
				currentCopy.cvssImpact = [...currentCopy.cvssImpact].sort()
			}
			if (Array.isArray(originalCopy.cvssImpact)) {
				originalCopy.cvssImpact = [...originalCopy.cvssImpact].sort()
			}
			const currentStr = JSON.stringify(currentCopy)
			const originalStr = JSON.stringify(originalCopy)
			const isEqual = currentStr === originalStr
			console.log('[ItemsReview] handleItemSelect 条目比较:', {
				itemUuid: item.itemUuid,
				是否相等: isEqual,
				当前条目keys: Object.keys(currentItem),
				原始条目keys: Object.keys(originalItem),
				当前条目riskImpact: currentItem.riskImpact,
				原始条目riskImpact: originalItem.riskImpact
			})
			if (!isEqual) {
				const diffKeys: string[] = []
				Object.keys(currentCopy).forEach(key => {
					const currentVal = JSON.stringify(currentCopy[key])
					const originalVal = JSON.stringify(originalCopy[key])
					if (currentVal !== originalVal) {
						diffKeys.push(key)
						console.log('[ItemsReview] handleItemSelect 字段差异:', {
							字段: key,
							当前值: currentItem[key],
							原始值: originalItem[key]
						})
					}
				})
			}
		}
	}
	selectedItem.value = item
	showDetail.value = true
	detailIsDirty.value = false
	detailIsValid.value = false
	console.log('[ItemsReview] handleItemSelect 完成后:', {
		hasUserModifications: hasUserModifications.value
	})
}

function handleItemUpdate(item: any) {
	hasUnsavedChanges.value = true

	if (isBatch.value) {
		documentGroups.value.forEach(group => {
			const index = group.items.findIndex((i: any) => i.itemUuid === item.itemUuid)
			if (index !== -1) {
				group.items[index] = { ...group.items[index], ...item }
				if (group.processId) {
					const partialData = {
						llmCreatedItems: group.items.map((i: any) => ({
							itemUuid: i.itemUuid,
							chunkIndex: i.chunkIndex,
							fid: i.fid,
							extractedData: i,
							userModifications: i.userModifications || {},
						}))
					}
					debouncedSave(group.processId, partialData)
				}
			}
		})
	} else {
		const index = items.value.findIndex(i => i.itemUuid === item.itemUuid)
		if (index !== -1) {
			items.value[index] = { ...items.value[index], ...item }
			if (currentTask.value?.processId) {
				const partialData = {
					llmCreatedItems: items.value.map(i => ({
						itemUuid: i.itemUuid,
						chunkIndex: i.chunkIndex,
						fid: i.fid,
						extractedData: i,
						userModifications: i.userModifications || {},
					}))
				}
				debouncedSave(currentTask.value.processId, partialData)
			}
		}
	}
	
	updateDuplicateDetection()
}

function handleItemsUpdate(updatedItems: any[]) {
	if (isBatch.value) {
		const itemMap = new Map(updatedItems.map((item: any) => [item.itemUuid, item]))
		documentGroups.value.forEach(group => {
			group.items = group.items.map((item: any) => {
				const updated = itemMap.get(item.itemUuid)
				return updated ? { ...item, ...updated } : item
			})
			if (group.processId) {
				const partialData = {
					llmCreatedItems: group.items.map((i: any) => ({
						itemUuid: i.itemUuid,
						chunkIndex: i.chunkIndex,
						fid: i.fid,
						extractedData: i,
						userModifications: i.userModifications || {},
					}))
				}
				debouncedSave(group.processId, partialData)
			}
		})
	} else {
		items.value = updatedItems
		if (currentTask.value?.processId) {
			const partialData = {
				llmCreatedItems: items.value.map(i => ({
					itemUuid: i.itemUuid,
					chunkIndex: i.chunkIndex,
					fid: i.fid,
					extractedData: i,
					userModifications: i.userModifications || {},
				}))
			}
			debouncedSave(currentTask.value.processId, partialData)
		}
	}
	updateDuplicateDetection()
}

function handleDuplicatesResolved() {
	updateDuplicateDetection()
}

function getItemDocId(item: any): string | undefined {
	if (isBatch.value) {
		const group = documentGroups.value.find(g => 
			g.items.some((i: any) => i.itemUuid === item.itemUuid)
		)
		return group?.docId
	}
	return currentTask.value?.docId
}

function handleOpenDuplicatePanel() {
	showDuplicatePanel.value = true
}

function handleViewFragment(item: any) {
	selectedFragmentItem.value = item
	showFragmentModal.value = true
}

async function handleItemDelete(item: any) {
	dialog.warning({
		title: '确认删除',
		content: `确定要删除条目"${item.title || '(无标题)'}"吗？删除后该条目及其对应的知识片段将一并删除，且无法恢复。`,
		positiveText: '删除',
		negativeText: '取消',
		onPositiveClick: async () => {
			try {
				const response: any = await deleteKnowledgeItem(item.itemUuid)
				if (response.code === 200) {
					message.success('删除成功')
					
					if (isBatch.value) {
						documentGroups.value.forEach(group => {
							const index = group.items.findIndex((i: any) => i.itemUuid === item.itemUuid)
							if (index !== -1) {
								group.items.splice(index, 1)
							}
						})
						originalDocumentGroups.value.forEach(group => {
							const index = group.items.findIndex((i: any) => i.itemUuid === item.itemUuid)
							if (index !== -1) {
								group.items.splice(index, 1)
							}
						})
					} else {
						const index = items.value.findIndex((i: any) => i.itemUuid === item.itemUuid)
						if (index !== -1) {
							items.value.splice(index, 1)
						}
						const originalIndex = originalItems.value.findIndex((i: any) => i.itemUuid === item.itemUuid)
						if (originalIndex !== -1) {
							originalItems.value.splice(originalIndex, 1)
						}
					}
					
				if (showDetail.value && selectedItem.value?.itemUuid === item.itemUuid) {
					showDetail.value = false
					selectedItem.value = null
				}
					
					updateDuplicateDetection()
				} else {
					message.error(response.msg || '删除失败')
				}
			} catch (error: any) {
				const errorMsg = error?.responseData?.msg || 
								error?.message || 
								error?.msg || 
								error?.response?.data?.msg || 
								'删除失败'
				message.error(errorMsg)
			}
		}
	})
}

async function handleBatchDelete(itemUuids: string[]) {
	if (!itemUuids || itemUuids.length === 0) return
	
	const itemsToDelete = isBatch.value
		? documentGroups.value.flatMap(group => group.items.filter((item: any) => itemUuids.includes(item.itemUuid)))
		: items.value.filter(item => itemUuids.includes(item.itemUuid))
	
	let successCount = 0
	let failCount = 0
	
	for (const item of itemsToDelete) {
		try {
			const response: any = await deleteKnowledgeItem(item.itemUuid)
			if (response.code === 200) {
				successCount++
				
				if (isBatch.value) {
					documentGroups.value.forEach(group => {
						const index = group.items.findIndex((i: any) => i.itemUuid === item.itemUuid)
						if (index !== -1) {
							group.items.splice(index, 1)
						}
					})
					originalDocumentGroups.value.forEach(group => {
						const index = group.items.findIndex((i: any) => i.itemUuid === item.itemUuid)
						if (index !== -1) {
							group.items.splice(index, 1)
						}
					})
				} else {
					const index = items.value.findIndex((i: any) => i.itemUuid === item.itemUuid)
					if (index !== -1) {
						items.value.splice(index, 1)
					}
					const originalIndex = originalItems.value.findIndex((i: any) => i.itemUuid === item.itemUuid)
					if (originalIndex !== -1) {
						originalItems.value.splice(originalIndex, 1)
					}
				}
				
				if (showDetail.value && selectedItem.value?.itemUuid === item.itemUuid) {
					showDetail.value = false
					selectedItem.value = null
				}
			} else {
				failCount++
			}
		} catch (error: any) {
			failCount++
		}
	}
	
	if (successCount > 0) {
		message.success(`成功删除 ${successCount} 个条目`)
		updateDuplicateDetection()
	}
	if (failCount > 0) {
		message.error(`删除失败 ${failCount} 个条目`)
	}
}

async function loadDictOptions() {
	try {
		const [languagesRes, severitiesRes] = await Promise.all([
			getDictDataByType('knowledge_language'),
			getDictDataByType('knowledge_severity'),
		])
		
		languageOptions.value = ((languagesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
		}))
		
		severityOptions.value = ((severitiesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
		}))
	} catch (error) {
		console.error('加载字典选项失败:', error)
	}
}

async function handleBatchUpdate(updates: Array<{ itemUuid: string; field: string; value: any }>) {
	if (!updates || updates.length === 0) return
	
	if (languageOptions.value.length === 0 || severityOptions.value.length === 0) {
		await loadDictOptions()
	}
	
	const fieldMap = new Map<string, any>()
	updates.forEach(update => {
		if (!fieldMap.has(update.field)) {
			fieldMap.set(update.field, update.value)
		}
	})
	
	if (fieldMap.size !== 1) {
		message.error('批量修改只能同时修改一个字段')
		return
	}
	
	const [field, value] = Array.from(fieldMap.entries())[0]
	
	if (!field || value === undefined || value === null) {
		message.error('请选择要修改的值')
		return
	}
	
	const riskAttackVectorOptions = [
		{ label: '远程', value: 'N' },
		{ label: '本地', value: 'L' },
		{ label: '网络相邻', value: 'A' },
		{ label: '物理', value: 'P' },
	]
	const riskComplexityOptions = [
		{ label: '低', value: 'L' },
		{ label: '高', value: 'H' },
	]
	const riskPrivilegesOptions = [
		{ label: '无需权限', value: 'N' },
		{ label: '需要权限', value: 'L' },
		{ label: '高级权限', value: 'H' },
	]
	const riskUserInteractionOptions = [
		{ label: '无需交互', value: 'N' },
		{ label: '需要交互', value: 'R' },
	]
	
	if (field === 'language') {
		if (!languageOptions.value.some(opt => opt.value === value)) {
			message.error(`无效的语言值: ${value}`)
			return
		}
	} else if (field === 'severity') {
		if (!severityOptions.value.some(opt => opt.value === value)) {
			message.error(`无效的风险等级值: ${value}`)
			return
		}
	} else if (field === 'riskAttackVector') {
		if (!riskAttackVectorOptions.some(opt => opt.value === value)) {
			message.error(`无效的攻击方式值: ${value}`)
			return
		}
	} else if (field === 'riskComplexity') {
		if (!riskComplexityOptions.some(opt => opt.value === value)) {
			message.error(`无效的利用复杂度值: ${value}`)
			return
		}
	} else if (field === 'riskPrivileges') {
		if (!riskPrivilegesOptions.some(opt => opt.value === value)) {
			message.error(`无效的权限需求值: ${value}`)
			return
		}
	} else if (field === 'riskUserInteraction') {
		if (!riskUserInteractionOptions.some(opt => opt.value === value)) {
			message.error(`无效的用户交互值: ${value}`)
			return
		}
	} else {
		message.error(`不支持的字段: ${field}`)
		return
	}
	
	const itemsToUpdate = isBatch.value
		? documentGroups.value.flatMap(group => group.items.filter((item: any) => updates.some(u => u.itemUuid === item.itemUuid)))
		: items.value.filter(item => updates.some(u => u.itemUuid === item.itemUuid))
	
	const updatedItems: any[] = []
	
	function calculateCvssScoreForItem(item: any): { score: number | null; vector: string | undefined; severity: string | undefined } {
		const av = item.riskAttackVector || item.cvssAttackVector
		const ac = item.riskComplexity || item.cvssAttackComplexity
		const pr = item.riskPrivileges || item.cvssPrivilegesRequired
		const ui = item.riskUserInteraction || item.cvssUserInteraction
		const impact = item.riskImpact || item.cvssImpact || []
		
		const avScores: Record<string, number> = { 'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2 }
		const acScores: Record<string, number> = { 'L': 0.77, 'H': 0.44 }
		const prScores: Record<string, number> = { 'N': 0.85, 'L': 0.62, 'H': 0.27 }
		const uiScores: Record<string, number> = { 'N': 0.85, 'R': 0.62 }
		const impactScores: Record<string, number> = { 'C': 0.22, 'I': 0.22, 'A': 0.22 }
		
		const isComplete = av && ac && pr && ui && impact && impact.length > 0
		
		if (!isComplete) {
			return { score: null, vector: undefined, severity: undefined }
		}
		
		let baseScore = 0
		if (av) baseScore += avScores[av] || 0
		if (ac) baseScore += acScores[ac] || 0
		if (pr) baseScore += prScores[pr] || 0
		if (ui) baseScore += uiScores[ui] || 0
		
		let maxImpact = 0
		if (impact && impact.length > 0) {
			impact.forEach((imp: string) => {
				maxImpact = Math.max(maxImpact, impactScores[imp] || 0)
			})
			baseScore += maxImpact * 3
		}
		
		const score = Math.min(10, Math.max(0, baseScore * 1.08))
		const roundedScore = Math.round(score * 10) / 10
		
		const impactStr = [...impact].sort().join('')
		const vector = `CVSS:4.0/AV:${av}/AC:${ac}/PR:${pr}/UI:${ui}/VC:${impactStr}/VI:${impactStr}/VA:${impactStr}`
		
		let severity: string | undefined
		if (roundedScore >= 9.0) severity = 'critical'
		else if (roundedScore >= 7.0) severity = 'high'
		else if (roundedScore >= 4.0) severity = 'medium'
		else if (roundedScore >= 0.1) severity = 'low'
		else severity = 'none'
		
		return { score: roundedScore, vector, severity }
	}
	
	const cvssFields = ['riskAttackVector', 'riskComplexity', 'riskPrivileges', 'riskUserInteraction']
	const isCvssField = cvssFields.includes(field)
	
	for (const item of itemsToUpdate) {
		const updatedItem = { ...item }
		
		if (field === 'language') {
			updatedItem.language = value
		} else if (field === 'severity') {
			updatedItem.severity = value
		} else if (field === 'riskAttackVector') {
			updatedItem.riskAttackVector = value
		} else if (field === 'riskComplexity') {
			updatedItem.riskComplexity = value
		} else if (field === 'riskPrivileges') {
			updatedItem.riskPrivileges = value
		} else if (field === 'riskUserInteraction') {
			updatedItem.riskUserInteraction = value
		}
		
		if (isCvssField) {
			const cvssResult = calculateCvssScoreForItem(updatedItem)
			if (cvssResult.score !== null) {
				updatedItem.cvssScore = cvssResult.score
				updatedItem.cvssVector = cvssResult.vector
				if (cvssResult.severity) {
					updatedItem.severity = cvssResult.severity
				}
				updatedItem.cvssAttackVector = updatedItem.riskAttackVector
				updatedItem.cvssAttackComplexity = updatedItem.riskComplexity
				updatedItem.cvssPrivilegesRequired = updatedItem.riskPrivileges
				updatedItem.cvssUserInteraction = updatedItem.riskUserInteraction
				updatedItem.cvssImpact = updatedItem.riskImpact
			}
		}
		
		updatedItems.push(updatedItem)
	}
	
	for (const updatedItem of updatedItems) {
		if (isBatch.value) {
			documentGroups.value.forEach(group => {
				const index = group.items.findIndex((i: any) => i.itemUuid === updatedItem.itemUuid)
				if (index !== -1) {
					group.items[index] = { ...group.items[index], ...updatedItem }
				}
			})
		} else {
			const index = items.value.findIndex((i: any) => i.itemUuid === updatedItem.itemUuid)
			if (index !== -1) {
				items.value[index] = { ...items.value[index], ...updatedItem }
			}
		}
		
		handleItemUpdate(updatedItem)
	}
	
	if (showDetail.value && selectedItem.value && updatedItems.some(item => item.itemUuid === selectedItem.value?.itemUuid)) {
		const refreshedItemUuid = selectedItem.value.itemUuid
		const refreshedItem = isBatch.value
			? documentGroups.value.flatMap(group => group.items).find((item: any) => item.itemUuid === refreshedItemUuid)
			: items.value.find(item => item.itemUuid === refreshedItemUuid)
		
		if (refreshedItem) {
			selectedItem.value = null
			showDetail.value = false
			await nextTick()
			selectedItem.value = { ...refreshedItem }
			showDetail.value = true
		}
	}
	
	message.success(`成功更新 ${updatedItems.length} 个条目`)
	updateDuplicateDetection()
}

function handleDetailDirty(isDirty: boolean) {
	detailIsDirty.value = isDirty
}

function handleDetailValid(isValid: boolean) {
	detailIsValid.value = isValid
}

function handleCloseDetail() {
	if (detailIsDirty.value) {
		dialog.warning({
			title: '确认关闭',
			content: '您有未保存的更改，关闭将丢失这些更改。确定要关闭吗？',
			positiveText: '仍要关闭',
			negativeText: '取消',
			onPositiveClick: () => {
				detailIsDirty.value = false
				showDetail.value = false
			}
		})
	} else {
		showDetail.value = false
	}
}

async function handleSaveDetail() {
	if (itemDetailPanelRef.value?.save) {
		await itemDetailPanelRef.value.save()
		detailIsDirty.value = false
	}
}

function handleRestoreDetail() {
	if (itemDetailPanelRef.value?.restore) {
		itemDetailPanelRef.value.restore()
		detailIsDirty.value = false
	}
}

async function handleConfirm() {
	updateDuplicateDetection()
	if (hasDuplicates.value) {
		message.warning('请先处理所有重名条目')
		showDuplicatePanel.value = true
		return
	}
	
	if (isBatch.value) {
		await handleBatchConfirm()
	} else {
		await handleSingleConfirm()
	}
}

async function handleSingleConfirm() {
	if (!currentTask.value?.processId) {
		message.error('缺少处理任务ID')
		return
	}

	confirming.value = true
	try {
		const modifications: ItemModification[] = items.value.map(item => ({
			itemUuid: item.itemUuid,
			modifiedFields: {
				title: item.title,
				summary: item.summary,
				problemDescription: item.problemDescription,
				fixSolution: item.fixSolution,
				exampleCode: item.exampleCode,
				vulnerabilityType: item.vulnerabilityType,
				language: item.language,
				severity: item.severity,
				tags: item.tags,
			},
		}))

		const response = await confirmItems(currentTask.value.processId, modifications)
		if (response.code === 200) {
			message.success('确认成功')
			emit('confirmed')
			showModal.value = false
		} else {
			message.error(response.msg || '确认失败')
		}
	} catch (error: any) {
		message.error('确认失败: ' + (error.message || '未知错误'))
	} finally {
		confirming.value = false
	}
}

async function handleBatchConfirm() {
	const processIds = selectedTasks.value.map(t => t.processId).filter(Boolean) as string[]
	if (processIds.length === 0) {
		message.error('缺少处理任务ID')
		return
	}

	confirming.value = true
	try {
		const allModifications: Map<string, ItemModification[]> = new Map()
		
		documentGroups.value.forEach(group => {
			const modifications: ItemModification[] = group.items.map((item: any) => ({
				itemUuid: item.itemUuid,
				modifiedFields: {
					title: item.title,
					summary: item.summary,
					problemDescription: item.problemDescription,
					fixSolution: item.fixSolution,
					exampleCode: item.exampleCode,
					vulnerabilityType: item.vulnerabilityType,
					language: item.language,
					severity: item.severity,
					tags: item.tags,
				},
			}))
			if (group.processId) {
				allModifications.set(group.processId, modifications)
			}
		})

		await Promise.all(
			Array.from(allModifications.entries()).map(([processId, modifications]) =>
				confirmItems(processId, modifications)
			)
		)

		message.success('批量确认成功')
		emit('confirmed')
		showModal.value = false
	} catch (error: any) {
		message.error('批量确认失败: ' + (error.message || '未知错误'))
	} finally {
		confirming.value = false
	}
}

const hasUserModifications = computed(() => {
	if (isBatch.value) {
		if (originalDocumentGroups.value.length === 0) return false
		if (documentGroups.value.length !== originalDocumentGroups.value.length) {
			console.log('[ItemsReview] hasUserModifications 检测: 文档组数量不同')
			return true
		}
		
		const hasMod = documentGroups.value.some((group, groupIndex) => {
			const originalGroup = originalDocumentGroups.value[groupIndex]
			if (!originalGroup) return true
			if (group.items.length !== originalGroup.items.length) return true
			
			return group.items.some((item: any, itemIndex: number) => {
				const originalItem = originalGroup.items[itemIndex]
				if (!originalItem) return true
				const itemCopy = { ...item }
				const originalCopy = { ...originalItem }
				if (Array.isArray(itemCopy.riskImpact)) {
					itemCopy.riskImpact = [...itemCopy.riskImpact].sort()
				}
				if (Array.isArray(originalCopy.riskImpact)) {
					originalCopy.riskImpact = [...originalCopy.riskImpact].sort()
				}
				if (Array.isArray(itemCopy.cvssImpact)) {
					itemCopy.cvssImpact = [...itemCopy.cvssImpact].sort()
				}
				if (Array.isArray(originalCopy.cvssImpact)) {
					originalCopy.cvssImpact = [...originalCopy.cvssImpact].sort()
				}
				const isEqual = JSON.stringify(itemCopy) === JSON.stringify(originalCopy)
				if (!isEqual) {
					console.log('[ItemsReview] hasUserModifications 检测到差异 (批量模式):', {
						docId: group.docId,
						itemIndex,
						itemUuid: item.itemUuid,
						当前riskImpact: item.riskImpact,
						原始riskImpact: originalItem.riskImpact
					})
				}
				return !isEqual
			})
		})
		if (hasMod) {
			console.log('[ItemsReview] hasUserModifications = true (批量模式)')
		}
		return hasMod
	} else {
		if (originalItems.value.length === 0) return false
		if (items.value.length !== originalItems.value.length) {
			console.log('[ItemsReview] hasUserModifications 检测: 条目数量不同')
			return true
		}
		
		const hasMod = items.value.some((item, index) => {
			const original = originalItems.value[index]
			if (!original) return true
			const itemCopy = { ...item }
			const originalCopy = { ...original }
			if (Array.isArray(itemCopy.riskImpact)) {
				itemCopy.riskImpact = [...itemCopy.riskImpact].sort()
			}
			if (Array.isArray(originalCopy.riskImpact)) {
				originalCopy.riskImpact = [...originalCopy.riskImpact].sort()
			}
			if (Array.isArray(itemCopy.cvssImpact)) {
				itemCopy.cvssImpact = [...itemCopy.cvssImpact].sort()
			}
			if (Array.isArray(originalCopy.cvssImpact)) {
				originalCopy.cvssImpact = [...originalCopy.cvssImpact].sort()
			}
			const isEqual = JSON.stringify(itemCopy) === JSON.stringify(originalCopy)
			if (!isEqual) {
				console.log('[ItemsReview] hasUserModifications 检测到差异 (单文档模式):', {
					index,
					itemUuid: item.itemUuid,
					当前riskImpact: item.riskImpact,
					原始riskImpact: original.riskImpact,
					当前条目完整: item,
					原始条目完整: original
				})
			}
			return !isEqual
		})
		if (hasMod) {
			console.log('[ItemsReview] hasUserModifications = true (单文档模式)')
		}
		return hasMod
	}
})

function handleClose() {
	finalSave()
	showModal.value = false
}

async function handleRestoreOriginal() {
	if (!currentTask.value?.processId && !isBatch.value) return
	
	dialog.warning({
		title: '确认恢复',
		content: '确定要恢复到系统原始识别的条目结果吗？这将撤销您的所有修改。',
		positiveText: '确定',
		negativeText: '取消',
		onPositiveClick: async () => {
			try {
				if (isBatch.value) {
					if (originalDocumentGroups.value.length > 0) {
						documentGroups.value = JSON.parse(JSON.stringify(originalDocumentGroups.value))
						hasUnsavedChanges.value = true
						
						for (const group of documentGroups.value) {
							if (group.processId) {
								const partialData = {
									llmCreatedItems: group.items.map((i: any) => ({
										itemUuid: i.itemUuid,
										chunkIndex: i.chunkIndex,
										fid: i.fid,
										extractedData: i,
										userModifications: {},
									}))
								}
								await saveDraft(group.processId, partialData)
							}
						}
						hasUnsavedChanges.value = false
						message.success('已恢复到原始识别结果')
					} else {
						await loadData()
						message.success('已恢复到原始识别结果')
					}
				} else {
					if (originalItems.value.length > 0) {
						items.value = JSON.parse(JSON.stringify(originalItems.value))
						hasUnsavedChanges.value = true
						
						if (currentTask.value?.processId) {
							const partialData = {
								llmCreatedItems: items.value.map(i => ({
									itemUuid: i.itemUuid,
									chunkIndex: i.chunkIndex,
									fid: i.fid,
									extractedData: i,
									userModifications: {},
								}))
							}
							await saveDraft(currentTask.value.processId, partialData)
							hasUnsavedChanges.value = false
							updateDuplicateDetection()
							message.success('已恢复到原始识别结果')
						}
					} else {
						await loadData()
						message.success('已恢复到原始识别结果')
					}
				}
			} catch (error: any) {
				message.error('恢复失败: ' + (error.message || '未知错误'))
			}
		}
	})
}

function finalSave() {
	if (hasUnsavedChanges.value && saveTimer) {
		clearTimeout(saveTimer)
		saveTimer = null
		if (isBatch.value) {
			documentGroups.value.forEach(group => {
				if (group.processId) {
					const partialData = {
						llmCreatedItems: group.items.map((i: any) => ({
							itemUuid: i.itemUuid,
							chunkIndex: i.chunkIndex,
							fid: i.fid,
							extractedData: i,
							userModifications: i.userModifications || {},
						}))
					}
					saveDraft(group.processId, partialData).catch(() => {})
				}
			})
		} else if (currentTask.value?.processId) {
			const partialData = {
				llmCreatedItems: items.value.map(i => ({
					itemUuid: i.itemUuid,
					chunkIndex: i.chunkIndex,
					fid: i.fid,
					extractedData: i,
					userModifications: i.userModifications || {},
				}))
			}
			saveDraft(currentTask.value.processId, partialData).catch(() => {})
		}
		hasUnsavedChanges.value = false
	}
}

watch(() => props.show, async (newVal) => {
	if (newVal && currentTask.value) {
		await loadDictOptions()
		loadData()
		hasUnsavedChanges.value = false
		originalItems.value = []
		originalDocumentGroups.value = []
	} else {
		finalSave()
		if (saveTimer) {
			clearTimeout(saveTimer)
			saveTimer = null
		}
	}
})

watch([() => items.value, () => documentGroups.value], () => {
	updateDuplicateDetection()
}, { deep: true })

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
.items-review-container {
	max-height: calc(90vh - 200px);
	overflow-y: auto;
}

.batch-documents {
	margin-top: 16px;
}

.detail-panel-header {
	padding: 16px;
	border-bottom: 1px solid #EDEBE9;
}

.detail-panel-title {
	font-size: 16px;
	font-weight: 600;
	color: #323130;
}

.detail-panel-content {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.detail-panel-body {
	flex: 1;
	overflow-y: auto;
	padding: 0;
}

.detail-panel-footer {
	padding: 12px 16px;
	border-top: 1px solid #EDEBE9;
	background: #FAF9F8;
}
</style>

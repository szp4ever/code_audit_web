<template>
	<n-drawer
		v-model:show="showPanel"
		:width="Math.min(1400, windowWidth - 40)"
		placement="right"
		:mask-closable="false"
		@update:show="(val) => { if (!val) handleClose() }"
	>
		<n-drawer-content 
			style="height: 100%" 
			:body-content-style="{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }"
		>
			<template #header>
				<div class="panel-header">
					<n-space justify="space-between" align="center" style="width: 100%;">
						<div>
							<div style="font-size: 18px; font-weight: 600;">重名条目处理</div>
							<div v-if="localDuplicateGroups.length > 0" style="font-size: 12px; color: #666; margin-top: 4px;">
								{{ localDuplicateGroups.length }}个重名组，共{{ totalDuplicateItems }}个条目
							</div>
						</div>
						<div style="display: flex; align-items: center;">
							<n-space :size="8" align="center">
								<n-button 
									type="error" 
									size="small" 
									:disabled="selectedItems.length === 0"
									@click="handleDeleteSelectedItems"
								>
									删除已选
								</n-button>
								<n-tag v-if="resolvedCount > 0" type="success" size="small">
									已处理 {{ resolvedCount }}/{{ duplicateGroups.length }}
								</n-tag>
							</n-space>
						</div>
					</n-space>
				</div>
			</template>

			<div class="duplicate-panel-content">
			<div class="duplicate-panel-layout">
				<!-- 左侧：重名组列表 -->
				<div class="duplicate-groups-sidebar">
					<div class="sidebar-scroll-area">
						<n-scrollbar>
							<n-list hoverable>
								<n-list-item
									v-for="(group, index) in duplicateGroups"
									:key="index"
									:class="{ 'group-selected': selectedGroupIndex === index, 'group-resolved': getGroupDuplicateInfo(group).resolved }"
									@click="selectGroup(index)"
								>
									<n-thing>
										<template #header>
											<div class="group-header">
												<SvgIcon icon="ri:file-copy-line" class="group-icon" />
												<span class="group-title">{{ group.title || '(无标题)' }}</span>
											</div>
										</template>
										<template #description>
											<div class="group-meta">
												<span class="group-count">{{ group.items.length }} 个条目</span>
												<template v-if="getGroupDuplicateInfo(group).resolved">
													<n-tag type="success" size="small" style="margin-left: 8px;">
														已解决
													</n-tag>
												</template>
												<template v-else>
													<n-tag type="warning" size="small" style="margin-left: 8px;">
														{{ getGroupDuplicateInfo(group).count }} 个重名
													</n-tag>
												</template>
												<template v-if="getGroupTitleValidationInfo(group).hasEmptyTitle">
													<n-tag type="error" size="small" style="margin-left: 8px;">
														标题为空
													</n-tag>
												</template>
												<template v-if="getGroupTitleValidationInfo(group).hasTooLongTitle">
													<n-tag type="error" size="small" style="margin-left: 8px;">
														标题过长
													</n-tag>
												</template>
											</div>
										</template>
									</n-thing>
								</n-list-item>
							</n-list>
						</n-scrollbar>
					</div>
					<div class="sidebar-footer">
						<n-space vertical :size="8" style="width: 100%;">
							<n-button 
								type="primary" 
								size="small" 
								@click="handleComplete" 
								:disabled="hasActualDuplicates || hasInvalidTitles"
								style="width: 100%;"
							>
								<template #icon>
									<SvgIcon icon="ri:check-line" />
								</template>
								确认完成
							</n-button>
							<n-button quaternary size="small" @click="handleClose" style="width: 100%;">
								<template #icon>
									<SvgIcon icon="ri:close-line" />
								</template>
								关闭
							</n-button>
						</n-space>
					</div>
				</div>

				<!-- 右侧：对比视图 -->
				<div class="duplicate-comparison-area">
					<div v-if="selectedGroupIndex === null" class="empty-comparison">
						<n-empty description="请从左侧选择一个重名组进行对比处理" />
					</div>
					<div v-else-if="currentGroup" class="comparison-view">
						<div class="comparison-header">
							<h4 style="margin: 0;">对比处理：{{ currentGroup.title || '(无标题)' }}</h4>
						</div>

						<div class="comparison-items-grid" :style="{ gridTemplateColumns: `repeat(${Math.min(currentGroup.items.length, 4)}, 1fr)` }">
							<div
								v-for="(item, itemIndex) in currentGroup.items"
								:key="`${item.itemUuid}-${itemIndex}`"
								class="comparison-item-card"
								:class="{ 'item-selected': selectedItems.includes(item.itemUuid) }"
							>
								<div class="item-card-header">
									<n-checkbox
										:checked="selectedItems.includes(item.itemUuid)"
										@update:checked="(val) => toggleItemSelection(item.itemUuid, val)"
									/>
									<span class="item-index">条目 {{ itemIndex + 1 }}</span>
									<n-space style="margin-left: auto;">
										<n-button
											size="tiny"
											quaternary
											type="error"
											@click="handleDeleteItem(item.itemUuid)"
										>
											删除
										</n-button>
									</n-space>
								</div>

								<div class="item-card-content">
									<div class="item-field">
										<label class="field-label">标题</label>
										<n-input
											v-model:value="item.title"
											:maxlength="255"
											show-count
											placeholder="请输入标题"
											:status="validateTitle(item.title) ? 'error' : undefined"
											@update:value="handleTitleChange(item)"
										/>
										<div v-if="validateTitle(item.title)" class="field-error">
											{{ validateTitle(item.title)?.message }}
										</div>
									</div>

									<div class="item-field">
										<label class="field-label">摘要</label>
										<div class="field-preview">
											{{ item.summary ? (item.summary.length > 100 ? item.summary.substring(0, 100) + '...' : item.summary) : '(无)' }}
										</div>
									</div>

									<div class="item-field">
										<label class="field-label">漏洞类型</label>
										<div class="field-preview">
											<n-tag
												v-for="cweId in (item.vulnerabilityTypes || []).slice(0, 2)"
												:key="cweId"
												size="small"
												style="margin-right: 4px;"
											>
												{{ getCweDisplayName(cweId) }}
											</n-tag>
											<span v-if="(item.vulnerabilityTypes || []).length > 2" class="more-tags">
												+{{ (item.vulnerabilityTypes || []).length - 2 }}
											</span>
										</div>
									</div>

									<div class="item-field">
										<label class="field-label">语言</label>
										<div class="field-preview">
											{{ getLanguageLabel(item.language) || '(无)' }}
										</div>
									</div>

									<div class="item-actions">
										<n-button
											size="small"
											quaternary
											@click="handleViewDetail(item)"
										>
											<template #icon>
												<SvgIcon icon="ri:eye-line" />
											</template>
											查看详情
										</n-button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		</n-drawer-content>
	</n-drawer>

	<!-- 详情查看抽屉 -->
	<n-drawer
		v-model:show="showDetailDrawer"
		:width="600"
		placement="right"
		:mask-closable="true"
	>
		<template #header>
			<div class="detail-drawer-header">
				<span class="detail-drawer-title">条目详情</span>
			</div>
		</template>
		<div class="detail-drawer-content">
			<div class="detail-drawer-body">
				<ItemDetailPanel
					v-if="viewingItem"
					:item="viewingItem"
					@update="handleDetailUpdate"
				/>
			</div>
			<div class="detail-drawer-footer">
				<n-space justify="end" :size="12">
					<n-button @click="showDetailDrawer = false" secondary>
						关闭
					</n-button>
				</n-space>
			</div>
		</div>
	</n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { NDrawer, NDrawerContent, NList, NListItem, NThing, NScrollbar, NSpace, NTag, NButton, NCheckbox, NInput, NEmpty, NText, useMessage, useDialog } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import ItemDetailPanel from './ItemDetailPanel.vue'
import { getDictDataByType } from '@/api/dict'
import { getCweReferenceListAll } from '@/api/cwe'

interface DuplicateGroup {
	title: string
	items: any[]
	count: number
}

interface Props {
	show: boolean
	duplicateGroups: DuplicateGroup[]
	items: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
	'update:show': [value: boolean]
	'update:items': [items: any[]]
	'resolved': []
}>()

const localDuplicateGroups = ref<DuplicateGroup[]>([])
const localItems = ref<any[]>([])
const hasUnsavedChanges = ref(false)

const message = useMessage()
const dialog = useDialog()

const showPanel = computed({
	get: () => props.show,
	set: (val) => emit('update:show', val)
})

const selectedGroupIndex = ref<number | null>(null)
const selectedItems = ref<string[]>([])
const showDetailDrawer = ref(false)
const viewingItem = ref<any>(null)
const suggestionsGenerated = ref(false)
const windowWidth = ref(window.innerWidth)

onMounted(() => {
	window.addEventListener('resize', () => {
		windowWidth.value = window.innerWidth
	})
})

onUnmounted(() => {
	window.removeEventListener('resize', () => {
		windowWidth.value = window.innerWidth
	})
})

const languageOptions = ref<any[]>([])
const vulnerabilityTypeOptions = ref<any[]>([])

const currentGroup = computed(() => {
	if (selectedGroupIndex.value === null) return null
	return localDuplicateGroups.value[selectedGroupIndex.value] || null
})

const totalDuplicateItems = computed(() => {
	return localDuplicateGroups.value.reduce((sum, group) => sum + group.items.length, 0)
})

const resolvedCount = computed(() => {
	return localDuplicateGroups.value.filter(group => isGroupResolved(group)).length
})

const allDuplicatesResolved = computed(() => {
	return resolvedCount.value === localDuplicateGroups.value.length
})

function detectDuplicatesInLocalItems(items: any[]): Array<{ title: string; items: any[]; count: number }> {
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

const hasActualDuplicates = computed(() => {
	const currentDuplicates = detectDuplicatesInLocalItems(localItems.value)
	return currentDuplicates.length > 0
})

function isGroupResolved(group: DuplicateGroup): boolean {
	const titles = group.items.map(item => (item.title || '').trim().toLowerCase()).filter(Boolean)
	const uniqueTitles = new Set(titles)
	return uniqueTitles.size === group.items.length
}

function getGroupDuplicateInfo(group: DuplicateGroup): { count: number; resolved: boolean } {
	const groupItemUuids = new Set(group.items.map((item: any) => item.itemUuid))
	const groupLocalItemsMap = new Map(localItems.value.filter((item: any) => groupItemUuids.has(item.itemUuid)).map(item => [item.itemUuid, item]))
	
	const titleMap = new Map<string, any[]>()
	
	group.items.forEach((item: any) => {
		const localItem = groupLocalItemsMap.get(item.itemUuid)
		const itemToCheck = localItem || item
		const normalizedTitle = (itemToCheck.title || '').trim().toLowerCase()
		if (normalizedTitle) {
			if (!titleMap.has(normalizedTitle)) {
				titleMap.set(normalizedTitle, [])
			}
			titleMap.get(normalizedTitle)!.push(itemToCheck)
		}
	})
	
	let duplicateCount = 0
	titleMap.forEach((items) => {
		if (items.length > 1) {
			duplicateCount += items.length
		}
	})
	
	const validationInfo = getGroupTitleValidationInfo(group)
	const hasNoDuplicates = duplicateCount === 0
	const hasValidTitles = !validationInfo.hasInvalidTitle
	
	return {
		count: duplicateCount,
		resolved: hasNoDuplicates && hasValidTitles
	}
}

function getGroupTitleValidationInfo(group: DuplicateGroup): {
	hasEmptyTitle: boolean
	hasTooLongTitle: boolean
	hasInvalidTitle: boolean
} {
	const groupItemUuids = new Set(group.items.map((item: any) => item.itemUuid))
	const groupLocalItemsMap = new Map(localItems.value.filter((item: any) => groupItemUuids.has(item.itemUuid)).map(item => [item.itemUuid, item]))
	
	let hasEmptyTitle = false
	let hasTooLongTitle = false
	
	group.items.forEach((item: any) => {
		const localItem = groupLocalItemsMap.get(item.itemUuid)
		const itemToCheck = localItem || item
		const error = validateTitle(itemToCheck.title)
		if (error) {
			if (error.type === 'empty') {
				hasEmptyTitle = true
			} else if (error.type === 'too-long') {
				hasTooLongTitle = true
			}
		}
	})
	
	return {
		hasEmptyTitle,
		hasTooLongTitle,
		hasInvalidTitle: hasEmptyTitle || hasTooLongTitle
	}
}

function selectGroup(index: number) {
	selectedGroupIndex.value = index
	selectedItems.value = []
}

function toggleItemSelection(itemUuid: string, checked: boolean) {
	if (checked) {
		if (!selectedItems.value.includes(itemUuid)) {
			selectedItems.value.push(itemUuid)
		}
	} else {
		selectedItems.value = selectedItems.value.filter(id => id !== itemUuid)
	}
}

type TitleValidationError = {
	type: 'empty' | 'too-long' | 'invalid-chars'
	message: string
} | null

function validateTitle(title: string | undefined | null): TitleValidationError {
	if (!title || !title.trim()) {
		return { type: 'empty', message: '标题不能为空' }
	}
	const trimmed = title.trim()
	if (trimmed.length < 1) {
		return { type: 'empty', message: '标题不能为空' }
	}
	if (trimmed.length > 255) {
		return { type: 'too-long', message: '标题长度不能超过255个字符' }
	}
	return null
}

function getItemTitleError(item: any): TitleValidationError {
	return validateTitle(item.title)
}

function handleTitleChange(item: any) {
	const localIndex = localItems.value.findIndex((i: any) => i.itemUuid === item.itemUuid)
	if (localIndex !== -1) {
		localItems.value[localIndex] = { ...localItems.value[localIndex], ...item }
	}
	
	const group = currentGroup.value
	if (group) {
		const groupItemIndex = group.items.findIndex((i: any) => i.itemUuid === item.itemUuid)
		if (groupItemIndex !== -1) {
			group.items[groupItemIndex] = { ...group.items[groupItemIndex], ...item }
			group.title = group.items[0].title || group.title
		}
	}
	
	hasUnsavedChanges.value = true
}

function deleteItemInternal(itemUuid: string) {
	const group = currentGroup.value
	if (!group) return false
	
	const itemIndex = group.items.findIndex((item: any) => item.itemUuid === itemUuid)
	if (itemIndex === -1) return false
	
	const localIndex = localItems.value.findIndex((item: any) => item.itemUuid === itemUuid)
	if (localIndex !== -1) {
		localItems.value.splice(localIndex, 1)
	}
	
	group.items.splice(itemIndex, 1)
	group.count = group.items.length
	
	if (group.items.length <= 1) {
		const groupIndex = localDuplicateGroups.value.findIndex(g => g === group)
		if (groupIndex !== -1) {
			localDuplicateGroups.value.splice(groupIndex, 1)
			if (selectedGroupIndex.value === groupIndex) {
				selectedGroupIndex.value = null
			} else if (selectedGroupIndex.value !== null && selectedGroupIndex.value > groupIndex) {
				selectedGroupIndex.value--
			}
		}
	}
	
	selectedItems.value = selectedItems.value.filter(id => id !== itemUuid)
	return true
}

function handleDeleteItem(itemUuid: string) {
	dialog.warning({
		title: '确认删除',
		content: '确定要删除此条目吗？删除后无法恢复。',
		positiveText: '删除',
		negativeText: '取消',
		onPositiveClick: () => {
			if (deleteItemInternal(itemUuid)) {
				hasUnsavedChanges.value = true
				message.success('条目已标记删除，请点击"应用更改"生效')
			}
		}
	})
}

function handleDeleteSelectedItems() {
	if (selectedItems.value.length === 0) {
		message.warning('请先选择要删除的条目')
		return
	}
	
	const count = selectedItems.value.length
	dialog.warning({
		title: '确认删除',
		content: `确定要删除已选的 ${count} 个条目吗？删除后无法恢复。`,
		positiveText: '删除',
		negativeText: '取消',
		onPositiveClick: () => {
			const itemsToDelete = [...selectedItems.value]
			let deletedCount = 0
			
			itemsToDelete.forEach(itemUuid => {
				if (deleteItemInternal(itemUuid)) {
					deletedCount++
				}
			})
			
			if (deletedCount > 0) {
				hasUnsavedChanges.value = true
				message.success(`已标记删除 ${deletedCount} 个条目，请点击"应用更改"生效`)
			}
		}
	})
}

function handleViewDetail(item: any) {
	viewingItem.value = { ...item }
	showDetailDrawer.value = true
}

function handleDetailUpdate(updatedItem: any) {
	const localIndex = localItems.value.findIndex((item: any) => item.itemUuid === updatedItem.itemUuid)
	if (localIndex !== -1) {
		localItems.value[localIndex] = { ...localItems.value[localIndex], ...updatedItem }
	}
	
	const group = currentGroup.value
	if (group) {
		const groupItemIndex = group.items.findIndex((i: any) => i.itemUuid === updatedItem.itemUuid)
		if (groupItemIndex !== -1) {
			group.items[groupItemIndex] = { ...group.items[groupItemIndex], ...updatedItem }
		}
	}
	
	if (viewingItem.value && viewingItem.value.itemUuid === updatedItem.itemUuid) {
		viewingItem.value = { ...viewingItem.value, ...updatedItem }
	}
	
	hasUnsavedChanges.value = true
}

function getLanguageLabel(language?: string): string {
	if (!language) return ''
	const option = languageOptions.value.find((opt: any) => opt.value === language)
	return option ? option.label : language
}

function getCweDisplayName(cweId: string): string {
	const option = vulnerabilityTypeOptions.value.find((opt: any) => opt.value === cweId)
	return option ? option.label : cweId
}

function handleClose() {
	if (hasUnsavedChanges.value) {
		dialog.warning({
			title: '确认关闭重名处理面板',
			content: '您有未应用的更改，关闭面板将丢失这些更改。确定要关闭吗？',
			positiveText: '仍要关闭',
			negativeText: '继续处理',
			onPositiveClick: () => {
				hasUnsavedChanges.value = false
				showPanel.value = false
			}
		})
	} else if (localDuplicateGroups.value.length > 0) {
		dialog.warning({
			title: '确认关闭重名处理面板',
			content: '还有未处理的重名条目，关闭后"确认并继续"按钮将保持禁用状态。确定要关闭吗？',
			positiveText: '仍要关闭',
			negativeText: '继续处理',
			onPositiveClick: () => {
				showPanel.value = false
			}
		})
	} else {
		showPanel.value = false
	}
}

function validateAllItems(): boolean {
	for (const item of localItems.value) {
		const titleError = validateTitle(item.title)
		if (titleError) {
			message.error(`条目"${item.title || '(无标题)'}"的标题验证失败：${titleError.message}`)
			return false
		}
	}
	return true
}

const hasInvalidTitles = computed(() => {
	const allItemsMap = new Map<string, any>()
	localDuplicateGroups.value.forEach(group => {
		group.items.forEach((item: any) => {
			if (!allItemsMap.has(item.itemUuid)) {
				allItemsMap.set(item.itemUuid, item)
			}
		})
	})
	localItems.value.forEach(item => {
		allItemsMap.set(item.itemUuid, item)
	})
	
	return Array.from(allItemsMap.values()).some(item => {
		const error = validateTitle(item.title)
		return error !== null
	})
})

function handleApplyChanges() {
	if (!hasUnsavedChanges.value) {
		message.info('没有未应用的更改')
		return
	}
	
	if (!validateAllItems()) {
		return
	}
	
	emit('update:items', [...localItems.value])
	hasUnsavedChanges.value = false
	message.success('更改已应用，正在重新检测重名状态...')
	
	setTimeout(() => {
		emit('resolved')
	}, 300)
}

async function handleComplete() {
	if (hasInvalidTitles.value) {
		message.error('存在标题格式错误，请先修正所有标题')
		return
	}
	
	if (hasUnsavedChanges.value) {
		if (!validateAllItems()) {
			return
		}
		const appliedItems = [...localItems.value]
		emit('update:items', appliedItems)
		hasUnsavedChanges.value = false
		message.success('更改已应用，正在重新检测重名状态...')
		
		emit('resolved')
		
		await new Promise(resolve => setTimeout(resolve, 800))
		
		const currentDuplicates = detectDuplicatesInLocalItems(localItems.value)
		if (currentDuplicates.length === 0) {
			showPanel.value = false
			message.success('所有重名条目已处理完成')
		} else {
			message.warning('应用更改后仍有重名条目，请继续处理')
		}
		return
	}
	
	const currentDuplicates = detectDuplicatesInLocalItems(localItems.value)
	if (currentDuplicates.length > 0) {
		message.warning('请先处理所有重名条目')
		return
	}
	
	emit('resolved')
	showPanel.value = false
	message.success('所有重名条目已处理完成')
}

async function loadOptions() {
	try {
		const [languagesRes, cweRes] = await Promise.all([
			getDictDataByType('knowledge_language'),
			getCweReferenceListAll()
		])

		languageOptions.value = ((languagesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
		}))

		vulnerabilityTypeOptions.value = ((cweRes as any)?.data || []).map((cwe: any) => ({
			label: `${cwe.cweId}: ${cwe.nameZh || cwe.nameEn || cwe.cweId}`,
			value: cwe.cweId,
		}))
	} catch (error) {
		console.error('加载选项数据失败:', error)
	}
}

watch(() => props.show, (newVal) => {
	if (newVal) {
		localDuplicateGroups.value = JSON.parse(JSON.stringify(props.duplicateGroups))
		localItems.value = JSON.parse(JSON.stringify(props.items))
		selectedGroupIndex.value = localDuplicateGroups.value.length > 0 ? 0 : null
		selectedItems.value = []
		hasUnsavedChanges.value = false
		loadOptions()
	}
})

watch(() => props.duplicateGroups, (newGroups) => {
	if (props.show) {
		const oldSelectedGroup = selectedGroupIndex.value !== null ? localDuplicateGroups.value[selectedGroupIndex.value] : null
		localDuplicateGroups.value = JSON.parse(JSON.stringify(newGroups))
		
		if (oldSelectedGroup && selectedGroupIndex.value !== null) {
			const newIndex = localDuplicateGroups.value.findIndex(g => 
				g.title.toLowerCase() === oldSelectedGroup.title.toLowerCase()
			)
			if (newIndex !== -1) {
				selectedGroupIndex.value = newIndex
			} else if (selectedGroupIndex.value >= localDuplicateGroups.value.length) {
				selectedGroupIndex.value = localDuplicateGroups.value.length > 0 ? 0 : null
			}
		} else if (selectedGroupIndex.value !== null && selectedGroupIndex.value >= localDuplicateGroups.value.length) {
			selectedGroupIndex.value = localDuplicateGroups.value.length > 0 ? 0 : null
		}
	}
}, { deep: true })


watch(() => props.items, () => {
	if (props.show && currentGroup.value) {
		const group = currentGroup.value
		group.items.forEach((groupItem: any) => {
			const updatedItem = props.items.find((item: any) => item.itemUuid === groupItem.itemUuid)
			if (updatedItem) {
				Object.assign(groupItem, updatedItem)
			}
		})
		group.title = group.items[0]?.title || group.title
	}
}, { deep: true })
</script>

<style scoped>
.duplicate-panel-header {
	padding: 8px 0;
}

.duplicate-count-text {
	font-size: 12px;
	color: #666;
	margin-left: 8px;
}

.panel-header {
	padding: 0;
	width: 100%;
	display: flex;
	align-items: center;
	min-height: 60px;
}

:deep(.n-drawer-body-content-wrapper) {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

:deep(.n-drawer-body) {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

:deep(.n-drawer-body-content) {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.duplicate-panel-content {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	height: 100%;
}

.duplicate-panel-layout {
	display: flex;
	height: 100%;
	gap: 16px;
}

.duplicate-groups-sidebar {
	width: 300px;
	border-right: 1px solid #e0e0e0;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	position: relative;
}

.sidebar-scroll-area {
	flex: 1 1 auto;
	min-height: 0;
	overflow: hidden;
	position: relative;
}

.sidebar-scroll-area :deep(.n-scrollbar) {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.sidebar-scroll-area :deep(.n-scrollbar-container) {
	flex: 1;
	overflow-y: auto;
}

.sidebar-footer {
	padding: 12px;
	border-top: 1px solid #e0e0e0;
	flex-shrink: 0;
	flex-grow: 0;
	background: #fff;
	position: relative;
	z-index: 1;
}

.group-selected {
	background-color: #f0f7ff;
	border-left: 3px solid #1890ff;
}

.group-resolved {
	opacity: 0.7;
}

.group-header {
	display: flex;
	align-items: center;
	gap: 8px;
}

.group-icon {
	font-size: 16px;
	color: #fa8c16;
}

.group-title {
	font-weight: 500;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.group-meta {
	display: flex;
	align-items: center;
	font-size: 12px;
	color: #666;
}

.group-count {
	margin-right: 8px;
}

.duplicate-comparison-area {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.empty-comparison {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
}

.comparison-header {
	padding: 12px 0;
	border-bottom: 1px solid #e0e0e0;
	margin-bottom: 16px;
}

.comparison-items-grid {
	display: grid;
	gap: 16px;
	overflow-x: auto;
	padding-bottom: 16px;
}

.comparison-item-card {
	border: 1px solid #e0e0e0;
	border-radius: 4px;
	padding: 12px;
	background: #fff;
	min-width: 280px;
	transition: all 0.2s;
}

.comparison-item-card:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.item-selected {
	border-color: #1890ff;
	background-color: #f0f7ff;
}

.item-card-header {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid #f0f0f0;
}

.item-index {
	font-weight: 500;
	font-size: 13px;
	color: #333;
}

.item-card-content {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.item-field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.field-label {
	font-size: 12px;
	font-weight: 500;
	color: #666;
}

.field-preview {
	font-size: 13px;
	color: #333;
	line-height: 1.5;
	min-height: 20px;
}

.more-tags {
	font-size: 12px;
	color: #999;
}

.item-actions {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid #f0f0f0;
}

.footer-hint {
	font-size: 12px;
}

.field-error {
	font-size: 12px;
	color: #d03050;
	margin-top: 4px;
}

.detail-drawer-header {
	padding: 16px;
	border-bottom: 1px solid #EDEBE9;
}

.detail-drawer-title {
	font-size: 16px;
	font-weight: 600;
	color: #323130;
}

.detail-drawer-content {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.detail-drawer-body {
	flex: 1;
	overflow-y: auto;
	padding: 0;
}

.detail-drawer-footer {
	padding: 12px 16px;
	border-top: 1px solid #EDEBE9;
	background: #FAF9F8;
}
</style>

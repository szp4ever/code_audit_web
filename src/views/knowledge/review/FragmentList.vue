<template>
	<div class="fragment-list">
		<div class="fragment-toolbar">
			<n-space :size="12" justify="space-between" align="center">
				<n-space :size="12" align="center">
					<n-input
						v-model:value="searchKeyword"
						placeholder="搜索片段内容..."
						clearable
						style="width: 300px;"
						@update:value="handleSearch"
					>
						<template #prefix>
							<SvgIcon icon="ri:search-line" />
						</template>
					</n-input>
					<n-select
						v-model:value="filterStatus"
						:options="statusOptions"
						placeholder="归属状态"
						clearable
						style="width: 150px;"
						@update:value="handleFilter"
					/>
					<n-space v-if="filterStatus === 'matched'" :size="8" align="center" style="width: 280px;">
						<span style="font-size: 13px; color: #666; white-space: nowrap;">相似度范围：</span>
						<n-slider
							v-model:value="similarityRange"
							:min="0"
							:max="1"
							:step="0.01"
							range
							style="flex: 1; min-width: 0;"
							@update:value="handleFilter"
						/>
						<span style="font-size: 12px; color: #999; white-space: nowrap; min-width: 80px;">
							{{ formatSimilarityRange() }}
						</span>
					</n-space>
					<n-button quaternary size="small" @click="clearFilters">
						清空筛选
					</n-button>
				</n-space>
				<n-space :size="8" align="center">
					<template v-if="selectedFragmentChunkIndexes.size === 0">
						<n-select
							v-model:value="sortBy"
							:options="sortOptions"
							:placeholder="getSortPlaceholder()"
							style="width: 180px"
							size="small"
							@update:value="handleSortChange"
						/>
						<n-popover trigger="hover" placement="bottom">
							<template #trigger>
								<n-button
									@click="toggleSortOrder"
									quaternary
									size="small"
									:aria-label="`切换排序方向，当前为${sortOrder === 'asc' ? '升序' : '降序'}`"
								>
									<template #icon>
										<SvgIcon :icon="sortOrder === 'asc' ? 'ri:arrow-up-line' : 'ri:arrow-down-line'" />
									</template>
								</n-button>
							</template>
							<div style="padding: 4px 0;">
								<div style="font-weight: 500; margin-bottom: 4px;">当前排序方向</div>
								<div style="color: var(--n-text-color-2); font-size: 12px;">
									{{ sortOrder === 'asc' ? '升序 ↑' : '降序 ↓' }}
								</div>
							</div>
						</n-popover>
						<n-button size="medium" @click="handleSelectAll">
							全选
						</n-button>
					</template>
					<template v-else>
						<n-text depth="3" style="margin-right: 4px; display: flex; align-items: center;">
							已选择 {{ selectedFragmentChunkIndexes.size }} 项
						</n-text>
						<n-button-group>
							<n-button 
								v-if="selectedFragmentChunkIndexes.size < sortedFragments.length"
								size="medium" 
								@click="handleSelectAll"
							>
								全选
							</n-button>
							<n-button size="medium" @click="handleDeselectAll">清空选择</n-button>
							<n-button 
								v-if="selectedFragmentChunkIndexes.size < sortedFragments.length"
								size="medium" 
								@click="handleInvertSelection"
							>
								反选
							</n-button>
						</n-button-group>
						<n-button 
							type="primary" 
							size="medium"
							@click="handleBatchEditAttribution"
						>
							批量修改归属
							<template #icon>
								<SvgIcon icon="ri:arrow-down-s-line" />
							</template>
						</n-button>
					</template>
				</n-space>
			</n-space>
			<div v-if="hasActiveFilters" class="filter-tags">
				<n-space :size="8">
					<n-tag
						v-for="tag in activeFilterTags"
						:key="tag.key"
						closable
						@close="removeFilterTag(tag.key)"
						size="small"
					>
						{{ tag.label }}
					</n-tag>
				</n-space>
			</div>
		</div>

		<div class="fragment-table-container">
			<n-data-table
				:columns="columns"
				:data="sortedAndFilteredFragments"
				:scroll-x="1200"
				:row-key="(row: any) => row.chunkIndex"
				:checked-row-keys="Array.from(selectedFragmentChunkIndexes)"
				:loading="loadingItems"
				:theme-overrides="{
					thPaddingMedium: '12px 16px',
					tdPaddingMedium: '12px 16px',
					thTextColor: '#1f2937',
					tdTextColor: '#374151',
					tdColor: '#ffffff',
					thColor: '#f9fafb',
					borderColor: '#e5e7eb',
					thFontWeight: '600',
				}"
				class="fragment-table"
				@update:checked-row-keys="handleRowSelectionChange"
			>
				<template #empty>
					<n-empty description="暂无片段数据" />
				</template>
			</n-data-table>
			<div v-if="sortedFragments.length > 0" class="pagination-container" style="margin-top: 16px; display: flex; justify-content: center;">
				<n-pagination
					v-model:page="pagination.page"
					:item-count="pagination.itemCount"
					:page-size="pagination.pageSize"
					:page-sizes="pagination.pageSizes"
					show-size-picker
					@update:page="pagination.page = $event"
					@update:page-size="(size: number) => { pagination.pageSize = size; pagination.page = 1 }"
				/>
			</div>
		</div>

		<!-- 片段内容预览子模态框 -->
		<FragmentPreviewModal
			v-model:show="showFragmentPreview"
			:fragment="selectedFragmentForPreview"
		/>

		<!-- 知识条目选择模态框 -->
		<ItemSelectorModal
			v-model:show="showItemSelector"
			:kid="props.kid || ''"
			:fragment-content="currentFragment?.content"
			:current-fragment="currentFragment"
			@confirm="handleItemSelectConfirm"
		/>

		<!-- 片段详情模态框 -->
		<FragmentDetailModal
			v-model:show="showFragmentDetail"
			:fragment="selectedFragment"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, h, watch, reactive } from 'vue'
import { NInput, NSelect, NSlider, NSpace, NTag, NButton, NButtonGroup, NText, NDataTable, NEmpty, useMessage, useDialog, NPopover, NPagination } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { getKnowledgeItemList } from '@/api/knowledgeItem'
import type { KnowledgeItemListQuery } from '@/api/knowledgeItem'
import ItemSelectorModal from './ItemSelectorModal.vue'
import FragmentDetailModal from './FragmentDetailModal.vue'
import FragmentPreviewModal from './FragmentPreviewModal.vue'

interface Props {
	fragments: any[]
	docId?: string
	kid?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
	update: [fragment: any]
}>()

const message = useMessage()
const dialog = useDialog()

const searchKeyword = ref('')
const filterStatus = ref<string | null>(null)
const similarityRange = ref<[number, number]>([0, 1])
const sortBy = ref<'chunkIndex' | 'similarity' | 'attribution'>('chunkIndex')
const sortOrder = ref<'asc' | 'desc'>('asc')
const pagination = reactive({
	page: 1,
	pageSize: 20,
	itemCount: 0,
	pageSizes: [10, 20, 30, 50],
})

const selectedFragmentChunkIndexes = ref<Set<number>>(new Set())

const statusOptions = [
	{ label: '全部', value: 'all' },
	{ label: '已匹配', value: 'matched' },
	{ label: '待创建', value: 'create_new' },
]

const knowledgeItems = ref<Array<{ itemUuid: string; title: string }>>([])
const loadingItems = ref(false)

const showItemSelector = ref(false)
const currentFragment = ref<any>(null)
const isBatchEditMode = ref(false)
const showFragmentDetail = ref(false)
const selectedFragment = ref<any>(null)
const showFragmentPreview = ref(false)
const selectedFragmentForPreview = ref<any>(null)

const columnWidths = ref<Record<string, number>>({
	chunkIndex: 120,
	content: 450,
	similarity: 120,
	attribution: 350,
})

const minWidth = 80
const maxWidth = 800

function startResize(e: MouseEvent, key: string) {
	e.preventDefault()
	e.stopPropagation()
	const startX = e.clientX
	const startWidth = columnWidths.value[key] || 140
	
	function onMove(ev: MouseEvent) {
		const dx = ev.clientX - startX
		let w = startWidth + dx
		w = Math.max(minWidth, Math.min(maxWidth, w))
		columnWidths.value[key] = w
	}
	
	function onUp() {
		document.removeEventListener('mousemove', onMove)
		document.removeEventListener('mouseup', onUp)
		document.body.style.cursor = ''
		document.body.style.userSelect = ''
	}
	
	document.body.style.cursor = 'col-resize'
	document.body.style.userSelect = 'none'
	document.addEventListener('mousemove', onMove)
	document.addEventListener('mouseup', onUp)
}

function headerWithResize(title: string, key: string) {
	return () => h('div', {
		style: 'display: flex; align-items: center; position: relative; user-select: none; width: 100%;',
	}, [
		h('span', { style: 'flex: 1;' }, title),
		h('div', {
			class: 'col-resize-handle',
			onMousedown: (e: MouseEvent) => startResize(e, key),
			style: 'position: absolute; right: -6px; top: 0; height: 100%; width: 12px; cursor: col-resize; z-index: 1;'
		})
	])
}

async function loadKnowledgeItems(kid?: string) {
	if (!kid) return
	if (loadingItems.value) return
	
	loadingItems.value = true
	try {
		const response = await getKnowledgeItemList({
			kid,
			pageNum: 1,
			pageSize: 1000,
		})
		if (response.code === 200 && response.rows) {
			knowledgeItems.value = response.rows.map((item: any) => ({
				itemUuid: item.itemUuid,
				title: item.title || '未命名条目',
			}))
		}
	} catch (error: any) {
		message.error('加载知识条目列表失败: ' + (error.message || '未知错误'))
	} finally {
		loadingItems.value = false
	}
}

watch(() => props.kid, (newKid) => {
	if (newKid) {
		loadKnowledgeItems(newKid)
	}
}, { immediate: true })

const filteredFragments = computed(() => {
	let result = props.fragments

	if (searchKeyword.value) {
		const keyword = searchKeyword.value.toLowerCase()
		result = result.filter(f => 
			f.content?.toLowerCase().includes(keyword) ||
			f.matchedItemTitle?.toLowerCase().includes(keyword)
		)
	}

	if (filterStatus.value && filterStatus.value !== 'all') {
		if (filterStatus.value === 'matched') {
			result = result.filter(f => f.matchedItemUuid)
		} else if (filterStatus.value === 'create_new') {
			result = result.filter(f => !f.matchedItemUuid)
		}
	}

	if (filterStatus.value === 'matched' && similarityRange.value) {
		const isDefaultRange = similarityRange.value[0] === 0 && similarityRange.value[1] === 1
		if (!isDefaultRange) {
			result = result.filter(f => {
				if (!f.similarity) return false
				return f.similarity >= similarityRange.value[0] && f.similarity <= similarityRange.value[1]
			})
		}
	}

	return result
})

const sortedFragments = computed(() => {
	let result = [...filteredFragments.value]
	
	if (sortBy.value !== 'chunkIndex') {
		result.sort((a, b) => {
			let comparison = 0
			
			if (sortBy.value === 'similarity') {
				const aSim = a.similarity || 0
				const bSim = b.similarity || 0
				comparison = aSim - bSim
			} else if (sortBy.value === 'attribution') {
				const aTitle = a.matchedItemTitle || '创建新条目'
				const bTitle = b.matchedItemTitle || '创建新条目'
				comparison = aTitle.localeCompare(bTitle, 'zh-CN')
			}
			
			return sortOrder.value === 'asc' ? comparison : -comparison
		})
	} else {
		result.sort((a, b) => {
			const comparison = a.chunkIndex - b.chunkIndex
			return sortOrder.value === 'asc' ? comparison : -comparison
		})
	}
	
	return result
})

const sortedAndFilteredFragments = computed(() => {
	const all = sortedFragments.value
	pagination.itemCount = all.length
	const start = (pagination.page - 1) * pagination.pageSize
	const end = start + pagination.pageSize
	return all.slice(start, end)
})

watch(() => pagination.page, () => {
	pagination.page = pagination.page
})

watch(() => pagination.pageSize, () => {
	pagination.page = 1
})

const hasActiveFilters = computed(() => {
	const hasSimilarityFilter = filterStatus.value === 'matched' && 
	                            (similarityRange.value[0] > 0 || similarityRange.value[1] < 1)
	return !!searchKeyword.value || 
	       (filterStatus.value && filterStatus.value !== 'all') ||
	       hasSimilarityFilter
})

const activeFilterTags = computed(() => {
	const tags: Array<{ key: string; label: string }> = []
	
	if (searchKeyword.value) {
		tags.push({ key: 'search', label: `关键词：${searchKeyword.value}` })
	}
	
	if (filterStatus.value && filterStatus.value !== 'all') {
		const label = filterStatus.value === 'matched' ? '已匹配' : '待创建'
		const hasSimilarityFilter = filterStatus.value === 'matched' && 
		                            (similarityRange.value[0] > 0 || similarityRange.value[1] < 1)
		if (hasSimilarityFilter) {
			const min = (similarityRange.value[0] * 100).toFixed(0)
			const max = (similarityRange.value[1] * 100).toFixed(0)
			tags.push({ key: 'similarity', label: `已匹配 · 相似度：${min}%-${max}%` })
		} else {
			tags.push({ key: 'status', label: `归属：${label}` })
		}
	}
	
	return tags
})

function handleSearch() {
	pagination.page = 1
}

function handleFilter() {
	pagination.page = 1
}

function clearFilters() {
	searchKeyword.value = ''
	filterStatus.value = null
	similarityRange.value = [0, 1]
	pagination.page = 1
}

function removeFilterTag(key: string) {
	switch (key) {
		case 'search':
			searchKeyword.value = ''
			break
		case 'status':
			filterStatus.value = null
			break
		case 'similarity':
			similarityRange.value = [0, 1]
			break
	}
	pagination.page = 1
}

const sortOptions = computed(() => [
	{ label: '按片段索引', value: 'chunkIndex' },
	{ label: '按相似度', value: 'similarity' },
	{ label: '按归属', value: 'attribution' },
])

function getSortPlaceholder(): string {
	const currentOption = sortOptions.value.find(opt => opt.value === sortBy.value)
	return currentOption ? currentOption.label : '按片段索引'
}

function handleSortChange(value?: string) {
	if (value) {
		sortBy.value = value as any
	}
}

function toggleSortOrder() {
	sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function formatSimilarityRange(): string {
	if (!similarityRange.value) return '0% - 100%'
	const min = (similarityRange.value[0] * 100).toFixed(0)
	const max = (similarityRange.value[1] * 100).toFixed(0)
	return `${min}% - ${max}%`
}

function updateFragment(fragment: any, field: string, value: any, itemTitle?: string) {
	const updated = { ...fragment }
	
	if (field === 'matchedItemUuid') {
		if (value === null || value === '__create_new__') {
			updated.matchedItemUuid = null
			updated.matchedItemTitle = null
			updated.userDecision = 'create_new'
			updated.userSelectedItemUuid = null
		} else {
			updated.matchedItemUuid = value
			updated.matchedItemTitle = itemTitle || knowledgeItems.value.find(item => item.itemUuid === value)?.title || ''
			if (fragment.matchedItemUuid === value) {
				updated.userDecision = 'keep'
			} else {
				updated.userDecision = 'change'
			}
			updated.userSelectedItemUuid = value
		}
	} else {
		updated[field] = value
	}
	
	emit('update', updated)
}

function toggleFragmentSelection(chunkIndex: number, checked: boolean) {
	if (checked) {
		selectedFragmentChunkIndexes.value.add(chunkIndex)
	} else {
		selectedFragmentChunkIndexes.value.delete(chunkIndex)
	}
}

function handleSelectAll() {
	const allChunkIndexes = sortedFragments.value.map(f => f.chunkIndex)
	selectedFragmentChunkIndexes.value = new Set(allChunkIndexes)
}

function handleDeselectAll() {
	selectedFragmentChunkIndexes.value.clear()
}

function handleInvertSelection() {
	const allChunkIndexes = sortedFragments.value.map(f => f.chunkIndex)
	const newSelection = new Set<number>()
	allChunkIndexes.forEach(chunkIndex => {
		if (!selectedFragmentChunkIndexes.value.has(chunkIndex)) {
			newSelection.add(chunkIndex)
		}
	})
	selectedFragmentChunkIndexes.value = newSelection
}

function handleRowSelectionChange(keys: any[]) {
	selectedFragmentChunkIndexes.value = new Set(keys.map(k => Number(k)))
}

function handleBatchEditAttribution() {
	if (selectedFragmentChunkIndexes.value.size === 0) {
		message.warning('请先选择要修改的片段')
		return
	}
	
	const selectedFragments = sortedFragments.value.filter(f => 
		selectedFragmentChunkIndexes.value.has(f.chunkIndex)
	)
	
	if (selectedFragments.length === 0) {
		message.warning('未找到选中的片段')
		return
	}
	
	isBatchEditMode.value = true
	currentFragment.value = selectedFragments[0]
	showItemSelector.value = true
}

function handleItemSelectConfirm(result: { mode: 'create_new' | 'select_existing'; itemUuid?: string; itemTitle?: string }) {
	if (!currentFragment.value) return

	const selectedFragments = isBatchEditMode.value 
		? sortedFragments.value.filter(f => selectedFragmentChunkIndexes.value.has(f.chunkIndex))
		: [currentFragment.value]

	if (result.mode === 'create_new') {
		selectedFragments.forEach(fragment => {
			updateFragment(fragment, 'matchedItemUuid', '__create_new__')
		})
	} else if (result.mode === 'select_existing' && result.itemUuid) {
		selectedFragments.forEach(fragment => {
			updateFragment(fragment, 'matchedItemUuid', result.itemUuid!, result.itemTitle)
		})
	}
	
	if (isBatchEditMode.value) {
		selectedFragmentChunkIndexes.value.clear()
		isBatchEditMode.value = false
	}
	
	currentFragment.value = null
}


const columns = computed(() => {
	const baseColumns = [
		{
			type: 'selection',
			width: 50,
			fixed: 'left',
		},
		{
			title: headerWithResize('片段索引', 'chunkIndex'),
			key: 'chunkIndex',
			width: columnWidths.value.chunkIndex,
			fixed: 'left',
			sorter: (a: any, b: any) => a.chunkIndex - b.chunkIndex,
			render: (row: any) => {
				return h('span', { style: 'font-weight: 500; color: #323130;' }, `片段#${row.chunkIndex + 1}`)
			}
		},
		{
			title: headerWithResize('内容', 'content'),
			key: 'content',
			width: columnWidths.value.content,
			ellipsis: {
				tooltip: {
					style: 'max-width: 500px;'
				}
			},
			render: (row: any) => {
				const content = row.content || '加载中...'
				const preview = content.length > 200 ? content.substring(0, 200) + '...' : content
				return h('div', {
					style: 'display: flex; align-items: center; gap: 8px; width: 100%;',
				}, [
					h('span', {
						style: 'flex: 1; font-size: 13px; color: #605E5C; line-height: 1.6; cursor: pointer;',
						onClick: () => {
							selectedFragmentForPreview.value = row
							showFragmentPreview.value = true
						}
					}, preview),
					h(NButton, {
						text: true,
						size: 'small',
						type: 'primary',
						onClick: (e: Event) => {
							e.stopPropagation()
							selectedFragment.value = row
							showFragmentDetail.value = true
						}
					}, () => '查看详情')
				])
			}
		},
		{
			title: headerWithResize('相似度', 'similarity'),
			key: 'similarity',
			width: columnWidths.value.similarity,
			sorter: (a: any, b: any) => {
				const aSim = a.similarity || 0
				const bSim = b.similarity || 0
				return aSim - bSim
			},
			render: (row: any) => {
				if (!row.similarity) {
					return h('span', { style: 'color: #999;' }, '-')
				}
				const percent = (row.similarity * 100).toFixed(1)
				return h(NTag, {
					size: 'small',
					type: row.similarity >= 0.85 ? 'success' : row.similarity >= 0.7 ? 'warning' : 'default'
				}, () => `${percent}%`)
			}
		},
		{
			title: headerWithResize('归属', 'attribution'),
			key: 'attribution',
			width: columnWidths.value.attribution,
			sorter: (a: any, b: any) => {
				const aTitle = a.matchedItemTitle || '创建新条目'
				const bTitle = b.matchedItemTitle || '创建新条目'
				return aTitle.localeCompare(bTitle, 'zh-CN')
			},
			render: (row: any) => {
				const currentItemUuid = row.matchedItemUuid || '__create_new__'
				const currentTitle = row.matchedItemTitle || '创建新条目'
				
				return h('div', { style: 'display: flex; align-items: center; gap: 8px; width: 100%;' }, [
					h('div', {
						style: 'flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 8px; border-radius: 4px; border: 1px solid #D9D9D9;',
						onClick: (e: Event) => {
							e.stopPropagation()
							isBatchEditMode.value = false
							currentFragment.value = row
							showItemSelector.value = true
						}
					}, [
						h('span', {
							style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #333;'
						}, currentTitle),
						h(SvgIcon, {
							icon: 'ri:arrow-down-s-line',
							style: 'font-size: 14px; color: #999; flex-shrink: 0;'
						})
					]),
					currentItemUuid === '__create_new__' 
						? h(NTag, { type: 'success', size: 'small' }, () => '待创建')
						: h(NTag, { type: 'success', size: 'small' }, () => '已匹配')
				])
			}
		}
	]
	
	return baseColumns
})
</script>

<style scoped>
.fragment-list {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.fragment-toolbar {
	padding: 12px;
	background: #FAF9F8;
	border-radius: 4px;
}

.filter-tags {
	margin-top: 12px;
	padding-top: 12px;
	border-top: 1px solid #F0F0F0;
}

.fragment-table-container {
	background: #ffffff;
	border-radius: 4px;
	overflow: hidden;
}

.fragment-table :deep(.n-data-table-th) {
	background-color: #f9fafb;
	border-bottom: 2px solid #e5e7eb;
}

.fragment-table :deep(.n-data-table-tr:hover) {
	background-color: #f8fafc !important;
}

.fragment-table :deep(.n-data-table-td) {
	vertical-align: middle;
}

.fragment-table :deep(.n-data-table-th) .col-resize-handle {
	position: absolute;
	right: -6px;
	top: 0;
	height: 100%;
	width: 12px;
	cursor: col-resize;
	z-index: 1;
}

.fragment-table :deep(.n-data-table-th) .col-resize-handle::after {
	content: "";
	display: block;
	width: 2px;
	height: 60%;
	background: rgba(0, 0, 0, 0.12);
	margin: 20% auto;
	border-radius: 1px;
}

.fragment-table :deep(.n-data-table-th) {
	position: relative;
}
</style>

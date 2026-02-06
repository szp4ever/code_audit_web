<template>
	<div class="fragment-list-by-item">
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
						v-model:value="filterDocIds"
						:options="docOptions"
						placeholder="筛选附件"
						multiple
						clearable
						style="width: 200px;"
						@update:value="handleFilter"
					/>
					<n-button quaternary size="small" @click="clearFilters" v-if="hasActiveFilters">
						清空筛选
					</n-button>
				</n-space>
				<n-space :size="8" align="center">
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
				</n-space>
			</n-space>
			<div v-if="hasActiveFilters" class="filter-tags" style="margin-top: 12px;">
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
				:data="paginatedFragments"
				:scroll-x="1200"
				:row-key="(row: any) => `${row.docId}_${row.chunkIndex || row.idx}`"
				:loading="loading"
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

		<!-- 片段详情模态框 -->
		<n-modal
			v-model:show="showFragmentDetail"
			preset="card"
			title="片段详情"
			:mask-closable="true"
			:close-on-esc="true"
			style="width: 800px; max-width: 90vw; max-height: 85vh;"
		>
			<FragmentInfoPanel
				v-if="selectedFragment"
				:item="selectedFragment"
				:doc-id="selectedFragment.docId"
			/>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, h, watch, reactive } from 'vue'
import { NInput, NSelect, NSpace, NTag, NButton, NDataTable, NEmpty, useMessage, NPopover, NPagination, NModal, NTooltip } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { getFragmentListByItem, type KnowledgeFragmentListQuery } from '@/api/knowledge'
import FragmentInfoPanel from './FragmentInfoPanel.vue'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import to from 'await-to-js'

interface Props {
	itemUuid: string
	kid?: string
}

const props = defineProps<Props>()

const message = useMessage()

const loading = ref(false)
const fragments = ref<any[]>([])
const searchKeyword = ref('')
const filterDocIds = ref<string[]>([])
const sortBy = ref<'idx' | 'create_time' | 'content_length'>('idx')
const sortOrder = ref<'asc' | 'desc'>('asc')
const pagination = reactive({
	page: 1,
	pageSize: 20,
	itemCount: 0,
	pageSizes: [10, 20, 30, 50],
})

const showFragmentDetail = ref(false)
const selectedFragment = ref<any>(null)

const docOptions = computed(() => {
	const docMap = new Map<string, { label: string; count: number }>()
	fragments.value.forEach(f => {
		if (f.docId && f.docName) {
			const existing = docMap.get(f.docId)
			if (existing) {
				existing.count++
			} else {
				docMap.set(f.docId, { label: f.docName, count: 1 })
			}
		}
	})
	return Array.from(docMap.entries()).map(([value, info]) => ({
		label: `${info.label} (${info.count})`,
		value,
	}))
})

const filteredFragments = computed(() => {
	let result = fragments.value

	if (searchKeyword.value) {
		const keyword = searchKeyword.value.toLowerCase()
		result = result.filter(f => 
			f.content?.toLowerCase().includes(keyword)
		)
	}

	if (filterDocIds.value.length > 0) {
		result = result.filter(f => f.docId && filterDocIds.value.includes(f.docId))
	}

	return result
})

const sortedFragments = computed(() => {
	const result = [...filteredFragments.value]
	
	if (sortBy.value === 'idx') {
		result.sort((a, b) => {
			const aIdx = a.idx ?? a.chunkIndex ?? 0
			const bIdx = b.idx ?? b.chunkIndex ?? 0
			return sortOrder.value === 'asc' ? aIdx - bIdx : bIdx - aIdx
		})
	} else if (sortBy.value === 'create_time') {
		result.sort((a, b) => {
			const aTime = a.createTime ? new Date(a.createTime).getTime() : 0
			const bTime = b.createTime ? new Date(b.createTime).getTime() : 0
			return sortOrder.value === 'asc' ? aTime - bTime : bTime - aTime
		})
	} else if (sortBy.value === 'content_length') {
		result.sort((a, b) => {
			const aLen = (a.content || '').length
			const bLen = (b.content || '').length
			return sortOrder.value === 'asc' ? aLen - bLen : bLen - aLen
		})
	}
	
	return result
})

watch(() => sortedFragments.value.length, (newLength) => {
	pagination.itemCount = newLength
	if (pagination.page > 1 && (pagination.page - 1) * pagination.pageSize >= newLength) {
		pagination.page = Math.max(1, Math.ceil(newLength / pagination.pageSize))
	}
}, { immediate: true })

const paginatedFragments = computed(() => {
	const start = (pagination.page - 1) * pagination.pageSize
	const end = start + pagination.pageSize
	return sortedFragments.value.slice(start, end)
})

const hasActiveFilters = computed(() => {
	return !!searchKeyword.value || filterDocIds.value.length > 0
})

const activeFilterTags = computed(() => {
	const tags: Array<{ key: string; label: string }> = []
	
	if (searchKeyword.value) {
		tags.push({ key: 'search', label: `关键词：${searchKeyword.value}` })
	}
	
	if (filterDocIds.value.length > 0) {
		const docNames = filterDocIds.value.map(docId => {
			const fragment = fragments.value.find(f => f.docId === docId)
			return fragment?.docName || docId
		})
		tags.push({ key: 'docIds', label: `附件：${docNames.join('、')}` })
	}
	
	return tags
})

const sortOptions = [
	{ label: '按片段索引', value: 'idx' },
	{ label: '按创建时间', value: 'create_time' },
	{ label: '按内容长度', value: 'content_length' },
]

function getSortPlaceholder(): string {
	const option = sortOptions.find(opt => opt.value === sortBy.value)
	return option ? option.label : '按片段索引'
}

function handleSortChange(value?: string) {
	if (value) {
		sortBy.value = value as any
	}
}

function toggleSortOrder() {
	sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function handleSearch() {
	pagination.page = 1
}

function handleFilter() {
	pagination.page = 1
}

function clearFilters() {
	searchKeyword.value = ''
	filterDocIds.value = []
	pagination.page = 1
}

function removeFilterTag(key: string) {
	if (key === 'search') {
		searchKeyword.value = ''
	} else if (key === 'docIds') {
		filterDocIds.value = []
	}
	pagination.page = 1
}

function formatTimeAgo(time: string | number | Date | undefined): string {
	if (!time) return '-'
	try {
		const date = typeof time === 'string' || typeof time === 'number' ? new Date(time) : time
		return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
	} catch {
		return '-'
	}
}

function handleViewFragment(fragment: any) {
	selectedFragment.value = fragment
	showFragmentDetail.value = true
}

const columns = computed(() => [
	{
		title: '片段索引',
		key: 'idx',
		width: 120,
		render: (row: any) => {
			const idx = row.idx ?? row.chunkIndex ?? '-'
			return h('span', {
				style: 'color: #666; font-size: 13px; font-family: monospace;'
			}, idx)
		},
	},
	{
		title: '片段内容',
		key: 'content',
		minWidth: 400,
		render: (row: any) => {
			const content = row.content || ''
			const preview = content.length > 200 ? content.substring(0, 200) + '...' : content
			const fullContent = content
			
			const contentElement = h('span', {
				style: 'line-height: 1.7; color: #323130; font-size: 13px; word-break: break-word; cursor: pointer;',
				class: 'fragment-content-preview',
				onClick: () => handleViewFragment(row),
			}, preview)
			
			if (content.length > 200) {
				return h(NTooltip, {
					trigger: 'hover',
					placement: 'top',
					style: 'max-width: 600px;',
				}, {
					trigger: () => contentElement,
					default: () => h('div', {
						style: 'max-width: 600px; white-space: pre-wrap; line-height: 1.6; font-size: 13px; word-break: break-word;',
					}, fullContent),
				})
			}
			return contentElement
		},
	},
	{
		title: '来源附件',
		key: 'docName',
		width: 200,
		render: (row: any) => {
			if (!row.docName) {
				return h('span', { 
					style: 'color: #8C8C8C; font-size: 13px; font-style: italic;'
				}, '未关联附件')
			}
			return h('span', {
				style: 'color: #1890ff; font-size: 13px;'
			}, row.docName)
		},
	},
	{
		title: '创建时间',
		key: 'createTime',
		width: 170,
		render: (row: any) => {
			return h('div', {
				style: 'display: flex; align-items: center; gap: 6px; color: #8C8C8C; font-size: 12px;'
			}, [
				h(SvgIcon, {
					icon: 'ri:time-line',
					style: 'font-size: 14px; opacity: 0.7; flex-shrink: 0;',
				}),
				h('span', {
					style: 'white-space: nowrap;',
				}, formatTimeAgo(row.createTime)),
			])
		},
	},
])

async function fetchData() {
	if (!props.itemUuid) return
	
	loading.value = true
	try {
		const params: KnowledgeFragmentListQuery = {
			itemUuid: props.itemUuid,
			kid: props.kid,
			searchKeyword: searchKeyword.value.trim() || undefined,
			docIds: filterDocIds.value.length > 0 ? filterDocIds.value : undefined,
			orderBy: sortBy.value,
			order: sortOrder.value,
			pageNum: 1,
			pageSize: 10000,
		}
		const [err, result] = await to(getFragmentListByItem(params))
		if (err) {
			message.error(err.message || '获取片段列表失败')
			return
		}
		if (result && result.code === 200) {
			const data = result.data || result
			const rows = data.rows || result.rows || []
			fragments.value = rows
		} else {
			message.error(result?.msg || '获取片段列表失败')
		}
	} catch (error: any) {
		message.error(error?.message || '获取片段列表失败')
	} finally {
		loading.value = false
	}
}

watch(() => [props.itemUuid, props.kid], () => {
	if (props.itemUuid) {
		fetchData()
	}
}, { immediate: true })

watch(() => searchKeyword.value, () => {
	pagination.page = 1
})

watch(() => filterDocIds.value, () => {
	pagination.page = 1
})
</script>

<style scoped>
.fragment-list-by-item {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.fragment-toolbar {
	padding: 16px;
	background: #FFFFFF;
	border-radius: 4px;
	border: 1px solid #F0F0F0;
}

.filter-tags {
	margin-top: 8px;
}

.fragment-table-container {
	flex: 1;
	min-height: 0;
}

.pagination-container {
	margin-top: 16px;
	display: flex;
	justify-content: center;
}

.fragment-content-preview:hover {
	color: #1890ff;
}
</style>

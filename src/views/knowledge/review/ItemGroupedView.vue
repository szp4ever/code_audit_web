<template>
	<div class="item-grouped-view">
		<div class="view-toolbar">
			<n-space :size="12" justify="space-between" align="center">
				<n-space :size="12">
					<n-input
						v-model:value="searchKeyword"
						placeholder="搜索条目标题、摘要..."
						clearable
						style="width: 300px;"
						@update:value="handleSearch"
					>
						<template #prefix>
							<SvgIcon icon="ri:search-line" />
						</template>
					</n-input>
					<n-select
						v-model:value="filterSeverity"
						:options="severityOptions"
						placeholder="风险等级"
						clearable
						multiple
						style="width: 150px;"
						@update:value="handleFilter"
					/>
					<n-select
						v-model:value="filterLanguage"
						:options="languageOptions"
						placeholder="语言"
						clearable
						multiple
						style="width: 150px;"
						@update:value="handleFilter"
					/>
					<n-select
						v-model:value="filterVulnerabilityType"
						:options="vulnerabilityTypeOptionsWithStats"
						placeholder="漏洞类型"
						clearable
						multiple
						style="width: 200px;"
						@update:value="handleFilter"
					/>
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
				<n-space :size="8" align="center">
					<n-button text size="small" @click="expandAll">
						<template #icon>
							<SvgIcon icon="ri:arrow-down-s-line" />
						</template>
						全部展开
					</n-button>
					<n-button text size="small" @click="collapseAll">
						<template #icon>
							<SvgIcon icon="ri:arrow-up-s-line" />
						</template>
						全部折叠
					</n-button>
				</n-space>
			</n-space>
		</div>

		<n-spin :show="loading">
			<div class="item-groups">
				<n-collapse v-model:expanded-names="expandedItemUuids">
					<n-collapse-item
						v-for="group in filteredItemGroups"
						:key="group.itemUuid"
						:name="group.itemUuid"
					>
					<template #header>
						<div class="item-group-header">
							<div class="item-info">
								<div class="severity-indicator" :style="{ backgroundColor: getSeverityColor(group.item.severity) }"></div>
								<div class="item-title" v-html="searchKeyword ? highlightText(group.item.title || '', extractKeywords(searchKeyword)) : (group.item.title || '')"></div>
								<n-tag size="small" :type="getSeverityTagType(group.item.severity)">
									{{ getSeverityLabel(group.item.severity) }}
								</n-tag>
								<n-tag v-if="group.item.language" size="small" type="default">
									{{ getLanguageLabel(group.item.language) }}
								</n-tag>
								<n-tag v-if="group.item.vulnerabilityTypes && group.item.vulnerabilityTypes.length > 0" size="small" type="info">
									{{ group.item.vulnerabilityTypes.length }}个漏洞类型
								</n-tag>
							</div>
							<div class="item-stats">
								<div class="item-time-info" style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: #666; margin-right: 8px;">
									<span class="time-item time-create" style="display: inline-flex; align-items: center; gap: 4px;">
										<SvgIcon icon="ri:add-circle-line" style="font-size: 14px;" />
										<span>创建于</span>
										<span>{{ formatTimeAgo(group.item.createTime) }}</span>
									</span>
									<span v-if="group.item.updateTime && group.item.updateTime !== group.item.createTime" class="time-item time-update" style="display: inline-flex; align-items: center; gap: 4px;">
										<SvgIcon icon="ri:edit-circle-line" style="font-size: 14px;" />
										<span>更新于</span>
										<span>{{ formatTimeAgo(group.item.updateTime) }}</span>
									</span>
								</div>
								<n-tag size="small" type="warning">{{ group.fragments.length }}个片段</n-tag>
								<n-button
									v-if="group.itemUuid !== '__unmatched__' && group.item?.itemUuid"
									text
									size="small"
									@click.stop="openItemDetail(group.item)"
									style="margin-left: 8px;"
								>
									<template #icon>
										<SvgIcon icon="ri:eye-line" />
									</template>
									知识条目详情
								</n-button>
							</div>
						</div>
					</template>
					<div class="item-summary" v-if="group.item.summary" v-html="searchKeyword ? highlightText(group.item.summary, extractKeywords(searchKeyword)) : group.item.summary"></div>
					<FragmentList
						:fragments="group.fragments"
						:doc-id="currentTask?.docId"
						:kid="currentTask?.kid"
						@update="(fragment) => handleFragmentUpdate(group.itemUuid, fragment)"
					/>
					</n-collapse-item>
				</n-collapse>
				<n-empty v-if="filteredItemGroups.length === 0" description="暂无匹配的条目或片段" />
				<div v-if="filteredItemGroups.length > 0" class="pagination-container" style="margin-top: 16px; display: flex; justify-content: center;">
					<n-pagination
						v-model:page="pagination.page"
						:item-count="pagination.itemCount"
						:page-size="pagination.pageSize"
						:page-sizes="pagination.pageSizes"
						show-size-picker
						@update:page="handlePageChange"
						@update:page-size="handlePageSizeChange"
					/>
				</div>
			</div>
		</n-spin>

		<!-- 知识条目详情抽屉（只读） -->
		<n-drawer
			v-model:show="showItemDetailDrawer"
			:width="600"
			placement="right"
			:mask-closable="true"
		>
			<n-drawer-content :title="detailItem?.title || '知识条目详情'" closable>
				<n-spin :show="detailLoading">
					<template v-if="detailItem">
						<!-- 元信息标签 -->
						<div class="detail-meta-tags" style="margin-bottom: 16px;">
							<n-space :size="8" wrap>
								<n-tag
									v-if="detailItem.severity"
									:style="{
										backgroundColor: getSeverityColor(detailItem.severity),
										color: '#FFFFFF'
									}"
								>
									{{ detailItem.cvssScore !== null && detailItem.cvssScore !== undefined
										? `${detailItem.cvssScore.toFixed(1)} ${getSeverityLabel(detailItem.severity)}`
										: getSeverityLabel(detailItem.severity) }}
								</n-tag>
								<n-tag v-if="detailItem.language" size="small" bordered>
									{{ getLanguageLabel(detailItem.language) }}
								</n-tag>
								<n-tag
									v-for="vulnType in detailItem.vulnerabilityTypes || []"
									:key="vulnType"
									size="small"
									bordered
									style="background-color: #F5F5F5; color: #606060;"
								>
									{{ getCweDisplayName(vulnType) }}
								</n-tag>
							</n-space>
						</div>

						<!-- 时间信息 -->
						<div v-if="detailItem.createTime || detailItem.updateTime" class="detail-section" style="margin-top: 16px; margin-bottom: 16px;">
							<div style="display: flex; gap: 16px; font-size: 13px; color: #666;">
								<div v-if="detailItem.createTime" style="display: flex; align-items: center; gap: 4px;">
									<span style="font-weight: 500;">创建时间：</span>
									<span>{{ formatTimeAgo(detailItem.createTime) }}</span>
								</div>
								<div v-if="detailItem.updateTime" style="display: flex; align-items: center; gap: 4px;">
									<span style="font-weight: 500;">更新时间：</span>
									<span>{{ formatTimeAgo(detailItem.updateTime) }}</span>
								</div>
							</div>
						</div>

						<!-- 摘要 -->
						<div v-if="detailItem.summary" class="detail-section">
							<h3 class="detail-section-title">摘要</h3>
							<p class="detail-text">{{ detailItem.summary }}</p>
						</div>

						<!-- 问题描述 -->
						<div v-if="detailItem.problemDescription" class="detail-section">
							<h3 class="detail-section-title">问题描述</h3>
							<div class="detail-text markdown-content" v-html="detailItem.problemDescription.replace(/\n/g, '<br>')"></div>
						</div>

						<!-- 修复方案 -->
						<div v-if="detailItem.fixSolution" class="detail-section">
							<h3 class="detail-section-title">修复方案</h3>
							<div class="detail-text markdown-content" v-html="detailItem.fixSolution.replace(/\n/g, '<br>')"></div>
						</div>

						<!-- 示例代码 -->
						<div v-if="detailItem.exampleCode" class="detail-section">
							<h3 class="detail-section-title">示例代码</h3>
							<div class="code-display-wrapper">
								<div class="code-toolbar">
									<span class="code-label">代码</span>
									<n-button text size="small" @click="handleCopyCode(detailItem.exampleCode || '')">
										<template #icon>
											<SvgIcon icon="ri:file-copy-line" />
										</template>
										复制
									</n-button>
								</div>
								<CodeEditor
									:model-value="detailItem.exampleCode || ''"
									:readonly="true"
									:show-toolbar="false"
									:show-line-numbers="true"
									:min-height="200"
									:max-height="400"
								/>
							</div>
						</div>

						<!-- 标签 -->
						<div v-if="detailItem.tags && detailItem.tags.length > 0" class="detail-section">
							<h3 class="detail-section-title">标签</h3>
							<n-space :size="8" wrap>
								<n-tag
									v-for="tagName in detailItem.tags"
									:key="tagName"
									size="small"
									bordered
									style="background-color: #F6FFED; color: #52C41A;"
								>
									{{ tagName }}
								</n-tag>
							</n-space>
						</div>
					</template>
					<n-empty v-else description="加载中..." />
				</n-spin>

				<template #footer>
					<n-space justify="end">
						<n-button @click="showItemDetailDrawer = false">关闭</n-button>
					</n-space>
				</template>
			</n-drawer-content>
		</n-drawer>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { NInput, NSelect, NSpace, NCollapse, NCollapseItem, NTag, NButton, NEmpty, NDrawer, NDrawerContent, NSpin, NPopover, NPagination } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { getKnowledgeItemList, getKnowledgeItemDetail } from '@/api/knowledgeItem'
import { getDictDataByType } from '@/api/dict'
import { getCweReferenceListAll } from '@/api/cwe'
import type { CweReference } from '@/api/cwe'
import type { UploadTask } from '@/store/modules/upload/helper'
import FragmentList from './FragmentList.vue'
import CodeEditor from '@/components/knowledge/CodeEditor.vue'
import { useMessage } from 'naive-ui'

interface Props {
	fragments: any[]
	task?: UploadTask | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
	update: [fragment: any]
}>()

const message = useMessage()

const searchKeyword = ref('')
const filterSeverity = ref<string[]>([])
const filterLanguage = ref<string[]>([])
const filterVulnerabilityType = ref<string[]>([])
const sortBy = ref<'fragmentCount' | 'severity' | 'cvss_score' | 'title' | 'create_time'>('fragmentCount')
const sortOrder = ref<'asc' | 'desc'>('desc')
const expandedItemUuids = ref<string[]>([])
const loading = ref(false)
const pagination = reactive({
	page: 1,
	pageSize: 20,
	itemCount: 0,
	pageSizes: [10, 20, 30, 50],
})
let loadItemDetailsLock = false
const showItemDetailDrawer = ref(false)
const detailItem = ref<any>(null)
const detailLoading = ref(false)

const itemGroups = ref<Array<{
	itemUuid: string
	item: any
	fragments: any[]
	fragmentCount: number
}>>([])

const severityOptions = ref<any[]>([])
const languageOptions = ref<any[]>([])
const vulnerabilityTypeOptions = ref<any[]>([])
const vulnerabilityTypeStats = ref<Record<string, number>>({})
const cweReferences = ref<CweReference[]>([])

const vulnerabilityTypeOptionsWithStats = computed(() => {
	const stats = vulnerabilityTypeStats.value
	return vulnerabilityTypeOptions.value.map((opt: any) => ({
		...opt,
		label: `${opt.label} (${stats[String(opt.value)] || 0})`
	}))
})

const currentTask = computed(() => props.task)

function extractKeywords(query: string): string[] {
	return query.trim().split(/\s+/).filter(w => w.length > 0)
}

function highlightText(text: string, keywords: string[]): string {
	if (!text || !keywords || keywords.length === 0) {
		return text
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

function escapeHtml(text: string): string {
	const div = document.createElement('div')
	div.textContent = text
	return div.innerHTML
}

function collectVulnerabilityTypesFromFragments(fragments: any[]): Set<string> {
	const types = new Set<string>()
	fragments.forEach(f => {
		if (f.vulnerabilityType) {
			types.add(f.vulnerabilityType)
		}
	})
	return types
}

function calculateVulnerabilityTypeStats(fragments: any[]): Record<string, number> {
	const stats: Record<string, number> = {}
	fragments.forEach(f => {
		if (f.vulnerabilityType) {
			stats[f.vulnerabilityType] = (stats[f.vulnerabilityType] || 0) + 1
		}
	})
	return stats
}

async function loadItemDetails() {
	if (!currentTask.value?.kid) {
		return
	}

	const itemUuidSet = new Set<string>()
	const unmatchedFragments: any[] = []
	
	props.fragments.forEach(f => {
		if (f.matchedItemUuid) {
			itemUuidSet.add(f.matchedItemUuid)
		} else {
			unmatchedFragments.push(f)
		}
	})
	
	const allVulnTypes = collectVulnerabilityTypesFromFragments(props.fragments)
	vulnerabilityTypeOptions.value = Array.from(allVulnTypes).map(type => ({
		label: type,
		value: type,
	}))

	if (itemUuidSet.size === 0) {
		let filteredUnmatched = unmatchedFragments
		if (filterVulnerabilityType.value.length > 0) {
			filteredUnmatched = unmatchedFragments.filter(f => 
				f.vulnerabilityType && filterVulnerabilityType.value.includes(f.vulnerabilityType)
			)
		}
		
		if (unmatchedFragments.length > 0) {
			const unmatchedVulnTypes = Array.from(collectVulnerabilityTypesFromFragments(unmatchedFragments))
			itemGroups.value = [{
				itemUuid: '__unmatched__',
				item: {
					title: '未匹配到条目',
					summary: '这些片段未匹配到任何现有条目，将创建新条目',
					severity: null,
					language: null,
					vulnerabilityTypes: unmatchedVulnTypes,
				},
				fragments: filteredUnmatched,
				fragmentCount: filteredUnmatched.length,
			}]
			vulnerabilityTypeStats.value = calculateVulnerabilityTypeStats(filteredUnmatched)
		} else {
			itemGroups.value = []
			vulnerabilityTypeStats.value = {}
		}
		loadItemDetailsLock = false
		return
	}

	loading.value = true
	try {
		const itemUuidSetForFilter = new Set(itemUuidSet)
		const queryParams: any = {
			kid: currentTask.value.kid,
			searchKeyword: searchKeyword.value.trim() || undefined,
			languages: filterLanguage.value.length > 0 ? filterLanguage.value : undefined,
			severities: filterSeverity.value.length > 0 ? filterSeverity.value : undefined,
			vulnerabilityTypes: undefined,
			orderBy: (sortBy.value === 'fragmentCount' || sortBy.value === 'title') ? 'create_time' : sortBy.value,
			order: (sortBy.value === 'fragmentCount' || sortBy.value === 'title') ? 'desc' : sortOrder.value,
			pageNum: pagination.page,
			pageSize: pagination.pageSize,
		}
		const response: any = await getKnowledgeItemList(queryParams)
		if (response.code === 200 && response.rows) {
			const allItems = response.rows
			const itemUuidSetFromResponse = new Set<string>()
			const matchedItemMap = new Map<string, any>()
			
			allItems.forEach((item: any) => {
				if (itemUuidSetForFilter.has(item.itemUuid)) {
					matchedItemMap.set(item.itemUuid, item)
					itemUuidSetFromResponse.add(item.itemUuid)
				}
			})

			const groups: Array<{
				itemUuid: string
				item: any
				fragments: any[]
				fragmentCount: number
			}> = []

			for (const item of allItems) {
				if (!itemUuidSetFromResponse.has(item.itemUuid)) continue
				
				let groupFragments = props.fragments.filter(f => f.matchedItemUuid === item.itemUuid)
				
				if (filterVulnerabilityType.value.length > 0) {
					groupFragments = groupFragments.filter(f => {
						if (f.vulnerabilityType && filterVulnerabilityType.value.includes(f.vulnerabilityType)) {
							return true
						}
						if (item.vulnerabilityTypes && item.vulnerabilityTypes.some((vt: string) => filterVulnerabilityType.value.includes(vt))) {
							return true
						}
						return false
					})
				}
				
				if (groupFragments.length > 0 || filterVulnerabilityType.value.length === 0) {
					groups.push({
						itemUuid: item.itemUuid,
						item,
						fragments: groupFragments,
						fragmentCount: groupFragments.length,
					})
				}
			}

			let filteredUnmatchedFragments = unmatchedFragments
			if (filterVulnerabilityType.value.length > 0) {
				filteredUnmatchedFragments = unmatchedFragments.filter(f => 
					f.vulnerabilityType && filterVulnerabilityType.value.includes(f.vulnerabilityType)
				)
			}
			
			const unmatchedVulnTypes = Array.from(collectVulnerabilityTypesFromFragments(unmatchedFragments))
			const unmatchedGroup = {
				itemUuid: '__unmatched__',
				item: {
					title: '未匹配到条目',
					summary: '这些片段未匹配到任何现有条目，将创建新条目',
					severity: null,
					language: null,
					vulnerabilityTypes: unmatchedVulnTypes,
					createTime: null,
				},
				fragments: filteredUnmatchedFragments,
				fragmentCount: filteredUnmatchedFragments.length,
			}
			
			if (filteredUnmatchedFragments.length > 0) {
				groups.push(unmatchedGroup)
			}

			if (sortBy.value === 'fragmentCount') {
				groups.sort((a, b) => {
					const comparison = a.fragmentCount - b.fragmentCount
					const result = sortOrder.value === 'asc' ? comparison : -comparison
					return result
				})
			} else if (sortBy.value === 'title') {
				groups.sort((a, b) => {
					const aTitle = a.item.title || ''
					const bTitle = b.item.title || ''
					const comparison = aTitle.localeCompare(bTitle, 'zh-CN')
					const result = sortOrder.value === 'asc' ? comparison : -comparison
					return result
				})
			} else {
				const unmatchedIndex = groups.findIndex(g => g.itemUuid === '__unmatched__')
				if (unmatchedIndex !== -1) {
					const unmatched = groups.splice(unmatchedIndex, 1)[0]
					groups.push(unmatched)
				}
			}
			
			const allDisplayedFragments = groups.flatMap(g => g.fragments)
			const currentStats = calculateVulnerabilityTypeStats(allDisplayedFragments)
			vulnerabilityTypeStats.value = currentStats

			itemGroups.value = groups
		}
	} catch (error: any) {
		//静默处理错误，避免影响用户体验
	} finally {
		loading.value = false
		loadItemDetailsLock = false
	}
}

watch(() => props.fragments, (newFragments, oldFragments) => {
	if (loadItemDetailsLock) return
	const allVulnTypes = collectVulnerabilityTypesFromFragments(newFragments)
	vulnerabilityTypeOptions.value = Array.from(allVulnTypes).map(type => ({
		label: type,
		value: type,
	}))
	
	//如果片段数据发生变化（包括归属改变），重新加载分组
	if (!oldFragments || oldFragments.length !== newFragments.length) {
		loadItemDetails()
		return
	}
	
	const oldFragmentMap = new Map(oldFragments.map((f: any) => [f.chunkIndex, f]))
	const needReload = newFragments.some((f: any) => {
		const old = oldFragmentMap.get(f.chunkIndex)
		return !old || f.matchedItemUuid !== old.matchedItemUuid
	})
	
	if (needReload) {
		loadItemDetails()
	}
}, { deep: true, immediate: true })

watch([searchKeyword, filterSeverity, filterLanguage, filterVulnerabilityType, sortBy, sortOrder], () => {
	pagination.page = 1
	if (loadItemDetailsLock) return
	loadItemDetails()
}, { deep: true })

const allFilteredItemGroups = computed(() => {
	let result = itemGroups.value
	
	if (filterSeverity.value.length > 0) {
		result = result.filter(group => 
			group.itemUuid === '__unmatched__' || filterSeverity.value.includes(group.item.severity)
		)
	}
	
	if (filterLanguage.value.length > 0) {
		result = result.filter(group => 
			group.itemUuid === '__unmatched__' || filterLanguage.value.includes(group.item.language)
		)
	}
	
	if (searchKeyword.value) {
		const keyword = searchKeyword.value.toLowerCase()
		result = result.filter(group =>
			group.itemUuid === '__unmatched__' ||
			group.item.title?.toLowerCase().includes(keyword) ||
			group.item.summary?.toLowerCase().includes(keyword)
		)
	}
	
	return result
})

const filteredItemGroups = computed(() => {
	const all = allFilteredItemGroups.value
	pagination.itemCount = all.length
	const start = (pagination.page - 1) * pagination.pageSize
	const end = start + pagination.pageSize
	return all.slice(start, end)
})

function handleSearch() {
	if (loadItemDetailsLock) return
	loadItemDetails()
}

function handleFilter() {
	if (loadItemDetailsLock) return
	loadItemDetails()
}

const sortOptions = computed(() => [
	{ label: '按片段数排序', value: 'fragmentCount' },
	{ label: '按风险等级排序', value: 'severity' },
	{ label: '按标题排序', value: 'title' },
	{ label: '按创建时间排序', value: 'create_time' },
])

function getSortPlaceholder(): string {
	const currentOption = sortOptions.value.find(opt => opt.value === sortBy.value)
	return currentOption ? currentOption.label : '按片段数排序'
}

function handleSortChange(value?: string) {
	if (value) {
		sortBy.value = value as any
		if (loadItemDetailsLock) return
		loadItemDetails()
	}
}

function toggleSortOrder() {
	sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
	if (loadItemDetailsLock) return
	loadItemDetails()
}

function formatTimeAgo(timestamp?: number | string): string {
	if (!timestamp) return '-'
	try {
		const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)
		const now = new Date()
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
		if (diffInSeconds < 60) return '刚刚'
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
		if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		const hours = String(date.getHours()).padStart(2, '0')
		const minutes = String(date.getMinutes()).padStart(2, '0')
		return `${year}-${month}-${day} ${hours}:${minutes}`
	} catch (e) {
		return '-'
	}
}

function expandAll() {
	expandedItemUuids.value = allFilteredItemGroups.value.map(g => g.itemUuid)
}

function collapseAll() {
	expandedItemUuids.value = []
}

function handlePageChange(page: number) {
	pagination.page = page
	if (loadItemDetailsLock) return
	loadItemDetails()
}

function handlePageSizeChange(pageSize: number) {
	pagination.pageSize = pageSize
	pagination.page = 1
	if (loadItemDetailsLock) return
	loadItemDetails()
}

function getSeverityColor(severity?: string): string {
	const colors: Record<string, string> = {
		'高危': '#F5222D',
		'中危': '#FA8C16',
		'低危': '#FAAD14',
		'信息': '#52C41A',
	}
	return colors[severity || ''] || '#808080'
}

function getSeverityTagType(severity?: string): 'default' | 'success' | 'warning' | 'error' {
	const types: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
		'高危': 'error',
		'中危': 'warning',
		'低危': 'warning',
		'信息': 'success',
	}
	return types[severity || ''] || 'default'
}

function getDictLabel(options: any[], value?: string): string {
	if (!value) return '-'
	const option = options.find((opt: any) => opt.value === value)
	return option ? option.label : value
}

function getSeverityLabel(severity?: string): string {
	return getDictLabel(severityOptions.value, severity)
}

function getLanguageLabel(language?: string): string {
	return getDictLabel(languageOptions.value, language)
}

function handleFragmentUpdate(itemUuid: string, fragment: any) {
	const oldItemUuid = itemUuid
	const newItemUuid = fragment.matchedItemUuid || '__unmatched__'
	
	//先通知父组件更新数据（这会触发watch重新加载分组）
	emit('update', fragment)
	
	//如果片段归属改变，需要重新分组
	if (oldItemUuid !== newItemUuid) {
		//延迟重新加载，等待父组件数据更新
		setTimeout(() => {
			loadItemDetails()
		}, 100)
	} else {
		//归属未改变，只更新本地视图数据
		const groupIndex = itemGroups.value.findIndex(g => g.itemUuid === itemUuid)
		if (groupIndex !== -1) {
			const fragmentIndex = itemGroups.value[groupIndex].fragments.findIndex(
				(f: any) => f.chunkIndex === fragment.chunkIndex
			)
			if (fragmentIndex !== -1) {
				itemGroups.value[groupIndex].fragments[fragmentIndex] = { ...fragment }
			}
		}
	}
}

async function openItemDetail(item: any) {
	if (!item || !item.itemUuid || item.itemUuid === '__unmatched__') return
	detailItem.value = null
	detailLoading.value = true
	showItemDetailDrawer.value = true
	try {
		const response: any = await getKnowledgeItemDetail(item.itemUuid)
		if (response.code === 200) {
			detailItem.value = response.data
		} else {
			message.error(response.msg || '获取详情失败')
		}
	} catch (error: any) {
		message.error('获取详情失败: ' + (error.message || '未知错误'))
	} finally {
		detailLoading.value = false
	}
}

async function handleCopyCode(code: string) {
	try {
		await navigator.clipboard.writeText(code || '')
		message.success('复制成功')
	} catch (e) {
		message.error('复制失败')
	}
}

function getCweDisplayName(cweId: string): string {
	const cwe = cweReferences.value.find((ref: CweReference) => ref.cweId === cweId)
	if (cwe) {
		const name = cwe.nameZh || cwe.nameEn || cwe.cweId
		return `CWE-${cwe.cweId}: ${name}`
	}
	const option = vulnerabilityTypeOptions.value.find(opt => opt.value === cweId)
	return option ? option.label : `CWE-${cweId}`
}

async function loadDictOptions() {
	try {
		const [severityRes, languageRes, vulnTypeRes] = await Promise.all([
			getDictDataByType('knowledge_severity'),
			getDictDataByType('knowledge_language'),
			getDictDataByType('vulnerability_type'),
		])
		severityOptions.value = (severityRes.data || []).map((item: any) => ({
			label: item.dictLabel,
			value: item.dictValue,
		}))
		languageOptions.value = (languageRes.data || []).map((item: any) => ({
			label: item.dictLabel,
			value: item.dictValue,
		}))
		vulnerabilityTypeOptions.value = (vulnTypeRes.data || []).map((item: any) => ({
			label: item.dictLabel,
			value: item.dictValue,
		}))
	} catch (error: any) {
		//静默处理错误，避免影响用户体验
	}
}

async function loadCweReferences() {
	try {
		const response: any = await getCweReferenceListAll()
		if (response.code === 200 && response.data) {
			cweReferences.value = response.data
		}
	} catch (error: any) {
		//静默处理错误
	}
}

loadDictOptions()
loadCweReferences()
loadItemDetails()
</script>

<style scoped>
.item-grouped-view {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.view-toolbar {
	padding: 12px;
	background: #FAF9F8;
	border-radius: 4px;
}

.item-groups {
}

.item-group-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
	gap: 12px;
}

.item-info {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
}

.severity-indicator {
	width: 4px;
	height: 16px;
	border-radius: 2px;
}

.item-title {
	font-weight: 500;
	flex: 1;
}

.item-stats {
	display: flex;
	gap: 8px;
}

.item-summary {
	padding: 8px 12px;
	color: #666;
	font-size: 13px;
	line-height: 1.6;
	border-bottom: 1px solid #F0F0F0;
	margin-bottom: 8px;
}

.detail-meta-tags {
	padding-bottom: 16px;
	border-bottom: 1px solid #F0F0F0;
}

.detail-section {
	margin-top: 24px;
}

.detail-section-title {
	font-size: 16px;
	font-weight: 600;
	color: #202020;
	margin: 0 0 12px 0;
}

.detail-text {
	font-size: 14px;
	color: #404040;
	line-height: 1.8;
	margin: 0;
}

.markdown-content {
	white-space: pre-wrap;
}

.code-display-wrapper {
	border: 1px solid #E5E7EB;
	border-radius: 4px;
	overflow: hidden;
}

.code-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	background-color: #F9FAFB;
	border-bottom: 1px solid #E5E7EB;
}

.code-label {
	font-size: 12px;
	color: #666;
	font-weight: 500;
}
</style>

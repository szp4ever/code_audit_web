<template>
	<div class="item-list">
		<div class="item-filters">
			<n-space :size="12" justify="space-between" style="width: 100%;">
				<n-space :size="12">
					<n-input
						v-model:value="searchKeyword"
						placeholder="搜索条目标题、摘要..."
						clearable
						style="width: 300px;"
					/>
					<n-select
						v-model:value="filterLanguage"
						:options="languageOptions"
						placeholder="筛选语言"
						clearable
						style="width: 150px;"
					/>
				</n-space>
				<n-space :size="8" v-if="!loading && sortedItems.length > 0" align="center">
					<template v-if="selectedItemUuids.length === 0">
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
							已选择 {{ selectedItemUuids.length }} 项
						</n-text>
						<n-button-group>
							<n-button 
								v-if="selectedItemUuids.length < sortedItems.length"
								size="medium" 
								@click="handleSelectAll"
							>
								全选
							</n-button>
							<n-button size="medium" @click="handleDeselectAll">清空选择</n-button>
							<n-button 
								v-if="selectedItemUuids.length < sortedItems.length"
								size="medium" 
								@click="handleInvertSelection"
							>
								反选
							</n-button>
						</n-button-group>
						<n-button 
							type="error" 
							size="medium" 
							@click="handleBatchDelete"
						>
							批量删除
						</n-button>
						<n-dropdown
							trigger="click"
							:options="batchEditOptions"
							@select="handleBatchEditSelect"
						>
							<n-button 
								type="primary" 
								size="medium"
							>
								批量修改
								<template #icon>
									<SvgIcon icon="ri:arrow-down-s-line" />
								</template>
							</n-button>
						</n-dropdown>
					</template>
				</n-space>
			</n-space>
		</div>

		<div class="list-content-area">
			<div v-if="loading" class="list-skeleton">
				<div v-for="i in 8" :key="i" class="list-skeleton-item">
					<n-skeleton height="24px" width="60%" style="margin-bottom: 8px;" />
					<n-skeleton text :repeat="2" />
					<n-skeleton height="20px" width="40%" style="margin-top: 8px;" />
				</div>
			</div>
			<n-list v-else-if="sortedItems.length > 0" hoverable clickable>
				<n-list-item
					v-for="item in paginatedItems"
					:key="item.itemUuid"
					:class="{ 
						'list-item-selected': selectedItemUuid === item.itemUuid,
						'list-item-checked': selectedItemUuids.includes(item.itemUuid),
						'list-item-duplicate': props.duplicateItemUuids.includes(item.itemUuid)
					}"
					@click="(e: MouseEvent) => { 
						const target = e.target as HTMLElement
						if (!target.closest('.n-checkbox') && !target.closest('.n-checkbox-box') && !target.closest('.n-checkbox-box__input')) {
							handleItemClick(item)
						}
					}"
				>
					<n-thing>
						<template #header>
							<div class="list-item-header" @click.stop>
								<n-checkbox
									:checked="selectedItemUuids.includes(item.itemUuid)"
									@update:checked="(val) => toggleItemSelection(item.itemUuid, val)"
									@click.stop
									style="flex-shrink: 0; margin-right: 8px;"
								/>
								<div class="severity-indicator" :style="{ backgroundColor: getDictColor(severityOptions, item.severity, '#808080') }"></div>
								<span class="list-item-title" v-html="searchKeyword.trim() ? highlightText(item.title || '-', extractKeywords(searchKeyword)) : (item.title || '-')"></span>
								<n-space :size="4" style="flex-shrink: 0;">
									<n-button
										v-if="item.itemUuid"
										quaternary
										size="small"
										type="info"
										@click.stop="handleViewFragment(item)"
									>
										<template #icon>
											<SvgIcon icon="ri:file-list-line" :style="{ fontSize: '14px' }" />
										</template>
										片段
									</n-button>
									<n-button
										v-if="item.chunkIndex !== undefined || item.fid !== undefined"
										quaternary
										size="small"
										@click.stop="handleViewFragment(item)"
									>
										<template #icon>
											<SvgIcon icon="ri:file-text-line" :style="{ fontSize: '14px' }" />
										</template>
										查看原始知识片段
									</n-button>
									<n-button
										quaternary
										size="small"
										type="error"
										@click.stop="handleDelete(item)"
									>
										<template #icon>
											<SvgIcon icon="ri:delete-bin-line" :style="{ fontSize: '14px' }" />
										</template>
									</n-button>
								</n-space>
							</div>
						</template>
						<template #description>
							<div class="list-item-content">
								<div v-if="item.summary" class="list-item-snippet">
									<span class="snippet-label">摘要：</span>
									<span 
										class="snippet-text" 
										v-html="searchKeyword.trim() 
											? highlightText(extractSnippet(item.summary, extractKeywords(searchKeyword), 100), extractKeywords(searchKeyword)) 
											: (item.summary.substring(0, 100) + (item.summary.length > 100 ? '...' : ''))"
									></span>
								</div>
								<div v-if="item.problemDescription" class="list-item-snippet">
									<span class="snippet-label">问题描述：</span>
									<span 
										class="snippet-text" 
										v-html="searchKeyword.trim() 
											? highlightText(extractSnippet(item.problemDescription, extractKeywords(searchKeyword), 100), extractKeywords(searchKeyword)) 
											: (item.problemDescription.substring(0, 100) + (item.problemDescription.length > 100 ? '...' : ''))"
									></span>
								</div>
								<div class="list-item-meta">
									<div class="meta-main-row">
										<div class="meta-left">
											<template v-if="getItemCvssScore(item) !== null">
												<span class="risk-badge cvss-badge" :style="{ 
													backgroundColor: getDictColor(severityOptions, getItemSeverity(item), '#808080'),
													color: '#fff'
												}">
													CVSS {{ formatCvssScoreDisplay(getItemCvssScore(item)) }} {{ getDictLabel(severityOptions, getItemSeverity(item)) }}
												</span>
											</template>
											<template v-if="item.severity">
												<span class="severity-badge manual-badge" :style="{ 
													backgroundColor: getDictColor(severityOptions, item.severity, '#808080'),
													color: '#fff'
												}">
													认定 {{ getDictLabel(severityOptions, item.severity) }}
												</span>
											</template>
											<template v-if="item.vulnerabilityTypes && item.vulnerabilityTypes.length > 0">
												<n-tag
													v-for="cweId in item.vulnerabilityTypes.slice(0, 2)"
													:key="cweId"
													size="small"
													:bordered="false"
												>
													{{ getCweDisplayName(cweId) }}
												</n-tag>
												<n-tag
													v-if="item.vulnerabilityTypes.length > 2"
													size="small"
													:bordered="false"
													type="info"
												>
													+{{ item.vulnerabilityTypes.length - 2 }}
												</n-tag>
											</template>
											<template v-if="item.language">
												<n-tag size="small" :bordered="false" type="default">
													{{ getDictLabel(languageOptions, item.language) }}
												</n-tag>
											</template>
										</div>
										<div v-if="item.tags && item.tags.length > 0" class="meta-right">
											<n-tag
												v-for="tag in item.tags.slice(0, 3)"
												:key="tag"
												size="small"
												:bordered="false"
												type="success"
												style="opacity: 0.85;"
											>
												{{ tag }}
											</n-tag>
											<n-tag
												v-if="item.tags.length > 3"
												size="small"
												:bordered="false"
												type="success"
												style="opacity: 0.85;"
											>
												+{{ item.tags.length - 3 }}
											</n-tag>
										</div>
									</div>
								</div>
							</div>
						</template>
					</n-thing>
				</n-list-item>
			</n-list>
			<n-empty v-else description="暂无数据" />
		</div>
		<div v-if="!loading && sortedItems.length > 0" class="pagination-wrapper">
			<n-pagination
				v-model:page="pagination.page"
				v-model:page-size="pagination.pageSize"
				:item-count="pagination.itemCount"
				:page-sizes="pagination.pageSizes"
				show-size-picker
				show-quick-jumper
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { NList, NListItem, NThing, NInput, NSelect, NSpace, NTag, NEmpty, NSkeleton, NButton, NButtonGroup, NCheckbox, NText, NDropdown, NPopover, NPagination, useMessage, useDialog } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { getDictDataByType } from '@/api/dict'
import { getCweReferenceListAll } from '@/api/cwe'
import { format } from 'date-fns'

interface Props {
	items: any[]
	isBatch?: boolean
	duplicateItemUuids?: string[]
}

const props = withDefaults(defineProps<Props>(), {
	isBatch: false,
	duplicateItemUuids: () => [],
})

const emit = defineEmits<{
	select: [item: any]
	update: [item: any]
	viewFragment: [item: any]
	deleteItem: [item: any]
	batchDelete: [itemUuids: string[]]
	batchUpdate: [updates: Array<{ itemUuid: string; field: string; value: any }>]
}>()

const message = useMessage()
const dialog = useDialog()

const searchKeyword = ref('')
const filterLanguage = ref<string | null>(null)
const selectedItemUuid = ref<string | null>(null)
const selectedItemUuids = ref<string[]>([])
const loading = ref(false)
const showBatchEditModal = ref(false)
const batchEditField = ref<string | null>(null)
const batchEditValue = ref<any>(null)
const sortBy = ref<string>('title')
const sortOrder = ref<'asc' | 'desc'>('asc')

const pagination = reactive({
	page: 1,
	pageSize: 20,
	itemCount: 0,
	pageSizes: [10, 20, 30, 50],
})

const languageOptions = ref<any[]>([])
const severityOptions = ref<any[]>([])
const vulnerabilityTypeOptions = ref<any[]>([])

const riskAttackVectorOptions = [
	{ label: '远程', value: 'N', description: '可通过网络远程利用' },
	{ label: '本地', value: 'L', description: '需要本地访问' },
	{ label: '网络相邻', value: 'A', description: '需要同一网络环境' },
	{ label: '物理', value: 'P', description: '需要物理接触' },
]

const riskComplexityOptions = [
	{ label: '低', value: 'L', description: '利用条件简单，容易触发' },
	{ label: '高', value: 'H', description: '利用条件复杂，难以触发' },
]

const riskPrivilegesOptions = [
	{ label: '无需权限', value: 'N', description: '普通用户即可利用' },
	{ label: '需要权限', value: 'L', description: '需要登录或基本权限' },
	{ label: '高级权限', value: 'H', description: '需要管理员或系统权限' },
]

const riskUserInteractionOptions = [
	{ label: '无需交互', value: 'N', description: '无需用户操作即可利用' },
	{ label: '需要交互', value: 'R', description: '需要用户执行某些操作' },
]

function getDictLabel(options: any[], value?: string): string {
	if (!value) return ''
	const option = options.find((opt: any) => opt.value === value)
	return option ? option.label : value
}

//风险等级颜色映射（基于CVSS标准）
const severityColorMap: Record<string, string> = {
	'none': '#808080',
	'low': '#52c41a',
	'medium': '#faad14',
	'high': '#ff4d4f',
	'critical': '#cf1322'
}

function getDictColor(options: any[], value?: string, defaultColor: string = '#808080'): string {
	if (!value) return defaultColor
	const option = options.find((opt: any) => opt.value === value)
	if (!option) {
		//如果没有找到选项，尝试使用颜色映射
		return severityColorMap[value] || defaultColor
	}
	if (option.listClass) {
		const colorMatch = option.listClass.match(/#[0-9A-Fa-f]{6}/)
		if (colorMatch) return colorMatch[0]
	}
	if (option.cssClass) {
		const colorMatch = option.cssClass.match(/#[0-9A-Fa-f]{6}/)
		if (colorMatch) return colorMatch[0]
	}
	//如果字典中没有颜色，使用颜色映射
	return severityColorMap[value] || defaultColor
}

function getCweDisplayName(cweId: string): string {
	const option = vulnerabilityTypeOptions.value.find((opt: any) => opt.value === cweId)
	return option ? option.label : cweId
}

function calculateCvssScore(item: any): { exact: number | null, min: number | null, max: number | null, isComplete: boolean } | null {
	const av = item.cvssAttackVector || item.riskAttackVector
	const ac = item.cvssAttackComplexity || item.riskComplexity
	const pr = item.cvssPrivilegesRequired || item.riskPrivileges
	const ui = item.cvssUserInteraction || item.riskUserInteraction
	const impact = item.cvssImpact || item.riskImpact || []
	
	const avScores: Record<string, number> = { 'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2 }
	const acScores: Record<string, number> = { 'L': 0.77, 'H': 0.44 }
	const prScores: Record<string, number> = { 'N': 0.85, 'L': 0.62, 'H': 0.27 }
	const uiScores: Record<string, number> = { 'N': 0.85, 'R': 0.62 }
	const impactScores: Record<string, number> = { 'C': 0.22, 'I': 0.22, 'A': 0.22 }
	
	const isComplete = av && ac && pr && ui && impact && impact.length > 0
	
	if (!isComplete && !av && !ac && !pr && !ui && (!impact || impact.length === 0)) {
		if (item.cvssScore !== null && item.cvssScore !== undefined) {
			const score = typeof item.cvssScore === 'number' ? item.cvssScore : parseFloat(item.cvssScore)
			return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true }
		}
		return null
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
	
	if (isComplete) {
		return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true }
	} else {
		let maxPossibleScore = score
		if (!av) maxPossibleScore += avScores['N'] * 1.08
		if (!ac) maxPossibleScore += acScores['L'] * 1.08
		if (!pr) maxPossibleScore += prScores['N'] * 1.08
		if (!ui) maxPossibleScore += uiScores['N'] * 1.08
		if (!impact || impact.length === 0) maxPossibleScore += impactScores['C'] * 3 * 1.08
		maxPossibleScore = Math.min(10, maxPossibleScore)
		return {
			exact: null,
			min: Math.round(score * 10) / 10,
			max: Math.round(maxPossibleScore * 10) / 10,
			isComplete: false
		}
	}
}

function getItemCvssScore(item: any): { exact: number | null, min: number | null, max: number | null, isComplete: boolean } | null {
	return calculateCvssScore(item)
}

function getItemSeverity(item: any): string {
	const scoreResult = calculateCvssScore(item)
	if (scoreResult === null) {
		return item.severity || ''
	}
	const scoreValue = scoreResult.exact !== null ? scoreResult.exact : (scoreResult.max !== null ? scoreResult.max : 0)
	if (scoreValue === null || scoreValue === 0) {
		return item.severity || ''
	}
	if (scoreValue >= 9.0) return 'critical'
	if (scoreValue >= 7.0) return 'high'
	if (scoreValue >= 4.0) return 'medium'
	if (scoreValue >= 0.1) return 'low'
	return 'none'
}

function formatCvssScoreDisplay(scoreResult: { exact: number | null, min: number | null, max: number | null, isComplete: boolean } | null): string {
	if (!scoreResult) return ''
	if (scoreResult.exact !== null) {
		return scoreResult.exact.toFixed(1)
	}
	if (scoreResult.min !== null && scoreResult.max !== null) {
		return `${scoreResult.min.toFixed(1)} - ${scoreResult.max.toFixed(1)}`
	}
	return ''
}

function formatTimeAgo(timestamp?: number): string {
	if (!timestamp) return '-'
	try {
		const date = new Date(timestamp)
		const now = new Date()
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
		if (diffInSeconds < 60) return '刚刚'
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
		if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`
		return format(date, 'yyyy-MM-dd HH:mm')
	} catch (e) {
		return '-'
	}
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

function extractSnippet(text: string, keywords: string[], maxLength: number = 150): string {
	if (!text) return ''
	if (!keywords || keywords.length === 0) {
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
	}
	const lowerText = text.toLowerCase()
	let earliestIndex = -1
	for (const keyword of keywords) {
		const lowerKeyword = keyword.toLowerCase().trim()
		const index = lowerText.indexOf(lowerKeyword)
		if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
			earliestIndex = index
		}
	}
	if (earliestIndex === -1) {
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
	}
	const start = Math.max(0, earliestIndex - 30)
	const end = Math.min(text.length, earliestIndex + maxLength)
	let snippet = text.substring(start, end)
	if (start > 0) snippet = '...' + snippet
	if (end < text.length) snippet = snippet + '...'
	return snippet
}

const filteredItems = computed(() => {
	let result = props.items

	if (searchKeyword.value) {
		const keyword = searchKeyword.value.toLowerCase()
		result = result.filter(item => 
			item.title?.toLowerCase().includes(keyword) ||
			item.summary?.toLowerCase().includes(keyword) ||
			item.problemDescription?.toLowerCase().includes(keyword)
		)
	}

	if (filterLanguage.value) {
		result = result.filter(item => {
			const itemLang = item.language?.toLowerCase()
			const filterLang = filterLanguage.value?.toLowerCase()
			return itemLang === filterLang || 
				languageOptions.value.some(opt => 
					opt.value?.toLowerCase() === itemLang && opt.value === filterLanguage.value
				)
		})
	}

	return result
})

const sortOptions = computed(() => {
	const options = [
		{ label: '按标题排序', value: 'title' },
		{ label: '按风险等级排序', value: 'severity' },
		{ label: '按CVSS分数排序', value: 'cvssScore' },
		{ label: '按语言排序', value: 'language' },
	]
	if (searchKeyword.value.trim()) {
		options.unshift({ label: '按相关度排序', value: 'relevance' })
	}
	return options
})

watch(() => searchKeyword.value, (newKeyword) => {
	if (newKeyword.trim() && sortBy.value !== 'relevance') {
		sortBy.value = 'relevance'
		sortOrder.value = 'desc'
	} else if (!newKeyword.trim() && sortBy.value === 'relevance') {
		sortBy.value = 'title'
		sortOrder.value = 'asc'
	}
	pagination.page = 1
})

watch(() => filterLanguage.value, () => {
	pagination.page = 1
})

function getSortPlaceholder(): string {
	const currentOption = sortOptions.value.find(opt => opt.value === sortBy.value)
	return currentOption ? currentOption.label : '按标题排序'
}

function handleSortChange(value?: string) {
	if (value) {
		sortBy.value = value
	}
}

function toggleSortOrder() {
	sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function getSeverityOrder(severity?: string): number {
	const orderMap: Record<string, number> = {
		'critical': 0,
		'high': 1,
		'medium': 2,
		'low': 3,
		'none': 4,
	}
	return severity ? (orderMap[severity.toLowerCase()] ?? 99) : 99
}

function calculateRelevance(item: any, keyword: string): number {
	if (!keyword) return 0
	const lowerKeyword = keyword.toLowerCase()
	let score = 0
	if (item.title?.toLowerCase().includes(lowerKeyword)) {
		score += 10
		const index = item.title.toLowerCase().indexOf(lowerKeyword)
		if (index === 0) score += 5
	}
	if (item.summary?.toLowerCase().includes(lowerKeyword)) {
		score += 5
	}
	if (item.problemDescription?.toLowerCase().includes(lowerKeyword)) {
		score += 2
	}
	return score
}

const sortedItems = computed(() => {
	let result = [...filteredItems.value]
	
	if (sortBy.value === 'relevance' && searchKeyword.value.trim()) {
		result.sort((a, b) => {
			const aScore = calculateRelevance(a, searchKeyword.value)
			const bScore = calculateRelevance(b, searchKeyword.value)
			const comparison = bScore - aScore
			return sortOrder.value === 'asc' ? -comparison : comparison
		})
	} else if (sortBy.value === 'title') {
		result.sort((a, b) => {
			const aTitle = a.title || ''
			const bTitle = b.title || ''
			const comparison = aTitle.localeCompare(bTitle, 'zh-CN')
			return sortOrder.value === 'asc' ? comparison : -comparison
		})
	} else if (sortBy.value === 'severity') {
		result.sort((a, b) => {
			const aOrder = getSeverityOrder(a.severity)
			const bOrder = getSeverityOrder(b.severity)
			const comparison = aOrder - bOrder
			return sortOrder.value === 'asc' ? comparison : -comparison
		})
	} else if (sortBy.value === 'cvssScore') {
		result.sort((a, b) => {
			const aScore = a.cvssScore ? Number(a.cvssScore) : 0
			const bScore = b.cvssScore ? Number(b.cvssScore) : 0
			const comparison = bScore - aScore
			return sortOrder.value === 'asc' ? -comparison : comparison
		})
	} else if (sortBy.value === 'language') {
		result.sort((a, b) => {
			const aLang = a.language || ''
			const bLang = b.language || ''
			const comparison = aLang.localeCompare(bLang, 'zh-CN')
			return sortOrder.value === 'asc' ? comparison : -comparison
		})
	}
	
	return result
})

watch(() => sortedItems.value.length, (newLength) => {
	pagination.itemCount = newLength
	if (pagination.page > 1 && (pagination.page - 1) * pagination.pageSize >= newLength) {
		pagination.page = Math.max(1, Math.ceil(newLength / pagination.pageSize))
	}
}, { immediate: true })

const paginatedItems = computed(() => {
	const start = (pagination.page - 1) * pagination.pageSize
	const end = start + pagination.pageSize
	return sortedItems.value.slice(start, end)
})

function handleItemClick(item: any) {
	selectedItemUuid.value = item.itemUuid
	emit('select', item)
}

function handleViewFragment(item: any) {
	emit('viewFragment', item)
}

function handleDelete(item: any) {
	emit('deleteItem', item)
}

function toggleItemSelection(itemUuid: string, checked: boolean) {
	if (checked) {
		if (!selectedItemUuids.value.includes(itemUuid)) {
			selectedItemUuids.value.push(itemUuid)
		}
	} else {
		selectedItemUuids.value = selectedItemUuids.value.filter(id => id !== itemUuid)
	}
}

function handleSelectAll() {
	selectedItemUuids.value = sortedItems.value.map(item => item.itemUuid)
}

function handleDeselectAll() {
	selectedItemUuids.value = []
}

function handleInvertSelection() {
	const currentSelected = new Set(selectedItemUuids.value)
	selectedItemUuids.value = sortedItems.value
		.filter(item => !currentSelected.has(item.itemUuid))
		.map(item => item.itemUuid)
}

function handleBatchDelete() {
	if (selectedItemUuids.value.length === 0) {
		message.warning('请先选择要删除的条目')
		return
	}
	
	const count = selectedItemUuids.value.length
	dialog.warning({
		title: '确认批量删除',
		content: `确定要删除已选的 ${count} 个条目吗？删除后这些条目及其对应的知识片段将一并删除，且无法恢复。`,
		positiveText: '删除',
		negativeText: '取消',
		onPositiveClick: () => {
			emit('batchDelete', [...selectedItemUuids.value])
		}
	})
}

const batchEditOptions = computed(() => {
	const options: any[] = []
	if (languageOptions.value.length > 0) {
		options.push({
			label: '批量修改语言',
			key: 'language',
			children: languageOptions.value.map(opt => ({
				label: opt.label,
				key: `language:${opt.value}`,
				value: opt.value
			}))
		})
	}
	if (severityOptions.value.length > 0) {
		options.push({
			label: '批量修改风险等级',
			key: 'severity',
			children: severityOptions.value.map(opt => ({
				label: opt.label,
				key: `severity:${opt.value}`,
				value: opt.value
			}))
		})
	}
	options.push({
		label: '批量修改攻击方式',
		key: 'riskAttackVector',
		children: riskAttackVectorOptions.map(opt => ({
			label: opt.label,
			key: `riskAttackVector:${opt.value}`,
			value: opt.value
		}))
	})
	options.push({
		label: '批量修改利用复杂度',
		key: 'riskComplexity',
		children: riskComplexityOptions.map(opt => ({
			label: opt.label,
			key: `riskComplexity:${opt.value}`,
			value: opt.value
		}))
	})
	options.push({
		label: '批量修改权限需求',
		key: 'riskPrivileges',
		children: riskPrivilegesOptions.map(opt => ({
			label: opt.label,
			key: `riskPrivileges:${opt.value}`,
			value: opt.value
		}))
	})
	options.push({
		label: '批量修改用户交互',
		key: 'riskUserInteraction',
		children: riskUserInteractionOptions.map(opt => ({
			label: opt.label,
			key: `riskUserInteraction:${opt.value}`,
			value: opt.value
		}))
	})
	return options
})

function handleBatchEditSelect(key: string) {
	const [field, value] = key.split(':')
	if (!field || value === undefined) return
	
	const updates = selectedItemUuids.value.map(itemUuid => ({
		itemUuid,
		field,
		value
	}))
	
	emit('batchUpdate', updates)
}

async function loadOptions() {
	try {
		const [languagesRes, severitiesRes, cweRes] = await Promise.all([
			getDictDataByType('knowledge_language'),
			getDictDataByType('knowledge_severity'),
			getCweReferenceListAll()
		])

		languageOptions.value = ((languagesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
		}))

		severityOptions.value = ((severitiesRes as any)?.data || []).map((opt: any) => ({
			label: opt.dictLabel || opt.label || '',
			value: opt.dictValue || opt.value || '',
			listClass: opt.listClass || '',
			cssClass: opt.cssClass || '',
		}))

		vulnerabilityTypeOptions.value = ((cweRes as any)?.data || []).map((cwe: any) => ({
			label: `${cwe.cweId}: ${cwe.nameZh || cwe.nameEn || cwe.cweId}`,
			value: cwe.cweId,
		}))
	} catch (error) {
		console.error('加载选项数据失败:', error)
	}
}

onMounted(() => {
	loadOptions()
})
</script>

<style scoped>
.item-list {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.item-filters {
	padding: 12px;
	background: #FAF9F8;
	border-radius: 4px;
}

.list-content-area {
	flex: 1 1 auto;
	padding: 16px 24px;
	background: #FAF9F8;
	min-height: 0;
}

.list-content-area :deep(.n-list-item) {
	transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
	            transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	will-change: background-color, transform;
}

.list-content-area :deep(.n-list-item:hover) {
	background-color: #F3F2F1 !important;
	transform: translateX(2px);
}

.list-content-area :deep(.n-list-item:active) {
	transform: scale(0.995) translateX(2px);
}

.list-item-selected {
	background-color: #FFF7E6 !important;
	border-left: 3px solid #FA8C16;
	transform: translateX(2px);
	box-shadow: 0 2px 6px rgba(250, 140, 22, 0.12);
	transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.list-item-selected :deep(.n-list-item) {
	background-color: #FFF7E6 !important;
}

.list-item-duplicate {
	border-left: 3px solid #fa8c16;
	background-color: #fff7e6 !important;
}

.list-item-duplicate :deep(.n-list-item) {
	background-color: #fff7e6 !important;
}

.list-item-checked {
	background-color: #f0f7ff !important;
	border-left: 2px solid #1890ff;
}

.list-item-checked :deep(.n-list-item) {
	background-color: #f0f7ff !important;
}


.list-item-header {
	display: flex;
	align-items: center;
	gap: 12px;
	position: relative;
}

.severity-indicator {
	width: 4px;
	height: 100%;
	min-height: 48px;
	border-radius: 2px;
	flex-shrink: 0;
	transition: width 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.list-item-selected .severity-indicator {
	width: 5px;
}

.list-item-title {
	font-size: 15px;
	font-weight: 600;
	color: #323130;
	flex: 1;
	line-height: 1.4;
}

.list-item-content {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.list-item-snippet {
	font-size: 13px;
	color: #605E5C;
	line-height: 1.5;
	display: flex;
	gap: 4px;
}

.snippet-label {
	font-weight: 500;
	color: #323130;
	flex-shrink: 0;
}

.snippet-text {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
}

.list-item-meta {
	margin-top: 10px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.meta-main-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
	flex-wrap: wrap;
}

.meta-left {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-wrap: wrap;
	flex: 1;
	min-width: 0;
}

.meta-right {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-wrap: wrap;
	flex-shrink: 0;
}

.risk-badge {
	display: inline-block;
	padding: 3px 10px;
	border-radius: 4px;
	font-size: 12px;
	font-weight: 600;
	white-space: nowrap;
	margin-right: 6px;
}
.cvss-badge {
	border: 1px solid rgba(255, 255, 255, 0.3);
}
.severity-badge {
	display: inline-block;
	padding: 3px 10px;
	border-radius: 4px;
	font-size: 12px;
	font-weight: 600;
	white-space: nowrap;
	margin-right: 6px;
}
.manual-badge {
	border: 1px dashed rgba(255, 255, 255, 0.5);
	position: relative;
}
.manual-badge::before {
	content: '';
	position: absolute;
	left: -2px;
	top: -2px;
	right: -2px;
	bottom: -2px;
	border: 1px solid rgba(255, 255, 255, 0.3);
	border-radius: 4px;
	pointer-events: none;
}

.meta-time-row {
	display: flex;
	align-items: center;
	gap: 20px;
	font-size: 12px;
	padding-top: 4px;
}

.time-item {
	display: inline-flex;
	align-items: center;
	gap: 5px;
}

.time-create {
	color: #605E5C;
}

.time-update {
	color: #FA8C16;
}

.time-icon {
	font-size: 14px;
}

.time-create .time-icon {
	color: #8A8886;
}

.time-icon-update {
	color: #FA8C16;
}

.time-label {
	font-weight: 400;
	opacity: 0.85;
}

.time-value {
	font-weight: 500;
}

.list-skeleton {
	padding: 16px 0;
}

.list-skeleton-item {
	padding: 16px;
	background: #FFFFFF;
	border-radius: 4px;
	margin-bottom: 12px;
	border: 1px solid #F0F0F0;
}

.pagination-wrapper {
	display: flex;
	justify-content: center;
	padding: 16px 0;
	margin-top: 8px;
}
</style>

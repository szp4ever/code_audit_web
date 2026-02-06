<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch, nextTick, h, onBeforeMount } from "vue";
import {
	NButton,
	NInput,
	NSpace,
	useMessage,
	NGrid,
	NGi,
	NSelect,
	NPagination,
	NTag,
	NEmpty,
	NPopover,
	NSkeleton,
	NDataTable,
	NCheckbox,
	NCheckboxGroup,
	NTooltip,
	NModal,
} from "naive-ui";
import { SvgIcon } from "@/components/common";
import {
	getFragmentListByItem,
	type KnowledgeFragmentListQuery,
	type KnowledgeFragmentPageVo,
} from "@/api/knowledge";
import { getKnowledgeItemDetail } from "@/api/knowledgeItem";
import { useRouter, useRoute } from "vue-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import to from "await-to-js";
import FragmentInfoPanel from "@/views/knowledge/review/FragmentInfoPanel.vue";

const router = useRouter();
const route = useRoute();
const message = useMessage();

//路由参数
const itemUuid = computed(() => route.params.itemUuid as string);
const kid = computed(() => route.query.kid as string | undefined);

//数据状态
const initialLoading = ref(true);
const loading = ref(false);
const filterDataLoading = ref(true);
const tableData = ref<any[]>([]);
const total = ref(0);
const itemInfo = ref<any>(null);

//分页
const pagination = reactive({
	page: 1,
	pageSize: 20,
	itemCount: 0,
	pageSizes: [10, 20, 50, 100],
	onUpdatePage: (page: number) => {
		pagination.page = page;
		fetchData();
	},
	onUpdatePageSize: (pageSize: number) => {
		pagination.pageSize = pageSize;
		pagination.page = 1;
		fetchData();
	},
});

//搜索和筛选状态
const searchKeyword = ref('');
const searchDebounceTimer = ref<NodeJS.Timeout | null>(null);
const isSearching = ref(false);

const filterState = reactive<{
	docIds?: string[];
	orderBy?: 'idx' | 'create_time' | 'content_length';
	order?: 'asc' | 'desc';
}>({
	docIds: [],
	orderBy: 'idx',
	order: 'asc',
});

//分面筛选
const facetGroupCollapsed = reactive({
	attachment: false,
});

const facetAttachments = ref<string[]>([]);
const facetStats = ref<Record<string, number>>({});
const attachmentOptions = computed(() => {
	return Object.keys(facetStats.value).map(name => ({
		label: name,
		value: name,
		count: facetStats.value[name] || 0,
	}));
});

//是否有活动筛选
const hasActiveFilters = computed(() => {
	return searchKeyword.value.trim() !== '' || (facetAttachments.value.length > 0);
});

//活动筛选标签
const activeFilterTags = computed(() => {
	const tags: Array<{ key: string; label: string }> = [];
	if (searchKeyword.value.trim()) {
		tags.push({ key: 'search', label: `关键词：${searchKeyword.value}` });
	}
	if (facetAttachments.value.length > 0) {
		facetAttachments.value.forEach(docName => {
			tags.push({ key: `attachment_${docName}`, label: `附件：${docName}` });
		});
	}
	return tags;
});

//排序选项
const sortOptions = [
	{ label: '按片段索引', value: 'idx' },
	{ label: '按创建时间', value: 'create_time' },
	{ label: '按内容长度', value: 'content_length' },
];

function getSortPlaceholder(): string {
	const option = sortOptions.find(opt => opt.value === filterState.orderBy);
	return option ? option.label : '按片段索引';
}

function handleSortChange(value: string) {
	filterState.orderBy = value as any;
	fetchData();
}

function toggleSortOrder() {
	filterState.order = filterState.order === 'asc' ? 'desc' : 'asc';
	fetchData();
}

//搜索处理
function handleSearch() {
	if (searchDebounceTimer.value) {
		clearTimeout(searchDebounceTimer.value);
	}
	searchDebounceTimer.value = setTimeout(() => {
		pagination.page = 1;
		fetchData();
	}, 300);
}

watch(() => searchKeyword.value, () => {
	handleSearch();
});

//docName到docId的映射（从已加载的数据中建立）
const docNameToDocIdMap = ref<Map<string, string>>(new Map());

//筛选处理
function applyFacetFilters() {
	pagination.page = 1;
	fetchData();
}

function clearFacetFilters() {
	searchKeyword.value = '';
	facetAttachments.value = [];
	filterState.docIds = undefined;
	filterState.orderBy = 'idx';
	filterState.order = 'asc';
	pagination.page = 1;
	fetchData();
}

function removeFilterTag(key: string) {
	if (key === 'search') {
		searchKeyword.value = '';
	} else if (key.startsWith('attachment_')) {
		const docName = key.replace('attachment_', '');
		const index = facetAttachments.value.indexOf(docName);
		if (index > -1) {
			facetAttachments.value.splice(index, 1);
		}
		applyFacetFilters();
	}
	pagination.page = 1;
	fetchData();
}

//附件筛选全选
const attachmentSelectAllState = computed(() => {
	if (attachmentOptions.value.length === 0) return false;
	const selected = facetAttachments.value.length;
	if (selected === 0) return false;
	if (selected === attachmentOptions.value.length) return true;
	return null;
});

function toggleAttachmentSelectAll(checked: boolean) {
	if (checked) {
		facetAttachments.value = attachmentOptions.value.map(opt => opt.value);
	} else {
		facetAttachments.value = [];
	}
	applyFacetFilters();
}

//获取所有片段的docName到docId映射（用于筛选）
async function loadAllFragmentsForMapping() {
	try {
		const params: KnowledgeFragmentListQuery = {
			itemUuid: itemUuid.value,
			kid: kid.value,
			pageNum: 1,
			pageSize: 10000,
		};
		const [err, result] = await to(getFragmentListByItem(params));
		if (!err && result && result.code === 200) {
			const data = result.data || result
			const rows = data.rows || result.rows
			if (rows && rows.length > 0) {
				const map = new Map<string, string>();
				rows.forEach((fragment: any) => {
					if (fragment.docName && fragment.docId) {
						map.set(fragment.docName, fragment.docId);
					}
				});
				docNameToDocIdMap.value = map;
			}
		}
	} catch (error) {
		//忽略错误
	}
}

//获取数据
async function fetchData() {
	loading.value = true;
	isSearching.value = !!searchKeyword.value.trim();
	try {
		const docIds: string[] = [];
		if (facetAttachments.value.length > 0) {
			facetAttachments.value.forEach(docName => {
				const docId = docNameToDocIdMap.value.get(docName);
				if (docId) {
					docIds.push(docId);
				}
			});
		}
		const params: KnowledgeFragmentListQuery = {
			itemUuid: itemUuid.value,
			kid: kid.value,
			searchKeyword: searchKeyword.value.trim() || undefined,
			docIds: docIds.length > 0 ? docIds : undefined,
			orderBy: filterState.orderBy,
			order: filterState.order,
			pageNum: pagination.page,
			pageSize: pagination.pageSize,
		};
		const [err, result] = await to(getFragmentListByItem(params));
		if (err) {
			message.error(err.message || '获取片段列表失败');
			return;
		}
		if (result && result.code === 200) {
			const data = result.data || result
			const rows = data.rows || result.rows || []
			const totalCount = data.total !== undefined ? data.total : (result.total !== undefined ? result.total : 0)
			const facetStatsData = data.facetStats || result.facetStats
			tableData.value = rows
			total.value = totalCount
			pagination.itemCount = totalCount
			if (facetStatsData) {
				facetStats.value = facetStatsData;
			}
		} else {
			message.error(result?.msg || '获取片段列表失败');
		}
	} catch (error: any) {
		message.error(error?.message || '获取片段列表失败');
	} finally {
		loading.value = false;
		isSearching.value = false;
		filterDataLoading.value = false;
		if (initialLoading.value) {
			initialLoading.value = false;
		}
	}
}

//加载知识条目信息
async function loadItemInfo() {
	if (!itemUuid.value) return;
	try {
		const [err, result] = await to(getKnowledgeItemDetail(itemUuid.value));
		if (err) {
			return;
		}
		if (result && result.code === 200) {
			itemInfo.value = result.data || result;
		}
	} catch (error: any) {
		//忽略错误
	}
}

//查看附件详情
function handleViewAttachment(fragment: any) {
	if (fragment.attachId && kid.value) {
		router.push({
			path: '/knowledge/annex',
			query: {
				kid: kid.value,
				attachId: fragment.attachId,
			},
		});
	}
}

//返回（逻辑返回：返回到知识条目管理页）
function handleGoBack() {
	if (kid.value) {
		router.push({
			name: 'knowledgeItemList',
			query: { kid: kid.value },
		});
	} else {
		//如果没有kid，返回到知识库管理页
		router.push({
			name: 'knowledge1',
		});
	}
}

//格式化时间
function formatTimeAgo(date: string | Date | undefined): string {
	if (!date) return '-';
	try {
		return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN });
	} catch {
		return '-';
	}
}

//格式化内容预览
function formatContentPreview(content: string | undefined, maxLength: number = 150): string {
	if (!content) return '-';
	const trimmed = content.trim().replace(/\s+/g, ' ');
	if (trimmed.length <= maxLength) return trimmed;
	const lastSpace = trimmed.lastIndexOf(' ', maxLength);
	if (lastSpace > maxLength * 0.7) {
		return trimmed.substring(0, lastSpace) + '...';
	}
	return trimmed.substring(0, maxLength) + '...';
}

//高亮关键词（支持多个关键词）
function highlightText(text: string, keyword: string): string {
	if (!keyword || !text) return text;
	const keywords = keyword.trim().split(/\s+/).filter(k => k.length > 0);
	if (keywords.length === 0) return text;
	const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
	const regex = new RegExp(`(${escapedKeywords})`, 'gi');
	return text.replace(regex, '<mark>$1</mark>');
}

//表格列定义
const columns = computed(() => [
	{
		title: '片段索引',
		key: 'idx',
		width: 110,
		render: (row: any) => {
			const idx = row.idx !== null && row.idx !== undefined ? row.idx + 1 : '-';
			return h('div', { 
				style: 'display: flex; align-items: center; gap: 8px;' 
			}, [
				h('span', {
					style: 'display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, #F0F0F0 0%, #E8E8E8 100%); color: #605E5C; font-size: 12px; font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); transition: all 0.2s ease;',
					class: 'fragment-index-badge',
				}, idx),
			]);
		},
	},
	{
		title: '内容预览',
		key: 'content',
		minWidth: 400,
		render: (row: any) => {
			const content = row.content || '';
			const preview = formatContentPreview(content, 200);
			const fullContent = content;
			const contentElement = searchKeyword.value.trim() 
				? h('div', {
					innerHTML: highlightText(preview, searchKeyword.value.trim()),
					style: 'line-height: 1.7; color: #323130; font-size: 13px; word-break: break-word; cursor: pointer;',
					class: 'fragment-content-preview',
					onClick: () => handleViewFragment(row),
				})
				: h('span', { 
					style: 'line-height: 1.7; color: #323130; font-size: 13px; word-break: break-word; cursor: pointer;',
					class: 'fragment-content-preview',
					onClick: () => handleViewFragment(row),
				}, preview);
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
				});
			}
			return contentElement;
		},
	},
	{
		title: '来源附件',
		key: 'docName',
		minWidth: 200,
		render: (row: any) => {
			if (!row.docName) {
				return h('span', { 
					style: 'color: #8C8C8C; font-size: 13px; font-style: italic; display: inline-flex; align-items: center; gap: 4px;'
				}, [
					h(SvgIcon, {
						icon: 'ri:file-unknow-line',
						style: 'font-size: 14px; opacity: 0.6;',
					}),
					h('span', {}, '未关联附件'),
				]);
			}
			return h('div', { 
				style: 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;' 
			}, [
				h('span', {
					style: 'color: #1890ff; cursor: pointer; text-decoration: none; font-size: 13px; font-weight: 500; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px;',
					class: 'attachment-link',
					onMouseenter: (e: MouseEvent) => {
						(e.target as HTMLElement).style.backgroundColor = '#E6F7FF';
					},
					onMouseleave: (e: MouseEvent) => {
						(e.target as HTMLElement).style.backgroundColor = 'transparent';
					},
					onClick: () => handleViewAttachment(row),
				}, [
					h(SvgIcon, {
						icon: 'ri:file-line',
						style: 'font-size: 14px;',
					}),
					h('span', {
						style: 'max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
					}, row.docName),
				]),
				h(NTag, {
					size: 'small',
					type: 'info',
					bordered: false,
					style: 'margin-left: 0; font-size: 11px; font-weight: 500;',
				}, () => row.docType?.toUpperCase() || ''),
			]);
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
			]);
		},
	},
]);


//片段信息模态框
const showFragmentModal = ref(false);
const selectedFragment = ref<any>(null);

function handleViewFragment(fragment: any) {
	selectedFragment.value = fragment;
	showFragmentModal.value = true;
}

function getFragmentDocId(fragment: any): string | undefined {
	if (fragment.docId) {
		return fragment.docId;
	}
	if (fragment.docName) {
		return docNameToDocIdMap.value.get(fragment.docName);
	}
	return undefined;
}

onMounted(async () => {
	await loadItemInfo();
	await loadAllFragmentsForMapping();
	await fetchData();
});
</script>

<template>
	<div v-if="initialLoading" class="page-initial-loading">
		<div class="loading-spinner-wrapper">
			<div class="loading-spinner"></div>
			<div class="loading-spinner-inner"></div>
		</div>
		<div class="loading-content">
			<div class="loading-text">加载中...</div>
			<div class="loading-tips">正在加载知识片段</div>
		</div>
	</div>
	<div v-else class="fragment-list-page-layout">
		<!-- 主内容区 -->
		<div class="main-content-area">
			<!-- 顶部工具栏 -->
			<div class="page-toolbar">
				<div class="toolbar-left">
					<n-space align="center" :size="12">
						<n-button quaternary @click="handleGoBack" class="back-button">
							<template #icon>
								<SvgIcon icon="mage:arrow-left" />
							</template>
						</n-button>
						<h2 class="page-title">
							<span v-if="itemInfo">{{ itemInfo.title }} - </span>
							知识片段
						</h2>
						<n-tag v-if="total > 0" size="small" type="info" style="margin-left: 8px;">
							共 {{ total }} 个片段
						</n-tag>
					</n-space>
				</div>
			</div>

			<!-- 可滚动内容区域 -->
			<div class="scrollable-content">

				<!-- 搜索和筛选栏 -->
				<div class="filter-section">
					<!-- 搜索框（始终可见） -->
					<div class="filter-search-row">
						<n-input
							v-model:value="searchKeyword"
							placeholder="搜索片段内容..."
							clearable
							size="medium"
							style="flex: 1; max-width: 500px;"
						>
							<template #prefix>
								<SvgIcon :icon="isSearching ? 'ri:loader-4-line' : 'ri:search-line'" :class="{ 'search-loading': isSearching }" style="font-size: 16px; color: #8C8C8C;" />
							</template>
						</n-input>
						<n-space :size="8">
							<n-button 
								@click="clearFacetFilters" 
								secondary
								size="small"
								:disabled="!hasActiveFilters"
							>
								<template #icon>
									<SvgIcon icon="ri:refresh-line" />
								</template>
								恢复默认
							</n-button>
							<n-popover trigger="hover" placement="bottom">
								<template #trigger>
									<n-button @click="handleSortChange(filterState.orderBy || 'idx')" quaternary size="small">
										{{ getSortPlaceholder() }}
									</n-button>
								</template>
								<n-space vertical :size="8">
									<n-button
										v-for="option in sortOptions"
										:key="option.value"
										:type="filterState.orderBy === option.value ? 'primary' : 'default'"
										quaternary
										@click="handleSortChange(option.value)"
										style="width: 100%"
									>
										{{ option.label }}
									</n-button>
								</n-space>
							</n-popover>
							<n-button @click="toggleSortOrder" quaternary size="small">
								<template #icon>
									<SvgIcon :icon="filterState.order === 'asc' ? 'ri:arrow-up-line' : 'ri:arrow-down-line'" />
								</template>
							</n-button>
						</n-space>
					</div>

					<!-- 筛选选项组 -->
					<div v-if="filterDataLoading" class="facet-filters-row">
						<div v-for="i in 2" :key="i" class="facet-group-skeleton">
							<n-skeleton height="40px" :sharp="false" />
						</div>
					</div>
					<div v-else class="facet-filters-row">
						<!-- 来源附件筛选 -->
						<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.attachment }">
							<div class="facet-group-header" @click="facetGroupCollapsed.attachment = !facetGroupCollapsed.attachment">
								<n-space align="center" :size="8">
									<SvgIcon :icon="facetGroupCollapsed.attachment ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer; transition: transform 0.2s ease;" />
									<span class="facet-label">来源附件</span>
						<n-tag v-if="facetAttachments.length > 0" size="tiny" type="info" :bordered="false" style="margin-left: 4px; font-weight: 500;">
							{{ facetAttachments.length }}
						</n-tag>
								</n-space>
							</div>
							<div v-show="!facetGroupCollapsed.attachment" class="facet-group-content">
								<div class="facet-select-all-row">
									<n-checkbox 
										:checked="attachmentSelectAllState === true"
										:indeterminate="attachmentSelectAllState === null"
										@update:checked="toggleAttachmentSelectAll"
										size="small"
									>
										<span class="facet-select-all-label">全选</span>
									</n-checkbox>
								</div>
								<n-checkbox-group v-model:value="facetAttachments" @update:value="applyFacetFilters">
									<n-space :size="8" wrap>
										<n-checkbox
											v-for="option in attachmentOptions"
											:key="option.value"
											:value="option.value"
											size="small"
											class="facet-checkbox-item"
										>
											<span class="facet-option-label">{{ option.label }}</span>
											<span class="facet-option-count">({{ option.count }})</span>
										</n-checkbox>
									</n-space>
								</n-checkbox-group>
								<n-empty v-if="attachmentOptions.length === 0" description="暂无附件" size="small" style="margin-top: 12px;" />
							</div>
						</div>
					</div>

					<!-- 活动筛选标签 -->
					<div v-if="activeFilterTags.length > 0" class="filter-tags">
						<n-space :size="8" wrap>
							<n-tag
								v-for="tag in activeFilterTags"
								:key="tag.key"
								closable
								@close="removeFilterTag(tag.key)"
								size="small"
								type="info"
								:bordered="false"
							>
								{{ tag.label }}
							</n-tag>
						</n-space>
					</div>
				</div>

				<!-- 列表内容 -->
				<div class="list-content-area">
					<div v-if="loading" class="list-skeleton">
						<div v-for="i in 8" :key="i" class="list-skeleton-item">
							<n-skeleton height="24px" width="60%" style="margin-bottom: 8px;" />
							<n-skeleton text :repeat="2" />
							<n-skeleton height="20px" width="40%" style="margin-top: 8px;" />
						</div>
					</div>
					<div v-else-if="tableData.length > 0" class="table-wrapper">
						<div class="table-header-info" v-if="hasActiveFilters || searchKeyword.trim()">
							<n-space align="center" :size="8">
								<span class="table-info-text">已筛选出 {{ total }} 个片段</span>
								<n-button text size="tiny" @click="clearFacetFilters" type="primary">
									清除筛选
								</n-button>
							</n-space>
						</div>
						<n-data-table
							:columns="columns"
							:data="tableData"
							:loading="false"
							:bordered="false"
							:single-line="false"
							class="fragment-table"
						/>
					</div>
					<n-empty v-else description="暂无片段数据" style="padding: 60px 0;">
						<template #icon>
							<SvgIcon icon="ri:file-list-3-line" style="font-size: 64px; color: #D1D1D1;" />
						</template>
						<template #description>
							<div>
								<div>暂无片段数据</div>
								<div style="margin-top: 8px; font-size: 12px; color: #999; font-family: monospace;">
									{{ `tableData长度: ${tableData.length}, total: ${total}, loading: ${loading}` }}
								</div>
							</div>
						</template>
						<template #extra>
							<n-button v-if="hasActiveFilters" @click="clearFacetFilters" size="small" type="primary">
								清除筛选条件
							</n-button>
						</template>
					</n-empty>

					<!-- 分页 -->
					<div v-if="!loading && tableData.length > 0" class="list-pagination">
						<n-pagination
							v-model:page="pagination.page"
							:item-count="pagination.itemCount"
							v-model:page-size="pagination.pageSize"
							:page-sizes="pagination.pageSizes"
							show-size-picker
							@update:page="pagination.onUpdatePage"
							@update:page-size="pagination.onUpdatePageSize"
						/>
					</div>
				</div>
			</div>
		</div>
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
				v-if="selectedFragment"
				:item="selectedFragment"
				:doc-id="getFragmentDocId(selectedFragment)"
			/>
		</n-modal>
	</div>
</template>

<style scoped>
/* 初始加载状态 */
.page-initial-loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100vh;
	width: 100vw;
	background: #FAF9F8;
	position: relative;
	overflow: hidden;
}

.page-initial-loading::before {
	content: '';
	position: absolute;
	width: 400px;
	height: 400px;
	background: radial-gradient(circle, rgba(237, 235, 233, 0.5) 0%, transparent 70%);
	border-radius: 50%;
	animation: pulse 4s ease-in-out infinite;
}

.loading-spinner-wrapper {
	position: relative;
	width: 120px;
	height: 120px;
	margin-bottom: 40px;
	z-index: 1;
}

.loading-spinner {
	position: absolute;
	width: 100%;
	height: 100%;
	border: 4px solid #EDEBE9;
	border-top: 4px solid #f59e0b;
	border-radius: 50%;
	animation: spin 1s linear infinite;
	box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
}

.loading-spinner-inner {
	position: absolute;
	width: 80%;
	height: 80%;
	top: 10%;
	left: 10%;
	border: 4px solid #EDEBE9;
	border-bottom: 4px solid #107C10;
	border-radius: 50%;
	animation: spin 1.5s linear infinite reverse;
	box-shadow: 0 0 15px rgba(16, 124, 16, 0.15);
}

.loading-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	z-index: 1;
}

.loading-text {
	font-size: 24px;
	font-weight: 600;
	color: #323130;
	letter-spacing: 2px;
	animation: fadeInOut 2s ease-in-out infinite;
}

.loading-tips {
	font-size: 14px;
	color: #605E5C;
}

/* 主布局 */
.fragment-list-page-layout {
	display: flex;
	flex-direction: column;
	height: 100vh;
	width: 100%;
	overflow: hidden;
	background: var(--n-color-body, #FAF9F8);
}

.main-content-area {
	flex: 1 1 auto;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	min-width: 0;
}

.page-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 16px 24px;
	background: #FFFFFF;
	border-bottom: 1px solid #EDEBE9;
	flex-shrink: 0;
}

.toolbar-left {
	display: flex;
	align-items: center;
}

.back-button {
	margin-right: 8px;
}

.page-title {
	font-size: 20px;
	font-weight: 600;
	color: #323130;
	margin: 0;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px;
}

.page-title-prefix {
	color: #605E5C;
	font-weight: 500;
	max-width: 300px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.page-title-separator {
	color: #8C8C8C;
	font-weight: 400;
}

.page-title-main {
	color: #323130;
	font-weight: 600;
}

.scrollable-content {
	flex: 1 1 auto;
	overflow-y: auto;
	overflow-x: hidden;
	display: flex;
	flex-direction: column;
	min-height: 0;
	scroll-behavior: smooth;
}

.scrollable-content::-webkit-scrollbar {
	width: 8px;
}

.scrollable-content::-webkit-scrollbar-track {
	background: #F5F5F5;
}

.scrollable-content::-webkit-scrollbar-thumb {
	background-color: rgba(0, 0, 0, 0.12);
	border-radius: 4px;
	transition: background-color 0.2s ease;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
	background-color: rgba(0, 0, 0, 0.2);
}

/* 筛选区域 */
.filter-section {
	background: #FFFFFF;
	border-bottom: 1px solid #EDEBE9;
	padding: 10px 20px 12px;
	flex-shrink: 0;
}

.filter-search-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 10px;
	max-width: 100%;
	width: 100%;
}

.facet-filters-row {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 12px;
	max-width: 100%;
	width: 100%;
}

.facet-group {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px 16px;
	background: #FAF9F8;
	border-radius: 6px;
	border: 1px solid #EDEBE9;
	transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.facet-group:hover {
	background: #F5F5F5;
	border-color: #D1D1D1;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
	transform: translateY(-1px);
}

.facet-group-header {
	display: flex;
	align-items: center;
	cursor: pointer;
	user-select: none;
	padding: 4px 0;
	transition: all 0.2s ease;
	border-radius: 4px;
}

.facet-group-header:hover {
	color: #1890ff;
	background-color: rgba(24, 144, 255, 0.04);
	padding-left: 4px;
	padding-right: 4px;
	margin-left: -4px;
	margin-right: -4px;
}

.facet-label {
	font-size: 14px;
	font-weight: 500;
	color: #323130;
}

.facet-group-content {
	padding-top: 12px;
	animation: expandDown 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.facet-select-all-row {
	padding-bottom: 8px;
	border-bottom: 1px solid #F0F0F0;
	margin-bottom: 8px;
}

.facet-select-all-label {
	font-weight: 500;
	color: #262626;
}

.facet-select-all-count {
	font-size: 12px;
	color: #8C8C8C;
	margin-left: 4px;
	font-weight: 400;
}

.facet-checkbox-item {
	transition: all 0.2s ease;
	padding: 2px 4px;
	border-radius: 4px;
}

.facet-checkbox-item:hover {
	background-color: rgba(24, 144, 255, 0.06);
	transform: translateX(2px);
}

.facet-option-label {
	font-size: 13px;
	color: #323130;
	margin-right: 4px;
}

.facet-option-count {
	font-size: 12px;
	color: #8C8C8C;
	font-weight: 400;
}

.filter-tags {
	margin-top: 12px;
	padding-top: 12px;
	border-top: 1px solid #F0F0F0;
}

/* 列表内容区域 */
.list-content-area {
	flex: 1 1 auto;
	padding: 20px 24px;
	background: #FAF9F8;
	min-height: 0;
	overflow-y: auto;
}

.list-skeleton {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.list-skeleton-item {
	padding: 16px;
	background: #FFFFFF;
	border-radius: 4px;
	border: 1px solid #EDEBE9;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.table-wrapper {
	background: #FFFFFF;
	border-radius: 4px;
	overflow: hidden;
	border: 1px solid #EDEBE9;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.fragment-table {
	background: transparent;
}

.fragment-table :deep(.n-data-table-th) {
	background-color: #FAF9F8;
	border-bottom: 2px solid #EDEBE9;
	font-weight: 600;
	color: #323130;
	padding: 14px 16px;
	font-size: 13px;
	letter-spacing: 0.3px;
}

.fragment-table :deep(.n-data-table-th:first-child) {
	padding-left: 20px;
}

.fragment-table :deep(.n-data-table-th:last-child) {
	padding-right: 20px;
}

.fragment-table :deep(.n-data-table-td) {
	padding: 14px 16px;
	border-bottom: 1px solid #F0F0F0;
	transition: background-color 0.15s ease;
}

.fragment-table :deep(.n-data-table-td:first-child) {
	padding-left: 20px;
}

.fragment-table :deep(.n-data-table-td:last-child) {
	padding-right: 20px;
}

.fragment-table :deep(.n-data-table-tr) {
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	cursor: default;
	position: relative;
}

.fragment-table :deep(.n-data-table-tr::before) {
	content: '';
	position: absolute;
	left: 0;
	top: 0;
	bottom: 0;
	width: 3px;
	background-color: transparent;
	transition: background-color 0.2s ease;
}

.fragment-table :deep(.n-data-table-tr:hover) {
	background-color: #F8F9FA !important;
}

.fragment-table :deep(.n-data-table-tr:hover::before) {
	background-color: #1890ff;
}

.fragment-table :deep(.n-data-table-tr:hover .n-data-table-td) {
	background-color: #F8F9FA !important;
}

.fragment-table :deep(.n-data-table-tr:active) {
	background-color: #F0F0F0 !important;
	transform: scale(0.998);
}

.fragment-table :deep(.n-data-table-tr:active .n-data-table-td) {
	background-color: #F0F0F0 !important;
}

.fragment-content-preview {
	word-break: break-word;
}

.fragment-content-preview :deep(mark) {
	background-color: #FFFBE6;
	color: #AD6800;
	padding: 2px 4px;
	border-radius: 3px;
	font-weight: 500;
	box-shadow: 0 1px 2px rgba(173, 104, 0, 0.1);
}

.attachment-link {
	transition: all 0.2s ease;
	position: relative;
}

.attachment-link:hover {
	text-decoration: underline;
	color: #40a9ff !important;
}

.fragment-index-badge:hover {
	background: linear-gradient(135deg, #E0E0E0 0%, #D8D8D8 100%) !important;
	transform: translateY(-1px);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.list-pagination {
	margin-top: 24px;
	padding-top: 20px;
	border-top: 1px solid #EDEBE9;
	display: flex;
	justify-content: center;
	align-items: center;
}

/* 动画 */
@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

@keyframes pulse {
	0%, 100% {
		opacity: 0.4;
		transform: scale(1);
	}
	50% {
		opacity: 0.6;
		transform: scale(1.1);
	}
}

@keyframes fadeInOut {
	0%, 100% {
		opacity: 0.6;
	}
	50% {
		opacity: 1;
	}
}

@keyframes expandDown {
	from {
		opacity: 0;
		transform: translateY(-8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.search-loading {
	animation: spin 1s linear infinite;
}

/* 响应式设计 */
@media (max-width: 768px) {
	.facet-filters-row {
		grid-template-columns: 1fr;
	}
	
	.filter-search-row {
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}
	
	.filter-search-row > :first-child {
		width: 100%;
		max-width: 100%;
	}
	
	.page-toolbar {
		padding: 12px 16px;
	}
	
	.page-title {
		font-size: 18px;
	}
	
	.page-title-prefix {
		max-width: 200px;
	}
	
	.list-content-area {
		padding: 16px;
	}
	
	.fragment-table :deep(.n-data-table-th),
	.fragment-table :deep(.n-data-table-td) {
		padding: 10px 12px;
		font-size: 12px;
	}
	
	.fragment-table :deep(.n-data-table-th:first-child),
	.fragment-table :deep(.n-data-table-td:first-child) {
		padding-left: 12px;
	}
	
	.fragment-table :deep(.n-data-table-th:last-child),
	.fragment-table :deep(.n-data-table-td:last-child) {
		padding-right: 12px;
	}
}
</style>

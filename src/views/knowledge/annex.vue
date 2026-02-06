<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch, nextTick, onUnmounted, h } from "vue";
import {
	NButton,
	NDrawer,
	NDrawerContent,
	NForm,
	NFormItem,
	NInput,
	NSpace,
	useMessage,
	useDialog,
	NGrid,
	NGi,
	NSelect,
	NPagination,
	NTag,
	NEmpty,
	NPopover,
	NCollapse,
	NCollapseItem,
	NSkeleton,
	NDivider,
	NModal,
	FormInst,
	FormRules,
	NList,
	NListItem,
	NThing,
	NCheckbox,
	NCheckboxGroup,
	NRadio,
	NRadioGroup,
	NDatePicker,
	NSlider,
	NTooltip,
	NDataTable,
	NSpin,
	NUpload,
	NUploadDragger,
	NP,
	NProgress,
	NCard,
	NDescriptions,
	NDescriptionsItem,
	NIcon,
	NAlert,
} from "naive-ui";
import { SvgIcon, GlobalUploadTrigger, GlobalUploadManager } from "@/components/common";
import { getToken } from "@/store/modules/auth/helper";
import { useUploadStore } from "@/store/modules/upload";
import { uploadService } from "@/services/uploadService";
import {
	getKnowledgeAttachList,
	getKnowledgeAttachInfo,
	downloadKnowledgeAttach,
	reprocessKnowledgeAttach,
	delKnowledgeDetail,
	uploadKnowledgeAttach,
	getItemCountDistribution,
	getAttachFacetStats,
	getAttachProcessStatus,
	type KnowledgeAttachListQuery,
} from "@/api/knowledge";
import { getfragmentList, getFragmentListByItem } from "@/api/knowledge";
import { getUserInfo } from "@/api/user";
import { useRouter, useRoute } from "vue-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import to from "await-to-js";
import { eventBus } from "@/utils/eventBus";
import FragmentInfoPanel from "@/views/knowledge/review/FragmentInfoPanel.vue";
import ItemDetailPanel from "@/views/knowledge/review/ItemDetailPanel.vue";
import ItemList from "@/views/knowledge/review/ItemList.vue";
import { getKnowledgeItemDetail, getKnowledgeItemList, deleteKnowledgeItem } from "@/api/knowledgeItem";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const token = getToken();
const headers = { Authorization: `Bearer ${token}` };
const uploadStore = useUploadStore();
const uploadManagerRef = ref<InstanceType<typeof GlobalUploadManager> | null>(null);

//详情面板
const showDetailPanel = ref(false);
const detailItem = ref<any>(null);
const detailLoading = ref(false);
const selectedAttachId = ref<number | null>(null);
const isMobile = ref(false);
const showDetailInMobile = ref(false);
const detailPanelCollapsed = ref(false);

//状态管理
const kid = ref<string>("");
const initialLoading = ref(true);
const loading = ref(false);
const filterDataLoading = ref(true);
const tableData = ref<any[]>([]);
const total = ref(0);
const currentUserId = ref<number | null>(null);


//视图模式
const viewMode = ref<'list' | 'card' | 'timeline'>('list');

//筛选状态
const filterState = reactive<KnowledgeAttachListQuery>({
	kid: undefined,
	docId: undefined,
	docName: undefined,
	docType: undefined,
	createTimeStart: undefined,
	createTimeEnd: undefined,
	picStatusList: undefined,
	picAnysStatusList: undefined,
	vectorStatusList: undefined,
	createByList: undefined,
	orderBy: 'create_time',
	order: 'desc',
});

//分面筛选
const facetGroupCollapsed = reactive({
	docType: false,
	itemCount: false,
	time: false,
	fileSize: false,
	fragmentCount: false,
	creator: false,
});

const facetDocTypes = ref<string[]>([]);
const facetPicStatuses = ref<number[]>([]);
const facetPicAnysStatuses = ref<number[]>([]);
const facetVectorStatuses = ref<number[]>([]);
const facetCreators = ref<string[]>([]);
const facetDateRange = ref<[number, number] | null>(null);
const facetItemCountRange = ref<string | null>(null);

const facetOptions = ref<{
	docTypes: string[];
	creators: string[];
	itemCountRanges: Array<{ label: string; min: number; max: number }>;
}>({
	docTypes: [],
	creators: [],
	itemCountRanges: [],
});

function handleItemCountRangeChange(value: string | null) {
	facetItemCountRange.value = value;
	applyFacetFilters();
}

function getRangeFromKey(key: string | null): [number, number] | null {
	if (!key) return null;
	const parts = key.split('-');
	if (parts.length === 2) {
		return [parseInt(parts[0]), parseInt(parts[1])];
	}
	return null;
}

//统计信息
const facetStats = ref<any>(null);

//搜索关键词
const searchKeyword = ref("");
const isSearching = ref(false);

//分页
const pagination = reactive({
	page: 1,
	pageSize: 20,
	showSizePicker: true,
	pageSizes: [10, 20, 30, 50],
	itemCount: 0,
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

onUnmounted(() => {
	stopProcessingPolling();
	uploadService.stopAllPolling();
});

//上传相关
const showUploadModal = ref(false);
const autoCreateItems = ref(true);
const autoClassify = ref(true);
const uploadFiles = ref<Map<string, { file: File; progress: number; status: 'waiting' | 'uploading' | 'success' | 'error'; error?: string; result?: any; xhr?: XMLHttpRequest }>>(new Map());
const uploadProgress = ref<Map<string, number>>(new Map());
const uploadStatus = ref<Map<string, 'waiting' | 'uploading' | 'success' | 'error'>>(new Map());
const processingFiles = ref<Map<string, { attachId: number; docId: string; fileName: string; status: any }>>(new Map());
const processingPollingTimer = ref<number | null>(null);
const uploadComplete = ref(false);
const uploadResults = ref<any[]>([]);
const isUploading = ref(false);
const showFileValidationModal = ref(false);
const invalidFiles = ref<File[]>([]);
const validFiles = ref<File[]>([]);

//批量操作
const selectedAttachIds = ref<number[]>([]);
const showBatchToolbar = computed(() => selectedAttachIds.value.length > 0);

//状态选项
const statusOptions = [
	{ label: '未开始', value: 10 },
	{ label: '进行中', value: 20 },
	{ label: '已完成', value: 30 },
];

const docTypeOptions = ref<any[]>([]);

//格式化时间
function formatTimeAgo(date: string | Date): string {
	if (!date) return '-';
	try {
		return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN });
	} catch {
		return '-';
	}
}

//格式化文件大小
function formatFileSize(bytes: number | null | undefined): string {
	if (!bytes || bytes === 0) return '-';
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = bytes;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}
	return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
}

//获取状态标签
function getStatusLabel(status: number | null | undefined, type: 'pic' | 'picAnys' | 'vector'): string {
	if (status === null || status === undefined) return '-';
	const labels: Record<number, string> = {
		10: '未开始',
		20: '进行中',
		30: '已完成',
	};
	return labels[status] || '-';
}

function getStatusColor(status: number | null | undefined): string {
	if (status === null || status === undefined) return '#808080';
	if (status === 10) return '#808080';
	if (status === 20) return '#FA8C16';
	if (status === 30) return '#52C41A';
	return '#808080';
}

//获取文件类型图标
function getFileTypeIcon(docType: string | null | undefined): string {
	if (!docType) return 'ri:file-line';
	const type = docType.toLowerCase();
	if (['pdf'].includes(type)) return 'ri:file-pdf-2-line';
	if (['doc', 'docx'].includes(type)) return 'ri:file-word-2-line';
	if (['xls', 'xlsx'].includes(type)) return 'ri:file-excel-2-line';
	if (['txt', 'md'].includes(type)) return 'ri:file-text-line';
	return 'ri:file-line';
}

//获取文件类型颜色
function getFileTypeColor(docType: string | null | undefined): string {
	if (!docType) return '#808080';
	const type = docType.toLowerCase();
	if (['pdf'].includes(type)) return '#F5222D';
	if (['doc', 'docx'].includes(type)) return '#1890FF';
	if (['xls', 'xlsx'].includes(type)) return '#52C41A';
	if (['txt', 'md'].includes(type)) return '#722ED1';
	return '#808080';
}

//获取数据
async function fetchData() {
	loading.value = true;
	isSearching.value = true;
	try {
		const params: KnowledgeAttachListQuery = {
			...filterState,
			kid: kid.value,
			docName: searchKeyword.value.trim() || undefined,
			pageNum: pagination.page,
			pageSize: pagination.pageSize,
			orderBy: filterState.orderBy,
			order: filterState.order,
			createTimeStart: facetDateRange.value ? format(new Date(facetDateRange.value[0]), 'yyyy-MM-dd HH:mm:ss') : undefined,
			createTimeEnd: facetDateRange.value ? format(new Date(facetDateRange.value[1]), 'yyyy-MM-dd HH:mm:ss') : undefined,
			picStatusList: facetPicStatuses.value.length > 0 ? facetPicStatuses.value : undefined,
			picAnysStatusList: facetPicAnysStatuses.value.length > 0 ? facetPicAnysStatuses.value : undefined,
			vectorStatusList: facetVectorStatuses.value.length > 0 ? facetVectorStatuses.value : undefined,
			createByList: facetCreators.value.length > 0 ? facetCreators.value : undefined,
			itemCountMin: facetItemCountRange.value ? getRangeFromKey(facetItemCountRange.value)?.[0] : undefined,
			itemCountMax: facetItemCountRange.value ? getRangeFromKey(facetItemCountRange.value)?.[1] : undefined,
		};
		const [err, result] = await to(getKnowledgeAttachList(params));
		if (err) {
			message.error(err.message || '获取附件列表失败');
		} else {
			if (result && (result.code === 200 || result.code === 0)) {
				const rows = result.rows || result.data?.rows || result.data || [];
				const totalCount = result.total || result.data?.total || 0;
				tableData.value = Array.isArray(rows) ? rows : [];
				total.value = totalCount;
				pagination.itemCount = totalCount;
				fetchFacetStats();
			} else {
				message.error(result?.msg || '获取附件列表失败');
			}
		}
	} catch (error: any) {
		message.error(error?.message || '获取附件列表失败');
	} finally {
		loading.value = false;
		isSearching.value = false;
	}
}

//处理上传任务完成事件，智能刷新列表
function handleTaskCompleted(eventData: { taskId: string; kid: string; attachId: number }) {
	//检查当前路由是否为附件管理页
	if (route.path !== '/knowledge/annex') {
		return;
	}
	//检查kid是否匹配
	if (eventData.kid !== kid.value) {
		return;
	}
	//防抖处理：清除之前的定时器
	if (refreshDebounceTimer) {
		clearTimeout(refreshDebounceTimer);
	}
	//延迟刷新，避免频繁刷新
	refreshDebounceTimer = setTimeout(() => {
		fetchData();
		refreshDebounceTimer = null;
	}, 500);
}

//计算分位数
function calculatePercentile(sortedArray: number[], percentile: number): number {
	if (sortedArray.length === 0) return 0;
	const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
	return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

//计算IQR（四分位距）
function calculateIQR(sortedArray: number[]): number {
	if (sortedArray.length < 4) return 0;
	const q1 = calculatePercentile(sortedArray, 25);
	const q3 = calculatePercentile(sortedArray, 75);
	return q3 - q1;
}

//使用Freedman-Diaconis规则计算最优bin数量
function calculateOptimalBins(data: number[]): number {
	if (data.length === 0) return 1;
	if (data.length === 1) return 1;
	
	const sortedData = [...data].sort((a, b) => a - b);
	const iqr = calculateIQR(sortedData);
	const min = sortedData[0];
	const max = sortedData[sortedData.length - 1];
	const range = max - min;
	
	if (range === 0) return 1;
	if (iqr === 0) {
		const binWidth = Math.ceil(range / Math.cbrt(data.length));
		return Math.max(2, Math.min(10, Math.ceil(range / binWidth)));
	}
	
	const binWidth = 2 * iqr / Math.cbrt(data.length);
	const bins = Math.ceil(range / binWidth);
	
	return Math.max(3, Math.min(12, bins));
}

//使用equiprobable分布算法生成智能范围
function generateItemCountRanges(itemCounts: number[]): Array<{ label: string; range: [number, number]; count: number }> {
	if (itemCounts.length === 0) return [];
	
	const sortedCounts = [...itemCounts].sort((a, b) => a - b);
	const zeroCount = sortedCounts.filter(c => c === 0).length;
	const nonZeroCounts = sortedCounts.filter(c => c > 0);
	
	const ranges: Array<{ label: string; range: [number, number]; count: number }> = [];
	
	if (zeroCount > 0) {
		ranges.push({ label: '0个条目', range: [0, 0], count: zeroCount });
	}
	
	if (nonZeroCounts.length === 0) {
		return ranges;
	}
	
	const optimalBins = calculateOptimalBins(nonZeroCounts);
	const targetRanges = Math.max(3, Math.min(optimalBins, 10));
	const itemsPerRange = Math.ceil(nonZeroCounts.length / targetRanges);
	
	for (let i = 0; i < targetRanges; i++) {
		const startIdx = i * itemsPerRange;
		const endIdx = Math.min((i + 1) * itemsPerRange, nonZeroCounts.length);
		
		if (startIdx >= nonZeroCounts.length) break;
		
		const rangeMin = nonZeroCounts[startIdx];
		const rangeMax = nonZeroCounts[endIdx - 1];
		
		if (rangeMin === rangeMax) {
			ranges.push({
				label: `${rangeMin}个条目`,
				range: [rangeMin, rangeMax],
				count: endIdx - startIdx
			});
		} else {
			ranges.push({
				label: `${rangeMin}-${rangeMax}个条目`,
				range: [rangeMin, rangeMax],
				count: endIdx - startIdx
			});
		}
	}
	
	return ranges.filter(r => r.count > 0);
}

const itemCountRanges = ref<Array<{ label: string; range: [number, number]; count: number }>>([]);

//从后端获取分面统计（筛选选项和计数）
async function fetchFacetStats() {
	try {
		const params: KnowledgeAttachListQuery = {
			...filterState,
			kid: kid.value,
			docName: searchKeyword.value.trim() || undefined,
			createTimeStart: facetDateRange.value ? format(new Date(facetDateRange.value[0]), 'yyyy-MM-dd HH:mm:ss') : undefined,
			createTimeEnd: facetDateRange.value ? format(new Date(facetDateRange.value[1]), 'yyyy-MM-dd HH:mm:ss') : undefined,
			picStatusList: facetPicStatuses.value.length > 0 ? facetPicStatuses.value : undefined,
			picAnysStatusList: facetPicAnysStatuses.value.length > 0 ? facetPicAnysStatuses.value : undefined,
			vectorStatusList: facetVectorStatuses.value.length > 0 ? facetVectorStatuses.value : undefined,
			createByList: facetCreators.value.length > 0 ? facetCreators.value : undefined,
			itemCountMin: facetItemCountRange.value ? getRangeFromKey(facetItemCountRange.value)?.[0] : undefined,
			itemCountMax: facetItemCountRange.value ? getRangeFromKey(facetItemCountRange.value)?.[1] : undefined,
		};
		const response = await getAttachFacetStats(params);
		if (response.code === 200 && response.data) {
			const data = response.data;
			
			if (data.options) {
				facetOptions.value.docTypes = Array.from(data.options.docTypes || []);
				facetOptions.value.creators = Array.from(data.options.creators || []);
				if (data.options.itemCountRanges) {
					facetOptions.value.itemCountRanges = data.options.itemCountRanges.map((r: any) => ({
						label: r.label,
						min: r.min,
						max: r.max,
					}));
					itemCountRanges.value = data.options.itemCountRanges.map((r: any) => ({
						label: r.label,
						range: [r.min, r.max] as [number, number],
						count: 0,
					}));
				}
			}
			
			if (data.counts) {
				facetStats.value = {
					docTypes: data.counts.docTypes || {},
					picStatuses: data.counts.picStatuses || {},
					picAnysStatuses: data.counts.picAnysStatuses || {},
					vectorStatuses: data.counts.vectorStatuses || {},
					creators: data.counts.creators || {},
					itemCounts: data.counts.itemCounts || {},
				};
				
				if (data.counts.itemCounts && itemCountRanges.value.length > 0) {
					itemCountRanges.value.forEach(range => {
						const rangeKey = range.range[0] === range.range[1] ? `${range.range[0]}` : `${range.range[0]}-${range.range[1]}`;
						range.count = data.counts.itemCounts[rangeKey] || 0;
					});
				}
			}
			
			docTypeOptions.value = facetOptions.value.docTypes.map(type => ({ label: type.toUpperCase(), value: type }));
		}
	} catch (error) {
		//忽略错误
	}
}



//应用筛选
function applyFacetFilters() {
	pagination.page = 1;
	fetchData();
}

//清除筛选
function clearFacetFilters() {
	searchKeyword.value = '';
	facetDocTypes.value = [];
	facetPicStatuses.value = [];
	facetPicAnysStatuses.value = [];
	facetVectorStatuses.value = [];
	facetCreators.value = [];
	facetDateRange.value = null;
	facetItemCountRange.value = null;
	applyFacetFilters();
}

//是否有活动筛选
const hasActiveFilters = computed(() => {
	return searchKeyword.value.trim() !== '' ||
		facetDocTypes.value.length > 0 ||
		facetPicStatuses.value.length > 0 ||
		facetPicAnysStatuses.value.length > 0 ||
		facetVectorStatuses.value.length > 0 ||
		facetCreators.value.length > 0 ||
		facetDateRange.value !== null ||
		facetItemCountRange.value !== null;
});

//打开详情面板
async function openDetailPanel(item: any) {
	selectedAttachId.value = item.id;
	detailLoading.value = true;
	try {
		const [err, result] = await to(getKnowledgeAttachInfo(item.id));
		if (err) {
			message.error(err.message || '获取附件详情失败');
		} else {
			if (result && result.code === 200) {
				detailItem.value = result.data || result;
			} else if (result && result.data) {
				detailItem.value = result.data;
			} else {
				detailItem.value = result;
			}
			showDetailPanel.value = true;
			if (isMobile.value) {
				showDetailInMobile.value = true;
			}
		}
	} catch (error: any) {
		message.error(error?.message || '获取附件详情失败');
	} finally {
		detailLoading.value = false;
	}
}

//关闭详情面板
function closeDetailPanel() {
	if (isMobile.value) {
		showDetailInMobile.value = false;
	}
	selectedAttachId.value = null;
	detailItem.value = null;
	showDetailPanel.value = false;
}

//下载附件
async function handleDownload(item: any) {
	try {
		const response: any = await downloadKnowledgeAttach(item.id);
		if (response instanceof Blob) {
			const url = window.URL.createObjectURL(response);
			const link = document.createElement('a');
			link.href = url;
			link.download = item.docName || 'download';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
			message.success('下载成功');
		} else if (response && response.data instanceof Blob) {
			const url = window.URL.createObjectURL(response.data);
			const link = document.createElement('a');
			link.href = url;
			link.download = item.docName || 'download';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
			message.success('下载成功');
		} else {
			message.error('下载失败：响应格式错误');
		}
	} catch (error: any) {
		message.error(error?.message || '下载失败');
	}
}

//重新处理附件
async function handleReprocess(item: any) {
	dialog.warning({
		title: "确认重新处理",
		content: `确定要重新处理附件"${item.docName}"吗？这将重新解析、分块和向量化该附件。`,
		positiveText: "确定",
		negativeText: "取消",
		onPositiveClick: async () => {
			try {
				const [err, result] = await to(reprocessKnowledgeAttach(item.docId));
				if (err) {
					message.error(err.message || '重新处理失败');
				} else {
					if (result && (result.code === 200 || result.code === 0)) {
						message.success(result.msg || '重新处理成功');
						fetchData();
						if (selectedAttachId.value === item.id) {
							setTimeout(() => {
								openDetailPanel(item);
							}, 500);
						}
					} else {
						message.error(result?.msg || '重新处理失败');
					}
				}
			} catch (error: any) {
				message.error(error?.message || '重新处理失败');
			}
		},
	});
}

//删除附件
async function handleDelete(item: any) {
	const hasItems = item.itemUuids && item.itemUuids.length > 0
	dialog.warning({
		title: "确认删除",
		content: h('div', { style: 'line-height: 1.6;' }, [
			h('div', { style: 'margin-bottom: 8px;' }, `确定要删除附件"${item.docName}"吗？`),
			h('div', { style: 'margin-bottom: 4px; color: #666; font-size: 13px;' }, '删除后将同时删除该附件的所有知识片段。'),
			hasItems ? h('div', { style: 'color: #666; font-size: 13px;' }, '关联的知识条目将保留，您可在知识条目管理中继续查看和管理。') : null
		]),
		positiveText: "确定",
		negativeText: "取消",
		onPositiveClick: async () => {
			try {
				const [err] = await to(delKnowledgeDetail({ kid: kid.value, docId: item.docId }));
				if (err) {
					message.error(err.message || '删除失败');
				} else {
					message.success('删除成功');
					// 从传输列表中删除对应的任务（根据docId和fileName）
					const removedByDocId = uploadStore.removeTasksByDocId(item.docId, kid.value);
					const removedByFileName = uploadStore.removeTasksByFileName(item.docName, kid.value);
					console.log('[handleDelete] 删除附件后，从传输列表移除任务:', {
						docId: item.docId,
						fileName: item.docName,
						removedByDocId,
						removedByFileName
					});
					// 停止相关任务的轮询
					const allTasks = uploadStore.tasks.filter(task => 
						(task.docId === item.docId || task.fileName === item.docName) && task.kid === kid.value
					);
					allTasks.forEach(task => {
						uploadService.stopProcessingPolling(task.id);
					});
					// 从选中列表中移除已删除的附件
					const index = selectedAttachIds.value.indexOf(item.id);
					if (index > -1) {
						selectedAttachIds.value.splice(index, 1);
					}
					if (selectedAttachId.value === item.id) {
						closeDetailPanel();
					}
					fetchData();
				}
			} catch (error: any) {
				message.error(error?.message || '删除失败');
			}
		},
	});
}

//片段列表模态框
const showFragmentListModal = ref(false);
const fragmentListLoading = ref(false);
const fragmentTableData = ref<any[]>([]);
const fragmentTotal = ref(0);
const currentDocId = ref<string>("");
const currentItemUuid = ref<string>("");
const isFromAttachItemsModal = ref(false);
const fragmentSearchKeyword = ref("");
const fragmentSearchDebounceTimer = ref<NodeJS.Timeout | null>(null);
const fragmentPagination = reactive({
	page: 1,
	pageSize: 20,
	itemCount: 0,
	pageSizes: [10, 20, 50, 100],
	onUpdatePage: (page: number) => {
		fragmentPagination.page = page;
		fetchFragmentList();
	},
	onUpdatePageSize: (pageSize: number) => {
		fragmentPagination.pageSize = pageSize;
		fragmentPagination.page = 1;
		fetchFragmentList();
	},
});
const fragmentOrderBy = ref<'idx' | 'create_time' | 'content_length'>('idx');
const fragmentOrder = ref<'asc' | 'desc'>('asc');

//片段详情模态框
const showFragmentDetailModal = ref(false);
const selectedFragment = ref<any>(null);

//知识条目详情面板
const showItemDetailDrawer = ref(false);
const selectedItem = ref<any>(null);
const itemDetailLoading = ref(false);
const itemDetailPanelRef = ref<any>(null);
const itemDetailIsDirty = ref(false);
const itemDetailIsValid = ref(false);

//附件关联的知识条目列表模态框
const showAttachItemsModal = ref(false);
const attachItemsLoading = ref(false);
const attachItems = ref<any[]>([]);
const currentAttachForItems = ref<any>(null);

//查看知识片段
function handleViewFragments(item: any) {
	currentDocId.value = item.docId;
	currentItemUuid.value = "";
	isFromAttachItemsModal.value = false;
	fragmentSearchKeyword.value = "";
	fragmentPagination.page = 1;
	fragmentOrderBy.value = 'idx';
	fragmentOrder.value = 'asc';
	showFragmentListModal.value = true;
	fetchFragmentList();
}

//获取片段列表
async function fetchFragmentList() {
	if (!currentDocId.value) return;
	fragmentListLoading.value = true;
	try {
		const [err, result] = await to(getfragmentList(currentDocId.value));
		if (err) {
			message.error(err.message || '获取片段列表失败');
			return;
		}
		let allFragments = result.rows || [];
		if (fragmentSearchKeyword.value.trim()) {
			const keyword = fragmentSearchKeyword.value.trim().toLowerCase();
			allFragments = allFragments.filter((f: any) => 
				(f.content || '').toLowerCase().includes(keyword)
			);
		}
		allFragments.sort((a: any, b: any) => {
			let aVal: any, bVal: any;
			if (fragmentOrderBy.value === 'idx') {
				aVal = a.idx ?? 0;
				bVal = b.idx ?? 0;
			} else if (fragmentOrderBy.value === 'create_time') {
				aVal = a.createTime ? new Date(a.createTime).getTime() : 0;
				bVal = b.createTime ? new Date(b.createTime).getTime() : 0;
			} else {
				aVal = (a.content || '').length;
				bVal = (b.content || '').length;
			}
			if (fragmentOrder.value === 'asc') {
				return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
			} else {
				return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
			}
		});
		fragmentTotal.value = allFragments.length;
		const start = (fragmentPagination.page - 1) * fragmentPagination.pageSize;
		const end = start + fragmentPagination.pageSize;
		fragmentTableData.value = allFragments.slice(start, end);
		fragmentPagination.itemCount = fragmentTotal.value;
	} catch (error: any) {
		message.error(error?.message || '获取片段列表失败');
	} finally {
		fragmentListLoading.value = false;
	}
}

//获取片段列表（按条目和文档）
async function fetchFragmentListByItemAndDoc() {
	if (!currentItemUuid.value || !currentDocId.value) return;
	fragmentListLoading.value = true;
	try {
		const params = {
			itemUuid: currentItemUuid.value,
			docIds: [currentDocId.value],
			searchKeyword: fragmentSearchKeyword.value.trim() || undefined,
			orderBy: fragmentOrderBy.value,
			order: fragmentOrder.value,
			pageNum: 1,
			pageSize: 10000,
		};
		const [err, result] = await to(getFragmentListByItem(params));
		if (err) {
			message.error(err.message || '获取片段列表失败');
			return;
		}
		let allFragments = result.rows || result.data?.rows || [];
		allFragments.sort((a: any, b: any) => {
			let aVal: any, bVal: any;
			if (fragmentOrderBy.value === 'idx') {
				aVal = a.idx ?? 0;
				bVal = b.idx ?? 0;
			} else if (fragmentOrderBy.value === 'create_time') {
				aVal = a.createTime ? new Date(a.createTime).getTime() : 0;
				bVal = b.createTime ? new Date(b.createTime).getTime() : 0;
			} else {
				aVal = (a.content || '').length;
				bVal = (b.content || '').length;
			}
			if (fragmentOrder.value === 'asc') {
				return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
			} else {
				return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
			}
		});
		fragmentTotal.value = allFragments.length;
		const start = (fragmentPagination.page - 1) * fragmentPagination.pageSize;
		const end = start + fragmentPagination.pageSize;
		fragmentTableData.value = allFragments.slice(start, end);
		fragmentPagination.itemCount = fragmentTotal.value;
	} catch (error: any) {
		message.error(error?.message || '获取片段列表失败');
	} finally {
		fragmentListLoading.value = false;
	}
}

//搜索片段
watch(fragmentSearchKeyword, () => {
	if (fragmentSearchDebounceTimer.value) {
		clearTimeout(fragmentSearchDebounceTimer.value);
	}
	fragmentSearchDebounceTimer.value = setTimeout(() => {
		fragmentPagination.page = 1;
		if (currentItemUuid.value) {
			fetchFragmentListByItemAndDoc();
		} else {
			fetchFragmentList();
		}
	}, 300);
});

//格式化时间
function formatFragmentTimeAgo(date: string | Date | undefined): string {
	if (!date) return '-';
	try {
		return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN });
	} catch {
		return '-';
	}
}

//格式化内容预览
function formatFragmentContentPreview(content: string | undefined, maxLength: number = 150): string {
	if (!content) return '-';
	const trimmed = content.trim().replace(/\s+/g, ' ');
	if (trimmed.length <= maxLength) return trimmed;
	const lastSpace = trimmed.lastIndexOf(' ', maxLength);
	if (lastSpace > maxLength * 0.7) {
		return trimmed.substring(0, lastSpace) + '...';
	}
	return trimmed.substring(0, maxLength) + '...';
}

//高亮关键词
function highlightFragmentText(text: string, keyword: string): string {
	if (!keyword || !text) return text;
	const keywords = keyword.trim().split(/\s+/).filter(k => k.length > 0);
	if (keywords.length === 0) return text;
	const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
	const regex = new RegExp(`(${escapedKeywords})`, 'gi');
	return text.replace(regex, '<mark>$1</mark>');
}

//查看片段详情
function handleViewFragmentDetail(fragment: any) {
	selectedFragment.value = fragment;
	showFragmentDetailModal.value = true;
}

//查看知识条目详情
async function handleViewItemDetail(fragment: any, event?: Event) {
	if (event) {
		event.stopPropagation();
	}
	const itemUuid = fragment.itemUuid || fragment.matchedItemUuid;
	if (!itemUuid) {
		message.warning('该片段未关联知识条目');
		return;
	}
	selectedItem.value = null;
	itemDetailLoading.value = true;
	showItemDetailDrawer.value = true;
	try {
		const response: any = await getKnowledgeItemDetail(itemUuid);
		if (response.code === 200) {
			selectedItem.value = response.data || response;
		} else {
			message.error(response.msg || '获取知识条目详情失败');
		}
	} catch (error: any) {
		message.error(error?.message || '获取知识条目详情失败');
	} finally {
		itemDetailLoading.value = false;
	}
}

async function handleItemDetailUpdate(item: any) {
	const itemUuid = item.itemUuid;
	if (!itemUuid) return;
	
	try {
		const response: any = await getKnowledgeItemDetail(itemUuid);
		if (response.code === 200 && response.data && response.data.itemUuid) {
			const updatedItem = response.data;
			selectedItem.value = updatedItem;
			
			if (showAttachItemsModal.value && attachItems.value.length > 0) {
				const index = attachItems.value.findIndex(i => i.itemUuid === itemUuid);
				if (index !== -1) {
					attachItems.value[index] = updatedItem;
				}
			}
		}
	} catch (error: any) {
		console.warn(`刷新知识条目失败: ${itemUuid}`, error);
		selectedItem.value = { ...selectedItem.value, ...item };
	}
}

function handleItemDetailDirty(dirty: boolean) {
	itemDetailIsDirty.value = dirty;
}

function handleItemDetailValid(valid: boolean) {
	itemDetailIsValid.value = valid;
}

function handleCloseItemDetail() {
	showItemDetailDrawer.value = false;
	selectedItem.value = null;
}

function handleSaveItemDetail() {
	if (itemDetailPanelRef.value && itemDetailPanelRef.value.save) {
		itemDetailPanelRef.value.save();
	}
}

function handleRestoreItemDetail() {
	if (itemDetailPanelRef.value && itemDetailPanelRef.value.restore) {
		itemDetailPanelRef.value.restore();
	}
}

function getItemDocId(item: any): string | undefined {
	return item.docId || currentDocId.value;
}

//查看附件关联的知识条目
async function handleViewAttachItems(item: any) {
	currentAttachForItems.value = item;
	attachItems.value = [];
	attachItemsLoading.value = true;
	showAttachItemsModal.value = true;
	try {
		const [err, result] = await to(getfragmentList(item.docId));
		if (err) {
			message.error(err.message || '获取片段列表失败');
			return;
		}
		const fragments = result.rows || [];
		const itemUuids = new Set<string>();
		fragments.forEach((f: any) => {
			if (f.itemUuid) itemUuids.add(f.itemUuid);
			if (f.matchedItemUuid) itemUuids.add(f.matchedItemUuid);
		});
		if (itemUuids.size === 0) {
			message.info('该附件暂无关联的知识条目');
			attachItemsLoading.value = false;
			return;
		}
		const itemUuidArray = Array.from(itemUuids);
		const items: any[] = [];
		for (const itemUuid of itemUuidArray) {
			try {
				const [itemErr, itemResult] = await to(getKnowledgeItemDetail(itemUuid));
				if (!itemErr && itemResult && itemResult.code === 200) {
					const itemData = itemResult.data;
					if (itemData && itemData.itemUuid) {
						items.push(itemData);
					}
				}
			} catch (error: any) {
				console.warn(`获取知识条目失败: ${itemUuid}`, error);
			}
		}
		attachItems.value = items;
		if (items.length === 0) {
			message.warning('未能获取到有效的知识条目');
		}
	} catch (error: any) {
		message.error(error?.message || '获取知识条目列表失败');
	} finally {
		attachItemsLoading.value = false;
	}
}

function handleAttachItemSelect(item: any) {
	handleViewItemDetail({ itemUuid: item.itemUuid, matchedItemUuid: item.itemUuid });
}

async function handleAttachItemUpdate(item: any) {
	const itemUuid = item.itemUuid;
	if (!itemUuid) return;
	
	try {
		const response: any = await getKnowledgeItemDetail(itemUuid);
		if (response.code === 200 && response.data && response.data.itemUuid) {
			const updatedItem = response.data;
			const index = attachItems.value.findIndex(i => i.itemUuid === itemUuid);
			if (index !== -1) {
				attachItems.value[index] = updatedItem;
			}
			
			if (showItemDetailDrawer.value && selectedItem.value?.itemUuid === itemUuid) {
				selectedItem.value = updatedItem;
			}
		}
	} catch (error: any) {
		console.warn(`刷新知识条目失败: ${itemUuid}`, error);
		const index = attachItems.value.findIndex(i => i.itemUuid === itemUuid);
		if (index !== -1) {
			attachItems.value[index] = { ...attachItems.value[index], ...item };
		}
	}
}

async function handleAttachItemDelete(item: any) {
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
					attachItems.value = attachItems.value.filter(i => i.itemUuid !== item.itemUuid)
					
					if (showItemDetailDrawer.value && selectedItem.value?.itemUuid === item.itemUuid) {
						showItemDetailDrawer.value = false
						selectedItem.value = null
					}
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

async function handleAttachItemBatchDelete(itemUuids: string[]) {
	if (!itemUuids || itemUuids.length === 0) return
	
	const itemsToDelete = attachItems.value.filter(item => itemUuids.includes(item.itemUuid))
	
	let successCount = 0
	let failCount = 0
	const deletedItemUuids = new Set<string>()
	
	for (const item of itemsToDelete) {
		try {
			const response: any = await deleteKnowledgeItem(item.itemUuid)
			if (response.code === 200) {
				successCount++
				deletedItemUuids.add(item.itemUuid)
				
				if (showItemDetailDrawer.value && selectedItem.value?.itemUuid === item.itemUuid) {
					showItemDetailDrawer.value = false
					selectedItem.value = null
				}
			} else {
				failCount++
			}
		} catch (error: any) {
			failCount++
		}
	}
	
	if (deletedItemUuids.size > 0) {
		attachItems.value = attachItems.value.filter(i => !deletedItemUuids.has(i.itemUuid))
	}
	
	if (successCount > 0) {
		message.success(`成功删除 ${successCount} 个条目`)
	}
	if (failCount > 0) {
		message.error(`删除失败 ${failCount} 个条目`)
	}
}

function handleAttachItemViewFragment(item: any) {
	if (!item.itemUuid || !currentAttachForItems.value?.docId) {
		message.warning('缺少必要信息');
		return;
	}
	currentDocId.value = currentAttachForItems.value.docId;
	currentItemUuid.value = item.itemUuid;
	isFromAttachItemsModal.value = true;
	fragmentSearchKeyword.value = "";
	fragmentPagination.page = 1;
	fragmentOrderBy.value = 'idx';
	fragmentOrder.value = 'asc';
	showFragmentListModal.value = true;
	fetchFragmentListByItemAndDoc();
}

function handleViewItemFragments(item: any) {
	if (!item.itemUuid || !currentAttachForItems.value?.docId) {
		message.warning('缺少必要信息');
		return;
	}
	currentDocId.value = currentAttachForItems.value.docId;
	currentItemUuid.value = item.itemUuid;
	isFromAttachItemsModal.value = true;
	fragmentSearchKeyword.value = "";
	fragmentPagination.page = 1;
	fragmentOrderBy.value = 'idx';
	fragmentOrder.value = 'asc';
	showFragmentListModal.value = true;
	fetchFragmentListByItemAndDoc();
}

//排序选项
const fragmentSortOptions = [
	{ label: '按片段索引', value: 'idx' },
	{ label: '按创建时间', value: 'create_time' },
	{ label: '按内容长度', value: 'content_length' },
];

function getFragmentSortPlaceholder(): string {
	const option = fragmentSortOptions.find(opt => opt.value === fragmentOrderBy.value);
	return option ? option.label : '按片段索引';
}

function handleFragmentSortChange(value: string) {
	fragmentOrderBy.value = value as any;
	if (currentItemUuid.value) {
		fetchFragmentListByItemAndDoc();
	} else {
		fetchFragmentList();
	}
}

function toggleFragmentSortOrder() {
	fragmentOrder.value = fragmentOrder.value === 'asc' ? 'desc' : 'asc';
	if (currentItemUuid.value) {
		fetchFragmentListByItemAndDoc();
	} else {
		fetchFragmentList();
	}
}

//获取片段docId
function getFragmentDocId(fragment: any): string | undefined {
	return fragment.docId || currentDocId.value;
}

//片段列表表格列
const fragmentColumns = computed(() => {
	const baseColumns = [
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
						style: 'display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; border-radius: 6px; background: linear-gradient(135deg, #F0F0F0 0%, #E8E8E8 100%); color: #605E5C; font-size: 12px; font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);',
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
				const preview = formatFragmentContentPreview(content, 200);
				const fullContent = content;
				const contentElement = fragmentSearchKeyword.value.trim() 
					? h('div', {
						innerHTML: highlightFragmentText(preview, fragmentSearchKeyword.value.trim()),
						style: 'line-height: 1.7; color: #323130; font-size: 13px; word-break: break-word; cursor: pointer;',
						onClick: () => handleViewFragmentDetail(row),
					})
					: h('span', { 
						style: 'line-height: 1.7; color: #323130; font-size: 13px; word-break: break-word; cursor: pointer;',
						onClick: () => handleViewFragmentDetail(row),
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
			title: '长度',
			key: 'contentLength',
			width: 100,
			render: (row: any) => {
				const length = (row.content || '').length;
				return h('span', { 
					style: 'color: #666; font-size: 13px; font-family: monospace;' 
				}, length.toLocaleString());
			},
		},
		{
			title: '创建时间',
			key: 'createTime',
			width: 140,
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
					}, formatFragmentTimeAgo(row.createTime)),
				]);
			},
		},
	];
	
	if (!isFromAttachItemsModal.value) {
		baseColumns.push({
			title: '关联知识条目',
			key: 'itemUuid',
			width: 300,
			render: (row: any) => {
				const itemUuid = row.itemUuid || row.matchedItemUuid;
				const itemTitle = row.itemTitle || row.matchedItemTitle;
				const hasItem = itemUuid && itemTitle;
				if (!hasItem) {
					return h('span', {
						style: 'color: #808080; font-size: 13px;'
					}, itemUuid ? '条目不存在' : '未关联');
				}
				const displayText = itemTitle.length > 24 ? itemTitle.substring(0, 24) + '...' : itemTitle;
				return h(NTooltip, {
					trigger: 'hover',
					placement: 'top',
					disabled: itemTitle.length <= 24
				}, {
					trigger: () => h(NButton, {
						size: 'small',
						type: 'info',
						quaternary: true,
						onClick: (e: Event) => {
							e.stopPropagation();
							handleViewItemDetail(row, e);
						},
						style: 'max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
					}, {
						default: () => displayText
					}),
					default: () => itemTitle
				});
			},
		});
	}
	
	return baseColumns;
});

//查看关联知识条目
function handleViewItem(item: any) {
	if (item && typeof item === 'object' && item.itemUuid) {
		router.push({ path: "/knowledge/item/list", query: { kid: kid.value, itemUuid: item.itemUuid } });
	} else if (typeof item === 'string') {
		router.push({ path: "/knowledge/item/list", query: { kid: kid.value, itemUuid: item } });
	}
}

function handleViewItemByUuid(itemUuid: string) {
	if (itemUuid) {
		router.push({ path: "/knowledge/item/list", query: { kid: kid.value, itemUuid: itemUuid } });
	}
}

//上传约束常量
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_BATCH_SIZE = 10 // 单批最多10个文件
const MAX_CONCURRENT_UPLOADS = 3 // 最多3个并发上传
const MAX_FILENAME_LENGTH = 500 // 文件名最大500字符
const MAX_ATTACHMENTS_PER_KNOWLEDGE_BASE = 2000 // 每个知识库最多2000个附件

//获取传输列表中该知识库的任务统计
function getTransmissionListStats() {
	const allTasks = uploadStore.tasks.filter(task => task.kid === kid.value);
	const activeTasks = allTasks.filter(task => 
		task.status === 'waiting' || 
		task.status === 'uploading' || 
		task.status === 'processing' ||
		task.status === 'parsing' || 
		task.status === 'chunking' || 
		task.status === 'matching' ||
		task.status === 'creating_items' || 
		task.status === 'vectorizing'
	);
	const uploadingTasks = allTasks.filter(task => 
		task.status === 'uploading'
	);
	const fileNames = allTasks.map(task => task.fileName);
	return {
		totalActive: activeTasks.length,
		uploadingCount: uploadingTasks.length,
		fileNames: fileNames
	};
}
const ALLOWED_FILE_EXTENSIONS = [
	// 文本文件
	'txt', 'csv', 'properties', 'ini', 'yaml', 'yml', 'log', 'xml',
	// Word文档
	'doc', 'docx',
	// PDF文档
	'pdf',
	// Excel表格
	'xls', 'xlsx',
	// Markdown
	'md',
	// 代码文件
	'java', 'html', 'htm', 'js', 'py', 'cpp', 'sql', 'php', 'ruby', 'c', 'h', 'hpp', 'swift', 'ts', 'rs', 'perl', 'shell', 'bat', 'cmd', 'css'
]

//文件名特殊字符过滤
function sanitizeFileName(fileName: string): string {
	if (!fileName) return fileName
	// 过滤路径分隔符和控制字符
	const dangerousChars = /[<>:"|?*\x00-\x1f\x7f]/g
	let sanitized = fileName.replace(dangerousChars, '_')
	// 过滤Windows保留名
	const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
	if (reservedNames.test(sanitized)) {
		sanitized = '_' + sanitized
	}
	// 去除首尾空格和点
	sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '')
	return sanitized
}

//验证文件扩展名
function validateFileExtension(fileName: string): boolean {
	console.log('[validateFileExtension] 开始验证文件扩展名:', fileName);
	if (!fileName) {
		console.log('[validateFileExtension] 文件名为空');
		return false;
	}
	const ext = fileName.split('.').pop()?.toLowerCase();
	console.log('[validateFileExtension] 提取的扩展名:', ext);
	if (!ext) {
		console.log('[validateFileExtension] 扩展名为空');
		return false;
	}
	const isValid = ALLOWED_FILE_EXTENSIONS.includes(ext);
	console.log('[validateFileExtension] 扩展名是否在允许列表中:', isValid, '允许的扩展名列表:', ALLOWED_FILE_EXTENSIONS);
	return isValid;
}

//验证文件名
function validateFileName(fileName: string): { valid: boolean; error?: string } {
	if (!fileName || fileName.trim().length === 0) {
		return { valid: false, error: '文件名不能为空' }
	}
	if (fileName.length > MAX_FILENAME_LENGTH) {
		return { valid: false, error: `文件名长度不能超过${MAX_FILENAME_LENGTH}个字符` }
	}
	const sanitized = sanitizeFileName(fileName)
	if (sanitized !== fileName) {
		return { valid: false, error: '文件名包含不允许的特殊字符' }
	}
	return { valid: true }
}

//验证文件大小
function validateFileSize(fileSize: number): { valid: boolean; error?: string } {
	if (fileSize <= 0) {
		return { valid: false, error: '文件不能为空' }
	}
	if (fileSize > MAX_FILE_SIZE) {
		return { valid: false, error: `文件大小不能超过${formatFileSize(MAX_FILE_SIZE)}` }
	}
	return { valid: true }
}

//上传相关
function handleBeforeUpload(data: { file: File; fileList: File[] }): boolean {
	if (!data || !data.file) {
		return false;
	}
	
	const file = data.file
	let fileName = file.name
	
	//文件名sanitization
	const sanitizedFileName = sanitizeFileName(fileName)
	if (sanitizedFileName !== fileName) {
		message.warning(`文件名已自动清理：${fileName} → ${sanitizedFileName}`)
		fileName = sanitizedFileName
	}
	
	// 验证文件扩展名（使用清理后的文件名）
	if (!validateFileExtension(fileName)) {
		const errorMsg = `不支持的文件格式：${fileName.split('.').pop()?.toUpperCase()}。支持格式：${ALLOWED_FILE_EXTENSIONS.slice(0, 10).join(', ')}等`;
		message.error(errorMsg, { duration: 5000 })
		return false
	}
	
	// 验证文件大小
	const sizeValidation = validateFileSize(file.size)
	if (!sizeValidation.valid) {
		message.error(sizeValidation.error, { duration: 5000 })
		return false
	}
	
	// 验证文件名（使用清理后的文件名）
	const nameValidation = validateFileName(fileName)
	if (!nameValidation.valid) {
		message.error(nameValidation.error, { duration: 5000 })
		return false
	}
	
	// 检查单批数量限制（包括传输列表中的任务）
	const currentFiles = Array.from(uploadFiles.value.values())
	const transmissionStats = getTransmissionListStats()
	const totalActiveFiles = currentFiles.length + transmissionStats.totalActive
	if (totalActiveFiles >= MAX_BATCH_SIZE) {
		const errorMsg = `单次最多上传${MAX_BATCH_SIZE}个文件，当前已有${transmissionStats.totalActive}个任务在传输列表中，本次已选择${currentFiles.length}个文件`;
		message.error(errorMsg, { duration: 5000 })
		return false
	}
	
	// 检查重名（包括传输列表中的任务）
	const existingFile = uploadFiles.value.get(fileName)
	if (existingFile) {
		const errorMsg = `文件列表中已存在同名文件：${fileName}`;
		message.error(errorMsg, { duration: 5000 })
		return false
	}
	if (transmissionStats.fileNames.includes(fileName)) {
		const errorMsg = `传输列表中已存在同名文件：${fileName}`;
		message.error(errorMsg, { duration: 5000 })
		return false
	}
	
	// 检查并发上传限制（包括传输列表中的任务）
	const uploadingCount = currentFiles.filter(f => f.status === 'uploading').length + transmissionStats.uploadingCount
	if (uploadingCount >= MAX_CONCURRENT_UPLOADS) {
		const warningMsg = `当前已有${uploadingCount}个文件正在上传（传输列表中${transmissionStats.uploadingCount}个，本次${currentFiles.filter(f => f.status === 'uploading').length}个），请等待部分文件上传完成后再添加`;
		message.warning(warningMsg, { duration: 5000 })
		return false
	}
	
	// 检查知识库附件总数限制（包括传输列表中的任务）
	const currentAttachCount = total.value // 当前知识库已有的附件数量（从后端获取）
	const pendingTasksCount = transmissionStats.totalActive // 传输列表中该知识库的活跃任务数
	const newFilesCount = currentFiles.length + 1 // 本次要添加的文件数（包括当前文件）
	if (currentAttachCount + pendingTasksCount + newFilesCount > MAX_ATTACHMENTS_PER_KNOWLEDGE_BASE) {
		const errorMsg = `知识库附件数量将超过限制（当前${currentAttachCount}个，传输列表中${pendingTasksCount}个任务，本次将添加${newFilesCount}个，最多${MAX_ATTACHMENTS_PER_KNOWLEDGE_BASE}个）`;
		message.error(errorMsg, { duration: 5000 })
		return false
	}
	
	return true
}

//文件列表变化处理（Naive UI的@change事件）- 支持批量验证
let fileListChangeTimeout: NodeJS.Timeout | null = null;
function handleFileListChange(options: { file: any; fileList: any[]; event?: any }) {
	if (!options || !options.fileList || options.fileList.length === 0) {
		return;
	}
	
	//清除之前的定时器
	if (fileListChangeTimeout) {
		clearTimeout(fileListChangeTimeout);
	}
	
	//延迟处理，等待所有文件选择完成
	fileListChangeTimeout = setTimeout(() => {
		validateSelectedFiles(options.fileList || []);
	}, 200);
}

//批量验证选择的文件
function validateSelectedFiles(fileList: any[]) {
	//提取文件对象
	const fileObjects: File[] = [];
	for (const fileInfo of fileList) {
		let file: File | null = null;
		if (fileInfo.file instanceof File) {
			file = fileInfo.file;
		} else if (fileInfo.file && typeof fileInfo.file === 'object' && fileInfo.file.size !== undefined) {
			file = fileInfo.file as File;
		} else if (fileInfo instanceof File) {
			file = fileInfo;
		}
		if (file) {
			fileObjects.push(file);
		}
	}
	
	if (fileObjects.length === 0) {
		return;
	}
	
	//检查文件数量限制（包括传输列表中的任务）
	const currentFiles = Array.from(uploadFiles.value.values());
	const transmissionStats = getTransmissionListStats();
	const totalActiveFiles = currentFiles.length + transmissionStats.totalActive;
	const remainingSlots = MAX_BATCH_SIZE - totalActiveFiles;
	if (fileObjects.length > remainingSlots) {
		message.error(`文件数量超过限制，传输列表中已有 ${transmissionStats.totalActive} 个任务，本次已选择 ${currentFiles.length} 个文件，最多还能选择 ${remainingSlots} 个文件，但当前选择了 ${fileObjects.length} 个文件。请重新选择文件。`, { duration: 5000 });
		return;
	}
	
	//检查知识库附件总数限制（包括传输列表中的任务）
	const currentAttachCount = total.value; // 当前知识库已有的附件数量（从后端获取）
	const pendingTasksCount = transmissionStats.totalActive; // 传输列表中该知识库的活跃任务数
	const newFilesCount = currentFiles.length + fileObjects.length; // 本次要添加的文件数
	if (currentAttachCount + pendingTasksCount + newFilesCount > MAX_ATTACHMENTS_PER_KNOWLEDGE_BASE) {
		message.error(`知识库附件数量将超过限制（当前${currentAttachCount}个，传输列表中${pendingTasksCount}个任务，本次将添加${newFilesCount}个，最多${MAX_ATTACHMENTS_PER_KNOWLEDGE_BASE}个）。请先删除部分附件或等待传输列表中的任务完成。`, { duration: 5000 });
		return;
	}
	
	//分类验证文件
	const duplicateFiles: File[] = [];
	const invalidFormatFiles: File[] = [];
	const oversizedFiles: File[] = [];
	const invalidNameFiles: File[] = [];
	const validFilesList: File[] = [];
	
	fileObjects.forEach(file => {
		console.log('[handleFileListChange] 开始验证文件:', file.name, '大小:', file.size);
		let fileName = file.name;
		
		//文件名清理
		const sanitizedFileName = sanitizeFileName(fileName);
		if (sanitizedFileName !== fileName) {
			console.log('[handleFileListChange] 文件名被清理:', fileName, '->', sanitizedFileName);
			fileName = sanitizedFileName;
		}
		
		//检查重名（与已选择的文件对比）
		const existingFile = uploadFiles.value.get(fileName);
		if (existingFile) {
			console.log('[handleFileListChange] 文件重复（已选择列表）:', fileName);
			duplicateFiles.push(file);
			return;
		}
		
		//检查与传输列表中已有任务的重复
		const transmissionStats = getTransmissionListStats();
		if (transmissionStats.fileNames.includes(fileName)) {
			console.log('[handleFileListChange] 文件重复（传输列表）:', fileName);
			duplicateFiles.push(file);
			return;
		}
		
		//检查与当前批次中已处理文件的重复
		const isDuplicateInBatch = validFilesList.some(f => {
			const fName = sanitizeFileName(f.name);
			return fName === fileName;
		});
		if (isDuplicateInBatch) {
			console.log('[handleFileListChange] 文件重复（当前批次）:', fileName);
			duplicateFiles.push(file);
			return;
		}
		
		//检查文件格式
		const formatValid = validateFileExtension(fileName);
		console.log('[handleFileListChange] 格式验证结果:', formatValid, '文件名:', fileName);
		if (!formatValid) {
			console.log('[handleFileListChange] 格式不支持，添加到invalidFormatFiles:', fileName);
			invalidFormatFiles.push(file);
			return;
		}
		
		//检查文件大小
		const sizeValidation = validateFileSize(file.size);
		console.log('[handleFileListChange] 大小验证结果:', sizeValidation.valid, '文件大小:', file.size);
		if (!sizeValidation.valid) {
			console.log('[handleFileListChange] 文件过大，添加到oversizedFiles:', fileName, sizeValidation.error);
			oversizedFiles.push(file);
			return;
		}
		
		//检查文件名
		const nameValidation = validateFileName(fileName);
		console.log('[handleFileListChange] 文件名验证结果:', nameValidation.valid, '文件名:', fileName);
		if (!nameValidation.valid) {
			console.log('[handleFileListChange] 文件名不符合要求，添加到invalidNameFiles:', fileName, nameValidation.error);
			invalidNameFiles.push(file);
			return;
		}
		
		//所有验证通过
		console.log('[handleFileListChange] 所有验证通过，添加到validFilesList:', fileName);
		validFilesList.push(file);
	});
	
	//处理验证结果
	const hasInvalidFiles = duplicateFiles.length > 0 || invalidFormatFiles.length > 0 || oversizedFiles.length > 0 || invalidNameFiles.length > 0;
	console.log('[handleFileListChange] 验证结果汇总:', {
		duplicateFiles: duplicateFiles.length,
		invalidFormatFiles: invalidFormatFiles.length,
		oversizedFiles: oversizedFiles.length,
		invalidNameFiles: invalidNameFiles.length,
		validFilesList: validFilesList.length,
		hasInvalidFiles
	});
	console.log('[handleFileListChange] 无效文件详情:', {
		duplicateFiles: duplicateFiles.map(f => f.name),
		invalidFormatFiles: invalidFormatFiles.map(f => f.name),
		oversizedFiles: oversizedFiles.map(f => f.name),
		invalidNameFiles: invalidNameFiles.map(f => f.name)
	});
	
	//如果所有文件都符合要求，直接添加
	if (!hasInvalidFiles) {
		validFilesList.forEach(file => {
			let fileName = file.name;
			const sanitizedFileName = sanitizeFileName(fileName);
			if (sanitizedFileName !== fileName) {
				message.warning(`文件名已自动清理：${fileName} → ${sanitizedFileName}`);
				fileName = sanitizedFileName;
			}
			uploadFiles.value.set(fileName, {
				file,
				progress: 0,
				status: 'waiting'
			});
			uploadStatus.value.set(fileName, 'waiting');
			uploadProgress.value.set(fileName, 0);
		});
		return;
	}
	
	//有不符合要求的文件，显示验证模态框
	validFiles.value = validFilesList;
	invalidFiles.value = [...duplicateFiles, ...invalidFormatFiles, ...oversizedFiles, ...invalidNameFiles];
	showFileValidationModal.value = true;
	//清空n-upload组件的fileList，避免显示未确认的文件
	//注意：这里不清空uploadFiles，因为可能已有其他文件在队列中
}

//@select事件处理（文件选择时立即触发，此时File对象已准备好）
function handleFileSelectFromEvent(options: { file: any; fileList: any[] }) {
	//批量验证已由handleFileListChange处理，这里不需要单独处理
}

//获取文件问题文本（用于验证模态框显示）
function getFileIssueText(file: File): string {
	console.log('[getFileIssueText] 开始检查文件问题:', file.name, '文件大小:', file.size);
	const issues: string[] = [];
	let fileName = file.name;
	const sanitizedFileName = sanitizeFileName(fileName);
	if (sanitizedFileName !== fileName) {
		console.log('[getFileIssueText] 文件名被清理:', fileName, '->', sanitizedFileName);
		fileName = sanitizedFileName;
	}
	
	//检查是否重复（区分已上传附件、传输列表、已选择文件）
	const existingFile = uploadFiles.value.get(fileName);
	const transmissionStats = getTransmissionListStats();
	const isDuplicateInTransmission = transmissionStats.fileNames.includes(fileName);
	const isDuplicateInUploaded = tableData.value.some(item => item.docName === fileName);
	
	if (isDuplicateInUploaded) {
		console.log('[getFileIssueText] 文件重复（已上传附件）:', fileName);
		issues.push('与已上传附件重复');
	} else if (isDuplicateInTransmission) {
		console.log('[getFileIssueText] 文件重复（传输列表）:', fileName);
		issues.push('与传输列表中的任务重复');
	} else if (existingFile) {
		console.log('[getFileIssueText] 文件重复（已选择文件）:', fileName);
		issues.push('与已选择的文件重复');
	}
	
	//检查格式
	const formatValid = validateFileExtension(fileName);
	console.log('[getFileIssueText] 格式验证结果:', formatValid, '文件名:', fileName);
	if (!formatValid) {
		console.log('[getFileIssueText] 格式不支持:', fileName);
		issues.push('格式不支持');
	}
	
	//检查大小
	const sizeValidation = validateFileSize(file.size);
	console.log('[getFileIssueText] 大小验证结果:', sizeValidation.valid, '文件大小:', file.size, '错误:', sizeValidation.error);
	if (!sizeValidation.valid) {
		console.log('[getFileIssueText] 文件过大:', file.size);
		issues.push('文件过大');
	}
	
	//检查文件名
	const nameValidation = validateFileName(fileName);
	console.log('[getFileIssueText] 文件名验证结果:', nameValidation.valid, '错误:', nameValidation.error);
	if (!nameValidation.valid) {
		console.log('[getFileIssueText] 文件名不符合要求:', fileName, nameValidation.error);
		issues.push('文件名不符合要求');
	}
	
	const issueText = issues.join('、') || '未知问题';
	console.log('[getFileIssueText] 最终问题文本:', issueText, '问题列表:', issues);
	return issueText;
}

//处理文件验证结果 - 只使用有效文件
function useValidFilesOnly() {
	const validCount = validFiles.value.length;
	const invalidCount = invalidFiles.value.length;
	
	validFiles.value.forEach(file => {
		let fileName = file.name;
		const sanitizedFileName = sanitizeFileName(fileName);
		if (sanitizedFileName !== fileName) {
			message.warning(`文件名已自动清理：${fileName} → ${sanitizedFileName}`);
			fileName = sanitizedFileName;
		}
		uploadFiles.value.set(fileName, {
			file,
			progress: 0,
			status: 'waiting'
		});
		uploadStatus.value.set(fileName, 'waiting');
		uploadProgress.value.set(fileName, 0);
	});
	
	showFileValidationModal.value = false;
	validFiles.value = [];
	invalidFiles.value = [];
	
	if (validCount > 0) {
		message.success(`已选择 ${validCount} 个有效文件${invalidCount > 0 ? `，${invalidCount} 个不符合要求的文件已忽略` : ''}`, { duration: 3000 });
	}
}

//处理文件验证结果 - 重新选择文件
function reselectFiles() {
	showFileValidationModal.value = false;
	validFiles.value = [];
	invalidFiles.value = [];
}

//custom-request处理（当auto-upload为false时，这个可能不会被调用，但我们保留它作为备用）
function handleFileSelect(options: any) {
	//批量验证已由handleFileListChange处理，这里不需要单独处理
	if (options?.onSuccess) {
		options.onSuccess({ code: 200, data: {} });
	}
}

function handleUploadError({ file, event }: any) {
	const fileName = file.name;
	const fileInfo = uploadFiles.value.get(fileName);
	
	//尝试从event中提取错误信息
	let errorMessage = '上传失败'
	if (event?.error?.message) {
		errorMessage = event.error.message
	} else if (event?.message) {
		errorMessage = event.message
	} else if (event?.response?.data?.msg) {
		errorMessage = event.response.data.msg
	} else if (event?.response?.data?.message) {
		errorMessage = event.response.data.message
	}
	
	if (fileInfo) {
		fileInfo.status = 'error';
		fileInfo.error = errorMessage;
		uploadFiles.value.set(fileName, fileInfo);
		message.error(`${fileName}: ${errorMessage}`, { duration: 5000 });
	} else {
		message.error(`${fileName}: ${errorMessage}`, { duration: 5000 });
	}
	uploadStatus.value.set(fileName, 'error');
	checkUploadComplete();
	
	//关闭上传模态框，自动打开传输列表
	showUploadModal.value = false;
	nextTick(() => {
		if (uploadManagerRef.value && typeof uploadManagerRef.value.show === 'function') {
			uploadManagerRef.value.show();
		}
	});
}

function handleCustomRequest(options: any) {
	const file = options.file;
	let fileName = file.name;
	
	// 文件名sanitization
	const sanitizedFileName = sanitizeFileName(fileName)
	if (sanitizedFileName !== fileName) {
		message.warning(`文件名已自动清理：${fileName} → ${sanitizedFileName}`)
		fileName = sanitizedFileName
	}
	
	// 再次验证（双重保险）
	const sizeValidation = validateFileSize(file.size)
	if (!sizeValidation.valid) {
		message.error(`${fileName}: ${sizeValidation.error}`, { duration: 5000 });
		options.onError(new Error(sizeValidation.error))
		return
	}
	
	const nameValidation = validateFileName(fileName)
	if (!nameValidation.valid) {
		message.error(`${fileName}: ${nameValidation.error}`, { duration: 5000 });
		options.onError(new Error(nameValidation.error))
		return
	}
	
	if (!validateFileExtension(fileName)) {
		const errorMsg = `不支持的文件格式：${fileName.split('.').pop()?.toUpperCase()}`;
		message.error(`${fileName}: ${errorMsg}`, { duration: 5000 });
		options.onError(new Error(errorMsg))
		return
	}
	
	// 检查并发限制
	const currentFiles = Array.from(uploadFiles.value.values())
	const uploadingCount = currentFiles.filter(f => f.status === 'uploading').length
	if (uploadingCount >= MAX_CONCURRENT_UPLOADS) {
		const errorMsg = `当前已有${uploadingCount}个文件正在上传，请等待部分文件上传完成`;
		message.error(`${fileName}: ${errorMsg}`, { duration: 5000 });
		options.onError(new Error(errorMsg))
		return
	}
	
	const taskId = uploadStore.addTask({
		fileName: fileName,
		fileSize: file.size,
		file: file,
		kid: kid.value,
		autoCreateItems: autoCreateItems.value,
		autoClassify: autoClassify.value,
		status: 'waiting',
	});
	
	uploadFiles.value.set(fileName, {
		file,
		progress: 0,
		status: 'uploading'
	});
	
	uploadService.uploadTask(taskId);
	
	const task = uploadStore.getTaskById(taskId);
	if (task) {
		const progressInterval = setInterval(() => {
			const currentTask = uploadStore.getTaskById(taskId);
			if (currentTask) {
				const fileInfo = uploadFiles.value.get(fileName);
				if (fileInfo) {
					fileInfo.progress = currentTask.progress;
					fileInfo.status = currentTask.status as any;
					if (currentTask.status === 'error') {
						fileInfo.error = currentTask.error;
					}
					uploadFiles.value.set(fileName, fileInfo);
				}
				uploadProgress.value.set(fileName, currentTask.progress);
				uploadStatus.value.set(fileName, currentTask.status as any);
				options.onProgress({ percent: currentTask.progress });
				
				if (currentTask.status === 'success') {
					clearInterval(progressInterval);
					options.onSuccess({ code: 200, data: { id: currentTask.attachId, docId: currentTask.docId } });
					checkUploadComplete();
				} else if (currentTask.status === 'error') {
					clearInterval(progressInterval);
					const errorMsg = currentTask.error || '上传失败';
					message.error(`${fileName}: ${errorMsg}`, { duration: 5000 });
					options.onError(new Error(errorMsg));
					checkUploadComplete();
				} else if (currentTask.status === 'processing' && currentTask.attachId) {
					processingFiles.value.set(fileName, {
						attachId: currentTask.attachId,
						docId: currentTask.docId || '',
						fileName: fileName,
						status: {}
					});
					startProcessingPolling();
				}
			}
		}, 200);
	}
}

function startProcessingPolling() {
	if (processingPollingTimer.value) return;
	
	processingPollingTimer.value = window.setInterval(async () => {
		if (processingFiles.value.size === 0) {
			stopProcessingPolling();
			return;
		}
		
		let allCompleted = true;
		for (const [fileName, fileInfo] of processingFiles.value.entries()) {
			try {
				const [err, result] = await to(getKnowledgeAttachInfo(fileInfo.attachId));
				if (!err && result && result.code === 200) {
					const attachInfo = result.data || result;
					
					if (attachInfo.vectorStatus !== 30) {
						allCompleted = false;
					}
					
					if (attachInfo.processId && (!fileInfo.status?.processId || fileInfo.status.processId !== attachInfo.processId || !fileInfo.status?.currentStatus)) {
						try {
							const [processErr, processResult] = await to(getAttachProcessStatus(attachInfo.processId, true));
							if (!processErr && processResult && processResult.code === 200) {
								const processData = processResult.data;
								if (processData) {
									fileInfo.status = {
										...attachInfo,
										processId: attachInfo.processId,
										currentStatus: processData.currentStatus,
									};
								} else {
									fileInfo.status = attachInfo;
								}
							} else {
								fileInfo.status = attachInfo;
							}
						} catch (processError) {
							fileInfo.status = attachInfo;
						}
					} else {
						fileInfo.status = {
							...fileInfo.status,
							...attachInfo,
						};
					}
				}
			} catch (error) {
			}
		}
		
		if (allCompleted) {
			uploadComplete.value = true;
			stopProcessingPolling();
			uploadResults.value = Array.from(processingFiles.value.values()).map(f => f.status);
		}
	}, 2000);
}

function stopProcessingPolling() {
	if (processingPollingTimer.value) {
		clearInterval(processingPollingTimer.value);
		processingPollingTimer.value = null;
	}
}

function checkUploadComplete() {
	const allFiles = Array.from(uploadFiles.value.values());
	const allUploaded = allFiles.every(f => f.status === 'success' || f.status === 'error');
	if (allUploaded && !uploadComplete.value) {
		if (processingFiles.value.size === 0) {
			uploadComplete.value = true;
		}
	}
}

function handleRetryUpload(fileName: string, fileInfo: any) {
	const file = fileInfo.file;
	uploadFiles.value.set(fileName, {
		file,
		progress: 0,
		status: 'uploading'
	});
	uploadStatus.value.set(fileName, 'uploading');
	uploadProgress.value.set(fileName, 0);
	
	const formData = new FormData();
	formData.append('file', file);
	formData.append('kid', kid.value);
	formData.append('autoCreateItems', String(autoCreateItems.value));
	formData.append('autoClassify', String(autoClassify.value));
	
	const xhr = new XMLHttpRequest();
	const fileInfoRef = uploadFiles.value.get(fileName);
	if (fileInfoRef) {
		fileInfoRef.xhr = xhr;
		uploadFiles.value.set(fileName, fileInfoRef);
	}
	
	xhr.upload.addEventListener('progress', (e) => {
		if (e.lengthComputable) {
			const percent = Math.round((e.loaded / e.total) * 100);
			const currentFileInfo = uploadFiles.value.get(fileName);
			if (currentFileInfo) {
				currentFileInfo.progress = percent;
				uploadFiles.value.set(fileName, currentFileInfo);
			}
			uploadProgress.value.set(fileName, percent);
		}
	});
	
	xhr.addEventListener('load', () => {
		if (xhr.status === 200) {
			try {
				const response = JSON.parse(xhr.responseText);
				const currentFileInfo = uploadFiles.value.get(fileName);
				if (currentFileInfo) {
					currentFileInfo.status = 'success';
					currentFileInfo.progress = 100;
					currentFileInfo.result = response.data;
					currentFileInfo.xhr = undefined;
					uploadFiles.value.set(fileName, currentFileInfo);
				}
				uploadStatus.value.set(fileName, 'success');
				uploadProgress.value.set(fileName, 100);
				
				if (response.data && response.data.id) {
					processingFiles.value.set(fileName, {
						attachId: response.data.id,
						docId: response.data.docId || '',
						fileName: fileName,
						status: response.data
					});
					startProcessingPolling();
				}
				checkUploadComplete();
			} catch (error) {
				const currentFileInfo = uploadFiles.value.get(fileName);
				if (currentFileInfo) {
					currentFileInfo.status = 'error';
					currentFileInfo.error = '解析响应失败';
					currentFileInfo.xhr = undefined;
					uploadFiles.value.set(fileName, currentFileInfo);
				}
				uploadStatus.value.set(fileName, 'error');
				checkUploadComplete();
			}
		} else {
			const currentFileInfo = uploadFiles.value.get(fileName);
			if (currentFileInfo) {
				currentFileInfo.status = 'error';
				currentFileInfo.error = '上传失败';
				currentFileInfo.xhr = undefined;
				uploadFiles.value.set(fileName, currentFileInfo);
			}
			uploadStatus.value.set(fileName, 'error');
			checkUploadComplete();
		}
	});
	
	xhr.addEventListener('error', () => {
		const currentFileInfo = uploadFiles.value.get(fileName);
		if (currentFileInfo) {
			currentFileInfo.status = 'error';
			currentFileInfo.error = '网络错误';
			currentFileInfo.xhr = undefined;
			uploadFiles.value.set(fileName, currentFileInfo);
		}
		uploadStatus.value.set(fileName, 'error');
		checkUploadComplete();
	});
	
	xhr.open('POST', '/api/knowledge/attach/upload');
	const token = getToken();
	if (token) {
		xhr.setRequestHeader('Authorization', `Bearer ${token}`);
	}
	xhr.send(formData);
}

function handleCancelUpload(fileName: string, fileInfo: any) {
	if (fileInfo.xhr) {
		fileInfo.xhr.abort();
	}
	uploadFiles.value.delete(fileName);
	uploadProgress.value.delete(fileName);
	uploadStatus.value.delete(fileName);
}

function handleContinueUpload() {
	uploadFiles.value.clear();
	uploadProgress.value.clear();
	uploadStatus.value.clear();
	processingFiles.value.clear();
	uploadComplete.value = false;
	uploadResults.value = [];
	isUploading.value = false;
	stopProcessingPolling();
}

async function handleStartUpload() {
	if (isUploading.value) {
		return;
	}
	
	const waitingFilesList = waitingFiles.value;
	if (waitingFilesList.length === 0) {
		message.warning('没有待上传的文件');
		return;
	}
	
	isUploading.value = true;
	
	const results: Array<{ success: boolean; fileName: string; error?: string }> = [];
	let hasStartedUpload = false;
	
	//分批处理，每批最多MAX_CONCURRENT_UPLOADS个并发
	for (let i = 0; i < waitingFilesList.length; i += MAX_CONCURRENT_UPLOADS) {
		const batch = waitingFilesList.slice(i, i + MAX_CONCURRENT_UPLOADS);
		const batchPromises = batch.map(async (fileInfo) => {
			const fileName = Array.from(uploadFiles.value.entries()).find(([_, info]) => info === fileInfo)?.[0];
			if (!fileName) {
				return { success: false, fileName: '未知文件', error: '找不到文件名' };
			}
			
			try {
				
				//更新状态为uploading
				fileInfo.status = 'uploading';
				uploadFiles.value.set(fileName, fileInfo);
				uploadStatus.value.set(fileName, 'uploading');
				
				//创建上传任务
				const taskId = uploadStore.addTask({
					fileName: fileName,
					fileSize: fileInfo.file.size,
					file: fileInfo.file,
					kid: kid.value,
					autoCreateItems: autoCreateItems.value,
					autoClassify: autoClassify.value,
					status: 'uploading',
				});
				
				//开始上传（不等待完成，让上传在后台进行）
				uploadService.uploadTask(taskId).catch((error) => {
				});
				
				//所有任务都开始上传后，立即关闭模态框并打开传输列表
				if (!hasStartedUpload) {
					hasStartedUpload = true;
					showUploadModal.value = false;
					nextTick(() => {
						if (uploadManagerRef.value && typeof uploadManagerRef.value.show === 'function') {
							uploadManagerRef.value.show();
						}
					});
				}
				
				//在后台等待上传完成（用于更新进度和状态，但不阻塞UI）
				return new Promise<{ success: boolean; fileName: string; error?: string }>((resolve) => {
					const checkInterval = setInterval(() => {
						const task = uploadStore.getTaskById(taskId);
						if (!task) {
							clearInterval(checkInterval);
							resolve({ success: false, fileName, error: '任务不存在' });
							return;
						}
						
						//更新进度
						fileInfo.progress = task.progress;
						uploadFiles.value.set(fileName, fileInfo);
						uploadProgress.value.set(fileName, task.progress);
						
						if (task.status === 'success' || task.status === 'completed') {
							clearInterval(checkInterval);
							fileInfo.status = 'success';
							fileInfo.result = { id: task.attachId, docId: task.docId };
							uploadFiles.value.set(fileName, fileInfo);
							uploadStatus.value.set(fileName, 'success');
							uploadProgress.value.set(fileName, 100);
							
							//如果有attachId，开始处理轮询
							if (task.attachId && task.docId) {
								processingFiles.value.set(fileName, {
									attachId: task.attachId,
									docId: task.docId,
									fileName: fileName,
									status: {}
								});
								startProcessingPolling();
							}
							
							resolve({ success: true, fileName });
						} else if (task.status === 'error' || task.status === 'failed') {
							clearInterval(checkInterval);
							fileInfo.status = 'error';
							fileInfo.error = task.error || '上传失败';
							uploadFiles.value.set(fileName, fileInfo);
							uploadStatus.value.set(fileName, 'error');
							resolve({ success: false, fileName, error: task.error || '上传失败' });
						}
					}, 200);
					
					//超时保护（5分钟）
					setTimeout(() => {
						clearInterval(checkInterval);
						resolve({ success: false, fileName, error: '上传超时' });
					}, 5 * 60 * 1000);
				});
			} catch (error: any) {
				fileInfo.status = 'error';
				fileInfo.error = error?.message || '上传失败';
				uploadFiles.value.set(fileName, fileInfo);
				uploadStatus.value.set(fileName, 'error');
				return { success: false, fileName, error: error?.message || '上传失败' };
			}
		});
		
		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);
	}
	
	isUploading.value = false;
	
	//统计结果
	const successCount = results.filter(r => r.success).length;
	const failCount = results.filter(r => !r.success).length;
	
	if (failCount === 0) {
		message.success(`所有文件上传成功（${successCount}个）`);
	} else if (successCount === 0) {
		message.error(`所有文件上传失败（${failCount}个）`);
	} else {
		message.warning(`部分文件上传成功：成功${successCount}个，失败${failCount}个`);
	}
	
	checkUploadComplete();
}

function handleRemoveFromQueue(fileName: string) {
	const fileInfo = uploadFiles.value.get(fileName);
	if (fileInfo && fileInfo.status === 'waiting') {
		uploadFiles.value.delete(fileName);
		uploadProgress.value.delete(fileName);
		uploadStatus.value.delete(fileName);
	}
}

function handleViewList() {
	showUploadModal.value = false;
	handleContinueUpload();
	fetchData();
}

const isInitialState = computed(() => {
	return uploadFiles.value.size === 0 && processingFiles.value.size === 0 && !uploadComplete.value;
});

const hasActiveUploads = computed(() => {
	return Array.from(uploadFiles.value.values()).some(f => 
		f.status === 'uploading'
	);
});

const hasActiveProcessing = computed(() => {
	return processingFiles.value.size > 0 && !uploadComplete.value;
});

const hasBreakpointState = computed(() => {
	return Array.from(processingFiles.value.values()).some(f => {
		const status = f.status;
		if (!status) return false;
		const processId = status.processId;
		if (!processId) return false;
		return status.currentStatus === 'USER_REVIEW_MATCHING' || 
		       status.currentStatus === 'USER_REVIEW_ITEMS';
	});
});

const hasActiveOperations = computed(() => {
	return hasActiveUploads.value || hasActiveProcessing.value || hasBreakpointState.value;
});

const hasCompletedUploads = computed(() => {
	return Array.from(uploadFiles.value.values()).some(f => f.status === 'success');
});

const waitingFiles = computed(() => {
	return Array.from(uploadFiles.value.values()).filter(f => f.status === 'waiting');
});

const hasWaitingFiles = computed(() => {
	return waitingFiles.value.length > 0;
});

const waitingFilesCount = computed(() => {
	return waitingFiles.value.length;
});

const hintText = computed(() => {
	if (hasActiveUploads.value) {
		return '隐藏后可在右上角"传输列表"按钮查看上传进度';
	}
	if (hasActiveProcessing.value) {
		return '隐藏后可在右上角"传输列表"按钮查看处理进度';
	}
	if (hasBreakpointState.value) {
		return '隐藏后可在右上角"传输列表"按钮继续处理';
	}
	return '';
});

const shouldShowHint = computed(() => {
	return hasActiveUploads.value || hasActiveProcessing.value || hasBreakpointState.value;
});

function handleCloseUploadModal() {
	showUploadModal.value = false;
	handleContinueUpload();
	fetchData();
}

function handleHideUploadModal() {
	showUploadModal.value = false;
	handleContinueUpload();
	fetchData();
}

//批量操作
function handleBatchDelete() {
	if (selectedAttachIds.value.length === 0) return;
	dialog.warning({
		title: "确认批量删除",
		content: `确定要删除选中的 ${selectedAttachIds.value.length} 个附件吗？删除后无法恢复。`,
		positiveText: "确定",
		negativeText: "取消",
		onPositiveClick: async () => {
			try {
				const promises = selectedAttachIds.value.map(id => {
					const item = tableData.value.find(t => t.id === id);
					return item ? delKnowledgeDetail({ kid: kid.value, docId: item.docId }) : Promise.resolve();
				});
				await Promise.all(promises);
				message.success('批量删除成功');
				selectedAttachIds.value = [];
				fetchData();
			} catch (error: any) {
				message.error(error?.message || '批量删除失败');
			}
		},
	});
}

function handleBatchDownload() {
	if (selectedAttachIds.value.length === 0) return;
	selectedAttachIds.value.forEach(id => {
		const item = tableData.value.find(t => t.id === id);
		if (item) {
			handleDownload(item);
		}
	});
	message.success(`开始下载 ${selectedAttachIds.value.length} 个文件`);
}

//排序
function handleSortChange(orderBy: string) {
	filterState.orderBy = orderBy as any;
	applyFacetFilters();
}

function toggleSortOrder() {
	filterState.order = filterState.order === 'asc' ? 'desc' : 'asc';
	applyFacetFilters();
}

function getSortPlaceholder(): string {
	const sortMap: Record<string, string> = {
		'create_time': '创建时间',
		'update_time': '更新时间',
		'fileSize': '文件大小',
		'fragmentCount': '片段数量',
		'docName': '文件名',
	};
	return sortMap[filterState.orderBy || 'create_time'] || '排序';
}

//响应式检测
function checkMobile() {
	isMobile.value = window.innerWidth < 768;
}

function handleResize() {
	checkMobile();
}

//键盘导航
function handleKeydown(event: KeyboardEvent) {
	if (isMobile.value) return;
	if (event.target && (event.target as HTMLElement).tagName === 'INPUT') return;
	if (event.target && (event.target as HTMLElement).tagName === 'TEXTAREA') return;
	if (selectedAttachId.value && event.key === 'ArrowDown') {
		event.preventDefault();
		const currentIndex = tableData.value.findIndex(item => item.id === selectedAttachId.value);
		if (currentIndex < tableData.value.length - 1) {
			openDetailPanel(tableData.value[currentIndex + 1]);
		}
	} else if (selectedAttachId.value && event.key === 'ArrowUp') {
		event.preventDefault();
		const currentIndex = tableData.value.findIndex(item => item.id === selectedAttachId.value);
		if (currentIndex > 0) {
			openDetailPanel(tableData.value[currentIndex - 1]);
		}
	} else if (event.key === 'Escape' && (selectedAttachId.value || showDetailInMobile.value)) {
		event.preventDefault();
		closeDetailPanel();
	}
}

//返回（逻辑返回：返回到知识库管理页）
function handleGoBack() {
	router.push({
		name: 'knowledge1',
	});
}

//加载用户信息
async function loadCurrentUserInfo() {
	try {
		const res: any = await getUserInfo();
		if (res && res.data && res.data.user) {
			currentUserId.value = Number(res.data.user.userId) || null;
		}
	} catch (error) {
		//获取用户信息失败，静默处理
	}
}

//表格列定义
const createColumns = () => {
	return [
		{
			type: 'selection',
			width: 50,
		},
		{
			title: '文件名',
			key: 'docName',
			width: 300,
			ellipsis: {
				tooltip: true,
			},
			render: (row: any) => {
				return h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
					h(SvgIcon, { icon: getFileTypeIcon(row.docType), style: `font-size: 20px; color: ${getFileTypeColor(row.docType)};` }),
					h('span', row.docName || '-'),
				]);
			},
		},
		{
			title: '文件类型',
			key: 'docType',
			width: 120,
			render: (row: any) => {
				return h(NTag, { size: 'small', bordered: false, style: `background-color: ${getFileTypeColor(row.docType)}20; color: ${getFileTypeColor(row.docType)};` }, { default: () => (row.docType || '-').toUpperCase() });
			},
		},
		{
			title: '文件大小',
			key: 'fileSize',
			width: 120,
			render: (row: any) => {
				return h('span', formatFileSize(row.fileSize));
			},
		},
		{
			title: '片段数量',
			key: 'fragmentCount',
			width: 100,
			render: (row: any) => {
				return h('span', row.fragmentCount || 0);
			},
		},
		{
			title: '创建时间',
			key: 'createTime',
			width: 180,
			render: (row: any) => {
				return h('span', row.createTime ? format(new Date(row.createTime), 'yyyy-MM-dd HH:mm') : '-');
			},
		},
		{
			title: '操作',
			key: 'actions',
			width: 150,
			fixed: 'right',
			render: (row: any) => {
				return h(NSpace, { size: 'small' }, {
					default: () => [
						h(
							NTooltip,
							{ trigger: 'hover', placement: 'top' },
							{
								default: () => '下载',
								trigger: () => h(
									NButton,
									{
										size: 'small',
										onClick: () => handleDownload(row),
										type: 'primary',
										quaternary: true,
									},
									{ default: () => h(SvgIcon, { icon: 'ri:download-line' }) }
								),
							}
						),
						h(
							NTooltip,
							{ trigger: 'hover', placement: 'top' },
							{
								default: () => '片段',
								trigger: () => h(
									NButton,
									{
										size: 'small',
										onClick: () => handleViewFragments(row),
										type: 'primary',
										quaternary: true,
									},
									{ default: () => h(SvgIcon, { icon: 'ri:file-list-line' }) }
								),
							}
						),
						h(
							NTooltip,
							{ trigger: 'hover', placement: 'top' },
							{
								default: () => '关联条目',
								trigger: () => h(
									NButton,
									{
										size: 'small',
										onClick: () => handleViewAttachItems(row),
										type: 'primary',
										quaternary: true,
									},
									{ default: () => h(SvgIcon, { icon: 'ri:book-open-line' }) }
								),
							}
						),
						h(
							NTooltip,
							{ trigger: 'hover', placement: 'top' },
							{
								default: () => '删除',
								trigger: () => h(
									NButton,
									{
										size: 'small',
										onClick: () => handleDelete(row),
										type: 'error',
										quaternary: true,
									},
									{ default: () => h(SvgIcon, { icon: 'ri:delete-bin-line' }) }
								),
							}
						),
					]
				});
			},
		},
	];
};

const columns = ref(createColumns());

//监听搜索关键词变化（防抖）
let searchTimer: any = null;
let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchKeyword, () => {
	if (searchTimer) clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		applyFacetFilters();
	}, 500);
});

onMounted(async () => {
	checkMobile();
	window.addEventListener('resize', handleResize);
	window.addEventListener('keydown', handleKeydown);
	eventBus.on('upload:task-completed', handleTaskCompleted);
	uploadStore.restoreTasks();
	if (kid.value) {
		fetchFacetStats();
	}
	try {
		kid.value = (route.query.kid as string) || '';
		if (!kid.value) {
			message.warning('缺少知识库ID参数');
		}
		await loadCurrentUserInfo();
		facetPicStatuses.value = [10, 20, 30];
		facetPicAnysStatuses.value = [10, 20, 30];
		facetVectorStatuses.value = [];
		filterDataLoading.value = false;
		await fetchData();
		const attachIdFromQuery = route.query.attachId as string | undefined
		if (attachIdFromQuery) {
			const attachIdNum = Number(attachIdFromQuery)
			if (!isNaN(attachIdNum)) {
				const targetItem = tableData.value.find(item => item.id === attachIdNum)
				if (targetItem) {
					await nextTick()
					openDetailPanel(targetItem)
				} else {
					await nextTick()
					openDetailPanel({ id: attachIdNum })
				}
			}
		}
		uploadStore.waitingTasks.forEach(task => {
			if (task.status === 'waiting' && task.kid === kid.value && !task.xhr) {
				uploadService.uploadTask(task.id);
			}
		});
		uploadStore.processingTasks.forEach(task => {
			if (task.attachId && task.kid === kid.value) {
				uploadService.startProcessingPolling(task.id, task.attachId);
			}
		});
	} catch (error: any) {
		message.error(error?.message || '初始化失败');
	} finally {
		initialLoading.value = false;
	}
});

onUnmounted(() => {
	window.removeEventListener('resize', handleResize);
	window.removeEventListener('keydown', handleKeydown);
	if (searchTimer) clearTimeout(searchTimer);
	if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
	eventBus.off('upload:task-completed', handleTaskCompleted);
	stopProcessingPolling();
	uploadService.stopAllPolling();
});
</script>

<template>
	<div>
		<div v-if="initialLoading" class="page-initial-loading">
			<div class="loading-spinner-wrapper">
				<div class="loading-spinner"></div>
				<div class="loading-spinner-inner"></div>
			</div>
			<div class="loading-content">
				<div class="loading-text">加载中...</div>
				<div class="loading-tips">正在加载附件列表</div>
			</div>
		</div>
		<div v-else class="annex-page-layout">
		<!-- 左侧主内容区 -->
		<div class="main-content-area" :class="{ 'has-detail': selectedAttachId && !isMobile }">
			<!-- 顶部工具栏 -->
			<div class="page-toolbar">
				<div class="toolbar-left">
					<n-space align="center" :size="12">
						<n-button quaternary @click="handleGoBack" class="back-button">
							<template #icon>
								<SvgIcon icon="mage:arrow-left" />
							</template>
						</n-button>
						<h2 class="page-title">附件管理</h2>
					</n-space>
				</div>
					<div class="toolbar-right">
					<n-space :size="8">
						<n-button @click="viewMode = 'list'" :type="viewMode === 'list' ? 'primary' : 'default'" quaternary size="small">
							<template #icon>
								<SvgIcon icon="ri:list-check" />
							</template>
							列表
						</n-button>
						<n-button @click="viewMode = 'card'" :type="viewMode === 'card' ? 'primary' : 'default'" quaternary size="small">
							<template #icon>
								<SvgIcon icon="ri:grid-line" />
							</template>
							卡片
						</n-button>
						<GlobalUploadTrigger @click="() => uploadManagerRef?.show?.()" style="margin-right: 8px;" />
						<n-button @click="showUploadModal = true" type="primary">上传附件</n-button>
					</n-space>
				</div>
			</div>

			<!-- 可滚动内容区域 -->
			<div class="scrollable-content">
				<!-- 搜索和筛选栏 -->
				<div class="filter-section">
					<!-- 搜索框 -->
					<div class="filter-search-row">
						<n-input
							v-model:value="searchKeyword"
							placeholder="搜索文件名..."
							clearable
							style="flex: 1; max-width: 500px;"
						>
							<template #prefix>
								<SvgIcon :icon="isSearching ? 'ri:loader-4-line' : 'ri:search-line'" :class="{ 'search-loading': isSearching }" />
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
									<n-button @click="handleSortChange(filterState.orderBy || 'create_time')" quaternary size="small">
										{{ getSortPlaceholder() }}
									</n-button>
								</template>
								<n-space vertical :size="8">
									<n-button
										v-for="option in [
											{ label: '创建时间', value: 'create_time' },
											{ label: '更新时间', value: 'update_time' },
											{ label: '文件大小', value: 'fileSize' },
											{ label: '片段数量', value: 'fragmentCount' },
											{ label: '文件名', value: 'docName' },
										]"
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
						<div v-for="i in 5" :key="i" class="facet-group-skeleton">
							<n-skeleton height="40px" :sharp="false" />
						</div>
					</div>
					<div v-else class="facet-filters-container">
						<!-- 文件类型筛选 - 单独一行 -->
						<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.docType }">
							<div class="facet-group-header" @click="facetGroupCollapsed.docType = !facetGroupCollapsed.docType">
								<n-space align="center" :size="8">
									<SvgIcon :icon="facetGroupCollapsed.docType ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
									<span class="facet-label">文件类型</span>
								</n-space>
							</div>
							<div v-show="!facetGroupCollapsed.docType" class="facet-group-content">
								<n-checkbox-group v-model:value="facetDocTypes" @update:value="applyFacetFilters">
									<n-space :size="8" wrap>
										<n-checkbox
											v-for="docType in facetOptions.docTypes"
											:key="docType"
											:value="docType"
											size="small"
										>
											<span class="facet-option-label">{{ docType.toUpperCase() }}</span>
											<span class="facet-option-count">{{ facetStats?.docTypes?.[docType] || 0 }}</span>
										</n-checkbox>
									</n-space>
								</n-checkbox-group>
							</div>
						</div>
						
						<!-- 关联条目数量和时间筛选 - 同一行 -->
						<div class="facet-filters-row">
							<!-- 关联条目数量筛选 -->
							<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.itemCount }">
								<div class="facet-group-header" @click="facetGroupCollapsed.itemCount = !facetGroupCollapsed.itemCount">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.itemCount ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">关联条目数量</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.itemCount" class="facet-group-content">
									<n-radio-group v-model:value="facetItemCountRange" @update:value="handleItemCountRangeChange">
										<n-space :size="8" wrap>
											<n-radio
												v-for="range in itemCountRanges"
												:key="`${range.range[0]}-${range.range[1]}`"
												:value="`${range.range[0]}-${range.range[1]}`"
												size="small"
											>
												<span class="facet-option-label">{{ range.label }}</span>
												<span class="facet-option-count">{{ range.count }}</span>
											</n-radio>
										</n-space>
									</n-radio-group>
									<n-button
										v-if="facetItemCountRange"
										text
										size="small"
										style="margin-top: 8px;"
										@click="facetItemCountRange = null; applyFacetFilters()"
									>
										清除筛选
									</n-button>
									<n-empty v-if="itemCountRanges.length === 0" description="暂无数据" size="small" style="margin-top: 8px;" />
								</div>
							</div>
							
							<!-- 时间筛选 -->
							<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.time }">
								<div class="facet-group-header" @click="facetGroupCollapsed.time = !facetGroupCollapsed.time">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.time ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">创建时间</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.time" class="facet-group-content">
									<n-date-picker
										v-model:value="facetDateRange"
										type="datetimerange"
										size="small"
										placeholder="选择时间范围"
										clearable
										style="width: 100%;"
										@update:value="applyFacetFilters"
										:shortcuts="[
											{
												label: '今天',
												value: () => {
													const now = new Date();
													const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
													return [today.getTime(), now.getTime()];
												}
											},
											{
												label: '最近7天',
												value: () => {
													const now = new Date();
													const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
													return [start.getTime(), now.getTime()];
												}
											},
											{
												label: '最近30天',
												value: () => {
													const now = new Date();
													const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
													return [start.getTime(), now.getTime()];
												}
											},
											{
												label: '最近90天',
												value: () => {
													const now = new Date();
													const start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
													return [start.getTime(), now.getTime()];
												}
											}
										]"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
				
				<!-- 批量操作工具栏 -->
				<div v-if="showBatchToolbar" class="batch-toolbar">
					<n-space justify="space-between" align="center">
						<span>已选择 {{ selectedAttachIds.length }} 项</span>
						<n-space :size="8">
							<n-button @click="handleBatchDownload" size="small">批量下载</n-button>
							<n-button @click="handleBatchDelete" type="error" size="small">批量删除</n-button>
							<n-button @click="selectedAttachIds = []" quaternary size="small">取消选择</n-button>
						</n-space>
					</n-space>
				</div>
				
				<!-- 列表内容 -->
				<div class="list-content-area">
					<!-- 调试信息 -->
					<div v-if="false" style="padding: 16px; background: #f5f5f5; margin-bottom: 16px; font-size: 12px; color: #666;">
						<div>loading: {{ loading }}</div>
						<div>viewMode: {{ viewMode }}</div>
						<div>tableData.length: {{ tableData.length }}</div>
						<div>kid: {{ kid }}</div>
						<div>total: {{ total }}</div>
					</div>
					<div v-if="loading" class="list-skeleton">
						<div v-for="i in 8" :key="i" class="list-skeleton-item">
							<n-skeleton height="24px" width="60%" style="margin-bottom: 8px;" />
							<n-skeleton text :repeat="2" />
							<n-skeleton height="20px" width="40%" style="margin-top: 8px;" />
						</div>
					</div>
					<!-- 列表视图 -->
					<n-data-table
						v-else-if="viewMode === 'list' && tableData.length > 0"
						:columns="columns"
						:data="tableData"
						:pagination="pagination"
						:row-key="(row: any) => row.id"
						v-model:checked-row-keys="selectedAttachIds"
						@row-click="(row: any) => openDetailPanel(row)"
						:row-class-name="(row: any) => selectedAttachId === row.id ? 'row-selected' : ''"
						:bordered="false"
						:loading="loading"
						class="annex-table"
					/>
					<!-- 卡片视图 -->
					<div v-else-if="viewMode === 'card' && tableData.length > 0" class="card-view">
						<n-grid :cols="isMobile ? 1 : 3" :x-gap="16" :y-gap="16">
							<n-gi v-for="item in tableData" :key="item.id">
								<n-card
									:class="{ 'card-selected': selectedAttachId === item.id }"
									hoverable
									@click="openDetailPanel(item)"
									class="annex-card"
								>
									<template #header>
										<div style="display: flex; align-items: center; gap: 8px;">
											<SvgIcon :icon="getFileTypeIcon(item.docType)" :style="`font-size: 24px; color: ${getFileTypeColor(item.docType)};`" />
											<span style="font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ item.docName }}</span>
										</div>
									</template>
									<n-space vertical :size="8">
										<div style="display: flex; justify-content: space-between; font-size: 12px; color: #808080;">
											<span>文件大小</span>
											<span>{{ formatFileSize(item.fileSize) }}</span>
										</div>
										<div style="display: flex; justify-content: space-between; font-size: 12px; color: #808080;">
											<span>片段数量</span>
											<span>{{ item.fragmentCount || 0 }}</span>
										</div>
										<div style="display: flex; gap: 8px; flex-wrap: wrap;">
											<n-tag size="small" :style="`background-color: ${getStatusColor(item.vectorStatus)}20; color: ${getStatusColor(item.vectorStatus)};`">
												{{ getStatusLabel(item.vectorStatus, 'vector') }}
											</n-tag>
										</div>
									</n-space>
									<template #footer>
										<div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #808080;">
											<span>{{ formatTimeAgo(item.createTime) }}</span>
											<n-space :size="4">
												<n-button text size="tiny" @click.stop="handleDownload(item)">下载</n-button>
												<n-button text size="tiny" @click.stop="handleDelete(item)" type="error">删除</n-button>
											</n-space>
										</div>
									</template>
								</n-card>
							</n-gi>
						</n-grid>
					</div>
					<n-empty v-else description="暂无附件" />
					
					<!-- 分页 -->
					<div v-if="tableData.length > 0" class="list-pagination">
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
		
		<!-- 右侧详情面板 -->
		<div v-if="selectedAttachId && !isMobile" class="detail-panel-area" :class="{ 'detail-panel-visible': selectedAttachId }">
			<div class="detail-actions-header">
				<n-space justify="space-between" align="center">
					<n-button quaternary @click="closeDetailPanel" size="small">
						<template #icon>
							<SvgIcon icon="ri:close-line" />
						</template>
						收起详情
					</n-button>
					<n-space :size="8" v-if="detailItem">
						<n-button @click="handleDownload(detailItem)" type="info" size="small">下载</n-button>
						<n-button @click="handleReprocess(detailItem)" type="warning" size="small">重新处理</n-button>
						<n-button @click="handleViewFragments(detailItem)" size="small" v-if="detailItem.fragmentCount > 0">片段</n-button>
						<n-button @click="handleDelete(detailItem)" type="error" size="small">删除</n-button>
					</n-space>
				</n-space>
			</div>
			<div class="detail-panel">
				<n-skeleton v-if="detailLoading" :rows="10" />
				<template v-else-if="detailItem">
					<div class="detail-document">
						<!-- 头部Hero区域 -->
						<div class="detail-hero">
							<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
								<SvgIcon :icon="getFileTypeIcon(detailItem.docType)" :style="`font-size: 48px; color: ${getFileTypeColor(detailItem.docType)};`" />
								<h1 class="detail-title">{{ detailItem.docName }}</h1>
							</div>
							<div class="detail-meta-tags">
								<n-space :size="8" wrap>
									<n-tag :style="`background-color: ${getFileTypeColor(detailItem.docType)}20; color: ${getFileTypeColor(detailItem.docType)};`">
										{{ (detailItem.docType || '-').toUpperCase() }}
									</n-tag>
									<n-tag :style="`background-color: ${getStatusColor(detailItem.picStatus)}20; color: ${getStatusColor(detailItem.picStatus)};`">
										拆解图片: {{ getStatusLabel(detailItem.picStatus, 'pic') }}
									</n-tag>
									<n-tag :style="`background-color: ${getStatusColor(detailItem.picAnysStatus)}20; color: ${getStatusColor(detailItem.picAnysStatus)};`">
										分析图片: {{ getStatusLabel(detailItem.picAnysStatus, 'picAnys') }}
									</n-tag>
									<n-tag :style="`background-color: ${getStatusColor(detailItem.vectorStatus)}20; color: ${getStatusColor(detailItem.vectorStatus)};`">
										向量化: {{ getStatusLabel(detailItem.vectorStatus, 'vector') }}
									</n-tag>
								</n-space>
							</div>
						</div>
						
						<!-- 基本信息 -->
						<div class="detail-section">
							<h2 class="detail-section-title">基本信息</h2>
							<n-descriptions :column="1" bordered>
								<n-descriptions-item label="文档ID">{{ detailItem.docId || '-' }}</n-descriptions-item>
								<n-descriptions-item label="文件类型">{{ (detailItem.docType || '-').toUpperCase() }}</n-descriptions-item>
								<n-descriptions-item label="文件大小">{{ formatFileSize(detailItem.fileSize) }}</n-descriptions-item>
								<n-descriptions-item label="片段数量">
									<n-button text size="small" @click="handleViewFragments(detailItem)">
										{{ detailItem.fragmentCount || 0 }}
									</n-button>
								</n-descriptions-item>
								<n-descriptions-item label="创建时间">{{ detailItem.createTime ? format(new Date(detailItem.createTime), 'yyyy-MM-dd HH:mm:ss') : '-' }}</n-descriptions-item>
								<n-descriptions-item label="更新时间">{{ detailItem.updateTime ? format(new Date(detailItem.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-' }}</n-descriptions-item>
							</n-descriptions>
						</div>
						
						<!-- 处理状态 -->
						<!-- 关联信息 -->
						<div class="detail-section">
							<h2 class="detail-section-title">关联信息</h2>
							<div v-if="detailItem.itemUuids && detailItem.itemUuids.length > 0">
								<div style="margin-bottom: 8px; font-weight: 500;">关联知识条目：</div>
								<n-space :size="8" wrap>
									<n-tag
										v-for="(itemUuid, index) in detailItem.itemUuids"
										:key="itemUuid"
										type="info"
										@click="handleViewItemByUuid(itemUuid)"
										style="cursor: pointer;"
									>
										{{ detailItem.itemTitles?.[index] || itemUuid }}
									</n-tag>
								</n-space>
							</div>
							<div v-else-if="detailItem.itemUuid && detailItem.itemTitle">
								<n-button text @click="handleViewItemByUuid(detailItem.itemUuid)" type="primary">
									关联知识条目: {{ detailItem.itemTitle }}
								</n-button>
							</div>
							<div v-else-if="detailItem.itemUuid">
								<n-button text @click="handleViewItemByUuid(detailItem.itemUuid)" type="primary">
									查看关联知识条目
								</n-button>
							</div>
							<div v-else style="color: #808080; font-size: 14px;">暂无关联知识条目</div>
							<div v-if="detailItem.fragmentCount !== null && detailItem.fragmentCount !== undefined && detailItem.fragmentCount > 0" style="margin-top: 12px;">
								<n-button text @click="handleViewFragments(detailItem)" type="info">
									查看知识片段 ({{ detailItem.fragmentCount }})
								</n-button>
							</div>
						</div>
					</div>
				</template>
				<n-empty v-else description="加载中..." />
			</div>
		</div>
		
		<!-- 移动端详情抽屉 -->
		<n-drawer v-model:show="showDetailInMobile" :width="isMobile ? '100%' : 400" placement="right">
			<n-drawer-content :title="detailItem?.docName || '附件详情'">
				<template v-if="detailItem">
					<div class="mobile-detail-document">
						<div class="detail-hero">
							<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
								<SvgIcon :icon="getFileTypeIcon(detailItem.docType)" :style="`font-size: 48px; color: ${getFileTypeColor(detailItem.docType)};`" />
								<h1 class="detail-title">{{ detailItem.docName }}</h1>
							</div>
						</div>
						<div class="detail-section">
							<h2 class="detail-section-title">基本信息</h2>
							<n-descriptions :column="1" bordered>
								<n-descriptions-item label="文档ID">{{ detailItem.docId || '-' }}</n-descriptions-item>
								<n-descriptions-item label="文件类型">{{ (detailItem.docType || '-').toUpperCase() }}</n-descriptions-item>
								<n-descriptions-item label="文件大小">{{ formatFileSize(detailItem.fileSize) }}</n-descriptions-item>
								<n-descriptions-item label="片段数量">{{ detailItem.fragmentCount || 0 }}</n-descriptions-item>
							</n-descriptions>
						</div>
					</div>
				</template>
			</n-drawer-content>
		</n-drawer>
		
		<!-- 上传模态框 -->
		<n-modal v-model:show="showUploadModal" :title="'上传附件'" :auto-focus="false" preset="dialog" :style="{ width: uploadFiles.size > 0 ? '1100px' : '700px' }" :mask-closable="true" :close-on-esc="true">
			<div class="upload-modal-content">
				<!-- 左侧：说明和上传区域 -->
				<div class="upload-modal-left">
					<n-space vertical :size="16">
						<!-- 处理说明 -->
						<n-alert type="info" :bordered="false">
							<template #header>
								<div style="font-weight: 500; margin-bottom: 8px;">自动处理说明</div>
							</template>
							<div style="font-size: 13px; line-height: 1.6;">
								<div style="margin-bottom: 6px;">• 上传的附件将自动创建对应的知识片段，然后为每个知识片段依据语义自动确定归属，归属到已有的知识条目，或者创建新的知识条目草稿，便于后续审核和管理</div>
								<div>• 系统会自动查找与每个知识片段相似条目：如果片段与现有条目相似，将直接关联到现有条目；不相似的片段将创建新条目</div>
							</div>
						</n-alert>
						
						<!-- 上传约束提示 -->
						<n-alert type="info" :bordered="false" style="margin-bottom: 16px;">
							<template #header>
								<div style="font-weight: 500; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
									<SvgIcon icon="ri:information-line" style="font-size: 16px; color: #2080f0;" />
									<span>上传须知</span>
								</div>
							</template>
							<div style="font-size: 13px; line-height: 1.8; color: #515a6e;">
								<div style="margin-bottom: 8px;">
									<span style="font-weight: 500; color: #2d3748;">文件大小：</span>
									<span>单文件最大 {{ formatFileSize(MAX_FILE_SIZE) }}（文件不能为空）</span>
								</div>
								<div style="margin-bottom: 8px;">
									<span style="font-weight: 500; color: #2d3748;">上传数量：</span>
									<span>单次最多 {{ MAX_BATCH_SIZE }} 个文件，同时最多 {{ MAX_CONCURRENT_UPLOADS }} 个并发上传</span>
								</div>
								<div style="margin-bottom: 8px;">
									<span style="font-weight: 500; color: #2d3748;">知识库限制：</span>
									<span>每个知识库最多 {{ MAX_ATTACHMENTS_PER_KNOWLEDGE_BASE }} 个附件</span>
								</div>
								<div style="margin-bottom: 8px;">
									<span style="font-weight: 500; color: #2d3748;">文件名：</span>
									<span>最长 {{ MAX_FILENAME_LENGTH }} 个字符，不支持特殊字符（/ \ : * ? " &lt; &gt; |）</span>
								</div>
								<div>
									<div style="font-weight: 500; color: #2d3748; margin-bottom: 4px;">支持的文件格式：</div>
									<div style="display: flex; flex-wrap: wrap; gap: 8px 12px; margin-left: 8px;">
										<span style="display: inline-flex; align-items: center; gap: 4px;">
											<SvgIcon icon="ri:file-pdf-2-line" style="font-size: 14px; color: #e53e3e;" />
											<span>PDF</span>
										</span>
										<span style="display: inline-flex; align-items: center; gap: 4px;">
											<SvgIcon icon="ri:file-word-2-line" style="font-size: 14px; color: #2b6cb0;" />
											<span>Word (.doc, .docx)</span>
										</span>
										<span style="display: inline-flex; align-items: center; gap: 4px;">
											<SvgIcon icon="ri:file-excel-2-line" style="font-size: 14px; color: #38a169;" />
											<span>Excel (.xls, .xlsx)</span>
										</span>
										<span style="display: inline-flex; align-items: center; gap: 4px;">
											<SvgIcon icon="ri:file-text-line" style="font-size: 14px; color: #718096;" />
											<span>文本 (.txt, .csv, .log, .xml)</span>
										</span>
										<span style="display: inline-flex; align-items: center; gap: 4px;">
											<SvgIcon icon="ri:markdown-line" style="font-size: 14px; color: #805ad5;" />
											<span>Markdown (.md)</span>
										</span>
										<span style="display: inline-flex; align-items: center; gap: 4px;">
											<SvgIcon icon="ri:code-line" style="font-size: 14px; color: #d69e2e;" />
											<span>代码文件 (.java, .js, .py, .cpp, .sql, .html, .css, .ts 等)</span>
										</span>
									</div>
								</div>
								<div style="margin-top: 8px;">
									<span style="font-weight: 500; color: #2d3748;">注意事项：</span>
									<span>请避免上传扫描版PDF文档，推荐上传包含可选中文本的PDF以确保最佳提取效果</span>
								</div>
							</div>
						</n-alert>
						
						<!-- 上传区域 -->
						<n-upload
							class="annex-upload"
							directory-dnd
							:file-list="[]"
							:custom-request="handleFileSelect"
							:on-error="handleUploadError"
							:before-upload="handleBeforeUpload"
							:max="MAX_BATCH_SIZE"
							:accept="ALLOWED_FILE_EXTENSIONS.map(ext => `.${ext}`).join(',')"
							multiple
							:disabled="uploadComplete || isUploading"
							:auto-upload="false"
							@change="handleFileListChange"
						>
							<n-upload-dragger class="upload-dragger">
								<div class="upload-content">
									<div class="upload-icon-container">
										<SvgIcon icon="mage:upload" class="upload-icon"></SvgIcon>
									</div>
									<div class="upload-info">
										<n-p class="upload-title">拖拽文件到此处或点击上传</n-p>
										<n-p class="upload-desc">支持 PDF、Word、Excel、文本、Markdown、代码文件等多种格式</n-p>
										<n-p class="upload-desc" style="font-size: 12px; color: #8c8c8c; margin-top: 6px;">
											单文件最大 {{ formatFileSize(MAX_FILE_SIZE) }} · 单次最多 {{ MAX_BATCH_SIZE }} 个文件
										</n-p>
									</div>
								</div>
							</n-upload-dragger>
						</n-upload>
					</n-space>
				</div>
				
				<!-- 右侧：待上传文件列表（仅当有文件时显示） -->
				<div v-if="uploadFiles.size > 0" class="upload-modal-right">
					<div class="upload-queue">
						<div class="upload-queue-header">
							<span style="font-weight: 500; font-size: 14px;">
								待上传文件 ({{ Array.from(uploadFiles.values()).filter(f => f.status === 'waiting').length }})
							</span>
							<span v-if="Array.from(uploadFiles.values()).some(f => f.status === 'uploading' || f.status === 'success')" style="font-size: 12px; color: #808080; margin-left: 8px;">
								上传中/已完成 ({{ Array.from(uploadFiles.values()).filter(f => f.status === 'uploading' || f.status === 'success').length }}/{{ uploadFiles.size }})
							</span>
						</div>
						<div class="upload-queue-list">
							<div v-for="[fileName, fileInfo] in uploadFiles" :key="fileName" class="upload-queue-item">
								<div class="file-info">
									<SvgIcon :icon="getFileTypeIcon(fileName.split('.').pop() || '')" :style="{ color: getFileTypeColor(fileName.split('.').pop() || '') }" />
									<span class="file-name-text">{{ fileName }}</span>
									<span class="file-size">{{ formatFileSize(fileInfo.file.size) }}</span>
								</div>
								<n-progress 
									v-if="fileInfo.status === 'uploading'"
									:percentage="fileInfo.progress"
									:status="fileInfo.status === 'error' ? 'error' : undefined"
									style="margin-top: 8px;"
								/>
								<div class="file-status">
									<span v-if="fileInfo.status === 'waiting'">等待上传</span>
									<span v-else-if="fileInfo.status === 'uploading'">上传中 {{ fileInfo.progress }}%</span>
									<span v-else-if="fileInfo.status === 'success'" style="color: #52C41A; display: inline-flex; align-items: center; gap: 4px;">
										<SvgIcon icon="ri:check-circle-line" style="font-size: 14px;" /> 上传完成
									</span>
									<span v-else-if="fileInfo.status === 'error'" style="color: #F5222D; display: inline-flex; align-items: center; gap: 4px;">
										<SvgIcon icon="ri:close-circle-line" style="font-size: 14px;" /> {{ fileInfo.error || '上传失败' }}
									</span>
								</div>
								<div class="file-actions" style="margin-top: 8px; display: flex; gap: 8px;">
									<n-button 
										v-if="fileInfo.status === 'error'"
										size="small"
										type="error"
										@click="handleRetryUpload(fileName, fileInfo)"
									>
										重试
									</n-button>
									<n-button 
										v-if="fileInfo.status === 'waiting'"
										size="small"
										type="error"
										@click="handleRemoveFromQueue(fileName)"
									>
										移除
									</n-button>
									<n-button 
										v-if="fileInfo.status === 'uploading'"
										size="small"
										@click="handleCancelUpload(fileName, fileInfo)"
									>
										取消
									</n-button>
								</div>
							</div>
						</div>
					</div>
				</div>
				
				<!-- 处理状态和完成摘要（显示在左侧下方） -->
				<div v-if="processingFiles.size > 0 || uploadComplete" class="upload-modal-left-bottom">
					<!-- 处理状态 -->
					<div v-if="processingFiles.size > 0" class="processing-status">
						<n-divider style="margin: 12px 0;">正在处理文件...</n-divider>
						<div v-for="[fileName, fileInfo] in processingFiles" :key="fileName" class="processing-item">
							<div class="file-name">{{ fileName }}</div>
							<div class="processing-stages">
								<span :class="{ completed: fileInfo.status?.picStatus === 30 }">
									<SvgIcon v-if="fileInfo.status?.picStatus === 30" icon="ri:check-circle-line" style="font-size: 14px; color: #52C41A;" />
									<SvgIcon v-else-if="fileInfo.status?.picStatus === 20" icon="ri:loader-4-line" style="font-size: 14px; animation: spin 1s linear infinite;" />
									<SvgIcon v-else icon="ri:circle-line" style="font-size: 14px; color: #D9D9D9;" />
									读取文档
								</span>
								<span>→</span>
								<span :class="{ completed: fileInfo.status?.picStatus === 30 }">
									<SvgIcon v-if="fileInfo.status?.picStatus === 30" icon="ri:check-circle-line" style="font-size: 14px; color: #52C41A;" />
									<SvgIcon v-else-if="fileInfo.status?.picStatus === 20" icon="ri:loader-4-line" style="font-size: 14px; animation: spin 1s linear infinite;" />
									<SvgIcon v-else icon="ri:circle-line" style="font-size: 14px; color: #D9D9D9;" />
									分割文本
									<span v-if="fileInfo.status?.fragmentCount">({{ fileInfo.status.fragmentCount }}个)</span>
								</span>
								<span v-if="fileInfo.status?.picStatus === 30">→</span>
								<span v-if="fileInfo.status?.picStatus === 30" :class="{ completed: fileInfo.status?.vectorStatus === 30 }">
									<SvgIcon v-if="fileInfo.status?.vectorStatus === 30" icon="ri:check-circle-line" style="font-size: 14px; color: #52C41A;" />
									<SvgIcon v-else-if="fileInfo.status?.vectorStatus === 20" icon="ri:loader-4-line" style="font-size: 14px; animation: spin 1s linear infinite;" />
									<SvgIcon v-else icon="ri:circle-line" style="font-size: 14px; color: #D9D9D9;" />
									查找相似条目
									<span v-if="fileInfo.status?.matchResult">({{ fileInfo.status.matchResult.matchedCount }}个已匹配)</span>
								</span>
								<span>→</span>
								<span :class="{ completed: fileInfo.status?.vectorStatus === 30 }">
									<SvgIcon v-if="fileInfo.status?.vectorStatus === 30" icon="ri:check-circle-line" style="font-size: 14px; color: #52C41A;" />
									<SvgIcon v-else-if="fileInfo.status?.vectorStatus === 20" icon="ri:loader-4-line" style="font-size: 14px; animation: spin 1s linear infinite;" />
									<SvgIcon v-else icon="ri:circle-line" style="font-size: 14px; color: #D9D9D9;" />
									存储
									<span v-if="fileInfo.status?.vectorStatus === 20">({{ Math.round((fileInfo.status?.fragmentCount || 0) * 0.6) }}%)</span>
								</span>
								<span v-if="fileInfo.status?.vectorStatus === 30">→ <SvgIcon icon="ri:check-circle-line" style="font-size: 14px; color: #52C41A;" /> 完成</span>
							</div>
						</div>
					</div>
					
					<!-- 完成摘要 -->
					<div v-if="uploadComplete" class="upload-summary">
						<n-divider style="margin: 12px 0;">
							<SvgIcon icon="ri:check-circle-line" style="font-size: 16px; color: #52C41A; margin-right: 4px;" />
							上传完成
						</n-divider>
						<div v-for="result in uploadResults" :key="result.id" class="upload-result-item">
							<div class="result-file-name">{{ result.docName }}</div>
							<div class="result-info">
								<span v-if="result.fragmentCount">片段数：{{ result.fragmentCount }}</span>
								<span v-if="result.matchResult">
									匹配结果：{{ result.matchResult.matchedCount }} 个片段关联到现有条目，{{ result.matchResult.newItemCount }} 个片段创建新条目
								</span>
							</div>
							<div v-if="result.itemUuids && result.itemUuids.length > 0" style="margin-top: 8px;">
								<div style="margin-bottom: 4px; font-weight: 500; font-size: 12px;">已关联条目：</div>
								<n-space :size="8" wrap>
									<n-tag
										v-for="(itemUuid, index) in result.itemUuids"
										:key="itemUuid"
										type="info"
										@click="handleViewItemByUuid(itemUuid)"
										style="cursor: pointer;"
									>
										{{ result.itemTitles?.[index] || itemUuid }}
									</n-tag>
								</n-space>
							</div>
						</div>
						<div v-for="[fileName, fileInfo] in Array.from(uploadFiles.entries()).filter(([_, f]) => f.status === 'error')" :key="fileName" class="upload-result-item" style="background: #FFF1F0; border-color: #FFCCC7;">
							<div class="result-file-name" style="color: #F5222D;">{{ fileName }}</div>
							<div class="result-info">
								<span style="color: #F5222D; display: inline-flex; align-items: center; gap: 4px;">
									<SvgIcon icon="ri:close-circle-line" style="font-size: 14px;" /> {{ fileInfo.error || '上传失败' }}
								</span>
							</div>
							<div style="margin-top: 8px;">
								<n-button size="small" type="error" @click="handleRetryUpload(fileName, fileInfo)">重试</n-button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<template #action>
				<div class="modal-footer">
					<div v-if="shouldShowHint" class="footer-hint">
						<SvgIcon icon="ri:information-line" style="font-size: 12px; color: #808080; margin-right: 4px;" />
						<span style="font-size: 12px; color: #808080;">{{ hintText }}</span>
					</div>
					<n-space>
						<template v-if="isInitialState">
							<n-button @click="handleCloseUploadModal">关闭</n-button>
						</template>
						<template v-else-if="hasActiveOperations">
							<n-tooltip placement="top">
								<template #trigger>
									<n-button @click="handleHideUploadModal">隐藏</n-button>
								</template>
								<span>隐藏后可在右上角"上传"按钮查看任务进度和继续处理</span>
							</n-tooltip>
						</template>
						<template v-else>
							<n-button 
								v-if="hasWaitingFiles && !isUploading"
								type="primary"
								@click="handleStartUpload"
								:loading="isUploading"
							>
								开始上传 ({{ waitingFilesCount }})
							</n-button>
							<n-button 
								v-if="hasCompletedUploads && !hasWaitingFiles"
								secondary
								@click="handleContinueUpload"
							>
								继续上传
							</n-button>
							<n-button 
								@click="handleCloseUploadModal"
							>
								关闭
							</n-button>
						</template>
					</n-space>
				</div>
			</template>
		</n-modal>
		
		<!-- 文件格式验证模态框 -->
		<n-modal v-model:show="showFileValidationModal" title="文件格式验证" :auto-focus="false" preset="dialog" :style="{ width: '600px' }" :mask-closable="true" :close-on-esc="true">
			<n-space vertical>
				<n-alert type="warning" show-icon>
					<template #icon>
						<SvgIcon icon="ri:alert-line" />
					</template>
					<div>检测到部分文件不符合要求，请查看下方详情</div>
				</n-alert>
				
				<!-- 不符合要求的文件列表 -->
				<div v-if="invalidFiles.length > 0">
					<n-text strong>不符合要求的文件（{{ invalidFiles.length }}个）：</n-text>
					<div class="invalid-files-list">
						<div v-for="file in invalidFiles" :key="file.name" class="invalid-file-item">
							<SvgIcon icon="ri:file-close-line" size="16" color="#ff4d4f" />
							<span class="file-name">{{ file.name }}</span>
							<span class="file-extension">{{ file.name.substring(file.name.lastIndexOf('.')) }}</span>
							<span class="file-issue">
								{{ getFileIssueText(file) }}
							</span>
						</div>
					</div>
				</div>
				
				<!-- 有效文件列表 -->
				<div v-if="validFiles.length > 0" style="margin-top: 16px;">
					<n-text strong>有效文件（{{ validFiles.length }}个）：</n-text>
					<div class="valid-files-list">
						<div v-for="file in validFiles" :key="file.name" class="valid-file-item">
							<SvgIcon icon="ri:file-check-line" size="16" color="#52c41a" />
							<span class="file-name">{{ file.name }}</span>
							<span class="file-size">{{ formatFileSize(file.size) }}</span>
						</div>
					</div>
				</div>
				
				<!-- 操作按钮 -->
				<div class="validation-actions">
					<n-space justify="space-between">
						<n-button @click="reselectFiles" quaternary>
							<template #icon>
								<SvgIcon icon="ri:refresh-line" size="16" />
							</template>
							重新选择文件
						</n-button>
						<n-space>
							<n-button @click="showFileValidationModal = false">取消</n-button>
							<n-button type="primary" @click="useValidFilesOnly" :disabled="validFiles.length === 0">
								<template #icon>
									<SvgIcon icon="ri:check-line" size="16" />
								</template>
								使用有效文件（{{ validFiles.length }}个）
							</n-button>
						</n-space>
					</n-space>
				</div>
			</n-space>
		</n-modal>

		<!-- 片段列表模态框 -->
		<n-modal
			v-model:show="showFragmentListModal"
			preset="card"
			:title="currentItemUuid ? `知识片段列表 - ${attachItems.find((i: any) => i.itemUuid === currentItemUuid)?.title || '条目片段'}` : '知识片段列表'"
			:mask-closable="true"
			:close-on-esc="true"
			style="width: 1400px; max-width: 95vw; max-height: 90vh;"
			:show-footer="false"
			@update:show="(val) => { if (!val) { currentItemUuid.value = ''; currentDocId.value = ''; isFromAttachItemsModal.value = false; } }"
		>
			<n-space vertical :size="16">
				<!-- 搜索和排序 -->
				<n-space :size="12" align="center">
					<n-input
						v-model:value="fragmentSearchKeyword"
						placeholder="搜索片段内容..."
						clearable
						style="width: 300px;"
					>
						<template #prefix>
							<n-icon><SvgIcon icon="ri:search-line" /></n-icon>
						</template>
					</n-input>
					<n-popover trigger="hover" placement="bottom">
						<template #trigger>
							<n-button @click="handleFragmentSortChange(fragmentOrderBy)" quaternary size="small">
								{{ getFragmentSortPlaceholder() }}
							</n-button>
						</template>
						<n-space vertical :size="8">
							<n-button
								v-for="option in fragmentSortOptions"
								:key="option.value"
								:type="fragmentOrderBy === option.value ? 'primary' : 'default'"
								quaternary
								@click="handleFragmentSortChange(option.value)"
								style="width: 100%"
							>
								{{ option.label }}
							</n-button>
						</n-space>
					</n-popover>
					<n-button @click="toggleFragmentSortOrder" quaternary size="small">
						<template #icon>
							<SvgIcon :icon="fragmentOrder === 'asc' ? 'ri:arrow-up-line' : 'ri:arrow-down-line'" />
						</template>
					</n-button>
					<n-tag type="info" size="small">共 {{ fragmentTotal }} 个片段</n-tag>
				</n-space>

				<!-- 片段列表 -->
				<n-spin :show="fragmentListLoading">
					<n-data-table
						:columns="fragmentColumns"
						:data="fragmentTableData"
						:pagination="false"
						:scroll-x="800"
						:row-key="(row: any) => row.fid || row.idx"
						@row-click="(row: any) => handleViewFragmentDetail(row)"
						style="cursor: pointer;"
					/>
					<div v-if="!fragmentListLoading && fragmentTableData.length === 0" style="padding: 40px; text-align: center;">
						<n-empty description="暂无片段数据" />
					</div>
				</n-spin>

				<!-- 分页 -->
				<div v-if="fragmentTotal > 0" style="display: flex; justify-content: center;">
					<n-pagination
						v-model:page="fragmentPagination.page"
						:item-count="fragmentPagination.itemCount"
						v-model:page-size="fragmentPagination.pageSize"
						:page-sizes="fragmentPagination.pageSizes"
						show-size-picker
						@update:page="fragmentPagination.onUpdatePage"
						@update:page-size="fragmentPagination.onUpdatePageSize"
					/>
				</div>
			</n-space>
		</n-modal>

		<!-- 片段详情模态框 -->
		<n-modal
			v-model:show="showFragmentDetailModal"
			preset="card"
			title="片段详情"
			:mask-closable="true"
			:close-on-esc="true"
			style="width: 800px; max-width: 90vw; max-height: 85vh;"
			:show-footer="false"
		>
			<FragmentInfoPanel
				v-if="selectedFragment"
				:item="selectedFragment"
				:doc-id="getFragmentDocId(selectedFragment)"
			/>
		</n-modal>

		<!-- 知识条目详情面板 -->
		<n-drawer
			v-model:show="showItemDetailDrawer"
			:width="600"
			placement="right"
			:mask-closable="true"
		>
			<template #header>
				<div class="detail-panel-header">
					<span class="detail-panel-title">知识条目详情</span>
				</div>
			</template>
			<div class="detail-panel-content">
				<div class="detail-panel-body">
					<n-skeleton v-if="itemDetailLoading" :rows="10" />
					<ItemDetailPanel
						v-else-if="selectedItem"
						ref="itemDetailPanelRef"
						:item="selectedItem"
						:doc-id="getItemDocId(selectedItem)"
						@update="handleItemDetailUpdate"
						@dirty="handleItemDetailDirty"
						@valid="handleItemDetailValid"
					/>
				</div>
				<div class="detail-panel-footer">
					<n-space justify="end" :size="12">
						<n-button @click="handleCloseItemDetail" secondary>
							关闭
						</n-button>
						<n-button 
							v-if="itemDetailIsDirty"
							@click="handleRestoreItemDetail" 
							secondary
						>
							恢复
						</n-button>
						<n-button 
							v-if="itemDetailIsDirty"
							type="primary" 
							@click="handleSaveItemDetail" 
							:disabled="!itemDetailIsValid"
						>
							保存
						</n-button>
					</n-space>
				</div>
			</div>
		</n-drawer>

		<!-- 附件关联的知识条目列表模态框 -->
		<n-modal
			v-model:show="showAttachItemsModal"
			preset="card"
			:title="currentAttachForItems ? `关联知识条目 - ${currentAttachForItems.docName}` : '关联知识条目'"
			:mask-closable="true"
			:close-on-esc="true"
			style="width: 1400px; max-width: 95vw; max-height: 90vh;"
			:show-footer="false"
		>
			<n-spin :show="attachItemsLoading">
				<ItemList
					v-if="attachItems.length > 0"
					:items="attachItems"
					:is-batch="false"
					@select="handleAttachItemSelect"
					@update="handleAttachItemUpdate"
					@view-fragment="handleAttachItemViewFragment"
					@delete-item="handleAttachItemDelete"
					@batch-delete="handleAttachItemBatchDelete"
				/>
				<n-empty v-else-if="!attachItemsLoading" description="该附件暂无关联的知识条目" />
			</n-spin>
		</n-modal>
		</div>
		
		<GlobalUploadManager ref="uploadManagerRef" />
	</div>
</template>

<style scoped>
.modal-footer {
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 100%;
}

.footer-hint {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 4px 0;
	margin-bottom: 4px;
}
.annex-page-layout {
	display: flex;
	height: 100vh;
	width: 100%;
	overflow: hidden;
	background: #FAF9F8;
}

.main-content-area {
	flex: 1 1 auto;
	min-width: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	transition: all 0.3s ease;
}

.main-content-area.has-detail {
	flex: 0 0 35%;
	max-width: 35%;
}

.page-toolbar {
	padding: 16px 24px;
	background: #FFFFFF;
	border-bottom: 1px solid #EDEBE9;
	flex-shrink: 0;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.toolbar-left {
	display: flex;
	align-items: center;
	flex: 1;
}

.toolbar-right {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.page-title {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	color: #323130;
}

.scrollable-content {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.filter-section {
	padding: 16px 24px;
	background: #FFFFFF;
	border-bottom: 1px solid #EDEBE9;
	flex-shrink: 0;
}

.filter-search-row {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 16px;
}

.facet-filters-container {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.facet-filters-row {
	display: grid;
	grid-template-columns: 2fr 1fr;
	gap: 12px;
}

.facet-group {
	padding: 12px 16px;
	background: #FAF9F8;
	border-radius: 4px;
	border: 1px solid #EDEBE9;
	transition: all 0.2s ease;
}

.facet-group:hover {
	border-color: #D1D1D1;
}

.facet-group-header {
	cursor: pointer;
	user-select: none;
	padding: 4px 0;
}

.facet-group-content {
	padding-top: 12px;
	animation: expandDown 0.3s ease;
}

.facet-label {
	font-size: 13px;
	font-weight: 600;
	color: #323130;
}

.facet-option-label {
	flex: 1;
	min-width: 0;
}

.facet-option-count {
	margin-left: auto;
	padding-left: 8px;
	font-size: 11px;
	color: #808080;
	background: #F0F0F0;
	padding: 1px 6px;
	border-radius: 10px;
	font-weight: 500;
}

.batch-toolbar {
	padding: 12px 24px;
	background: #E6F7FF;
	border-bottom: 1px solid #91D5FF;
	flex-shrink: 0;
}

.list-content-area {
	flex: 1;
	padding: 16px 24px;
	background: #FAF9F8;
	min-height: 0;
}

.annex-table :deep(.row-selected) {
	background-color: #E6F7FF !important;
}

.annex-table :deep(.n-data-table-tr:hover) {
	background-color: #F3F2F1 !important;
	cursor: pointer;
}

.card-view {
	padding: 16px 0;
}

.annex-card {
	cursor: pointer;
	transition: all 0.2s ease;
}

.annex-card:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-selected {
	border-color: #1890FF !important;
	box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2) !important;
}

.detail-panel-area {
	flex: 0 0 65%;
	min-width: 0;
	max-width: 65%;
	background: #FFFFFF;
	border-left: 1px solid #EDEBE9;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	transition: all 0.4s ease;
	opacity: 0;
	transform: translateX(30px);
}

.detail-panel-area.detail-panel-visible {
	opacity: 1;
	transform: translateX(0);
}

.detail-actions-header {
	padding: 12px 20px;
	border-bottom: 1px solid #EDEBE9;
	background: #FAF9F8;
	flex-shrink: 0;
}

.detail-panel {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 20px;
}

.detail-document {
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
}

.detail-hero {
	margin-bottom: 32px;
	padding-bottom: 24px;
	border-bottom: 2px solid #EDEBE9;
}

.detail-title {
	font-size: 28px;
	font-weight: 700;
	color: #323130;
	margin: 0;
	line-height: 1.2;
	word-wrap: break-word;
}

.detail-meta-tags {
	margin-top: 16px;
}

.detail-section {
	margin-bottom: 32px;
}

.detail-section-title {
	font-size: 18px;
	font-weight: 600;
	color: #323130;
	margin: 0 0 16px 0;
	padding-bottom: 12px;
	border-bottom: 1px solid #EDEBE9;
}

.upload-dragger {
	padding: 32px;
	border: 2px dashed #e0e0e0;
	border-radius: 12px;
	text-align: center;
	transition: all 0.3s;
}

.upload-dragger:hover {
	border-color: #1890ff;
}

.upload-content {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.upload-icon-container {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 64px;
	height: 64px;
	border-radius: 50%;
	margin-bottom: 16px;
}

.upload-icon {
	font-size: 2.5rem;
	color: #1890ff;
}

.upload-info {
	margin-bottom: 24px;
}

.upload-title {
	font-size: 18px;
	font-weight: 500;
	margin-bottom: 8px;
}

.upload-desc {
	font-size: 14px;
	margin-bottom: 8px;
	color: #808080;
}

.page-initial-loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100vh;
	width: 100%;
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

/* 文件验证模态框样式 */
.invalid-files-list, .valid-files-list {
	margin-top: 8px;
	max-height: 200px;
	overflow-y: auto;
	border: 1px solid #e0e0e6;
	border-radius: 6px;
	padding: 8px;
	background: #fafafa;
}

.invalid-file-item, .valid-file-item {
	display: flex;
	align-items: center;
	padding: 6px 8px;
	margin-bottom: 4px;
	border-radius: 4px;
	background: white;
	border: 1px solid #f0f0f0;
}

.invalid-file-item {
	border-left: 3px solid #ff4d4f;
}

.valid-file-item {
	border-left: 3px solid #52c41a;
}

.file-name {
	flex: 1;
	margin-left: 8px;
	font-weight: 500;
	color: #333;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.file-extension {
	margin-left: 8px;
	padding: 2px 6px;
	background: #ff4d4f;
	color: white;
	border-radius: 3px;
	font-size: 12px;
	font-weight: 500;
}

.file-issue {
	margin-left: 8px;
	padding: 2px 6px;
	background: #faad14;
	color: white;
	border-radius: 3px;
	font-size: 12px;
	font-weight: 500;
}

.file-size {
	margin-left: 8px;
	color: #666;
	font-size: 12px;
}

.validation-actions {
	margin-top: 16px;
	padding-top: 16px;
	border-top: 1px solid #e0e0e6;
}

.upload-modal-content {
	display: flex;
	gap: 20px;
	align-items: flex-start;
}

.upload-modal-left {
	flex: 1;
	min-width: 0;
}

.upload-modal-left-bottom {
	margin-top: 16px;
}

.upload-modal-right {
	width: 360px;
	flex-shrink: 0;
	border-left: 1px solid #E0E0E6;
	padding-left: 20px;
}

.upload-queue {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.upload-queue-header {
	margin-bottom: 12px;
	padding-bottom: 12px;
	border-bottom: 1px solid #E0E0E6;
	flex-shrink: 0;
}

.upload-queue-list {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	max-height: 500px;
	min-height: 0;
}

.upload-queue-list::-webkit-scrollbar {
	width: 6px;
}

.upload-queue-list::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.upload-queue-list::-webkit-scrollbar-thumb {
	background: #D9D9D9;
	border-radius: 3px;
}

.upload-queue-list::-webkit-scrollbar-thumb:hover {
	background: #BFBFBF;
}

.upload-queue-item {
	padding: 12px;
	background: #FAFAFA;
	border-radius: 4px;
	margin-bottom: 8px;
	border: 1px solid #F0F0F0;
}

.upload-queue-item .file-info {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.upload-queue-item .file-name-text {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.upload-queue-item .file-size {
	color: #808080;
	font-size: 12px;
	margin-left: auto;
	flex-shrink: 0;
}

.upload-queue-item .file-status {
	margin-top: 8px;
	font-size: 12px;
}

.processing-status {
	margin-top: 16px;
}

.processing-item {
	padding: 12px;
	background: #FAFAFA;
	border-radius: 4px;
	margin-bottom: 8px;
	border: 1px solid #F0F0F0;
}

.processing-item .file-name {
	font-weight: 500;
	margin-bottom: 8px;
}

.processing-item .processing-stages {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: #808080;
}

.processing-item .processing-stages .completed {
	color: #52C41A;
}

.upload-summary {
	margin-top: 16px;
}

.upload-result-item {
	padding: 12px;
	background: #F6FFED;
	border-radius: 4px;
	margin-bottom: 8px;
	border: 1px solid #B7EB8F;
}

.upload-result-item .result-file-name {
	font-weight: 500;
	margin-bottom: 4px;
	color: #52C41A;
}

.upload-result-item .result-info {
	font-size: 12px;
	color: #808080;
	display: flex;
	gap: 16px;
	flex-wrap: wrap;
}

.list-pagination {
	padding: 16px 0;
	display: flex;
	justify-content: center;
}

.search-loading {
	animation: spin 1s linear infinite;
	color: #FA8C16;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
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
	0% {
		opacity: 0;
		max-height: 0;
		transform: translateY(-10px);
	}
	100% {
		opacity: 1;
		max-height: 800px;
		transform: translateY(0);
	}
}

.mobile-detail-document {
	padding: 20px 16px;
}

.detail-panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0;
}

.detail-panel-title {
	font-size: 18px;
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
	padding: 16px 0;
	border-top: 1px solid #EDEBE9;
	flex-shrink: 0;
}

@media (max-width: 768px) {
	.main-content-area.has-detail {
		flex: 1;
		max-width: 100%;
	}
	
	.detail-panel-area {
		display: none;
	}
	
	.filter-section {
		padding: 12px 16px;
	}
	
	.facet-filters-container {
		gap: 8px;
	}
	
	.facet-filters-row {
		grid-template-columns: 1fr;
	}
}

/* 片段列表模态框样式 */
:deep(.fragment-content-preview mark) {
	background-color: #fff3cd;
	color: #856404;
	padding: 2px 4px;
	border-radius: 2px;
	font-weight: 500;
}
</style>

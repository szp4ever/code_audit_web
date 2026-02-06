	<script setup lang="ts">
		import { onMounted, reactive, ref, computed, watch, nextTick, onUnmounted, h } from "vue";
	import {
		NButton,
		NButtonGroup,
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
	NDatePicker,
	NSlider,
	NTooltip,
	NRadio,
	NRadioGroup,
	NSwitch,
	NSteps,
	NStep,
	NCard,
	NScrollbar,
	NDropdown,
	NDataTable,
} from "naive-ui";
		import { SvgIcon } from "@/components/common";
	import CweSelector from "@/components/knowledge/CweSelector.vue";
	import TagPicker from "@/components/knowledge/TagPicker.vue";
	import CodeEditor from "@/components/knowledge/CodeEditor.vue";
	import RiskScoreCard from "@/components/knowledge/RiskScoreCard.vue";
	import FragmentListByItem from "@/views/knowledge/review/FragmentListByItem.vue";
	import hljs from 'highlight.js';
	import 'highlight.js/styles/github.css';
	import {
		getKnowledgeItemList,
		getKnowledgeItemDetail,
		createKnowledgeItem,
		updateKnowledgeItem,
		deleteKnowledgeItem,
		deleteKnowledgeItemBatch,
		batchUpdateKnowledgeItems,
		exportPreview,
		exportKnowledgeItems,
		type KnowledgeItemListQuery,
		type KnowledgeItemReq,
	} from "@/api/knowledgeItem";
		import { getDictDataByType } from "@/api/dict";
		import { getKnowledgeByRole } from "@/api/knowledge";
	import { 
	getCweReferenceListAll,
	type CweReference,
	} from "@/api/cwe";
		import { getKnowledgeTagList, createKnowledgeTag } from "@/api/knowledgeTag";
		import { getUserInfo } from "@/api/user";
		import { useRouter, useRoute } from "vue-router";
	import { format, formatDistanceToNow } from "date-fns";
	import { zhCN } from "date-fns/locale";
		const router = useRouter();
		const route = useRoute();
		const message = useMessage();
		const dialog = useDialog();
		
	//详情面板
	const showDetailPanel = ref(false);
	const detailItem = ref<any>(null);
	const detailLoading = ref(false);
	//Master-Detail布局相关
	const selectedItemUuid = ref<string | null>(null);
	const isMobile = ref(false);
	const showDetailInMobile = ref(false);
	const detailPanelCollapsed = ref(false);
		
		//创建模态框
		const showCreateModal = ref(false);
		const createFormRef = ref<FormInst | null>(null);
		// 新增：初始化状态锁
		const isInit = ref(false);
		//编辑模态框
		const showEditModal = ref(false);
		const editFormRef = ref<FormInst | null>(null);
		const isEditInit = ref(false);
		const editingItemUuid = ref<string | null>(null);
		const createFormValue = ref<KnowledgeItemReq & { 
			vulnerabilityTypes?: string[];
			riskAttackVector?: string;
			riskComplexity?: string;
			riskPrivileges?: string;
			riskUserInteraction?: string;
			riskImpact?: string[];
		}>({
			kid: undefined,
			title: '',
			summary: '',
			problemDescription: '',
			fixSolution: '',
			exampleCode: '',
			vulnerabilityType: undefined,
			vulnerabilityTypes: [],
			language: undefined,
			severity: undefined,
			cvssVector: undefined,
			cvssScore: undefined,
			status: 'draft',
			sourceType: 'manual',
			tags: [],
			riskAttackVector: undefined,
			riskComplexity: undefined,
			riskPrivileges: undefined,
			riskUserInteraction: undefined,
			riskImpact: [],
		});
	//CWE选择器
	const showCweSelector = ref(false);
	const cweSelectorContext = ref<'create' | 'edit' | 'filter'>('create');
	const tempSelectedCweIds = ref<string[]>([]);
		const createFormRules: FormRules = {
			title: [
				{ required: true, message: '请输入标题', trigger: ['blur', 'input'] },
				{ min: 1, max: 255, message: '标题长度应在 1-255 个字符之间', trigger: ['blur', 'input'] },
			],
			vulnerabilityTypes: [
				{ 
					required: true, 
					message: '请至少选择一个漏洞类型', 
					trigger: ['blur', 'change'],
					validator: (rule: any, value: any) => {
						const vulnTypes = (createFormValue.value as any).vulnerabilityTypes;
						if (!vulnTypes || vulnTypes.length === 0) {
							return new Error('请至少选择一个漏洞类型');
						}
						return true;
					}
				},
			],
			problemDescription: [
				{ required: true, message: '请输入问题描述', trigger: ['blur', 'input'] },
				{ min: 1, message: '问题描述不能为空', trigger: ['blur', 'input'] },
			],
			fixSolution: [
				{ required: true, message: '请输入修复方案', trigger: ['blur', 'input'] },
				{ min: 1, message: '修复方案不能为空', trigger: ['blur', 'input'] },
			],
			status: [
				{ required: true, message: '请选择状态', trigger: ['blur', 'change'] },
			],
			riskAttackVector: [
				{ required: true, message: '请选择攻击方式', trigger: ['blur', 'change'] },
			],
			riskComplexity: [
				{ required: true, message: '请选择攻击复杂度', trigger: ['blur', 'change'] },
			],
			riskPrivileges: [
				{ required: true, message: '请选择所需权限', trigger: ['blur', 'change'] },
			],
			riskUserInteraction: [
				{ required: true, message: '请选择用户交互', trigger: ['blur', 'change'] },
			],
			riskImpact: [
				{ 
					required: true, 
					message: '请至少选择一项影响', 
					trigger: ['blur', 'change'],
					validator: (rule: any, value: any) => {
						const impact = (createFormValue.value as any).riskImpact;
						if (!impact || impact.length === 0) {
							return new Error('请至少选择一项影响');
						}
						return true;
					}
				},
			],
		};
		const isCreateFormValid = ref(false);
		const submitting = ref(false);
		//编辑表单
		const editFormValue = ref<KnowledgeItemReq & {
			vulnerabilityTypes?: string[];
			riskAttackVector?: string;
			riskComplexity?: string;
			riskPrivileges?: string;
			riskUserInteraction?: string;
			riskImpact?: string[];
		}>({
			kid: undefined,
			title: '',
			summary: '',
			problemDescription: '',
			fixSolution: '',
			exampleCode: '',
			vulnerabilityType: undefined,
			vulnerabilityTypes: [],
			language: undefined,
			severity: undefined,
			cvssVector: undefined,
			cvssScore: undefined,
			status: 'draft',
			sourceType: 'manual',
			tags: [],
			riskAttackVector: undefined,
			riskComplexity: undefined,
			riskPrivileges: undefined,
			riskUserInteraction: undefined,
			riskImpact: [],
		});
		const originalEditFormValue = ref<KnowledgeItemReq & {
			vulnerabilityTypes?: string[];
			riskAttackVector?: string;
			riskComplexity?: string;
			riskPrivileges?: string;
			riskUserInteraction?: string;
			riskImpact?: string[];
		}>({
			kid: undefined,
			title: '',
			summary: '',
			problemDescription: '',
			fixSolution: '',
			exampleCode: '',
			vulnerabilityType: undefined,
			vulnerabilityTypes: [],
			language: undefined,
			severity: undefined,
			cvssVector: undefined,
			cvssScore: undefined,
			status: 'draft',
			sourceType: 'manual',
			tags: [],
			riskAttackVector: undefined,
			riskComplexity: undefined,
			riskPrivileges: undefined,
			riskUserInteraction: undefined,
			riskImpact: [],
		});
		const isEditFormDirty = computed(() => {
			if (!editingItemUuid.value) return false;
			const current = editFormValue.value;
			const original = originalEditFormValue.value;
			const currentVulnTypes = (current as any).vulnerabilityTypes || [];
			const originalVulnTypes = (original as any).vulnerabilityTypes || [];
			const currentRiskImpact = (current as any).riskImpact || [];
			const originalRiskImpact = (original as any).riskImpact || [];
			const currentTags = current.tags || [];
			const originalTags = original.tags || [];
			return (
				current.kid !== original.kid ||
				current.title !== original.title ||
				current.summary !== original.summary ||
				current.problemDescription !== original.problemDescription ||
				current.fixSolution !== original.fixSolution ||
				current.exampleCode !== original.exampleCode ||
				current.vulnerabilityType !== original.vulnerabilityType ||
				JSON.stringify(currentVulnTypes.sort()) !== JSON.stringify(originalVulnTypes.sort()) ||
				current.language !== original.language ||
				current.severity !== original.severity ||
				current.cvssVector !== original.cvssVector ||
				(current.cvssScore !== original.cvssScore && 
				 (current.cvssScore !== null && current.cvssScore !== undefined) !== 
				 (original.cvssScore !== null && original.cvssScore !== undefined) ||
				 (current.cvssScore !== null && current.cvssScore !== undefined && 
				  Math.abs((current.cvssScore as number) - (original.cvssScore as number)) > 0.0001)) ||
				current.status !== original.status ||
				current.sourceType !== original.sourceType ||
				JSON.stringify(currentTags.sort()) !== JSON.stringify(originalTags.sort()) ||
				(current as any).riskAttackVector !== (original as any).riskAttackVector ||
				(current as any).riskComplexity !== (original as any).riskComplexity ||
				(current as any).riskPrivileges !== (original as any).riskPrivileges ||
				(current as any).riskUserInteraction !== (original as any).riskUserInteraction ||
				JSON.stringify(currentRiskImpact.sort()) !== JSON.stringify(originalRiskImpact.sort())
			);
		});
		const editFormRules: FormRules = {
			title: [
				{ required: true, message: '请输入标题', trigger: ['blur', 'input'] },
				{ min: 1, max: 255, message: '标题长度应在 1-255 个字符之间', trigger: ['blur', 'input'] },
			],
			vulnerabilityTypes: [
				{ 
					required: true, 
					message: '请至少选择一个漏洞类型', 
					trigger: ['blur', 'change'],
					validator: (rule: any, value: any) => {
						const vulnTypes = (editFormValue.value as any).vulnerabilityTypes;
						if (!vulnTypes || vulnTypes.length === 0) {
							return new Error('请至少选择一个漏洞类型');
						}
						return true;
					}
				},
			],
			problemDescription: [
				{ required: true, message: '请输入问题描述', trigger: ['blur', 'input'] },
				{ min: 1, message: '问题描述不能为空', trigger: ['blur', 'input'] },
			],
			fixSolution: [
				{ required: true, message: '请输入修复方案', trigger: ['blur', 'input'] },
				{ min: 1, message: '修复方案不能为空', trigger: ['blur', 'input'] },
			],
			status: [
				{ required: true, message: '请选择状态', trigger: ['blur', 'change'] },
			],
			riskAttackVector: [
				{ required: true, message: '请选择攻击方式', trigger: ['blur', 'change'] },
			],
			riskComplexity: [
				{ required: true, message: '请选择攻击复杂度', trigger: ['blur', 'change'] },
			],
			riskPrivileges: [
				{ required: true, message: '请选择所需权限', trigger: ['blur', 'change'] },
			],
			riskUserInteraction: [
				{ required: true, message: '请选择用户交互', trigger: ['blur', 'change'] },
			],
			riskImpact: [
				{ 
					required: true, 
					message: '请至少选择一项影响', 
					trigger: ['blur', 'change'],
					validator: (rule: any, value: any) => {
						const impact = (editFormValue.value as any).riskImpact;
						if (!impact || impact.length === 0) {
							return new Error('请至少选择一项影响');
						}
						return true;
					}
				},
			],
		};
		const isEditFormValid = ref(false);
		const editing = ref(false);
		
		const loading = ref(false);
		const initialLoading = ref(true);
		const filterDataLoading = ref(true);
		const tableData = ref<any[]>([]);
		const total = ref(0);
		const currentUserId = ref<number | null>(null);
		
		//批量选择相关状态
		const selectedItems = ref<Set<string>>(new Set());
		const crossPageSelection = ref<Map<number, Set<string>>>(new Map());
		const isSelectMode = ref(false);
		const confirmDeleteText = ref('');
		
	//判断是否可以编辑某个知识条目
	function canEditItem(item: any): boolean {
		if (!item) {
			return false;
		}
		if (!currentUserId.value) {
			return false;
		}
		if (currentUserId.value === 1) {
			return true;
		}
		const itemCreateBy = item.createBy;
		if (itemCreateBy !== null && itemCreateBy !== undefined) {
			return Number(itemCreateBy) === currentUserId.value;
		}
		return false;
	}
	//获取当前正在编辑的条目（用于权限检查）
	const editingItem = computed(() => {
		if (!editingItemUuid.value) return null;
		return tableData.value.find(item => item.itemUuid === editingItemUuid.value) || detailItem.value;
	});
	//判断是否可以编辑当前正在编辑的条目
	const canEditCurrentItem = computed(() => {
		return canEditItem(editingItem.value);
	});
		const backendFacetStats = ref<any>(null);
		const backendGroupedByClusters = ref<any[]>([]);
		const pagination = reactive({
			page: 1,
			pageSize: 20,
			showSizePicker: true,
			pageSizes: [10, 20, 30, 50],
			itemCount: 0,
			onUpdatePage: (page: number) => {
				const currentPageSelection = new Set<string>();
				tableData.value.forEach(item => {
					if (selectedItems.value.has(item.itemUuid)) {
						currentPageSelection.add(item.itemUuid);
					}
				});
				if (currentPageSelection.size > 0) {
					crossPageSelection.value.set(pagination.page, currentPageSelection);
				}
				pagination.page = page;
				fetchData();
			},
			onUpdatePageSize: (pageSize: number) => {
				const currentPageSelection = new Set<string>();
				tableData.value.forEach(item => {
					if (selectedItems.value.has(item.itemUuid)) {
						currentPageSelection.add(item.itemUuid);
					}
				});
				if (currentPageSelection.size > 0) {
					crossPageSelection.value.set(pagination.page, currentPageSelection);
				}
				pagination.pageSize = pageSize;
				pagination.page = 1;
				fetchData();
			},
		});
		
		const filterState = reactive<KnowledgeItemListQuery>({
			kid: undefined,
			title: undefined,
			vulnerabilityTypes: undefined,
			languages: undefined,
			severities: undefined,
			statuses: undefined,
			tags: undefined,
			orderBy: 'create_time',
			order: 'desc',
		});
		
	const searchKeyword = ref('');
	const previousSearchKeyword = ref('');
	const previousSortState = ref<{ orderBy?: string; order?: string }>({});
	const showFilterDrawer = ref(false);
	const isSearching = ref(false);
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	//分面搜索相关
	const facetSeverities = ref<string[]>([]);
	const facetLanguages = ref<string[]>([]);
	const facetStatuses = ref<string[]>([]);
	const facetVulnerabilityTypes = ref<string[]>([]);
	const facetTags = ref<string[]>([]);
	const facetCvssScoreRange = ref<[number, number]>([0, 10]);
	const facetCvssScoreBands = ref<string[]>(['low', 'medium', 'high', 'critical']);
	const facetCvssMetrics = reactive({
		attackVector: [] as string[],
		attackComplexity: [] as string[],
		privilegesRequired: [] as string[],
		userInteraction: [] as string[],
		scope: [] as string[],
		confidentiality: [] as string[],
		integrity: [] as string[],
		availability: [] as string[],
	});
	const facetDateRange = ref<[number, number] | null>(null);
	const cvssBandStats = computed(() => {
		const stats: Record<string, number> = {};
		if (!tableData.value || tableData.value.length === 0) return stats;
		for (const band of cvssSeverityBands) {
			stats[band.value] = tableData.value.filter(item => {
				if (item.cvssScore === undefined || item.cvssScore === null) return false;
				const score = Number(item.cvssScore);
				return score >= band.range[0] && score <= band.range[1];
			}).length;
		}
		return stats;
	});
	const dateQuickStats = computed(() => {
		const stats: Record<string, number> = {};
		if (!tableData.value || tableData.value.length === 0) return stats;
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		for (const btn of dateQuickButtons) {
			const startTime = btn.days === 0 ? today.getTime() : today.getTime() - (btn.days - 1) * 24 * 60 * 60 * 1000;
			const endTime = now.getTime();
			stats[btn.days] = tableData.value.filter(item => {
				if (!item.createTime) return false;
				const itemTime = new Date(item.createTime).getTime();
				return itemTime >= startTime && itemTime <= endTime;
			}).length;
		}
		return stats;
	});
	const facetGroupCollapsed = reactive({
		severity: false,
		language: false,
		status: false,
		advanced: true,
		vulnerabilityType: false,
		tag: false,
		cvss: false,
		cvssMetrics: true,
		date: false,
	});
	const autoCollapsedGroups = reactive({
		vulnerabilityType: false,
		tag: false,
	});
	const hasNoFilteredResults = computed(() => {
		return tableData.value && tableData.value.length === 0 && !loading.value;
	});
	watch(hasNoFilteredResults, (noResults) => {
		if (noResults) {
			facetGroupCollapsed.vulnerabilityType = true;
			facetGroupCollapsed.tag = true;
			autoCollapsedGroups.vulnerabilityType = true;
			autoCollapsedGroups.tag = true;
		} else {
			if (autoCollapsedGroups.vulnerabilityType) {
				facetGroupCollapsed.vulnerabilityType = false;
				autoCollapsedGroups.vulnerabilityType = false;
			}
			if (autoCollapsedGroups.tag) {
				facetGroupCollapsed.tag = false;
				autoCollapsedGroups.tag = false;
			}
		}
	});
	const facetSearchKeywords = reactive({
		vulnerabilityType: '',
		tag: '',
	});
	const facetShowAll = reactive({
		vulnerabilityType: false,
		systemTag: false,
		userTag: false,
	});
	const expandedVulnClusters = ref<string[]>([]);
		
		//字典数据
		const vulnerabilityTypeOptions = ref<any[]>([]);
		const languageOptions = ref<any[]>([]);
		const severityOptions = ref<any[]>([]);
		const statusOptions = ref<any[]>([]);
		const knowledgeBaseName = ref<string>("");
		const knowledgeBaseOptions = ref<any[]>([]);
		const systemTags = ref<Array<{ name: string; type: 'system'; description?: string; category?: string }>>([]);
		const userTags = ref<Array<{ name: string; type: 'user'; description?: string; category?: string }>>([]);
		
		//排序选项
		const sortOptions = computed(() => {
			const options = [
				{ label: '按创建时间排序', value: 'create_time' },
				{ label: '按更新时间排序', value: 'update_time' },
				{ label: '按风险分数排序', value: 'cvss_score' },
				{ label: '按标题排序', value: 'title' },
			];
			if (searchKeyword.value.trim()) {
				options.unshift({ label: '按相关度排序', value: 'relevance' });
			}
			return options;
		});
		
		//获取排序占位符
		function getSortPlaceholder(): string {
			const currentOption = sortOptions.value.find(opt => opt.value === filterState.orderBy);
			return currentOption ? currentOption.label : '按创建时间排序';
		}
		
		
	//从字典选项中获取标签
	function getDictLabel(options: any[], value?: string): string {
		if (!value) return '';
		const option = options.find((opt: any) => opt.value === value);
		return option ? option.label : value;
	}
	//友好的时间显示
	function formatTimeAgo(timestamp?: number): string {
		if (!timestamp) return '-';
		try {
			const date = new Date(timestamp);
			const now = new Date();
			const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
			if (diffInSeconds < 60) return '刚刚';
			if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
			if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
			if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`;
			return format(date, 'yyyy-MM-dd HH:mm');
		} catch (e) {
			return '-';
		}
	}
	
	//风险等级颜色映射（基于CVSS标准）
	const severityColorMap: Record<string, string> = {
		'none': '#808080',
		'low': '#52c41a',
		'medium': '#faad14',
		'high': '#ff4d4f',
		'critical': '#cf1322'
	};
	
	//从字典选项中获取颜色（从listClass或cssClass字段解析，如果没有则使用颜色映射）
	function getDictColor(options: any[], value?: string, defaultColor: string = '#808080'): string {
		if (!value) return defaultColor;
		const option = options.find((opt: any) => opt.value === value);
		if (!option) {
			//如果没有找到选项，尝试使用颜色映射
			return severityColorMap[value] || defaultColor;
		}
		if (option.listClass) {
			const colorMatch = option.listClass.match(/#[0-9A-Fa-f]{6}/);
			if (colorMatch) return colorMatch[0];
		}
		if (option.cssClass) {
			const colorMatch = option.cssClass.match(/#[0-9A-Fa-f]{6}/);
			if (colorMatch) return colorMatch[0];
		}
		//如果字典中没有颜色，使用颜色映射
		return severityColorMap[value] || defaultColor;
	}

	//加载CWE漏洞类型数据（用于显示）
	async function loadCweReferenceData() {
		try {
			const response: any = await getCweReferenceListAll();
			if (response.code === 200 && Array.isArray(response.data)) {
				vulnerabilityTypeOptions.value = response.data.map((item: CweReference) => ({
					label: `${item.cweId}${item.nameZh ? ': ' + item.nameZh : ''}`,
					value: item.cweId,
					cweId: item.cweId,
					nameZh: item.nameZh,
					nameEn: item.nameEn,
					weaknessAbstraction: item.weaknessAbstraction,
					descriptionZh: item.descriptionZh,
					status: item.status,
				}));
			} else {
				vulnerabilityTypeOptions.value = [];
			}
		} catch (error) {
			console.error("加载CWE漏洞类型数据失败:", error);
			vulnerabilityTypeOptions.value = [];
		}
	}
	
	const groupedByClusters = computed(() => {
		return backendGroupedByClusters.value || [];
	});

	//获取CWE显示名称
	// 高亮代码（用于详情显示）
	function highlightCode(code: string): string {
			if (!code) return '';
			try {
				const result = hljs.highlightAuto(code);
				return result.value;
			} catch (error) {
				// 如果高亮失败，返回转义的HTML
				const div = document.createElement('div');
				div.textContent = code;
				return div.innerHTML;
			}
		}
		
		function getCweDisplayName(cweId: string): string {
			const option = vulnerabilityTypeOptions.value.find((opt: any) => opt.value === cweId);
			return option ? option.label : cweId;
		}
	
	function extractKeywords(query: string): string[] {
		if (!query || !query.trim()) return [];
		return query.trim().split(/\s+/).filter(w => w.length > 0);
	}
	
	function highlightText(text: string, keywords: string[]): string {
		if (!text || !keywords || keywords.length === 0) {
			return text;
		}
		const lowerText = text.toLowerCase();
		let result = '';
		let lastIndex = 0;
		const matches: Array<{ start: number; end: number; keyword: string }> = [];
		for (const keyword of keywords) {
			const lowerKeyword = keyword.toLowerCase().trim();
			if (!lowerKeyword) continue;
			let searchIndex = 0;
			while (true) {
				const index = lowerText.indexOf(lowerKeyword, searchIndex);
				if (index === -1) break;
				const overlap = matches.some(m => 
					(index >= m.start && index < m.end) || 
					(index + lowerKeyword.length > m.start && index + lowerKeyword.length <= m.end) ||
					(index <= m.start && index + lowerKeyword.length >= m.end)
				);
				if (!overlap) {
					matches.push({ 
						start: index, 
						end: index + lowerKeyword.length, 
						keyword: lowerKeyword 
					});
				}
				searchIndex = index + 1;
			}
		}
		matches.sort((a, b) => a.start - b.start);
		for (const match of matches) {
			if (lastIndex < match.start) {
				result += escapeHtml(text.substring(lastIndex, match.start));
			}
			result += `<mark style="background-color: #fff4ce; color: #000; padding: 0 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(text.substring(match.start, match.end))}</mark>`;
			lastIndex = match.end;
		}
		if (lastIndex < text.length) {
			result += escapeHtml(text.substring(lastIndex));
		}
		return result;
	}
	
	function escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
	
	function extractSnippet(text: string, keywords: string[], maxLength: number = 150): string {
		if (!text) return '';
		if (!keywords || keywords.length === 0) {
			return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
		}
		const lowerText = text.toLowerCase();
		let earliestIndex = -1;
		for (const keyword of keywords) {
			const lowerKeyword = keyword.toLowerCase().trim();
			const index = lowerText.indexOf(lowerKeyword);
			if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
				earliestIndex = index;
			}
		}
		if (earliestIndex === -1) {
			return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
		}
		let start = Math.max(0, earliestIndex - Math.floor(maxLength * 0.3));
		const end = Math.min(text.length, start + maxLength);
		start = Math.max(0, end - maxLength);
		let snippet = text.substring(start, end);
		if (start > 0) snippet = '...' + snippet;
		if (end < text.length) snippet = snippet + '...';
		return snippet;
	}

		//打开CWE选择器
		function openCweSelector(context: 'create' | 'edit' | 'filter') {
			cweSelectorContext.value = context;
			if (context === 'create') {
				tempSelectedCweIds.value = [...((createFormValue.value as any).vulnerabilityTypes || [])];
			} else if (context === 'edit') {
				tempSelectedCweIds.value = [...((editFormValue.value as any).vulnerabilityTypes || [])];
			} else {
				tempSelectedCweIds.value = [...(filterState.vulnerabilityTypes || [])];
			}
			showCweSelector.value = true;
		}

		//CWE选择器确认
		function handleCweSelectorConfirm(selectedCweIds: string[]) {
			if (cweSelectorContext.value === 'create') {
				(createFormValue.value as any).vulnerabilityTypes = selectedCweIds;
				updateCreateFormValidation();
			} else if (cweSelectorContext.value === 'edit') {
				(editFormValue.value as any).vulnerabilityTypes = selectedCweIds;
				updateEditFormValidation();
			} else {
				filterState.vulnerabilityTypes = selectedCweIds;
			}
			showCweSelector.value = false;
		}

		//CWE选择器取消
		function handleCweSelectorCancel() {
			showCweSelector.value = false;
		}

	//从创建表单移除CWE
	function removeCweFromCreate(cweId: string) {
		const vulnTypes = (createFormValue.value as any).vulnerabilityTypes;
		if (vulnTypes) {
			(createFormValue.value as any).vulnerabilityTypes = vulnTypes.filter((id: string) => id !== cweId);
			updateCreateFormValidation();
		}
	}
	//从编辑表单移除CWE
	function removeCweFromEdit(cweId: string) {
		const vulnTypes = (editFormValue.value as any).vulnerabilityTypes;
		if (vulnTypes) {
			(editFormValue.value as any).vulnerabilityTypes = vulnTypes.filter((id: string) => id !== cweId);
			checkEditFormValidation();
		}
	}

		//从筛选移除CWE
		function removeCweFromFilter(cweId: string) {
			if (filterState.vulnerabilityTypes) {
				filterState.vulnerabilityTypes = filterState.vulnerabilityTypes.filter(id => id !== cweId);
			}
		}

		// 处理折叠面板展开事件
		//加载字典数据
		async function loadDictData() {
			try {
				const [languagesRes, severitiesRes, statusesRes] = await Promise.all([
					getDictDataByType("knowledge_language"),
					getDictDataByType("knowledge_severity"),
					getDictDataByType("knowledge_item_status"),
				]);
				languageOptions.value = ((languagesRes as any)?.data || []).map((opt: any) => ({
					label: opt.dictLabel || opt.label || '',
					value: opt.dictValue || opt.value || '',
				}));
				severityOptions.value = ((severitiesRes as any)?.data || []).map((opt: any) => ({
					label: opt.dictLabel || opt.label || '',
					value: opt.dictValue || opt.value || '',
					listClass: opt.listClass || '',
					cssClass: opt.cssClass || '',
				}));
				statusOptions.value = ((statusesRes as any)?.data || []).map((opt: any) => ({
					label: opt.dictLabel || opt.label || '',
					value: opt.dictValue || opt.value || '',
				}));
				if (severityOptions.value.length > 0 && (!facetSeverities.value || facetSeverities.value.length === 0)) {
					facetSeverities.value = severityOptions.value.map(opt => opt.value);
				}
				if (languageOptions.value.length > 0 && (!facetLanguages.value || facetLanguages.value.length === 0)) {
					facetLanguages.value = languageOptions.value.map(opt => opt.value);
				}
				if (statusOptions.value.length > 0 && (!facetStatuses.value || facetStatuses.value.length === 0)) {
					facetStatuses.value = statusOptions.value.map(opt => opt.value);
				}
			} catch (error) {
				console.error("加载字典数据失败:", error);
			}
		}
		
		//加载标签数据（区分系统标签和用户标签）
		async function loadTagData() {
			try {
				const response: any = await getKnowledgeTagList({ pageSize: 1000 });
				if (response.code === 200 && response.rows) {
					const allTags = response.rows.map((tag: any) => ({
						name: tag.tagName || '',
						type: (tag.tagType || 'user') as 'system' | 'user',
						description: tag.description || '',
						category: tag.tagCategory || '',
					}));
					systemTags.value = allTags.filter((tag: { type: string }) => tag.type === 'system');
					userTags.value = allTags.filter((tag: { type: string }) => tag.type === 'user');
					facetTags.value = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)];
				}
			} catch (error) {
				console.error("加载标签数据失败:", error);
			}
		}
		
		//处理标签创建
		async function handleTagCreate(tagName: string, description?: string) {
			const trimmedName = tagName.trim();
			if (!trimmedName) return;
			
			//检查是否已存在
			if (systemTags.value.some(t => t.name === trimmedName) || userTags.value.some(t => t.name === trimmedName)) {
				return;
			}
			
			try {
				const response: any = await createKnowledgeTag({
					tagName: trimmedName,
					tagType: 'user',
					description: description?.trim() || undefined,
				});
				if (response.code === 200) {
					//添加到用户标签列表
					userTags.value.push({
						name: trimmedName,
						type: 'user',
						description: description?.trim() || undefined,
					});
					message.success(`标签"${trimmedName}"创建成功`);
				} else {
					message.error(response.msg || "创建标签失败");
				}
			} catch (error: any) {
				console.error("创建标签失败:", error);
				message.error("创建标签失败");
			}
		}
		
		//将 string[] 转换为 Tag[]（用于 TagPicker 组件）
		const selectedTagsForEdit = ref<Array<{ name: string }>>([]);
	const selectedTagsForPicker = computed(() => {
			const tagNames = createFormValue.value.tags || [];
			return tagNames.map(name => {
				//先查找系统标签
				const systemTag = systemTags.value.find(t => t.name === name);
				if (systemTag) {
					return systemTag;
				}
				//再查找用户标签
				const userTag = userTags.value.find(t => t.name === name);
				if (userTag) {
					return userTag;
				}
				//如果都不存在，创建一个临时的用户标签对象
				return { name, type: 'user' as const };
			});
		});
		
	//处理标签变化（将 Tag[] 转换为 string[]）
	function handleTagsChange(tags: Array<{ name: string; type: 'system' | 'user' }>) {
		createFormValue.value.tags = tags.map(t => t.name);
		updateCreateFormValidation();
	}
	//处理编辑表单标签变化
	function handleEditTagsChange(tags: Array<{ name: string; type: 'system' | 'user' }>) {
		editFormValue.value.tags = tags.map(t => t.name);
		selectedTagsForEdit.value = tags;
		checkEditFormValidation();
	}
		
		//获取数据
		async function fetchData() {
			loading.value = true;
			try {
				const keyword = searchKeyword.value.trim();
				const params: KnowledgeItemListQuery = {
					...filterState,
					searchKeyword: keyword || undefined,
					vulnerabilityTypeKeyword: facetSearchKeywords.vulnerabilityType || undefined,
					pageNum: pagination.page,
					pageSize: pagination.pageSize,
					orderBy: filterState.orderBy === 'relevance' ? 'create_time' : filterState.orderBy,
					order: filterState.order,
					severities: getActiveSeverityFilters(),
					languages: getActiveLanguageFilters(),
					statuses: getActiveStatusFilters(),
					vulnerabilityTypes: getActiveVulnerabilityTypeFilters(),
					tags: getActiveTagFilters(),
			};
			const response: any = await getKnowledgeItemList(params);
				if (response.code === 200) {
					tableData.value = response.rows || [];
					total.value = response.total || 0;
					pagination.itemCount = response.total || 0;
					backendFacetStats.value = response.facetStats || null;
					backendGroupedByClusters.value = response.groupedByClusters || [];
					nextTick(() => {
						const availableTypes = Object.keys(facetStats.value?.vulnerabilityTypes || {});
						if (availableTypes.length > 0 && (!facetVulnerabilityTypes.value || facetVulnerabilityTypes.value.length === 0)) {
							facetVulnerabilityTypes.value = availableTypes;
						}
					});
				} else {
					console.error("========== [前端] 知识条目管理页 - 请求失败 ==========");
					console.error("错误信息:", response.msg);
					message.error(response.msg || "获取知识条目列表失败");
				}
			} catch (error: any) {
				console.error("========== [前端] 知识条目管理页 - 请求异常 ==========");
				console.error("异常信息:", error);
				message.error(error?.message || "获取知识条目列表失败");
				} finally {
					loading.value = false;
				}
			}
			
			nextTick(() => {
				restoreSelection();
			});
		
	//检测移动端
	function checkMobile() {
		isMobile.value = window.innerWidth < 768;
	}
	//响应式处理
	function handleResize() {
		checkMobile();
		if (isMobile.value && showDetailInMobile.value) {
			//移动端显示详情时，隐藏列表
		} else if (!isMobile.value) {
			//桌面端恢复
			showDetailInMobile.value = false;
		}
	}
	//解析CVSS向量字符串
	function parseCvssVector(cvssVector?: string): {
		version?: string;
		av?: string;
		ac?: string;
		at?: string;
		pr?: string;
		ui?: string;
		vc?: string;
		vi?: string;
		va?: string;
		sc?: string;
		si?: string;
		sa?: string;
	} | null {
		if (!cvssVector) return null;
		const result: any = {};
		const parts = cvssVector.split('/');
		parts.forEach(part => {
			if (part.startsWith('CVSS:')) {
				result.version = part.replace('CVSS:', '');
			} else {
				const [key, value] = part.split(':');
				if (key && value) {
					result[key.toLowerCase()] = value;
				}
			}
		});
		return result;
	}
	
	//计算CVSS评分（支持区间）
	function calculateCvssScoreFromItem(item: any): { exact: number | null, min: number | null, max: number | null, isComplete: boolean } | null {
		const parsed = parseCvssVector(item.cvssVector);
		if (!parsed) {
			if (item.cvssScore !== null && item.cvssScore !== undefined) {
				const score = typeof item.cvssScore === 'number' ? item.cvssScore : parseFloat(item.cvssScore);
				return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true };
			}
			return null;
		}
		
		const av = parsed.av;
		const ac = parsed.ac;
		const pr = parsed.pr;
		const ui = parsed.ui;
		const vc = parsed.vc;
		const vi = parsed.vi;
		const va = parsed.va;
		
		const avScores: Record<string, number> = { 'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2 };
		const acScores: Record<string, number> = { 'L': 0.77, 'H': 0.44 };
		const prScores: Record<string, number> = { 'N': 0.85, 'L': 0.62, 'H': 0.27 };
		const uiScores: Record<string, number> = { 'N': 0.85, 'R': 0.62 };
		const impactScores: Record<string, number> = { 'H': 0.22, 'L': 0.11, 'N': 0 };
		
		const isComplete = av && ac && pr && ui && (vc || vi || va);
		
		if (!isComplete && !av && !ac && !pr && !ui) {
			if (item.cvssScore !== null && item.cvssScore !== undefined) {
				const score = typeof item.cvssScore === 'number' ? item.cvssScore : parseFloat(item.cvssScore);
				return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true };
			}
			return null;
		}
		
		let baseScore = 0;
		if (av) baseScore += avScores[av] || 0;
		if (ac) baseScore += acScores[ac] || 0;
		if (pr) baseScore += prScores[pr] || 0;
		if (ui) baseScore += uiScores[ui] || 0;
		
		let maxImpact = 0;
		if (vc) maxImpact = Math.max(maxImpact, impactScores[vc] || 0);
		if (vi) maxImpact = Math.max(maxImpact, impactScores[vi] || 0);
		if (va) maxImpact = Math.max(maxImpact, impactScores[va] || 0);
		baseScore += maxImpact * 3;
		
		const score = Math.min(10, Math.max(0, baseScore * 1.08));
		
		if (isComplete) {
			return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true };
		} else {
			let maxPossibleScore = score;
			if (!av) maxPossibleScore += avScores['N'] * 1.08;
			if (!ac) maxPossibleScore += acScores['L'] * 1.08;
			if (!pr) maxPossibleScore += prScores['N'] * 1.08;
			if (!ui) maxPossibleScore += uiScores['N'] * 1.08;
			if (!vc && !vi && !va) maxPossibleScore += impactScores['H'] * 3 * 1.08;
			maxPossibleScore = Math.min(10, maxPossibleScore);
			return {
				exact: null,
				min: Math.round(score * 10) / 10,
				max: Math.round(maxPossibleScore * 10) / 10,
				isComplete: false
			};
		}
	}
	
	//获取CVSS评分显示文本
	function getItemCvssScoreDisplay(item: any): string {
		const scoreResult = calculateCvssScoreFromItem(item);
		if (!scoreResult) return '';
		if (scoreResult.exact !== null) {
			return scoreResult.exact.toFixed(1);
		}
		if (scoreResult.min !== null && scoreResult.max !== null) {
			return `${scoreResult.min.toFixed(1)} - ${scoreResult.max.toFixed(1)}`;
		}
		return '';
	}
	
	//获取风险等级（用于显示）
	function getItemSeverityForDisplay(item: any): string {
		const scoreResult = calculateCvssScoreFromItem(item);
		if (!scoreResult) {
			return item.severity || '';
		}
		const scoreValue = scoreResult.exact !== null ? scoreResult.exact : (scoreResult.max !== null ? scoreResult.max : 0);
		if (scoreValue === null || scoreValue === 0) {
			return item.severity || '';
		}
		if (scoreValue >= 9.0) return 'critical';
		if (scoreValue >= 7.0) return 'high';
		if (scoreValue >= 4.0) return 'medium';
		if (scoreValue >= 0.1) return 'low';
		return 'none';
	}
	//获取CVSS组件显示名称
	function getCvssComponentLabel(key: string, value: string): string {
		const labels: Record<string, Record<string, string>> = {
			av: { N: '网络', A: '网络相邻', L: '本地', P: '物理' },
			ac: { L: '低', H: '高' },
			at: { N: '无', P: '存在' },
			pr: { N: '无', L: '低', H: '高' },
			ui: { N: '无', R: '必需', A: '活跃' },
			vc: { H: '高', L: '低', N: '无' },
			vi: { H: '高', L: '低', N: '无' },
			va: { H: '高', L: '低', N: '无' },
			sc: { H: '高', L: '低', N: '无' },
			si: { H: '高', L: '低', N: '无' },
			sa: { H: '高', L: '低', N: '无' },
		};
		return labels[key]?.[value] || value;
	}
	//打开详情面板（支持Master-Detail和移动端模式）
	async function openDetailPanel(row: any) {
		selectedItemUuid.value = row.itemUuid;
		if (isMobile.value) {
			//移动端：全屏显示详情
			showDetailInMobile.value = true;
		} else {
			//桌面端：Master-Detail模式，右侧显示
			detailPanelCollapsed.value = false;
		}
		detailItem.value = null;
		detailLoading.value = true;
		try {
			const response: any = await getKnowledgeItemDetail(row.itemUuid);
			if (response.code === 200) {
				detailItem.value = response.data;
			} else {
				message.error(response.msg || "获取详情失败");
			}
		} catch (error: any) {
			console.error("获取详情失败", error);
			message.error(error?.message || "获取详情失败");
		} finally {
			detailLoading.value = false;
		}
	}
		
	//关闭详情面板
	function closeDetailPanel() {
		if (isMobile.value) {
			showDetailInMobile.value = false;
		}
		selectedItemUuid.value = null;
		detailItem.value = null;
	}
	//复制代码
	async function handleCopyCode(code: string) {
		try {
			await navigator.clipboard.writeText(code || '');
			message.success('复制成功');
		} catch (e) {
			message.error('复制失败');
		}
	}
	//键盘导航
	function handleKeydown(event: KeyboardEvent) {
		if (isMobile.value) return;
		if (event.target && (event.target as HTMLElement).tagName === 'INPUT') return;
		if (event.target && (event.target as HTMLElement).tagName === 'TEXTAREA') return;
		if (selectedItemUuid.value && event.key === 'ArrowDown') {
			event.preventDefault();
			const currentIndex = tableData.value.findIndex(item => item.itemUuid === selectedItemUuid.value);
			if (currentIndex < tableData.value.length - 1) {
				openDetailPanel(tableData.value[currentIndex + 1]);
			}
		} else if (selectedItemUuid.value && event.key === 'ArrowUp') {
			event.preventDefault();
			const currentIndex = tableData.value.findIndex(item => item.itemUuid === selectedItemUuid.value);
			if (currentIndex > 0) {
				openDetailPanel(tableData.value[currentIndex - 1]);
			}
		} else if (event.key === 'Escape' && (selectedItemUuid.value || showDetailInMobile.value)) {
			event.preventDefault();
			closeDetailPanel();
		} else if (selectedItemUuid.value && event.key === 'Enter' && detailPanelCollapsed.value) {
			event.preventDefault();
			detailPanelCollapsed.value = false;
		}
	}
		
	async function handleEdit(row: any) {
		try {
			editingItemUuid.value = row.itemUuid;
			isEditInit.value = true;
			const response = await getKnowledgeItemDetail(row.itemUuid);
			if (response.code === 200 && response.data) {
				const item = response.data;
				const cvssParsed = item.cvssVector ? parseCvssVector(item.cvssVector) : null;
				const impactArray: string[] = [];
				if (cvssParsed) {
					if (cvssParsed.vc === 'H') impactArray.push('C');
					if (cvssParsed.vi === 'H') impactArray.push('I');
					if (cvssParsed.va === 'H') impactArray.push('A');
				}
				editFormValue.value = {
					kid: item.kid,
					title: item.title || '',
					summary: item.summary || '',
					problemDescription: item.problemDescription || '',
					fixSolution: item.fixSolution || '',
					exampleCode: item.exampleCode || '',
					vulnerabilityType: item.vulnerabilityType,
					vulnerabilityTypes: item.vulnerabilityTypes || [],
					language: item.language,
					severity: item.severity,
					cvssVector: item.cvssVector,
					cvssScore: item.cvssScore,
					status: item.status || 'draft',
					sourceType: item.sourceType || 'manual',
					tags: item.tags || [],
					riskAttackVector: cvssParsed?.av || undefined,
					riskComplexity: cvssParsed?.ac || undefined,
					riskPrivileges: cvssParsed?.pr || undefined,
					riskUserInteraction: cvssParsed?.ui || undefined,
					riskImpact: impactArray.length > 0 ? impactArray : undefined,
				};
				selectedTagsForEdit.value = (item.tags || []).map((tagName: string) => ({ name: tagName }));
				originalEditFormValue.value = JSON.parse(JSON.stringify(editFormValue.value));
				isEditFormValid.value = false;
				showEditModal.value = true;
				nextTick(() => {
					editFormRef.value?.restoreValidation();
					setTimeout(() => {
						isEditInit.value = false;
					}, 50);
				});
			} else {
				message.error("加载知识条目详情失败");
			}
		} catch (error: any) {
			message.error(error?.message || "加载知识条目详情失败");
		}
	}
		
	const showFragmentListModal = ref(false);
	const currentItemForFragments = ref<any>(null);

	function handleViewFragments(item: any) {
		if (!item?.itemUuid) return;
		currentItemForFragments.value = item;
		showFragmentListModal.value = true;
	}

		async function handleDelete(row: any) {
			dialog.warning({
				title: "确认删除",
				content: `确定要删除知识条目"${row.title}"吗？删除后无法恢复。`,
				positiveText: "确定",
				negativeText: "取消",
				onPositiveClick: async () => {
					try {
						const response: any = await deleteKnowledgeItem(row.itemUuid);
						if (response.code === 200) {
							message.success("删除成功");
							if (selectedItemUuid.value === row.itemUuid) {
								closeDetailPanel();
							}
							selectedItems.value.delete(row.itemUuid);
							updateGlobalSelection();
							fetchData();
						} else {
							message.error(response.msg || "删除失败");
						}
					} catch (error: any) {
						const errorMsg = error?.responseData?.msg || 
										error?.message || 
										error?.msg || 
										error?.response?.data?.msg || 
										"删除失败";
						message.error(errorMsg);
					}
				},
			});
		}
		
		//批量选择相关函数
		function getFilterHash(): string {
			const activeSeverities = getActiveSeverityFilters();
			const activeLanguages = getActiveLanguageFilters();
			const activeStatuses = getActiveStatusFilters();
			const activeVulnerabilityTypes = getActiveVulnerabilityTypeFilters();
			const activeTags = getActiveTagFilters();
			const activeCvssRange = getActiveCvssScoreRange();
			const activeCvssMetrics = getActiveCvssMetrics();
			const activeDateRange = getActiveDateRange();
			const filterStr = JSON.stringify({
				kid: filterState.kid,
				vulnerabilityTypes: activeVulnerabilityTypes,
				languages: activeLanguages,
				severities: activeSeverities,
				statuses: activeStatuses,
				tags: activeTags,
				searchKeyword: searchKeyword.value.trim() || undefined,
				cvssScoreMin: activeCvssRange ? activeCvssRange[0] : undefined,
				cvssScoreMax: activeCvssRange ? activeCvssRange[1] : undefined,
				cvssAttackVector: activeCvssMetrics?.attackVector,
				cvssAttackComplexity: activeCvssMetrics?.attackComplexity,
				cvssPrivilegesRequired: activeCvssMetrics?.privilegesRequired,
				cvssUserInteraction: activeCvssMetrics?.userInteraction,
				cvssScope: activeCvssMetrics?.scope,
				cvssConfidentiality: activeCvssMetrics?.confidentiality,
				cvssIntegrity: activeCvssMetrics?.integrity,
				cvssAvailability: activeCvssMetrics?.availability,
				createTimeStart: activeDateRange ? new Date(activeDateRange[0]).toISOString() : undefined,
				createTimeEnd: activeDateRange ? new Date(activeDateRange[1]).toISOString() : undefined,
				orderBy: filterState.orderBy,
				order: filterState.order,
			});
			return btoa(filterStr).substring(0, 32);
		}
		
		function toggleItemSelection(itemUuid: string, checked: boolean) {
			if (checked) {
				selectedItems.value.add(itemUuid);
			} else {
				selectedItems.value.delete(itemUuid);
			}
			const currentPageSelection = new Set<string>();
			tableData.value.forEach(item => {
				if (selectedItems.value.has(item.itemUuid)) {
					currentPageSelection.add(item.itemUuid);
				}
			});
			crossPageSelection.value.set(pagination.page, currentPageSelection);
			persistSelection();
		}
		
		function toggleSelectAll(checked: boolean) {
			if (checked) {
				tableData.value.forEach(item => {
					selectedItems.value.add(item.itemUuid);
				});
			} else {
				tableData.value.forEach(item => {
					selectedItems.value.delete(item.itemUuid);
				});
			}
			const currentPageSelection = new Set<string>();
			if (checked) {
				tableData.value.forEach(item => {
					currentPageSelection.add(item.itemUuid);
				});
			}
			crossPageSelection.value.set(pagination.page, currentPageSelection);
			persistSelection();
		}
		
		function handleSelectCurrentPage() {
			tableData.value.forEach(item => {
				selectedItems.value.add(item.itemUuid);
			});
			const currentPageSelection = new Set<string>();
			tableData.value.forEach(item => {
				currentPageSelection.add(item.itemUuid);
			});
			crossPageSelection.value.set(pagination.page, currentPageSelection);
			persistSelection();
		}
		
		function handleDeselectCurrentPage() {
			tableData.value.forEach(item => {
				selectedItems.value.delete(item.itemUuid);
			});
			crossPageSelection.value.delete(pagination.page);
			persistSelection();
		}
		
		const bulkSelectionOptions = computed(() => {
			const options: any[] = [];
			const currentPageSelectedCount = tableData.value.filter(item => selectedItems.value.has(item.itemUuid)).length;
			const isCurrentPageAllSelected = tableData.value.length > 0 && currentPageSelectedCount === tableData.value.length;
			
			if (!isCurrentPageAllSelected) {
				options.push({
					label: `选择当前页（${tableData.value.length} 条）`,
					key: 'select-page',
					icon: () => h(SvgIcon, { icon: 'ri:checkbox-multiple-line' })
				});
			} else {
				options.push({
					label: `取消选择当前页`,
					key: 'deselect-page',
					icon: () => h(SvgIcon, { icon: 'ri:checkbox-blank-line' })
				});
			}
			
			if (!isAllFilteredItemsSelected.value && pagination.itemCount > 0) {
				options.push({
					label: `选择全部（${pagination.itemCount} 条）`,
					key: 'select-all',
					icon: () => h(SvgIcon, { icon: 'ri:checkbox-multiple-fill' })
				});
			}
			
			if (selectedItems.value.size > 0) {
				options.push({
					label: '清空选择',
					key: 'clear',
					icon: () => h(SvgIcon, { icon: 'ri:close-line' })
				});
			}
			
			return options;
		});
		
		function handleBulkSelectionSelect(key: string) {
			if (key === 'select-page') {
				handleSelectCurrentPage();
			} else if (key === 'deselect-page') {
				handleDeselectCurrentPage();
			} else if (key === 'select-all') {
				handleSelectAll();
			} else if (key === 'clear') {
				clearSelection();
			}
		}
		
		const isAllSelected = computed(() => {
			if (tableData.value.length === 0) return false;
			return tableData.value.every(item => selectedItems.value.has(item.itemUuid));
		});
		
		const isIndeterminate = computed(() => {
			const selectedCount = tableData.value.filter(item => selectedItems.value.has(item.itemUuid)).length;
			return selectedCount > 0 && selectedCount < tableData.value.length;
		});
		
		function updateGlobalSelection() {
			selectedItems.value.clear();
			crossPageSelection.value.forEach((pageSelection) => {
				pageSelection.forEach((itemUuid) => {
					selectedItems.value.add(itemUuid);
				});
			});
		}
		
		function persistSelection() {
			const storageKey = `knowledge_item_selection_${filterState.kid || 'all'}_${getFilterHash()}`;
			const selectionData = {
				selectedItems: Array.from(selectedItems.value),
				crossPageSelection: Object.fromEntries(
					Array.from(crossPageSelection.value.entries()).map(([page, set]: [number, Set<string>]) => [
						page,
						Array.from(set)
					] as [number, string[]])
				),
				timestamp: Date.now()
			};
			try {
				sessionStorage.setItem(storageKey, JSON.stringify(selectionData));
			} catch (e) {
				console.warn('保存选择状态失败', e);
			}
		}
		
		function restoreSelection() {
			const storageKey = `knowledge_item_selection_${filterState.kid || 'all'}_${getFilterHash()}`;
			try {
				const stored = sessionStorage.getItem(storageKey);
				if (stored) {
					const selectionData = JSON.parse(stored);
					if (Date.now() - selectionData.timestamp < 5 * 60 * 1000) {
						const validItemUuids = new Set<string>();
						tableData.value.forEach(item => {
							if (selectionData.selectedItems && selectionData.selectedItems.includes(item.itemUuid)) {
								validItemUuids.add(item.itemUuid);
							}
						});
						
						if (validItemUuids.size > 0) {
							validItemUuids.forEach(uuid => {
								selectedItems.value.add(uuid);
							});
							const currentPageSelection = new Set<string>();
							tableData.value.forEach(item => {
								if (selectedItems.value.has(item.itemUuid)) {
									currentPageSelection.add(item.itemUuid);
								}
							});
							if (currentPageSelection.size > 0) {
								crossPageSelection.value.set(pagination.page, currentPageSelection);
							}
							
							if (selectionData.crossPageSelection) {
								Object.entries(selectionData.crossPageSelection).forEach(([page, items]) => {
									const pageNum = Number(page);
									if (pageNum !== pagination.page) {
										const validPageItems = (items as string[]).filter(uuid => 
											selectionData.selectedItems && selectionData.selectedItems.includes(uuid)
										);
										if (validPageItems.length > 0) {
											crossPageSelection.value.set(pageNum, new Set(validPageItems));
										}
									}
								});
							}
						}
					}
				}
			} catch (e) {
				console.warn('恢复选择状态失败', e);
			}
		}
		
		function clearSelection() {
			selectedItems.value.clear();
			crossPageSelection.value.clear();
			const storageKey = `knowledge_item_selection_${filterState.kid || 'all'}_${getFilterHash()}`;
			try {
				sessionStorage.removeItem(storageKey);
			} catch (e) {
				console.warn('清除选择状态失败', e);
			}
		}
		
		const selectedPageCount = computed(() => {
			return crossPageSelection.value.size;
		});
		
		const isCrossPageSelection = computed(() => {
			return crossPageSelection.value.size > 1;
		});
		
		//判断是否所有符合条件的条目都被选中（包括无筛选时判断是否全选）
		const isAllFilteredItemsSelected = computed(() => {
			return pagination.itemCount > 0 && selectedItems.value.size >= pagination.itemCount;
		});
		
		//选择当前条件下的所有条目（包括无筛选时选择全部）
		async function handleSelectAll() {
			if (pagination.itemCount === 0) {
				message.warning('当前条件下没有条目');
				return;
			}
			
			if (pagination.itemCount > 1000) {
				message.warning(`当前条件下有 ${pagination.itemCount} 条条目，数量较多，建议使用导出功能`);
				return;
			}
			
			const loadingMessage = message.loading('正在获取所有条目...', { duration: 0 });
			try {
				const allItemUuids: string[] = [];
				const pageSize = 100;
				const totalPages = Math.ceil(pagination.itemCount / pageSize);
				
				for (let page = 1; page <= totalPages; page++) {
					const request: KnowledgeItemListQuery = {
						...filterState,
						searchKeyword: searchKeyword.value.trim() || undefined,
						pageNum: page,
						pageSize: pageSize,
						orderBy: filterState.orderBy || 'create_time',
						order: filterState.order || 'desc'
					};
					
					const response: any = await getKnowledgeItemList(request);
					if (response.code === 200 && response.rows) {
						response.rows.forEach((item: any) => {
							if (item.itemUuid) {
								allItemUuids.push(item.itemUuid);
							}
						});
					}
				}
				
				allItemUuids.forEach(uuid => {
					selectedItems.value.add(uuid);
				});
				
				crossPageSelection.value.clear();
				for (let page = 1; page <= totalPages; page++) {
					const startIdx = (page - 1) * pageSize;
					const endIdx = Math.min(startIdx + pageSize, allItemUuids.length);
					const pageUuids = allItemUuids.slice(startIdx, endIdx);
					crossPageSelection.value.set(page, new Set(pageUuids));
				}
				
				persistSelection();
				loadingMessage.destroy();
				message.success(`已全选 ${allItemUuids.length} 条条目`);
			} catch (error: any) {
				loadingMessage.destroy();
				message.error('全选失败: ' + (error.message || '未知错误'));
			}
		}
		
		//反选当前条件下的所有条目（包括无筛选时反选全部）
		async function handleInvertSelection() {
			if (pagination.itemCount === 0) {
				message.warning('当前条件下没有条目');
				return;
			}
			
			if (pagination.itemCount > 1000) {
				message.warning(`当前条件下有 ${pagination.itemCount} 条条目，数量较多，建议使用导出功能`);
				return;
			}
			
			const loadingMessage = message.loading('正在获取所有条目...', { duration: 0 });
			try {
				const allItemUuids: string[] = [];
				const pageSize = 100;
				const totalPages = Math.ceil(pagination.itemCount / pageSize);
				
				for (let page = 1; page <= totalPages; page++) {
					const request: KnowledgeItemListQuery = {
						...filterState,
						searchKeyword: searchKeyword.value.trim() || undefined,
						pageNum: page,
						pageSize: pageSize,
						orderBy: filterState.orderBy || 'create_time',
						order: filterState.order || 'desc'
					};
					
					const response: any = await getKnowledgeItemList(request);
					if (response.code === 200 && response.rows) {
						response.rows.forEach((item: any) => {
							if (item.itemUuid) {
								allItemUuids.push(item.itemUuid);
							}
						});
					}
				}
				
				const currentSelected = new Set(selectedItems.value);
				selectedItems.value.clear();
				crossPageSelection.value.clear();
				
				const invertedUuids: string[] = [];
				allItemUuids.forEach(uuid => {
					if (!currentSelected.has(uuid)) {
						selectedItems.value.add(uuid);
						invertedUuids.push(uuid);
					}
				});
				
				for (let page = 1; page <= totalPages; page++) {
					const startIdx = (page - 1) * pageSize;
					const endIdx = Math.min(startIdx + pageSize, invertedUuids.length);
					const pageUuids = invertedUuids.slice(startIdx, endIdx);
					if (pageUuids.length > 0) {
						crossPageSelection.value.set(page, new Set(pageUuids));
					}
				}
				
				persistSelection();
				loadingMessage.destroy();
				message.success(`已反选，当前选中 ${selectedItems.value.size} 条条目`);
			} catch (error: any) {
				loadingMessage.destroy();
				message.error('反选失败: ' + (error.message || '未知错误'));
			}
		}
		
		const batchEditOptions = computed(() => {
			const options: any[] = [];
			if (languageOptions.value.length > 0) {
				options.push({
					label: '批量修改语言',
					key: 'language',
					children: languageOptions.value.map(opt => ({
						label: opt.label,
						key: `language:${opt.value}`,
						value: opt.value
					}))
				});
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
				});
			}
			if (statusOptions.value.length > 0) {
				options.push({
					label: '批量修改状态',
					key: 'status',
					children: statusOptions.value.map(opt => ({
						label: opt.label,
						key: `status:${opt.value}`,
						value: opt.value
					}))
				});
			}
			options.push({
				label: '批量编辑标签',
				key: 'tags',
				disabled: false
			});
			options.push({
				label: '批量修改攻击方式',
				key: 'riskAttackVector',
				children: riskAttackVectorOptions.map(opt => ({
					label: opt.label,
					key: `riskAttackVector:${opt.value}`,
					value: opt.value
				}))
			});
			options.push({
				label: '批量修改利用复杂度',
				key: 'riskComplexity',
				children: riskComplexityOptions.map(opt => ({
					label: opt.label,
					key: `riskComplexity:${opt.value}`,
					value: opt.value
				}))
			});
			options.push({
				label: '批量修改权限需求',
				key: 'riskPrivileges',
				children: riskPrivilegesOptions.map(opt => ({
					label: opt.label,
					key: `riskPrivileges:${opt.value}`,
					value: opt.value
				}))
			});
			options.push({
				label: '批量修改用户交互',
				key: 'riskUserInteraction',
				children: riskUserInteractionOptions.map(opt => ({
					label: opt.label,
					key: `riskUserInteraction:${opt.value}`,
					value: opt.value
				}))
			});
			return options;
		});
		
		const showBatchEditTagsModal = ref(false);
		const batchEditTagsSearchKeyword = ref('');
		const batchEditTagsSelectedTagTypes = ref<string[]>(['system', 'user']);
		const batchEditTagsSortBy = ref<string>('name');
		const batchEditTagsSelectedTags = ref<Set<string>>(new Set());
		const batchEditTagsItemTagMap = ref<Map<string, string[]>>(new Map());
		const batchEditTagsLoading = ref(false);
		const batchEditTagsMaxDisplay = 50;
		const batchEditTagsShowAllSystem = ref(false);
		const batchEditTagsShowAllUser = ref(false);
		
		async function handleBatchEditSelect(key: string) {
			if (key === 'tags') {
				handleBatchEditTags();
				return;
			}
			
			const [field, value] = key.split(':');
			if (!field || value === undefined) return;
			
			if (selectedItems.value.size === 0) {
				message.warning('请先选择要编辑的条目');
				return;
			}
			
			const itemUuids = Array.from(selectedItems.value);
			if (itemUuids.length > 1000) {
				message.error('单次最多更新1000条');
				return;
			}
			
			let fieldLabel = '';
			let valueLabel = '';
			if (field === 'language') {
				fieldLabel = '语言';
				valueLabel = languageOptions.value.find(opt => opt.value === value)?.label || value;
			} else if (field === 'severity') {
				fieldLabel = '风险等级';
				valueLabel = severityOptions.value.find(opt => opt.value === value)?.label || value;
			} else if (field === 'status') {
				fieldLabel = '状态';
				valueLabel = statusOptions.value.find(opt => opt.value === value)?.label || value;
			} else if (field === 'riskAttackVector') {
				fieldLabel = '攻击方式';
				valueLabel = riskAttackVectorOptions.find(opt => opt.value === value)?.label || value;
			} else if (field === 'riskComplexity') {
				fieldLabel = '利用复杂度';
				valueLabel = riskComplexityOptions.find(opt => opt.value === value)?.label || value;
			} else if (field === 'riskPrivileges') {
				fieldLabel = '权限需求';
				valueLabel = riskPrivilegesOptions.find(opt => opt.value === value)?.label || value;
			} else if (field === 'riskUserInteraction') {
				fieldLabel = '用户交互';
				valueLabel = riskUserInteractionOptions.find(opt => opt.value === value)?.label || value;
			}
			
			dialog.warning({
				title: '确认批量编辑',
				content: () => h('div', [
					h('p', { style: 'margin-bottom: 12px;' }, `将为 ${itemUuids.length} 条知识条目批量修改 ${fieldLabel}`),
					h('p', { style: 'margin-bottom: 12px;' }, `新值：${valueLabel}`),
				]),
				positiveText: '确认',
				negativeText: '取消',
				onPositiveClick: async () => {
					const loadingMessage = message.loading('正在批量更新...', { duration: 0 });
					try {
						const response = await batchUpdateKnowledgeItems({
							itemUuids,
							field,
							value
						});
						loadingMessage.destroy();
						if (response.code === 200 && response.data) {
							const result = response.data;
							if (result.failedCount === 0) {
								message.success(`成功更新 ${result.successCount} 条记录`);
							} else {
								message.warning(`成功更新 ${result.successCount} 条，失败 ${result.failedCount} 条`);
								if (result.failures && result.failures.length > 0) {
									const failureReasons = result.failures.map(f => `${f.itemUuid}: ${f.reason}`).join('\n');
									console.error('批量更新失败详情:', failureReasons);
								}
							}
							clearSelection();
							fetchData();
						} else {
							message.error(response.msg || '批量更新失败');
						}
					} catch (error: any) {
						loadingMessage.destroy();
						const errorMsg = error?.responseData?.msg || 
										error?.message || 
										error?.msg || 
										error?.response?.data?.msg || 
										'批量更新失败';
						message.error(errorMsg);
					}
					return true;
				}
			});
		}
		
		async function handleBatchEditTags() {
			if (selectedItems.value.size === 0) {
				message.warning('请先选择要编辑的条目');
				return;
			}
			
			const itemUuids = Array.from(selectedItems.value);
			if (itemUuids.length > 1000) {
				message.error('单次最多更新1000条');
				return;
			}
			
			batchEditTagsLoading.value = true;
			batchEditTagsItemTagMap.value.clear();
			batchEditTagsSelectedTags.value.clear();
			
			try {
				const selectedItemsData = tableData.value.filter(item => itemUuids.includes(item.itemUuid));
				for (const item of selectedItemsData) {
					if (item.tags && item.tags.length > 0) {
						batchEditTagsItemTagMap.value.set(item.itemUuid, item.tags);
					} else {
						batchEditTagsItemTagMap.value.set(item.itemUuid, []);
					}
				}
				
				const allTags = new Set<string>();
				batchEditTagsItemTagMap.value.forEach(tags => {
					tags.forEach(tag => allTags.add(tag));
				});
				
				const totalItems = itemUuids.length;
				for (const tagName of allTags) {
					let count = 0;
					batchEditTagsItemTagMap.value.forEach(tags => {
						if (tags.includes(tagName)) count++;
					});
					if (count === totalItems) {
						batchEditTagsSelectedTags.value.add(tagName);
					}
				}
				
				batchEditTagsSearchKeyword.value = '';
				batchEditTagsSelectedTagTypes.value = ['system', 'user'];
				batchEditTagsSortBy.value = 'name';
				batchEditTagsShowAllSystem.value = false;
				batchEditTagsShowAllUser.value = false;
				showBatchEditTagsModal.value = true;
			} catch (error: any) {
				message.error('加载标签信息失败: ' + (error.message || '未知错误'));
			} finally {
				batchEditTagsLoading.value = false;
			}
		}
		
		const batchEditTagsFilteredSystemTags = computed(() => {
			let tags = systemTags.value.filter(tag => {
				if (!batchEditTagsSelectedTagTypes.value.includes('system')) return false;
				if (batchEditTagsSearchKeyword.value.trim()) {
					const keyword = batchEditTagsSearchKeyword.value.toLowerCase();
					const tagName = (tag.name || '').toLowerCase();
					const tagDesc = (tag.description || '').toLowerCase();
					if (!tagName.includes(keyword) && !tagDesc.includes(keyword)) return false;
				}
				return true;
			});
			return tags;
		});
		
		const batchEditTagsFilteredUserTags = computed(() => {
			let tags = userTags.value.filter(tag => {
				if (!batchEditTagsSelectedTagTypes.value.includes('user')) return false;
				if (batchEditTagsSearchKeyword.value.trim()) {
					const keyword = batchEditTagsSearchKeyword.value.toLowerCase();
					const tagName = (tag.name || '').toLowerCase();
					const tagDesc = (tag.description || '').toLowerCase();
					if (!tagName.includes(keyword) && !tagDesc.includes(keyword)) return false;
				}
				return true;
			});
			return tags;
		});
		
		const batchEditTagsSortedSystemTags = computed(() => {
			const tags = [...batchEditTagsFilteredSystemTags.value];
			if (batchEditTagsSortBy.value === 'name') {
				return tags.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
			}
			return tags;
		});
		
		const batchEditTagsSortedUserTags = computed(() => {
			const tags = [...batchEditTagsFilteredUserTags.value];
			if (batchEditTagsSortBy.value === 'name') {
				return tags.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
			}
			return tags;
		});
		
		function getBatchEditTagState(tagName: string): 'all' | 'some' | 'none' {
			const totalItems = batchEditTagsItemTagMap.value.size;
			if (totalItems === 0) return 'none';
			
			let count = 0;
			batchEditTagsItemTagMap.value.forEach(tags => {
				if (tags.includes(tagName)) count++;
			});
			
			if (count === 0) return 'none';
			if (count === totalItems) return 'all';
			return 'some';
		}
		
		function toggleBatchEditTag(tagName: string) {
			const state = getBatchEditTagState(tagName);
			if (state === 'all') {
				batchEditTagsSelectedTags.value.delete(tagName);
			} else {
				batchEditTagsSelectedTags.value.add(tagName);
			}
		}
		
		async function handleBatchEditTagsConfirm() {
			const itemUuids = Array.from(selectedItems.value);
			const selectedTagNames = Array.from(batchEditTagsSelectedTags.value);
			
			if (selectedTagNames.length === 0 && batchEditTagsSelectedTags.value.size === 0) {
				message.warning('请至少选择一个标签');
				return;
			}
			
			const loadingMessage = message.loading('正在批量更新标签...', { duration: 0 });
			try {
				const response = await batchUpdateKnowledgeItems({
					itemUuids,
					field: 'tags',
					value: selectedTagNames
				});
				loadingMessage.destroy();
				
				if (response.code === 200 && response.data) {
					const result = response.data;
					if (result.failedCount === 0) {
						message.success(`成功更新 ${result.successCount} 条记录的标签`);
					} else {
						message.warning(`成功更新 ${result.successCount} 条，失败 ${result.failedCount} 条`);
					}
					showBatchEditTagsModal.value = false;
					clearSelection();
					fetchData();
				} else {
					message.error(response.msg || '批量更新标签失败');
				}
			} catch (error: any) {
				loadingMessage.destroy();
				const errorMsg = error?.responseData?.msg || 
								error?.message || 
								error?.msg || 
								error?.response?.data?.msg || 
								'批量更新标签失败';
				message.error(errorMsg);
			}
		}
		
		async function handleBatchDelete() {
			if (selectedItems.value.size === 0) {
				message.warning('请先选择要删除的条目');
				return;
			}
			
			const itemUuids = Array.from(selectedItems.value);
			if (itemUuids.length > 1000) {
				message.error('单次最多删除1000条');
				return;
			}
			
			const itemsToDelete = tableData.value.filter(item => itemUuids.includes(item.itemUuid));
			const previewItems = itemsToDelete.slice(0, 5);
			const remainingCount = itemsToDelete.length - previewItems.length;
			
			confirmDeleteText.value = '';
			
			dialog.warning({
				title: '确认删除',
				content: () => h('div', [
					h('p', { style: 'color: #ff4d4f; margin-bottom: 16px; font-weight: 500;' }, '此操作不可撤销'),
					h('p', { style: 'margin-bottom: 12px;' }, `将删除 ${itemUuids.length} 条知识条目`),
					h('ul', { style: 'margin: 12px 0; padding-left: 24px; max-height: 150px; overflow-y: auto;' }, 
						previewItems.map(item => h('li', { style: 'margin-bottom: 4px;' }, item.title || item.itemUuid))
					),
					remainingCount > 0 && h('p', { style: 'color: #8c8c8c; margin-top: 8px;' }, `...还有 ${remainingCount} 条`),
					h(NInput, {
						value: confirmDeleteText.value,
						'onUpdate:value': (val: string) => {
							confirmDeleteText.value = val;
						},
						placeholder: '请输入"删除"或"DELETE"以确认',
						style: 'margin-top: 16px;',
					})
				]),
				positiveText: '确认删除',
				negativeText: '取消',
				positiveButtonProps: {
					type: 'error',
				},
				onPositiveClick: async () => {
					if (confirmDeleteText.value !== '删除' && confirmDeleteText.value !== 'DELETE') {
						message.error('确认文字不正确，请输入"删除"或"DELETE"');
						return false;
					}
					
					try {
						const loadingMessage = message.loading('正在删除...', { duration: 0 });
						
						const response: any = await deleteKnowledgeItemBatch(itemUuids);
						
						loadingMessage.destroy();
						
						if (response.code === 200) {
							const result = response.data || {};
							const successCount = result.successCount || itemUuids.length;
							const failedCount = result.failedCount || 0;
							
							if (failedCount > 0) {
								message.warning(`成功删除 ${successCount} 条，${failedCount} 条失败`);
								if (result.failures && result.failures.length > 0) {
									console.error('删除失败详情:', result.failures);
								}
							} else {
								message.success(`成功删除 ${successCount} 条记录`);
							}
							
							clearSelection();
							await fetchData();
							if (selectedItemUuid.value && itemUuids.includes(selectedItemUuid.value)) {
								closeDetailPanel();
							}
						} else {
							message.error(response.msg || '删除失败');
						}
					} catch (error: any) {
						message.error('删除失败: ' + (error.message || '未知错误'));
					}
					return true;
				}
			});
		}
		
		//导出相关状态
		const showExportDialog = ref(false);
		const exportConfig = ref({
			format: 'excel' as 'pdf' | 'excel',
			exportRange: 'selected' as 'selected' | 'currentPage' | 'all',
			selectedFields: ['title', 'summary', 'severity', 'language', 'createTime', 'cvssScore'] as string[],
			expandedFields: {} as Record<string, string[]>,
			fieldFormats: {} as Record<string, string>,//字段格式配置：id_only/id_name/full
			fieldOrder: [] as string[],
			pdfOptions: {
				includeHeaderFooter: true,
				includeTOC: true,
				codeHighlight: true,
			},
			excelOptions: {
				includeFilter: true,
				freezeHeader: true,
				conditionalFormatting: true,
			},
			fileName: '',
			columnWidths: {} as Record<string, number>,//列宽配置，key为字段key，value为宽度（像素）
			panelWidth: 350,//左侧字段选择面板宽度（像素）
		});
		const exportPreviewData = ref<any>(null);
		const exportPreviewLoading = ref(false);
		const currentExportStep = ref(1);
		const layoutContainerRef = ref<HTMLElement | null>(null);
		const previewTableRef = ref<HTMLElement | null>(null);
		const isDraggingDivider = ref(false);
		const fieldSelectionPanelRef = ref<HTMLElement | null>(null);
		const fieldSelectionCardRef = ref<any>(null);
		const fieldSelectionScrollbarRef = ref<any>(null);
		
		//所有可选的导出字段（按UI显示顺序）
		const allExportFields = [
			'title', 'summary', 'severity', 'vulnerabilityTypes', 'language', 'status',
			'cvssScore', 'cvssAttackVector', 'cvssAttackComplexity', 'cvssPrivilegesRequired',
			'cvssUserInteraction', 'cvssConfidentialityImpact', 'cvssIntegrityImpact', 'cvssAvailabilityImpact',
			'problemDescription', 'fixSolution', 'exampleCode',
			'tags', 'fragmentCount', 'createTime', 'updateTime',
			'createBy', 'updateBy', 'kid'
		];
		
		//默认选中的字段
		const defaultSelectedFields = ['title', 'summary', 'severity', 'language', 'createTime', 'cvssScore'];
		
		//检查是否有列宽被编辑过
		const hasColumnWidthsEdited = computed(() => {
			const columnWidths = exportConfig.value.columnWidths || {};
			return Object.keys(columnWidths).length > 0 && exportConfig.value.format === 'excel';
		});
		
		//全选字段
		function handleSelectAllFields() {
			exportConfig.value.selectedFields = [...allExportFields];
			saveExportConfigToStorage();
		}
		
		//恢复默认字段配置
		function handleResetFieldsToDefault() {
			exportConfig.value.selectedFields = [...defaultSelectedFields];
			exportConfig.value.expandedFields = {};
			exportConfig.value.fieldFormats = {
				vulnerabilityTypes: 'name_only',
				tags: 'name_only',
			};
			saveExportConfigToStorage();
			if (currentExportStep.value === 2) {
				loadExportPreview();
			}
		}
		
		//恢复默认列宽
		function handleResetColumnWidths() {
			exportConfig.value.columnWidths = {};
			saveExportConfigToStorage();
			if (currentExportStep.value === 2) {
				loadExportPreview();
			}
		}
		
		function handleBatchExport() {
			if (selectedItems.value.size === 0) {
				message.warning('请先选择要导出的条目');
				return;
			}
			
			exportConfig.value.exportRange = 'selected';
			exportConfig.value.selectedFields = ['title', 'summary', 'severity', 'language', 'createTime', 'cvssScore'];
			exportConfig.value.expandedFields = {};
			exportConfig.value.fieldFormats = {
				vulnerabilityTypes: 'name_only',
				tags: 'name_only',
			};
			loadExportConfigFromStorage();
			showExportDialog.value = true;
			nextTick(() => {
				loadExportPreview();
			});
		}
		
		function handleOpenExportDialog() {
			if (selectedItems.value.size === 0) {
				exportConfig.value.exportRange = 'currentPage';
			} else {
				exportConfig.value.exportRange = 'selected';
			}
			exportConfig.value.selectedFields = ['title', 'summary', 'severity', 'language', 'createTime', 'cvssScore'];
			exportConfig.value.expandedFields = {};
			exportConfig.value.fieldFormats = {
				vulnerabilityTypes: 'name_only',
				tags: 'name_only',
			};
			loadExportConfigFromStorage();
			showExportDialog.value = true;
			nextTick(() => {
				loadExportPreview();
			});
		}
		
		const exportTotal = computed(() => pagination.itemCount);
		
		const canProceedToNextStep = computed(() => {
			if (exportConfig.value.exportRange === 'selected' && selectedItems.value.size === 0) {
				return false;
			}
			if (exportConfig.value.exportRange === 'currentPage' && tableData.value.length === 0) {
				return false;
			}
			if (exportConfig.value.exportRange === 'all' && exportTotal.value === 0) {
				return false;
			}
			return true;
		});
		
		function loadExportConfigFromStorage() {
			const storageKey = `knowledge_item_export_config_${exportConfig.value.format}`;
			try {
				const stored = localStorage.getItem(storageKey);
				if (stored) {
					const config = JSON.parse(stored);
					if (config.selectedFields) {
						exportConfig.value.selectedFields = config.selectedFields.filter((f: string) => 
							!['severityLabel', 'languageLabel', 'statusLabel', 'cvssVector', 'vulnerabilityType'].includes(f)
						);
					}
					if (config.expandedFields) {
						const cleanedExpandedFields: Record<string, string[]> = {};
						for (const [key, values] of Object.entries(config.expandedFields)) {
							if (!['severityLabel', 'languageLabel', 'statusLabel', 'cvssVector', 'vulnerabilityType'].includes(key)) {
								cleanedExpandedFields[key] = (values as string[]).filter((v: string) => 
									!['severityLabel', 'languageLabel', 'statusLabel', 'cvssVector', 'vulnerabilityType'].includes(v)
								);
							}
						}
						exportConfig.value.expandedFields = cleanedExpandedFields;
					}
					if (config.fieldFormats) exportConfig.value.fieldFormats = config.fieldFormats;
					if (config.fieldOrder) exportConfig.value.fieldOrder = config.fieldOrder;
					if (config.pdfOptions) exportConfig.value.pdfOptions = { ...exportConfig.value.pdfOptions, ...config.pdfOptions };
					if (config.excelOptions) exportConfig.value.excelOptions = { ...exportConfig.value.excelOptions, ...config.excelOptions };
					if (config.columnWidths) exportConfig.value.columnWidths = config.columnWidths;
					if (config.panelWidth) exportConfig.value.panelWidth = config.panelWidth;
				}
			} catch (e) {
				console.warn('加载导出配置失败', e);
			}
		}
		
		function saveExportConfigToStorage() {
			const storageKey = `knowledge_item_export_config_${exportConfig.value.format}`;
			try {
				localStorage.setItem(storageKey, JSON.stringify({
					selectedFields: exportConfig.value.selectedFields,
					expandedFields: exportConfig.value.expandedFields,
					fieldFormats: exportConfig.value.fieldFormats,
					fieldOrder: exportConfig.value.fieldOrder,
					pdfOptions: exportConfig.value.pdfOptions,
					excelOptions: exportConfig.value.excelOptions,
					columnWidths: exportConfig.value.columnWidths,
					panelWidth: exportConfig.value.panelWidth,
				}));
			} catch (e) {
				console.warn('保存导出配置失败', e);
			}
		}
		
		let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;
		
		async function loadExportPreview() {
			if (previewDebounceTimer) {
				clearTimeout(previewDebounceTimer);
			}
			previewDebounceTimer = setTimeout(async () => {
				exportPreviewLoading.value = true;
				try {
					const request: any = {
				format: exportConfig.value.format,
				exportRange: exportConfig.value.exportRange,
				selectedFields: exportConfig.value.selectedFields,
				expandedFields: exportConfig.value.expandedFields,
				fieldFormats: exportConfig.value.fieldFormats,
				fieldOrder: exportConfig.value.fieldOrder,
				pdfOptions: exportConfig.value.pdfOptions,
				excelOptions: exportConfig.value.excelOptions,
				columnWidths: exportConfig.value.columnWidths,
					};
					
					if (exportConfig.value.exportRange === 'selected') {
						request.itemUuids = Array.from(selectedItems.value);
					} else if (exportConfig.value.exportRange === 'currentPage') {
						request.pageNum = pagination.page;
						request.pageSize = pagination.pageSize;
					}
					
					if (exportConfig.value.exportRange === 'all') {
						request.filters = { ...filterState, searchKeyword: searchKeyword.value.trim() || undefined };
					}
					
					const response = await exportPreview(request);
					if (response.code === 200) {
						exportPreviewData.value = response.data;
						//调试CVSS攻击方式
						if (exportPreviewData.value?.sampleData && exportPreviewData.value.sampleData.length > 0) {
							console.log('[CVSS调试] 预览数据:', exportPreviewData.value.sampleData.map((item: any) => ({
								title: item.title,
								cvssAttackVector: item.cvssAttackVector,
								cvssVector: item.cvssVector,
								cvssScore: item.cvssScore,
								allFields: Object.keys(item),
								rawData: item
							})));
						}
					} else {
						message.error(response.msg || '预览加载失败');
					}
				} catch (error: any) {
					console.error('预览加载失败', error);
					message.error('预览加载失败: ' + (error.message || '未知错误'));
				} finally {
					exportPreviewLoading.value = false;
				}
			}, 500);
		}
		
		//拖拽相关状态
		const draggedFieldIndex = ref<number | null>(null);
		const dragOverIndex = ref<number | null>(null);
		
		//处理字段拖拽开始
		function handleDragStart(index: number, event: DragEvent) {
			draggedFieldIndex.value = index;
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/html', index.toString());
			}
			if (event.target) {
				(event.target as HTMLElement).style.opacity = '0.5';
			}
		}
		
		//处理拖拽经过
		function handleDragOver(index: number, event: DragEvent) {
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'move';
			}
			dragOverIndex.value = index;
		}
		
		//处理拖拽离开
		function handleDragLeave() {
			dragOverIndex.value = null;
		}
		
		//处理字段拖拽放下
		function handleDrop(index: number, event: DragEvent) {
			event.preventDefault();
			if (draggedFieldIndex.value === null || !exportPreviewData.value?.selectedFields) {
				return;
			}
			
			const fields = [...exportPreviewData.value.selectedFields];
			const draggedField = fields[draggedFieldIndex.value];
			
			//移除原位置的字段
			fields.splice(draggedFieldIndex.value, 1);
			//在新位置插入字段
			const insertIndex = draggedFieldIndex.value < index ? index : index;
			fields.splice(insertIndex, 0, draggedField);
			
			exportPreviewData.value.selectedFields = fields;
			handleFieldOrderChange();
			
			draggedFieldIndex.value = null;
			dragOverIndex.value = null;
			
			if (event.target) {
				(event.target as HTMLElement).style.opacity = '1';
			}
		}
		
		//处理拖拽结束
		function handleDragEnd(event: DragEvent) {
			if (event.target) {
				(event.target as HTMLElement).style.opacity = '1';
			}
			draggedFieldIndex.value = null;
			dragOverIndex.value = null;
		}
		
		//处理字段顺序变化
		function handleFieldOrderChange() {
			if (!exportPreviewData.value?.selectedFields) {
				return;
			}
			//根据新的字段顺序更新 exportConfig.selectedFields 和 fieldOrder
			const newOrder = exportPreviewData.value.selectedFields.map((field: any) => field.key);
			//保持原有的字段集合，只调整顺序
			const currentFields = [...exportConfig.value.selectedFields];
			const orderedFields: string[] = [];
			//按照新顺序添加字段
			for (const key of newOrder) {
				if (currentFields.includes(key)) {
					orderedFields.push(key);
				}
			}
			//添加不在新顺序中的字段（理论上不应该有）
			for (const field of currentFields) {
				if (!orderedFields.includes(field)) {
					orderedFields.push(field);
				}
			}
			exportConfig.value.selectedFields = orderedFields;
			exportConfig.value.fieldOrder = [...orderedFields];
			saveExportConfigToStorage();
			//重新加载预览以反映新的顺序
			loadExportPreview();
		}
		
		//使用Canvas API精确测量文本宽度（行业最佳实践）
		let textMeasureCanvas: HTMLCanvasElement | null = null;
		const getTextMeasureContext = (fontSize: number = 12, fontFamily: string = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'): CanvasRenderingContext2D => {
			if (!textMeasureCanvas) {
				textMeasureCanvas = document.createElement('canvas');
			}
			const ctx = textMeasureCanvas.getContext('2d')!;
			ctx.font = `${fontSize}px ${fontFamily}`;
			return ctx;
		};
		
		//计算文本实际显示宽度（使用Canvas API获得精确测量）
		const calculateTextWidth = (text: string, fontSize: number = 12): number => {
			if (!text) return 0;
			try {
				const ctx = getTextMeasureContext(fontSize);
				const metrics = ctx.measureText(text);
				const width = metrics.width;
				return width;
			} catch (e) {
				//降级方案：使用字符估算
				let width = 0;
				for (let i = 0; i < text.length; i++) {
					const char = text[i];
					if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
						width += fontSize * 1.2;
					} else {
						width += fontSize * 0.6;
					}
				}
				return width;
			}
		};
		
		//验证保存的宽度是否合理
		const isValidSavedWidth = (width: number, fieldKey: string, minWidth: number = 100): boolean => {
			if (!width || width < minWidth) {
				return false;
			}
			//检查是否是明显错误的宽度（如89.578125px这种奇怪的小数）
			//合理的宽度应该是整数或最多1位小数，且不应该太小
			const rounded = Math.round(width);
			if (Math.abs(width - rounded) > 0.1 && width < 150) {
				return false;
			}
			return true;
		};
		
		//计算默认列宽（根据字段类型和内容）
		const calculateDefaultColumnWidth = (field: any, sampleData: any[]): number => {
			const fieldKey = field.key;
			const savedWidth = exportConfig.value.columnWidths[fieldKey];
			
			//验证保存的宽度是否合理
			if (savedWidth && isValidSavedWidth(savedWidth, fieldKey)) {
				return savedWidth;
			}
			
			//确保表头能完整显示（表头宽度 + 内边距 + 边框）
			const headerTextWidth = calculateTextWidth(field.label, 13);
			//表头内边距：左右各12px，边框：左右各1px，滚动条预留：20px，总计约60px
			const headerPadding = 60;
			let baseWidth = Math.max(headerTextWidth + headerPadding, 100);
			
			//根据样本数据计算最大内容宽度（使用更精确的测量）
			if (sampleData && sampleData.length > 0) {
				let maxContentWidth = headerTextWidth;
				sampleData.forEach((row: any) => {
					const value = row[fieldKey];
					if (value !== null && value !== undefined) {
						const contentText = String(value);
						//使用12px字体大小测量内容（表格内容通常比表头小）
						const contentWidth = calculateTextWidth(contentText, 12);
						if (contentWidth > maxContentWidth) {
							maxContentWidth = contentWidth;
						}
					}
				});
				if (maxContentWidth > headerTextWidth) {
					//内容宽度 + 内边距 + 边框 + 滚动条预留空间
					const contentPadding = 60;
					const contentBasedWidth = maxContentWidth + contentPadding;
					baseWidth = Math.max(baseWidth, contentBasedWidth);
				}
			}
			
			//特殊字段的默认最小宽度（确保基本可用性）
			const specialMinWidths: Record<string, number> = {
				title: 180,
				summary: 300,
				itemUuid: 280,
				problemDescription: 400,
				fixSolution: 400,
				exampleCode: 400,
				referenceLink: 300,
			};
			if (specialMinWidths[fieldKey]) {
				baseWidth = Math.max(baseWidth, specialMinWidths[fieldKey]);
			}
			
			//设置合理的列宽上限（避免过宽影响阅读）
			const maxWidths: Record<string, number> = {
				title: 400,
				summary: 600,
				problemDescription: 800,
				fixSolution: 800,
				exampleCode: 800,
				referenceLink: 500,
			};
			const maxWidth = maxWidths[fieldKey] || 600;
			const finalWidth = Math.max(100, Math.min(baseWidth, maxWidth));
			
			return finalWidth;
		};
		
		//生成预览表格列
		const exportPreviewColumns = computed(() => {
			if (!exportPreviewData.value?.selectedFields || exportPreviewData.value.selectedFields.length === 0) {
				return [];
			}
			const sampleData = exportPreviewData.value.sampleData || [];
			const columns = exportPreviewData.value.selectedFields.map((field: any) => {
				const defaultWidth = calculateDefaultColumnWidth(field, sampleData);
				const maxWidths: Record<string, number> = {
					title: 400,
					summary: 600,
					problemDescription: 800,
					fixSolution: 800,
					exampleCode: 800,
					referenceLink: 500,
				};
				const maxWidth = maxWidths[field.key] || 600;
				
				//确保最终宽度是合理的
				const savedWidth = exportConfig.value.columnWidths[field.key];
				let finalWidth = defaultWidth;
				if (savedWidth && isValidSavedWidth(savedWidth, field.key)) {
					finalWidth = Math.min(Math.max(savedWidth, 100), maxWidth);
				} else {
					finalWidth = Math.min(Math.max(defaultWidth, 100), maxWidth);
				}
				
				return {
					title: field.label,
					key: field.key,
					width: finalWidth,
					minWidth: 100,
					maxWidth: maxWidth,
					resizable: exportConfig.value.format === 'excel',
					ellipsis: {
						tooltip: true
					},
					render: (row: any) => {
						const value = row[field.key];
						if (value === null || value === undefined) {
							return '-';
						}
						//不再在render中截断，让列宽控制显示
						if (typeof value === 'object') {
							return JSON.stringify(value);
						}
						return String(value);
					}
				};
			});
			return columns;
		});
		
		//计算表格总宽度
		const previewTableScrollX = computed(() => {
			if (!exportPreviewColumns.value || exportPreviewColumns.value.length === 0) {
				return 1200;
			}
			const totalWidth = exportPreviewColumns.value.reduce((sum: number, col: any) => sum + (col.width || 150), 0);
			return Math.max(1200, totalWidth);
		});
		
		//处理列宽调整（带验证和防抖）
		let columnWidthChangeTimer: ReturnType<typeof setTimeout> | null = null;
		const handleColumnWidthChange = (columnKey: string, width: number, immediate: boolean = false) => {
			//验证宽度是否合理
			if (width < 50 || width > 2000) {
				console.warn(`[列宽调整] 字段 "${columnKey}" 宽度 ${width}px 超出合理范围，忽略`);
				return;
			}
			
			const doChange = () => {
				if (!exportConfig.value.columnWidths) {
					exportConfig.value.columnWidths = {};
				}
			const oldWidth = exportConfig.value.columnWidths[columnKey];
			//只保存整数宽度，避免精度问题
			const roundedWidth = Math.round(width);
			exportConfig.value.columnWidths[columnKey] = roundedWidth;
			saveExportConfigToStorage();
			};
			
			if (immediate) {
				doChange();
			} else {
				//防抖：300ms内只保存最后一次
				if (columnWidthChangeTimer) {
					clearTimeout(columnWidthChangeTimer);
				}
				columnWidthChangeTimer = setTimeout(doChange, 300);
			}
		};
		
		//防止ResizeObserver循环触发的标志
		let isUpdatingColumnWidths = false;
		//用户手动调整列宽的标志（通过拖拽）
		let isUserResizing = false;
		let userResizeStartTime = 0;
		
		//监听表格列宽变化（使用ResizeObserver，带防抖和智能阈值，防止循环触发）
		const setupColumnWidthObserver = () => {
			nextTick(() => {
				const tableElement = previewTableRef.value?.querySelector('.n-data-table');
				if (!tableElement) {
					return;
				}
				
				const headers = tableElement.querySelectorAll('.n-data-table-thead th');
				headers.forEach((header: any, index: number) => {
					const field = exportPreviewData.value?.selectedFields?.[index];
					if (!field) {
						return;
					}
					
					//清理旧的observer
					if ((header as any)._resizeObserver) {
						(header as any)._resizeObserver.disconnect();
					}
					
					const initialWidth = (header as HTMLElement).offsetWidth;
					const savedWidth = exportConfig.value.columnWidths[field.key];
					
					//如果保存的宽度明显不合理（差距超过20%），使用实际渲染宽度初始化（但不在ResizeObserver中触发）
					if (savedWidth && Math.abs(initialWidth - savedWidth) / Math.max(initialWidth, savedWidth) > 0.2) {
						//使用requestAnimationFrame延迟更新，避免在ResizeObserver设置过程中触发
						requestAnimationFrame(() => {
							isUpdatingColumnWidths = true;
							handleColumnWidthChange(field.key, initialWidth, true);
							setTimeout(() => {
								isUpdatingColumnWidths = false;
							}, 100);
						});
					}
					
					//使用防抖的ResizeObserver回调（行业最佳实践）
					let lastWidth = initialWidth;
					let lastUpdateTime = 0;
					const debouncedCallback = (() => {
						let timer: ReturnType<typeof setTimeout> | null = null;
						return (width: number) => {
							if (timer) clearTimeout(timer);
							timer = setTimeout(() => {
								//防止循环触发：如果正在更新列宽，忽略此次变化
								if (isUpdatingColumnWidths) {
									return;
								}
								
								//防止频繁触发：两次更新间隔至少500ms
								const now = Date.now();
								if (now - lastUpdateTime < 500) {
									return;
								}
								
								const currentWidth = exportConfig.value.columnWidths[field.key];
								const diff = Math.abs((currentWidth || 0) - width);
								//智能阈值：如果宽度变化超过10px或10%，则保存（提高阈值避免频繁触发）
								const threshold = Math.max(10, (currentWidth || width) * 0.1);
								
								//检查是否是用户手动调整（宽度变化较大）还是自动调整（变化很小）
								const widthChange = Math.abs(width - lastWidth);
								if (widthChange < 2) {
									return;
								}
								
								//只在用户手动调整时才保存
								if (!isUserResizing && !isDragging) {
									return;
								}
								
								if (diff > threshold && width > 50 && width < 2000) {
									isUpdatingColumnWidths = true;
									handleColumnWidthChange(field.key, width);
									lastWidth = width;
									lastUpdateTime = now;
									//延迟重置标志，避免立即触发新的ResizeObserver
									setTimeout(() => {
										isUpdatingColumnWidths = false;
									}, 200);
								}
							}, 500);
						};
					})();
					
					//检测用户是否在拖拽调整列宽
					let isDragging = false;
					header.addEventListener('mousedown', (e: MouseEvent) => {
						//检查是否点击在列宽调整区域（通常在最右侧）
						const rect = (header as HTMLElement).getBoundingClientRect();
						if (e.clientX > rect.right - 10) {
							isDragging = true;
							isUserResizing = true;
							userResizeStartTime = Date.now();
						}
					});
					
					document.addEventListener('mouseup', () => {
						if (isDragging) {
							isDragging = false;
							//延迟重置，确保ResizeObserver事件处理完成
							setTimeout(() => {
								isUserResizing = false;
							}, 100);
						}
					});
					
					const resizeObserver = new ResizeObserver((entries) => {
						//防止循环触发：如果正在更新列宽，忽略所有ResizeObserver事件
						if (isUpdatingColumnWidths) {
							return;
						}
						
						//只在用户手动调整时才保存，忽略自动调整
						if (!isUserResizing && !isDragging) {
							//如果不是用户调整，且距离上次用户调整超过2秒，则忽略
							if (Date.now() - userResizeStartTime > 2000) {
								return;
							}
						}
						
						for (const entry of entries) {
							const width = entry.contentRect.width;
							//提高触发阈值，避免微小变化触发
							if (width > 0 && Math.abs(width - lastWidth) > 2) {
								debouncedCallback(width);
							}
						}
					});
					
					resizeObserver.observe(header);
					(header as any)._resizeObserver = resizeObserver;
				});
			});
		};
		
		watch(() => exportPreviewData.value?.sampleData, () => {
			if (exportConfig.value.format === 'excel' && currentExportStep.value === 2) {
				setupColumnWidthObserver();
			}
		});
		
		//调试滚动条问题
		
		watch(() => exportConfig.value.selectedFields, (newFields: string[]) => {
			//当用户选择基础字段时，自动添加对应的展开字段
			const fieldExpansionMap: Record<string, string[]> = {
			};
			let updated = false;
			for (const [baseField, expandedFields] of Object.entries(fieldExpansionMap)) {
				if (newFields.includes(baseField)) {
					if (!exportConfig.value.expandedFields[baseField]) {
						exportConfig.value.expandedFields[baseField] = [];
					}
					for (const expandedField of expandedFields) {
						if (!exportConfig.value.expandedFields[baseField].includes(expandedField)) {
							exportConfig.value.expandedFields[baseField].push(expandedField);
							updated = true;
						}
					}
				}
			}
			//为多值字段设置默认格式
			if (newFields.includes('vulnerabilityTypes')) {
				if (!exportConfig.value.fieldFormats.vulnerabilityTypes) {
					exportConfig.value.fieldFormats.vulnerabilityTypes = 'name_only';
					updated = true;
				}
			} else {
				delete exportConfig.value.fieldFormats.vulnerabilityTypes;
				updated = true;
			}
			if (newFields.includes('tags')) {
				if (!exportConfig.value.fieldFormats.tags) {
					exportConfig.value.fieldFormats.tags = 'name_only';
					updated = true;
				}
			} else {
				delete exportConfig.value.fieldFormats.tags;
				updated = true;
			}
			if (updated) {
				saveExportConfigToStorage();
			}
		}, { deep: true });
		watch([
			() => exportConfig.value.format,
			() => exportConfig.value.exportRange,
			() => exportConfig.value.selectedFields,
			() => exportConfig.value.expandedFields,
			() => exportConfig.value.fieldFormats,
			() => exportConfig.value.pdfOptions,
			() => exportConfig.value.excelOptions,
		], () => {
			if (currentExportStep.value === 2 && exportConfig.value.selectedFields.length > 0) {
				if (previewDebounceTimer) {
					clearTimeout(previewDebounceTimer);
				}
				previewDebounceTimer = setTimeout(() => {
					loadExportPreview();
				}, 500);
			}
		}, { deep: true });
		
		watch(() => currentExportStep.value, (newStep: number) => {
			if (newStep === 2 && exportConfig.value.selectedFields.length > 0) {
				loadExportPreview();
			}
		});
		
		//处理分隔条拖拽
		const handleDividerMouseDown = (e: MouseEvent) => {
			e.preventDefault();
			isDraggingDivider.value = true;
			const startX = e.clientX;
			const startWidth = exportConfig.value.panelWidth;
			
			const handleMouseMove = (e: MouseEvent) => {
				const deltaX = e.clientX - startX;
				const newWidth = Math.max(250, Math.min(600, startWidth + deltaX));
				exportConfig.value.panelWidth = newWidth;
			};
			
			const handleMouseUp = () => {
				isDraggingDivider.value = false;
				saveExportConfigToStorage();
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
			
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
		};
		
		//监听表格列宽变化
		watch(() => exportPreviewColumns.value, () => {
			if (exportConfig.value.format === 'excel' && currentExportStep.value === 2) {
				nextTick(() => {
					setupColumnWidthObserver();
				});
			}
		}, { deep: true });
		
		async function handleExport() {
			if (exportConfig.value.selectedFields.length === 0) {
				message.error('请至少选择一个字段');
				return;
			}
			
			try {
				if (exportConfig.value.format === 'pdf') {
					await handlePdfExport();
				} else {
					await handleExcelExport();
				}
				saveExportConfigToStorage();
				showExportDialog.value = false;
				message.success('导出成功');
			} catch (error: any) {
				console.error('导出失败', error);
				message.error('导出失败: ' + (error.message || '未知错误'));
			}
		}
		
		async function handleExcelExport() {
			const request: any = {
				format: exportConfig.value.format,
				exportRange: exportConfig.value.exportRange,
				selectedFields: exportConfig.value.selectedFields,
				expandedFields: exportConfig.value.expandedFields,
				fieldFormats: exportConfig.value.fieldFormats,
				fieldOrder: exportConfig.value.fieldOrder,
				excelOptions: exportConfig.value.excelOptions,
				columnWidths: exportConfig.value.columnWidths,
				fileName: exportConfig.value.fileName || undefined,
			};
			
			if (exportConfig.value.exportRange === 'selected') {
				request.itemUuids = Array.from(selectedItems.value);
			} else if (exportConfig.value.exportRange === 'currentPage') {
				request.pageNum = pagination.page;
				request.pageSize = pagination.pageSize;
			}
			
			if (exportConfig.value.exportRange === 'all') {
				request.filters = { ...filterState, searchKeyword: searchKeyword.value.trim() || undefined };
			}
			
			const loadingMessage = message.loading('正在导出...', { duration: 0 });
			
			const response = await exportKnowledgeItems(request);
			
			loadingMessage.destroy();
			
			const blob = new Blob([response], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});
			
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			const fileName = exportConfig.value.fileName || `知识条目导出_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		}
		
		async function handlePdfExport() {
			const { jsPDF } = await import('jspdf');
			const html2canvas = (await import('html2canvas')).default;
			
			const request: any = {
				format: 'pdf',
				exportRange: exportConfig.value.exportRange,
				selectedFields: exportConfig.value.selectedFields,
				expandedFields: exportConfig.value.expandedFields,
				fieldFormats: exportConfig.value.fieldFormats,
				fieldOrder: exportConfig.value.fieldOrder,
				pdfOptions: exportConfig.value.pdfOptions,
			};
			
			if (exportConfig.value.exportRange === 'selected') {
				request.itemUuids = Array.from(selectedItems.value);
			} else if (exportConfig.value.exportRange === 'currentPage') {
				request.pageNum = pagination.page;
				request.pageSize = pagination.pageSize;
			}
			
			if (exportConfig.value.exportRange === 'all') {
				request.filters = { ...filterState, searchKeyword: searchKeyword.value.trim() || undefined };
			}
			
			const loadingMessage = message.loading('正在生成PDF...', { duration: 0 });
			
			try {
				const previewResponse = await exportPreview(request);
				
				if (previewResponse.code !== 200 || !previewResponse.data) {
					throw new Error('获取导出数据失败');
				}
				
				const { sampleData, selectedFields: fieldInfos } = previewResponse.data;
				
				if (!sampleData || sampleData.length === 0) {
					throw new Error('没有可导出的数据');
				}
				
				const tempDiv = document.createElement('div');
				tempDiv.style.position = 'absolute';
				tempDiv.style.left = '-9999px';
				tempDiv.style.width = '210mm';
				tempDiv.style.padding = '20mm';
				tempDiv.style.fontSize = '12px';
				tempDiv.style.fontFamily = 'Arial, sans-serif';
				tempDiv.style.backgroundColor = '#fff';
				document.body.appendChild(tempDiv);
				
				let html = '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';
				html += '<thead><tr style="background-color: #f5f5f5;">';
				for (const fieldInfo of fieldInfos) {
					html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${fieldInfo.label}</th>`;
				}
				html += '</tr></thead><tbody>';
				for (const item of sampleData) {
					html += '<tr>';
					for (const fieldInfo of fieldInfos) {
						const value = String(item[fieldInfo.key] || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
						html += `<td style="border: 1px solid #ddd; padding: 8px;">${value}</td>`;
					}
					html += '</tr>';
				}
				html += '</tbody></table>';
				tempDiv.innerHTML = html;
				
				const canvas = await html2canvas(tempDiv, {
					scale: 2,
					useCORS: true,
					backgroundColor: '#fff'
				});
				
				document.body.removeChild(tempDiv);
				
				const imgData = canvas.toDataURL('image/png');
				const pdf = new jsPDF('p', 'mm', 'a4');
				const imgWidth = 210;
				const pageHeight = 297;
				const imgHeight = (canvas.height * imgWidth) / canvas.width;
				let heightLeft = imgHeight;
				let position = 0;
				
				pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
				heightLeft -= pageHeight;
				
				while (heightLeft >= 0) {
					position = heightLeft - imgHeight;
					pdf.addPage();
					pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
					heightLeft -= pageHeight;
				}
				
				const fileName = exportConfig.value.fileName || `知识条目导出_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
				pdf.save(fileName);
			} finally {
				loadingMessage.destroy();
			}
		}
		
		//打开创建模态框
		function handleCreate() {
			// 1. 【上锁】告诉 watcher 此时不要乱动
			isInit.value = true;

			// 先清除可能遗留的定时器（双重保险）
			if (createValidationTimer) {
				clearTimeout(createValidationTimer);
				createValidationTimer = null;
			}

			// 2. 计算默认值 (保持原样)
			const defaultStatus = statusOptions.value.length > 0 ? statusOptions.value[0].value : 'draft';
			const defaultLanguage = languageOptions.value.length > 0 ? languageOptions.value[0].value : undefined;
			const defaultSeverity = severityOptions.value.length > 0 ? severityOptions.value[0].value : undefined;

			// 3. 设置表单值 (此时 watcher 会触发，但会被 isInit 拦截并直接 return)
			createFormValue.value = {
				kid: filterState.kid || route.query.kid as string || undefined,
				title: '',
				summary: '',
				problemDescription: '',
				fixSolution: '',
				exampleCode: '',
				vulnerabilityType: undefined,
				vulnerabilityTypes: [],
				language: defaultLanguage,
				severity: defaultSeverity,
				cvssVector: undefined,
				cvssScore: undefined,
				status: defaultStatus,
				sourceType: 'manual',
				tags: [],
				riskAttackVector: undefined,
				riskComplexity: undefined,
				riskPrivileges: undefined,
				riskUserInteraction: undefined,
				riskImpact: [],
			} as KnowledgeItemReq & { 
				vulnerabilityTypes?: string[];
				riskAttackVector?: string;
				riskComplexity?: string;
				riskPrivileges?: string;
				riskUserInteraction?: string;
				riskImpact?: string[];
			};

			// 4. 重置校验状态位
			isCreateFormValid.value = false;
			
			// 5. 显示模态框
			showCreateModal.value = true;

			// 6. 【解锁】等待 DOM 渲染完毕后，清除样式并解除锁定
			nextTick(() => {
				// 这一步很重要：Naive UI 可能在组件挂载时自动进行了一次脏检查显示了红色，这里强制清除掉
				createFormRef.value?.restoreValidation();
				
				// 稍微延迟一点点解锁，确保所有初始化的副作用都跑完了
				// 这里的 50ms 是为了防止某些组件(如Select)在挂载瞬间触发 change 事件
				setTimeout(() => {
					isInit.value = false;
				}, 50);
			});
		}
		
		//关闭创建模态框
		function closeCreateModal() {
			showCreateModal.value = false;
			createFormValue.value = {
				kid: undefined,
				title: '',
				summary: '',
				problemDescription: '',
				fixSolution: '',
				exampleCode: '',
				vulnerabilityType: undefined,
				language: undefined,
				severity: undefined,
				cvssVector: undefined,
				cvssScore: undefined,
				status: 'draft',
				sourceType: 'manual',
				tags: [],
				riskAttackVector: undefined,
				riskComplexity: undefined,
				riskPrivileges: undefined,
				riskUserInteraction: undefined,
				riskImpact: [],
			};
			if (createFormRef.value) {
				createFormRef.value.restoreValidation();
			}
			isCreateFormValid.value = false;
		}
		
		//检查创建表单验证
		function checkCreateFormValidation() {
			if (!createFormRef.value) {
				isCreateFormValid.value = false;
				return;
			}
			// 使用 validate 方法检查表单状态，但不显示错误（错误由 trigger 控制）
			createFormRef.value.validate((errors) => {
				if (errors && errors.length > 0) {
					isCreateFormValid.value = false;
				} else {
					// 检查必填字段是否都有值
					const currentKid = filterState.kid || route.query.kid as string;
					const vulnTypes = (createFormValue.value as any).vulnerabilityTypes;
					const riskImpact = (createFormValue.value as any).riskImpact;
					const hasRequiredFields = 
						currentKid &&
						createFormValue.value.title?.trim() &&
						vulnTypes && vulnTypes.length > 0 &&
						createFormValue.value.problemDescription?.trim() &&
						createFormValue.value.fixSolution?.trim() &&
						createFormValue.value.status &&
						createFormValue.value.riskAttackVector &&
						createFormValue.value.riskComplexity &&
						createFormValue.value.riskPrivileges &&
						createFormValue.value.riskUserInteraction &&
						riskImpact && riskImpact.length > 0;
					isCreateFormValid.value = !!hasRequiredFields;
				}
			});
		}
		
		//风险评分维度选项
		const riskAttackVectorOptions = [
			{ label: '远程', value: 'N', description: '可通过网络远程利用' },
			{ label: '本地', value: 'L', description: '需要本地访问' },
			{ label: '网络相邻', value: 'A', description: '需要同一网络环境' },
			{ label: '物理', value: 'P', description: '需要物理接触' },
		];
		const riskComplexityOptions = [
			{ label: '低', value: 'L', description: '利用条件简单，容易触发' },
			{ label: '中', value: 'H', description: '需要一定条件才能利用' },
			{ label: '高', value: 'H', description: '利用条件复杂，难以触发' },
		];
		const riskPrivilegesOptions = [
			{ label: '无需权限', value: 'N', description: '普通用户即可利用' },
			{ label: '需要权限', value: 'L', description: '需要登录或基本权限' },
			{ label: '高级权限', value: 'H', description: '需要管理员或系统权限' },
		];
		const riskUserInteractionOptions = [
			{ label: '无需交互', value: 'N', description: '无需用户操作即可利用' },
			{ label: '需要交互', value: 'R', description: '需要用户执行某些操作' },
		];
		const riskImpactOptions = [
			{ label: '机密性', value: 'C', description: '可能泄露敏感信息' },
			{ label: '完整性', value: 'I', description: '可能篡改数据或系统' },
			{ label: '可用性', value: 'A', description: '可能导致服务中断' },
		];
		
		//检查已填写的维度
		const riskDimensionsStatus = computed(() => {
			const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = createFormValue.value;
			const filled = [];
			const missing = [];
			if (riskAttackVector) filled.push('攻击方式');
			else missing.push('攻击方式');
			if (riskComplexity) filled.push('利用复杂度');
			else missing.push('利用复杂度');
			if (riskPrivileges) filled.push('权限需求');
			else missing.push('权限需求');
			if (riskUserInteraction) filled.push('用户交互');
			else missing.push('用户交互');
			if (riskImpact && riskImpact.length > 0) filled.push('影响范围');
			else missing.push('影响范围');
			return { filled, missing, isComplete: missing.length === 0 };
		});
		
		//计算风险评分范围（支持部分填写）
		const calculatedRiskScore = computed(() => {
			const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = createFormValue.value;
			const { isComplete } = riskDimensionsStatus.value;
			
			//如果没有填写任何维度，返回null
			if (!riskAttackVector && !riskComplexity && !riskPrivileges && !riskUserInteraction && (!riskImpact || riskImpact.length === 0)) {
				return null;
			}
			
			//计算已填写维度的基础分数
			let baseScore = 0;
			const avScores: Record<string, number> = { 'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2 };
			const acScores: Record<string, number> = { 'L': 0.77, 'H': 0.44 };
			const prScores: Record<string, number> = { 'N': 0.85, 'L': 0.62, 'H': 0.27 };
			const uiScores: Record<string, number> = { 'N': 0.85, 'R': 0.62 };
			const impactScores: Record<string, number> = { 'C': 0.22, 'I': 0.22, 'A': 0.22 };
			
			if (riskAttackVector) baseScore += avScores[riskAttackVector] || 0;
			if (riskComplexity) baseScore += acScores[riskComplexity] || 0;
			if (riskPrivileges) baseScore += prScores[riskPrivileges] || 0;
			if (riskUserInteraction) baseScore += uiScores[riskUserInteraction] || 0;
			
			let maxImpact = 0;
			if (riskImpact && riskImpact.length > 0) {
				riskImpact.forEach(imp => {
					maxImpact = Math.max(maxImpact, impactScores[imp] || 0);
				});
				baseScore += maxImpact * 3;
			}
			
			//归一化到0-10
			const score = Math.min(10, Math.max(0, baseScore * 1.08));
			
			if (isComplete) {
				//完整评分：返回精确值
				return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true };
			} else {
				//部分评分：计算可能范围
				//缺失维度的影响：假设缺失的维度取最坏情况（最高风险）
				let maxPossibleScore = score;
				const { missing } = riskDimensionsStatus.value;
				if (missing.includes('攻击方式')) maxPossibleScore += avScores['N'] * 1.08;
				if (missing.includes('利用复杂度')) maxPossibleScore += acScores['L'] * 1.08;
				if (missing.includes('权限需求')) maxPossibleScore += prScores['N'] * 1.08;
				if (missing.includes('用户交互')) maxPossibleScore += uiScores['N'] * 1.08;
				if (missing.includes('影响范围')) maxPossibleScore += impactScores['C'] * 3 * 1.08;
				maxPossibleScore = Math.min(10, maxPossibleScore);
				
				return { 
					exact: null, 
					min: Math.round(score * 10) / 10, 
					max: Math.round(maxPossibleScore * 10) / 10,
					isComplete: false 
				};
			}
		});
		
		//根据风险分数自动映射风险等级
		const calculatedRiskLevel = computed(() => {
			const score = calculatedRiskScore.value;
			if (score === null) return null;
			
			//使用精确值或范围的最大值来判断等级
			const scoreValue = score.exact !== null ? score.exact : score.max;
			
			if (scoreValue >= 9.0) return { value: 'critical', label: '极高', color: '#d13438' };
			if (scoreValue >= 7.0) return { value: 'high', label: '高', color: '#ff8c00' };
			if (scoreValue >= 4.0) return { value: 'medium', label: '中', color: '#ffaa44' };
			if (scoreValue >= 0.1) return { value: 'low', label: '低', color: '#107c10' };
			return { value: 'none', label: '无', color: '#8a8886' };
		});
		
		//生成CVSS评分字符串（用于后端存储）
		const generateCvssVector = () => {
			const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = createFormValue.value;
			if (!riskAttackVector || !riskComplexity || !riskPrivileges || !riskUserInteraction || !riskImpact || riskImpact.length === 0) {
				return undefined;
			}
			//简化的CVSS v4.0评分格式
			const impactStr = riskImpact.sort().join('');
			return `CVSS:4.0/AV:${riskAttackVector}/AC:${riskComplexity}/AT:N/PR:${riskPrivileges}/UI:${riskUserInteraction}/VC:${impactStr.includes('C') ? 'H' : 'N'}/VI:${impactStr.includes('I') ? 'H' : 'N'}/VA:${impactStr.includes('A') ? 'H' : 'N'}/SC:N/SI:N/SA:N`;
		};
		
		//监听搜索关键词变化，自动切换排序方式
		watch(searchKeyword, () => {
			const currentKeyword = searchKeyword.value.trim();
			const wasSearching = previousSearchKeyword.value.trim() !== '';
			const isNowSearching = currentKeyword !== '';
			if (!wasSearching && isNowSearching) {
				previousSortState.value = {
					orderBy: filterState.orderBy,
					order: filterState.order
				};
				filterState.orderBy = 'relevance';
				filterState.order = 'desc';
			} else if (wasSearching && !isNowSearching) {
				if (previousSortState.value.orderBy && previousSortState.value.orderBy !== 'relevance') {
					filterState.orderBy = previousSortState.value.orderBy as any;
					filterState.order = previousSortState.value.order || 'desc';
				} else {
					filterState.orderBy = 'create_time';
					filterState.order = 'desc';
				}
			} else if (wasSearching && isNowSearching) {
				if (filterState.orderBy !== 'relevance') {
					filterState.orderBy = 'relevance';
					filterState.order = 'desc';
				}
			}
			previousSearchKeyword.value = currentKeyword;
			if (searchDebounceTimer) {
				clearTimeout(searchDebounceTimer);
			}
			isSearching.value = true;
			searchDebounceTimer = setTimeout(() => {
				clearSelection();
				message.info('筛选条件已更改，已清除之前的选择');
				pagination.page = 1;
				fetchData();
				isSearching.value = false;
			}, 300);
		});
		
		//监听筛选条件变化（不包括排序）- 筛选变化会清除选择
		watch([
			() => filterState.kid,
			() => filterState.vulnerabilityTypes,
			() => filterState.languages,
			() => filterState.severities,
			() => filterState.statuses,
			() => filterState.tags,
			() => filterState.cvssScoreMin,
			() => filterState.cvssScoreMax,
			() => filterState.cvssAttackVector,
			() => filterState.cvssAttackComplexity,
			() => filterState.cvssPrivilegesRequired,
			() => filterState.cvssUserInteraction,
			() => filterState.cvssScope,
			() => filterState.cvssConfidentiality,
			() => filterState.cvssIntegrity,
			() => filterState.cvssAvailability,
			() => filterState.createTimeStart,
			() => filterState.createTimeEnd,
		], () => {
			if (selectedItems.value.size > 0) {
				clearSelection();
				message.info('筛选条件已更改，已清除之前的选择');
			}
		}, { deep: true });
		
		//监听排序变化 - 排序变化不清除选择，只重新获取数据
		watch([
			() => filterState.orderBy,
			() => filterState.order,
		], () => {
			pagination.page = 1;
			fetchData();
		});
	
		watch([
			() => createFormValue.value.riskAttackVector,
			() => createFormValue.value.riskComplexity,
			() => createFormValue.value.riskPrivileges,
			() => createFormValue.value.riskUserInteraction,
			() => createFormValue.value.riskImpact,
		], () => {
			const score = calculatedRiskScore.value;
			if (score !== null && score.isComplete && score.exact !== null) {
				//只有完整评分时才更新CVSS分数和评分字符串
				createFormValue.value.cvssScore = score.exact;
				createFormValue.value.cvssVector = generateCvssVector();
				//自动映射风险等级
				const level = calculatedRiskLevel.value;
				if (level) {
					const severityOption = severityOptions.value.find(opt => {
						const optValue = (opt.value as string).toLowerCase();
						return optValue === level.value || optValue.includes(level.value);
					});
					if (severityOption) {
						createFormValue.value.severity = severityOption.value;
					}
				}
			} else if (score === null) {
				//如果没有任何维度，清空CVSS相关字段
				createFormValue.value.cvssScore = undefined;
				createFormValue.value.cvssVector = undefined;
			}
		}, { deep: true });
		
		//更新创建表单验证
		let createValidationTimer: ReturnType<typeof setTimeout> | null = null;
		function updateCreateFormValidation() {
			if (createValidationTimer) {
				clearTimeout(createValidationTimer);
			}
			createValidationTimer = setTimeout(() => {
				checkCreateFormValidation();
			}, 300);
		}
		let editValidationTimer: ReturnType<typeof setTimeout> | null = null;
		function updateEditFormValidation() {
			if (editValidationTimer) {
				clearTimeout(editValidationTimer);
			}
			editValidationTimer = setTimeout(() => {
				checkEditFormValidation();
			}, 300);
		}
		
		//检查编辑表单验证
		function checkEditFormValidation() {
			if (!editFormRef.value) {
				isEditFormValid.value = false;
				return;
			}
			editFormRef.value.validate((errors) => {
				if (errors && errors.length > 0) {
					isEditFormValid.value = false;
				} else {
					const vulnTypes = (editFormValue.value as any).vulnerabilityTypes;
					const riskImpact = (editFormValue.value as any).riskImpact;
					const hasRequiredFields = 
						editFormValue.value.title?.trim() &&
						vulnTypes && vulnTypes.length > 0 &&
						editFormValue.value.problemDescription?.trim() &&
						editFormValue.value.fixSolution?.trim() &&
						editFormValue.value.status &&
						editFormValue.value.riskAttackVector &&
						editFormValue.value.riskComplexity &&
						editFormValue.value.riskPrivileges &&
						editFormValue.value.riskUserInteraction &&
						riskImpact && riskImpact.length > 0;
					isEditFormValid.value = !!hasRequiredFields;
				}
			});
		}
		
		//生成CVSS评分字符串（用于编辑表单）
		const generateEditCvssVector = () => {
			const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = editFormValue.value;
			if (!riskAttackVector || !riskComplexity || !riskPrivileges || !riskUserInteraction || !riskImpact || riskImpact.length === 0) {
				return undefined;
			}
			const impactStr = riskImpact.sort().join('');
			return `CVSS:4.0/AV:${riskAttackVector}/AC:${riskComplexity}/AT:N/PR:${riskPrivileges}/UI:${riskUserInteraction}/VC:${impactStr.includes('C') ? 'H' : 'N'}/VI:${impactStr.includes('I') ? 'H' : 'N'}/VA:${impactStr.includes('A') ? 'H' : 'N'}/SC:N/SI:N/SA:N`;
		};
		
		//计算编辑表单的风险评分
		const calculatedEditRiskScore = computed(() => {
			const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = editFormValue.value;
			if (!riskAttackVector && !riskComplexity && !riskPrivileges && !riskUserInteraction && (!riskImpact || riskImpact.length === 0)) {
				return null;
			}
			let baseScore = 0;
			const avScores: Record<string, number> = { 'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.2 };
			const acScores: Record<string, number> = { 'L': 0.77, 'H': 0.44 };
			const prScores: Record<string, number> = { 'N': 0.85, 'L': 0.62, 'H': 0.27 };
			const uiScores: Record<string, number> = { 'N': 0.85, 'R': 0.62 };
			const impactScores: Record<string, number> = { 'C': 0.22, 'I': 0.22, 'A': 0.22 };
			
			if (riskAttackVector) baseScore += avScores[riskAttackVector] || 0;
			if (riskComplexity) baseScore += acScores[riskComplexity] || 0;
			if (riskPrivileges) baseScore += prScores[riskPrivileges] || 0;
			if (riskUserInteraction) baseScore += uiScores[riskUserInteraction] || 0;
			
			let maxImpact = 0;
			if (riskImpact && riskImpact.length > 0) {
				riskImpact.forEach(imp => {
					maxImpact = Math.max(maxImpact, impactScores[imp] || 0);
				});
				baseScore += maxImpact * 3;
			}
			
			const score = Math.min(10, Math.max(0, baseScore * 1.08));
			const isComplete = !!(riskAttackVector && riskComplexity && riskPrivileges && riskUserInteraction && riskImpact && riskImpact.length > 0);
			
			if (isComplete) {
				return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true };
			} else {
				let maxPossibleScore = score;
				if (!riskAttackVector) maxPossibleScore += avScores['N'] * 1.08;
				if (!riskComplexity) maxPossibleScore += acScores['L'] * 1.08;
				if (!riskPrivileges) maxPossibleScore += prScores['N'] * 1.08;
				if (!riskUserInteraction) maxPossibleScore += uiScores['N'] * 1.08;
				if (!riskImpact || riskImpact.length === 0) maxPossibleScore += impactScores['C'] * 3 * 1.08;
				maxPossibleScore = Math.min(10, maxPossibleScore);
				return { 
					exact: null, 
					min: Math.round(score * 10) / 10, 
					max: Math.round(maxPossibleScore * 10) / 10,
					isComplete: false 
				};
			}
		});
		
		//监听编辑表单风险评分维度变化
		watch([
			() => editFormValue.value.riskAttackVector,
			() => editFormValue.value.riskComplexity,
			() => editFormValue.value.riskPrivileges,
			() => editFormValue.value.riskUserInteraction,
			() => editFormValue.value.riskImpact,
		], () => {
			const score = calculatedEditRiskScore.value;
			if (score !== null && score.isComplete && score.exact !== null) {
				editFormValue.value.cvssScore = score.exact;
				editFormValue.value.cvssVector = generateEditCvssVector();
				const scoreValue = score.exact;
				if (scoreValue >= 9.0) editFormValue.value.severity = 'critical';
				else if (scoreValue >= 7.0) editFormValue.value.severity = 'high';
				else if (scoreValue >= 4.0) editFormValue.value.severity = 'medium';
				else if (scoreValue >= 0.1) editFormValue.value.severity = 'low';
				else editFormValue.value.severity = 'none';
			} else if (score === null) {
				editFormValue.value.cvssScore = undefined;
				editFormValue.value.cvssVector = undefined;
			}
			updateEditFormValidation();
		}, { deep: true });
		
		//恢复编辑表单原始数据
		function restoreEditForm() {
			if (!editingItemUuid.value || !originalEditFormValue.value) return;
			editFormValue.value = JSON.parse(JSON.stringify(originalEditFormValue.value));
			selectedTagsForEdit.value = ((originalEditFormValue.value.tags || []) as string[]).map((tagName: string) => ({ name: tagName }));
			nextTick(() => {
				updateEditFormValidation();
			});
		}
		//处理编辑模态框显示状态变化
		function handleEditModalShowChange(show: boolean) {
			if (!show) {
				resetEditForm();
			}
		}
		//重置编辑表单
		function resetEditForm() {
			editFormValue.value = {
				kid: undefined,
				title: '',
				summary: '',
				problemDescription: '',
				fixSolution: '',
				exampleCode: '',
				vulnerabilityType: undefined,
				vulnerabilityTypes: [],
				language: undefined,
				severity: undefined,
				cvssVector: undefined,
				cvssScore: undefined,
				status: 'draft',
				sourceType: 'manual',
				tags: [],
				riskAttackVector: undefined,
				riskComplexity: undefined,
				riskPrivileges: undefined,
				riskUserInteraction: undefined,
				riskImpact: [],
			};
			originalEditFormValue.value = {
				kid: undefined,
				title: '',
				summary: '',
				problemDescription: '',
				fixSolution: '',
				exampleCode: '',
				vulnerabilityType: undefined,
				vulnerabilityTypes: [],
				language: undefined,
				severity: undefined,
				cvssVector: undefined,
				cvssScore: undefined,
				status: 'draft',
				sourceType: 'manual',
				tags: [],
				riskAttackVector: undefined,
				riskComplexity: undefined,
				riskPrivileges: undefined,
				riskUserInteraction: undefined,
				riskImpact: [],
			};
			selectedTagsForEdit.value = [];
			editingItemUuid.value = null;
			if (editFormRef.value) {
				editFormRef.value.restoreValidation();
			}
			isEditFormValid.value = false;
		}
		//关闭编辑模态框
		function closeEditModal() {
			showEditModal.value = false;
		}
		
		//提交编辑表单
		async function submitEditForm() {
			if (!editFormRef.value || !editingItemUuid.value) return;
			try {
				await editFormRef.value.validate();
				const vulnTypes = (editFormValue.value as any).vulnerabilityTypes;
				if (!vulnTypes || vulnTypes.length === 0) {
					message.error('请至少选择一个漏洞类型');
					return;
				}
				if (!editFormValue.value.problemDescription?.trim()) {
					message.error('请输入问题描述');
					return;
				}
				if (!editFormValue.value.fixSolution?.trim()) {
					message.error('请输入修复方案');
					return;
				}
				if (!editFormValue.value.status) {
					message.error('请选择状态');
					return;
				}
				editing.value = true;
				const params: KnowledgeItemReq = {
					...editFormValue.value,
					itemUuid: editingItemUuid.value,
				};
				const response: any = await updateKnowledgeItem(editingItemUuid.value, params);
				if (response.code === 200) {
					message.success('更新成功');
					originalEditFormValue.value = JSON.parse(JSON.stringify(editFormValue.value));
					closeEditModal();
					fetchData();
					if (detailItem.value && detailItem.value.itemUuid === editingItemUuid.value) {
						await openDetailPanel({ itemUuid: editingItemUuid.value });
					}
				} else {
					message.error(response.msg || '更新失败');
				}
			} catch (error: any) {
				if (error && typeof error === 'object' && error.message) {
					message.error(error.message || '更新失败');
				} else {
					message.error('更新失败');
				}
			} finally {
				editing.value = false;
			}
		}
		
		//提交创建表单
		async function submitCreateForm() {
			if (!createFormRef.value) return;
			try {
				// 先进行表单验证
				await createFormRef.value.validate();
				
				// 额外检查必填字段
				const currentKid = filterState.kid || route.query.kid as string;
				if (!currentKid) {
					message.error('无法确定当前知识库，请刷新页面后重试');
					return;
				}
				
				const vulnTypes = (createFormValue.value as any).vulnerabilityTypes;
				if (!vulnTypes || vulnTypes.length === 0) {
					message.error('请至少选择一个漏洞类型');
					return;
				}
				
				if (!createFormValue.value.problemDescription?.trim()) {
					message.error('请输入问题描述');
					return;
				}
				
				if (!createFormValue.value.fixSolution?.trim()) {
					message.error('请输入修复方案');
					return;
				}
				
				if (!createFormValue.value.status) {
					message.error('请选择状态');
					return;
				}
				
				submitting.value = true;
				const params: KnowledgeItemReq = {
					...createFormValue.value,
					kid: currentKid,
				};
				const response: any = await createKnowledgeItem(params);
				if (response.code === 200) {
					message.success('创建成功');
					closeCreateModal();
					fetchData();
				} else {
					message.error(response.msg || '创建失败');
				}
			} catch (error: any) {
				// 表单验证错误，Naive UI 会自动显示错误信息，这里不需要额外处理
				if (error && typeof error === 'object' && error.message) {
					// 如果是其他错误，显示错误信息
					message.error(error.message || '创建失败');
				}
			} finally {
				submitting.value = false;
			}
		}
		
		//加载知识库选项
		async function loadKnowledgeBaseOptions() {
			try {
				const response: any = await (getKnowledgeByRole as any)({ pageNum: 1, pageSize: 1000 });
				if (response.code === 200 && response.rows && Array.isArray(response.rows)) {
					knowledgeBaseOptions.value = response.rows.map((item: any) => ({
						label: item.kname,
						value: item.kid,
					}));
				}
			} catch (error) {
				console.error('加载知识库列表失败:', error);
			}
		}
		
		
		function handleResetFilter() {
			Object.assign(filterState, {
				kid: route.query.kid as string || undefined,
				title: undefined,
				vulnerabilityTypes: [],
				languages: [],
				severities: [],
				statuses: [],
				tags: [],
				orderBy: 'create_time',
				order: 'desc',
			});
			searchKeyword.value = '';
			fetchData();
		}
		
		function handleApplyFilter() {
			showFilterDrawer.value = false;
			pagination.page = 1;
			fetchData();
		}
		
		function handleGoBack() {
			//逻辑返回：返回到知识库管理页
			router.push({
				name: 'knowledge1',
			});
		}
		
		//切换分组模式
		
		//排序
		function handleSortChange(value?: string) {
			if (value) {
				filterState.orderBy = value as any;
				fetchData();
			}
		}
		
		//排序方向切换
		function toggleSortOrder() {
			filterState.order = filterState.order === 'asc' ? 'desc' : 'asc';
			fetchData();
		}
		
		async function loadKnowledgeBaseName() {
			if (filterState.kid) {
				try {
					const response: any = await (getKnowledgeByRole as any)({ pageNum: 1, pageSize: 1000 });
					if (response.code === 200 && response.rows && Array.isArray(response.rows)) {
						const knowledgeBase = response.rows.find((item: any) => item.kid === filterState.kid);
						if (knowledgeBase && knowledgeBase.kname) {
							knowledgeBaseName.value = knowledgeBase.kname;
						} else {
							knowledgeBaseName.value = "";
						}
					} else {
						knowledgeBaseName.value = "";
					}
				} catch (error) {
					console.error("加载知识库名称失败:", error);
					knowledgeBaseName.value = "";
				}
			} else {
				knowledgeBaseName.value = "";
			}
		}
		
		
	//使用后端返回的分面统计数据
	const facetStats = computed(() => {
		if (!backendFacetStats.value) {
			return {
				severities: {} as Record<string, number>,
				languages: {} as Record<string, number>,
				statuses: {} as Record<string, number>,
				vulnerabilityTypes: {} as Record<string, number>,
				tags: {} as Record<string, number>,
			};
		}
		return backendFacetStats.value;
	});
	//全选状态计算属性
	const severitySelectAllState = computed(() => {
		const selected = facetSeverities.value || [];
		if (selected.length === 0) return false;
		if (severityOptions.value.length > 0 && selected.length === severityOptions.value.length) return true;
		return null;
	});
	const languageSelectAllState = computed(() => {
		const selected = facetLanguages.value || [];
		if (selected.length === 0) return false;
		if (languageOptions.value.length > 0 && selected.length === languageOptions.value.length) return true;
		return null;
	});
	const statusSelectAllState = computed(() => {
		const selected = facetStatuses.value || [];
		if (selected.length === 0) return false;
		if (statusOptions.value.length > 0 && selected.length === statusOptions.value.length) return true;
		return null;
	});
	const vulnerabilityTypeSelectAllState = computed(() => {
		const selected = facetVulnerabilityTypes.value || [];
		if (selected.length === 0) return false;
		const availableTypes = Object.keys(facetStats.value?.vulnerabilityTypes || {});
		if (availableTypes.length > 0 && selected.length === availableTypes.length) return true;
		return null;
	});
	const tagSelectAllState = computed(() => {
		const selected = facetTags.value || [];
		if (selected.length === 0) return false;
		const allTags = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)];
		if (allTags.length > 0 && selected.length === allTags.length) return true;
		return null;
	});
	//全选/取消全选函数
	function toggleSeveritySelectAll(checked: boolean) {
		if (checked) {
			facetSeverities.value = severityOptions.value.map(opt => opt.value);
		} else {
			facetSeverities.value = [];
		}
		applyFacetFilters();
	}
	function toggleLanguageSelectAll(checked: boolean) {
		if (checked) {
			facetLanguages.value = languageOptions.value.map(opt => opt.value);
		} else {
			facetLanguages.value = [];
		}
		applyFacetFilters();
	}
	function getClusterCheckState(cluster: any) {
		const cwes = cluster.cwes || [];
		if (cwes.length === 0) return { checked: false, indeterminate: false };
		const selectedCwes = facetVulnerabilityTypes.value || [];
		const selectedCount = cwes.filter((cwe: string) => selectedCwes.includes(cwe)).length;
		if (selectedCount === 0) return { checked: false, indeterminate: false };
		if (selectedCount === cwes.length) return { checked: true, indeterminate: false };
		return { checked: false, indeterminate: true };
	}
	function toggleClusterSelectAll(cluster: any) {
		const cwes = cluster.cwes || [];
		const current = facetVulnerabilityTypes.value || [];
		const selectedCount = cwes.filter((cwe: string) => current.includes(cwe)).length;
		if (selectedCount === cwes.length) {
			facetVulnerabilityTypes.value = current.filter((cwe: string) => !cwes.includes(cwe));
		} else {
			const newSelection = [...new Set([...current, ...cwes])];
			facetVulnerabilityTypes.value = newSelection;
		}
		applyFacetFilters();
	}
	function getClusterDisplayCount(cluster: any): number {
		const cwes = cluster.cwes || [];
		let totalCount = 0;
		cwes.forEach((cwe: string) => {
			const count = facetStats.value?.vulnerabilityTypes?.[cwe] || 0;
			totalCount += Number(count);
		});
		return totalCount;
	}
	function toggleVulnTypeCollapse() {
		facetGroupCollapsed.vulnerabilityType = !facetGroupCollapsed.vulnerabilityType;
		autoCollapsedGroups.vulnerabilityType = false;
	}
	function toggleTagCollapse() {
		facetGroupCollapsed.tag = !facetGroupCollapsed.tag;
		autoCollapsedGroups.tag = false;
	}
	function toggleStatusSelectAll(checked: boolean) {
		if (checked) {
			facetStatuses.value = statusOptions.value.map(opt => opt.value);
		} else {
			facetStatuses.value = [];
		}
		applyFacetFilters();
	}
	function toggleVulnerabilityTypeSelectAll(checked: boolean) {
		console.log('[全选调试] toggleVulnerabilityTypeSelectAll, checked:', checked);
		if (checked) {
			facetVulnerabilityTypes.value = Object.keys(facetStats.value?.vulnerabilityTypes || {});
		} else {
			facetVulnerabilityTypes.value = [];
		}
		console.log('[全选调试] 设置后 facetVulnerabilityTypes.value:', facetVulnerabilityTypes.value);
		applyFacetFilters();
	}
	function toggleTagSelectAll(checked: boolean) {
		if (checked) {
			facetTags.value = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)];
		} else {
			facetTags.value = [];
		}
		applyFacetFilters();
	}
	const filteredSystemTags = computed(() => {
		if (!facetSearchKeywords.tag.trim()) return systemTags.value;
		const keyword = facetSearchKeywords.tag.toLowerCase();
		return systemTags.value.filter(tag => 
			tag.name.toLowerCase().includes(keyword) || 
			(tag.description && tag.description.toLowerCase().includes(keyword))
		);
	});
	const filteredUserTags = computed(() => {
		if (!facetSearchKeywords.tag.trim()) return userTags.value;
		const keyword = facetSearchKeywords.tag.toLowerCase();
		return userTags.value.filter(tag => 
			tag.name.toLowerCase().includes(keyword) || 
			(tag.description && tag.description.toLowerCase().includes(keyword))
		);
	});
	const displayedSystemTags = computed(() => {
		const filtered = filteredSystemTags.value;
		return facetShowAll.systemTag ? filtered : filtered.slice(0, 6);
	});
	const displayedUserTags = computed(() => {
		const filtered = filteredUserTags.value;
		return facetShowAll.userTag ? filtered : filtered.slice(0, 6);
	});
	//获取活动筛选（不包括全选状态）
	function getActiveSeverityFilters(): string[] | undefined {
		if (!facetSeverities.value || facetSeverities.value.length === 0) return [];
		if (severityOptions.value.length > 0 && facetSeverities.value.length === severityOptions.value.length) return undefined;
		return facetSeverities.value;
	}
	function getActiveLanguageFilters(): string[] | undefined {
		if (!facetLanguages.value || facetLanguages.value.length === 0) return [];
		if (languageOptions.value.length > 0 && facetLanguages.value.length === languageOptions.value.length) return undefined;
		return facetLanguages.value;
	}
	function getActiveStatusFilters(): string[] | undefined {
		if (!facetStatuses.value || facetStatuses.value.length === 0) return [];
		if (statusOptions.value.length > 0 && facetStatuses.value.length === statusOptions.value.length) return undefined;
		return facetStatuses.value;
	}
	function getActiveVulnerabilityTypeFilters(): string[] | undefined {
		const availableTypes = Object.keys(facetStats.value?.vulnerabilityTypes || {});
		if (!facetVulnerabilityTypes.value || facetVulnerabilityTypes.value.length === 0) {
			return availableTypes.length === 0 ? undefined : [];
		}
		if (availableTypes.length > 0 && facetVulnerabilityTypes.value.length === availableTypes.length) return undefined;
		return facetVulnerabilityTypes.value;
	}
	function getActiveTagFilters(): string[] | undefined {
		const allTags = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)];
		if (!facetTags.value || facetTags.value.length === 0) {
			return allTags.length === 0 ? undefined : [];
		}
		if (allTags.length > 0 && facetTags.value.length === allTags.length) return undefined;
		return facetTags.value;
	}
	//CVSS筛选相关
	const cvssSeverityBands = [
		{ label: '低危', value: 'low', range: [0, 3.9], color: '#52C41A' },
		{ label: '中危', value: 'medium', range: [4.0, 6.9], color: '#FA8C16' },
		{ label: '高危', value: 'high', range: [7.0, 8.9], color: '#F5222D' },
		{ label: '严重', value: 'critical', range: [9.0, 10.0], color: '#820014' },
	];
	const cvssMetricOptions = {
		attackVector: [
			{ label: '网络', value: 'N', description: '可从远程网络访问' },
			{ label: '相邻网络', value: 'A', description: '需要本地网络访问' },
			{ label: '本地', value: 'L', description: '需要本地访问' },
			{ label: '物理', value: 'P', description: '需要物理接触' },
		],
		attackComplexity: [
			{ label: '低', value: 'L', description: '无特殊条件' },
			{ label: '高', value: 'H', description: '需要特定条件' },
		],
		privilegesRequired: [
			{ label: '无', value: 'N', description: '无需权限' },
			{ label: '低', value: 'L', description: '需要基本权限' },
			{ label: '高', value: 'H', description: '需要管理员权限' },
		],
		userInteraction: [
			{ label: '无', value: 'N', description: '无需用户交互' },
			{ label: '需要', value: 'R', description: '需要用户操作' },
		],
		scope: [
			{ label: '不变', value: 'U', description: '影响范围不变' },
			{ label: '改变', value: 'C', description: '影响范围扩大' },
		],
		confidentiality: [
			{ label: '无', value: 'N', description: '无机密性影响' },
			{ label: '低', value: 'L', description: '部分信息泄露' },
			{ label: '高', value: 'H', description: '完全信息泄露' },
		],
		integrity: [
			{ label: '无', value: 'N', description: '无完整性影响' },
			{ label: '低', value: 'L', description: '部分数据可修改' },
			{ label: '高', value: 'H', description: '完全数据可修改' },
		],
		availability: [
			{ label: '无', value: 'N', description: '无可用性影响' },
			{ label: '低', value: 'L', description: '部分性能降低' },
			{ label: '高', value: 'H', description: '完全拒绝服务' },
		],
	};
	function getActiveCvssScoreRange(): [number, number] | undefined {
		if (facetCvssScoreBands.value.length === 0) {
			return [11, 11];
		}
		const allBands = cvssSeverityBands.map(b => b.value);
		const isAllSelected = allBands.every(band => facetCvssScoreBands.value.includes(band));
		if (isAllSelected && facetCvssScoreRange.value[0] === 0 && facetCvssScoreRange.value[1] === 10) {
			return undefined;
		}
		return facetCvssScoreRange.value;
	}
	function handleCvssBandChange() {
		if (facetCvssScoreBands.value.length > 0) {
			const selectedBands = cvssSeverityBands.filter(band => facetCvssScoreBands.value.includes(band.value));
			const minScore = Math.min(...selectedBands.map(b => b.range[0]));
			const maxScore = Math.max(...selectedBands.map(b => b.range[1]));
			facetCvssScoreRange.value = [minScore, maxScore];
		}
		applyFacetFilters();
	}
	function handleCvssSliderChange() {
		const [min, max] = facetCvssScoreRange.value;
		const selectedBands = cvssSeverityBands.filter(band => {
			return band.range[0] <= max && band.range[1] >= min;
		}).map(b => b.value);
		facetCvssScoreBands.value = selectedBands;
		applyFacetFilters();
	}
	//日期筛选相关
	const dateQuickButtons = [
		{ label: '今天', days: 0 },
		{ label: '最近7天', days: 7 },
		{ label: '最近30天', days: 30 },
		{ label: '最近90天', days: 90 },
	];
	function handleDateQuickSelect(days: number) {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		if (days === 0) {
			facetDateRange.value = [today.getTime(), now.getTime()];
		} else {
			const startDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
			facetDateRange.value = [startDate.getTime(), now.getTime()];
		}
		applyFacetFilters();
	}
	function clearDateFilter() {
		facetDateRange.value = null;
		applyFacetFilters();
	}
	function handleDateRangeChange() {
		applyFacetFilters();
	}
	function getActiveDateRange(): [number, number] | undefined {
		if (!facetDateRange.value) return undefined;
		return facetDateRange.value;
	}
	function getActiveCvssMetrics() {
		const metrics: any = {};
		if (facetCvssMetrics.attackVector.length === 0) {
			metrics.attackVector = [];
		} else if (facetCvssMetrics.attackVector.length < cvssMetricOptions.attackVector.length) {
			metrics.attackVector = facetCvssMetrics.attackVector;
		}
		if (facetCvssMetrics.attackComplexity.length === 0) {
			metrics.attackComplexity = [];
		} else if (facetCvssMetrics.attackComplexity.length < cvssMetricOptions.attackComplexity.length) {
			metrics.attackComplexity = facetCvssMetrics.attackComplexity;
		}
		if (facetCvssMetrics.privilegesRequired.length === 0) {
			metrics.privilegesRequired = [];
		} else if (facetCvssMetrics.privilegesRequired.length < cvssMetricOptions.privilegesRequired.length) {
			metrics.privilegesRequired = facetCvssMetrics.privilegesRequired;
		}
		if (facetCvssMetrics.userInteraction.length === 0) {
			metrics.userInteraction = [];
		} else if (facetCvssMetrics.userInteraction.length < cvssMetricOptions.userInteraction.length) {
			metrics.userInteraction = facetCvssMetrics.userInteraction;
		}
		if (facetCvssMetrics.scope.length === 0) {
			metrics.scope = [];
		} else if (facetCvssMetrics.scope.length < cvssMetricOptions.scope.length) {
			metrics.scope = facetCvssMetrics.scope;
		}
		if (facetCvssMetrics.confidentiality.length === 0) {
			metrics.confidentiality = [];
		} else if (facetCvssMetrics.confidentiality.length < cvssMetricOptions.confidentiality.length) {
			metrics.confidentiality = facetCvssMetrics.confidentiality;
		}
		if (facetCvssMetrics.integrity.length === 0) {
			metrics.integrity = [];
		} else if (facetCvssMetrics.integrity.length < cvssMetricOptions.integrity.length) {
			metrics.integrity = facetCvssMetrics.integrity;
		}
		if (facetCvssMetrics.availability.length === 0) {
			metrics.availability = [];
		} else if (facetCvssMetrics.availability.length < cvssMetricOptions.availability.length) {
			metrics.availability = facetCvssMetrics.availability;
		}
		return Object.keys(metrics).length > 0 ? metrics : undefined;
	}
	function initCvssMetricsToAll() {
		facetCvssMetrics.attackVector = cvssMetricOptions.attackVector.map(opt => opt.value);
		facetCvssMetrics.attackComplexity = cvssMetricOptions.attackComplexity.map(opt => opt.value);
		facetCvssMetrics.privilegesRequired = cvssMetricOptions.privilegesRequired.map(opt => opt.value);
		facetCvssMetrics.userInteraction = cvssMetricOptions.userInteraction.map(opt => opt.value);
		facetCvssMetrics.scope = cvssMetricOptions.scope.map(opt => opt.value);
		facetCvssMetrics.confidentiality = cvssMetricOptions.confidentiality.map(opt => opt.value);
		facetCvssMetrics.integrity = cvssMetricOptions.integrity.map(opt => opt.value);
		facetCvssMetrics.availability = cvssMetricOptions.availability.map(opt => opt.value);
	}
	function clearCvssMetrics() {
		facetCvssMetrics.attackVector = [];
		facetCvssMetrics.attackComplexity = [];
		facetCvssMetrics.privilegesRequired = [];
		facetCvssMetrics.userInteraction = [];
		facetCvssMetrics.scope = [];
		facetCvssMetrics.confidentiality = [];
		facetCvssMetrics.integrity = [];
		facetCvssMetrics.availability = [];
	}
	//应用分面筛选
	function applyFacetFilters() {
	const activeSeverities = getActiveSeverityFilters();
		const activeLanguages = getActiveLanguageFilters();
		const activeStatuses = getActiveStatusFilters();
		const activeVulnerabilityTypes = getActiveVulnerabilityTypeFilters();
	const activeTags = getActiveTagFilters();
	const activeCvssRange = getActiveCvssScoreRange();
	const activeCvssMetrics = getActiveCvssMetrics();
	const activeDateRange = getActiveDateRange();
		filterState.severities = activeSeverities;
		filterState.languages = activeLanguages;
		filterState.statuses = activeStatuses;
		filterState.vulnerabilityTypes = activeVulnerabilityTypes;
		filterState.tags = activeTags;
	filterState.cvssScoreMin = activeCvssRange ? activeCvssRange[0] : undefined;
	filterState.cvssScoreMax = activeCvssRange ? activeCvssRange[1] : undefined;
	filterState.cvssAttackVector = activeCvssMetrics?.attackVector;
	filterState.cvssAttackComplexity = activeCvssMetrics?.attackComplexity;
	filterState.cvssPrivilegesRequired = activeCvssMetrics?.privilegesRequired;
	filterState.cvssUserInteraction = activeCvssMetrics?.userInteraction;
	filterState.cvssScope = activeCvssMetrics?.scope;
	filterState.cvssConfidentiality = activeCvssMetrics?.confidentiality;
	filterState.cvssIntegrity = activeCvssMetrics?.integrity;
	filterState.cvssAvailability = activeCvssMetrics?.availability;
	filterState.createTimeStart = activeDateRange ? format(new Date(activeDateRange[0]), 'yyyy-MM-dd HH:mm:ss') : undefined;
	filterState.createTimeEnd = activeDateRange ? format(new Date(activeDateRange[1]), 'yyyy-MM-dd HH:mm:ss') : undefined;
		pagination.page = 1;
		fetchData();
	}
	//清除分面筛选
	function clearFacetFilters() {
		searchKeyword.value = '';
		if (severityOptions.value.length > 0) {
			facetSeverities.value = severityOptions.value.map(opt => opt.value);
		}
		if (languageOptions.value.length > 0) {
			facetLanguages.value = languageOptions.value.map(opt => opt.value);
		}
		if (statusOptions.value.length > 0) {
			facetStatuses.value = statusOptions.value.map(opt => opt.value);
		}
		const availableTypes = Object.keys(facetStats.value?.vulnerabilityTypes || {});
		if (availableTypes.length > 0) {
			facetVulnerabilityTypes.value = availableTypes;
		}
		const allTags = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)];
		if (allTags.length > 0) {
			facetTags.value = allTags;
		}
		facetCvssScoreRange.value = [0, 10];
		facetCvssScoreBands.value = ['low', 'medium', 'high', 'critical'];
		initCvssMetricsToAll();
		facetDateRange.value = null;
		applyFacetFilters();
	}
	//是否有活动筛选
	const hasActiveFilters = computed(() => {
		const severityFilters = getActiveSeverityFilters();
		const languageFilters = getActiveLanguageFilters();
		const statusFilters = getActiveStatusFilters();
		const vulnTypeFilters = getActiveVulnerabilityTypeFilters();
		const tagFilters = getActiveTagFilters();
		return searchKeyword.value.trim() !== '' ||
			(severityFilters && severityFilters.length > 0) ||
			(languageFilters && languageFilters.length > 0) ||
			(statusFilters && statusFilters.length > 0) ||
			(vulnTypeFilters && vulnTypeFilters.length > 0) ||
			(tagFilters && tagFilters.length > 0) ||
			getActiveCvssScoreRange() !== undefined ||
			getActiveCvssMetrics() !== undefined ||
			getActiveDateRange() !== undefined;
	});
	//监听创建表单值变化
	watch(() => createFormValue.value, () => {
		// 【修改点】如果是初始化阶段，直接通过，不触发校验逻辑
		if (isInit.value) return;
		
		updateCreateFormValidation();
	}, { deep: true });
	async function loadCurrentUserInfo() {
		try {
			const res: any = await getUserInfo();
			if (res && res.data && res.data.user) {
				currentUserId.value = Number(res.data.user.userId) || null;
			}
		} catch (error) {
			console.error("获取用户信息失败:", error);
		}
	}
	
	onMounted(async () => {
		checkMobile();
		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', handleKeydown);
		
		try {
			filterDataLoading.value = true;
			await loadCurrentUserInfo();
			await loadTagData();
			if (route.query.kid) {
				filterState.kid = route.query.kid as string;
				await loadKnowledgeBaseName();
			}
			await Promise.all([
				loadCweReferenceData(),
				loadDictData(),
				loadKnowledgeBaseOptions(),
			]);
			initCvssMetricsToAll();
			filterDataLoading.value = false;
			
			await fetchData();
		} finally {
			initialLoading.value = false;
		}
	});
	onUnmounted(() => {
		window.removeEventListener('resize', handleResize);
		window.removeEventListener('keydown', handleKeydown);
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
					<div class="loading-tips">正在加载知识条目</div>
				</div>
			</div>
			<div v-else class="knowledge-item-page-layout">
				<!-- 左侧主内容区 -->
				<div class="main-content-area" :class="{ 'has-detail': selectedItemUuid && !isMobile }">
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
									<span v-if="knowledgeBaseName">{{ knowledgeBaseName }} - </span>
									知识条目
								</h2>
							</n-space>
						</div>
						<div class="toolbar-right">
							<n-space :size="12">
								<n-button @click="handleOpenExportDialog" quaternary>
									<template #icon>
										<SvgIcon icon="ri:download-line" />
									</template>
									导出
								</n-button>
								<n-button @click="handleCreate" type="primary">创建知识条目</n-button>
							</n-space>
						</div>
					</div>
		
					<!-- 可滚动内容区域（包含筛选和列表） -->
					<div class="scrollable-content">
						<!-- 搜索和筛选栏 -->
						<div class="filter-section">
						<!-- 搜索框（始终可见） -->
						<div class="filter-search-row">
								<n-input
									v-model:value="searchKeyword"
									placeholder="搜索标题、摘要、问题描述、修复方案..."
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
						<!-- 筛选选项组（每个可单独折叠） -->
						<div v-if="filterDataLoading" class="facet-filters-row">
							<div v-for="i in 5" :key="i" class="facet-group-skeleton">
								<n-skeleton height="40px" :sharp="false" />
							</div>
						</div>
						<div v-else class="facet-filters-row">
							<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.severity }">
								<div class="facet-group-header" @click="facetGroupCollapsed.severity = !facetGroupCollapsed.severity">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.severity ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">风险等级</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.severity" class="facet-group-content">
									<div style="padding-bottom: 8px; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
										<n-checkbox 
											:checked="severitySelectAllState === true"
											:indeterminate="severitySelectAllState === null"
											@update:checked="toggleSeveritySelectAll"
											size="small"
										>
											<span style="font-weight: 500; color: #262626;">全选</span>
										</n-checkbox>
									</div>
									<n-checkbox-group v-model:value="facetSeverities" @update:value="(val) => { console.log('[组变化] facetSeverities更新为:', val); applyFacetFilters(); }">
										<n-space :size="8" wrap>
											<n-checkbox
												v-for="option in severityOptions"
												:key="option.value"
												:value="option.value"
												size="small"
											>
												<span class="facet-option-label">{{ option.label }}</span>
												<span class="facet-option-count">{{ facetStats?.severities?.[option.value] || 0 }}</span>
											</n-checkbox>
										</n-space>
									</n-checkbox-group>
								</div>
							</div>
							<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.language }">
								<div class="facet-group-header" @click="facetGroupCollapsed.language = !facetGroupCollapsed.language">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.language ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">语言</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.language" class="facet-group-content">
									<div style="padding-bottom: 8px; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
										<n-checkbox 
											:checked="languageSelectAllState === true"
											:indeterminate="languageSelectAllState === null"
											@update:checked="toggleLanguageSelectAll"
											size="small"
										>
											<span style="font-weight: 500; color: #262626;">全选</span>
										</n-checkbox>
									</div>
									<n-checkbox-group v-model:value="facetLanguages" @update:value="applyFacetFilters">
										<n-space :size="8" wrap>
											<n-checkbox
												v-for="option in languageOptions"
												:key="option.value"
												:value="option.value"
												size="small"
											>
												<span class="facet-option-label">{{ option.label }}</span>
												<span class="facet-option-count">{{ facetStats?.languages?.[option.value] || 0 }}</span>
											</n-checkbox>
										</n-space>
									</n-checkbox-group>
								</div>
							</div>
							<div class="facet-group" :class="{ 'facet-group-expanded': !facetGroupCollapsed.status }">
								<div class="facet-group-header" @click="facetGroupCollapsed.status = !facetGroupCollapsed.status">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.status ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">状态</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.status" class="facet-group-content">
									<div style="padding-bottom: 8px; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
										<n-checkbox 
											:checked="statusSelectAllState === true"
											:indeterminate="statusSelectAllState === null"
											@update:checked="toggleStatusSelectAll"
											size="small"
										>
											<span style="font-weight: 500; color: #262626;">全选</span>
										</n-checkbox>
									</div>
									<n-checkbox-group v-model:value="facetStatuses" @update:value="(val) => { console.log('[组变化] facetStatuses更新为:', val); applyFacetFilters(); }">
										<n-space :size="8" wrap>
											<n-checkbox
												v-for="option in statusOptions"
												:key="option.value"
												:value="option.value"
												size="small"
											>
												<span class="facet-option-label">{{ option.label }}</span>
												<span class="facet-option-count">{{ facetStats?.statuses?.[option.value] || 0 }}</span>
											</n-checkbox>
										</n-space>
									</n-checkbox-group>
								</div>
							</div>
							<!-- 高级筛选容器 -->
							<div class="facet-group-advanced" v-if="groupedByClusters.length > 0 || systemTags.length > 0 || userTags.length > 0">
								<div class="facet-group-advanced-header" @click="facetGroupCollapsed.advanced = !facetGroupCollapsed.advanced">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.advanced ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label-advanced">高级筛选</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.advanced" class="facet-group-advanced-content">
							<div class="facet-group facet-group-nested facet-group-vuln-type" :class="{ 'facet-group-expanded': !facetGroupCollapsed.vulnerabilityType }" v-if="groupedByClusters.length > 0">
								<div class="facet-group-header" @click="toggleVulnTypeCollapse">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.vulnerabilityType ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">漏洞类型</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.vulnerabilityType" class="facet-nested-body">
									<div class="facet-group-toolbar">
										<n-input 
											v-model:value="facetSearchKeywords.vulnerabilityType" 
											placeholder="搜索漏洞类型..." 
											size="small" 
											clearable
										>
											<template #prefix>
												<SvgIcon icon="ri:search-line" />
											</template>
										</n-input>
										<n-space :size="6" justify="space-between" style="margin-top: 8px;">
											<n-button 
												text 
												size="tiny"
												@click="expandedVulnClusters = groupedByClusters.map(c => `${c.clusterId}-${c.clusterMethod}`)"
											>
												<template #icon>
													<SvgIcon icon="ri:arrow-down-s-line" />
												</template>
												全部展开
											</n-button>
											<n-button 
												text 
												size="tiny"
												@click="expandedVulnClusters = []"
											>
												<template #icon>
													<SvgIcon icon="ri:arrow-up-s-line" />
												</template>
												全部收起
											</n-button>
										</n-space>
									</div>
									<div style="padding: 8px 0; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
										<n-checkbox 
											:checked="vulnerabilityTypeSelectAllState === true"
											:indeterminate="vulnerabilityTypeSelectAllState === null"
											@update:checked="toggleVulnerabilityTypeSelectAll"
											size="small"
										>
											<span style="font-weight: 500; color: #262626;">全选</span>
										</n-checkbox>
									</div>
									<div class="facet-group-content">
									<div class="vuln-type-by-cluster">
										<n-collapse v-model:expanded-names="expandedVulnClusters">
											<n-collapse-item
												v-for="cluster in groupedByClusters"
												:key="`${cluster.clusterId}-${cluster.clusterMethod}`"
												:name="`${cluster.clusterId}-${cluster.clusterMethod}`"
											>
												<template #header>
													<div class="cluster-header">
														<n-checkbox
															:checked="getClusterCheckState(cluster).checked"
															:indeterminate="getClusterCheckState(cluster).indeterminate"
															size="small"
															@click.stop="toggleClusterSelectAll(cluster)"
														/>
														<span class="cluster-name">{{ cluster.clusterNameZh || cluster.clusterNameEn || '未命名分组' }}</span>
														<n-tag size="tiny" :bordered="false" style="padding: 0 6px; font-size: 11px;">{{ getClusterDisplayCount(cluster) }}</n-tag>
													</div>
												</template>
												<n-checkbox-group v-model:value="facetVulnerabilityTypes" @update:value="applyFacetFilters">
													<n-space :size="4" wrap style="padding: 2px 0;">
														<n-checkbox
															v-for="type in cluster.cwes"
															:key="type"
											:value="type"
											size="small"
										>
											<span class="facet-option-label" style="font-size: 12px;">{{ getCweDisplayName(type) }}</span>
											<span class="facet-option-count" style="font-size: 11px;">{{ facetStats?.vulnerabilityTypes?.[type] || 0 }}</span>
										</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</n-collapse-item>
										</n-collapse>
									</div>
									</div>
								</div>
							</div>
							<div class="facet-group facet-group-nested" :class="{ 'facet-group-expanded': !facetGroupCollapsed.tag }" v-if="systemTags.length > 0 || userTags.length > 0">
								<div class="facet-group-header" @click="toggleTagCollapse">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.tag ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">标签</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.tag" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
									<div class="facet-group-toolbar">
										<n-input 
											v-model:value="facetSearchKeywords.tag" 
											placeholder="搜索标签..." 
											size="small" 
											clearable
										>
											<template #prefix>
												<SvgIcon icon="ri:search-line" />
											</template>
										</n-input>
									</div>
									<div style="padding: 8px 0; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
										<n-checkbox 
											:checked="tagSelectAllState === true"
											:indeterminate="tagSelectAllState === null"
											@update:checked="toggleTagSelectAll"
											size="small"
										>
											<span style="font-weight: 500; color: #262626;">全选</span>
										</n-checkbox>
									</div>
									<div class="facet-group-content">
									<n-checkbox-group v-model:value="facetTags" @update:value="applyFacetFilters">
										<div v-if="filteredSystemTags.length > 0" style="margin-bottom: 12px;">
											<div class="tag-group-title">
												<SvgIcon icon="ri:shield-check-line" style="color: #52C41A; margin-right: 4px;" />
												预设标签
											</div>
											<n-space :size="8" wrap style="margin-top: 6px;">
												<n-checkbox
													v-for="tag in displayedSystemTags"
													:key="tag.name"
													:value="tag.name"
													size="small"
												>
													<span class="facet-option-label">{{ tag.name }}</span>
													<span class="facet-option-count">{{ facetStats?.tags?.[tag.name] || 0 }}</span>
												</n-checkbox>
											</n-space>
											<n-button 
												v-if="filteredSystemTags.length > 6"
												text 
												size="small" 
												@click="facetShowAll.systemTag = !facetShowAll.systemTag"
												style="margin-top: 6px; width: 100%;"
											>
												{{ facetShowAll.systemTag ? '收起' : `显示更多 (${filteredSystemTags.length - 6})` }}
												<template #icon>
													<SvgIcon :icon="facetShowAll.systemTag ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" />
												</template>
											</n-button>
										</div>
										<div v-if="filteredUserTags.length > 0">
											<div class="tag-group-title">
												<SvgIcon icon="ri:user-line" style="color: #52C41A; margin-right: 4px;" />
												自定义标签
											</div>
											<n-space :size="8" wrap style="margin-top: 6px;">
												<n-checkbox
													v-for="tag in displayedUserTags"
													:key="tag.name"
													:value="tag.name"
													size="small"
												>
													<span class="facet-option-label">{{ tag.name }}</span>
													<span class="facet-option-count">{{ facetStats?.tags?.[tag.name] || 0 }}</span>
												</n-checkbox>
											</n-space>
											<n-button 
												v-if="filteredUserTags.length > 6"
												text 
												size="small" 
												@click="facetShowAll.userTag = !facetShowAll.userTag"
												style="margin-top: 6px; width: 100%;"
											>
												{{ facetShowAll.userTag ? '收起' : `显示更多 (${filteredUserTags.length - 6})` }}
												<template #icon>
													<SvgIcon :icon="facetShowAll.userTag ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" />
												</template>
											</n-button>
										</div>
									</n-checkbox-group>
									</div>
								</div>
							</div>
							<div class="facet-group facet-group-nested" :class="{ 'facet-group-expanded': !facetGroupCollapsed.cvss }" v-if="true">
								<div class="facet-group-header" @click="facetGroupCollapsed.cvss = !facetGroupCollapsed.cvss">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.cvss ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">CVSS分数：</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.cvss" class="facet-nested-body">
									<div class="cvss-slider-container">
										<n-slider 
											v-model:value="facetCvssScoreRange" 
											:step="0.1"
											:min="0"
											:max="10"
											range
											:marks="{ 0: '0.0', 3.9: '3.9', 6.9: '6.9', 8.9: '8.9', 10: '10.0' }"
											:format-tooltip="(value: number) => value.toFixed(1)"
											@update:value="handleCvssSliderChange"
											style="margin: 20px 0 35px 0;"
										/>
										<div class="cvss-range-display">
											<span>{{ facetCvssScoreRange[0].toFixed(1) }}</span>
											<span style="margin: 0 8px;">-</span>
											<span>{{ facetCvssScoreRange[1].toFixed(1) }}</span>
										</div>
									</div>
									<div class="cvss-bands-container">
										<n-checkbox-group v-model:value="facetCvssScoreBands" @update:value="handleCvssBandChange">
											<n-space :size="8" wrap>
												<n-checkbox
													v-for="band in cvssSeverityBands"
													:key="band.value"
													:value="band.value"
													size="small"
												>
													<span class="facet-option-label">{{ band.label }}</span>
													<span class="cvss-band-range">({{ band.range[0] }}-{{ band.range[1] }})</span>
													<span class="facet-option-count">{{ cvssBandStats[band.value] || 0 }}</span>
												</n-checkbox>
											</n-space>
										</n-checkbox-group>
									</div>
									<div class="cvss-metrics-container">
										<div class="cvss-metrics-header" @click="facetGroupCollapsed.cvssMetrics = !facetGroupCollapsed.cvssMetrics">
											<n-space align="center" :size="8" style="cursor: pointer;">
												<SvgIcon :icon="facetGroupCollapsed.cvssMetrics ? 'ri:arrow-right-s-line' : 'ri:arrow-down-s-line'" />
												<span class="cvss-metrics-title">详细指标筛选</span>
												<n-button 
													v-if="getActiveCvssMetrics() !== undefined"
													text
													size="tiny"
													@click.stop="clearCvssMetrics"
													style="margin-left: 8px;"
												>
													清除
												</n-button>
											</n-space>
										</div>
										<div v-show="!facetGroupCollapsed.cvssMetrics" class="cvss-metrics-content">
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>攻击方式 (AV)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">攻击者需要通过何种方式访问目标系统</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.attackVector" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.attackVector"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span class="facet-option-label">{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
															<span class="facet-option-count">{{ facetStats?.cvssAttackVector?.[opt.value] || 0 }}</span>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>利用复杂度 (AC)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">成功利用漏洞所需的条件复杂程度</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.attackComplexity" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.attackComplexity"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span class="facet-option-label">{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
															<span class="facet-option-count">{{ facetStats?.cvssAttackComplexity?.[opt.value] || 0 }}</span>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>权限需求 (PR)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">攻击者需要具备的权限级别</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.privilegesRequired" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.privilegesRequired"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span class="facet-option-label">{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
															<span class="facet-option-count">{{ facetStats?.cvssPrivilegesRequired?.[opt.value] || 0 }}</span>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>用户交互 (UI)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">是否需要用户参与才能利用</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.userInteraction" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.userInteraction"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span class="facet-option-label">{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
															<span class="facet-option-count">{{ facetStats?.cvssUserInteraction?.[opt.value] || 0 }}</span>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>影响范围 (S)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">漏洞影响是否超出组件边界</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.scope" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.scope"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span>{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>机密性影响 (C)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">对数据保密性的影响程度</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.confidentiality" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.confidentiality"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span>{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>完整性影响 (I)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">对数据完整性的影响程度</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.integrity" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.integrity"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span class="facet-option-label">{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
															<span class="facet-option-count">{{ facetStats?.cvssIntegrity?.[opt.value] || 0 }}</span>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
											<div class="cvss-metric-item">
												<div class="cvss-metric-label">
													<span>可用性影响 (A)</span>
													<n-popover trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="ri:question-line" style="color: #999; font-size: 14px; cursor: help;" />
														</template>
														<div style="max-width: 200px;">对系统可用性的影响程度</div>
													</n-popover>
												</div>
												<n-checkbox-group v-model:value="facetCvssMetrics.availability" @update:value="applyFacetFilters">
													<n-space :size="6" wrap>
														<n-checkbox
															v-for="opt in cvssMetricOptions.availability"
															:key="opt.value"
															:value="opt.value"
															size="small"
														>
															<n-popover trigger="hover" placement="top">
																<template #trigger>
																	<span class="facet-option-label">{{ opt.label }}</span>
																</template>
																{{ opt.description }}
															</n-popover>
															<span class="facet-option-count">{{ facetStats?.cvssAvailability?.[opt.value] || 0 }}</span>
														</n-checkbox>
													</n-space>
												</n-checkbox-group>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="facet-group facet-group-nested" :class="{ 'facet-group-expanded': !facetGroupCollapsed.date }" v-if="true">
								<div class="facet-group-header" @click="facetGroupCollapsed.date = !facetGroupCollapsed.date">
									<n-space align="center" :size="8">
										<SvgIcon :icon="facetGroupCollapsed.date ? 'ri:arrow-down-s-line' : 'ri:arrow-up-s-line'" style="cursor: pointer;" />
										<span class="facet-label">创建时间：</span>
									</n-space>
								</div>
								<div v-show="!facetGroupCollapsed.date" class="facet-nested-body">
									<div class="date-filter-container">
										<div class="date-range-picker-row">
											<n-date-picker
												v-model:value="facetDateRange"
												type="datetimerange"
												size="small"
												placeholder="选择时间范围"
												clearable
												@update:value="handleDateRangeChange"
												style="width: 100%;"
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
										<div class="date-quick-buttons">
											<n-space :size="6" wrap>
												<n-button
													v-for="btn in dateQuickButtons"
													:key="btn.days"
													size="tiny"
													quaternary
													@click="handleDateQuickSelect(btn.days)"
												>
													{{ btn.label }}
													<span class="date-quick-count">({{ dateQuickStats[btn.days] || 0 }})</span>
												</n-button>
												<n-button
													v-if="facetDateRange"
													size="tiny"
													quaternary
													type="error"
													@click="clearDateFilter"
													style="margin-left: 4px;"
												>
													<template #icon>
														<SvgIcon icon="ri:close-line" />
													</template>
													清除
												</n-button>
											</n-space>
										</div>
									</div>
								</div>
							</div>
								</div>
							</div>
						</div>
					</div>
					
					<!-- 活动筛选条 -->
					
					<!-- 列表内容 -->
					<div class="list-content-area">
								<div v-if="loading || initialLoading" class="list-skeleton">
									<div v-for="i in 8" :key="i" class="list-skeleton-item">
										<n-skeleton height="24px" width="60%" style="margin-bottom: 8px;" />
										<n-skeleton text :repeat="2" />
										<n-skeleton height="20px" width="40%" style="margin-top: 8px;" />
									</div>
								</div>
								<div v-else-if="tableData.length > 0" class="list-container">
									<!-- 全选复选框 -->
									<div class="list-select-all-bar">
										<n-checkbox
											:checked="isAllSelected"
											:indeterminate="isIndeterminate"
											@update:checked="toggleSelectAll"
											size="small"
										>
											<span style="font-size: 13px; color: #666;">全选当前页</span>
										</n-checkbox>
										<div v-if="selectedItems.size === 0" class="multi-select-hint">
											<SvgIcon icon="ri:information-line" style="font-size: 14px; color: #999; margin-right: 4px;" />
											<span>勾选左侧复选框可批量操作和导出</span>
										</div>
									</div>
									<!-- 选择状态栏 -->
									<div v-if="selectedItems.size > 0" class="selection-bar">
										<div class="selection-bar-left">
											<span class="selection-count">
												已选择 {{ selectedItems.size }} 条
												<span v-if="pagination.itemCount > 0" class="total-hint">
													/ {{ pagination.itemCount }}
												</span>
												<span v-if="isCrossPageSelection" class="cross-page-hint">
													（跨 {{ selectedPageCount }} 页）
												</span>
											</span>
										</div>
										<div class="selection-bar-center">
											<n-dropdown
												trigger="click"
												:options="bulkSelectionOptions"
												@select="handleBulkSelectionSelect"
											>
												<n-button size="small" style="margin-left: 12px;">
													<template #icon>
														<SvgIcon icon="ri:checkbox-multiple-line" />
													</template>
													选择选项
													<SvgIcon icon="ri:arrow-down-s-line" style="margin-left: 4px;" />
												</n-button>
											</n-dropdown>
											<n-button 
												v-if="!isAllFilteredItemsSelected && selectedItems.size > 0"
												size="small" 
												@click="handleInvertSelection"
											>
												反选
											</n-button>
										</div>
										<div class="selection-bar-right">
											<n-space :size="8">
												<n-button
													type="error"
													size="small"
													@click="handleBatchDelete"
												>
													<template #icon>
														<SvgIcon icon="ri:delete-bin-line" />
													</template>
													批量删除
												</n-button>
												<n-dropdown
													trigger="click"
													:options="batchEditOptions"
													@select="handleBatchEditSelect"
												>
													<n-button
														type="primary"
														size="small"
													>
														<template #icon>
															<SvgIcon icon="ri:edit-line" />
														</template>
														批量编辑
													</n-button>
												</n-dropdown>
												<n-button
													type="primary"
													size="small"
													@click="handleBatchExport"
												>
													<template #icon>
														<SvgIcon icon="ri:download-line" />
													</template>
													批量导出
												</n-button>
											</n-space>
										</div>
									</div>
									<n-list hoverable clickable>
										<n-list-item
											v-for="item in tableData"
											:key="item.itemUuid"
											:class="{ 
												'list-item-selected': selectedItemUuid === item.itemUuid,
												'list-item-checked': selectedItems.has(item.itemUuid)
											}"
											@click="(e: MouseEvent) => {
												const target = e.target as HTMLElement;
												if (target.closest('.item-checkbox') || target.closest('.n-checkbox')) {
													return;
												}
												openDetailPanel(item);
											}"
										>
											<n-thing>
												<template #header>
													<div class="list-item-header">
														<n-checkbox
															:checked="selectedItems.has(item.itemUuid)"
															@update:checked="(checked: boolean) => toggleItemSelection(item.itemUuid, checked)"
															@click.stop
															size="small"
															class="item-checkbox"
														/>
														<div class="severity-indicator" :style="{ backgroundColor: getDictColor(severityOptions, item.severity, '#808080') }"></div>
														<span class="list-item-title" v-html="searchKeyword.trim() ? highlightText(item.title || '-', extractKeywords(searchKeyword)) : (item.title || '-')"></span>
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
																<template v-if="getItemCvssScoreDisplay(item)">
																	<span class="risk-badge cvss-badge" :style="{ 
																		backgroundColor: getDictColor(severityOptions, getItemSeverityForDisplay(item), '#808080'),
																		color: '#fff'
																	}">
																		CVSS {{ getItemCvssScoreDisplay(item) }} {{ getDictLabel(severityOptions, getItemSeverityForDisplay(item)) }}
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
														<div class="meta-time-row">
															<span class="time-item time-create">
																<SvgIcon icon="ri:add-circle-line" class="time-icon" />
																<span class="time-label">创建于</span>
																<span class="time-value">{{ formatTimeAgo(item.createTime) }}</span>
															</span>
															<span v-if="item.updateTime && item.updateTime !== item.createTime" class="time-item time-update">
																<SvgIcon icon="ri:edit-circle-line" class="time-icon time-icon-update" />
																<span class="time-label">更新于</span>
																<span class="time-value">{{ formatTimeAgo(item.updateTime) }}</span>
															</span>
															<n-button
																text
																size="small"
																@click.stop="handleViewFragments(item)"
																style="margin-left: 8px; color: #1890ff;"
															>
																<template #icon>
																	<SvgIcon icon="ri:file-list-line" />
																</template>
																查看片段
															</n-button>
														</div>
													</div>
												</div>
											</template>
										</n-thing>
									</n-list-item>
								</n-list>
								</div>
								<n-empty v-else description="暂无数据" />
								
								<!-- 分页 -->
								<div class="list-pagination">
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
			
			<!-- 右侧详情面板（整个页面右侧） -->
				<div v-if="selectedItemUuid && !isMobile" class="detail-panel-area" :class="{ 'detail-panel-visible': selectedItemUuid }">
					<!-- 顶部操作栏 -->
					<div class="detail-actions-header">
						<n-space justify="space-between" align="center">
							<n-button quaternary @click="closeDetailPanel" size="small">
								<template #icon>
									<SvgIcon icon="ri:close-line" />
								</template>
								收起详情
							</n-button>
							<n-space :size="8">
								<n-button v-if="detailItem?.itemUuid" @click="handleViewFragments(detailItem)" type="info" size="small">
									<template #icon>
										<SvgIcon icon="ri:file-list-line" />
									</template>
									查看片段
								</n-button>
								<n-button v-if="canEditItem(detailItem)" @click="handleEdit(detailItem)" type="info" size="small">编辑</n-button>
								<n-button v-if="canEditItem(detailItem)" @click="handleDelete(detailItem)" type="error" size="small">删除</n-button>
							</n-space>
						</n-space>
					</div>
					<div class="detail-panel">
						<n-skeleton v-if="detailLoading" :rows="10" />
						<template v-else-if="detailItem">
									<!-- 详情内容：文档化展示 -->
									<div class="detail-document">
										<!-- 头部Hero区域 -->
										<div class="detail-hero">
											<h1 class="detail-title">{{ detailItem.title }}</h1>
											<div class="detail-meta-tags">
												<n-space :size="8" wrap>
													<template v-if="detailItem.vulnerabilityTypes && detailItem.vulnerabilityTypes.length > 0">
														<n-tag
															v-for="cweId in detailItem.vulnerabilityTypes"
															:key="cweId"
															size="small"
															bordered
															:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
														>
															{{ getCweDisplayName(cweId) }}
														</n-tag>
													</template>
													<template v-if="detailItem.language">
														<n-tag size="small" bordered :style="{ backgroundColor: '#F0F0F0', color: '#707070' }">
															{{ languageOptions.find((opt: any) => opt.value === detailItem.language)?.label || detailItem.language }}
														</n-tag>
													</template>
													<template v-if="detailItem.severity">
														<n-tag
															:style="{
																backgroundColor: getDictColor(severityOptions, detailItem.severity, '#808080'),
																color: '#FFFFFF'
															}"
														>
															{{ getDictLabel(severityOptions, detailItem.severity) }}
														</n-tag>
													</template>
													<template v-if="detailItem.status">
														<n-tag
															:style="{
																backgroundColor: getDictColor(statusOptions, detailItem.status, '#808080'),
																color: '#FFFFFF'
															}"
														>
															{{ getDictLabel(statusOptions, detailItem.status) }}
														</n-tag>
													</template>
												</n-space>
											</div>
										</div>
										
										<!-- 风险评分区域（可视化） -->
										<div v-if="detailItem.cvssScore !== undefined || detailItem.cvssVector" class="detail-risk-section">
											<RiskScoreCard :score="detailItem.cvssScore" />
											<div v-if="detailItem.cvssVector && parseCvssVector(detailItem.cvssVector)" class="cvss-vector-details">
												<h3 class="cvss-details-title">CVSS 指标详情</h3>
												<div class="cvss-details-grid">
													<div v-if="parseCvssVector(detailItem.cvssVector)?.av" class="cvss-detail-item">
														<span class="cvss-detail-label">攻击方式</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('av', parseCvssVector(detailItem.cvssVector)!.av!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.ac" class="cvss-detail-item">
														<span class="cvss-detail-label">利用复杂度</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('ac', parseCvssVector(detailItem.cvssVector)!.ac!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.pr" class="cvss-detail-item">
														<span class="cvss-detail-label">权限需求</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('pr', parseCvssVector(detailItem.cvssVector)!.pr!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.ui" class="cvss-detail-item">
														<span class="cvss-detail-label">用户交互</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('ui', parseCvssVector(detailItem.cvssVector)!.ui!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.vc" class="cvss-detail-item">
														<span class="cvss-detail-label">机密性影响</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('vc', parseCvssVector(detailItem.cvssVector)!.vc!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.vi" class="cvss-detail-item">
														<span class="cvss-detail-label">完整性影响</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('vi', parseCvssVector(detailItem.cvssVector)!.vi!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.va" class="cvss-detail-item">
														<span class="cvss-detail-label">可用性影响</span>
														<span class="cvss-detail-value">{{ getCvssComponentLabel('va', parseCvssVector(detailItem.cvssVector)!.va!) }}</span>
													</div>
												</div>
											</div>
										</div>
										
										<!-- 摘要 -->
										<div v-if="detailItem.summary" class="detail-section">
											<h2 class="detail-section-title">摘要</h2>
											<p class="detail-text">{{ detailItem.summary }}</p>
										</div>
										
										<!-- 问题描述 -->
										<div v-if="detailItem.problemDescription" class="detail-section">
											<h2 class="detail-section-title">问题描述</h2>
											<div class="detail-text markdown-content" v-html="detailItem.problemDescription.replace(/\n/g, '<br>')"></div>
										</div>
										
										<!-- 修复方案 -->
										<div v-if="detailItem.fixSolution" class="detail-section">
											<h2 class="detail-section-title">修复方案</h2>
											<div class="detail-text markdown-content" v-html="detailItem.fixSolution.replace(/\n/g, '<br>')"></div>
										</div>
										
										<!-- 示例代码（视觉中心） -->
										<div v-if="detailItem.exampleCode" class="detail-section detail-code-section">
											<h2 class="detail-section-title">示例代码</h2>
											<div class="code-display-wrapper">
												<div class="code-toolbar">
													<span class="code-label">代码</span>
													<n-button
														text
														size="small"
														@click="() => handleCopyCode(detailItem.exampleCode || '')"
													>
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
													:max-height="600"
												/>
											</div>
										</div>
										
										<!-- 标签 -->
										<div v-if="detailItem.tags && detailItem.tags.length > 0" class="detail-section">
											<h2 class="detail-section-title">标签</h2>
											<div class="detail-tags-container">
												<n-space :size="8" wrap>
													<n-tag
														v-for="tagName in detailItem.tags"
														:key="tagName"
														size="small"
														bordered
														:style="{ backgroundColor: '#F6FFED', color: '#52C41A' }"
													>
														{{ tagName }}
													</n-tag>
												</n-space>
											</div>
										</div>
										
										<!-- 元信息 -->
										<div class="detail-section detail-meta-section">
											<h2 class="detail-section-title">元信息</h2>
											<div class="meta-grid">
												<div v-if="detailItem.createTime" class="meta-item">
													<span class="meta-label">创建时间：</span>
													<span class="meta-value">{{ format(new Date(detailItem.createTime), 'yyyy-MM-dd HH:mm') }}</span>
												</div>
												<div v-if="detailItem.updateTime" class="meta-item">
													<span class="meta-label">更新时间：</span>
													<span class="meta-value">{{ format(new Date(detailItem.updateTime), 'yyyy-MM-dd HH:mm') }}</span>
												</div>
											</div>
										</div>
									</div>
						</template>
						<n-empty v-else description="加载中..." />
					</div>
				</div>
				
				<!-- 移动端：列表视图（点击后全屏详情） -->
				<div v-if="isMobile" class="mobile-list-view">
					<n-list v-if="!loading && tableData.length > 0" hoverable clickable>
						<n-list-item
							v-for="item in tableData"
							:key="item.itemUuid"
							@click="openDetailPanel(item)"
						>
							<n-thing>
								<template #header>
									<div class="list-item-header">
										<div class="severity-indicator" :style="{ backgroundColor: getDictColor(severityOptions, item.severity, '#808080') }"></div>
										<span class="list-item-title">{{ item.title || '-' }}</span>
									</div>
								</template>
								<template #description>
													<div class="list-item-meta">
														<div class="meta-mobile-main">
															<div class="meta-mobile-left">
																<template v-if="getItemCvssScoreDisplay(item)">
																	<span class="risk-badge-mobile cvss-badge-mobile" :style="{ 
																		backgroundColor: getDictColor(severityOptions, getItemSeverityForDisplay(item), '#808080'),
																		color: '#fff'
																	}">
																		CVSS {{ getItemCvssScoreDisplay(item) }} {{ getDictLabel(severityOptions, getItemSeverityForDisplay(item)) }}
																	</span>
																</template>
																<template v-if="item.severity">
																	<span class="severity-badge-mobile manual-badge-mobile" :style="{ 
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
																		bordered
																		:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
																	>
																		{{ getCweDisplayName(cweId) }}
																	</n-tag>
																	<n-tag
																		v-if="item.vulnerabilityTypes.length > 2"
																		size="small"
																		bordered
																		:style="{ backgroundColor: '#E0E0E0', color: '#606060' }"
																	>
																		+{{ item.vulnerabilityTypes.length - 2 }}
																	</n-tag>
																</template>
																<template v-if="item.language">
																	<n-tag size="small" bordered :style="{ backgroundColor: '#F0F0F0', color: '#707070' }">
																		{{ getDictLabel(languageOptions, item.language) }}
																	</n-tag>
																</template>
															</div>
															<div v-if="item.tags && item.tags.length > 0" class="meta-mobile-right">
																<n-tag
																	v-for="tag in item.tags.slice(0, 2)"
																	:key="tag"
																	size="small"
																	bordered
																	:style="{ backgroundColor: '#F6FFED', color: '#52C41A' }"
																>
																	{{ tag }}
																</n-tag>
																<n-tag
																	v-if="item.tags.length > 2"
																	size="small"
																	bordered
																	:style="{ backgroundColor: '#F6FFED', color: '#52C41A' }"
																>
																	+{{ item.tags.length - 2 }}
																</n-tag>
															</div>
														</div>
														<div class="meta-time-row-mobile">
															<span class="time-item-mobile time-create">
																<SvgIcon icon="ri:add-circle-line" class="time-icon-mobile" />
																<span class="time-label-mobile">创建</span>
																<span class="time-value-mobile">{{ formatTimeAgo(item.createTime) }}</span>
															</span>
															<span v-if="item.updateTime && item.updateTime !== item.createTime" class="time-item-mobile time-update">
																<SvgIcon icon="ri:edit-circle-line" class="time-icon-mobile time-icon-update" />
																<span class="time-label-mobile">更新</span>
																<span class="time-value-mobile">{{ formatTimeAgo(item.updateTime) }}</span>
															</span>
														</div>
													</div>
								</template>
							</n-thing>
						</n-list-item>
					</n-list>
					<n-empty v-else-if="!loading" description="暂无数据" />
					<n-skeleton v-else :rows="5" />
					<!-- 分页 -->
					<div class="pagination-wrapper">
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
		
				<!-- 筛选抽屉 -->
				<n-drawer v-model:show="showFilterDrawer" :width="600" placement="right">
					<n-drawer-content title="筛选条件">
						<n-form :model="filterState" label-placement="top">
							<n-form-item label="标题">
								<n-input v-model:value="filterState.title" placeholder="请输入标题" clearable />
							</n-form-item>
							<n-form-item label="漏洞类型">
								<div class="cwe-selector-trigger">
									<n-button
										@click="openCweSelector('filter')"
										style="width: 100%; justify-content: flex-start;"
										quaternary
									>
										<template #icon>
											<SvgIcon icon="ri:file-list-line" />
										</template>
										{{ (filterState.vulnerabilityTypes && filterState.vulnerabilityTypes.length > 0)
											? `已选择 ${filterState.vulnerabilityTypes.length} 项`
											: '点击选择漏洞类型' }}
									</n-button>
									<div v-if="filterState.vulnerabilityTypes && filterState.vulnerabilityTypes.length > 0" class="selected-cwe-tags">
										<n-space :size="8" wrap style="margin-top: 8px;">
											<n-tag
												v-for="cweId in filterState.vulnerabilityTypes"
												:key="cweId"
												closable
												@close="removeCweFromFilter(cweId)"
												:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
											>
												{{ getCweDisplayName(cweId) }}
											</n-tag>
										</n-space>
									</div>
								</div>
							</n-form-item>
							<n-form-item label="语言">
								<n-select
									v-model:value="filterState.languages"
									:options="languageOptions"
									multiple
									placeholder="请选择语言"
									clearable
								/>
							</n-form-item>
							<n-form-item label="风险等级">
								<n-select
									v-model:value="filterState.severities"
									:options="severityOptions"
									multiple
									placeholder="请选择风险等级"
									clearable
								/>
							</n-form-item>
							<n-form-item label="状态">
								<n-select
									v-model:value="filterState.statuses"
									:options="statusOptions"
									multiple
									placeholder="请选择状态"
									clearable
								/>
							</n-form-item>
							<n-form-item>
								<n-space>
									<n-button type="primary" @click="handleApplyFilter">应用</n-button>
									<n-button @click="handleResetFilter">重置</n-button>
								</n-space>
							</n-form-item>
						</n-form>
					</n-drawer-content>
				</n-drawer>
		
				<!-- 移动端全屏详情 -->
				<n-drawer
					v-model:show="showDetailInMobile"
					:width="'100%'"
					placement="right"
					:mask-closable="true"
					@update:show="(val) => !val && closeDetailPanel()"
					v-if="isMobile"
				>
					<n-drawer-content title="知识条目详情" closable>
						<n-skeleton v-if="detailLoading" :rows="10" />
						<template v-else-if="detailItem">
							<!-- 复用桌面端的详情内容结构 -->
							<div class="detail-document mobile-detail-document">
								<!-- 头部Hero区域 -->
								<div class="detail-hero">
									<h1 class="detail-title">{{ detailItem.title }}</h1>
									<div class="detail-meta-tags">
										<n-space :size="8" wrap>
											<template v-if="detailItem.vulnerabilityTypes && detailItem.vulnerabilityTypes.length > 0">
												<n-tag
													v-for="cweId in detailItem.vulnerabilityTypes"
													:key="cweId"
													size="small"
													bordered
													:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
												>
															{{ getCweDisplayName(cweId) }}
												</n-tag>
											</template>
											<template v-if="detailItem.language">
												<n-tag size="small" bordered :style="{ backgroundColor: '#F0F0F0', color: '#707070' }">
													{{ languageOptions.find((opt: any) => opt.value === detailItem.language)?.label || detailItem.language }}
												</n-tag>
											</template>
											<template v-if="detailItem.severity">
												<n-tag
													:style="{
														backgroundColor: getDictColor(severityOptions, detailItem.severity, '#808080'),
														color: '#FFFFFF'
													}"
												>
													{{ getDictLabel(severityOptions, detailItem.severity) }}
												</n-tag>
											</template>
										</n-space>
									</div>
								</div>
								
								<!-- 风险评分区域 -->
								<div v-if="detailItem.cvssScore !== undefined || detailItem.cvssVector" class="detail-risk-section">
									<h2 class="detail-section-title">风险评分</h2>
									<div class="risk-score-display">
										<div v-if="getItemCvssScoreDisplay(detailItem)" class="risk-score-value">
											<span class="score-number">{{ getItemCvssScoreDisplay(detailItem) }}</span>
											<span class="score-label">/ 10.0</span>
										</div>
										<div v-if="detailItem.cvssVector" class="risk-components">
											<template v-if="parseCvssVector(detailItem.cvssVector)">
												<div class="risk-component-grid">
													<div v-if="parseCvssVector(detailItem.cvssVector)?.av" class="risk-component-item">
														<span class="component-label">攻击方式：</span>
														<span class="component-value">{{ getCvssComponentLabel('av', parseCvssVector(detailItem.cvssVector)!.av!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.ac" class="risk-component-item">
														<span class="component-label">利用复杂度：</span>
														<span class="component-value">{{ getCvssComponentLabel('ac', parseCvssVector(detailItem.cvssVector)!.ac!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.pr" class="risk-component-item">
														<span class="component-label">权限需求：</span>
														<span class="component-value">{{ getCvssComponentLabel('pr', parseCvssVector(detailItem.cvssVector)!.pr!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.ui" class="risk-component-item">
														<span class="component-label">用户交互：</span>
														<span class="component-value">{{ getCvssComponentLabel('ui', parseCvssVector(detailItem.cvssVector)!.ui!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.vc" class="risk-component-item">
														<span class="component-label">机密性影响：</span>
														<span class="component-value">{{ getCvssComponentLabel('vc', parseCvssVector(detailItem.cvssVector)!.vc!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.vi" class="risk-component-item">
														<span class="component-label">完整性影响：</span>
														<span class="component-value">{{ getCvssComponentLabel('vi', parseCvssVector(detailItem.cvssVector)!.vi!) }}</span>
													</div>
													<div v-if="parseCvssVector(detailItem.cvssVector)?.va" class="risk-component-item">
														<span class="component-label">可用性影响：</span>
														<span class="component-value">{{ getCvssComponentLabel('va', parseCvssVector(detailItem.cvssVector)!.va!) }}</span>
													</div>
												</div>
											</template>
										</div>
									</div>
								</div>
								
								<!-- 其他内容区域（复用桌面端结构） -->
								<div v-if="detailItem.summary" class="detail-section">
									<h2 class="detail-section-title">摘要</h2>
									<p class="detail-text">{{ detailItem.summary }}</p>
								</div>
								
								<div v-if="detailItem.problemDescription" class="detail-section">
									<h2 class="detail-section-title">问题描述</h2>
									<div class="detail-text markdown-content" v-html="detailItem.problemDescription.replace(/\n/g, '<br>')"></div>
								</div>
								
								<div v-if="detailItem.fixSolution" class="detail-section">
									<h2 class="detail-section-title">修复方案</h2>
									<div class="detail-text markdown-content" v-html="detailItem.fixSolution.replace(/\n/g, '<br>')"></div>
								</div>
								
								<div v-if="detailItem.exampleCode" class="detail-section detail-code-section">
									<h2 class="detail-section-title">示例代码</h2>
									<div class="code-display-wrapper">
										<div class="code-toolbar">
											<span class="code-label">代码</span>
											<n-button
												text
												size="small"
												@click="() => handleCopyCode(detailItem.exampleCode || '')"
											>
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
											:max-height="600"
										/>
									</div>
								</div>
								
								<div v-if="detailItem.tags && detailItem.tags.length > 0" class="detail-section">
									<h2 class="detail-section-title">标签</h2>
									<div class="detail-tags-container">
										<n-space :size="8" wrap>
											<n-tag
												v-for="tagName in detailItem.tags"
												:key="tagName"
												size="small"
												bordered
												:style="{ backgroundColor: '#F6FFED', color: '#52C41A' }"
											>
												{{ tagName }}
											</n-tag>
										</n-space>
									</div>
								</div>
								
								<div class="detail-section detail-meta-section">
									<h2 class="detail-section-title">元信息</h2>
									<div class="meta-grid">
										<div v-if="detailItem.createTime" class="meta-item">
											<span class="meta-label">创建时间：</span>
											<span class="meta-value">{{ format(new Date(detailItem.createTime), 'yyyy-MM-dd HH:mm') }}</span>
										</div>
										<div v-if="detailItem.updateTime" class="meta-item">
											<span class="meta-label">更新时间：</span>
											<span class="meta-value">{{ format(new Date(detailItem.updateTime), 'yyyy-MM-dd HH:mm') }}</span>
										</div>
									</div>
								</div>
								
								<div class="detail-actions">
									<n-space>
										<n-tooltip :disabled="canEditItem(detailItem)" placement="top">
											<template #trigger>
												<n-button :disabled="!canEditItem(detailItem)" @click="handleEdit(detailItem)" quaternary>编辑</n-button>
											</template>
											仅作者或管理员可以编辑此知识条目
										</n-tooltip>
										<n-tooltip :disabled="canEditItem(detailItem)" placement="top">
											<template #trigger>
												<n-button :disabled="!canEditItem(detailItem)" @click="handleDelete(detailItem)" quaternary type="error">删除</n-button>
											</template>
											仅作者或管理员可以删除此知识条目
										</n-tooltip>
									</n-space>
								</div>
							</div>
						</template>
						<n-empty v-else description="暂无详情数据" />
					</n-drawer-content>
				</n-drawer>
				
				<!-- 导出配置对话框 -->
				<n-modal
					v-model:show="showExportDialog"
					preset="card"
					title="导出配置"
					style="width: 90%; max-width: 1200px;"
					:mask-closable="true"
				>
					<div class="export-dialog-content">
						<div class="export-steps-wrapper">
							<n-steps v-model:current="currentExportStep" :status="'process'">
								<n-step title="基本设置" />
								<n-step title="字段选择与预览" />
							</n-steps>
						</div>
						
						<div v-if="currentExportStep === 1" class="export-step-content">
							<n-form label-placement="left" label-width="120px">
								<n-form-item label="导出格式">
									<n-radio-group v-model:value="exportConfig.format">
										<n-radio value="excel">Excel (.xlsx)</n-radio>
										<n-radio value="pdf">PDF (.pdf)</n-radio>
									</n-radio-group>
								</n-form-item>
								<n-form-item label="导出范围">
									<n-space :size="4">
										<n-radio-group v-model:value="exportConfig.exportRange">
											<n-space :size="8">
												<n-radio v-if="selectedItems.size > 0" value="selected">
													<span>已选条目 ({{ selectedItems.size }})</span>
												</n-radio>
												<n-radio value="currentPage">
													<span>当前页 ({{ tableData.length }})</span>
												</n-radio>
												<n-radio value="all">
													<span>全部数据 ({{ exportTotal }})</span>
												</n-radio>
											</n-space>
										</n-radio-group>
										<div v-if="selectedItems.size === 0" style="display: flex; align-items: center; font-size: 12px; color: #999; margin-top: 4px; padding-left: 24px;">
											<SvgIcon icon="ri:information-line" style="font-size: 14px; margin-right: 4px;" />
											<span>勾选左侧复选框可批量导出指定条目</span>
										</div>
									</n-space>
								</n-form-item>
								<n-form-item label="文件名">
									<n-input v-model:value="exportConfig.fileName" placeholder="留空则自动生成" />
								</n-form-item>
								<n-form-item v-if="exportConfig.format === 'pdf'" label="PDF选项">
									<n-space>
										<n-checkbox v-model:checked="exportConfig.pdfOptions.includeHeaderFooter">包含页眉页脚</n-checkbox>
										<n-checkbox v-model:checked="exportConfig.pdfOptions.includeTOC">包含目录</n-checkbox>
										<n-checkbox v-model:checked="exportConfig.pdfOptions.codeHighlight">代码高亮</n-checkbox>
									</n-space>
								</n-form-item>
								<n-form-item v-if="exportConfig.format === 'excel'" label="Excel选项">
									<n-space>
										<n-checkbox v-model:checked="exportConfig.excelOptions.includeFilter">包含筛选器</n-checkbox>
										<n-checkbox v-model:checked="exportConfig.excelOptions.freezeHeader">冻结表头</n-checkbox>
										<n-checkbox v-model:checked="exportConfig.excelOptions.conditionalFormatting">条件格式</n-checkbox>
									</n-space>
								</n-form-item>
							</n-form>
						</div>
						
						<div v-if="currentExportStep === 2" class="export-step-content">
							<n-spin :show="exportPreviewLoading || !exportPreviewData">
								<div class="field-selection-preview-layout" ref="layoutContainerRef">
									<!-- 左侧：字段选择 -->
									<div class="field-selection-panel" :style="{ width: exportConfig.panelWidth + 'px' }" ref="fieldSelectionPanelRef">
									<n-card size="small" class="field-selection-card" ref="fieldSelectionCardRef">
										<template #header>
											<div style="display: flex; justify-content: space-between; align-items: center;">
												<span>导出字段</span>
												<n-space :size="8">
													<n-button size="small" quaternary @click="handleSelectAllFields">
														全选
													</n-button>
													<n-button size="small" quaternary @click="handleResetFieldsToDefault">
														恢复默认
													</n-button>
												</n-space>
											</div>
										</template>
										<n-scrollbar ref="fieldSelectionScrollbarRef">
											<n-checkbox-group v-model:value="exportConfig.selectedFields">
												<n-space vertical :size="12">
													<div style="font-weight: 600; color: #323130; margin-bottom: 8px;">条目信息</div>
													<n-checkbox value="title">标题</n-checkbox>
													<n-checkbox value="summary">摘要</n-checkbox>
													<n-checkbox value="severity">风险等级</n-checkbox>
													<div style="display: flex; align-items: center; gap: 8px;">
														<n-checkbox value="vulnerabilityTypes">漏洞类型</n-checkbox>
														<n-select
															v-if="exportConfig.selectedFields.includes('vulnerabilityTypes')"
															v-model:value="exportConfig.fieldFormats.vulnerabilityTypes"
															:options="[
																{ label: '仅名称', value: 'name_only' },
																{ label: 'ID+名称', value: 'id_name' },
																{ label: '完整信息', value: 'full' }
															]"
															size="small"
															style="width: 120px;"
															placeholder="选择格式"
														/>
													</div>
													<n-checkbox value="language">编程语言</n-checkbox>
													<n-checkbox value="status">状态</n-checkbox>
													<div style="display: flex; align-items: center; gap: 8px;">
														<n-checkbox value="tags">标签</n-checkbox>
														<n-select
															v-if="exportConfig.selectedFields.includes('tags')"
															v-model:value="exportConfig.fieldFormats.tags"
															:options="[
																{ label: '仅名称', value: 'name_only' },
																{ label: '完整信息', value: 'full' }
															]"
															size="small"
															style="width: 120px;"
															placeholder="选择格式"
														/>
													</div>
													<div style="font-weight: 600; color: #323130; margin-top: 16px; margin-bottom: 8px;">CVSS评分</div>
													<n-checkbox value="cvssScore">CVSS评分</n-checkbox>
													<n-checkbox value="cvssAttackVector">CVSS攻击方式</n-checkbox>
													<n-checkbox value="cvssAttackComplexity">CVSS利用复杂度</n-checkbox>
													<n-checkbox value="cvssPrivilegesRequired">CVSS权限需求</n-checkbox>
													<n-checkbox value="cvssUserInteraction">CVSS用户交互</n-checkbox>
													<n-checkbox value="cvssConfidentialityImpact">CVSS机密性影响</n-checkbox>
													<n-checkbox value="cvssIntegrityImpact">CVSS完整性影响</n-checkbox>
													<n-checkbox value="cvssAvailabilityImpact">CVSS可用性影响</n-checkbox>
													<div style="font-weight: 600; color: #323130; margin-top: 16px; margin-bottom: 8px;">详细内容</div>
													<n-checkbox value="problemDescription">问题描述</n-checkbox>
													<n-checkbox value="fixSolution">修复方案</n-checkbox>
													<n-checkbox value="exampleCode">示例代码</n-checkbox>
													<div style="font-weight: 600; color: #323130; margin-top: 16px; margin-bottom: 8px;">时间与记录</div>
													<n-checkbox value="createTime">创建时间</n-checkbox>
													<n-checkbox value="updateTime">更新时间</n-checkbox>
													<n-checkbox value="createBy">创建人</n-checkbox>
													<n-checkbox value="updateBy">更新人</n-checkbox>
													<n-checkbox value="kid">知识库</n-checkbox>
													<n-checkbox value="fragmentCount">片段数量</n-checkbox>
												</n-space>
											</n-checkbox-group>
										</n-scrollbar>
									</n-card>
								</div>
								
								<!-- 分隔条 -->
								<div 
									class="layout-divider"
									@mousedown="handleDividerMouseDown"
									:class="{ 'dragging': isDraggingDivider }"
								></div>
								
								<!-- 右侧：实时预览 -->
								<div class="preview-panel" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
									<n-scrollbar style="flex: 1; overflow-y: auto;">
										<n-space vertical :size="16">
										<!-- 导出信息摘要 -->
										<n-card title="导出信息摘要" size="small">
											<n-space vertical :size="8">
												<div class="export-summary-row">
													<span class="summary-label">导出格式：</span>
													<n-tag size="small" :type="exportConfig.format === 'excel' ? 'success' : 'info'">
														{{ exportConfig.format === 'excel' ? 'Excel (.xlsx)' : 'PDF (.pdf)' }}
													</n-tag>
												</div>
												<div class="export-summary-row">
													<span class="summary-label">导出范围：</span>
													<span class="summary-value">
														{{ exportConfig.exportRange === 'selected' ? `已选条目（${selectedItems.size}条）` : 
														  exportConfig.exportRange === 'currentPage' ? `当前页（${tableData.length}条）` :
														  `全部数据（${exportPreviewData?.totalCount || exportTotal}条）` }}
													</span>
												</div>
												<div class="export-summary-row">
													<span class="summary-label">预计导出：</span>
													<span class="summary-value">{{ exportPreviewData?.totalCount || 0 }} 条记录</span>
												</div>
												<div class="export-summary-row">
													<span class="summary-label">导出字段：</span>
													<span class="summary-value">{{ exportPreviewData?.selectedFields?.length || exportConfig.selectedFields.length }} 个字段</span>
												</div>
												<div class="export-summary-row">
													<span class="summary-label">预计文件大小：</span>
													<span class="summary-value">{{ exportPreviewData?.estimatedFileSize ? (exportPreviewData.estimatedFileSize / 1024).toFixed(2) : '0' }} KB</span>
												</div>
												<div class="export-summary-row">
													<span class="summary-label">预计耗时：</span>
													<span class="summary-value">{{ exportPreviewData?.estimatedTime || 0 }} 秒</span>
												</div>
											</n-space>
										</n-card>
										
										<!-- 字段列表预览 -->
										<n-card v-if="exportPreviewData?.selectedFields && exportPreviewData.selectedFields.length > 0" title="字段列表" size="small">
											<n-space vertical :size="4">
												<div class="field-list-info">
													<span>已选择 {{ exportPreviewData.selectedFields.length }} 个字段（按导出顺序）：</span>
													<span style="color: #999; font-size: 12px; margin-left: 8px;">拖拽标签可调整顺序</span>
												</div>
												<div class="field-list-tags">
													<n-tag
														v-for="(field, index) in exportPreviewData.selectedFields"
														:key="field.key"
														size="small"
														:type="field.type === 'expanded' ? 'info' : field.type === 'dictConverted' ? 'warning' : 'default'"
														:draggable="true"
														:class="['drag-handle', { 'drag-over': dragOverIndex === index, 'dragging': draggedFieldIndex === index }]"
														style="margin-right: 8px; margin-bottom: 8px; cursor: move; user-select: none; display: inline-flex; align-items: center; vertical-align: middle;"
														@dragstart="handleDragStart(index, $event)"
														@dragover="handleDragOver(index, $event)"
														@dragleave="handleDragLeave"
														@drop="handleDrop(index, $event)"
														@dragend="handleDragEnd"
													>
														<span style="margin-right: 4px; display: inline-flex; align-items: center;">⋮⋮</span>
														<span style="display: inline-flex; align-items: center;">{{ index + 1 }}. {{ field.label }}</span>
														<span v-if="field.type === 'expanded'" style="color: #999; font-size: 11px; display: inline-flex; align-items: center;">（展开字段）</span>
														<span v-else-if="field.type === 'dictConverted'" style="color: #999; font-size: 11px; display: inline-flex; align-items: center;">（字典转换）</span>
													</n-tag>
												</div>
											</n-space>
										</n-card>
										
										<!-- 样本数据预览 -->
										<n-card title="样本数据预览" size="small">
											<template #header-extra>
												<n-space :size="8">
													<n-button size="small" quaternary @click="loadExportPreview" :loading="exportPreviewLoading">
														<template #icon>
															<SvgIcon icon="ri:refresh-line" />
														</template>
														刷新预览
													</n-button>
												</n-space>
											</template>
											<div v-if="exportPreviewData">
												<div v-if="!exportPreviewData.sampleData || exportPreviewData.sampleData.length === 0" class="preview-empty">
													<n-empty description="暂无预览数据" />
												</div>
												<div v-else>
													<div class="preview-data-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
														<div>
															<span>预览前 {{ exportPreviewData.sampleData.length }} 条真实数据，共 {{ exportPreviewData.totalCount }} 条</span>
															<span v-if="exportConfig.format === 'excel'" style="color: #999; font-size: 12px; margin-left: 8px;">
																（Excel将包含表头样式、交替行颜色{{ exportConfig.excelOptions?.conditionalFormatting ? '、条件格式' : '' }}）
															</span>
														</div>
														<n-button 
															v-if="exportConfig.format === 'excel'" 
															size="small" 
															quaternary 
															@click="handleResetColumnWidths"
														>
															恢复默认列宽
														</n-button>
													</div>
													<div class="preview-table-container" :class="{ 'excel-preview': exportConfig.format === 'excel' }" ref="previewTableRef">
														<n-scrollbar x-scrollable style="width: 100%;">
															<n-data-table
																:columns="exportPreviewColumns"
																:data="exportPreviewData.sampleData"
																:max-height="300"
																:scroll-x="previewTableScrollX"
																bordered
																size="small"
																:row-class-name="(row: any, index: number) => index % 2 === 0 ? 'even-row' : 'odd-row'"
																@update:sorter="() => {}"
															/>
														</n-scrollbar>
													</div>
												</div>
											</div>
											<div v-else class="preview-empty">
												<n-empty description="请先选择至少一个字段" />
											</div>
										</n-card>
										
										<!-- Excel格式样式说明 -->
										<n-card v-if="exportConfig.format === 'excel'" title="Excel格式样式说明" size="small">
											<n-space vertical :size="8">
												<div class="export-summary-row">
													<n-tag size="small" type="info">表头</n-tag>
													<span class="summary-value">深色背景，白色文字，自动冻结</span>
												</div>
												<div class="export-summary-row">
													<n-tag size="small" type="info">数据行</n-tag>
													<span class="summary-value">交替行颜色，便于阅读</span>
												</div>
												<div v-if="exportConfig.excelOptions?.includeFilter" class="export-summary-row">
													<n-tag size="small" type="success">筛选器</n-tag>
													<span class="summary-value">表头包含自动筛选功能</span>
												</div>
												<div v-if="exportConfig.excelOptions?.conditionalFormatting" class="export-summary-row">
													<n-tag size="small" type="warning">条件格式</n-tag>
													<span class="summary-value">风险等级字段将根据等级显示不同颜色</span>
												</div>
											</n-space>
										</n-card>
										
										<!-- PDF格式预览 -->
										<n-card v-if="exportConfig.format === 'pdf' && exportPreviewData?.previewHtml" title="PDF格式预览" size="small">
											<div class="pdf-preview-container" v-html="exportPreviewData.previewHtml"></div>
										</n-card>
										</n-space>
									</n-scrollbar>
								</div>
							</div>
							</n-spin>
						</div>
						
						<div class="export-dialog-actions">
							<n-space justify="space-between">
								<n-button v-if="currentExportStep > 1" @click="currentExportStep--">上一步</n-button>
								<div v-else></div>
								<n-space>
									<n-button @click="showExportDialog = false">取消</n-button>
									<n-button v-if="currentExportStep < 2" type="primary" @click="currentExportStep++" :disabled="!canProceedToNextStep">下一步</n-button>
									<n-button v-else type="primary" @click="handleExport" :disabled="exportConfig.selectedFields.length === 0">开始导出</n-button>
								</n-space>
							</n-space>
						</div>
					</div>
				</n-modal>
				
				<!-- 批量编辑标签对话框 -->
				<n-modal
					v-model:show="showBatchEditTagsModal"
					preset="card"
					title="批量编辑标签"
					style="width: 90%; max-width: 1000px;"
					:mask-closable="false"
				>
					<div class="batch-edit-tags-content">
						<div v-if="batchEditTagsLoading" style="text-align: center; padding: 40px;">
							<n-skeleton :rows="5" />
						</div>
						<template v-else>
							<div class="batch-edit-tags-header">
								<div class="batch-edit-tags-info">
									<span>已选择 {{ selectedItems.size }} 条知识条目</span>
								</div>
								<n-input
									v-model:value="batchEditTagsSearchKeyword"
									placeholder="搜索标签名称、描述..."
									clearable
									size="large"
									style="margin-bottom: 16px;"
								>
									<template #prefix>
										<SvgIcon icon="ri:search-line" />
									</template>
								</n-input>
							</div>
							
							<div class="batch-edit-tags-filter-bar">
								<div class="filter-group">
									<span class="filter-label">
										<SvgIcon icon="ri:filter-line" class="filter-icon" />
										标签类型
									</span>
									<n-checkbox-group v-model:value="batchEditTagsSelectedTagTypes">
										<n-space :size="12">
											<n-checkbox value="system">
												<span class="type-label">系统标签</span>
											</n-checkbox>
											<n-checkbox value="user">
												<span class="type-label">我的标签</span>
											</n-checkbox>
										</n-space>
									</n-checkbox-group>
								</div>
								<div class="sort-group">
									<span class="sort-label">排序：</span>
									<n-select
										v-model:value="batchEditTagsSortBy"
										:options="[
											{ label: '名称', value: 'name' }
										]"
										size="small"
										style="width: 140px;"
									/>
								</div>
							</div>
							
							<div class="batch-edit-tags-list">
								<!-- 系统标签 -->
								<div v-if="batchEditTagsSortedSystemTags.length > 0" class="tag-group">
									<div class="group-header">
										<span class="group-title">系统标签</span>
										<span class="group-count">（{{ batchEditTagsSortedSystemTags.length }}）</span>
									</div>
									<div class="tags-grid">
										<div
											v-for="tag in batchEditTagsSortedSystemTags.slice(0, batchEditTagsMaxDisplay)"
											:key="tag.name"
											class="batch-edit-tag-card tag-card-system"
										>
											<n-checkbox
												:checked="batchEditTagsSelectedTags.has(tag.name)"
												:indeterminate="getBatchEditTagState(tag.name) === 'some'"
												@update:checked="() => toggleBatchEditTag(tag.name)"
											>
												<div class="tag-card-content">
													<div class="tag-name-row">
														<n-tooltip :disabled="tag.name.length <= 20">
															<template #trigger>
																<span class="tag-name" :title="tag.name">{{ tag.name.length > 20 ? tag.name.substring(0, 20) + '...' : tag.name }}</span>
															</template>
															{{ tag.name }}
														</n-tooltip>
														<span class="tag-type-badge tag-type-system">系统</span>
													</div>
													<span v-if="tag.description" class="tag-desc" :title="tag.description">
														{{ tag.description.length > 50 ? tag.description.substring(0, 50) + '...' : tag.description }}
													</span>
													<div class="tag-state-hint">
														<span v-if="getBatchEditTagState(tag.name) === 'all'" class="state-text state-all">所有条目都有此标签</span>
														<span v-else-if="getBatchEditTagState(tag.name) === 'some'" class="state-text state-some">部分条目有此标签</span>
														<span v-else class="state-text state-none">所有条目都没有此标签</span>
													</div>
												</div>
											</n-checkbox>
										</div>
									</div>
									<div v-if="batchEditTagsSortedSystemTags.length > batchEditTagsMaxDisplay" class="more-tags-hint">
										<n-button text type="info" size="small" @click="batchEditTagsShowAllSystem = !batchEditTagsShowAllSystem">
											{{ batchEditTagsShowAllSystem ? '收起' : `显示全部 ${batchEditTagsSortedSystemTags.length} 个标签` }}
										</n-button>
									</div>
									<div v-if="batchEditTagsShowAllSystem && batchEditTagsSortedSystemTags.length > batchEditTagsMaxDisplay" class="tags-grid">
										<div
											v-for="tag in batchEditTagsSortedSystemTags.slice(batchEditTagsMaxDisplay)"
											:key="tag.name"
											class="batch-edit-tag-card tag-card-system"
										>
											<n-checkbox
												:checked="batchEditTagsSelectedTags.has(tag.name)"
												:indeterminate="getBatchEditTagState(tag.name) === 'some'"
												@update:checked="() => toggleBatchEditTag(tag.name)"
											>
												<div class="tag-card-content">
													<div class="tag-name-row">
														<n-tooltip :disabled="tag.name.length <= 20">
															<template #trigger>
																<span class="tag-name" :title="tag.name">{{ tag.name.length > 20 ? tag.name.substring(0, 20) + '...' : tag.name }}</span>
															</template>
															{{ tag.name }}
														</n-tooltip>
														<span class="tag-type-badge tag-type-system">系统</span>
													</div>
													<span v-if="tag.description" class="tag-desc" :title="tag.description">
														{{ tag.description.length > 50 ? tag.description.substring(0, 50) + '...' : tag.description }}
													</span>
													<div class="tag-state-hint">
														<span v-if="getBatchEditTagState(tag.name) === 'all'" class="state-text state-all">所有条目都有此标签</span>
														<span v-else-if="getBatchEditTagState(tag.name) === 'some'" class="state-text state-some">部分条目有此标签</span>
														<span v-else class="state-text state-none">所有条目都没有此标签</span>
													</div>
												</div>
											</n-checkbox>
										</div>
									</div>
								</div>
								
								<!-- 用户标签 -->
								<div v-if="batchEditTagsSortedUserTags.length > 0" class="tag-group">
									<div class="group-header">
										<span class="group-title">我的标签</span>
										<span class="group-count">（{{ batchEditTagsSortedUserTags.length }}）</span>
									</div>
									<div class="tags-grid">
										<div
											v-for="tag in batchEditTagsSortedUserTags.slice(0, batchEditTagsMaxDisplay)"
											:key="tag.name"
											class="batch-edit-tag-card tag-card-user"
										>
											<n-checkbox
												:checked="batchEditTagsSelectedTags.has(tag.name)"
												:indeterminate="getBatchEditTagState(tag.name) === 'some'"
												@update:checked="() => toggleBatchEditTag(tag.name)"
											>
												<div class="tag-card-content">
													<div class="tag-name-row">
														<n-tooltip :disabled="tag.name.length <= 20">
															<template #trigger>
																<span class="tag-name" :title="tag.name">{{ tag.name.length > 20 ? tag.name.substring(0, 20) + '...' : tag.name }}</span>
															</template>
															{{ tag.name }}
														</n-tooltip>
														<span class="tag-type-badge tag-type-user">我的</span>
													</div>
													<span v-if="tag.description" class="tag-desc" :title="tag.description">
														{{ tag.description.length > 50 ? tag.description.substring(0, 50) + '...' : tag.description }}
													</span>
													<div class="tag-state-hint">
														<span v-if="getBatchEditTagState(tag.name) === 'all'" class="state-text state-all">所有条目都有此标签</span>
														<span v-else-if="getBatchEditTagState(tag.name) === 'some'" class="state-text state-some">部分条目有此标签</span>
														<span v-else class="state-text state-none">所有条目都没有此标签</span>
													</div>
												</div>
											</n-checkbox>
										</div>
									</div>
									<div v-if="batchEditTagsSortedUserTags.length > batchEditTagsMaxDisplay" class="more-tags-hint">
										<n-button text type="info" size="small" @click="batchEditTagsShowAllUser = !batchEditTagsShowAllUser">
											{{ batchEditTagsShowAllUser ? '收起' : `显示全部 ${batchEditTagsSortedUserTags.length} 个标签` }}
										</n-button>
									</div>
									<div v-if="batchEditTagsShowAllUser && batchEditTagsSortedUserTags.length > batchEditTagsMaxDisplay" class="tags-grid">
										<div
											v-for="tag in batchEditTagsSortedUserTags.slice(batchEditTagsMaxDisplay)"
											:key="tag.name"
											class="batch-edit-tag-card tag-card-user"
										>
											<n-checkbox
												:checked="batchEditTagsSelectedTags.has(tag.name)"
												:indeterminate="getBatchEditTagState(tag.name) === 'some'"
												@update:checked="() => toggleBatchEditTag(tag.name)"
											>
												<div class="tag-card-content">
													<div class="tag-name-row">
														<n-tooltip :disabled="tag.name.length <= 20">
															<template #trigger>
																<span class="tag-name" :title="tag.name">{{ tag.name.length > 20 ? tag.name.substring(0, 20) + '...' : tag.name }}</span>
															</template>
															{{ tag.name }}
														</n-tooltip>
														<span class="tag-type-badge tag-type-user">我的</span>
													</div>
													<span v-if="tag.description" class="tag-desc" :title="tag.description">
														{{ tag.description.length > 50 ? tag.description.substring(0, 50) + '...' : tag.description }}
													</span>
													<div class="tag-state-hint">
														<span v-if="getBatchEditTagState(tag.name) === 'all'" class="state-text state-all">所有条目都有此标签</span>
														<span v-else-if="getBatchEditTagState(tag.name) === 'some'" class="state-text state-some">部分条目有此标签</span>
														<span v-else class="state-text state-none">所有条目都没有此标签</span>
													</div>
												</div>
											</n-checkbox>
										</div>
									</div>
								</div>
								
								<!-- 空状态 -->
								<div v-if="batchEditTagsSortedSystemTags.length === 0 && batchEditTagsSortedUserTags.length === 0" class="empty-state">
									<div class="empty-icon">
										<SvgIcon icon="ri:price-tag-line" style="font-size: 48px; color: #D9D9D9;" />
									</div>
									<div class="empty-text">未找到匹配的标签</div>
									<div v-if="batchEditTagsSearchKeyword.trim()" class="empty-hint">尝试调整搜索关键词或筛选条件</div>
								</div>
							</div>
						</template>
					</div>
					<template #footer>
						<div class="batch-edit-tags-footer">
							<n-space>
								<n-button @click="showBatchEditTagsModal = false">取消</n-button>
								<n-button type="primary" @click="handleBatchEditTagsConfirm" :disabled="batchEditTagsLoading">
									确定（已选择 {{ batchEditTagsSelectedTags.size }} 个标签）
								</n-button>
							</n-space>
						</div>
					</template>
				</n-modal>
				
				<!-- 旧版详情面板（保留作为fallback） -->
				<n-drawer
					v-model:show="showDetailPanel"
					:width="600"
					placement="right"
					:mask-closable="true"
					@update:show="(val) => !val && closeDetailPanel()"
					v-if="false"
				>
					<n-drawer-content title="知识条目详情" closable>
						<n-skeleton v-if="detailLoading" :rows="10" />
						<template v-else-if="detailItem">
							<n-space vertical :size="16">
								<div>
									<h3 style="margin: 0 0 8px 0; color: #202020;">{{ detailItem.title }}</h3>
									<n-divider style="margin: 8px 0;" />
								</div>
								<div v-if="detailItem.summary">
									<strong style="color: #404040;">摘要：</strong>
									<p style="margin: 4px 0; color: #606060;">{{ detailItem.summary }}</p>
								</div>
								<div v-if="detailItem.vulnerabilityTypes && detailItem.vulnerabilityTypes.length > 0">
									<strong style="color: #404040; margin-bottom: 8px; display: block;">漏洞类型：</strong>
									<div class="detail-tags-container">
										<n-space :size="8" wrap>
											<n-tag
												v-for="cweId in detailItem.vulnerabilityTypes"
												:key="cweId"
												size="small"
												bordered
												:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
											>
															{{ getCweDisplayName(cweId) }}
											</n-tag>
										</n-space>
									</div>
								</div>
								<div v-else-if="detailItem.vulnerabilityType">
									<strong style="color: #404040;">漏洞类型：</strong>
									<span style="color: #606060;">{{ detailItem.vulnerabilityType }}</span>
								</div>
								<div v-if="detailItem.tags && detailItem.tags.length > 0">
									<strong style="color: #404040; margin-bottom: 8px; display: block;">标签：</strong>
									<div class="detail-tags-container">
										<n-space :size="8" wrap>
											<n-tag
												v-for="tagName in detailItem.tags"
												:key="tagName"
												size="small"
												bordered
												:style="{ backgroundColor: '#F6FFED', color: '#52C41A' }"
											>
												{{ tagName }}
											</n-tag>
										</n-space>
									</div>
								</div>
								<div v-if="detailItem.language">
									<strong style="color: #404040;">语言：</strong>
									<span style="color: #606060;">{{ languageOptions.find((opt: any) => opt.value === detailItem.language)?.label || detailItem.language }}</span>
								</div>
								<div v-if="detailItem.severity">
									<strong style="color: #404040;">风险等级：</strong>
									<n-tag
										:style="{
											backgroundColor: getDictColor(severityOptions, detailItem.severity, '#808080'),
											color: '#FFFFFF'
										}"
									>
										{{ getDictLabel(severityOptions, detailItem.severity) }}
									</n-tag>
								</div>
								<div v-if="detailItem.status">
									<strong style="color: #404040;">状态：</strong>
									<n-tag
										:style="{
											backgroundColor: getDictColor(statusOptions, detailItem.status, '#808080'),
											color: '#FFFFFF'
										}"
									>
										{{ getDictLabel(statusOptions, detailItem.status) }}
									</n-tag>
								</div>
								<div v-if="detailItem.problemDescription">
									<strong style="color: #404040;">问题描述：</strong>
									<p style="margin: 4px 0; color: #606060; white-space: pre-wrap;">{{ detailItem.problemDescription }}</p>
								</div>
								<div v-if="detailItem.fixSolution">
									<strong style="color: #404040;">修复方案：</strong>
									<p style="margin: 4px 0; color: #606060; white-space: pre-wrap;">{{ detailItem.fixSolution }}</p>
								</div>
								<div v-if="detailItem.exampleCode">
									<strong style="color: #404040; margin-bottom: 8px; display: block;">示例代码：</strong>
									<div style="border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; background: #ffffff;">
										<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; background: #faf9f8;">
											<span style="font-size: 12px; color: #606060; font-weight: 500;">代码</span>
											<n-button
												text
												size="small"
												@click="() => handleCopyCode(detailItem.exampleCode || '')"
											>
												<template #icon>
													<SvgIcon icon="ri:file-copy-line" />
												</template>
												复制
											</n-button>
										</div>
										<pre style="margin: 0; padding: 12px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.6; background: #ffffff; overflow-x: auto; max-height: 500px; overflow-y: auto;">
											<code class="hljs" v-html="highlightCode(detailItem.exampleCode || '')"></code>
										</pre>
									</div>
								</div>
								<div v-if="detailItem.cvssScore !== undefined">
									<strong style="color: #404040;">风险分数：</strong>
									<span style="color: #606060;">{{ detailItem.cvssScore }}</span>
								</div>
								<div v-if="detailItem.createTime">
									<strong style="color: #404040;">创建时间：</strong>
									<span style="color: #606060;">{{ format(new Date(detailItem.createTime), 'yyyy-MM-dd HH:mm') }}</span>
								</div>
								<div v-if="detailItem.updateTime">
									<strong style="color: #404040;">更新时间：</strong>
									<span style="color: #606060;">{{ format(new Date(detailItem.updateTime), 'yyyy-MM-dd HH:mm') }}</span>
								</div>
							</n-space>
						</template>
						<n-empty v-else description="暂无详情数据" />
					</n-drawer-content>
				</n-drawer>

				<!-- CWE选择器 -->
				<CweSelector
					v-model="showCweSelector"
					:selected-values="tempSelectedCweIds"
					@confirm="handleCweSelectorConfirm"
					@cancel="handleCweSelectorCancel"
				/>

				<!-- 创建知识条目模态框 -->
				<n-modal
					v-model:show="showCreateModal"
					preset="card"
					title="创建知识条目"
					:mask-closable="true"
					:close-on-esc="true"
					style="width: 900px; max-height: 90vh;"
					@update:show="(val) => !val && closeCreateModal()"
				>
					<n-form
						ref="createFormRef"
						:model="createFormValue"
						:rules="createFormRules"
						label-placement="top"
						class="knowledge-item-form"
						:show-label="true"
					>
						<n-space vertical :size="8">
							<!-- 基础信息、内容编辑、高级信息 -->
							<n-collapse :default-expanded-names="['basic', 'content', 'advanced']">
								<n-collapse-item name="basic" title="基础信息">
									<n-grid :cols="24" :x-gap="20" :y-gap="0">
										<n-gi :span="24">
											<n-form-item label="知识库">
												<n-input
													:value="knowledgeBaseName || '当前知识库'"
													disabled
													style="background: #F5F5F5;"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="title" label="标题">
												<n-input
													v-model:value="createFormValue.title"
													placeholder="请输入标题"
													clearable
													:maxlength="255"
													show-count
													@blur="updateCreateFormValidation"
													@input="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="summary" label="摘要">
												<n-input
													type="textarea"
													v-model:value="createFormValue.summary"
													placeholder="请输入摘要"
													:autosize="{ minRows: 1, maxRows: 5 }"
													:maxlength="500"
													show-count
													clearable
													@blur="updateCreateFormValidation"
													@input="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="vulnerabilityTypes" label="漏洞类型">
												<div class="cwe-selector-trigger">
													<n-button
														@click="openCweSelector('create')"
														style="width: 100%; justify-content: flex-start;"
														quaternary
													>
														<template #icon>
															<SvgIcon icon="ri:file-list-line" />
														</template>
														{{ ((createFormValue as any).vulnerabilityTypes && (createFormValue as any).vulnerabilityTypes.length > 0)
															? `已选择 ${(createFormValue as any).vulnerabilityTypes.length} 项`
															: '选择漏洞类型' }}
													</n-button>
													<div v-if="(createFormValue as any).vulnerabilityTypes && (createFormValue as any).vulnerabilityTypes.length > 0" class="selected-cwe-tags">
														<n-space :size="8" wrap style="margin-top: 8px;">
															<n-tag
																v-for="cweId in (createFormValue as any).vulnerabilityTypes"
																:key="cweId"
																closable
																@close="removeCweFromCreate(cweId)"
																:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
															>
																{{ getCweDisplayName(cweId) }}
															</n-tag>
														</n-space>
													</div>
												</div>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="language" label="语言">
												<n-select
													v-model:value="createFormValue.language"
													:options="languageOptions"
													placeholder="请选择语言"
													clearable
													filterable
													@update:value="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="severity" label="风险等级">
												<n-select
													v-model:value="createFormValue.severity"
													:options="severityOptions"
													placeholder="请选择风险等级"
													clearable
													filterable
													@update:value="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="status" label="状态">
												<n-select
													v-model:value="createFormValue.status"
													:options="statusOptions"
													placeholder="请选择状态"
													@update:value="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="tags" label="标签">
												<TagPicker
													:model-value="selectedTagsForPicker"
													:system-tags="systemTags"
													:user-tags="userTags"
													placeholder="点击选择标签"
													@create="handleTagCreate"
													@update:model-value="handleTagsChange"
													@refresh="loadTagData"
												/>
											</n-form-item>
										</n-gi>
									</n-grid>
								</n-collapse-item>
		
								<!-- 内容编辑 -->
								<n-collapse-item name="content" title="内容编辑">
									<n-grid :cols="24" :x-gap="20" :y-gap="0">
										<n-gi :span="24">
											<n-form-item path="problemDescription" label="问题描述">
												<n-input
													type="textarea"
													v-model:value="createFormValue.problemDescription"
													placeholder="请输入问题描述"
													:autosize="{ minRows: 1, maxRows: 10 }"
													clearable
													@blur="updateCreateFormValidation"
													@input="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="fixSolution" label="修复方案">
												<n-input
													type="textarea"
													v-model:value="createFormValue.fixSolution"
													placeholder="请输入修复方案"
													:autosize="{ minRows: 2, maxRows: 10 }"
													clearable
													@blur="updateCreateFormValidation"
													@input="updateCreateFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="exampleCode" label="示例代码">
												<CodeEditor
													:model-value="createFormValue.exampleCode || ''"
													placeholder="请输入示例代码"
													:min-height="200"
													:max-height="500"
													:show-toolbar="true"
													:show-line-numbers="true"
													@update:model-value="(val) => { createFormValue.exampleCode = val; updateCreateFormValidation(); }"
												/>
											</n-form-item>
										</n-gi>
									</n-grid>
								</n-collapse-item>
		
								<!-- 高级信息 -->
								<n-collapse-item name="advanced" title="风险评分">
									<n-grid :cols="24" :x-gap="20" :y-gap="20">
										<!-- 风险评分维度 -->
										<n-gi :span="24">
											<div class="risk-assessment-section">
												<div class="section-header">
													<span class="section-hint">选择以下维度，系统依据CVSS v4.0标准自动评估和存储风险等级</span>
												</div>
												<n-grid :cols="24" :x-gap="16" :y-gap="20" style="margin-top: 16px;">
													<n-gi :span="12">
														<n-form-item label="攻击方式" path="riskAttackVector">
															<n-select
																v-model:value="createFormValue.riskAttackVector"
																:options="riskAttackVectorOptions"
																placeholder="选择攻击方式"
																clearable
																@update:value="updateCreateFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="12">
														<n-form-item label="利用复杂度" path="riskComplexity">
															<n-select
																v-model:value="createFormValue.riskComplexity"
																:options="riskComplexityOptions"
																placeholder="选择利用复杂度"
																clearable
																@update:value="updateCreateFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="12">
														<n-form-item label="权限需求" path="riskPrivileges">
															<n-select
																v-model:value="createFormValue.riskPrivileges"
																:options="riskPrivilegesOptions"
																placeholder="选择权限需求"
																clearable
																@update:value="updateCreateFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="12">
														<n-form-item label="用户交互" path="riskUserInteraction">
															<n-select
																v-model:value="createFormValue.riskUserInteraction"
																:options="riskUserInteractionOptions"
																placeholder="选择用户交互需求"
																clearable
																@update:value="updateCreateFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="24">
														<n-form-item label="影响范围" path="riskImpact">
															<n-select
																v-model:value="createFormValue.riskImpact"
																:options="riskImpactOptions"
																placeholder="选择影响范围（可多选）"
																multiple
																clearable
																@update:value="updateCreateFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
												</n-grid>
											</div>
										</n-gi>
									</n-grid>
								</n-collapse-item>
							</n-collapse>
						</n-space>
					</n-form>
		
					<template #footer>
						<n-space justify="end" :size="12">
							<n-button @click="closeCreateModal" secondary>
								取消
							</n-button>
							<n-button
								type="primary"
								@click="submitCreateForm"
								:loading="submitting"
								:disabled="!isCreateFormValid || submitting"
							>
								创建
							</n-button>
						</n-space>
					</template>
				</n-modal>
				
				<!-- 编辑知识条目模态框 -->
				<n-modal
					v-model:show="showEditModal"
					@update:show="handleEditModalShowChange"
					preset="card"
					title="编辑知识条目"
					:mask-closable="true"
					:close-on-esc="true"
					style="width: 900px; max-height: 90vh;"
				>
					<n-form
						ref="editFormRef"
						:model="editFormValue"
						:rules="editFormRules"
						label-placement="top"
						class="knowledge-item-form"
						:show-label="true"
					>
						<n-space vertical :size="8">
							<n-collapse :default-expanded-names="['basic', 'content', 'advanced']">
								<n-collapse-item name="basic" title="基础信息">
									<n-grid :cols="24" :x-gap="20" :y-gap="0">
										<n-gi :span="24">
											<n-form-item label="知识库">
												<n-input
													:value="knowledgeBaseName || '当前知识库'"
													disabled
													style="background: #F5F5F5;"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="title" label="标题">
												<n-input
													v-model:value="editFormValue.title"
													placeholder="请输入标题"
													clearable
													:maxlength="255"
													show-count
													@blur="updateEditFormValidation"
													@input="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="summary" label="摘要">
												<n-input
													type="textarea"
													v-model:value="editFormValue.summary"
													placeholder="请输入摘要"
													:autosize="{ minRows: 1, maxRows: 5 }"
													:maxlength="500"
													show-count
													clearable
													@blur="updateEditFormValidation"
													@input="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="vulnerabilityTypes" label="漏洞类型">
												<div class="cwe-selector-trigger">
													<n-button
														@click="openCweSelector('edit')"
														style="width: 100%; justify-content: flex-start;"
														quaternary
													>
														<template #icon>
															<SvgIcon icon="ri:file-list-line" />
														</template>
														{{ ((editFormValue as any).vulnerabilityTypes && (editFormValue as any).vulnerabilityTypes.length > 0)
															? `已选择 ${(editFormValue as any).vulnerabilityTypes.length} 项`
															: '选择漏洞类型' }}
													</n-button>
													<div v-if="(editFormValue as any).vulnerabilityTypes && (editFormValue as any).vulnerabilityTypes.length > 0" class="selected-cwe-tags">
														<n-space :size="8" wrap style="margin-top: 8px;">
															<n-tag
																v-for="cweId in (editFormValue as any).vulnerabilityTypes"
																:key="cweId"
																closable
																@close="removeCweFromEdit(cweId)"
																:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
															>
																{{ getCweDisplayName(cweId) }}
															</n-tag>
														</n-space>
													</div>
												</div>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="language" label="语言">
												<n-select
													v-model:value="editFormValue.language"
													:options="languageOptions"
													placeholder="请选择语言"
													clearable
													filterable
													@update:value="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="severity" label="风险等级">
												<n-select
													v-model:value="editFormValue.severity"
													:options="severityOptions"
													placeholder="请选择风险等级"
													clearable
													filterable
													@update:value="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="12">
											<n-form-item path="status" label="状态">
												<n-select
													v-model:value="editFormValue.status"
													:options="statusOptions"
													placeholder="请选择状态"
													@update:value="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="tags" label="标签">
												<TagPicker
													:model-value="selectedTagsForEdit"
													:system-tags="systemTags"
													:user-tags="userTags"
													placeholder="点击选择标签"
													@create="handleTagCreate"
													@update:model-value="handleEditTagsChange"
													@refresh="loadTagData"
												/>
											</n-form-item>
										</n-gi>
									</n-grid>
								</n-collapse-item>
								
								<n-collapse-item name="content" title="内容编辑">
									<n-grid :cols="24" :x-gap="20" :y-gap="0">
										<n-gi :span="24">
											<n-form-item path="problemDescription" label="问题描述">
												<n-input
													type="textarea"
													v-model:value="editFormValue.problemDescription"
													placeholder="请输入问题描述"
													:autosize="{ minRows: 1, maxRows: 10 }"
													clearable
													@blur="updateEditFormValidation"
													@input="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="fixSolution" label="修复方案">
												<n-input
													type="textarea"
													v-model:value="editFormValue.fixSolution"
													placeholder="请输入修复方案"
													:autosize="{ minRows: 2, maxRows: 10 }"
													clearable
													@blur="updateEditFormValidation"
													@input="updateEditFormValidation"
												/>
											</n-form-item>
										</n-gi>
										<n-gi :span="24">
											<n-form-item path="exampleCode" label="示例代码">
												<CodeEditor
													:model-value="editFormValue.exampleCode || ''"
													placeholder="请输入示例代码"
													:min-height="200"
													:max-height="500"
													:show-toolbar="true"
													:show-line-numbers="true"
													@update:model-value="(val) => { editFormValue.exampleCode = val; updateEditFormValidation(); }"
												/>
											</n-form-item>
										</n-gi>
									</n-grid>
								</n-collapse-item>
								
								<n-collapse-item name="advanced" title="风险评分">
									<n-grid :cols="24" :x-gap="20" :y-gap="20">
										<n-gi :span="24">
											<div class="risk-assessment-section">
												<div class="section-header">
													<span class="section-hint">选择以下维度，系统依据CVSS v4.0标准自动评估和存储风险等级</span>
												</div>
												<n-grid :cols="24" :x-gap="16" :y-gap="20" style="margin-top: 16px;">
													<n-gi :span="12">
														<n-form-item label="攻击方式" path="riskAttackVector">
															<n-select
																v-model:value="editFormValue.riskAttackVector"
																:options="riskAttackVectorOptions"
																placeholder="选择攻击方式"
																clearable
																@update:value="updateEditFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="12">
														<n-form-item label="利用复杂度" path="riskComplexity">
															<n-select
																v-model:value="editFormValue.riskComplexity"
																:options="riskComplexityOptions"
																placeholder="选择利用复杂度"
																clearable
																@update:value="updateEditFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="12">
														<n-form-item label="权限需求" path="riskPrivileges">
															<n-select
																v-model:value="editFormValue.riskPrivileges"
																:options="riskPrivilegesOptions"
																placeholder="选择权限需求"
																clearable
																@update:value="updateEditFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="12">
														<n-form-item label="用户交互" path="riskUserInteraction">
															<n-select
																v-model:value="editFormValue.riskUserInteraction"
																:options="riskUserInteractionOptions"
																placeholder="选择用户交互需求"
																clearable
																@update:value="updateEditFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
													<n-gi :span="24">
														<n-form-item label="影响范围" path="riskImpact">
															<n-select
																v-model:value="editFormValue.riskImpact"
																:options="riskImpactOptions"
																placeholder="选择影响范围（可多选）"
																multiple
																clearable
																@update:value="updateEditFormValidation"
															>
																<template #option="{ label, description }">
																	<div class="select-option">
																		<div class="option-label">{{ label }}</div>
																		<div class="option-desc">{{ description }}</div>
																	</div>
																</template>
															</n-select>
														</n-form-item>
													</n-gi>
												</n-grid>
											</div>
										</n-gi>
									</n-grid>
								</n-collapse-item>
							</n-collapse>
						</n-space>
					</n-form>
					
					<template #footer>
						<n-space justify="end" :size="12">
							<n-button @click="closeEditModal" secondary>
								关闭
							</n-button>
							<n-button 
								v-if="isEditFormDirty && canEditCurrentItem"
								@click="restoreEditForm" 
								secondary
							>
								恢复
							</n-button>
							<n-button 
								v-if="isEditFormDirty && canEditCurrentItem"
								type="primary" 
								@click="submitEditForm" 
								:loading="editing"
								:disabled="!isEditFormValid || editing"
							>
								保存
							</n-button>
						</n-space>
					</template>
				</n-modal>

				<!-- 片段列表模态框 -->
				<n-modal
					v-model:show="showFragmentListModal"
					preset="card"
					:title="currentItemForFragments ? `知识片段 - ${currentItemForFragments.title}` : '知识片段'"
					:mask-closable="true"
					:close-on-esc="true"
					style="width: 1400px; max-width: 95vw; max-height: 90vh;"
					:show-footer="false"
				>
					<FragmentListByItem
						v-if="currentItemForFragments?.itemUuid"
						:item-uuid="currentItemForFragments.itemUuid"
						:kid="filterState.kid"
					/>
				</n-modal>
			</div>
		</template>
		
		<style scoped>
		.knowledge-item-page-layout {
			display: flex;
			flex-direction: row;
			align-items: stretch;
			height: 100vh;
			width: 100%;
			overflow-x: hidden;
			overflow: hidden;
			background: var(--n-color-body, #FAF9F8);
			position: relative;
		}
		
		.main-content-area {
			flex: 1 1 auto;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			min-width: 0;
			max-width: 100%;
		}
		
		.main-content-area.has-detail {
			flex: 0 0 35%;
			max-width: 35%;
			min-width: 400px;
			flex-shrink: 0;
		}
		
		.page-toolbar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px 24px;
			background: #FFFFFF;
			border-bottom: 1px solid #EDEBE9;
			flex-shrink: 0;
			max-width: 100%;
			overflow-x: hidden;
		}
		
		.page-title {
			font-size: 20px;
			font-weight: 600;
			color: #323130;
			margin: 0;
		}
		
		.scrollable-content {
			flex: 1 1 auto;
			overflow-y: auto;
			overflow-x: hidden;
			display: flex;
			flex-direction: column;
			min-height: 0;
			scroll-behavior: smooth;
			position: relative;
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
		
		.filter-section {
			background: #FFFFFF;
			border-bottom: 1px solid #EDEBE9;
			padding: 10px 20px 12px;
			flex-shrink: 0;
			max-width: 100%;
			overflow-x: hidden;
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
		
		.filter-search-row > :first-child {
			flex: 0 0 auto;
		}
		
		.filter-search-row > :last-child {
			flex: 0 0 auto;
		}
		
		.facet-filters-row {
			display: grid;
			grid-template-columns: repeat(6, 1fr);
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
			border-radius: 4px;
			border: 1px solid #EDEBE9;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			animation: slideInRight 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		}
		
		.facet-group:nth-child(1),
		.facet-group:nth-child(2),
		.facet-group:nth-child(3) {
			grid-column: span 2;
		}
		
		.facet-group-advanced {
			grid-column: 1 / -1;
			border: 1px solid #EDEBE9;
			border-radius: 4px;
			background: #FAF9F8;
			padding: 12px 16px;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		.facet-group-advanced:has(.facet-group-nested:not(.facet-group-expanded)) {
			padding-bottom: 8px;
		}
		.facet-group-advanced:hover {
			background: #F5F5F5;
			border-color: #D1D1D1;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
		}
		
		.facet-group-advanced-header {
			display: flex;
			align-items: center;
			cursor: pointer;
			user-select: none;
			padding: 2px 0;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			gap: 6px;
		}
		
		.facet-group-advanced-header:hover {
			color: #FA8C16;
		}
		
		.facet-group-advanced-header:active {
			transform: scale(0.98);
		}
		
		.facet-group-advanced-header svg {
			transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			flex-shrink: 0;
		}
		
		.facet-label-advanced {
			font-size: 14px;
			font-weight: 600;
			color: #323130;
			white-space: nowrap;
			margin: 0;
			transition: color 0.2s ease;
		}
		
		.facet-group-advanced-content {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
			gap: 12px;
			padding-top: 12px;
			overflow-y: auto;
			animation: expandDown 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			transition: max-height 0.3s ease, padding 0.3s ease;
		}
		.facet-group-advanced-content:has(.facet-group-nested:not(.facet-group-expanded)) {
			max-height: none;
		}
		.facet-group-advanced-content:has(.facet-group-nested.facet-group-expanded) {
			max-height: 600px;
		}
		
		.facet-group-advanced-content::-webkit-scrollbar {
			width: 8px;
		}
		
		.facet-group-advanced-content::-webkit-scrollbar-track {
			background: transparent;
			border-radius: 4px;
		}
		
		.facet-group-advanced-content::-webkit-scrollbar-thumb {
			background: #D1D1D1;
			border-radius: 4px;
		}
		
		.facet-group-advanced-content::-webkit-scrollbar-thumb:hover {
			background: #A8A8A8;
		}
		
		.facet-group-nested {
			border: 1px solid #EDEBE9;
			border-radius: 4px;
			background: #FFFFFF;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			display: flex;
			flex-direction: column;
		}
		.facet-group-nested.facet-group-expanded {
			padding: 12px 16px;
			min-height: 200px;
			max-height: 500px;
		}
		.facet-group-nested:not(.facet-group-expanded) {
			padding: 8px 12px;
			min-height: auto;
			max-height: none;
		}
		
		.facet-nested-body {
			display: flex;
			flex-direction: column;
			flex: 1 1 auto;
			min-height: 0;
			overflow-y: auto;
			overflow-x: hidden;
			max-height: 420px;
			scroll-behavior: smooth;
		}
		.facet-nested-body::-webkit-scrollbar {
			width: 6px;
		}
		.facet-nested-body::-webkit-scrollbar-track {
			background: #F5F5F5;
			border-radius: 3px;
		}
		.facet-nested-body::-webkit-scrollbar-thumb {
			background: #D0D0D0;
			border-radius: 3px;
			transition: background 0.2s ease;
		}
		.facet-nested-body::-webkit-scrollbar-thumb:hover {
			background: #A8A8A8;
		}
		
		.facet-group-nested:hover {
			border-color: #C7C7C7;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		}
		
		.facet-group-toolbar {
			padding: 0 0 10px 0;
			border-bottom: 1px solid #F0F0F0;
			margin-bottom: 10px;
			flex-shrink: 0;
		}
		.cvss-slider-container {
			padding: 0 10px;
			margin-bottom: 16px;
		}
		.cvss-range-display {
			display: flex;
			justify-content: center;
			align-items: center;
			font-size: 14px;
			font-weight: 500;
			color: #333;
			margin-top: -20px;
			margin-bottom: 12px;
		}
		.cvss-bands-container {
			padding: 0 10px;
		}
		.cvss-band-range {
			font-size: 12px;
			color: #999;
			margin-left: 4px;
		}
		.date-filter-container {
			padding: 0 10px;
		}
		.date-range-picker-row {
			margin-bottom: 12px;
		}
		.date-quick-buttons {
			padding-top: 8px;
			border-top: 1px solid #F0F0F0;
		}
		.date-quick-count {
			margin-left: 4px;
			font-size: 12px;
			color: #999;
		}
		.cvss-metrics-container {
			margin-top: 16px;
			padding-top: 16px;
			border-top: 1px solid #F0F0F0;
		}
		.cvss-metrics-header {
			padding: 0 10px 12px 10px;
			cursor: pointer;
			user-select: none;
			transition: all 0.2s ease;
		}
		.cvss-metrics-header:hover {
			background: #F9F9F9;
			border-radius: 4px;
		}
		.cvss-metrics-title {
			font-size: 13px;
			font-weight: 500;
			color: #555;
		}
		.cvss-metrics-content {
			padding: 0 10px 10px 10px;
			animation: expandDown 0.3s ease;
		}
		.cvss-metric-item {
			margin-bottom: 14px;
			padding-bottom: 14px;
			border-bottom: 1px solid #F5F5F5;
		}
		.cvss-metric-item:last-child {
			border-bottom: none;
			margin-bottom: 0;
			padding-bottom: 0;
		}
		.cvss-metric-label {
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			font-weight: 500;
			color: #666;
			margin-bottom: 8px;
		}
		
		.facet-group-nested .facet-group-content {
			max-height: 450px;
			overflow-y: auto;
			flex: 1 1 auto;
			min-height: 0;
			padding-left: 20px;
		}
		
		.facet-group-nested .facet-group-content::-webkit-scrollbar {
			width: 6px;
		}
		
		.facet-group-nested .facet-group-content::-webkit-scrollbar-track {
			background: #F5F5F5;
			border-radius: 3px;
		}
		
		.facet-group-nested .facet-group-content::-webkit-scrollbar-thumb {
			background: #D1D1D1;
			border-radius: 3px;
		}
		
		.facet-group-nested .facet-group-content::-webkit-scrollbar-thumb:hover {
			background: #A8A8A8;
		}
		
		.facet-group-nested.facet-group-expanded {
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
			border-color: #D1D1D1;
		}
		
		.facet-group-expanded {
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
			background: #FFFFFF;
			border-color: #D1D1D1;
		}
		
		.facet-group:not(.facet-group-expanded) {
			padding: 8px 12px;
		}
		
		.facet-group:hover {
			background: #F5F5F5;
			border-color: #D1D1D1;
			transform: translateY(-1px);
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
		}
		
		.facet-group-header {
			display: flex;
			align-items: center;
			cursor: pointer;
			user-select: none;
			padding: 2px 0;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			flex-wrap: wrap;
			gap: 6px;
		}
		
		.facet-group-header:hover {
			color: #0078D4;
		}
		
		.facet-group-header:active {
			transform: scale(0.98);
		}
		
		.facet-group-header svg {
			transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			flex-shrink: 0;
		}
		
		.facet-group-content {
			padding-left: 20px;
			overflow: visible;
			animation: expandDown 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		.facet-group-content :deep(.n-space) {
			width: 100%;
			line-height: 1.5;
		}
		
		.facet-group-content :deep(.n-checkbox) {
			margin: 2px 0;
			transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		.facet-group-content :deep(.n-checkbox:hover) {
			transform: translateX(2px);
		}
		
		.facet-group-content :deep(.n-checkbox:active) {
			transform: scale(0.98);
		}
		
		.facet-group-content :deep(.n-checkbox__label) {
			white-space: normal;
			word-break: break-word;
			line-height: 1.4;
		}
		
		.facet-label {
			font-size: 13px;
			font-weight: 600;
			color: #323130;
			white-space: nowrap;
			margin: 0;
			transition: color 0.2s ease;
		}
		
		.tag-group-title {
			display: flex;
			align-items: center;
			font-size: 12px;
			font-weight: 600;
			color: #605E5C;
			padding: 4px 0;
			border-bottom: 1px solid #EDEBE9;
			margin-bottom: 2px;
		}
		
		.facet-group-content :deep(.n-input) {
			transition: all 0.2s ease;
		}
		
		.facet-group-content :deep(.n-input:focus-within) {
			box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.1);
		}
		
		.facet-group-vuln-type :deep(.n-collapse) {
			border: none;
		}
		
		.facet-group-vuln-type :deep(.n-collapse-item) {
			border: 1px solid #EDEBE9;
			border-radius: 3px;
			margin-bottom: 4px;
			background: #FFFFFF;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
			            border-color 0.2s ease,
			            box-shadow 0.25s ease;
			will-change: border-color, box-shadow;
		}
		
		.facet-group-vuln-type :deep(.n-collapse-item:hover) {
			border-color: #D1D1D1;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		}
		
		.facet-group-vuln-type :deep(.n-collapse-item__header) {
			padding: 4px 8px;
			font-size: 12px;
			min-height: 30px;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		.facet-group-vuln-type :deep(.n-collapse-item__header:active) {
			transform: scale(0.98);
		}
		
		.facet-group-vuln-type :deep(.n-collapse-item__content-wrapper) {
			padding: 6px 8px;
		}
		
		.cluster-header {
			display: flex;
			align-items: center;
			width: 100%;
			gap: 6px;
		}
		
		.cluster-name {
			font-weight: 500;
			color: #323130;
			font-size: 12px;
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		
		.vuln-type-by-cluster {
			flex: 1 1 auto;
			min-height: 0;
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
			flex-shrink: 0;
		}
		
		.facet-group-content :deep(.n-checkbox__label) {
			display: flex;
			align-items: center;
			width: 100%;
			gap: 4px;
		}
		
		.facet-group-skeleton {
			padding: 12px 16px;
			background: #FAF9F8;
			border-radius: 4px;
			border: 1px solid #EDEBE9;
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
		
		@keyframes spin {
			0% {
				transform: rotate(0deg);
			}
			100% {
				transform: rotate(360deg);
			}
		}
		.search-loading {
			animation: spin 1s linear infinite;
			color: #FA8C16;
		}
		
		@keyframes pulse {
			0%, 100% {
				transform: scale(1);
				opacity: 0.3;
			}
			50% {
				transform: scale(1.3);
				opacity: 0.05;
			}
		}
		
		@keyframes fadeInOut {
			0%, 100% {
				opacity: 1;
			}
			50% {
				opacity: 0.6;
			}
		}
		
		@keyframes expandDown {
			0% {
				opacity: 0;
				max-height: 0;
				transform: translateY(-10px) scale(0.98);
			}
			60% {
				opacity: 0.8;
				transform: translateY(0) scale(1.005);
			}
			100% {
				opacity: 1;
				max-height: 800px;
				transform: translateY(0) scale(1);
			}
		}
		
		@keyframes slideInRight {
			0% {
				opacity: 0;
				transform: translateX(-15px) scale(0.98);
			}
			60% {
				transform: translateX(2px) scale(1.01);
			}
			100% {
				opacity: 1;
				transform: translateX(0) scale(1);
			}
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
		
		.list-pagination {
			padding: 16px 0;
			display: flex;
			justify-content: center;
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
			position: relative;
			flex-shrink: 0;
			order: 2;
			transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
			            opacity 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
			opacity: 0;
			transform: translateX(30px);
			will-change: transform, opacity;
		}
		
		.detail-panel-area.detail-panel-visible {
			opacity: 1;
			transform: translateX(0);
		}
		
		.detail-panel {
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
			display: flex;
			flex-direction: column;
			min-width: 0;
			padding: 20px;
			scroll-behavior: smooth;
			animation: fadeInUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		@keyframes fadeInUp {
			0% {
				opacity: 0;
				transform: translateY(15px);
			}
			100% {
				opacity: 1;
				transform: translateY(0);
			}
		}
		
		.detail-panel::-webkit-scrollbar {
			width: 8px;
		}
		
		.detail-panel::-webkit-scrollbar-track {
			background: transparent;
		}
		
		.detail-panel::-webkit-scrollbar-thumb {
			background-color: rgba(0, 0, 0, 0.1);
			border-radius: 4px;
			transition: background-color 0.2s ease;
		}
		
		.detail-panel::-webkit-scrollbar-thumb:hover {
			background-color: rgba(0, 0, 0, 0.2);
		}
		
		.list-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
		}
		
		.header-left {
			display: flex;
			align-items: center;
			flex: 1;
		}
		
		.header-left h2 {
			margin: 0;
			font-size: 18px;
			font-weight: 600;
			color: #202020;
		}
		
		.header-right {
			display: flex;
			align-items: center;
			flex-shrink: 0;
		}
		
		.back-button {
			display: flex;
			align-items: center;
			color: #606060;
		}
		
		.toolbar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px 0;
			border-bottom: 1px solid #E0E0E0;
			margin-bottom: 16px;
		}
		
		.toolbar-left,
		.toolbar-right {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		
		.toolbar-left {
			flex: 0 1 auto;
			min-width: 0;
		}
		
		.toolbar-right {
			flex: 0 0 auto;
		}
		
		.list-view {
			min-height: 400px;
		}
		
		.knowledge-table {
			background: #FFFFFF;
		}
		
		.knowledge-table :deep(.n-data-table-th) {
			background: #F5F5F5;
			color: #404040;
			font-weight: 500;
		}
		
		.knowledge-table :deep(.n-data-table-td) {
			border-bottom: 1px solid #F0F0F0;
		}
		
		.knowledge-table :deep(.n-data-table-tr:hover) {
			background: #F9F9F9;
			transition: background-color 0.2s ease;
		}
		
		.grouped-list {
			background: #FFFFFF;
		}
		
		.card-view {
			min-height: 400px;
		}
		
		.knowledge-item-card {
			background: #FFFFFF;
			border: 1px solid #E0E0E0;
			border-radius: 8px;
			padding: 16px;
			cursor: pointer;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		}
		
		.knowledge-item-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			border-color: #C0C0C0;
		}
		
		.card-header {
			margin-bottom: 12px;
		}
		
		.card-title {
			margin: 0 0 8px 0;
			font-size: 16px;
			font-weight: 600;
			color: #202020;
			line-height: 1.4;
		}
		
		.card-tags {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}
		
		.card-body {
			margin-bottom: 12px;
		}
		
		.card-summary {
			margin: 0;
			font-size: 14px;
			color: #606060;
			line-height: 1.5;
			display: -webkit-box;
			-webkit-line-clamp: 3;
			line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
		
		.card-footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-top: 12px;
			border-top: 1px solid #F0F0F0;
		}
		
		.card-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}
		
		.card-time {
			font-size: 12px;
			color: #808080;
		}
		
		.grouped-cards {
			background: #FFFFFF;
		}
		
		.pagination-wrapper {
			display: flex;
			justify-content: center;
			padding: 24px 0;
			margin-top: 16px;
			border-top: 1px solid #E0E0E0;
		}
		
		@media (max-width: 1200px) {
			.card-view :deep(.n-grid) {
				grid-template-columns: repeat(2, 1fr) !important;
			}
		}
		
		@media (max-width: 600px) {
			.card-view :deep(.n-grid) {
				grid-template-columns: 1fr !important;
			}
			
			.list-header {
				flex-direction: column;
				align-items: flex-start;
				gap: 12px;
			}
			
			.header-left,
			.header-right {
				width: 100%;
			}
			
			.toolbar {
				flex-direction: column;
				align-items: stretch;
				gap: 12px;
			}
			
			.toolbar-left,
			.toolbar-right {
				width: 100%;
				justify-content: space-between;
			}
		}
		
		.knowledge-item-form {
			max-height: calc(90vh - 200px);
			overflow-y: auto;
		}
		
		/* 折叠面板样式（参考知识库创建/编辑页面） */
		.knowledge-item-form :deep(.n-collapse-item) {
			border: 1px solid #e1dfdd;
			border-radius: 4px;
			margin-bottom: 0px;
			transition: all 0.2s ease;
			background: #fff;
		}

		.knowledge-item-form :deep(.n-collapse-item:hover) {
			border-color: #c8c6c4;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		}

		.knowledge-item-form :deep(.n-collapse-item__header) {
			font-weight: 500;
			color: #323130;
			font-size: 15px;
			padding: 0px 16px;
			height: auto;
			min-height: 36px;
			transition: background-color 0.15s ease;
			cursor: pointer;
			position: relative;
			width: 100%;
			display: flex;
			align-items: center;
			user-select: none;
		}

		.knowledge-item-form :deep(.n-collapse-item__header:hover) {
			background-color: #faf9f8;
		}

		.knowledge-item-form :deep(.n-collapse-item__header-main) {
			display: flex;
			align-items: center;
			flex: 1;
			width: 100%;
			height: 100%;
			padding: 0;
			margin: 0;
			line-height: 1.5;
			min-height: 36px;
			cursor: pointer;
		}

		.knowledge-item-form :deep(.n-collapse-item__header-extra) {
			display: flex;
			align-items: center;
			flex-shrink: 0;
		}

		.knowledge-item-form :deep(.n-collapse-item__header-arrow) {
			font-size: 16px;
			color: #605e5c;
			margin-right: 8px;
			transition: transform 0.2s ease;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
		}

		.knowledge-item-form :deep(.n-collapse-item--active .n-collapse-item__header-arrow) {
			transform: rotate(90deg);
		}

		.knowledge-item-form :deep(.n-collapse-item__content-wrapper) {
			padding: 0 16px 16px 16px;
		}

		.knowledge-item-form :deep(.n-collapse) {
			margin-top: 0;
			margin-bottom: 0;
		}

		.knowledge-item-form :deep(.n-collapse-item + .n-collapse-item) {
			margin-top: 8px;
		}

		/* 确保代码编辑器占满宽度 */
		.knowledge-item-form :deep(.n-form-item__body) {
			width: 100%;
		}
		
		.knowledge-item-form :deep(.n-form-item__body-wrapper) {
			width: 100%;
		}
		
		.knowledge-item-form :deep(.n-form-item-feedback-wrapper:empty),
		.knowledge-item-form :deep(.n-form-item__feedback:empty) {
			height: 11px;
			min-height: 11px;
			margin: 0;
			padding: 0;
			line-height: 4px;
			font-size: 0;
		}

		.knowledge-item-form :deep(.n-form-item-feedback-wrapper:not(:empty)),
		.knowledge-item-form :deep(.n-form-item__feedback:not(:empty)) {
			min-height: auto;
		}

		.cwe-selector-trigger {
			width: 100%;
		}

		.selected-cwe-tags {
			margin-top: 8px;
			max-height: 96px;
			overflow-y: auto;
			padding: 4px 0;
		}

		/* 已选漏洞类型滚动区域滚动条样式（参照标签选择器） */
		.selected-cwe-tags::-webkit-scrollbar {
			width: 6px;
			height: 6px;
		}

		.selected-cwe-tags::-webkit-scrollbar-track {
			background: #f5f5f5;
			border-radius: 3px;
		}

		.selected-cwe-tags::-webkit-scrollbar-thumb {
			background: #d1d1d1;
			border-radius: 3px;
		}

		.selected-cwe-tags::-webkit-scrollbar-thumb:hover {
			background: #a8a8a8;
		}
		
		/* 风险评分区域样式 */
		.risk-assessment-section {
			padding: 0;
		}
		
		.section-header {
			display: flex;
			align-items: baseline;
			gap: 8px;
			margin-bottom: 4px;
		}
		
		.section-title {
			font-size: 15px;
			font-weight: 600;
			color: #323130;
			letter-spacing: -0.01em;
		}
		
		.section-hint {
			font-size: 13px;
			color: #605e5c;
			font-weight: 400;
		}
		
		.select-option {
			padding: 2px 0;
		}
		
		.option-label {
			font-size: 14px;
			font-weight: 500;
			color: #323130;
			line-height: 1.4;
		}
		
		.option-desc {
			font-size: 12px;
			color: #8a8886;
			margin-top: 4px;
			line-height: 1.4;
		}

		.detail-tags-container {
			max-height: 200px;
			overflow-y: auto;
			padding: 8px 0;
			max-width: 100%;
			box-sizing: border-box;
		}

		.detail-tags-container::-webkit-scrollbar {
			width: 6px;
			height: 6px;
		}

		.detail-tags-container::-webkit-scrollbar-track {
			background: transparent;
			border-radius: 3px;
		}

		.detail-tags-container::-webkit-scrollbar-thumb {
			background: #d1d1d1;
			border-radius: 3px;
		}

		.detail-tags-container::-webkit-scrollbar-thumb:hover {
			background: #a8a8a8;
		}
		
		.active-filters-bar {
			padding: 8px 20px;
			background: #FAF9F8;
			border-bottom: 1px solid #EDEBE9;
			margin-bottom: 0;
			animation: slideDown 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		.active-filters-bar :deep(.n-tag) {
			transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		.active-filters-bar :deep(.n-tag:hover) {
			transform: translateY(-1px);
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
		}
		
		.active-filters-bar :deep(.n-tag:active) {
			transform: scale(0.95);
		}
		
		@keyframes slideDown {
			0% {
				opacity: 0;
				transform: translateY(-12px);
			}
			60% {
				transform: translateY(2px);
			}
			100% {
				opacity: 1;
				transform: translateY(0);
			}
		}
		
		/* 列表与详情布局样式 */
		.master-detail-layout {
			height: calc(100vh - 300px);
			min-height: 600px;
		}
		
		.master-detail-layout :deep(.n-layout) {
			height: 100%;
		}
		
		.master-list-sider {
			background: #FAF9F8;
		}
		
		.master-list-sider :deep(.n-layout-sider-scroll-container) {
			background: #FAF9F8;
		}
		
		.master-list-sider :deep(.n-layout-sider) {
			background: #FAF9F8;
		}
		
		.master-list-container {
			height: 100%;
			display: flex;
			flex-direction: column;
			background: #FAF9F8;
		}
		
		.master-list-container :deep(.n-list) {
			flex: 1;
			overflow-y: auto;
			background: transparent;
		}
		
		.master-list-container :deep(.n-list-item) {
			padding: 12px 16px;
			border-bottom: 1px solid #EDEBE9;
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
			            transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
			            box-shadow 0.25s ease;
			will-change: background-color, transform, box-shadow;
		}
		
		.master-list-container :deep(.n-list-item:hover) {
			background-color: #F3F2F1;
			transform: translateX(2px);
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		}
		
		.master-list-container :deep(.n-list-item:active) {
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
		
		.list-item-header {
			display: flex;
			align-items: center;
			gap: 12px;
		}
		
		.item-checkbox {
			flex-shrink: 0;
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
		
		.list-item-checked {
			background-color: #E3F2FD !important;
		}
		
		.list-item-checked :deep(.n-list-item) {
			background-color: #E3F2FD !important;
		}
		
		.list-select-all-bar {
			padding: 12px 16px;
			background-color: #FAFAFA;
			border-bottom: 1px solid #E5E5E5;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		
		.multi-select-hint {
			display: flex;
			align-items: center;
			font-size: 12px;
			color: #999;
			margin-left: auto;
			padding-left: 16px;
		}
		
		.selection-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 16px;
			background-color: #F5F5F5;
			border-top: 1px solid #E5E5E5;
			border-bottom: 1px solid #E5E5E5;
			margin-bottom: 8px;
		}
		
		.selection-bar-left {
			flex: 0 0 auto;
		}
		
		.selection-bar-center {
			flex: 1;
			display: flex;
			justify-content: flex-start;
		}
		
		.selection-bar-right {
			flex: 0 0 auto;
			display: flex;
			justify-content: flex-end;
		}
		
		.total-hint {
			color: #999;
			font-size: 12px;
			margin-left: 4px;
		}
		
		.selection-count {
			font-size: 14px;
			color: #666;
			font-weight: 500;
		}
		
		.cross-page-hint {
			color: #999;
			font-size: 12px;
			margin-left: 4px;
		}
		
		.export-dialog-content {
			padding: 20px 0;
		}
		
		.export-steps-wrapper {
			display: flex;
			justify-content: center;
			align-items: center;
			width: 100%;
		}
		
		.export-steps-wrapper :deep(.n-steps) {
			width: auto;
			max-width: 100%;
		}
		
		.export-steps-wrapper :deep(.n-steps .n-step) {
			flex: 0 0 auto;
		}
		
		.export-step-content {
			margin-top: 24px;
			min-height: 300px;
		}
		
		.export-step-content :deep(.n-spin-container) {
			height: 100%;
		}
		
		.field-selection-preview-layout {
			display: flex;
			gap: 16px;
			height: 600px;
		}
		
		.field-selection-panel {
			flex: 0 0 auto;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			min-width: 250px;
			max-width: 600px;
			height: 100%;
		}
		
		.field-selection-card {
			display: flex;
			flex-direction: column;
			height: 100%;
			overflow: hidden;
		}
		
		.field-selection-card :deep(.n-card__content) {
			flex: 1 1 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			min-height: 0;
		}
		
		.field-selection-card :deep(.n-scrollbar) {
			flex: 1 1 0;
			min-height: 0;
		}
		
		.layout-divider {
			width: 4px;
			background-color: #e5e5e5;
			cursor: col-resize;
			user-select: none;
			transition: background-color 0.2s;
			position: relative;
		}
		
		.layout-divider:hover {
			background-color: #1890ff;
		}
		
		.layout-divider.dragging {
			background-color: #1890ff;
		}
		
		.layout-divider::before {
			content: '';
			position: absolute;
			left: -2px;
			right: -2px;
			top: 0;
			bottom: 0;
		}
		
		.preview-panel {
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			min-width: 0;
		}
		
		.preview-panel :deep(.n-scrollbar) {
			flex: 1;
			overflow-y: auto;
		}
		
		.preview-panel :deep(.n-card) {
			margin-bottom: 0;
		}
		
		.export-summary-row {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 13px;
		}
		
		.summary-label {
			color: #666;
			font-weight: 500;
			min-width: 100px;
		}
		
		.summary-value {
			color: #333;
		}
		
		.field-list-info {
			font-size: 13px;
			color: #666;
			margin-bottom: 8px;
		}
		
		.field-list-tags {
			display: flex;
			flex-wrap: wrap;
			align-items: flex-start;
			min-height: 40px;
			padding: 4px 0 4px 0;
		}
		
		.field-list-tags .drag-handle {
			cursor: move;
			transition: opacity 0.2s, transform 0.2s;
			margin-top: 0;
			vertical-align: middle;
		}
		
		.field-list-tags .drag-handle :deep(.n-tag__content) {
			display: inline-flex;
			align-items: center;
			line-height: 1.5;
		}
		
		.field-list-tags .drag-handle:hover {
			opacity: 0.8;
		}
		
		.field-list-tags .drag-handle.dragging {
			opacity: 0.5;
		}
		
		.field-list-tags .drag-handle.drag-over {
			transform: translateY(-2px);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		}
		
		.field-list-tags .drag-handle span:first-child {
			color: #999;
			font-size: 12px;
			margin-right: 4px;
		}
		
		
		.preview-data-info {
			font-size: 12px;
			color: #999;
			margin-bottom: 12px;
		}
		
		.preview-table-container {
			border: 1px solid #e5e5e5;
			border-radius: 4px;
			overflow: hidden;
		}
		
		.preview-table-container .n-scrollbar {
			width: 100%;
		}
		
		.preview-table-container .n-scrollbar-content {
			overflow-x: auto;
		}
		
		.preview-table-container :deep(.n-data-table) {
			table-layout: auto;
		}
		
		.preview-table-container :deep(.n-data-table-th),
		.preview-table-container :deep(.n-data-table-td) {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		
		.preview-table-container.excel-preview {
			border-color: #d9d9d9;
		}
		
		.preview-table-container.excel-preview :deep(.n-data-table-thead th) {
			background-color: #f5f5f5;
			font-weight: 600;
			border-bottom: 2px solid #d9d9d9;
		}
		
		.preview-table-container :deep(.n-data-table-th) {
			background-color: #f5f5f5;
			font-weight: 600;
		}
		
		.preview-table-container :deep(.even-row) {
			background-color: #ffffff;
		}
		
		.preview-table-container :deep(.odd-row) {
			background-color: #fafafa;
		}
		
		.preview-empty {
			padding: 40px 0;
			text-align: center;
		}
		
		.pdf-preview-container {
			border: 1px solid #e5e5e5;
			border-radius: 4px;
			padding: 16px;
			background-color: #fff;
			max-height: 500px;
			overflow: auto;
		}
		
		.pdf-preview-container table {
			width: 100%;
			border-collapse: collapse;
		}
		
		.pdf-preview-container table th,
		.pdf-preview-container table td {
			border: 1px solid #ddd;
			padding: 8px;
			text-align: left;
		}
		
		.pdf-preview-container table th {
			background-color: #f5f5f5;
			font-weight: 600;
		}
		
		.export-dialog-actions {
			margin-top: 24px;
			padding-top: 16px;
			border-top: 1px solid #e5e5e5;
		}
		
		.batch-edit-tags-content {
			padding: 20px 0;
			max-height: 70vh;
			overflow-y: auto;
		}
		
		.batch-edit-tags-header {
			margin-bottom: 16px;
		}
		
		.batch-edit-tags-info {
			font-size: 14px;
			color: #606060;
			margin-bottom: 12px;
		}
		
		.batch-edit-tags-filter-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 16px;
			margin-bottom: 16px;
			background: #faf9f8;
			border-radius: 4px;
			border: 1px solid #e0e0e0;
		}
		
		.batch-edit-tags-list {
			margin-bottom: 20px;
		}
		
		.batch-edit-tag-card {
			position: relative;
			padding: 12px;
			border: 1px solid #d1d1d1;
			border-radius: 4px;
			background: #ffffff;
			cursor: pointer;
			transition: all 0.15s ease;
		}
		
		.batch-edit-tag-card:hover {
			border-color: #0078d4;
			background: #f3f2f1;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		}
		
		.batch-edit-tag-card :deep(.n-checkbox) {
			width: 100%;
		}
		
		.batch-edit-tag-card :deep(.n-checkbox__label) {
			width: 100%;
			padding-left: 0;
		}
		
		.tag-card-content {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		
		.tag-name-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 8px;
		}
		
		.tag-name {
			font-size: 14px;
			font-weight: 500;
			color: #323130;
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		
		.tag-type-badge {
			font-size: 11px;
			padding: 2px 6px;
			border-radius: 2px;
			font-weight: 500;
			white-space: nowrap;
			flex-shrink: 0;
		}
		
		.tag-type-system {
			background: #0078d4;
			color: #ffffff;
		}
		
		.tag-type-user {
			background: #f0f0f0;
			color: #605e5c;
		}
		
		.tag-desc {
			font-size: 12px;
			color: #8a8886;
			line-height: 1.4;
			overflow: hidden;
			text-overflow: ellipsis;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
		}
		
		.tag-state-hint {
			margin-top: 4px;
		}
		
		.state-text {
			font-size: 11px;
			padding: 2px 6px;
			border-radius: 2px;
		}
		
		.state-all {
			background: #e8f5e9;
			color: #2e7d32;
		}
		
		.state-some {
			background: #fff3e0;
			color: #e65100;
		}
		
		.state-none {
			background: #f5f5f5;
			color: #757575;
		}
		
		.batch-edit-tags-footer {
			display: flex;
			justify-content: flex-end;
			padding-top: 16px;
			border-top: 1px solid #e5e5e5;
		}
		
		.empty-state {
			text-align: center;
			padding: 40px 20px;
			color: #8a8886;
		}
		
		.empty-icon {
			font-size: 48px;
			margin-bottom: 12px;
		}
		
		.empty-text {
			font-size: 14px;
			margin-bottom: 8px;
		}
		
		.empty-hint {
			font-size: 12px;
			color: #a8a6a4;
		}
		
		.more-tags-hint {
			margin-top: 8px;
			text-align: center;
			padding: 8px;
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
		.meta-mobile-main {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 12px;
			flex-wrap: wrap;
		}
		.meta-mobile-left {
			display: flex;
			align-items: center;
			gap: 6px;
			flex-wrap: wrap;
			flex: 1;
			min-width: 0;
		}
		.meta-mobile-right {
			display: flex;
			align-items: center;
			gap: 6px;
			flex-wrap: wrap;
			flex-shrink: 0;
		}
		.risk-badge-mobile {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 11px;
			font-weight: 600;
			white-space: nowrap;
			margin-right: 6px;
		}
		.cvss-badge-mobile {
			border: 1px solid rgba(255, 255, 255, 0.3);
		}
		.severity-badge-mobile {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 11px;
			font-weight: 600;
			white-space: nowrap;
			margin-right: 6px;
		}
		.manual-badge-mobile {
			border: 1px dashed rgba(255, 255, 255, 0.5);
			position: relative;
		}
		.manual-badge-mobile::before {
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
		.meta-time-row-mobile {
			display: flex;
			align-items: center;
			gap: 16px;
			font-size: 11px;
			padding-top: 6px;
		}
		.time-item-mobile {
			display: inline-flex;
			align-items: center;
			gap: 4px;
		}
		.time-icon-mobile {
			font-size: 13px;
		}
		.time-label-mobile {
			font-weight: 400;
			opacity: 0.85;
		}
		.time-value-mobile {
			font-weight: 500;
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
		.list-item-footer {
			margin-top: 8px;
		}
		
		.list-item-time {
			font-size: 12px;
			color: #605E5C;
		}
		
		.master-list-pagination {
			padding: 16px 20px;
			border-top: 1px solid #EDEBE9;
			background: #FFFFFF;
		}
		
		.detail-content {
			background: #FFFFFF;
			padding: 0;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}
		
		.detail-actions-header {
			padding: 12px 20px;
			border-bottom: 1px solid #EDEBE9;
			background: #FAF9F8;
			flex-shrink: 0;
			max-width: 100%;
			box-sizing: border-box;
			position: sticky;
			top: 0;
			z-index: 10;
		}
		
		.detail-panel {
			flex: 1;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
		}
		
		/* 详情文档样式 */
		.detail-document {
			width: 100%;
			max-width: 100%;
			box-sizing: border-box;
			overflow-wrap: break-word;
			word-wrap: break-word;
			word-break: break-word;
		}
		
		.mobile-detail-document {
			padding: 20px 16px;
		}
		
		.detail-hero {
			margin-bottom: 32px;
			padding-bottom: 24px;
			border-bottom: 2px solid #EDEBE9;
		}
		
		.detail-title {
			font-size: 32px;
			font-weight: 700;
			color: #323130;
			margin: 0 0 20px 0;
			line-height: 1.2;
			letter-spacing: -0.01em;
			word-wrap: break-word;
			overflow-wrap: break-word;
			max-width: 100%;
		}
		
		.detail-meta-tags {
			margin-top: 20px;
			max-width: 100%;
			overflow-wrap: break-word;
		}
		
		.detail-section {
			margin-bottom: 40px;
		}
		
		.detail-section-title {
			font-size: 20px;
			font-weight: 600;
			color: #323130;
			margin: 0 0 16px 0;
			padding-bottom: 12px;
			border-bottom: 1px solid #EDEBE9;
			letter-spacing: -0.01em;
		}
		
		.detail-text {
			font-size: 15px;
			line-height: 1.8;
			color: #323130;
			margin: 0;
			word-wrap: break-word;
			overflow-wrap: break-word;
			max-width: 100%;
		}
		
		.markdown-content {
			white-space: pre-wrap;
			color: #605E5C;
			word-wrap: break-word;
			overflow-wrap: break-word;
			max-width: 100%;
		}
		
		/* 风险评分区域 */
		.detail-risk-section {
			background: #FAF9F8;
			border-radius: 4px;
			padding: 24px;
			margin-bottom: 32px;
			border: 1px solid #EDEBE9;
		}
		
		.risk-score-display {
			display: flex;
			flex-direction: column;
			gap: 24px;
		}
		
		.risk-score-value {
			display: flex;
			align-items: baseline;
			gap: 12px;
		}
		
		.score-number {
			font-size: 56px;
			font-weight: 700;
			color: #323130;
			line-height: 1;
		}
		
		.score-label {
			font-size: 20px;
			color: #605E5C;
			font-weight: 400;
		}
		
		.risk-components {
			margin-top: 20px;
		}
		
		.risk-component-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 16px;
		}
		
		.risk-component-item {
			display: flex;
			flex-direction: column;
			gap: 6px;
			padding: 12px;
			background: #FFFFFF;
			border-radius: 4px;
			border: 1px solid #EDEBE9;
		}
		
		.component-label {
			font-size: 13px;
			color: #605E5C;
			font-weight: 400;
		}
		
		.component-value {
			font-size: 15px;
			font-weight: 600;
			color: #323130;
		}
		
		/* CVSS向量详情样式 */
		.cvss-vector-details {
			margin-top: 24px;
			padding-top: 24px;
			border-top: 1px solid #EDEBE9;
		}
		
		.cvss-details-title {
			font-size: 16px;
			font-weight: 600;
			color: #323130;
			margin: 0 0 16px 0;
		}
		
		.cvss-details-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 12px;
			max-width: 100%;
		}
		
		.cvss-detail-item {
			display: flex;
			flex-direction: column;
			gap: 4px;
			padding: 12px;
			background: #FFFFFF;
			border-radius: 4px;
			border: 1px solid #EDEBE9;
		}
		
		.cvss-detail-label {
			font-size: 12px;
			color: #605E5C;
			font-weight: 400;
		}
		
		.cvss-detail-value {
			font-size: 14px;
			color: #323130;
			font-weight: 500;
		}
		
		/* 代码显示区域 */
		.detail-code-section {
			background: #FAF9F8;
			border-radius: 4px;
			padding: 24px;
			border: 1px solid #EDEBE9;
		}
		
		.code-display-wrapper {
			border: 1px solid #EDEBE9;
			border-radius: 4px;
			overflow: hidden;
			background: #FFFFFF;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
			max-width: 100%;
			box-sizing: border-box;
		}
		
		.code-toolbar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 10px 16px;
			border-bottom: 1px solid #EDEBE9;
			background: #FAF9F8;
		}
		
		.code-label {
			font-size: 13px;
			color: #605E5C;
			font-weight: 600;
		}
		
		/* 元信息区域 */
		.detail-meta-section {
			background: #FAF9F8;
			border-radius: 4px;
			padding: 24px;
			border: 1px solid #EDEBE9;
		}
		
		.meta-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 16px;
			max-width: 100%;
			box-sizing: border-box;
		}
		
		.meta-item {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		
		.meta-label {
			font-size: 13px;
			color: #605E5C;
			font-weight: 400;
		}
		
		.meta-value {
			font-size: 15px;
			color: #323130;
			font-weight: 400;
		}
		
		/* 操作按钮 */
		.detail-actions {
			margin-top: 40px;
			padding-top: 24px;
			border-top: 1px solid #EDEBE9;
		}
		
		/* 移动端样式 */
		.mobile-list-view {
			padding: 16px;
		}
		
		:deep(.n-button) {
			transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}
		
		:deep(.n-button:active) {
			transform: scale(0.96);
		}
		
		:deep(.n-collapse-item) {
			transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		}

		@media (max-width: 768px) {
			.filter-section {
				padding: 8px 12px;
			}
			
			.filter-search-row {
				flex-direction: column;
				align-items: stretch;
				gap: 8px;
			}
			
			.facet-filters-row {
				grid-template-columns: 1fr;
				gap: 8px;
			}
			
			.facet-group {
				padding: 10px 12px;
				grid-column: span 1 !important;
			}
			
			.facet-group-advanced {
				padding: 10px 12px;
			}
			
			.facet-group-advanced-content {
				grid-template-columns: 1fr;
				max-height: 500px;
			}
			
			.facet-group-nested {
				padding: 10px 12px;
			}
			
			.facet-nested-body {
				max-height: 350px;
			}
			
			.facet-group-nested .facet-group-content {
				max-height: 350px;
			}
			
			.detail-document {
				padding: 16px;
			}
			
			.detail-title {
				font-size: 24px;
			}
			
			.score-number {
				font-size: 36px;
			}
			
			.risk-component-grid {
				grid-template-columns: 1fr;
			}
		}
		
		</style>
			
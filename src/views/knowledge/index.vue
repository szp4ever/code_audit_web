<script setup lang="ts">
import { h, onMounted, onBeforeUnmount, onActivated, reactive, ref, computed, watch, nextTick } from "vue";
import {
	NButton,
	DrawerPlacement,
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
	NInputNumber,
	NSelect,
	NPagination,
	NCard,
	NCollapse,
	NCollapseItem,
	FormInst,
	FormRules,
	NTooltip,
	NDataTable,
	NTag,
	NEmpty,
	NDatePicker,
	NButtonGroup,
	NCheckbox,
	NCheckboxGroup,
	NModal,
	NPopover,
	NAlert,
	NSpin,
} from "naive-ui";
import { SvgIcon, GlobalUploadTrigger, GlobalUploadManager } from "@/components/common";
import TagManageModal from "@/components/knowledge/TagManageModal.vue";
import { useUploadStore } from "@/store/modules/upload";
import { uploadService } from "@/services/uploadService";
import {
	createKnowledgeReq,
	updateKnowledgeReq,
	getKnowledgeByRole as getKnowledge,
	delKnowledge,
	delKnowledgeBatch,
	refreshKnowledgeStatistics,
	type KnowledgeReq,
	type KnowledgeListQuery,
} from "@/api/knowledge";
import { getDictDataByType } from "@/api/dict";
import { useRouter } from "vue-router";
import { t } from "@/locales";
import { getModelListByCategory } from "@/api/model";
import { getPromptTemplateListByCategory } from "@/api/promptTemplate";
import { getUserInfo } from "@/api/user";

const STORAGE_KEY = 'knowledge_list_state';
const STATE_EXPIRY_TIME = 5 * 60 * 1000; // 5分钟过期

interface SavedState {
	timestamp: number;
	filterState: any;
	pagination: any;
	searchKeyword: string;
	viewMode: 'list' | 'card';
	scrollPosition: number;
}

function saveStateToStorage() {
	try {
		const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;
		const state: SavedState = {
			timestamp: Date.now(),
			filterState: { ...filterState },
			pagination: { ...pagination },
			searchKeyword: searchKeyword.value,
			viewMode: viewMode.value,
			scrollPosition,
		};
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.error('保存状态失败:', error);
	}
}

function restoreStateFromStorage(): boolean {
	try {
		const saved = sessionStorage.getItem(STORAGE_KEY);
		if (!saved) return false;
		
		const state: SavedState = JSON.parse(saved);
		const now = Date.now();
		
		if (now - state.timestamp > STATE_EXPIRY_TIME) {
			sessionStorage.removeItem(STORAGE_KEY);
			return false;
		}
		
		Object.assign(filterState, state.filterState || {});
		Object.assign(pagination, state.pagination || {});
		searchKeyword.value = state.searchKeyword || '';
		viewMode.value = state.viewMode || 'list';
		
		return true;
	} catch (error) {
		console.error('恢复状态失败:', error);
		return false;
	}
}

function restoreScrollPosition() {
	try {
		const saved = sessionStorage.getItem(STORAGE_KEY);
		if (!saved) return;
		
		const state: SavedState = JSON.parse(saved);
		if (state.scrollPosition) {
			nextTick(() => {
				window.scrollTo({
					top: state.scrollPosition,
					behavior: 'auto'
				});
			});
		}
	} catch (error) {
		console.error('恢复滚动位置失败:', error);
	}
}

onMounted(async () => {
	console.log('[knowledge/index.vue] ========== onMounted 开始 ==========')
	const hasRestoredState = restoreStateFromStorage();
	uploadStore.restoreTasks();
	await loadCurrentUserInfo();
	if (!hasRestoredState) {
		fetchData();
	} else {
		fetchData();
	}
	getModelList();
	getPromptTemplateList();
	loadDictData();
	if (hasRestoredState) {
		nextTick(() => {
			restoreScrollPosition();
		});
	}
	if (vectorStoreOptions.length > 0 && !formValue.value.vectorModelName) {
		formValue.value.vectorModelName = vectorStoreOptions[0].value;
	}
	
	if (filterState.createTimeStart && filterState.createTimeEnd) {
		createTimeRange.value = [
			new Date(filterState.createTimeStart).getTime(),
			new Date(filterState.createTimeEnd).getTime(),
		];
	}
	if (filterState.updateTimeStart && filterState.updateTimeEnd) {
		updateTimeRange.value = [
			new Date(filterState.updateTimeStart).getTime(),
			new Date(filterState.updateTimeEnd).getTime(),
		];
	}
	
	uploadStore.waitingTasks.forEach(task => {
		if (task.status === 'waiting' && !task.xhr) {
			uploadService.uploadTask(task.id);
		}
	});
	uploadStore.processingTasks.forEach(task => {
		if (task.attachId) {
			uploadService.startProcessingPolling(task.id, task.attachId);
		}
	});
	uploadService.requestNotificationPermission();
	console.log('[knowledge/index.vue] ========== onMounted 结束 ==========')
});

onActivated(() => {
	nextTick(() => {
		restoreScrollPosition();
	});
});

onBeforeUnmount(() => {
	saveStateToStorage();
	uploadService.stopAllPolling();
});

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const uploadStore = useUploadStore();
const uploadManagerRef = ref<InstanceType<typeof GlobalUploadManager> | null>(null);
const formRef = ref<FormInst | null>(null);

// 初始化表单数据对象（符合后端 KnowledgeInfoBo）
const formValue = ref<KnowledgeReq>({
	kname: "",
	share: 0, // 后端保留字段，前端不再显示和编辑
	description: "",
	category: undefined,
	knowledgeSeparator: "",
	questionSeparator: "",
	overlapChar: 50,
	retrieveLimit: 3,
	textBlockSize: 500,
	vectorModelName: "",
	embeddingModelId: undefined,
	embeddingModelName: undefined,
	systemPrompt: "",
});

// 表单验证规则（符合 Fluent UI 规范：简洁，无句号）
const rules: FormRules = {
	kname: [
		{ required: true, message: "请输入知识库名称", trigger: ["blur", "input"] },
		{ min: 1, max: 50, message: "名称长度应在 1-50 个字符之间", trigger: ["blur", "input"] },
	],
	retrieveLimit: [
		{ 
			required: true, 
			message: "请输入检索返回条数", 
			trigger: ["blur", "change"],
			validator: (rule: any, value: any) => {
				// n-input-number 可能返回 null 或 undefined
				if (value === undefined || value === null || value === '' || value === 0) {
					return new Error("请输入检索返回条数");
				}
				const numValue = typeof value === 'number' ? value : Number(value);
				if (isNaN(numValue) || numValue === 0) {
					return new Error("检索返回条数必须是数字");
				}
				if (numValue < 1 || numValue > 10) {
					return new Error("检索条数应在 1-10 之间");
				}
				return true;
			}
		},
	],
	textBlockSize: [
		{ 
			required: true, 
			message: "请输入文本块大小", 
			trigger: ["blur", "change"],
			validator: (rule: any, value: any) => {
				// n-input-number 可能返回 null 或 undefined
				if (value === undefined || value === null || value === '' || value === 0) {
					return new Error("请输入文本块大小");
				}
				const numValue = typeof value === 'number' ? value : Number(value);
				if (isNaN(numValue) || numValue === 0) {
					return new Error("文本块大小必须是数字");
				}
				if (numValue < 100 || numValue > 2000) {
					return new Error("文本块大小应在 100-2000 字符之间");
				}
				return true;
			}
		},
	],
	vectorModelName: [
		{ required: true, message: "请选择向量库类型", trigger: ["change"] },
	],
	embeddingModelId: [
		{ 
			required: true, 
			message: "请选择向量模型", 
			trigger: ["change", "blur"],
			validator: (rule: any, value: any) => {
				// n-select 可能返回字符串或数字，都接受
				if (value === undefined || value === null || value === '' || value === 0) {
					return new Error("请选择向量模型");
				}
				// 字符串形式的数字也接受
				if (typeof value === 'string' && value.trim() === '') {
					return new Error("请选择向量模型");
				}
				return true;
			}
		},
	],
	description: [
		{ max: 1000, message: "描述长度不能超过 1000 个字符", trigger: ["blur", "input"] },
	],
	knowledgeSeparator: [
		{ max: 255, message: "分隔符长度不能超过 255 个字符", trigger: ["blur", "input"] },
	],
	questionSeparator: [
		{ max: 255, message: "分隔符长度不能超过 255 个字符", trigger: ["blur", "input"] },
	],
	systemPrompt: [
		{ max: 255, message: "系统提示词长度不能超过 255 个字符", trigger: ["blur", "input"] },
	],
	overlapChar: [
		{ type: "number", min: 0, max: 200, message: "重叠字符数应在 0-200 之间", trigger: ["blur", "change"] },
	],
};

// 详情表单验证规则（与创建表单一致）
const detailRules: FormRules = {
	kname: [
		{ required: true, message: "请输入知识库名称", trigger: ["blur", "input"] },
		{ min: 1, max: 50, message: "名称长度应在 1-50 个字符之间", trigger: ["blur", "input"] },
	],
	retrieveLimit: [
		{ 
			required: true, 
			message: "请输入检索返回条数", 
			trigger: ["blur", "change"],
			validator: (rule: any, value: any) => {
				if (value === undefined || value === null || value === '' || value === 0) {
					return new Error("请输入检索返回条数");
				}
				const numValue = typeof value === 'number' ? value : Number(value);
				if (isNaN(numValue) || numValue === 0) {
					return new Error("检索返回条数必须是数字");
				}
				if (numValue < 1 || numValue > 10) {
					return new Error("检索条数应在 1-10 之间");
				}
				return true;
			}
		},
	],
	textBlockSize: [
		{ 
			required: true, 
			message: "请输入文本块大小", 
			trigger: ["blur", "change"],
			validator: (rule: any, value: any) => {
				if (value === undefined || value === null || value === '' || value === 0) {
					return new Error("请输入文本块大小");
				}
				const numValue = typeof value === 'number' ? value : Number(value);
				if (isNaN(numValue) || numValue === 0) {
					return new Error("文本块大小必须是数字");
				}
				if (numValue < 100 || numValue > 2000) {
					return new Error("文本块大小应在 100-2000 字符之间");
				}
				return true;
			}
		},
	],
	vectorModelName: [
		{ required: true, message: "请选择向量库类型", trigger: ["change"] },
	],
	embeddingModelId: [
		{ 
			required: true, 
			message: "请选择向量模型", 
			trigger: ["change", "blur"],
			validator: (rule: any, value: any) => {
				if (value === undefined || value === null || value === '' || value === 0) {
					return new Error("请选择向量模型");
				}
				if (typeof value === 'string' && value.trim() === '') {
					return new Error("请选择向量模型");
				}
				return true;
			}
		},
	],
	description: [
		{ max: 1000, message: "描述长度不能超过 1000 个字符", trigger: ["blur", "input"] },
	],
	knowledgeSeparator: [
		{ max: 255, message: "分隔符长度不能超过 255 个字符", trigger: ["blur", "input"] },
	],
	questionSeparator: [
		{ max: 255, message: "分隔符长度不能超过 255 个字符", trigger: ["blur", "input"] },
	],
	systemPrompt: [
		{ max: 255, message: "系统提示词长度不能超过 255 个字符", trigger: ["blur", "input"] },
	],
	overlapChar: [
		{ type: "number", min: 0, max: 200, message: "重叠字符数应在 0-200 之间", trigger: ["blur", "change"] },
	],
};

// 表单验证状态
const isFormValid = ref(false);

// 检查表单验证状态
function checkFormValidation() {
	if (!formRef.value) {
		isFormValid.value = false;
		return;
	}
	
	// 使用 validate 方法检查表单状态
	formRef.value.validate((errors) => {
		if (errors && errors.length > 0) {
			isFormValid.value = false;
		} else {
			// 检查必填字段是否都有值
			const hasRequiredFields = 
				formValue.value.kname?.trim() &&
				formValue.value.retrieveLimit !== undefined &&
				formValue.value.textBlockSize !== undefined &&
				formValue.value.vectorModelName &&
				formValue.value.embeddingModelId !== undefined;
			
			isFormValid.value = !!hasRequiredFields;
			return !!hasRequiredFields;
		}
		return false;
	}, () => {
		isFormValid.value = false;
		return false;
	});
}

// 监听表单值变化，实时验证（使用防抖）
let validationTimer: ReturnType<typeof setTimeout> | null = null;
function updateFormValidation() {
	if (validationTimer) {
		clearTimeout(validationTimer);
	}
	validationTimer = setTimeout(() => {
		checkFormValidation();
	}, 300);
}

// 监听表单值变化
watch(() => formValue.value, () => {
	updateFormValidation();
}, { deep: true });

// 字典数据
const categoryOptions = ref<Array<{ label: string; value: string }>>([]);

// 加载字典数据
async function loadDictData() {
	try {
		const categoryRes: any = await getDictDataByType("knowledge_category");
		if (categoryRes.code === 200 && categoryRes.data) {
			categoryOptions.value = categoryRes.data.map((item: any) => ({
				label: item.dictLabel,  // 中文标签
				value: item.dictValue,  // 英文值
			}));
			// 如果有选项且当前值为空，默认选择第一个（用于创建表单）
			if (categoryOptions.value.length > 0 && !formValue.value.category) {
				formValue.value.category = categoryOptions.value[0].value;
			}
			// 默认全选所有分类（用于筛选）
			if (categoryOptions.value.length > 0 && (!filterState.category || filterState.category.length === 0)) {
				filterState.category = categoryOptions.value.map(opt => opt.value);
			}
		}
	} catch (error) {
		// 加载字典数据失败，将使用空选项
	}
}

// 根据分类值获取中文标签（从数据库字典获取，不硬编码）
function getCategoryLabel(categoryValue: string | undefined | null): string {
	if (!categoryValue) return '-';
	const option = categoryOptions.value.find(opt => opt.value === categoryValue);
	return option ? option.label : categoryValue; // 如果找不到，返回原值（兜底）
}

async function submitForm() {
	if (!formRef.value) return;
	
	try {
		await formRef.value.validate();
		submitting.value = true;
		
		// 确保 embeddingModelName 有值（如果为空，从选项中找到对应的 modelName）
		let embeddingModelName = formValue.value.embeddingModelName;
		if (!embeddingModelName && formValue.value.embeddingModelId) {
			// 使用字符串比较，避免大整数精度丢失
			const selectedOption = vectorModelOptions.value.find(option => {
				const optionValueStr = String(option.value);
				const formValueStr = String(formValue.value.embeddingModelId);
				return optionValueStr === formValueStr;
			});
			if (selectedOption) {
				embeddingModelName = selectedOption.modelName;
				formValue.value.embeddingModelName = embeddingModelName;
			}
		}
		
		// 处理 embeddingModelId：避免大整数精度丢失
		const embeddingModelIdValue = formValue.value.embeddingModelId;
		let embeddingModelIdForSubmit: number | string | undefined = undefined;
		if (embeddingModelIdValue !== undefined && embeddingModelIdValue !== null) {
			if (typeof embeddingModelIdValue === 'string') {
				const idNum = Number(embeddingModelIdValue);
				// 如果超过安全整数范围，保持为字符串
				if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
					embeddingModelIdForSubmit = embeddingModelIdValue;
				} else {
					embeddingModelIdForSubmit = idNum;
				}
			} else {
				const idNum = Number(embeddingModelIdValue);
				if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
					embeddingModelIdForSubmit = String(embeddingModelIdValue);
				} else {
					embeddingModelIdForSubmit = idNum;
				}
			}
		}
		
		// 构建提交数据（确保类型正确）
		const submitData: KnowledgeReq = {
			kname: formValue.value.kname.trim(),
			share: formValue.value.share,
			description: formValue.value.description?.trim() || undefined,
			category: formValue.value.category || undefined,
			knowledgeSeparator: formValue.value.knowledgeSeparator?.trim() || undefined,
			questionSeparator: formValue.value.questionSeparator?.trim() || undefined,
			overlapChar: formValue.value.overlapChar || 50,
			retrieveLimit: Number(formValue.value.retrieveLimit),
			textBlockSize: Number(formValue.value.textBlockSize),
			vectorModelName: formValue.value.vectorModelName,
			embeddingModelId: embeddingModelIdForSubmit as any,
			embeddingModelName: embeddingModelName,
			systemPrompt: formValue.value.systemPrompt?.trim() || undefined,
		};
		
		// 测试 JSON 序列化是否会导致精度丢失（创建时）
		const testJsonCreate = JSON.stringify(submitData);
		const testParsedCreate = JSON.parse(testJsonCreate);
		console.log('[创建知识库] JSON序列化后的embeddingModelId:', testParsedCreate.embeddingModelId);
		console.log('[创建知识库] 原始embeddingModelId:', submitData.embeddingModelId);
		console.log('[创建知识库] 是否精度丢失:', testParsedCreate.embeddingModelId !== submitData.embeddingModelId);
		
		const result: any = await createKnowledgeReq(submitData);
		
		if (result.code === 200) {
			message.success("知识库创建成功");
	active.value = false;
			resetForm();
		await fetchData();
		} else {
			message.error(result.msg || "创建失败，请检查输入");
		}
	} catch (error: any) {
		if (error.errors) {
			message.warning("请检查表单输入");
		} else if (error.response) {
			const errorMsg = error.response.data?.msg || error.response.data?.message || error.response.statusText || "请求失败";
			message.error(`提交失败：${errorMsg} (状态码: ${error.response.status})`);
		} else {
			message.error("提交失败：" + (error.message || "未知错误"));
		}
	} finally {
		submitting.value = false;
	}
}

function resetForm() {
	formValue.value = {
		kname: "",
		share: 0,
		description: "",
		category: undefined,
		knowledgeSeparator: "",
		questionSeparator: "",
		overlapChar: 50,
		retrieveLimit: 3,
		textBlockSize: 500,
		vectorModelName: "",
		embeddingModelId: undefined,
		embeddingModelName: undefined,
		systemPrompt: "",
	};
	formRef.value?.restoreValidation();
	isFormValid.value = false;
}

// 删除知识库
async function delKnowledgeForm(kid: string) {
	dialog.warning({
		title: '确认删除',
		content: '确定要删除这个知识库吗？此操作不可撤销。',
		positiveText: '确定',
		negativeText: '取消',
		onPositiveClick: async () => {
			try {
				const req = { kid: kid };
				const result: any = await delKnowledge(req);
	if (result.code == 200) {
		message.success("删除成功!");
					await fetchData();
	} else {
					message.error("删除失败!" + (result.msg || result.data?.msg));
				}
			} catch (error: any) {
				message.error("删除失败: " + (error.message || '未知错误'));
			}
		},
	});
}

// 批量删除
async function handleBatchDelete() {
	if (selectedRowKeys.value.length === 0) {
		message.warning('请先选择要删除的知识库');
		return;
	}
	dialog.warning({
		title: '确认批量删除',
		content: `确定要删除选中的 ${selectedRowKeys.value.length} 个知识库吗？此操作不可撤销。`,
		positiveText: '确定',
		negativeText: '取消',
		onPositiveClick: async () => {
			try {
				const result: any = await delKnowledgeBatch(selectedRowKeys.value);
				if (result.code == 200) {
					message.success(`已删除 ${selectedRowKeys.value.length} 个知识库`);
					selectedRowKeys.value = [];
	await fetchData();
				} else {
					message.error("批量删除失败!" + (result.msg || ''));
				}
			} catch (error: any) {
				message.error("批量删除失败: " + (error.message || '未知错误'));
			}
		},
	});
}

// 恢复默认（清除所有筛选并恢复默认状态）
function clearAllFilters() {
	searchKeyword.value = '';
	// 恢复默认排序
	filterState.orderBy = 'kname';
	filterState.order = 'asc';
	// 恢复默认所有权类型筛选（全部所有权类型）
	filterState.ownershipType = 'all';
	// 恢复默认分类筛选（全选所有分类）
	if (categoryOptions.value.length > 0) {
		filterState.category = categoryOptions.value.map(opt => opt.value);
	} else {
		filterState.category = [];
	}
	// 清除其他筛选条件
	Object.assign(filterState, {
		kname: undefined,
		description: undefined,
		// share字段已移除，不再作为筛选条件
		ownershipType: 'all', // 恢复默认所有权类型筛选（全部所有权类型）
		createBy: undefined,
		createDept: undefined,
		itemCountMin: undefined,
		itemCountMax: undefined,
		fragmentCountMin: undefined,
		fragmentCountMax: undefined,
		dataSizeMin: undefined,
		dataSizeMax: undefined,
		createTimeStart: undefined,
		createTimeEnd: undefined,
		updateTimeStart: undefined,
		updateTimeEnd: undefined,
	});
	// 清除日期范围显示
	createTimeRange.value = null;
	updateTimeRange.value = null;
	pagination.page = 1;
	fetchData();
}

// 检查是否有筛选条件（特殊筛选，不包括默认状态）
const hasActiveFilters = computed(() => {
	// 分类筛选：只有部分选中时才视为有特殊筛选
	// 全选所有分类 = 默认状态，不算筛选
	// 所有分类都不选 = 恢复默认（通过 removeCategoryFilter 处理）
	const hasCategoryFilter = filterState.category && 
		categoryOptions.value.length > 0 &&
		filterState.category.length > 0 &&
		filterState.category.length < categoryOptions.value.length;
	
	return !!(
		searchKeyword.value.trim() ||
		hasCategoryFilter ||
		(filterState.ownershipType !== 'all') ||
		(filterState.createBy && filterState.createBy.length > 0) ||
		(filterState.createDept && filterState.createDept.length > 0) ||
		filterState.itemCountMin !== undefined ||
		filterState.itemCountMax !== undefined ||
		filterState.fragmentCountMin !== undefined ||
		filterState.fragmentCountMax !== undefined ||
		filterState.dataSizeMin !== undefined ||
		filterState.dataSizeMax !== undefined ||
		filterState.createTimeStart ||
		filterState.createTimeEnd ||
		filterState.updateTimeStart ||
		filterState.updateTimeEnd
	);
});

function handleActionButtonClick(row: any, action?: string): void {
	// 跳转到知识条目列表页面
	router.push({ path: "/knowledge/item/list", query: { kid: row.kid || row.id } });
}

function handleAttachmentManage(row: any): void {
	// 跳转到附件管理页面
	router.push({ path: "/annex/t", query: { kid: row.kid || row.id } });
}

const activate = (place: DrawerPlacement) => {
	active.value = true;
	placement.value = place;
	resetForm();
	// 设置默认值（在重置表单后）
	nextTick(() => {
		// 设置向量库类型的默认值（静态选项）
		if (vectorStoreOptions.length > 0 && (!formValue.value.vectorModelName || formValue.value.vectorModelName === "")) {
			formValue.value.vectorModelName = vectorStoreOptions[0].value;
		}
		// 设置向量模型的默认值（动态选项）
		if (vectorModelOptions.value.length > 0 && !formValue.value.embeddingModelId) {
			formValue.value.embeddingModelId = vectorModelOptions.value[0].value;
			formValue.value.embeddingModelName = vectorModelOptions.value[0].modelName;
		}
		// 设置分类的默认值（动态选项）
		if (categoryOptions.value.length > 0 && !formValue.value.category) {
			formValue.value.category = categoryOptions.value[0].value;
		}
	});
	// 延迟验证，等待表单渲染完成
	setTimeout(() => {
		checkFormValidation();
	}, 200);
};

const active = ref(false);
const placement = ref<DrawerPlacement>("right");

const vectorStoreOptions = [
	{ label: "Weaviate", value: "weaviate" },
	{ label: "Milvus", value: "milvus" },
];

const vectorModelOptions = ref<Array<{ label: string; value: number; modelName: string }>>([]);
const promptTemplateOptions = ref<Array<{ label: string; value: number }>>([]);

async function getModelList() {
	await loadVectorModelsByCategory('vector');
}

async function loadVectorModelsByCategory(category?: string) {
	try {
		const categoryParam = category || 'vector';
		const res: any = await getModelListByCategory(categoryParam);
		console.log('[loadVectorModelsByCategory] 后端返回的原始数据:', res?.rows?.map((item: any) => ({
			id: item.id,
			idType: typeof item.id,
			modelName: item.modelName || item.name,
		})));
		if (res && res.code === 200 && Array.isArray(res.rows)) {
			vectorModelOptions.value = res.rows.map((item: any) => {
				// 保持大整数为字符串，避免精度丢失
				let idValue: number | string;
				if (typeof item.id === 'string') {
					const idNum = Number(item.id);
					// 检查是否超过安全整数范围
					if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
						idValue = item.id; // 保持为字符串
					} else {
						idValue = idNum;
					}
				} else {
					const idNum = Number(item.id);
					if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
						idValue = String(item.id); // 转换为字符串
					} else {
						idValue = idNum;
					}
				}
				return {
					label: item.modelName || item.name || `模型 ${item.id}`,
					value: idValue,
					modelName: item.modelName || item.name,
				};
			});
			console.log('[loadVectorModelsByCategory] 处理后的向量模型选项:', vectorModelOptions.value.map(opt => ({
				label: opt.label,
				value: opt.value,
				valueType: typeof opt.value,
				modelName: opt.modelName,
			})));
			// 如果有默认模型，自动选择第一个（仅用于创建表单）
			if (vectorModelOptions.value.length > 0 && !formValue.value.embeddingModelId) {
				formValue.value.embeddingModelId = vectorModelOptions.value[0].value;
				formValue.value.embeddingModelName = vectorModelOptions.value[0].modelName;
			}
		} else {
			// 如果响应不符合预期，确保 vectorModelOptions.value 至少是空数组，而不是 undefined
			console.warn('[loadVectorModelsByCategory] 响应不符合预期:', res);
			if (!Array.isArray(vectorModelOptions.value)) {
				vectorModelOptions.value = [];
			}
		}
	} catch (error) {
		console.error('[loadVectorModelsByCategory] 获取向量模型列表失败:', error);
		// 确保即使出错，vectorModelOptions.value 也是数组，而不是 undefined
		if (!Array.isArray(vectorModelOptions.value)) {
			vectorModelOptions.value = [];
		}
	}
}

async function getPromptTemplateList() {
	try {
		const res: any = await getPromptTemplateListByCategory('vector');
		if (res.code === 200 && res.rows) {
			promptTemplateOptions.value = res.rows.map((item: any) => ({
				label: item.templateContent || item.name || `模板 ${item.id}`,
				value: item.id,
			}));
		}
	} catch (error) {
		// 获取提示词模板列表失败
	}
}

// 处理向量模型选择变化（用于创建表单）
function handleEmbeddingModelChange(value: number | string | null | undefined) {
	if (!vectorModelOptions.value || !Array.isArray(vectorModelOptions.value)) {
		console.warn('[handleEmbeddingModelChange] vectorModelOptions.value 不可用');
		return;
	}
	// 使用字符串比较，避免大整数精度丢失
	const selectedOption = vectorModelOptions.value.find(option => {
		const optValueStr = String(option.value);
		const formValueStr = String(value);
		return optValueStr === formValueStr;
	});
	if (selectedOption) {
		formValue.value.embeddingModelName = selectedOption.modelName;
	}
}

// 处理向量模型选择变化（用于详情表单）
function handleDetailEmbeddingModelChange(value: number | string | null | undefined) {
	console.log('[handleDetailEmbeddingModelChange] ========== 向量模型选择变化 ==========');
	console.log('[handleDetailEmbeddingModelChange] 新选择的值:', {
		value,
		valueType: typeof value,
		valueString: String(value),
	});
	console.log('[handleDetailEmbeddingModelChange] 变化前的表单状态:', {
		embeddingModelId: detailFormValue.value.embeddingModelId,
		embeddingModelIdType: typeof detailFormValue.value.embeddingModelId,
		embeddingModelName: detailFormValue.value.embeddingModelName,
	});
	// 确保 vectorModelOptions 存在且是数组
	if (!vectorModelOptions || !vectorModelOptions.value || !Array.isArray(vectorModelOptions.value)) {
		console.error('[handleDetailEmbeddingModelChange] vectorModelOptions 不可用:', {
			vectorModelOptions,
			vectorModelOptionsValue: vectorModelOptions?.value,
			vectorModelOptionsType: typeof vectorModelOptions,
		});
		// 如果 vectorModelOptions 不可用，尝试重新加载
		if (vectorModelOptions) {
			console.log('[handleDetailEmbeddingModelChange] 尝试重新加载向量模型选项...');
			loadVectorModelsByCategory('vector').then(() => {
				console.log('[handleDetailEmbeddingModelChange] 重新加载完成，选项数量:', vectorModelOptions.value.length);
				// 重新加载后，再次尝试处理
				const options = vectorModelOptions.value;
				if (options && Array.isArray(options) && value !== null && value !== undefined) {
					const selectedOption = options.find(opt => String(opt.value) === String(value));
					if (selectedOption && selectedOption.modelName) {
						detailFormValue.value.embeddingModelName = selectedOption.modelName;
						console.log('[handleDetailEmbeddingModelChange] 重新加载后设置 embeddingModelName:', selectedOption.modelName);
					}
				}
				updateDetailFormValidation();
			});
		} else {
			updateDetailFormValidation();
		}
		return;
	}
	const options = vectorModelOptions.value;
	console.log('[handleDetailEmbeddingModelChange] 向量模型选项可用，选项数量:', options.length);
	console.log('[handleDetailEmbeddingModelChange] 所有选项:', options.map(opt => ({
		value: opt.value,
		valueType: typeof opt.value,
		label: opt.label,
		modelName: opt.modelName,
	})));
	if (value !== null && value !== undefined) {
		// 使用字符串比较，避免大整数精度丢失
		const selectedOption = options.find(opt => {
			const optValueStr = String(opt.value);
			const formValueStr = String(value);
			const isMatch = optValueStr === formValueStr;
			if (isMatch) {
				console.log('[handleDetailEmbeddingModelChange] ✓ 找到匹配的选项:', {
					optValue: opt.value,
					optValueStr,
					optValueType: typeof opt.value,
					formValue: value,
					formValueStr,
					formValueType: typeof value,
					optLabel: opt.label,
					optModelName: opt.modelName,
				});
			}
			return isMatch;
		});
		if (selectedOption && selectedOption.modelName) {
			const oldModelName = detailFormValue.value.embeddingModelName;
			detailFormValue.value.embeddingModelName = selectedOption.modelName;
			console.log('[handleDetailEmbeddingModelChange] ✓ 已更新 embeddingModelName:', {
				旧值: oldModelName,
				新值: selectedOption.modelName,
			});
		} else {
			console.warn('[handleDetailEmbeddingModelChange] ✗ 未找到匹配的选项，无法设置 embeddingModelName');
		}
	} else {
		console.log('[handleDetailEmbeddingModelChange] 值为 null 或 undefined，清除选择');
		detailFormValue.value.embeddingModelName = undefined;
	}
	console.log('[handleDetailEmbeddingModelChange] 变化后的表单状态:', {
		embeddingModelId: detailFormValue.value.embeddingModelId,
		embeddingModelIdType: typeof detailFormValue.value.embeddingModelId,
		embeddingModelName: detailFormValue.value.embeddingModelName,
	});
	updateDetailFormValidation();
	console.log('[handleDetailEmbeddingModelChange] ========== 向量模型选择变化处理完成 ==========');
}


// 格式化文件大小
function formatFileSize(bytes: number | null | undefined): string {
	if (bytes == null || bytes === undefined) {
		return '0 B';
	}
	const numBytes = Number(bytes);
	if (isNaN(numBytes) || numBytes === 0 || numBytes < 0) {
		return '0 B';
	}
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(numBytes) / Math.log(k));
	return Math.round(numBytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 高亮文本中的关键词
function highlightText(text: string, keywords: string[]): any[] {
	if (!text || !keywords || keywords.length === 0) {
		return [text];
	}
	
	const lowerText = text.toLowerCase();
	const result: any[] = [];
	let lastIndex = 0;
	const matches: Array<{ start: number; end: number; keyword: string }> = [];
	
	// 收集所有匹配位置
	for (const keyword of keywords) {
		const lowerKeyword = keyword.toLowerCase().trim();
		if (!lowerKeyword) continue;
		
		let searchIndex = 0;
		while (true) {
			const index = lowerText.indexOf(lowerKeyword, searchIndex);
			if (index === -1) break;
			
			// 检查是否与已有匹配重叠
			const overlaps = matches.some(m => 
				(index < m.end && index + lowerKeyword.length > m.start)
			);
			
			if (!overlaps) {
				matches.push({
					start: index,
					end: index + lowerKeyword.length,
					keyword: text.substring(index, index + lowerKeyword.length)
				});
			}
			
			searchIndex = index + 1;
		}
	}
	
	// 按位置排序
	matches.sort((a, b) => a.start - b.start);
	
	// 合并重叠的匹配
	const mergedMatches: Array<{ start: number; end: number; text: string }> = [];
	for (const match of matches) {
		if (mergedMatches.length === 0) {
			mergedMatches.push({
				start: match.start,
				end: match.end,
				text: match.keyword
			});
		} else {
			const last = mergedMatches[mergedMatches.length - 1];
			if (match.start <= last.end) {
				// 合并重叠
				last.end = Math.max(last.end, match.end);
				last.text = text.substring(last.start, last.end);
			} else {
				mergedMatches.push({
					start: match.start,
					end: match.end,
					text: match.keyword
				});
			}
		}
	}
	
	// 构建高亮结果
	for (const match of mergedMatches) {
		// 添加匹配前的文本
		if (match.start > lastIndex) {
			result.push(text.substring(lastIndex, match.start));
		}
		// 添加高亮的匹配文本
		result.push(h('mark', { class: 'search-highlight' }, text.substring(match.start, match.end)));
		lastIndex = match.end;
	}
	
	// 添加剩余的文本
	if (lastIndex < text.length) {
		result.push(text.substring(lastIndex));
	}
	
	return result.length > 0 ? result : [text];
}

// 提取搜索关键词（支持多词、去除停用词）
function extractKeywords(query: string): string[] {
	if (!query || !query.trim()) return [];
	return query.trim().split(/\s+/).filter(w => w.length > 0);
}

// 格式化时间（正规日期时间格式）
function formatTime(time: string): string {
	if (!time) return '-';
	const date = new Date(time);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 所有可用列定义
interface ColumnDef {
	key: string;
	title: string;
	width: number;
	minWidth?: number;
	maxWidth?: number;
	sorter?: boolean;
	fixed?: 'left' | 'right';
	render?: (row: any) => any;
	ellipsis?: any;
}

const allColumnDefs: ColumnDef[] = [
		{
			key: 'kname',
			title: t("knowledge.name"),
			width: 200,
			minWidth: 150,
			maxWidth: 400,
			sorter: true,
			ellipsis: { tooltip: true },
			render: (row: any) => {
				const keywords = searchKeyword.value.trim() ? extractKeywords(searchKeyword.value.trim()) : [];
				const highlightedName = keywords.length > 0 
					? highlightText(row.kname || '-', keywords)
					: row.kname || '-';
				
				// 如果不显示分类列，则在名称列显示分类标签
				const showCategoryTag = !visibleColumns.value.includes('category') && row.category;
				
				return h('div', { class: 'name-cell' }, [
					h('span', { class: 'name-text' }, highlightedName),
					showCategoryTag ? h(NTag, {
						size: 'small',
						type: 'info',
						style: { marginLeft: '8px' },
					}, { default: () => getCategoryLabel(row.category) }) : null,
				]);
			},
		},
	{
		key: 'itemCount',
		title: '条目数',
		width: 100,
		minWidth: 80,
		maxWidth: 150,
		sorter: true,
	},
	{
		key: 'fragmentCount',
		title: '片段数',
		width: 100,
		minWidth: 80,
		maxWidth: 150,
		sorter: true,
	},
	{
		key: 'dataSize',
		title: '存储大小',
		width: 120,
		minWidth: 100,
		maxWidth: 200,
		sorter: true,
		render: (row: any) => formatFileSize(row.dataSize),
	},
	{
		key: 'vectorModelName',
		title: '向量库',
		width: 120,
		minWidth: 100,
		maxWidth: 200,
		ellipsis: { tooltip: true },
	},
	{
		key: 'embeddingModelName',
		title: '向量化模型',
		width: 150,
		minWidth: 120,
		maxWidth: 250,
		ellipsis: { tooltip: true },
	},
	{
		key: 'retrieveLimit',
		title: '检索条数',
		width: 100,
		minWidth: 80,
		maxWidth: 120,
		sorter: true,
		render: (row: any) => row.retrieveLimit ?? '-',
	},
	{
		key: 'textBlockSize',
		title: '文本块大小',
		width: 120,
		minWidth: 100,
		maxWidth: 150,
		sorter: true,
		render: (row: any) => row.textBlockSize ? `${row.textBlockSize}` : '-',
	},
	{
		key: 'updateTime',
		title: '更新时间',
		width: 150,
		minWidth: 120,
		maxWidth: 200,
		sorter: true,
		render: (row: any) => formatTime(row.updateTime),
	},
	{
		key: 'createTime',
		title: '创建时间',
		width: 150,
		minWidth: 120,
		maxWidth: 200,
		sorter: true,
		render: (row: any) => formatTime(row.createTime),
	},
	{
		key: 'category',
		title: '分类',
		width: 120,
		minWidth: 100,
		maxWidth: 200,
		sorter: true,
		render: (row: any) => getCategoryLabel(row.category),
	},
	{
		key: 'description',
		title: '描述',
		width: 250,
		minWidth: 150,
		maxWidth: 500,
		ellipsis: { tooltip: true },
		render: (row: any) => {
			const keywords = searchKeyword.value.trim() ? extractKeywords(searchKeyword.value.trim()) : [];
			if (keywords.length > 0) {
				return h('span', highlightText(row.description || '-', keywords));
			}
			return row.description || '-';
		},
	},
];

// 获取真正的默认列配置（不读取localStorage）
const getTrueDefaultVisibleColumns = (): string[] => {
	return ['kname', 'itemCount', 'fragmentCount', 'dataSize', 'updateTime', 'category'];
};

// 列显示状态（从localStorage加载或使用默认值）
const getDefaultVisibleColumns = (): string[] => {
	try {
		const saved = localStorage.getItem('knowledge_table_visible_columns');
		if (saved) {
			return JSON.parse(saved);
		}
	} catch (e) {
		// ignore
	}
	return getTrueDefaultVisibleColumns();
};

// 列宽状态（从localStorage加载或使用默认值）
const getDefaultColumnWidths = (): Record<string, number> => {
	try {
		const saved = localStorage.getItem('knowledge_table_column_widths');
		if (saved) {
			return JSON.parse(saved);
		}
	} catch (e) {
		// ignore
	}
	return {};
};

const visibleColumns = ref<string[]>(getDefaultVisibleColumns());
const columnWidths = ref<Record<string, number>>(getDefaultColumnWidths());

// 保存列显示状态
function saveVisibleColumns() {
	localStorage.setItem('knowledge_table_visible_columns', JSON.stringify(visibleColumns.value));
}

// 保存列宽状态
function saveColumnWidths() {
	localStorage.setItem('knowledge_table_column_widths', JSON.stringify(columnWidths.value));
}

// 创建列配置
const createColumns = (): any[] => {
	const cols: any[] = [
		{
			type: 'selection',
			width: 50,
			fixed: 'left',
		} as any,
	];

	// 添加可见列
	allColumnDefs.forEach((def) => {
		if (visibleColumns.value.includes(def.key)) {
			const width = columnWidths.value[def.key] || def.width;
			const col: any = {
				title: def.title,
				key: def.key,
				width: width,
				minWidth: def.minWidth,
				maxWidth: def.maxWidth,
				resizable: true,
			};
			// 移除列头排序功能，使用工具栏排序
			// if (def.sorter) {
			// 	col.sorter = true;
			// }
			if (def.fixed) {
				col.fixed = def.fixed;
			}
			if (def.render) {
				col.render = def.render;
			}
			if (def.ellipsis) {
				col.ellipsis = def.ellipsis;
			}
			cols.push(col);
		}
	});

	// 操作列始终显示
	cols.push({
			title: t("knowledge.actions"),
			key: "actions",
		width: 200,
		fixed: 'right',
			render: (row: any) => {
			return h(NSpace, { size: 'small' }, {
				default: () => [
					h(
					NTooltip,
					{ trigger: 'hover', placement: 'top' },
					{
						default: () => "查看详情",
						trigger: () => h(
						NButton,
						{
								size: 'small',
								onClick: () => openDetailModal(row),
								type: 'primary',
								quaternary: true,
							},
							{ default: () => h(SvgIcon, { icon: "ri:information-line" }) }
						),
					}
				),
					h(
					NTooltip,
					{ trigger: 'hover', placement: 'top' },
					{
						default: () => t("knowledge.knowledgeItem"),
						trigger: () => h(
						NButton,
						{
								size: 'small',
								onClick: () => handleActionButtonClick(row, "action3"),
								type: 'primary',
								quaternary: true,
							},
							{ default: () => h(SvgIcon, { icon: "ri:file-list-line" }) }
						),
					}
				),
				h(
					NTooltip,
					{ trigger: 'hover', placement: 'top' },
					{
						default: () => "附件管理",
						trigger: () => h(
						NButton,
						{
								size: 'small',
								onClick: () => handleAttachmentManage(row),
								type: 'primary',
								quaternary: true,
							},
							{ default: () => h(SvgIcon, { icon: "ri:attachment-line" }) }
						),
					}
				),
				h(
					NTooltip,
					{ trigger: 'hover', placement: 'top' },
					{
						default: () => t("knowledge.delete"),
						trigger: () => h(
						NButton,
						{
								size: 'small',
								onClick: () => delKnowledgeForm(row.kid),
								type: 'error',
								quaternary: true,
							},
							{ default: () => h(SvgIcon, { icon: "ri:delete-bin-line" }) }
						),
					}
				),
				]
			});
		},
	});

	return cols;
};

const tableData = ref<any[]>([]);

const pagination = reactive({
	page: 1,
	pageSize: 12,
	itemCount: 0,
	pageSizes: [12, 24, 36, 48],
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

// 筛选和排序状态（使用内部字段名，在buildQueryParams中转换为API字段名）
const filterState = reactive<{
	category?: string[]; // 内部使用category（数组），转换为API的categories
	share?: 0 | 1;
	ownershipType?: 'mine' | 'assigned' | 'all'; // 所有权类型筛选（mine-我创建的, assigned-分配给我的, all-全部）
	createBy?: string[]; // 内部使用createBy（数组），转换为API的createBys
	createDept?: number[]; // 内部使用createDept（数组），转换为API的createDepts
	itemCountMin?: number;
	itemCountMax?: number;
	fragmentCountMin?: number;
	fragmentCountMax?: number;
	dataSizeMin?: number;
	dataSizeMax?: number;
	createTimeStart?: string;
	createTimeEnd?: string;
	updateTimeStart?: string;
	updateTimeEnd?: string;
	orderBy?: 'create_time' | 'update_time' | 'item_count' | 'fragment_count' | 'data_size' | 'kname' | 'category' | 'relevance';
	order?: 'asc' | 'desc';
}>({
	category: [],
	share: undefined,
	ownershipType: 'all', // 默认显示全部所有权类型
	createBy: undefined,
	createDept: undefined,
	itemCountMin: undefined,
	itemCountMax: undefined,
	fragmentCountMin: undefined,
	fragmentCountMax: undefined,
	dataSizeMin: undefined,
	dataSizeMax: undefined,
	createTimeStart: undefined,
	createTimeEnd: undefined,
	updateTimeStart: undefined,
	updateTimeEnd: undefined,
	orderBy: 'kname',
	order: 'asc',
});

// 搜索框防抖
let searchDebounceTimer: NodeJS.Timeout | null = null;
const searchKeyword = ref('');
const previousSearchKeyword = ref('');// 记录上一次搜索关键词，用于判断是否从非搜索状态进入搜索状态

// 视图模式：'list' | 'card'
const viewMode = ref<'list' | 'card'>('list');

// 选中的行
const selectedRowKeys = ref<string[]>([]);

// 高级筛选面板
const showFilterPanel = ref(false);

// 列配置面板
const showColumnConfig = ref(false);

// 知识库详情/编辑模态框
const showDetailModal = ref(false);
// 标签管理模态框
const showTagManageModal = ref(false);
const detailFormValue = ref<KnowledgeReq>({
	kname: "",
	share: 0,
	description: "",
	category: undefined,
	knowledgeSeparator: "",
	questionSeparator: "",
	overlapChar: 50,
	retrieveLimit: 3,
	textBlockSize: 500,
	vectorModelName: "",
	embeddingModelId: undefined,
	embeddingModelName: undefined,
	systemPrompt: "",
});
const originalDetailFormValue = ref<KnowledgeReq>({
	kname: "",
	share: 0,
	description: "",
	category: undefined,
	knowledgeSeparator: "",
	questionSeparator: "",
	overlapChar: 50,
	retrieveLimit: 3,
	textBlockSize: 500,
	vectorModelName: "",
	embeddingModelId: undefined,
	embeddingModelName: undefined,
	systemPrompt: "",
});
const detailFormRef = ref<FormInst | null>(null);
const currentKnowledgeId = ref<string | null>(null);
const isDetailFormValid = ref(false);
const isDetailFormDirty = computed(() => {
	if (!currentKnowledgeId.value) return false;
	const current = detailFormValue.value;
	const original = originalDetailFormValue.value;
	return (
		current.kname !== original.kname ||
		current.description !== original.description ||
		current.category !== original.category ||
		current.knowledgeSeparator !== original.knowledgeSeparator ||
		current.questionSeparator !== original.questionSeparator ||
		current.overlapChar !== original.overlapChar ||
		current.retrieveLimit !== original.retrieveLimit ||
		current.textBlockSize !== original.textBlockSize ||
		current.vectorModelName !== original.vectorModelName ||
		current.embeddingModelId !== original.embeddingModelId ||
		current.systemPrompt !== original.systemPrompt
	);
});
const currentUserId = ref<number | null>(null);

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

const isAdminAssignedFilter = computed(() => {
	return currentUserId.value === 1 && filterState.ownershipType === 'assigned';
});

// 判断是否有编辑权限（使用后端返回的权限信息）
const canEditKnowledge = computed(() => {
	if (!currentKnowledgeId.value) return false;
	const knowledge = tableData.value.find(item => (item.kid || item.id) === currentKnowledgeId.value);
	return knowledge?.canEdit === true;
});

// 是否公开选项（已移除，不再使用）

// 保存搜索前的排序状态
const previousSortState = ref<{ orderBy?: string; order?: 'asc' | 'desc' }>({
	orderBy: 'kname',
	order: 'asc'
});

// 排序选项
const sortOptions = computed(() => {
	const options = [
		{ label: '按名称排序', value: 'kname' },
		{ label: '按更新时间排序', value: 'update_time' },
		{ label: '按创建时间排序', value: 'create_time' },
		{ label: '按条目数排序', value: 'item_count' },
		{ label: '按片段数排序', value: 'fragment_count' },
		{ label: '按存储大小排序', value: 'data_size' },
		{ label: '按分类排序', value: 'category' },
	];
	// 如果有搜索关键词，添加匹配度排序选项
	return options;
});

// 获取排序占位符文本
function getSortPlaceholder(): string {
	const currentOption = sortOptions.value.find(opt => opt.value === filterState.orderBy);
	return currentOption ? currentOption.label : '按名称排序';
}

// 加载状态
const loading = ref(false);
const refreshingStatistics = ref(false);

// 构建查询参数
const buildQueryParams = (): KnowledgeListQuery => {
	const params: KnowledgeListQuery = {
		pageNum: pagination.page,
		pageSize: pagination.pageSize,
		// 如果排序是匹配度，使用更新时间作为后端排序（匹配度在前端计算）
		orderBy: filterState.orderBy === 'relevance' ? 'update_time' : filterState.orderBy,
		order: filterState.order,
	};
	
	// 搜索
	if (searchKeyword.value.trim()) {
		params.searchKeyword = searchKeyword.value.trim();
	}
	
	// 筛选
	// 分类筛选：如果全选了所有分类，视为没有筛选，不发送参数
	// 如果没有任何分类被选中，也不发送参数（会返回空结果）
	if (filterState.category && 
		filterState.category.length > 0 && 
		categoryOptions.value.length > 0 &&
		filterState.category.length < categoryOptions.value.length) {
		params.categories = filterState.category;
	}
	// 如果分类数组为空，表示所有分类都被筛选掉了，应该返回空结果
	// 但为了后端逻辑清晰，我们发送一个空数组或者不发送，让后端处理
	// 这里不发送参数，后端会返回所有数据，但前端可以通过检查 filterState.category.length === 0 来判断
	// share字段已移除，不再作为筛选条件
	// 所有权类型筛选：只有非'all'时才发送参数
	if (filterState.ownershipType && filterState.ownershipType !== 'all') {
		(params as any).ownershipType = filterState.ownershipType;
	}
	if (filterState.createBy && filterState.createBy.length > 0) {
		params.createBys = filterState.createBy;
	}
	if (filterState.createDept && filterState.createDept.length > 0) {
		params.createDepts = filterState.createDept;
	}
	if (filterState.itemCountMin !== undefined) {
		params.itemCountMin = filterState.itemCountMin;
	}
	if (filterState.itemCountMax !== undefined) {
		params.itemCountMax = filterState.itemCountMax;
	}
	if (filterState.fragmentCountMin !== undefined) {
		params.fragmentCountMin = filterState.fragmentCountMin;
	}
	if (filterState.fragmentCountMax !== undefined) {
		params.fragmentCountMax = filterState.fragmentCountMax;
	}
	if (filterState.dataSizeMin !== undefined) {
		params.dataSizeMin = filterState.dataSizeMin;
	}
	if (filterState.dataSizeMax !== undefined) {
		params.dataSizeMax = filterState.dataSizeMax;
	}
	if (filterState.createTimeStart) {
		params.createTimeStart = filterState.createTimeStart;
	}
	if (filterState.createTimeEnd) {
		params.createTimeEnd = filterState.createTimeEnd;
	}
	if (filterState.updateTimeStart) {
		params.updateTimeStart = filterState.updateTimeStart;
	}
	if (filterState.updateTimeEnd) {
		params.updateTimeEnd = filterState.updateTimeEnd;
	}
	
	return params;
};

const fetchData = async () => {
	console.log('[knowledge/index.vue] ========== fetchData 开始 ==========')
	loading.value = true;
	try {
		const params = buildQueryParams();
		console.log('[knowledge/index.vue] API请求参数:', JSON.stringify(params, null, 2))
		const result: any = await getKnowledge(params);
		console.log('[knowledge/index.vue] API响应:', {
			code: result?.code,
			total: result?.total,
			rowsLength: result?.rows?.length,
			rows: result?.rows,
			rowsSample: result?.rows?.length > 0 ? {
				firstItem: result.rows[0],
				firstItemKeys: Object.keys(result.rows[0] || {}),
				firstItemDataSize: result.rows[0]?.dataSize,
				firstItemKid: result.rows[0]?.kid,
				firstItemKname: result.rows[0]?.kname,
			} : null,
		})
		if (result.code == 200) {
			tableData.value = result.rows || [];
			pagination.itemCount = result.total || 0;
			console.log('[knowledge/index.vue] 更新后的tableData:', {
				tableDataLength: tableData.value.length,
				tableData: tableData.value,
				dataSizeDetails: tableData.value.map((item: any) => ({
					kid: item.kid,
					kname: item.kname,
					dataSize: item.dataSize,
					dataSizeType: typeof item.dataSize,
					itemCount: item.itemCount,
					fragmentCount: item.fragmentCount,
				})),
			})
		} else {
			message.error(result.msg || '获取数据失败');
		}
	} catch (error: any) {
		console.error('[knowledge/index.vue] fetchData异常:', error)
		message.error(error.message || '获取数据失败');
	} finally {
		loading.value = false;
		console.log('[knowledge/index.vue] ========== fetchData 结束 ==========')
	}
};

const handleRefreshStatistics = async () => {
	refreshingStatistics.value = true;
	loading.value = true;
	try {
		const result: any = await refreshKnowledgeStatistics();
		if (result.code === 200) {
			message.success('刷新成功');
			await fetchData();
		} else {
			message.error(result.msg || '刷新失败');
		}
	} catch (error: any) {
		message.error(error.message || '刷新失败');
	} finally {
		refreshingStatistics.value = false;
		loading.value = false;
	}
};

// 搜索防抖处理（防止状态冲突和请求覆盖）
const handleSearch = () => {
	if (searchDebounceTimer) {
		clearTimeout(searchDebounceTimer);
	}
	searchDebounceTimer = setTimeout(() => {
		const currentKeyword = searchKeyword.value.trim();
		const wasSearching = previousSearchKeyword.value.trim().length > 0;
		const isSearching = currentKeyword.length > 0;
		
		// 如果从非搜索状态进入搜索状态，保存当前排序并切换到匹配度排序
		if (!wasSearching && isSearching) {
			// 只有在真正进入搜索状态时才保存和切换排序
			previousSortState.value = {
				orderBy: filterState.orderBy,
				order: filterState.order
			};
			filterState.orderBy = 'relevance';
			filterState.order = 'desc';
		}
		// 如果从搜索状态退出到非搜索状态，恢复之前的排序
		else if (wasSearching && !isSearching) {
			// 只有在真正退出搜索状态时才恢复排序
			if (previousSortState.value.orderBy && previousSortState.value.orderBy !== 'relevance') {
				filterState.orderBy = previousSortState.value.orderBy as any;
				filterState.order = previousSortState.value.order || 'asc';
			} else {
				// 如果没有保存的排序，使用默认排序
				filterState.orderBy = 'kname';
				filterState.order = 'asc';
			}
		}
		// 如果一直在搜索状态（关键词变化），保持匹配度排序
		else if (wasSearching && isSearching) {
			// 确保搜索状态下使用匹配度排序
			if (filterState.orderBy !== 'relevance') {
				filterState.orderBy = 'relevance';
				filterState.order = 'desc';
			}
		}
		
		// 更新搜索关键词状态
		previousSearchKeyword.value = currentKeyword;
		// 重置分页
		pagination.page = 1;
		// 触发数据获取
		fetchData();
	}, 300);
};



// 分类选择相关计算属性
const categorySelectAllState = computed(() => {
	const selected = filterState.category || [];
	if (selected.length === 0) {
		return false; // 未选中
	}
	if (categoryOptions.value.length > 0 && selected.length === categoryOptions.value.length) {
		return true; // 全选
	}
	return null; // 部分选中（indeterminate）
});

// 分类全选/取消全选（智能化）
function toggleCategorySelectAll(checked: boolean) {
	if (checked) {
		// 全选所有
		filterState.category = categoryOptions.value.map(opt => opt.value);
	} else {
		// 取消全选
		filterState.category = [];
	}
	fetchData();
	saveStateToStorage();
}

// 分类选择变化时，自动更新全选状态
watch(() => filterState.category, (newVal) => {
	// 全选状态会自动通过 computed 更新，这里不需要额外处理
	saveStateToStorage();
}, { deep: true });

// 监听视图模式变化
watch(viewMode, () => {
	saveStateToStorage();
});

// 监听排序变化
watch(() => [filterState.orderBy, filterState.order], () => {
	saveStateToStorage();
});

watch(() => [
	filterState.ownershipType,
	filterState.createBy,
	filterState.createDept,
	filterState.itemCountMin,
	filterState.itemCountMax,
	filterState.fragmentCountMin,
	filterState.fragmentCountMax,
	filterState.dataSizeMin,
	filterState.dataSizeMax,
	filterState.createTimeStart,
	filterState.createTimeEnd,
	filterState.updateTimeStart,
	filterState.updateTimeEnd,
], () => {
	saveStateToStorage();
}, { deep: true });

// 获取活动的分类筛选（只返回部分选中的分类，不包括全选状态）
function getActiveCategoryFilters(): string[] {
	if (!filterState.category || filterState.category.length === 0) {
		return [];
	}
	// 如果全选了所有分类，视为默认状态，不显示标签
	if (categoryOptions.value.length > 0 && filterState.category.length === categoryOptions.value.length) {
		return [];
	}
	// 只返回部分选中的分类
	return filterState.category;
}

// 移除分类筛选
function removeCategoryFilter(cat: string) {
	if (filterState.category) {
		filterState.category = filterState.category.filter((c: string) => c !== cat);
		// 如果移除后没有任何分类被选中，恢复默认（全选所有分类）
		if (filterState.category.length === 0 && categoryOptions.value.length > 0) {
			filterState.category = categoryOptions.value.map(opt => opt.value);
		}
	}
	fetchData();
	saveStateToStorage();
}

// 分类选择变化处理
function handleCategoryChange(value: (string | number)[]) {
	filterState.category = value.map(v => String(v));
	fetchData();
}


// 列配置处理函数
function handleColumnVisibilityChange() {
	// 当列可见性改变时，自动保存
	saveVisibleColumns();
}

// 恢复默认列配置
function resetColumnConfigToDefault() {
	visibleColumns.value = getTrueDefaultVisibleColumns();
	saveVisibleColumns();
}

// 处理列宽调整
function handleColumnResize(column: any, width: number) {
	if (column.key) {
		columnWidths.value[column.key] = width;
		saveColumnWidths();
	}
}

// 更新列定义以支持列宽调整
const columns = computed(() => {
	const cols = createColumns();
	// 添加列宽调整处理
	cols.forEach((col: any) => {
		if (col.resizable && col.key) {
			col.onResize = (width: number) => {
				handleColumnResize(col, width);
			};
		}
	});
	return cols;
});

// 日期范围选择器
const createTimeRange = ref<[number, number] | null>(null);
const updateTimeRange = ref<[number, number] | null>(null);

// 监听日期范围变化（实时生效）
watch(createTimeRange, (val) => {
	if (val && val.length === 2) {
		filterState.createTimeStart = new Date(val[0]).toISOString();
		filterState.createTimeEnd = new Date(val[1]).toISOString();
	} else {
		filterState.createTimeStart = undefined;
		filterState.createTimeEnd = undefined;
	}
	pagination.page = 1;
	fetchData();
});

watch(updateTimeRange, (val) => {
	if (val && val.length === 2) {
		filterState.updateTimeStart = new Date(val[0]).toISOString();
		filterState.updateTimeEnd = new Date(val[1]).toISOString();
	} else {
		filterState.updateTimeStart = undefined;
		filterState.updateTimeEnd = undefined;
	}
	pagination.page = 1;
	fetchData();
});

// 高级筛选面板打开时，同步日期范围显示
watch(showFilterPanel, (show) => {
	if (show) {
		// 面板打开时，根据当前筛选状态同步日期范围显示
		if (filterState.createTimeStart && filterState.createTimeEnd) {
			createTimeRange.value = [
				new Date(filterState.createTimeStart).getTime(),
				new Date(filterState.createTimeEnd).getTime(),
			];
		} else {
			createTimeRange.value = null;
		}
		if (filterState.updateTimeStart && filterState.updateTimeEnd) {
			updateTimeRange.value = [
				new Date(filterState.updateTimeStart).getTime(),
				new Date(filterState.updateTimeEnd).getTime(),
			];
		} else {
			updateTimeRange.value = null;
		}
	}
});

// 重置筛选
function resetFilters() {
	filterState.itemCountMin = undefined;
	filterState.itemCountMax = undefined;
	filterState.fragmentCountMin = undefined;
	filterState.fragmentCountMax = undefined;
	filterState.dataSizeMin = undefined;
	filterState.dataSizeMax = undefined;
	createTimeRange.value = null;
	updateTimeRange.value = null;
	pagination.page = 1;
	fetchData();
}

const submitting = ref(false);

// Ref for advanced config section
const advancedConfigRef = ref<HTMLElement | null>(null);
const detailAdvancedConfigRef = ref<HTMLElement | null>(null);

// Handle collapse expanded change
function handleCollapseExpanded(expandedNames: string[]) {
	// 只有当展开的是"高级配置"且处于打开状态时才触发
	if (expandedNames.includes('advanced-config')) {
		nextTick(() => {
			// 这里的延时必须大于 Naive UI 的动画时间 (通常是 300ms)
			setTimeout(() => {
				// 1. 获取高级配置的 DOM 元素
				const targetEl = advancedConfigRef.value;
				if (!targetEl) return;

				// 2. 关键步骤：找到最近的滚动父容器
				// Naive UI Drawer 的滚动容器通常是 .n-drawer-body-content-wrapper
				const scrollContainer = targetEl.closest('.n-drawer-body-content-wrapper') || 
										targetEl.closest('.n-scrollbar-container');

				if (scrollContainer) {
					// 方案 A：直接设置滚动条位置到最底部 (最稳健)
					scrollContainer.scrollTo({
						top: scrollContainer.scrollHeight,
						behavior: 'smooth'
					});
				} else {
					// 方案 B：如果找不到容器，尝试让元素自己滚动进入视图 (兜底)
					// block: 'end' 表示让元素的底部和视口底部对齐
					targetEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
				}
			}, 350);
		});
	}
}

// Handle detail modal collapse expanded change
function handleDetailCollapseExpanded(expandedNames: string[]) {
	// 只有当展开的是"高级配置"且处于打开状态时才触发
	if (expandedNames.includes('advanced-config')) {
		nextTick(() => {
			// 这里的延时必须大于 Naive UI 的动画时间 (通常是 300ms)
			setTimeout(() => {
				// 1. 获取高级配置的 DOM 元素
				const targetEl = detailAdvancedConfigRef.value;
				if (!targetEl) return;

				// 策略1：查找模态框内的滚动容器
				const modalBody = targetEl.closest('.n-modal-body-wrapper') || 
								 targetEl.closest('.n-card-body') ||
								 targetEl.closest('.n-modal__body');
				
				// 策略2：查找滚动条容器
				const scrollbarContainer = targetEl.closest('.n-scrollbar-container') ||
										  document.querySelector('.n-modal .n-scrollbar-container');
				
				// 策略3：查找模态框本身
				const modalElement = targetEl.closest('.n-modal') ||
									document.querySelector('.n-modal');
				
				// 策略4：查找模态框的content区域
				const modalContent = modalElement?.querySelector('.n-modal__content') ||
									modalElement?.querySelector('.n-card');

				// 尝试多种滚动方式
				let scrolled = false;

				// 方案A：如果找到滚动容器，直接滚动到底部
				if (modalBody && modalBody.scrollHeight > modalBody.clientHeight) {
					modalBody.scrollTo({
						top: modalBody.scrollHeight,
						behavior: 'smooth'
					});
					scrolled = true;
				}

				// 方案B：如果找到滚动条容器
				if (!scrolled && scrollbarContainer && scrollbarContainer.scrollHeight > scrollbarContainer.clientHeight) {
					scrollbarContainer.scrollTo({
						top: scrollbarContainer.scrollHeight,
						behavior: 'smooth'
					});
					scrolled = true;
				}

				// 方案C：如果找到模态框content区域
				if (!scrolled && modalContent && modalContent.scrollHeight > modalContent.clientHeight) {
					modalContent.scrollTo({
						top: modalContent.scrollHeight,
						behavior: 'smooth'
					});
					scrolled = true;
				}

				// 方案D：尝试滚动整个模态框
				if (!scrolled && modalElement && modalElement.scrollHeight > modalElement.clientHeight) {
					modalElement.scrollTo({
						top: modalElement.scrollHeight,
						behavior: 'smooth'
					});
					scrolled = true;
				}

				// 方案E：如果页面本身可以滚动，尝试滚动页面
				if (!scrolled && document.documentElement.scrollHeight > document.documentElement.clientHeight) {
					window.scrollTo({
						top: document.documentElement.scrollHeight,
						behavior: 'smooth'
					});
					scrolled = true;
				}

				// 方案F：兜底方案 - 使用 scrollIntoView
				if (!scrolled) {
					targetEl.scrollIntoView({ 
						behavior: 'smooth', 
						block: 'end',
						inline: 'nearest'
					});
				}
			}, 350);
		});
	}
}

// Handle mask click to close drawer
function handleMainContentClick() {
	active.value = false;
}

// 打开知识库详情模态框
async function openDetailModal(knowledge: any) {
	console.log('[openDetailModal] ========== 开始打开详情模态框 ==========');
	console.log('[openDetailModal] 传入的knowledge数据:', {
		kid: knowledge.kid,
		id: knowledge.id,
		embeddingModelId: knowledge.embeddingModelId,
		embeddingModelIdType: typeof knowledge.embeddingModelId,
		embeddingModelName: knowledge.embeddingModelName,
		vectorModelName: knowledge.vectorModelName,
	});
	// 每次打开时，从列表数据中重新获取最新的知识库信息
	const currentKnowledge = tableData.value.find(item => (item.kid || item.id) === (knowledge.kid || knowledge.id));
	const knowledgeData = currentKnowledge || knowledge;
	console.log('[openDetailModal] 最终使用的knowledgeData:', {
		kid: knowledgeData.kid,
		id: knowledgeData.id,
		embeddingModelId: knowledgeData.embeddingModelId,
		embeddingModelIdType: typeof knowledgeData.embeddingModelId,
		embeddingModelName: knowledgeData.embeddingModelName,
		vectorModelName: knowledgeData.vectorModelName,
	});
	currentKnowledgeId.value = knowledgeData.kid || knowledgeData.id;
	showDetailModal.value = true;
	console.log('[openDetailModal] 开始加载向量模型选项...');
	// 向量模型选项始终使用'vector'分类加载（知识库的分类是业务分类，不是向量模型分类）
	await loadVectorModelsByCategory('vector');
	console.log('[openDetailModal] 向量模型选项加载完成，选项数量:', vectorModelOptions.value.length);
	console.log('[openDetailModal] 向量模型选项详情:', vectorModelOptions.value.map(opt => ({
		value: opt.value,
		valueType: typeof opt.value,
		label: opt.label,
		modelName: opt.modelName,
	})));
	// 直接使用列表数据填充表单（列表数据已经包含所有字段）
	fillDetailFormFromKnowledge(knowledgeData);
	// 验证表单
	nextTick(() => {
		checkDetailFormValidation();
		console.log('[openDetailModal] ========== 详情模态框打开完成 ==========');
	});
}

// 存储详情数据（用于显示时间等信息）
const detailKnowledgeData = ref<any>(null);

// 从知识库数据填充详情表单
function fillDetailFormFromKnowledge(data: any) {
	if (!data) return;
	console.log('[fillDetailFormFromKnowledge] 原始数据:', {
		embeddingModelId: data.embeddingModelId,
		embeddingModelIdType: typeof data.embeddingModelId,
		embeddingModelName: data.embeddingModelName,
		vectorModelOptions: vectorModelOptions.value,
	});
	// 保存完整数据用于显示时间等信息
	detailKnowledgeData.value = data;
	// 处理 embeddingModelId：需要与选项中的值类型保持一致
	// 先检查选项中的值类型，然后保持一致
	let embeddingModelIdValue: number | string | undefined = undefined;
	if (data.embeddingModelId !== null && data.embeddingModelId !== undefined) {
		const idStr = String(data.embeddingModelId);
		const idNum = Number(data.embeddingModelId);
		// 检查选项中的值类型（如果选项已加载）
		if (vectorModelOptions.value.length > 0) {
			const firstOptionValueType = typeof vectorModelOptions.value[0].value;
			if (firstOptionValueType === 'string') {
				// 选项使用字符串，我们也使用字符串
				embeddingModelIdValue = idStr;
			} else {
				// 选项使用数字，检查是否超过安全整数范围
				if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
					console.warn('[fillDetailFormFromKnowledge] embeddingModelId 超出安全整数范围，但选项使用数字类型，尝试转换:', idStr);
					embeddingModelIdValue = idNum; // 即使可能丢失精度，也要保持类型一致
				} else {
					embeddingModelIdValue = idNum;
				}
			}
		} else {
			// 选项未加载，根据值本身决定
			if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
				console.warn('[fillDetailFormFromKnowledge] embeddingModelId 超出安全整数范围，保持为字符串:', idStr);
				embeddingModelIdValue = idStr;
			} else {
				embeddingModelIdValue = idNum;
			}
		}
	}
	console.log('[fillDetailFormFromKnowledge] 处理后的 embeddingModelId:', {
		value: embeddingModelIdValue,
		type: typeof embeddingModelIdValue,
		optionsValueType: vectorModelOptions.value.length > 0 ? typeof vectorModelOptions.value[0].value : 'unknown',
	});
	// 填充表单数据（直接使用数据中的值，不要使用默认值覆盖）
	detailFormValue.value = {
		kid: data.kid || data.id || "",
		id: data.id || undefined,
		kname: data.kname !== null && data.kname !== undefined ? String(data.kname) : "",
		share: data.share !== null && data.share !== undefined ? Number(data.share) : 0,
		description: data.description !== null && data.description !== undefined ? String(data.description) : "",
		category: data.category || undefined,
		knowledgeSeparator: data.knowledgeSeparator !== null && data.knowledgeSeparator !== undefined ? String(data.knowledgeSeparator) : "",
		questionSeparator: data.questionSeparator !== null && data.questionSeparator !== undefined ? String(data.questionSeparator) : "",
		overlapChar: data.overlapChar !== null && data.overlapChar !== undefined ? Number(data.overlapChar) : 50,
		retrieveLimit: data.retrieveLimit !== null && data.retrieveLimit !== undefined ? Number(data.retrieveLimit) : 3,
		textBlockSize: data.textBlockSize !== null && data.textBlockSize !== undefined ? Number(data.textBlockSize) : 500,
		vectorModelName: data.vectorModelName !== null && data.vectorModelName !== undefined ? String(data.vectorModelName) : "",
		embeddingModelId: embeddingModelIdValue,
		embeddingModelName: data.embeddingModelName || undefined,
		systemPrompt: data.systemPrompt !== null && data.systemPrompt !== undefined ? String(data.systemPrompt) : "",
	};
	console.log('[fillDetailFormFromKnowledge] 填充后的表单值:', {
		embeddingModelId: detailFormValue.value.embeddingModelId,
		embeddingModelIdType: typeof detailFormValue.value.embeddingModelId,
	});
	// 如果embeddingModelId存在，确保embeddingModelName有值（从选项中找到对应的modelName）
	if (detailFormValue.value.embeddingModelId) {
		// 首先尝试通过ID匹配
		let selectedOption = vectorModelOptions.value.find(option => {
			const optionValueStr = String(option.value);
			const formValueStr = String(detailFormValue.value.embeddingModelId);
			const isMatch = optionValueStr === formValueStr;
			console.log('[fillDetailFormFromKnowledge] 通过ID比较选项:', {
				optionValue: option.value,
				optionValueStr,
				optionValueType: typeof option.value,
				formValue: detailFormValue.value.embeddingModelId,
				formValueStr,
				formValueType: typeof detailFormValue.value.embeddingModelId,
				isMatch,
				optionLabel: option.label,
			});
			return isMatch;
		});
		
		// 如果通过ID找不到，尝试通过模型名称匹配（容错处理）
		if (!selectedOption && data.embeddingModelName) {
			selectedOption = vectorModelOptions.value.find(option => {
				const isMatch = option.modelName === data.embeddingModelName || option.label === data.embeddingModelName;
				console.log('[fillDetailFormFromKnowledge] 通过名称比较选项:', {
					optionModelName: option.modelName,
					optionLabel: option.label,
					dataModelName: data.embeddingModelName,
					isMatch,
				});
				return isMatch;
			});
			// 如果通过名称找到了，更新 embeddingModelId 为正确的值
			if (selectedOption) {
				detailFormValue.value.embeddingModelId = selectedOption.value;
				console.warn('[fillDetailFormFromKnowledge] 通过名称找到匹配选项，已更新 embeddingModelId:', {
					原ID: data.embeddingModelId,
					新ID: selectedOption.value,
					模型名称: selectedOption.modelName,
				});
			}
		}
		
		if (selectedOption) {
			detailFormValue.value.embeddingModelName = selectedOption.modelName;
			console.log('[fillDetailFormFromKnowledge] 找到匹配的选项:', selectedOption);
		} else {
			console.warn('[fillDetailFormFromKnowledge] 未找到匹配的选项，ID:', detailFormValue.value.embeddingModelId, '模型名称:', data.embeddingModelName);
			// 即使找不到匹配的选项，也保留原始的 embeddingModelName（如果有的话）
			if (!detailFormValue.value.embeddingModelName && data.embeddingModelName) {
				detailFormValue.value.embeddingModelName = data.embeddingModelName;
			}
		}
	}
	// 保存原始数据（在填充完所有字段后）
	originalDetailFormValue.value = JSON.parse(JSON.stringify(detailFormValue.value));
	console.log('[fillDetailFormFromKnowledge] 最终表单值:', {
		embeddingModelId: detailFormValue.value.embeddingModelId,
		embeddingModelName: detailFormValue.value.embeddingModelName,
	});
}

// 检查详情表单验证状态
function checkDetailFormValidation() {
	if (!detailFormRef.value) {
		isDetailFormValid.value = false;
		return;
	}
		detailFormRef.value.validate((errors) => {
		if (errors && errors.length > 0) {
			isDetailFormValid.value = false;
			return false;
		} else {
			const hasRequiredFields = 
				detailFormValue.value.kname?.trim() &&
				detailFormValue.value.retrieveLimit !== undefined &&
				detailFormValue.value.textBlockSize !== undefined &&
				detailFormValue.value.vectorModelName &&
				detailFormValue.value.embeddingModelId !== undefined;
			isDetailFormValid.value = !!hasRequiredFields;
			return !!hasRequiredFields;
		}
	}, () => {
		isDetailFormValid.value = false;
		return false;
	});
}

// 详情表单验证更新
let detailValidationTimer: ReturnType<typeof setTimeout> | null = null;
function updateDetailFormValidation() {
	if (detailValidationTimer) {
		clearTimeout(detailValidationTimer);
	}
	detailValidationTimer = setTimeout(() => {
		checkDetailFormValidation();
	}, 300);
}


// 保存知识库编辑
async function saveKnowledgeDetail() {
	console.log('[saveKnowledgeDetail] ========== 开始保存知识库编辑 ==========');
	if (!detailFormRef.value || !currentKnowledgeId.value) {
		console.error('[saveKnowledgeDetail] 表单引用或知识库ID不存在');
		return;
	}
	console.log('[saveKnowledgeDetail] 当前知识库ID:', currentKnowledgeId.value);
	console.log('[saveKnowledgeDetail] 保存前的表单值:', {
		embeddingModelId: detailFormValue.value.embeddingModelId,
		embeddingModelIdType: typeof detailFormValue.value.embeddingModelId,
		embeddingModelName: detailFormValue.value.embeddingModelName,
		vectorModelName: detailFormValue.value.vectorModelName,
	});
	await detailFormRef.value.validate(async (errors) => {
		if (errors) {
			console.error('[saveKnowledgeDetail] 表单验证失败:', errors);
			message.error("请检查表单填写是否正确");
			return;
		}
		console.log('[saveKnowledgeDetail] 表单验证通过');
		try {
			// 处理 embeddingModelId：保持原始类型（可能是字符串或数字）
			const embeddingModelIdValue = detailFormValue.value.embeddingModelId;
			console.log('[saveKnowledgeDetail] 处理 embeddingModelId:', {
				原始值: embeddingModelIdValue,
				原始值类型: typeof embeddingModelIdValue,
			});
			let embeddingModelIdForSubmit: number | string | undefined = undefined;
			if (embeddingModelIdValue !== undefined && embeddingModelIdValue !== null) {
				if (typeof embeddingModelIdValue === 'string') {
					const idNum = Number(embeddingModelIdValue);
					// 如果超过安全整数范围，保持为字符串
					if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
						embeddingModelIdForSubmit = embeddingModelIdValue;
						console.log('[saveKnowledgeDetail] embeddingModelId 超过安全整数范围，保持为字符串:', embeddingModelIdForSubmit);
					} else {
						embeddingModelIdForSubmit = idNum;
						console.log('[saveKnowledgeDetail] embeddingModelId 转换为数字:', embeddingModelIdForSubmit);
					}
				} else {
					const idNum = Number(embeddingModelIdValue);
					if (idNum > Number.MAX_SAFE_INTEGER || idNum < Number.MIN_SAFE_INTEGER || isNaN(idNum)) {
						embeddingModelIdForSubmit = String(embeddingModelIdValue);
						console.log('[saveKnowledgeDetail] embeddingModelId 超过安全整数范围，转换为字符串:', embeddingModelIdForSubmit);
					} else {
						embeddingModelIdForSubmit = idNum;
						console.log('[saveKnowledgeDetail] embeddingModelId 保持为数字:', embeddingModelIdForSubmit);
					}
				}
			} else {
				console.warn('[saveKnowledgeDetail] embeddingModelId 为 undefined 或 null');
			}
			
			// 确保 embeddingModelName 有值（如果为空，从选项中找到对应的 modelName）
			let embeddingModelName = detailFormValue.value.embeddingModelName;
			console.log('[saveKnowledgeDetail] 处理 embeddingModelName:', {
				表单中的值: embeddingModelName,
				vectorModelOptions可用: vectorModelOptions.value && Array.isArray(vectorModelOptions.value),
				选项数量: vectorModelOptions.value?.length || 0,
			});
			if (!embeddingModelName && embeddingModelIdValue) {
				console.log('[saveKnowledgeDetail] embeddingModelName 为空，尝试从选项中找到对应的 modelName');
				// 使用字符串比较，避免大整数精度丢失
				const selectedOption = vectorModelOptions.value.find(option => {
					const optionValueStr = String(option.value);
					const formValueStr = String(embeddingModelIdValue);
					return optionValueStr === formValueStr;
				});
				if (selectedOption && selectedOption.modelName) {
					embeddingModelName = selectedOption.modelName;
					console.log('[saveKnowledgeDetail] ✓ 从选项中找到 embeddingModelName:', embeddingModelName);
				} else {
					console.warn('[saveKnowledgeDetail] ✗ 未找到匹配的选项，embeddingModelName 仍为空');
				}
			} else if (embeddingModelName) {
				console.log('[saveKnowledgeDetail] ✓ 使用表单中的 embeddingModelName:', embeddingModelName);
			} else {
				console.warn('[saveKnowledgeDetail] ✗ embeddingModelName 最终仍为空');
			}
			
			// 处理大整数字段：如果超过安全整数范围，保持为字符串，让后端 Jackson 反序列化
			const idValue = detailKnowledgeData.value?.id;
			const uidValue = detailKnowledgeData.value?.uid;
			const idNum = idValue ? (typeof idValue === 'string' ? (Number(idValue) > Number.MAX_SAFE_INTEGER ? idValue : Number(idValue)) : idValue) : undefined;
			const uidNum = uidValue ? (typeof uidValue === 'string' ? (Number(uidValue) > Number.MAX_SAFE_INTEGER ? uidValue : Number(uidValue)) : uidValue) : undefined;
			
			const params: KnowledgeReq = {
				id: idNum as any,
				kid: currentKnowledgeId.value || undefined,
				uid: uidNum as any,
				kname: detailFormValue.value.kname.trim(),
				share: detailFormValue.value.share,
				description: detailFormValue.value.description?.trim() || undefined,
				category: detailFormValue.value.category || undefined,
				knowledgeSeparator: detailFormValue.value.knowledgeSeparator?.trim() || undefined,
				questionSeparator: detailFormValue.value.questionSeparator?.trim() || undefined,
				overlapChar: detailFormValue.value.overlapChar || 50,
				retrieveLimit: Number(detailFormValue.value.retrieveLimit),
				textBlockSize: Number(detailFormValue.value.textBlockSize),
				vectorModelName: detailFormValue.value.vectorModelName,
				embeddingModelId: embeddingModelIdForSubmit,
				embeddingModelName: embeddingModelName || undefined,
				systemPrompt: detailFormValue.value.systemPrompt?.trim() || undefined,
			};
			console.log('[saveKnowledgeDetail] 准备提交的参数:', {
				kid: params.kid,
				embeddingModelId: params.embeddingModelId,
				embeddingModelIdType: typeof params.embeddingModelId,
				embeddingModelName: params.embeddingModelName,
				vectorModelName: params.vectorModelName,
			});
			console.log('[saveKnowledgeDetail] 完整参数对象:', JSON.stringify(params, null, 2));
			
			await updateKnowledgeReq(params);
			console.log('[saveKnowledgeDetail] ✓ API 调用成功');
			message.success("知识库更新成功");
			showDetailModal.value = false;
			// 刷新列表
			fetchData();
			console.log('[saveKnowledgeDetail] ========== 保存知识库编辑完成 ==========');
		} catch (error: any) {
			const errorMsg = error?.responseData?.msg || 
							error?.message || 
							error?.msg || 
							error?.response?.data?.msg || 
							"更新知识库失败";
			message.error(errorMsg);
		}
	});
}

// 处理模态框显示状态变化
function handleDetailModalShowChange(show: boolean) {
	if (!show) {
		// 模态框关闭时，重置表单（不保存任何编辑）
		resetDetailForm();
	}
}

// 重置详情表单
function resetDetailForm() {
	detailFormValue.value = {
		kname: "",
		share: 0,
		description: "",
		category: undefined,
		knowledgeSeparator: "",
		questionSeparator: "",
		overlapChar: 50,
		retrieveLimit: 3,
		textBlockSize: 500,
		vectorModelName: "",
		embeddingModelId: undefined,
		embeddingModelName: undefined,
		systemPrompt: "",
	};
	originalDetailFormValue.value = {
		kname: "",
		share: 0,
		description: "",
		category: undefined,
		knowledgeSeparator: "",
		questionSeparator: "",
		overlapChar: 50,
		retrieveLimit: 3,
		textBlockSize: 500,
		vectorModelName: "",
		embeddingModelId: undefined,
		embeddingModelName: undefined,
		systemPrompt: "",
	};
	currentKnowledgeId.value = null;
	detailKnowledgeData.value = null;
}

// 恢复知识库原始数据
function restoreKnowledgeDetail() {
	if (!currentKnowledgeId.value || !originalDetailFormValue.value) return;
	// 恢复到原始数据
	detailFormValue.value = JSON.parse(JSON.stringify(originalDetailFormValue.value));
	// 如果embeddingModelId存在但embeddingModelName为空，从选项中找到对应的modelName
	if (detailFormValue.value.embeddingModelId && !detailFormValue.value.embeddingModelName) {
		const selectedOption = vectorModelOptions.value.find(option => option.value === detailFormValue.value.embeddingModelId);
		if (selectedOption) {
			detailFormValue.value.embeddingModelName = selectedOption.modelName;
		}
	}
	nextTick(() => {
		checkDetailFormValidation();
	});
}

// 关闭详情模态框
function closeDetailModal() {
	showDetailModal.value = false;
	// resetDetailForm会在handleDetailModalShowChange中调用
}

// 标签管理刷新处理
function handleTagManageRefresh() {
	// 标签管理操作后，可以在这里触发相关刷新
	// 目前标签管理是独立的，不需要刷新知识库列表
}
</script>

<template>
	<div class="knowledge-list-page" role="main" aria-label="知识库列表页">
		<!-- 工具栏 -->
		<div class="toolbar" role="toolbar" aria-label="知识库操作工具栏">
			<div class="toolbar-left">
				<n-button type="primary" @click="activate('right')">
					<template #icon>
						<SvgIcon icon="ri:add-line" />
					</template>
					新建知识库
				</n-button>
				<n-button v-if="selectedRowKeys.length > 0" type="error" @click="handleBatchDelete">
					<template #icon>
						<SvgIcon icon="ri:delete-bin-line" />
					</template>
					批量删除 ({{ selectedRowKeys.length }})
				</n-button>
			</div>
			<div class="toolbar-filters">
				<!-- 常用筛选：搜索 -->
				<n-input
					v-model:value="searchKeyword"
					placeholder="搜索知识库名称或描述"
					clearable
					@input="handleSearch"
					@clear="handleSearch"
					style="width: 250px"
				>
					<template #prefix>
						<SvgIcon icon="ri:search-line" />
					</template>
				</n-input>
				<!-- 常用筛选：分类 -->
				<n-popover trigger="click" placement="bottom-start" :show-arrow="false" style="padding: 0">
					<template #trigger>
						<n-button style="width: 180px; justify-content: space-between" secondary>
							<span>
								{{ filterState.category && filterState.category.length > 0 
									? (categoryOptions.length > 0 && filterState.category.length === categoryOptions.length 
										? '全部分类' 
										: `已选${filterState.category.length}项`)
									: '分类' }}
							</span>
							<SvgIcon icon="ri:arrow-down-s-line" />
						</n-button>
					</template>
					<div style="padding: 8px; min-width: 200px; max-height: 300px; overflow-y: auto;">
						<!-- 全选选项 -->
						<div style="padding: 4px 0 8px 0; border-bottom: 1px solid var(--n-border-color); margin-bottom: 8px;">
							<n-checkbox 
								:checked="categorySelectAllState === true"
								:indeterminate="categorySelectAllState === null"
								@update:checked="toggleCategorySelectAll"
								style="font-weight: 500;"
							>
								全部分类
							</n-checkbox>
						</div>
						<!-- 分类选项 -->
						<n-checkbox-group v-model:value="filterState.category" @update:value="handleCategoryChange">
							<n-space vertical :size="4">
								<n-checkbox
									v-for="option in categoryOptions"
									:key="option.value"
									:value="option.value"
								>
									{{ option.label }}
								</n-checkbox>
							</n-space>
						</n-checkbox-group>
					</div>
				</n-popover>
				<n-select
					v-model:value="filterState.ownershipType"
					:options="[
						{ label: '全部所有权类型', value: 'all' },
						{ label: '我创建的', value: 'mine' },
						{ label: '分配给我的', value: 'assigned' }
					]"
					placeholder="所有权类型"
					style="width: 160px"
					@update:value="fetchData"
				/>
				<!-- 高级筛选按钮 -->
				<n-button @click="showFilterPanel = true" secondary>
					<template #icon>
						<SvgIcon icon="ri:filter-line" />
					</template>
					高级筛选
				</n-button>
				<!-- 排序选项 -->
				<n-select
					v-model:value="filterState.orderBy"
					:options="sortOptions"
					:placeholder="getSortPlaceholder()"
					style="width: 180px"
					@update:value="fetchData"
				/>
				<n-popover trigger="hover" placement="bottom">
					<template #trigger>
						<n-button
							@click="filterState.order = filterState.order === 'asc' ? 'desc' : 'asc'; fetchData()"
							quaternary
							:aria-label="`切换排序方向，当前为${filterState.order === 'asc' ? '升序' : '降序'}`"
						>
							<template #icon>
								<SvgIcon :icon="filterState.order === 'asc' ? 'ri:arrow-up-line' : 'ri:arrow-down-line'" />
							</template>
						</n-button>
					</template>
					<div style="padding: 4px 0;">
						<div style="font-weight: 500; margin-bottom: 4px;">当前排序方向</div>
						<div style="color: var(--n-text-color-2); font-size: 12px;">
							{{ filterState.order === 'asc' ? '升序 ↑' : '降序 ↓' }}
						</div>
					</div>
				</n-popover>
			</div>
			<n-button secondary @click="showTagManageModal = true">
					<template #icon>
						<SvgIcon icon="ri:price-tag-3-line" />
					</template>
					知识条目标签管理
			</n-button>
			<div class="toolbar-right">
				<n-tooltip trigger="hover" placement="bottom">
					<template #trigger>
						<n-button @click="handleRefreshStatistics" quaternary :loading="refreshingStatistics">
							<template #icon>
								<SvgIcon icon="ri:refresh-line" />
							</template>
						</n-button>
					</template>
					刷新
				</n-tooltip>
				<GlobalUploadTrigger @click="uploadManagerRef?.show()" />
				<!-- 列配置按钮（仅列表视图显示） -->
				<n-tooltip v-if="viewMode === 'list'" trigger="hover" placement="bottom">
					<template #trigger>
						<n-button @click="showColumnConfig = true" quaternary>
							<template #icon>
								<SvgIcon icon="ri:settings-3-line" />
							</template>
						</n-button>
					</template>
					列配置
				</n-tooltip>
				<!-- 视图切换 -->
				<n-button-group>
					<n-tooltip trigger="hover" placement="bottom">
						<template #trigger>
							<n-button :type="viewMode === 'list' ? 'primary' : 'default'" @click="viewMode = 'list'">
								<template #icon>
									<SvgIcon icon="ri:list-check" />
								</template>
							</n-button>
						</template>
						列表视图
					</n-tooltip>
					<n-tooltip trigger="hover" placement="bottom">
						<template #trigger>
							<n-button :type="viewMode === 'card' ? 'primary' : 'default'" @click="viewMode = 'card'">
								<template #icon>
									<SvgIcon icon="ri:grid-line" />
								</template>
							</n-button>
						</template>
						卡片视图
					</n-tooltip>
				</n-button-group>
			</div>
		</div>

		<!-- 活动筛选条 -->
		<div v-if="hasActiveFilters" class="active-filters-bar" role="toolbar" aria-label="已应用的筛选条件">
			<n-space :size="8" wrap>
				<n-tag
					v-if="searchKeyword.trim()"
					closable
					@close="searchKeyword = ''; handleSearch()"
					:aria-label="`搜索: ${searchKeyword}, 点击移除`"
				>
					搜索: {{ searchKeyword }}
				</n-tag>
				<n-tag
					v-for="cat in getActiveCategoryFilters()"
					:key="cat"
					closable
					@close="removeCategoryFilter(cat)"
					:aria-label="`分类: ${getCategoryLabel(cat)}, 点击移除`"
				>
					分类: {{ getCategoryLabel(cat) }}
				</n-tag>
				<n-tag
					v-if="filterState.ownershipType !== 'all'"
					closable
					@close="filterState.ownershipType = 'all'; fetchData()"
					:aria-label="`所有权类型: ${filterState.ownershipType === 'mine' ? '我创建的' : '分配给我的'}, 点击移除`"
				>
					所有权类型: {{ filterState.ownershipType === 'mine' ? '我创建的' : '分配给我的' }}
				</n-tag>
				<n-button 
					size="small" 
					secondary 
					@click="clearAllFilters" 
					aria-label="恢复默认筛选条件"
					style="height: 24px; padding: 0 8px; font-size: 12px; display: flex; padding-top: 1px;"
				>
					<template #icon>
						<SvgIcon icon="ri:refresh-line" style="font-size: 12px; vertical-align: middle;" />
					</template>
					<span style="display: flex; align-items: center; height: 100%;font-size: 12px;">清除筛选</span>
				</n-button>
			</n-space>
		</div>

		<!-- 主视图 -->
		<div class="main-view">
			<!-- 空状态（管理员选择了"分配给我的"） -->
			<n-alert 
				v-if="!loading && isAdminAssignedFilter"
				type="default"
				style="margin-bottom: 16px;"
			>
				管理员账户拥有所有知识库的访问权限，无需使用"分配给我的"筛选。
				<template #action>
					<n-button size="small" @click="filterState.ownershipType = 'all'; fetchData();">
						查看全部
					</n-button>
				</template>
			</n-alert>
			
			<!-- 空状态（有筛选条件但无结果） -->
			<n-empty 
				v-else-if="!loading && tableData.length === 0 && hasActiveFilters" 
				description="没有找到符合筛选条件的知识库"
			>
				<template #extra>
					<n-button type="primary" @click="clearAllFilters">恢复默认</n-button>
				</template>
			</n-empty>
			
			<!-- 列表和卡片视图 -->
			<n-spin v-else-if="viewMode === 'list' || viewMode === 'card'" :show="loading && refreshingStatistics" style="min-height: 400px;">
				<n-data-table
					v-if="viewMode === 'list'"
					:columns="columns"
					:data="tableData"
					:loading="loading"
					:pagination="pagination"
					:row-key="(row: any) => row.kid || row.id"
					v-model:checked-row-keys="selectedRowKeys"
					role="table"
					aria-label="知识库列表"
					striped
					resizable
				/>
				<div v-else-if="viewMode === 'card'" class="card-view">
				<n-card
					v-for="item in tableData"
					:key="item.kid || item.id"
					hoverable
					class="knowledge-card"
				>
					<template #header>
						<div class="card-header">
							<span class="card-title">
								<template v-if="searchKeyword.trim()">
									<component :is="() => h('span', {}, highlightText(item.kname || '未命名知识库', extractKeywords(searchKeyword.trim())))" />
								</template>
								<template v-else>
									{{ item.kname || '未命名知识库' }}
								</template>
							</span>
						</div>
					</template>
					<template #header-extra>
						<n-space :size="8">
							<n-tag v-if="item.category" size="small" type="info">{{ getCategoryLabel(item.category) }}</n-tag>
						</n-space>
					</template>
					<p class="card-description">
						<template v-if="searchKeyword.trim()">
							<component :is="() => h('span', {}, highlightText(item.description || '暂无描述', extractKeywords(searchKeyword.trim())))" />
						</template>
						<template v-else>
							{{ item.description || '暂无描述' }}
						</template>
					</p>
					<div class="card-stats">
						<div class="stat-item">
							<span class="stat-label">条目:</span>
							<span class="stat-value">{{ item.itemCount || 0 }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">片段:</span>
							<span class="stat-value">{{ item.fragmentCount || 0 }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">大小:</span>
							<span class="stat-value">{{ formatFileSize(item.dataSize) }}</span>
						</div>
					</div>
					<div class="card-tech-info">
						<div class="tech-item" v-if="item.vectorModelName">
							<span class="tech-label">向量库:</span>
							<span class="tech-value">{{ item.vectorModelName }}</span>
						</div>
						<div class="tech-item" v-if="item.embeddingModelName">
							<span class="tech-label">向量化模型:</span>
							<span class="tech-value">{{ item.embeddingModelName }}</span>
						</div>
						<div class="tech-item" v-if="item.retrieveLimit">
							<span class="tech-label">检索条数:</span>
							<span class="tech-value">{{ item.retrieveLimit }}</span>
						</div>
						<div class="tech-item" v-if="item.textBlockSize">
							<span class="tech-label">文本块大小:</span>
							<span class="tech-value">{{ item.textBlockSize }}</span>
						</div>
					</div>
					<div class="card-meta">
						<span>创建: {{ formatTime(item.createTime) }}</span>
						<span>更新: {{ formatTime(item.updateTime) }}</span>
					</div>
							<template #action>
								<n-space justify="end">
							<n-tooltip trigger="hover" placement="top">
								<template #trigger>
									<n-button size="small" @click="openDetailModal(item)" type="primary" quaternary>
										<template #icon>
											<SvgIcon icon="ri:information-line" />
										</template>
									</n-button>
								</template>
										查看详情
							</n-tooltip>
							<n-tooltip trigger="hover" placement="top">
								<template #trigger>
									<n-button size="small" @click="handleActionButtonClick(item, 'action3')" type="primary" quaternary>
										<template #icon>
											<SvgIcon icon="ri:file-list-line" />
										</template>
									</n-button>
								</template>
										{{ $t("knowledge.knowledgeItem") }}
							</n-tooltip>
							<n-tooltip trigger="hover" placement="top">
								<template #trigger>
									<n-button size="small" @click="handleAttachmentManage(item)" type="primary" quaternary>
										<template #icon>
											<SvgIcon icon="ri:attachment-line" />
										</template>
									</n-button>
								</template>
										附件管理
							</n-tooltip>
							<n-tooltip trigger="hover" placement="top">
								<template #trigger>
									<n-button size="small" @click="delKnowledgeForm(item.kid || item.id)" type="error" quaternary>
										<template #icon>
											<SvgIcon icon="ri:delete-bin-line" />
										</template>
									</n-button>
								</template>
										{{ $t("knowledge.delete") }}
							</n-tooltip>
								</n-space>
							</template>
						</n-card>
					</div>
			</n-spin>

			<!-- 空状态（无筛选条件且无数据） -->
			<n-empty v-else-if="!loading && tableData.length === 0 && !hasActiveFilters" description="暂无知识库">
				<template #extra>
					<n-button type="primary" @click="activate('right')">创建知识库</n-button>
				</template>
			</n-empty>
		</div>

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
				aria-label="分页导航"
				/>
	</div>

		<n-drawer class="knowledge-drawer" v-model:show="active" :width="900" :placement="placement"
		display-directive="show" :mask-closable="true" @mask-click="handleMainContentClick">
		<n-drawer-content title="创建知识库" class="drawer-content" closable>
			<n-form ref="formRef" :model="formValue" :rules="rules" label-placement="top" 
				class="knowledge-form" :show-label="true">
				<n-space vertical :size="24">
					<!-- 基础信息区 -->
					<div class="form-section">
						<n-grid :cols="24" :x-gap="20" :y-gap="0">
							<n-gi :span="24">
								<n-form-item path="kname" label="知识库名称">
									<n-input 
										v-model:value="formValue.kname"  
										clearable 
										:maxlength="50"
										show-count
										@blur="updateFormValidation"
										@input="updateFormValidation"
									/>
							</n-form-item>
						</n-gi>

							<n-gi :span="24">
								<n-form-item path="description" label="描述">
									<n-input 
										type="textarea" 
										v-model:value="formValue.description"
										:autosize="{ minRows: 1, maxRows: 10 }"
										:maxlength="1000"
										show-count
										clearable
										@blur="updateFormValidation"
										@input="updateFormValidation"
									/>
							</n-form-item>
						</n-gi>

						<n-gi :span="12">
								<n-form-item path="category" label="分类">
									<n-select 
										v-model:value="formValue.category" 
										:options="categoryOptions"
										placeholder="选择知识库分类" 
										clearable
										filterable
										@update:value="updateFormValidation"
									/>
							</n-form-item>
						</n-gi>

							<n-gi :span="10">
							</n-gi>
						</n-grid>
					</div>
					
					<!-- 技术配置区 -->
					<n-collapse :default-expanded-names="['tech-config']" @update:expanded-names="handleCollapseExpanded">
						<n-collapse-item name="tech-config" title="技术配置">
							<n-grid :cols="24" :x-gap="20" :y-gap="0">
						<n-gi :span="12">
									<n-form-item path="vectorModelName">
										<template #label>
											<span class="label-with-tooltip">
												向量库类型
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													用于存储向量数据的数据库
												</n-tooltip>
											</span>
										</template>
										<n-select 
											v-model:value="formValue.vectorModelName" 
											:options="vectorStoreOptions"
											placeholder="选择向量库" 
											@update:value="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>

						<n-gi :span="12">
									<n-form-item path="embeddingModelId">
										<template #label>
											<span class="label-with-tooltip">
												向量模型
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													用于将文本转换为向量的模型
												</n-tooltip>
											</span>
										</template>
										<n-select 
											v-model:value="formValue.embeddingModelId" 
											:options="vectorModelOptions"
											placeholder="选择向量化模型" 
											label-field="label"
											value-field="value"
											@update:value="handleEmbeddingModelChange"
										/>
							</n-form-item>
						</n-gi>

						<n-gi :span="12">
									<n-form-item path="retrieveLimit">
										<template #label>
											<span class="label-with-tooltip">
												检索返回条数
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													每次检索返回的最多结果数量（1-10）
												</n-tooltip>
											</span>
										</template>
										<n-input-number 
											v-model:value="formValue.retrieveLimit" 
											placeholder="例如：3" 
											:min="1"
											:max="10" 
											class="full-width"
											@blur="updateFormValidation"
											@update:value="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>

						<n-gi :span="12">
									<n-form-item path="textBlockSize">
										<template #label>
											<span class="label-with-tooltip">
												文本块大小
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													每个文本块的最大字符数（100-2000）
												</n-tooltip>
											</span>
										</template>
										<n-input-number 
											v-model:value="formValue.textBlockSize" 
											placeholder="例如：500" 
											:min="100"
											:max="2000" 
											class="full-width"
											@blur="updateFormValidation"
											@update:value="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>

						<n-gi :span="12">
									<n-form-item path="overlapChar">
										<template #label>
											<span class="label-with-tooltip">
												重叠字符数
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													文本块之间的重叠字符数，有助于保持上下文（0-200）
												</n-tooltip>
											</span>
										</template>
										<n-input-number 
											v-model:value="formValue.overlapChar" 
											placeholder="例如：50" 
											:min="0"
											:max="200" 
											class="full-width"
											@blur="updateFormValidation"
											@update:value="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>

						<n-gi :span="12">
									<n-form-item path="knowledgeSeparator">
										<template #label>
											<span class="label-with-tooltip">
												知识分隔符
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													可选，如果设置，将优先按此分隔符分块
												</n-tooltip>
											</span>
										</template>
										<n-input 
											v-model:value="formValue.knowledgeSeparator" 
											placeholder="例如：\n\n 或 ###" 
									clearable
											:maxlength="255"
											@blur="updateFormValidation"
											@input="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>
							</n-grid>
						</n-collapse-item>
						
						<!-- 高级配置区 -->
						<n-collapse-item name="advanced-config" title="高级配置">
							<div ref="advancedConfigRef">
								<n-grid :cols="24" :x-gap="20" :y-gap="0">
						<n-gi :span="24">
									<n-form-item path="systemPrompt" label="系统提示词">
										<n-input 
											type="textarea" 
											v-model:value="formValue.systemPrompt" 
											placeholder="用于RAG检索时的上下文构建，例如：你是一个安全专家..." 
											:autosize="{ minRows: 3, maxRows: 10 }"
											:maxlength="255"
											show-count
											clearable
											@blur="updateFormValidation"
											@input="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>

						<n-gi :span="24">
									<n-form-item path="questionSeparator">
										<template #label>
											<span class="label-with-tooltip">
												提问分隔符
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													可选，用于多轮对话场景
												</n-tooltip>
											</span>
										</template>
										<n-input 
											v-model:value="formValue.questionSeparator" 
											placeholder="用于多轮对话场景的分隔符" 
											clearable
											:maxlength="255"
											@blur="updateFormValidation"
											@input="updateFormValidation"
										/>
							</n-form-item>
						</n-gi>
					</n-grid>
							</div>
						</n-collapse-item>
					</n-collapse>
			</n-space>
			</n-form>

			<template #footer>
				<n-space justify="end" :size="12">
					<n-button @click="active = false" secondary>
						取消
					</n-button>
					<n-button 
						type="primary" 
						@click="submitForm" 
						:loading="submitting"
						:disabled="!isFormValid || submitting"
					>
						创建
					</n-button>
				</n-space>
			</template>
		</n-drawer-content>
	</n-drawer>

		<!-- 高级筛选面板 -->
		<n-drawer
			v-model:show="showFilterPanel"
			:width="600"
			placement="right"
			role="dialog"
			aria-labelledby="filter-panel-title"
		>
			<n-drawer-content title="全部筛选" closable>
				<n-form label-placement="top" class="filter-form">
					<n-space vertical :size="20">
						<!-- 条目数区间 -->
						<n-form-item label="条目数">
							<n-space>
								<n-input-number
									v-model:value="filterState.itemCountMin"
									placeholder="最小值"
									:min="0"
									style="width: 100%"
									@update:value="() => { pagination.page = 1; fetchData(); }"
								/>
								<span>至</span>
								<n-input-number
									v-model:value="filterState.itemCountMax"
									placeholder="最大值"
									:min="0"
									style="width: 100%"
									@update:value="() => { pagination.page = 1; fetchData(); }"
								/>
							</n-space>
						</n-form-item>

						<!-- 片段数区间 -->
						<n-form-item label="片段数">
							<n-space>
								<n-input-number
									v-model:value="filterState.fragmentCountMin"
									placeholder="最小值"
									:min="0"
									style="width: 100%"
									@update:value="() => { pagination.page = 1; fetchData(); }"
								/>
								<span>至</span>
								<n-input-number
									v-model:value="filterState.fragmentCountMax"
									placeholder="最大值"
									:min="0"
									style="width: 100%"
									@update:value="() => { pagination.page = 1; fetchData(); }"
								/>
							</n-space>
						</n-form-item>

						<!-- 存储大小区间 -->
						<n-form-item label="存储大小 (字节)">
							<n-space>
								<n-input-number
									v-model:value="filterState.dataSizeMin"
									placeholder="最小值"
									:min="0"
									style="width: 100%"
									@update:value="() => { pagination.page = 1; fetchData(); }"
								/>
								<span>至</span>
								<n-input-number
									v-model:value="filterState.dataSizeMax"
									placeholder="最大值"
									:min="0"
									style="width: 100%"
									@update:value="() => { pagination.page = 1; fetchData(); }"
								/>
							</n-space>
						</n-form-item>

						<!-- 创建时间范围 -->
						<n-form-item label="创建时间">
							<n-date-picker
								v-model:value="createTimeRange"
								type="datetimerange"
								clearable
								placeholder="选择时间范围"
								style="width: 100%"
							/>
						</n-form-item>

						<!-- 更新时间范围 -->
						<n-form-item label="更新时间">
							<n-date-picker
								v-model:value="updateTimeRange"
								type="datetimerange"
								clearable
								placeholder="选择时间范围"
								style="width: 100%"
							/>
						</n-form-item>
					</n-space>
				</n-form>
				<template #footer>
					<n-space justify="end">
						<n-button @click="resetFilters">重置</n-button>
					</n-space>
				</template>
			</n-drawer-content>
		</n-drawer>

		<!-- 知识库详情/编辑模态框 -->
		<n-modal 
			v-model:show="showDetailModal" 
			preset="card" 
			title="知识库详情" 
			style="width: 900px"
			:mask-closable="true"
			@update:show="handleDetailModalShowChange"
		>
			<n-form 
				ref="detailFormRef" 
				:model="detailFormValue" 
				:rules="detailRules" 
				label-placement="top" 
				class="knowledge-form"
				:disabled="!canEditKnowledge"
			>
				<n-space vertical :size="5">
					<!-- 基本信息区 -->
					<div class="form-section">
						<n-grid :cols="24" :x-gap="20" :y-gap="0">
							<n-gi :span="24">
								<n-form-item path="kname" label="知识库名称">
									<n-input 
										v-model:value="detailFormValue.kname"  
										clearable 
										:maxlength="50"
										show-count
										@blur="updateDetailFormValidation"
										@input="updateDetailFormValidation"
									/>
								</n-form-item>
							</n-gi>
							<n-gi :span="24">
								<n-form-item path="description" label="描述">
									<n-input 
										type="textarea" 
										v-model:value="detailFormValue.description"
										:autosize="{ minRows: 1, maxRows: 10 }"
										:maxlength="1000"
										show-count
										clearable
										@blur="updateDetailFormValidation"
										@input="updateDetailFormValidation"
									/>
								</n-form-item>
							</n-gi>
							<n-gi :span="12">
								<n-form-item path="category" label="分类">
									<n-select 
										v-model:value="detailFormValue.category" 
										:options="categoryOptions"
										placeholder="选择知识库分类" 
										clearable
										filterable
										:multiple="false"
										@update:value="updateDetailFormValidation"
									/>
								</n-form-item>
							</n-gi>
						</n-grid>
					</div>
					<!-- 时间信息（只读） -->
					<div class="form-section" v-if="detailKnowledgeData">
						<n-grid :cols="24" :x-gap="20" :y-gap="0">
							<n-gi :span="12">
								<n-form-item label="创建时间">
									<n-input :value="formatTime(detailKnowledgeData.createTime)" readonly />
								</n-form-item>
							</n-gi>
							<n-gi :span="12">
								<n-form-item label="更新时间">
									<n-input :value="formatTime(detailKnowledgeData.updateTime)" readonly />
								</n-form-item>
							</n-gi>
						</n-grid>
					</div>
					<!-- 权限提示 -->
					<n-alert v-if="!canEditKnowledge && currentKnowledgeId" type="info" :bordered="false" style="margin-bottom: 0;">
						<template #header>
							<span style="font-weight: 500;">仅查看模式</span>
						</template>
						您当前没有编辑此知识库的权限。只有知识库的创建者或管理员可以编辑。
					</n-alert>
					<!-- 技术配置区 -->
					<n-collapse :default-expanded-names="['tech-config']" @update:expanded-names="handleDetailCollapseExpanded">
						<n-collapse-item name="tech-config" title="技术配置">
							<n-grid :cols="24" :x-gap="20" :y-gap="0">
								<n-gi :span="12">
									<n-form-item path="vectorModelName">
										<template #label>
											<span class="label-with-tooltip">
												向量库类型
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													用于存储向量数据的数据库
												</n-tooltip>
											</span>
										</template>
										<n-select 
											v-model:value="detailFormValue.vectorModelName" 
											:options="vectorStoreOptions"
											placeholder="选择向量库" 
											:multiple="false"
											@update:value="updateDetailFormValidation"
										/>
									</n-form-item>
								</n-gi>
								<n-gi :span="12">
									<n-form-item path="embeddingModelId">
										<template #label>
											<span class="label-with-tooltip">
												向量模型
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													用于将文本转换为向量的模型
												</n-tooltip>
											</span>
										</template>
										<n-select 
											v-model:value="detailFormValue.embeddingModelId" 
											:options="vectorModelOptions"
											placeholder="选择向量化模型" 
											:multiple="false"
											@update:value="handleDetailEmbeddingModelChange"
										/>
									</n-form-item>
								</n-gi>
								<n-gi :span="12">
									<n-form-item path="retrieveLimit">
										<template #label>
											<span class="label-with-tooltip">
												检索返回条数
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													每次检索返回的最多结果数量（1-10）
												</n-tooltip>
											</span>
										</template>
										<n-input-number 
											v-model:value="detailFormValue.retrieveLimit" 
											placeholder="例如：3" 
											:min="1"
											:max="10" 
											class="full-width"
											@blur="updateDetailFormValidation"
											@update:value="updateDetailFormValidation"
										/>
									</n-form-item>
								</n-gi>
								<n-gi :span="12">
									<n-form-item path="textBlockSize">
										<template #label>
											<span class="label-with-tooltip">
												文本块大小
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													每个文本块的最大字符数（100-2000）
												</n-tooltip>
											</span>
										</template>
										<n-input-number 
											v-model:value="detailFormValue.textBlockSize" 
											placeholder="例如：500" 
											:min="100"
											:max="2000" 
											class="full-width"
											@blur="updateDetailFormValidation"
											@update:value="updateDetailFormValidation"
										/>
									</n-form-item>
								</n-gi>
								<n-gi :span="12">
									<n-form-item path="overlapChar">
										<template #label>
											<span class="label-with-tooltip">
												重叠字符数
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													文本块之间的重叠字符数，有助于保持上下文（0-200）
												</n-tooltip>
											</span>
										</template>
										<n-input-number 
											v-model:value="detailFormValue.overlapChar" 
											placeholder="例如：50" 
											:min="0"
											:max="200" 
											class="full-width"
											@blur="updateDetailFormValidation"
											@update:value="updateDetailFormValidation"
										/>
									</n-form-item>
								</n-gi>
								<n-gi :span="12">
									<n-form-item path="knowledgeSeparator">
										<template #label>
											<span class="label-with-tooltip">
												知识分隔符
												<n-tooltip trigger="hover" placement="top">
													<template #trigger>
														<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
													</template>
													可选，如果设置，将优先按此分隔符分块
												</n-tooltip>
											</span>
										</template>
										<n-input 
											v-model:value="detailFormValue.knowledgeSeparator" 
											placeholder="例如：\n\n 或 ###" 
											clearable
											:maxlength="255"
											@blur="updateDetailFormValidation"
											@input="updateDetailFormValidation"
										/>
									</n-form-item>
								</n-gi>
							</n-grid>
						</n-collapse-item>
						<!-- 高级配置区 -->
						<n-collapse-item name="advanced-config" title="高级配置">
							<div ref="detailAdvancedConfigRef">
								<n-grid :cols="24" :x-gap="20" :y-gap="0">
									<n-gi :span="24">
										<n-form-item path="systemPrompt" label="系统提示词">
											<n-input 
												type="textarea" 
												v-model:value="detailFormValue.systemPrompt" 
												placeholder="用于RAG检索时的上下文构建，例如：你是一个安全专家..." 
												:autosize="{ minRows: 3, maxRows: 10 }"
												:maxlength="255"
												show-count
												clearable
												@blur="updateDetailFormValidation"
												@input="updateDetailFormValidation"
											/>
										</n-form-item>
									</n-gi>
									<n-gi :span="24">
										<n-form-item path="questionSeparator">
											<template #label>
												<span class="label-with-tooltip">
													提问分隔符
													<n-tooltip trigger="hover" placement="top">
														<template #trigger>
															<SvgIcon icon="mdi:information-outline" class="label-tooltip-icon" />
														</template>
														可选，用于多轮对话场景
													</n-tooltip>
												</span>
											</template>
											<n-input 
												v-model:value="detailFormValue.questionSeparator" 
												placeholder="用于多轮对话场景的分隔符" 
												clearable
												:maxlength="255"
												@blur="updateDetailFormValidation"
												@input="updateDetailFormValidation"
											/>
										</n-form-item>
									</n-gi>
								</n-grid>
							</div>
						</n-collapse-item>
					</n-collapse>
				</n-space>
			</n-form>
			<template #footer>
				<n-space justify="end" :size="12">
					<n-button @click="closeDetailModal" secondary>
						关闭
					</n-button>
					<n-button 
						v-if="isDetailFormDirty && canEditKnowledge"
						@click="restoreKnowledgeDetail" 
						secondary
					>
						恢复
					</n-button>
					<n-button 
						v-if="isDetailFormDirty && canEditKnowledge"
						type="primary" 
						@click="saveKnowledgeDetail" 
						:disabled="!isDetailFormValid"
					>
						保存
					</n-button>
				</n-space>
			</template>
		</n-modal>

		<!-- 列配置模态框 -->
		<n-modal v-model:show="showColumnConfig" preset="card" title="列配置" style="width: 500px">
			<n-space vertical :size="16">
				<n-checkbox-group v-model:value="visibleColumns" @update:value="handleColumnVisibilityChange">
					<n-space vertical :size="12">
						<n-checkbox
							v-for="col in allColumnDefs"
							:key="col.key"
							:value="col.key"
							:label="col.title"
						/>
					</n-space>
				</n-checkbox-group>
				<n-space justify="space-between">
					<n-button @click="resetColumnConfigToDefault">恢复默认</n-button>
					<n-button @click="showColumnConfig = false">关闭</n-button>
				</n-space>
			</n-space>
		</n-modal>

		<!-- 标签管理模态框 -->
		<TagManageModal
			v-model="showTagManageModal"
			@refresh="handleTagManageRefresh"
		/>
	</div>
	
	<GlobalUploadManager ref="uploadManagerRef" />
</template>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: var(--n-color-body);
  padding: 20px;
  padding-top: 80px;
}

.create-app-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
}

.panel-title {
	font-size: 16px;
	color: #888;
	margin-bottom: 15px;
	font-weight: bold;
}

.panel-button {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 10px 15px;
	margin-bottom: 10px;
	font-size: 14px;
	color: #333;
	border-radius: 6px;
	transition: background-color 0.2s ease;
}

.panel-button:hover {
	background-color: #f0f2f5;
}

.content-panel {
	flex: 1; /* Takes the remaining space */
}


.knowledge-card {
	border-radius: 20px;
	overflow: hidden;
	transition: all 0.3s ease;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	margin: 10px; /* 添加上下左右 10px 边距 */
}

.knowledge-card:hover {
	transform: translateY(-5px); /* 更明显的悬停效果 */
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.card-meta {
	font-size: 12px;
	color: #999;
	margin-top: 5px;
	margin-bottom: 10px;
}

.card-author,
.card-date {
	color: #666;
}

.card-description {
	font-size: 14px;
	color: #666;
	min-height: 60px; /* 确保描述区域有最小高度 */
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 3; /* 限制描述显示3行 */
	line-clamp: 3; /* Standard property for compatibility */
	-webkit-box-orient: vertical;
}

.pagination-wrapper {
	display: flex;
	justify-content: flex-end;
	margin-top: 20px;
}

.knowledge-drawer {
	--n-body-padding: 24px;
}

.drawer-content {
	padding: 0;
}

.drawer-header {
	padding: 16px 24px;
	border-bottom: 1px solid #f0f0f0;
}

.drawer-title {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
	color: #333;
}

.drawer-description {
	color: #666;
	margin: 16px 24px;
	font-size: 14px;
	line-height: 1.6;
}

.drawer-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	padding: 16px 24px;
	border-top: 1px solid #f0f0f0;
}

.knowledge-form {
	padding: 0 24px 24px;
}

.knowledge-form :deep(.n-form-item-label) {
	font-weight: 500;
	/* color: #333; */
}

.knowledge-form :deep(.n-form-item-feedback-wrapper) {
	min-height: 0;
	height: auto;
}

.knowledge-form :deep(.n-form-item-feedback-wrapper:empty) {
	display: none;
}

.knowledge-form :deep(.n-input:not(.n-input--textarea)),
.knowledge-form :deep(.n-input-number),
.knowledge-form :deep(.n-select) {
	width: 100%;
	border-radius: 6px;
	height: 40px;
}

.knowledge-form :deep(.n-input--textarea) {
	width: 100%;
	border-radius: 6px;
}

.knowledge-form :deep(.n-input--textarea .n-input__textarea-el) {
	resize: none;
}

.knowledge-form :deep(.n-input .n-input__input-el),
.knowledge-form :deep(.n-input-number-input),
.knowledge-form :deep(.n-base-selection) {
	font-size: 14px;
}

.knowledge-form :deep(.n-input-number) {
	width: 100%;
}

.form-section {
	padding: 16px;
	border: 1px solid #e1dfdd;
	border-radius: 8px;
	background: #fff;
	transition: all 0.2s ease;
}

.form-section:hover {
	border-color: #c8c6c4;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.section-title {
	font-size: 15px;
	font-weight: 500;
	color: #323130;
	margin-bottom: 12px;
	padding: 0;
	border: none;
}

.knowledge-form :deep(.n-form-item-label__text) {
	font-weight: 500;
}

.knowledge-form :deep(.n-form-item-feedback-wrapper) {
	min-height: 0;
	height: auto;
	margin-top: 0;
}

.knowledge-form :deep(.n-form-item-feedback-wrapper:empty) {
	display: none;
}

.knowledge-form :deep(.n-form-item-feedback) {
	font-size: 12px;
}

.label-with-tooltip {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.label-tooltip-icon {
	font-size: 14px;
	color: #8a8886;
	cursor: help;
	transition: color 0.15s ease;
	vertical-align: middle;
	flex-shrink: 0;
}

.label-tooltip-icon:hover {
	color: #605e5c;
}

.knowledge-form :deep(.n-form-item) {
	margin-bottom: 12px;
}

.knowledge-form :deep(.n-grid) {
	--n-gap: 20px 16px;
}

.knowledge-form :deep(.n-collapse) {
	border: none;
	border-radius: 0;
	background: transparent;
	margin-bottom: 0;
	margin-top: 0;
}

.knowledge-form :deep(.n-collapse-item) {
	border: 1px solid #e1dfdd;
	border-radius: 4px;
	margin-bottom: 0px;
	transition: all 0.2s ease;
	background: #fff;
}

.knowledge-form :deep(.n-collapse-item:hover) {
	border-color: #c8c6c4;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.knowledge-form :deep(.n-collapse-item__header) {
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

.knowledge-form :deep(.n-collapse-item__header:hover) {
	background-color: #faf9f8;
}

.knowledge-form :deep(.n-collapse-item__header-main) {
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

.knowledge-form :deep(.n-collapse-item__header-extra) {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.knowledge-form :deep(.n-collapse-item__header-arrow) {
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

.knowledge-form :deep(.n-collapse-item--active .n-collapse-item__header-arrow) {
	transform: rotate(90deg);
}

.knowledge-form :deep(.n-collapse-item__content-wrapper) {
	padding: 0 16px 16px 16px;
}

.knowledge-table {
	--n-td-color: transparent;
	--n-td-color-hover: rgba(0, 0, 0, 0.02);
	--n-td-text-color: #333;
	--n-border-color: #f0f0f0;
}

.knowledge-card-list {
	margin-top: 20px;
}

.knowledge-card {
	border-radius: 20px;
	overflow: hidden;
	transition: all 0.3s ease;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.knowledge-card:hover {
	transform: translateY(-5px); /* 更明显的悬停效果 */
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.card-description {
	font-size: 14px;
	color: #666;
	min-height: 60px; /* 确保描述区域有最小高度 */
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 3; /* 限制描述显示3行 */
	line-clamp: 3; /* Standard property for compatibility */
	-webkit-box-orient: vertical;
}

.pagination-wrapper {
	display: flex;
	justify-content: flex-end;
	margin-top: 20px;
}

.knowledge-drawer {
	--n-body-padding: 24px;
}

.drawer-content {
	padding: 0;
}

.drawer-header {
	padding: 16px 24px;
	border-bottom: 1px solid #f0f0f0;
}

.drawer-title {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
	color: #333;
}

.drawer-description {
	color: #666;
	margin: 16px 24px;
	font-size: 14px;
	line-height: 1.6;
}

.drawer-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	padding: 16px 24px;
	border-top: 1px solid #f0f0f0;
}

.knowledge-form {
	padding: 0 24px 24px;
}

.knowledge-form :deep(.n-form-item-label) {
	font-weight: 500;
	/* color: #333; */
}

.knowledge-form :deep(.n-form-item-feedback-wrapper) {
	min-height: 0;
	height: auto;
}

.knowledge-form :deep(.n-form-item-feedback-wrapper:empty) {
	display: none;
}

.knowledge-form :deep(.n-input:not(.n-input--textarea)),
.knowledge-form :deep(.n-input-number),
.knowledge-form :deep(.n-select) {
	width: 100%;
	border-radius: 6px;
	height: 40px;
}

.knowledge-form :deep(.n-input--textarea) {
	width: 100%;
	border-radius: 6px;
}

.knowledge-form :deep(.n-input--textarea .n-input__textarea-el) {
	resize: none;
}

.knowledge-form :deep(.n-input .n-input__input-el),
.knowledge-form :deep(.n-input-number-input),
.knowledge-form :deep(.n-base-selection) {
	font-size: 14px;
}

.knowledge-form :deep(.n-input-number) {
	width: 100%;
}

.cancel-button {
	padding: 10px 20px;
	border-radius: 6px;
	transition: all 0.3s ease;
	height: 40px;
	min-width: 100px;
	font-size: 14px;
}

.draw-button {
	padding: 10px 20px;
	font-weight: 500;
	border-radius: 6px;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
	transition: all 0.3s ease;
	height: 40px;
	min-width: 100px;
	font-size: 14px;
}

.draw-button:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* 新列表页样式 */
.knowledge-list-page {
	min-height: 100vh;
	background-color: var(--n-color-body);
	padding: 20px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

/* 工具栏样式 */
.toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 16px;
	background: var(--n-color-base);
	border-radius: 8px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	flex-wrap: wrap;
}

.toolbar-left {
	display: flex;
	align-items: center;
	gap: 12px;
}

.toolbar-filters {
	display: flex;
	align-items: center;
	gap: 12px;
	flex: 1;
	flex-wrap: wrap;
}

.toolbar-right {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
}

/* 活动筛选条样式 */
.active-filters-bar {
	padding: 12px 16px;
	background: var(--n-color-base);
	border-radius: 8px;
	border: 1px solid var(--n-border-color);
}

/* 主视图样式 */
.main-view {
	flex: 1;
	min-height: 400px;
	background: var(--n-color-base);
	border-radius: 8px;
	padding: 16px;
}

/* 卡片视图样式 */
.card-view {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	gap: 12px;
	width: 100%;
}

.card-view .knowledge-card {
	width: 100%;
	height: 100%;
}

.card-view :deep(.n-card) {
	padding: 12px;
}

.card-view :deep(.n-card-header) {
	padding: 8px 12px;
	margin-bottom: 8px;
}

.card-view :deep(.n-card__content) {
	padding: 0 12px;
}

.card-view :deep(.n-card__action) {
	padding: 8px 12px;
}

.knowledge-card {
	transition: all 0.3s ease;
}

.knowledge-card:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-description {
	font-size: 13px;
	color: var(--n-text-color-2);
	margin: 8px 0;
	line-height: 1.5;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	text-overflow: ellipsis;
}

.card-stats {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	font-size: 12px;
	color: var(--n-text-color-3);
	margin: 8px 0;
	padding: 8px;
	background: var(--n-color-base);
	border-radius: 4px;
}

.stat-item {
	display: flex;
	align-items: center;
	gap: 4px;
}

.stat-label {
	color: var(--n-text-color-3);
	font-weight: 500;
	font-size: 11px;
}

.stat-value {
	color: var(--n-text-color);
	font-weight: 600;
	font-size: 12px;
}

.card-tech-info {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin: 8px 0;
	padding: 8px;
	background: var(--n-color-base-hover);
	border-radius: 4px;
	border-left: 2px solid var(--n-primary-color);
}

.tech-item {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
	line-height: 1.4;
}

.tech-label {
	color: var(--n-text-color-3);
	font-weight: 500;
	min-width: 70px;
	flex-shrink: 0;
}

.tech-value {
	color: var(--n-text-color);
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex: 1;
}

.card-meta {
	display: flex;
	justify-content: space-between;
	gap: 8px;
	font-size: 11px;
	color: var(--n-text-color-3);
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid var(--n-border-color);
}

/* 名称单元格样式 */
.name-cell {
	display: flex;
	align-items: center;
	gap: 8px;
}

.name-text {
	font-weight: 500;
}

/* 分页样式 */
.pagination-wrapper {
	display: flex;
	justify-content: flex-end;
	padding: 16px;
	background: var(--n-color-base);
	border-radius: 8px;
}

/* 筛选表单样式 */
.filter-form {
	padding: 16px 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
	.toolbar {
		flex-direction: column;
		align-items: stretch;
	}

	.toolbar-center {
		max-width: 100%;
	}

	.toolbar-right {
		justify-content: space-between;
	}

	.card-view {
		grid-template-columns: 1fr;
	}
}

@media (min-width: 769px) and (max-width: 1024px) {
	.card-view {
		grid-template-columns: repeat(2, 1fr);
	}
}

@media (min-width: 1025px) {
	.card-view {
		grid-template-columns: repeat(4, 1fr);
	}
}

@media (min-width: 1440px) {
	.card-view {
		grid-template-columns: repeat(5, 1fr);
	}
}

/* 搜索高亮样式 */
.search-highlight {
	background: linear-gradient(120deg, rgba(255, 235, 59, 0.3) 0%, rgba(255, 235, 59, 0.5) 100%);
	color: inherit;
	padding: 2px 4px;
	border-radius: 3px;
	font-weight: 500;
	box-shadow: 0 1px 2px rgba(255, 235, 59, 0.2);
	transition: all 0.2s ease;
}

.search-highlight:hover {
	background: linear-gradient(120deg, rgba(255, 235, 59, 0.5) 0%, rgba(255, 235, 59, 0.7) 100%);
	box-shadow: 0 2px 4px rgba(255, 235, 59, 0.3);
}

/* 卡片标题样式 */
.card-header {
	display: flex;
	align-items: center;
	width: 100%;
}

.card-title {
	font-size: 16px;
	font-weight: 600;
	color: var(--n-text-color);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex: 1;
}
</style>

import request from "@/utils/request/req";

export interface KnowledgeReq {
	id?: number | string; // 知识库id（允许字符串以支持大整数）
	kid?: string; // 知识库ID
	uid?: number | string; // 用户id（允许字符串以支持大整数）
	kname: string; // 知识库名称
	description?: string; // 知识库描述
	share: number; // 是否公开（0-否 1-是）
	category?: string; // 知识库分类
	knowledgeSeparator?: string; // 知识分隔符
	questionSeparator?: string; // 提问分隔符
	overlapChar?: number; // 重叠字符数
	retrieveLimit: number; // 检索返回条数
	textBlockSize: number; // 文本块大小
	vectorModelName: string; // 向量库类型（weaviate/milvus）
	embeddingModelId?: number | string; // 向量模型ID（允许字符串以支持大整数）
	embeddingModelName?: string; // 向量模型名称
	systemPrompt?: string; // 系统提示词
	remark?: string; // 备注
}

export interface KnowledgeDelReq {
	kid: string; // 知识库id
}

export interface KnowledgeDetailDelReq {
	kid: string; // 附件id
	docId: string; // 文档id
}

export interface SimpleGenerate {
	model: string;
	randomness: number;
	stability_boost: number;
	voiceId: string;
	text: string;
}

export interface KnowledgeListQuery {
	// 搜索
	searchKeyword?: string;      // 搜索关键词（多字段OR搜索：kname + description）
	kname?: string;              // 名称搜索（like查询）
	description?: string;        // 描述搜索（like查询）
	
	// 筛选
	categories?: string[];       // 分类（多选）- 注意：后端字段名是 categories
	share?: 0 | 1;              // 是否公开
	ownershipType?: 'mine' | 'assigned' | 'all';  // 所有权类型筛选（mine-我创建的, assigned-分配给我的, all-全部）
	createBys?: string[];        // 创建人（多选）- 注意：后端字段名是 createBys
	createDepts?: number[];      // 创建部门（多选）- 注意：后端字段名是 createDepts
	itemCountMin?: number;       // 条目数最小值
	itemCountMax?: number;       // 条目数最大值
	fragmentCountMin?: number;   // 片段数最小值
	fragmentCountMax?: number;   // 片段数最大值
	dataSizeMin?: number;        // 存储大小最小值（单位：字节）
	dataSizeMax?: number;        // 存储大小最大值（单位：字节）
	createTimeStart?: string;    // 创建时间起始（ISO 8601）
	createTimeEnd?: string;      // 创建时间结束（ISO 8601）
	updateTimeStart?: string;    // 更新时间起始（ISO 8601）
	updateTimeEnd?: string;       // 更新时间结束（ISO 8601）
	
	// 排序
	orderBy?: 'create_time' | 'update_time' | 'item_count' | 'fragment_count' | 'data_size' | 'kname' | 'category';
	order?: 'asc' | 'desc';      // 排序方向（默认desc）
	
	// 分页
	pageNum?: number;               // 页码
	pageSize?: number;           // 页大小
}

/**
 * 获取知识库列表（不使用角色权限，仅用于管理员或特殊场景）
 * @deprecated 建议使用 getKnowledgeByRole 以支持角色权限控制
 */
export function getKnowledge(params?: KnowledgeListQuery) {
	return request({
		url: "/knowledge/list",
		method: "get",
		params: params || {},
	});
}

/**
 * 获取知识库列表（支持角色权限控制）
 * 该接口会根据当前登录用户的角色权限返回可见的知识库：
 * - 管理员（userId=1）：显示所有知识库
 * - 普通用户：显示自己创建的知识库 + 通过角色分配的知识库
 */
export function getKnowledgeByRole(params?: KnowledgeListQuery) {
	return request({
		url: "/knowledge/listByRole",
		method: "get",
		params: params || {},
	});
}

export function createKnowledgeReq(params: KnowledgeReq) {
	return request({
		url: "/knowledge/save",
		method: "post",
		data: params,
	});
}

export function updateKnowledgeReq(params: KnowledgeReq) {
	return request({
		url: "/knowledge/update",
		method: "put",
		data: params,
	});
}

export function delKnowledge(params: KnowledgeDelReq) {
	return request({
		url: "/knowledge/remove/" + params.kid,
		method: "post",
	});
}

export function delKnowledgeBatch(kids: string[]) {
	return request({
		url: "/knowledge/remove/batch",
		method: "post",
		data: kids,
	});
}

export function getKnowledgeDetail(kid: string) {
	return request({
		url: "/knowledge/detail/" + kid,
		method: "get",
	});
}

export function delKnowledgeDetail(params: KnowledgeDetailDelReq) {
	return request({
		url: "/knowledge/attach/remove/" + params.docId,
		method: "post",
	});
}

export function delKnowledgeDetailByProcessId(processId: string) {
	return request({
		url: "/knowledge/attach/remove-by-process/" + processId,
		method: "post",
	});
}

export function delKnowledgeDetailByKidAndName(kid: string, docName: string) {
	return request({
		url: "/knowledge/attach/remove-by-name",
		method: "post",
		params: { kid, docName },
	});
}

export function getfragmentList(docId: string) {
	return request({
		url: "/knowledge/fragment/list",
		method: "get",
		params: { docId },
	});
}

export interface KnowledgeFragmentListQuery {
	itemUuid: string;
	kid?: string;
	searchKeyword?: string;
	docIds?: string[];
	orderBy?: 'idx' | 'create_time' | 'content_length';
	order?: 'asc' | 'desc';
	includeIncomplete?: boolean;//是否包含未完成处理的片段（默认false，表示过滤掉未完成的片段）
	pageNum?: number;
	pageSize?: number;
}

export interface KnowledgeFragmentPageVo {
	code: number;
	msg: string;
	total: number;
	rows: any[];
	facetStats?: Record<string, number>;
}

/**
 * 查询知识条目下的片段列表（带分面统计）
 */
export function getFragmentListByItem(params: KnowledgeFragmentListQuery) {
	return request<KnowledgeFragmentPageVo>({
		url: "/knowledge/fragment/list-by-item",
		method: "post",
		data: {
			itemUuid: params.itemUuid,
			kid: params.kid,
			searchKeyword: params.searchKeyword,
			docIds: params.docIds,
			orderBy: params.orderBy,
			order: params.order,
			includeIncomplete: params.includeIncomplete,//默认false，会过滤掉未完成处理的片段
		},
		params: {
			pageNum: params.pageNum,
			pageSize: params.pageSize,
			orderByColumn: params.orderBy, //同时传递到PageQuery
			isAsc: params.order || 'asc',
		},
	});
}

export function refreshKnowledgeStatistics() {
	return request({
		url: "/knowledge/refresh-statistics",
		method: "post",
	});
}

export interface KnowledgeAttachListQuery {
	kid?: string;
	docId?: string;
	docName?: string;
	docType?: string;
	content?: string;
	createTimeStart?: string;
	createTimeEnd?: string;
	picStatusList?: number[];
	picAnysStatusList?: number[];
	vectorStatusList?: number[];
	createByList?: string[];
	itemCountMin?: number;
	itemCountMax?: number;
	pageNum?: number;
	pageSize?: number;
	orderBy?: string;
	order?: 'asc' | 'desc';
}

export function getItemCountDistribution(params: KnowledgeAttachListQuery) {
	return request({
		url: '/knowledge/attach/item-count-distribution',
		method: 'post',
		data: params,
	})
}

export function getAttachFacetStats(params: KnowledgeAttachListQuery) {
	return request({
		url: '/knowledge/attach/facet-stats',
		method: 'post',
		data: params,
	})
}

export function getKnowledgeAttachList(params: KnowledgeAttachListQuery) {
	return request({
		url: "/knowledge/attach/list",
		method: "get",
		params: params,
	});
}

export function getKnowledgeAttachInfo(id: number | string) {
	return request({
		url: "/knowledge/attach/info/" + id,
		method: "get",
	});
}

export function downloadKnowledgeAttach(id: number | string) {
	return request({
		url: "/knowledge/attach/download/" + id,
		method: "get",
		responseType: "blob",
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

export function reprocessKnowledgeAttach(docId: string) {
	return request({
		url: "/knowledge/attach/reprocess/" + docId,
		method: "post",
	});
}

export interface UploadAttachParams {
	kid: string;
	autoCreateItems?: boolean;
	autoClassify?: boolean;
}

export function uploadKnowledgeAttach(
	file: File,
	params: UploadAttachParams,
	onProgress?: (percent: number) => void
) {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('kid', params.kid);
	if (params.autoCreateItems !== undefined) {
		formData.append('autoCreateItems', String(params.autoCreateItems));
	}
	if (params.autoClassify !== undefined) {
		formData.append('autoClassify', String(params.autoClassify));
	}
	return request({
		url: "/knowledge/attach/upload",
		method: "post",
		data: formData,
		// 不要手动设置Content-Type，request拦截器会自动处理FormData
		onUploadProgress: (progressEvent: any) => {
			if (onProgress && progressEvent.total) {
				const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
				onProgress(percent);
			}
		},
	});
}

// ==================== 附件处理状态管理 API ====================
// 基于LLM与状态改革设计文档 v1.0

export interface KnowledgeAttachProcessVo {
	id: number;
	attachId: number;
	docId: string;
	currentStatus: string;
	statusData: string;
	progress: number;
	errorMessage?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface MatchingDecision {
	chunkIndex: number;
	fid: string;
	decision: 'keep' | 'change' | 'create_new';
	selectedItemUuid?: string;
}

export interface ItemModification {
	itemUuid: string;
	modifiedFields: Record<string, any>;
}

export interface FragmentBatchQuery {
	docId: string;
	idx: number;
}

/**
 * 获取处理状态
 */
export function getAttachProcessStatus(processId: string, skipLock: boolean = true) {
	return request<KnowledgeAttachProcessVo>({
		url: `/knowledge/attach/process/${processId}`,
		method: "get",
		params: {
			skipLock: skipLock,
		},
	});
}

/**
 * 批量获取处理状态
 */
export function getAttachProcessStatusBatch(processIds: string[]) {
	return request<KnowledgeAttachProcessVo[]>({
		url: "/knowledge/attach/process/batch",
		method: "post",
		data: processIds,
	});
}

/**
 * 确认匹配结果
 */
export function confirmMatching(processId: string, decisions: MatchingDecision[]) {
	return request({
		url: `/knowledge/attach/process/${processId}/confirm-matching`,
		method: "post",
		data: decisions,
	});
}

/**
 * 确认新条目
 */
export function confirmItems(processId: string, modifications: ItemModification[]) {
	return request({
		url: `/knowledge/attach/process/${processId}/confirm-items`,
		method: "post",
		data: modifications,
	});
}

/**
 * 保存草稿
 */
export function saveDraft(processId: string, partialData: Record<string, any>) {
	return request({
		url: `/knowledge/attach/process/${processId}/save-draft`,
		method: "post",
		data: partialData,
	});
}

/**
 * 回退状态
 */
export function rollbackProcess(processId: string, targetStatus: string) {
	return request({
		url: `/knowledge/attach/process/${processId}/rollback`,
		method: "post",
		params: { targetStatus },
	});
}

/**
 * 取消处理任务
 */
export function cancelAttachProcess(processId: string) {
	return request({
		url: `/knowledge/attach/process/${processId}/cancel`,
		method: "post",
	});
}

/**
 * 批量查询片段内容
 */
export function getFragmentBatch(queries: FragmentBatchQuery[]) {
	return request({
		url: "/knowledge/fragment/batch",
		method: "post",
		data: queries,
	});
}

export interface LlmTestRequest {
	content: string;
	kid?: string;
	modelName?: string;
}

export function testLlmExtract(data: LlmTestRequest) {
	console.log('[API] testLlmExtract 请求参数:', JSON.stringify(data, null, 2))
	console.log('[API] testLlmExtract 请求URL: /knowledge/llm/test-extract')
	return request({
		url: "/knowledge/llm/test-extract",
		method: "post",
		data,
	}).then(res => {
		console.log('[API] testLlmExtract 响应:', res)
		return res
	}).catch(err => {
		console.error('[API] testLlmExtract 错误:', err)
		throw err
	})
}

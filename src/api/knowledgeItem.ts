import request from "@/utils/request/req";

export interface KnowledgeItemReq {
	itemUuid?: string;
	kid?: string;
	title: string;
	summary?: string;
	problemDescription?: string;
	fixSolution?: string;
	exampleCode?: string;
	vulnerabilityType?: string;
	vulnerabilityTypes?: string[];
	language?: string;
	severity?: string;
	cvssVector?: string;
	cvssScore?: number;
	status?: 'draft' | 'review' | 'published' | 'archived';
	sourceType?: 'manual' | 'import' | 'feedback';
	tags?: string[];
}

export interface KnowledgeItemListQuery {
	kid?: string;
	searchKeyword?: string;
	vulnerabilityTypeKeyword?: string;
	title?: string;
	summary?: string;
	problemDescription?: string;
	vulnerabilityTypes?: string[];
	languages?: string[];
	severities?: string[];
	statuses?: string[];
	tags?: string[];
	cvssScoreMin?: number;
	cvssScoreMax?: number;
	cvssAttackVector?: string[];
	cvssAttackComplexity?: string[];
	cvssPrivilegesRequired?: string[];
	cvssUserInteraction?: string[];
	cvssScope?: string[];
	cvssConfidentiality?: string[];
	cvssIntegrity?: string[];
	cvssAvailability?: string[];
	createBys?: string[];
	createTimeStart?: string;
	createTimeEnd?: string;
	updateTimeStart?: string;
	updateTimeEnd?: string;
	orderBy?: 'create_time' | 'update_time' | 'severity' | 'cvss_score' | 'title';
	order?: 'asc' | 'desc';
	pageNum?: number;
	pageSize?: number;
}

export function getKnowledgeItemList(params?: KnowledgeItemListQuery) {
	const { pageNum, pageSize, orderBy, order, ...filterParams } = params || {};
	return request({
		url: "/knowledge/item/list",
		method: "post",
		params: { 
			pageNum, 
			pageSize, 
			orderByColumn: orderBy,
			isAsc: order === 'asc' ? 'asc' : 'desc'
		},
		data: filterParams,
	});
}

export function getKnowledgeItemDetail(itemUuid: string) {
	return request({
		url: `/knowledge/item/uuid/${itemUuid}`,
		method: "get",
	});
}

export function createKnowledgeItem(params: KnowledgeItemReq) {
	return request({
		url: "/knowledge/item/add",
		method: "post",
		data: params,
	});
}

export function updateKnowledgeItem(itemUuid: string, params: KnowledgeItemReq) {
	return request({
		url: `/knowledge/item/edit/${itemUuid}`,
		method: "post",
		data: params,
	});
}

export function deleteKnowledgeItem(itemUuid: string) {
	return request({
		url: `/knowledge/item/uuid/${itemUuid}`,
		method: "delete",
	});
}

export function deleteKnowledgeItemBatch(itemUuids: string[]) {
	return request({
		url: "/knowledge/item/delete/batch",
		method: "post",
		data: itemUuids,
	});
}

export interface BatchUpdateRequest {
	itemUuids: string[];
	field: string;
	value: any;
}

export interface BatchUpdateResult {
	successCount: number;
	failedCount: number;
	failures: Array<{
		itemUuid: string;
		reason: string;
		errorCode: string;
	}>;
}

export function batchUpdateKnowledgeItems(params: BatchUpdateRequest) {
	return request<BatchUpdateResult>({
		url: "/knowledge/item/batch-update",
		method: "post",
		data: params,
	});
}

export interface ExportPreviewRequest {
	format: 'pdf' | 'excel';
	itemUuids?: string[];
	exportRange: 'selected' | 'currentPage' | 'all';
	selectedFields: string[];
	expandedFields: Record<string, string[]>;
	fieldOrder: string[];
	pdfOptions?: {
		includeHeaderFooter: boolean;
		includeTOC: boolean;
		codeHighlight: boolean;
	};
	excelOptions?: {
		includeFilter: boolean;
		freezeHeader: boolean;
		conditionalFormatting: boolean;
	};
	filters?: KnowledgeItemListQuery;
	pageNum?: number;
	pageSize?: number;
}

export interface ExportPreviewResponse {
	sampleData: any[];
	totalCount: number;
	selectedFields: Array<{
		key: string;
		label: string;
		type: 'base' | 'expanded' | 'dictConverted' | 'parsed';
		parentField?: string;
	}>;
	estimatedFileSize: number;
	estimatedTime: number;
	previewHtml?: string;
}

export function exportPreview(params: ExportPreviewRequest) {
	return request<ExportPreviewResponse>({
		url: "/knowledge/item/export-preview",
		method: "post",
		data: params,
	});
}

export interface ExportRequest extends ExportPreviewRequest {
	fileName?: string;
}

export function exportKnowledgeItems(params: ExportRequest) {
	return request({
		url: "/knowledge/item/export",
		method: "post",
		data: params,
		responseType: "blob",
	});
}

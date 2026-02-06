import request from "@/utils/request/req";

export interface KnowledgeTagReq {
	tagName: string;
	tagType?: 'system' | 'user';
	tagCategory?: string;
	description?: string;
}

export interface KnowledgeTagQuery {
	tagName?: string;
	tagType?: 'system' | 'user';
	tagCategory?: string;
	pageNum?: number;
	pageSize?: number;
}

export function getKnowledgeTagList(params?: KnowledgeTagQuery) {
	return request({
		url: "/knowledge/tag/list",
		method: "get",
		params: params || {},
	});
}

export function createKnowledgeTag(params: KnowledgeTagReq) {
	return request({
		url: "/knowledge/tag",
		method: "post",
		data: params,
	});
}

export function getKnowledgeTagsByItem(itemUuid: string) {
	return request({
		url: `/knowledge/tag/item/${itemUuid}`,
		method: "get",
	});
}

export function updateKnowledgeTag(id: number, params: KnowledgeTagReq) {
	return request({
		url: `/knowledge/tag`,
		method: "put",
		data: {
			id,
			...params,
		},
	});
}

export function deleteKnowledgeTag(ids: number[]) {
	return request({
		url: `/knowledge/tag/${ids.join(',')}`,
		method: "delete",
	});
}

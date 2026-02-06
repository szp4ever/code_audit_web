import request from "@/utils/request/req";

export interface CweReference {
	id?: number;
	cweId: string;
	nameEn?: string;
	nameZh?: string;
	weaknessAbstraction?: string;
	status?: string;
	descriptionEn?: string;
	descriptionZh?: string;
	rawJson?: string;
	rawJsonZh?: string;
	tenantId?: number;
	createTime?: string;
	updateTime?: string;
	createBy?: number;
	createDept?: number;
	updateBy?: number;
}

export interface CweReferenceListQuery {
	cweId?: string;
	nameEn?: string;
	nameZh?: string;
	weaknessAbstraction?: string;
	status?: string;
	pageNum?: number;
	pageSize?: number;
}

export interface CweCluster {
	id?: number;
	clusterId?: number;
	clusterMethod?: string;
	clusterNameZh?: string;
	clusterNameEn?: string;
	categoryCode?: string;
	description?: string;
	keywords?: string;
	cweCount?: number;
}

export interface CweClusterMapping {
	cweId: string;
	clusterId: number;
	clusterMethod: string;
}

export interface CweHierarchy {
	cweId: string;
	parentCweId: string;
	relationshipType?: string;
}

export function getCweReferenceList(params?: CweReferenceListQuery) {
	return request({
		url: "/knowledge/cwe/list",
		method: "get",
		params: params || {},
	});
}

export function getCweReferenceListAll(params?: Omit<CweReferenceListQuery, 'pageNum' | 'pageSize'>) {
	return request({
		url: "/knowledge/cwe/list/all",
		method: "get",
		params: params || {},
	});
}

export function getCweReferenceDetail(id: number) {
	return request({
		url: `/knowledge/cwe/${id}`,
		method: "get",
	});
}

export function getCweReferenceByCweId(cweId: string) {
	return request({
		url: `/knowledge/cwe/cweId/${cweId}`,
		method: "get",
	});
}

export function getCweClusterListAll(clusterMethod?: string) {
	return request({
		url: "/knowledge/cwe/cluster/list/all",
		method: "get",
		params: clusterMethod ? { clusterMethod } : {},
	});
}

export function getCweClusterMappingsByCweId(cweId: string) {
	return request({
		url: `/knowledge/cwe/cluster/mapping/cwe/${cweId}`,
		method: "get",
	});
}

export function getCweClusterMappingsByCluster(clusterId: number, clusterMethod: string) {
	return request({
		url: `/knowledge/cwe/cluster/mapping/cluster/${clusterId}/${clusterMethod}`,
		method: "get",
	});
}

export function getCweHierarchyByCweId(cweId: string) {
	return request({
		url: `/knowledge/cwe/classification/hierarchy/cwe/${cweId}`,
		method: "get",
	});
}

export function getCweHierarchyByParent(parentCweId: string) {
	return request({
		url: `/knowledge/cwe/classification/hierarchy/parent/${parentCweId}`,
		method: "get",
	});
}

/**
 * 文档管理 API（v2）
 * 后端：DocumentController — /knowledge/document
 */
import request from '@/utils/request/req'

// ========== Types ==========

/** 附件查询参数（对齐 KnowledgeAttachBo） */
export interface DocumentQuery {
  kid?: string
  docName?: string
  docType?: string
  status?: string
  pageNum?: number
  pageSize?: number
}

/** 附件 VO（对齐 KnowledgeAttachVo） */
export interface DocumentVo {
  id: number
  docId: string
  kid: string
  docName: string
  docType: string
  docSize: number
  status: string
  processId: string
  ossId: number | string
  createBy: string
  createTime: string
  updateTime: string
}

/** 上传参数（对齐 KnowledgeInfoUploadBo） */
export interface UploadParams {
  kid: string
  file: File
  chunkSize?: number
  overlapSize?: number
  separator?: string
  embeddingModelName?: string
}

/** 处理进度 VO（对齐 KnowledgeAttachProcessVo） */
export interface ProcessStatusVo {
  id: number | string
  processId: string
  attachId: number
  kid: string
  status: string
  progress: number
  statusData: string
  errorMessage: string
  startTime: string
  endTime: string
  createTime: string
  updateTime: string
}

/** 附件分面统计 VO（对齐 AttachFacetStatsVo） */
export interface AttachFacetStatsVo {
  totalCount: number
  totalSize: number
  typeDistribution: Record<string, number>
  statusDistribution: Record<string, number>
  dateDistribution: Record<string, number>
}

// ========== API ==========

/** 文档列表（分页） */
export function listDocuments(params: DocumentQuery) {
  return request({
    url: '/knowledge/document/attach/list',
    method: 'get',
    params,
  })
}

/** 文档详情 */
export function getDocument(id: number | string) {
  return request({
    url: `/knowledge/document/attach/info/${id}`,
    method: 'get',
  })
}

/** 上传文档（FormData） */
export function uploadDocument(data: FormData) {
  return request({
    url: '/knowledge/document/upload',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000, // 10 分钟超时，大文件上传
  })
}

/** 分块上传 — 上传单个分块 */
export function uploadChunk(data: FormData) {
  return request({
    url: '/knowledge/document/chunk-upload',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 分块上传 — 合并分块 */
export function mergeChunks(data: { kid: string; fileName: string; totalChunks: number; uploadId: string }) {
  return request({
    url: '/knowledge/document/merge-chunks',
    method: 'post',
    data,
  })
}

/** 删除文档（逗号分隔 ID） */
export function deleteDocuments(ids: string) {
  return request({
    url: `/knowledge/document/attach/${ids}`,
    method: 'delete',
  })
}

/** 下载文档原文 */
export function downloadDocument(id: number | string) {
  return request({
    url: `/knowledge/document/attach/download/${id}`,
    method: 'get',
    responseType: 'blob',
  })
}

/** 重新处理文档 */
export function reprocessDocument(docId: string) {
  return request({
    url: `/knowledge/document/attach/reprocess/${docId}`,
    method: 'post',
  })
}

/** 文档分面统计 */
export function getDocumentFacetStats(data: DocumentQuery) {
  return request({
    url: '/knowledge/document/attach/facet-stats',
    method: 'post',
    data,
  })
}

/** 条目数量分布（按文档） */
export function getItemCountDistribution(kid: string) {
  return request({
    url: '/knowledge/document/attach/item-count-distribution',
    method: 'get',
    params: { kid },
  })
}

// ========== 处理进度 ==========

/** 获取单个处理进度 */
export function getProcessStatus(processId: string) {
  return request({
    url: `/knowledge/document/process/${processId}`,
    method: 'get',
  })
}

/** 批量获取处理进度 */
export function getProcessStatusBatch(processIds: string[]) {
  return request({
    url: '/knowledge/document/process/batch',
    method: 'post',
    data: processIds,
  })
}

/** 确认匹配结果（兼容旧流程） */
export function confirmMatching(processId: string, data: any) {
  return request({
    url: `/knowledge/document/process/${processId}/confirm-matching`,
    method: 'post',
    data,
  })
}

/** 确认条目创建（兼容旧流程） */
export function confirmItems(processId: string, data: any) {
  return request({
    url: `/knowledge/document/process/${processId}/confirm-items`,
    method: 'post',
    data,
  })
}

/** 保存草稿 */
export function saveDraft(processId: string, data: any) {
  return request({
    url: `/knowledge/document/process/${processId}/save-draft`,
    method: 'post',
    data,
  })
}

/** 回滚到上一步 */
export function rollbackProcess(processId: string) {
  return request({
    url: `/knowledge/document/process/${processId}/rollback`,
    method: 'post',
  })
}

/** 取消处理 */
export function cancelProcess(processId: string) {
  return request({
    url: `/knowledge/document/process/${processId}/cancel`,
    method: 'post',
  })
}

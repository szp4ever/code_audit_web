/**
 * 知识条目管理 API（v2）
 * 后端：ItemController — /knowledge/item
 *
 * 包含：条目 CRUD、批量操作、导出、版本历史、标签、收藏、反馈、检测结果、片段关联（N:M）
 */
import request from '@/utils/request/req'

// ========== 条目 Types ==========

/** 条目查询参数（对齐 KnowledgeItemBo） */
export interface ItemQuery {
  kid?: string
  title?: string
  summary?: string
  vulnerabilityType?: string
  severity?: string
  status?: string
  language?: string
  cweId?: string
  tagIds?: number[]
  searchKeyword?: string
  /** 高级筛选 */
  cvssScoreMin?: number
  cvssScoreMax?: number
  createTimeStart?: string
  createTimeEnd?: string
  updateTimeStart?: string
  updateTimeEnd?: string
  createBy?: string
  /** 排序 */
  orderByColumn?: string
  isAsc?: string
  /** 分页 */
  pageNum?: number
  pageSize?: number
}

/** 条目表单（对齐 KnowledgeItemBo 写入字段） */
export interface ItemForm {
  id?: number
  itemUuid?: string
  kid: string
  title: string
  summary?: string
  vulnerabilityType?: string
  language?: string
  severity?: string
  cvssScore?: number
  cvssVector?: string
  problemDescription?: string
  fixSuggestion?: string
  exampleCode?: string
  referenceLinks?: string
  status?: string
  remark?: string
  /** 标签 ID 列表（前端维护，保存时同步） */
  tagIds?: number[]
  /** CWE ID */
  cweId?: string
}

/** 条目 VO（对齐 KnowledgeItemVo） */
export interface ItemVo {
  id: number
  itemUuid: string
  kid: string
  title: string
  summary: string
  vulnerabilityType: string
  language: string
  severity: string
  cvssScore: number
  cvssVector: string
  problemDescription: string
  fixSuggestion: string
  exampleCode: string
  referenceLinks: string
  status: string
  remark: string
  createBy: number
  createTime: string
  updateBy: number
  updateTime: string
  /** 关联的标签列表 */
  tags?: TagVo[]
  /** 关联的 CWE 信息 */
  cweReference?: any
  /** 关联的片段数量 */
  fragmentCount?: number
}

/** 条目分页 VO（对齐 KnowledgeItemPageVo，含额外统计字段） */
export interface ItemPageVo extends ItemVo {
  knowledgeName?: string
  createByName?: string
  updateByName?: string
}

/** 分面统计 VO（对齐 FacetStatsVo） */
export interface FacetStatsVo {
  totalCount: number
  severityDistribution: Record<string, number>
  vulnerabilityTypeDistribution: Record<string, number>
  statusDistribution: Record<string, number>
  languageDistribution: Record<string, number>
  tagDistribution: Record<string, number>
  cweDistribution: Record<string, number>
  createTimeDistribution: Record<string, number>
}

/** 批量更新请求（对齐 BatchUpdateRequestBo） */
export interface BatchUpdateRequest {
  itemUuids: string[]
  updateFields: Record<string, any>
}

/** 批量更新结果 VO */
export interface BatchUpdateResultVo {
  successCount: number
  failureCount: number
  failures: Array<{ itemUuid: string; reason: string }>
}

/** 批量删除结果 VO */
export interface BatchDeleteResultVo {
  successCount: number
  failureCount: number
  failures: Array<{ itemUuid: string; reason: string }>
}

// ========== 导出 Types ==========

/** 导出预览请求（对齐 ExportPreviewRequestBo） */
export interface ExportPreviewRequest {
  kid?: string
  selectedFields: string[]
  expandedFields?: Record<string, string[]>
  fieldFormats?: Record<string, string>
  format: 'excel' | 'pdf'
  pdfOptions?: PdfOptions
  excelOptions?: ExcelOptions
  /** 筛选条件（复用 ItemQuery） */
  filterConditions?: ItemQuery
}

export interface PdfOptions {
  useReportFormat?: boolean
  includeHeaderFooter?: boolean
  includeTOC?: boolean
  codeHighlight?: boolean
  pageSize?: string
  orientation?: string
}

export interface ExcelOptions {
  includeHeader?: boolean
  autoColumnWidth?: boolean
  freezeHeader?: boolean
  conditionalFormatting?: boolean
}

/** 导出预览 VO（对齐 ExportPreviewVo） */
export interface ExportPreviewVo {
  totalCount: number
  estimatedFileSize: string
  estimatedTime: string
  previewHtml: string
  fieldInfos: FieldInfoVo[]
}

/** 字段信息 VO */
export interface FieldInfoVo {
  key: string
  label: string
  type: string
  width?: number
  sortable?: boolean
  exportable?: boolean
}

/** 导出请求（对齐 ExportRequestBo） */
export interface ExportRequest extends ExportPreviewRequest {
  fileName?: string
  maxRows?: number
}

// ========== 标签 Types ==========

export interface TagQuery {
  kid?: string
  tagName?: string
  pageNum?: number
  pageSize?: number
}

export interface TagForm {
  id?: number
  kid?: string
  tagName: string
  tagColor?: string
  description?: string
}

export interface TagVo {
  id: number
  kid: string
  tagName: string
  tagColor: string
  description: string
  itemCount: number
  createTime: string
  updateTime: string
}

// ========== 收藏 Types ==========

export interface FavoriteQuery {
  kid?: string
  pageNum?: number
  pageSize?: number
}

export interface FavoriteVo {
  id: number
  itemUuid: string
  userId: number
  createTime: string
  item?: ItemVo
}

// ========== 反馈 Types ==========

export interface FeedbackForm {
  id?: number
  itemUuid: string
  content: string
  feedbackType?: string
  status?: string
}

export interface FeedbackVo {
  id: number
  itemUuid: string
  content: string
  feedbackType: string
  status: string
  createBy: string
  createTime: string
  updateTime: string
}

// ========== 检测结果 Types ==========

export interface DetectionResultQuery {
  kid?: string
  itemUuid?: string
  taskId?: string
  pageNum?: number
  pageSize?: number
}

export interface DetectionResultForm {
  id?: number
  kid?: string
  itemUuid?: string
  taskId?: string
  resultType?: string
  resultData?: string
  status?: string
}

export interface DetectionResultVo {
  id: number
  kid: string
  itemUuid: string
  taskId: string
  resultType: string
  resultData: string
  status: string
  createTime: string
  updateTime: string
}

// ========== 版本历史 Types ==========

export interface ItemHistoryVo {
  id: number
  itemUuid: string
  version: number
  changeDescription: string
  snapshotData: string
  createBy: string
  createTime: string
}

// ========== 片段关联 Types ==========

export interface ItemFragmentAssociation {
  id: number
  itemUuid: string
  fragmentId: number
  relevanceScore: number | null
  createdBy: 'manual' | 'ai'
  createTime: string
}

// ========== 条目 CRUD API ==========

/** 条目列表（分页） */
export function listItems(params: ItemQuery) {
  return request({
    url: '/knowledge/item/list',
    method: 'post',
    data: params,
  })
}

/** 条目详情（按 ID） */
export function getItemById(id: number) {
  return request({
    url: `/knowledge/item/${id}`,
    method: 'get',
  })
}

/** 条目详情（按 UUID） */
export function getItemByUuid(uuid: string) {
  return request({
    url: `/knowledge/item/uuid/${uuid}`,
    method: 'get',
  })
}

/** 创建条目 */
export function createItem(data: ItemForm) {
  return request({
    url: '/knowledge/item',
    method: 'post',
    data,
  })
}

/** 更新条目 */
export function updateItem(data: ItemForm) {
  return request({
    url: '/knowledge/item',
    method: 'put',
    data,
  })
}

/** 删除条目（按 ID，逗号分隔） */
export function deleteItems(ids: string) {
  return request({
    url: `/knowledge/item/${ids}`,
    method: 'delete',
  })
}

/** 删除条目（按 UUID） */
export function deleteItemByUuid(uuid: string) {
  return request({
    url: `/knowledge/item/uuid/${uuid}`,
    method: 'delete',
  })
}

/** 批量更新条目 */
export function batchUpdateItems(data: BatchUpdateRequest) {
  return request({
    url: '/knowledge/item/batchUpdate',
    method: 'post',
    data,
  })
}

/** 批量删除条目 */
export function batchDeleteItems(uuids: string[]) {
  return request({
    url: '/knowledge/item/batchDelete',
    method: 'post',
    data: uuids,
  })
}

/** 分面统计 */
export function getItemFacetStats(params: ItemQuery) {
  return request({
    url: '/knowledge/item/facetStats',
    method: 'post',
    data: params,
  })
}

// ========== 导出 API ==========

/** 导出预览 */
export function exportPreview(data: ExportPreviewRequest) {
  return request({
    url: '/knowledge/item/export/preview',
    method: 'post',
    data,
  })
}

/** 导出（Excel/PDF），返回 Blob */
export function exportItems(data: ExportRequest) {
  return request({
    url: '/knowledge/item/export',
    method: 'post',
    data,
    responseType: 'blob',
  })
}

// ========== 版本历史 API ==========

/** 版本历史列表 */
export function listItemHistory(itemUuid: string) {
  return request({
    url: `/knowledge/item/${itemUuid}/history`,
    method: 'get',
  })
}

/** 版本详情 */
export function getItemHistoryDetail(itemUuid: string, historyId: number) {
  return request({
    url: `/knowledge/item/${itemUuid}/history/${historyId}`,
    method: 'get',
  })
}

/** 创建版本快照 */
export function createItemSnapshot(itemUuid: string) {
  return request({
    url: `/knowledge/item/${itemUuid}/history`,
    method: 'post',
  })
}

/** 版本 diff 对比 */
export function diffItemVersions(itemUuid: string, fromVersion: number, toVersion: number) {
  return request({
    url: `/knowledge/item/${itemUuid}/history/diff`,
    method: 'get',
    params: { from: fromVersion, to: toVersion },
  })
}

/** 恢复到指定版本（非破坏性） */
export function restoreItemVersion(itemUuid: string, version: number, reason: string) {
  return request({
    url: `/knowledge/item/${itemUuid}/history/${version}/restore`,
    method: 'post',
    data: { reason },
  })
}

/** 获取漏洞类型分布统计 */
export function getVulnerabilityDistribution(kid: string, topN?: number) {
  return request({
    url: '/knowledge/item/vulnerability-distribution',
    method: 'get',
    params: { kid, topN: topN ?? 10 },
  })
}

// ========== 标签 API ==========

/** 标签列表 */
export function listTags(params: TagQuery) {
  return request({
    url: '/knowledge/item/tag/list',
    method: 'get',
    params,
  })
}

/** 标签详情 */
export function getTag(id: number) {
  return request({
    url: `/knowledge/item/tag/${id}`,
    method: 'get',
  })
}

/** 创建标签 */
export function createTag(data: TagForm) {
  return request({
    url: '/knowledge/item/tag',
    method: 'post',
    data,
  })
}

/** 更新标签 */
export function updateTag(data: TagForm) {
  return request({
    url: '/knowledge/item/tag',
    method: 'put',
    data,
  })
}

/** 删除标签（逗号分隔 ID） */
export function deleteTags(ids: string) {
  return request({
    url: `/knowledge/item/tag/${ids}`,
    method: 'delete',
  })
}

/** 为条目添加标签 */
export function addTagToItem(itemUuid: string, tagId: number) {
  return request({
    url: `/knowledge/item/${itemUuid}/tag/${tagId}`,
    method: 'post',
  })
}

/** 从条目移除标签 */
export function removeTagFromItem(itemUuid: string, tagId: number) {
  return request({
    url: `/knowledge/item/${itemUuid}/tag/${tagId}`,
    method: 'delete',
  })
}

// ========== 收藏 API ==========

/** 收藏列表 */
export function listFavorites(params: FavoriteQuery) {
  return request({
    url: '/knowledge/item/favorite/list',
    method: 'get',
    params,
  })
}

/** 我的收藏 */
export function listMyFavorites(params: FavoriteQuery) {
  return request({
    url: '/knowledge/item/favorite/my',
    method: 'get',
    params,
  })
}

/** 检查是否已收藏 */
export function checkFavorite(itemUuid: string) {
  return request({
    url: `/knowledge/item/favorite/check/${itemUuid}`,
    method: 'get',
  })
}

/** 添加收藏 */
export function addFavorite(data: { itemUuid: string }) {
  return request({
    url: '/knowledge/item/favorite',
    method: 'post',
    data,
  })
}

/** 取消收藏（逗号分隔 ID） */
export function removeFavorites(ids: string) {
  return request({
    url: `/knowledge/item/favorite/${ids}`,
    method: 'delete',
  })
}

// ========== 反馈 API ==========

/** 反馈列表 */
export function listFeedback(params: { itemUuid?: string; status?: string; pageNum?: number; pageSize?: number }) {
  return request({
    url: '/knowledge/item/feedback/list',
    method: 'get',
    params,
  })
}

/** 按状态查询反馈 */
export function listFeedbackByStatus(status: string, params: { pageNum?: number; pageSize?: number }) {
  return request({
    url: `/knowledge/item/feedback/status/${status}`,
    method: 'get',
    params,
  })
}

/** 反馈详情 */
export function getFeedback(id: number) {
  return request({
    url: `/knowledge/item/feedback/${id}`,
    method: 'get',
  })
}

/** 反馈详情（按 UUID） */
export function getFeedbackByUuid(uuid: string) {
  return request({
    url: `/knowledge/item/feedback/uuid/${uuid}`,
    method: 'get',
  })
}

/** 创建反馈 */
export function createFeedback(data: FeedbackForm) {
  return request({
    url: '/knowledge/item/feedback',
    method: 'post',
    data,
  })
}

/** 更新反馈 */
export function updateFeedback(data: FeedbackForm) {
  return request({
    url: '/knowledge/item/feedback',
    method: 'put',
    data,
  })
}

/** 审批通过反馈 */
export function approveFeedback(id: number) {
  return request({
    url: `/knowledge/item/feedback/${id}/approve`,
    method: 'post',
  })
}

/** 驳回反馈 */
export function rejectFeedback(id: number, data: { reason: string }) {
  return request({
    url: `/knowledge/item/feedback/${id}/reject`,
    method: 'post',
    data,
  })
}

/** 删除反馈（逗号分隔 ID） */
export function deleteFeedback(ids: string) {
  return request({
    url: `/knowledge/item/feedback/${ids}`,
    method: 'delete',
  })
}

// ========== 检测结果 API ==========

/** 检测结果列表 */
export function listDetectionResults(params: DetectionResultQuery) {
  return request({
    url: '/knowledge/item/detection/list',
    method: 'get',
    params,
  })
}

/** 检测结果详情 */
export function getDetectionResult(id: number) {
  return request({
    url: `/knowledge/item/detection/${id}`,
    method: 'get',
  })
}

/** 检测结果详情（按 UUID） */
export function getDetectionResultByUuid(uuid: string) {
  return request({
    url: `/knowledge/item/detection/uuid/${uuid}`,
    method: 'get',
  })
}

/** 按任务 ID 查询检测结果 */
export function getDetectionResultsByTaskId(taskId: string) {
  return request({
    url: `/knowledge/item/detection/task/${taskId}`,
    method: 'get',
  })
}

/** 创建检测结果 */
export function createDetectionResult(data: DetectionResultForm) {
  return request({
    url: '/knowledge/item/detection',
    method: 'post',
    data,
  })
}

/** 更新检测结果 */
export function updateDetectionResult(data: DetectionResultForm) {
  return request({
    url: '/knowledge/item/detection',
    method: 'put',
    data,
  })
}

/** 删除检测结果（逗号分隔 ID） */
export function deleteDetectionResults(ids: string) {
  return request({
    url: `/knowledge/item/detection/${ids}`,
    method: 'delete',
  })
}

// ========== 片段关联 API（N:M） ==========

/** 条目关联的片段列表 */
export function listItemFragments(itemUuid: string) {
  return request({
    url: `/knowledge/item/${itemUuid}/fragments`,
    method: 'get',
  })
}

/** 关联片段到条目 */
export function associateFragment(itemUuid: string, fragmentId: number) {
  return request({
    url: `/knowledge/item/${itemUuid}/fragments/${fragmentId}`,
    method: 'post',
  })
}

/** 取消片段关联 */
export function disassociateFragment(itemUuid: string, fragmentId: number) {
  return request({
    url: `/knowledge/item/${itemUuid}/fragments/${fragmentId}`,
    method: 'delete',
  })
}

/**
 * 知识库管理 API（v2）
 * 后端：KnowledgeBaseController — /knowledge/base
 */
import request from '@/utils/request/req'

// ========== Types ==========

/** 知识库查询/筛选参数（对齐 KnowledgeInfoBo） */
export interface KnowledgeBaseQuery {
  kid?: string
  kname?: string
  description?: string
  category?: string
  share?: 0 | 1
  searchKeyword?: string
  ownershipType?: 'mine' | 'assigned' | 'all'
  categories?: string[]
  createBys?: string[]
  createDepts?: number[]
  itemCountMin?: number
  itemCountMax?: number
  fragmentCountMin?: number
  fragmentCountMax?: number
  dataSizeMin?: number
  dataSizeMax?: number
  createTimeStart?: string
  createTimeEnd?: string
  updateTimeStart?: string
  updateTimeEnd?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}

/** 知识库表单（对齐 KnowledgeInfoBo 写入字段） */
export interface KnowledgeBaseForm {
  id?: number | string
  kid?: string
  kname: string
  description?: string
  category?: string
  share?: number
  knowledgeSeparator?: string
  questionSeparator?: string
  overlapChar?: number
  retrieveLimit?: number
  textBlockSize?: number
  vectorModelName?: string
  embeddingModelId?: number | string
  embeddingModelName?: string
  systemPrompt?: string
  remark?: string
}

/** 知识库 VO（对齐 KnowledgeInfoVo） */
export interface KnowledgeBaseVo {
  id: number | string
  kid: string
  uid: number | string
  kname: string
  share: number
  description: string
  category: string
  dataSize: number
  itemCount: number
  fragmentCount: number
  attachCount: number
  knowledgeSeparator: string
  questionSeparator: string
  overlapChar: number
  retrieveLimit: number
  textBlockSize: number
  vectorModelName: string
  embeddingModelId: number | string
  embeddingModelName: string
  systemPrompt: string
  remark: string
  createTime: string
  updateTime: string
  createBy: number
  createDept: number
  updateBy: number
  canEdit: boolean
}

/** 分页参数 */
export interface PageQuery {
  pageNum?: number
  pageSize?: number
}

/** 按日计数点 */
export interface DailyCountPoint {
  date: string
  count: number
}

/** 存储监控统计（只含真实可计算数据，无虚构容量上限） */
export interface KnowledgeStorageStatsVo {
  kid: string
  // 存储用量
  usedBytes: number
  // 资产数量
  itemCount: number
  fragmentCount: number
  attachCount: number
  // 增长趋势
  growth7dBytes: number
  avgDailyGrowthBytes: number
  // 更新活跃度
  todayUpdates: number
  weekUpdates: number
  monthUpdates: number
  avgDailyUpdates: number
  // 时间序列
  storageGrowth: DailyCountPoint[]
  updateFrequency: DailyCountPoint[]
  updateFrequency90d: DailyCountPoint[]
}

// ========== API ==========

/** 知识库列表（分页） */
export function listKnowledgeBases(query: KnowledgeBaseQuery, page: PageQuery = {}) {
  return request({
    url: '/knowledge/base/list',
    method: 'get',
    params: { ...query, ...page },
  })
}

/** 按角色获取知识库列表（分页） */
export function listKnowledgeBasesByRole(query: KnowledgeBaseQuery, page: PageQuery = {}) {
  return request({
    url: '/knowledge/base/listByRole',
    method: 'get',
    params: { ...query, ...page },
  })
}

/** 知识库详情 */
export function getKnowledgeBase(kid: string) {
  return request({
    url: `/knowledge/base/${kid}`,
    method: 'get',
  })
}

/** 创建知识库 */
export function createKnowledgeBase(data: KnowledgeBaseForm) {
  return request({
    url: '/knowledge/base',
    method: 'post',
    data,
  })
}

/** 更新知识库 */
export function updateKnowledgeBase(data: KnowledgeBaseForm) {
  return request({
    url: '/knowledge/base',
    method: 'put',
    data,
  })
}

/** 删除知识库（逗号分隔的 kid 列表） */
export function deleteKnowledgeBases(kids: string) {
  return request({
    url: `/knowledge/base/${kids}`,
    method: 'delete',
  })
}

/** 刷新知识库统计信息 */
export function refreshStatistics() {
  return request({
    url: '/knowledge/base/refresh-statistics',
    method: 'post',
  })
}

/** 删除单个知识库（便捷别名） */
export function deleteKnowledgeBase(kid: string) {
  return deleteKnowledgeBases(kid)
}

/** 获取知识库存储监控统计 */
export function getKnowledgeStorageStats(kid: string) {
  return request({
    url: `/knowledge/base/${kid}/storage-stats`,
    method: 'get',
  })
}

// ========== 类型别名（兼容页面中的不同命名） ==========

export type KnowledgeVo = KnowledgeBaseVo
export type KnowledgeListQuery = KnowledgeBaseQuery
export type KnowledgeReq = KnowledgeBaseForm

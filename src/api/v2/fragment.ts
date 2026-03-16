/**
 * 片段管理 API（v2）
 * 后端：FragmentController — /knowledge/fragment
 */
import request from '@/utils/request/req'

// ========== Types ==========

/** 片段查询参数（对齐 KnowledgeFragmentBo） */
export interface FragmentQuery {
  kid?: string
  docId?: string
  content?: string
  keyword?: string
  hasItem?: boolean
  pageNum?: number
  pageSize?: number
}

/** 片段 VO（对齐 KnowledgeFragmentVo） */
export interface FragmentVo {
  id: number
  kid: string
  docId: string
  content: string
  wordCount: number
  status: string
  createTime: string
  updateTime: string
  /** 关联的条目数量（后端可能不返回，前端需要额外查询） */
  itemCount?: number
}

/** 片段分页 VO（对齐 KnowledgeFragmentPageVo，含额外统计字段） */
export interface FragmentPageVo extends FragmentVo {
  docName?: string
  knowledgeName?: string
}

/** 片段-条目关联记录（对齐 KnowledgeItemFragment） */
export interface ItemFragmentAssociation {
  id: number
  itemUuid: string
  fragmentId: number
  relevanceScore: number | null
  createdBy: 'manual' | 'ai'
  createTime: string
}

/** 批量查询参数（对齐 FragmentBatchQueryBo） */
export interface FragmentBatchQuery {
  fragmentId: number
  kid?: string
}

// ========== API ==========

/** 片段列表（分页） */
export function listFragments(params: FragmentQuery) {
  return request({
    url: '/knowledge/fragment/list',
    method: 'get',
    params,
  })
}

/** 按条目查询关联片段 */
export function listFragmentsByItem(itemUuid: string, kid: string, params?: { pageNum?: number; pageSize?: number }) {
  return request({
    url: '/knowledge/fragment/list-by-item',
    method: 'post',
    data: {
      kid,
      itemUuid,
      pageNum: params?.pageNum ?? 1,
      pageSize: params?.pageSize ?? 1000
    },
  })
}

/** 片段详情 */
export function getFragment(id: number) {
  return request({
    url: `/knowledge/fragment/${id}`,
    method: 'get',
  })
}

/** 删除片段（逗号分隔 ID） */
export function deleteFragments(ids: string) {
  return request({
    url: `/knowledge/fragment/${ids}`,
    method: 'delete',
  })
}

/** 批量获取片段 */
export function getFragmentBatch(queries: FragmentBatchQuery[]) {
  return request({
    url: '/knowledge/fragment/batch',
    method: 'post',
    data: queries,
  })
}

/** 搜索片段（向量搜索） */
export function searchFragments(params: { kid: string; query: string; limit?: number }) {
  return request({
    url: '/knowledge/fragment/search',
    method: 'get',
    params,
  })
}

/** 片段关联的条目列表 */
export function listFragmentItems(fragmentId: number) {
  return request({
    url: `/knowledge/fragment/${fragmentId}/items`,
    method: 'get',
  })
}

/** 关联片段到条目（支持字符串ID，避免JavaScript精度丢失） */
export function associateFragmentToItem(fragmentId: string | number, itemUuid: string) {
  return request({
    url: `/knowledge/fragment/${fragmentId}/associate/${itemUuid}`,
    method: 'post',
  })
}

/** 取消片段与条目的关联（支持字符串ID，避免JavaScript精度丢失） */
export function disassociateFragmentFromItem(fragmentId: string | number, itemUuid: string) {
  return request({
    url: `/knowledge/fragment/${fragmentId}/associate/${itemUuid}`,
    method: 'delete',
  })
}

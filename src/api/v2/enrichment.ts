/**
 * AI 增强 API（v2）
 * 后端：EnrichmentController — /knowledge/ai
 *
 * 四大功能：LLM 结构化提取、条目建议生成、智能片段匹配、重复条目检测
 */
import request from '@/utils/request/req'

// ========== LLM 提取 ==========

/** LLM 提取请求 */
export interface LlmExtractRequest {
  content: string
  kid: string
  modelName?: string
}

/** LLM 提取结果（对齐 ExtractedItemData） */
export interface LlmExtractResult {
  title: string
  summary: string
  vulnerabilityType: string
  severity: string
  cvssScore: number
  cvssVector: string
  problemDescription: string
  fixSuggestion: string
  exampleCode: string
  referenceLinks: string
  suggestedTags: string[]
  cweId: string
  language: string
  confidence: number
}

/** LLM 结构化提取 */
export function extractByLlm(data: LlmExtractRequest) {
  return request({
    url: '/knowledge/ai/extract',
    method: 'post',
    data,
  })
}

// ========== 条目建议 ==========

/** 条目建议请求 */
export interface ItemSuggestionRequest {
  fragmentIds: number[]
  kid: string
}

/** 条目建议 VO */
export interface ItemSuggestionVo {
  suggestionId: string
  fragmentId: number
  fragmentContent: string
  kid: string
  suggestedTitle: string
  suggestedSummary: string
  suggestedVulnerabilityType: string
  suggestedSeverity: string
  suggestedProblemDescription: string
  suggestedFixSuggestion: string
  suggestedExampleCode: string
  suggestedTags: string[]
  confidence: number
  status: 'pending' | 'accepted' | 'rejected'
}

/** 从片段生成条目建议 */
export function generateSuggestions(data: ItemSuggestionRequest) {
  return request({
    url: '/knowledge/ai/suggest-items',
    method: 'post',
    data,
  })
}

/** 接受建议（创建正式条目） */
export function acceptSuggestion(suggestionId: string) {
  return request({
    url: `/knowledge/ai/suggest-items/${suggestionId}/accept`,
    method: 'post',
  })
}

/** 拒绝建议 */
export function rejectSuggestion(suggestionId: string, reason?: string) {
  return request({
    url: `/knowledge/ai/suggest-items/${suggestionId}/reject`,
    method: 'post',
    data: { reason },
  })
}

/** 查询待审核建议列表 */
export function listPendingSuggestions(kid: string) {
  return request({
    url: '/knowledge/ai/suggest-items/pending',
    method: 'get',
    params: { kid },
  })
}

// ========== 智能匹配 ==========

/** 匹配请求 */
export interface FragmentMatchRequest {
  itemUuid: string
  kid?: string
  limit?: number
}

/** 匹配结果 VO */
export interface MatchResultVo {
  itemUuid: string
  itemTitle: string
  fragmentId: number
  fragmentPreview: string
  vectorSimilarity: number
  llmConfidence: number
  matchReason: string
}

/** 为条目推荐关联片段 */
export function matchFragments(data: FragmentMatchRequest) {
  return request({
    url: '/knowledge/ai/match-fragments',
    method: 'post',
    data,
  })
}

/** 批量匹配（知识库级别） */
export function batchMatchFragments(kid: string, limit?: number) {
  return request({
    url: '/knowledge/ai/match-fragments/batch',
    method: 'post',
    data: { kid, limit },
  })
}

// ========== 去重检测 ==========

/** 去重请求 */
export interface DuplicateDetectionRequest {
  kid: string
  threshold?: number
}

/** 重复对 VO */
export interface DuplicatePairVo {
  itemUuidA: string
  titleA: string
  itemUuidB: string
  titleB: string
  titleSimilarity: number
  contentSimilarity: number
  sameCwe: boolean
  sameVulnType: boolean
  overallScore: number
  reason: string
}

/** 检测重复条目 */
export function detectDuplicates(data: DuplicateDetectionRequest) {
  return request({
    url: '/knowledge/ai/detect-duplicates',
    method: 'post',
    data,
  })
}

/** 合并重复条目 */
export function mergeDuplicates(keepUuid: string, archiveUuid: string) {
  return request({
    url: '/knowledge/ai/detect-duplicates/merge',
    method: 'post',
    data: { keepUuid, archiveUuid },
  })
}

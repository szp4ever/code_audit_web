/**
 * 搜索关键词高亮工具（公共）
 *
 * 支持：多关键词、大小写不敏感、重叠区间合并、长文本 snippet 截取
 * 用于：表格列 render（VNode）、v-html、卡片等
 */

/** 提取关键词数组（按空格分割，去空） */
export function extractKeywords(keywordStr: string): string[] {
  return (keywordStr || '').trim().split(/\s+/).filter(Boolean)
}

/** 获取高亮区间（合并重叠） */
export function getHighlightRanges(text: string, keywords: string[]): Array<{ start: number; end: number }> {
  if (!text || !keywords?.length) return []
  const lowerText = text.toLowerCase()
  const matches: Array<{ start: number; end: number }> = []
  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase().trim()
    if (!lowerKw) continue
    let idx = 0
    while ((idx = lowerText.indexOf(lowerKw, idx)) !== -1) {
      const overlaps = matches.some(m => idx < m.end && idx + lowerKw.length > m.start)
      if (!overlaps) matches.push({ start: idx, end: idx + lowerKw.length })
      idx += 1
    }
  }
  matches.sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []
  for (const m of matches) {
    if (merged.length && m.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, m.end)
    } else merged.push({ ...m })
  }
  return merged
}

/** 转义 HTML */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 高亮为 HTML 字符串（供 v-html 使用）
 * 注意：传入的 text 需已转义，或为可信内容；内部会对非 mark 部分转义
 */
export function highlightTextHtml(text: string, keywords: string[]): string {
  if (!text || !keywords?.length) return escapeHtml(text)
  const ranges = getHighlightRanges(text, keywords)
  if (!ranges.length) return escapeHtml(text)
  const result: string[] = []
  let last = 0
  for (const m of ranges) {
    if (m.start > last) result.push(escapeHtml(text.slice(last, m.start)))
    result.push(`<mark class="search-hl">${escapeHtml(text.slice(m.start, m.end))}</mark>`)
    last = m.end
  }
  if (last < text.length) result.push(escapeHtml(text.slice(last)))
  return result.join('')
}

/**
 * 高亮为 VNode 数组（供表格列 render 使用）
 * @param h - Vue 的 h 函数
 */
export function highlightTextForRender(
  text: string,
  keywords: string[],
  h: (type: string, props?: object, children?: any) => any
): (string | ReturnType<typeof h>)[] {
  if (!text || !keywords?.length) return [text || '—']
  const ranges = getHighlightRanges(text, keywords)
  if (!ranges.length) return [text]
  const result: (string | ReturnType<typeof h>)[] = []
  let last = 0
  for (const m of ranges) {
    if (m.start > last) result.push(text.slice(last, m.start))
    result.push(h('mark', { class: 'search-hl' }, text.slice(m.start, m.end)))
    last = m.end
  }
  if (last < text.length) result.push(text.slice(last))
  return result.length ? result : [text]
}

/**
 * 长文本时以关键词为中心截取 snippet（query-biased 展示）
 */
export function extractSnippetAroundKeyword(
  text: string,
  keywords: string[],
  maxLen = 80
): string {
  if (!text || !keywords?.length || text.length <= maxLen) return text
  const lowerText = text.toLowerCase()
  let bestStart = 0
  let bestLen = 0
  for (const kw of keywords) {
    const idx = lowerText.indexOf(kw.toLowerCase().trim())
    if (idx === -1) continue
    const half = Math.floor(maxLen / 2)
    const start = Math.max(0, idx - half)
    const end = Math.min(text.length, start + maxLen)
    const len = end - start
    if (len > bestLen) {
      bestStart = start
      bestLen = len
    }
  }
  if (bestLen === 0) return text.slice(0, maxLen) + '…'
  let s = bestStart
  let e = bestStart + bestLen
  if (e < text.length) e = Math.min(e, text.length)
  if (s > 0) s = Math.max(0, s)
  return (s > 0 ? '…' : '') + text.slice(s, e) + (e < text.length ? '…' : '')
}

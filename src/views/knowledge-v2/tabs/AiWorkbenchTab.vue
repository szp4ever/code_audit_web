<script setup lang="ts">
import { ref, inject, onMounted, computed, type Ref } from 'vue'
import {
  useMessage, useDialog, NTooltip, NButton, NSpin, NEmpty,
  NCheckbox, NCheckboxGroup, NTag, NProgress, NSelect,
  NRadio, NRadioGroup, NRadioButton, NInput, NInputNumber,
  NSpace, NCard, NEllipsis
} from 'naive-ui'
import { useRouter } from 'vue-router'
import request from '@/utils/request/req'

/* ──────────────────── Types ──────────────────── */
interface Fragment { uuid: string; content: string; title?: string }
interface ItemOption { uuid: string; title: string }
interface Suggestion {
  id: string; suggestedTitle: string; suggestedSummary: string
  suggestedSeverity: string; suggestedVulnerabilityType: string
  confidence: number; status?: 'accepted' | 'rejected'
}
interface MatchResult {
  itemUuid: string; itemTitle: string; fragmentId: string
  fragmentContent: string; vectorSimilarity: number; matchReason: string
  dismissed?: boolean; linked?: boolean
}
interface DuplicatePair {
  uuidA: string; titleA: string; uuidB: string; titleB: string
  overallScore: number; reason: string; sameCwe: boolean; sameVulnType: boolean
  merged?: boolean
}
interface ExtractResult {
  title: string; summary: string; vulnerabilityType: string; severity: string
  cvssScore: number; language: string; problemDescription: string
  fixSuggestion: string; exampleCode: string; suggestedTags: string[]
}

/* ──────────────────── Context ──────────────────── */
const kidRef = inject<Ref<string>>('kid')!
const kid = computed(() => kidRef.value)
const message = useMessage()
const dialog = useDialog()
const router = useRouter()

/* ──────────────────── Card 1: SuggestionTool ──────────────────── */
const sugFragments = ref<Fragment[]>([])
const sugSelectedIds = ref<string[]>([])
const sugLoading = ref(false)
const sugFragLoading = ref(false)
const sugResults = ref<Suggestion[]>([])
const sugStep = ref<1 | 2 | 3>(1)
const sugAcceptingId = ref<string | null>(null)
const sugRejectingId = ref<string | null>(null)

async function loadUnassociatedFragments() {
  sugFragLoading.value = true
  try {
    const res = await request({ url: '/knowledge/fragment/list', method: 'get', params: { kid: kid.value, hasItem: false, pageSize: 100 } })
    sugFragments.value = res.data?.records ?? res.data?.list ?? res.data ?? []
  } catch (e: any) { message.error('加载片段失败: ' + (e.message || e)) }
  finally { sugFragLoading.value = false }
}

async function generateSuggestions() {
  if (!sugSelectedIds.value.length) { message.error('请至少选择一个片段'); return }
  sugStep.value = 2; sugLoading.value = true; sugResults.value = []
  try {
    const res = await request({ url: '/knowledge/ai/suggest-items', method: 'post', data: { fragmentIds: sugSelectedIds.value, kid: kid.value } })
    sugResults.value = (res.data ?? []).map((s: any) => ({ ...s, status: undefined }))
    sugStep.value = 3
  } catch (e: any) { message.error('生成建议失败: ' + (e.message || e)); sugStep.value = 1 }
  finally { sugLoading.value = false }
}

async function handleSuggestionAction(item: Suggestion, action: 'accept' | 'reject') {
  const id = item.id
  if (action === 'accept') sugAcceptingId.value = id
  else sugRejectingId.value = id
  try {
    await request({ url: `/knowledge/ai/suggest-items/${id}/${action}`, method: 'post' })
    item.status = action === 'accept' ? 'accepted' : 'rejected'
    message.success(action === 'accept' ? '已接受建议' : '已拒绝建议')
  } catch (e: any) { message.error('操作失败: ' + (e.message || e)) }
  finally {
    if (action === 'accept' && sugAcceptingId.value === id) sugAcceptingId.value = null
    if (action === 'reject' && sugRejectingId.value === id) sugRejectingId.value = null
  }
}

function resetSuggestion() { sugStep.value = 1; sugResults.value = []; sugSelectedIds.value = [] }

function severityColor(s: string) {
  const m: Record<string, string> = { critical: '#D13438', high: '#CA5010', medium: '#FFB900', low: '#107C10', info: '#0078D4' }
  return m[s?.toLowerCase()] || '#605E5C'
}
// 严重程度中文映射
const severityLabelMap: Record<string, string> = {
  'Critical': '严重', 'critical': '严重',
  'High': '高危', 'high': '高危',
  'Medium': '中危', 'medium': '中危',
  'Low': '低危', 'low': '低危',
  'None': '无风险', 'none': '无风险', 'info': '信息',
}
/* ──────────────────── Card 2: MatchingTool ──────────────────── */
const matchItems = ref<ItemOption[]>([])
const matchItemsLoading = ref(false)
const matchSelectedItem = ref<string | null>(null)
const matchLoading = ref(false)
const matchResults = ref<MatchResult[]>([])
const matchStep = ref<1 | 2 | 3>(1)
const linkingKey = ref<string | null>(null)
const dismissingKey = ref<string | null>(null)

async function loadItems() {
  matchItemsLoading.value = true
  try {
    const res = await request({ url: '/knowledge/item/list', method: 'post', data: { kid: kid.value, pageSize: 50 } })
    const list = res.data?.records ?? res.data?.list ?? res.data ?? []
    matchItems.value = list.map((i: any) => ({ uuid: i.uuid, title: i.title }))
  } catch (e: any) { message.error('加载条目失败: ' + (e.message || e)) }
  finally { matchItemsLoading.value = false }
}

const matchItemOptions = computed(() => matchItems.value.map(i => ({ label: i.title, value: i.uuid })))

async function startMatching(batchAll = false) {
  if (!batchAll && !matchSelectedItem.value) { message.error('请选择一个条目'); return }
  matchStep.value = 2; matchLoading.value = true; matchResults.value = []
  try {
    const data: any = { kid: kid.value, limit: 10 }
    if (!batchAll) data.itemUuid = matchSelectedItem.value
    const res = await request({ url: '/knowledge/ai/match-fragments', method: 'post', data })
    matchResults.value = (res.data ?? []).map((m: any) => ({ ...m, dismissed: false, linked: false }))
    matchStep.value = 3
  } catch (e: any) { message.error('匹配失败: ' + (e.message || e)); matchStep.value = 1 }
  finally { matchLoading.value = false }
}

async function confirmLink(m: MatchResult) {
  const key = m.itemUuid + '_' + m.fragmentId
  linkingKey.value = key
  try {
    await request({ url: `/knowledge/item/${m.itemUuid}/fragments/${m.fragmentId}`, method: 'post' })
    m.linked = true; message.success('关联成功')
  } catch (e: any) { message.error('关联失败: ' + (e.message || e)) }
  finally { if (linkingKey.value === key) linkingKey.value = null }
}

async function dismissMatch(m: MatchResult) {
  const key = m.itemUuid + '_' + m.fragmentId
  dismissingKey.value = key
  await new Promise(r => setTimeout(r, 200)) // 模拟操作
  m.dismissed = true
  dismissingKey.value = null
}
function resetMatching() { matchStep.value = 1; matchResults.value = []; matchSelectedItem.value = null }
/* ──────────────────── Card 3: DuplicateTool ──────────────────── */
const dupThreshold = ref(0.8)
const dupLoading = ref(false)
const dupResults = ref<DuplicatePair[]>([])
const dupStep = ref<1 | 2 | 3>(1)

async function detectDuplicates() {
  dupStep.value = 2; dupLoading.value = true; dupResults.value = []
  try {
    const res = await request({ url: '/knowledge/ai/detect-duplicates', method: 'post', data: { kid: kid.value, threshold: dupThreshold.value } })
    dupResults.value = (res.data ?? []).map((d: any) => ({ ...d, merged: false }))
    dupStep.value = 3
  } catch (e: any) { message.error('检测失败: ' + (e.message || e)); dupStep.value = 1 }
  finally { dupLoading.value = false }
}

function scoreColor(score: number) {
  if (score > 0.9) return '#D13438'
  if (score > 0.8) return '#CA5010'
  return '#FFB900'
}

function openMergeDialog(pair: DuplicatePair) {
  let swapped = false
  dialog.warning({
    title: '确认合并',
    content: () => {
      const keep = swapped ? pair.titleB : pair.titleA
      const archive = swapped ? pair.titleA : pair.titleB
      return `保留「${keep}」，归档「${archive}」？`
    },
    positiveText: '确认合并',
    negativeText: '取消',
    onPositiveClick: async () => {
      const keepUuid = swapped ? pair.uuidB : pair.uuidA
      const archiveUuid = swapped ? pair.uuidA : pair.uuidB
      try {
        await request({ url: '/knowledge/ai/detect-duplicates/merge', method: 'post', data: { keepUuid, archiveUuid } })
        pair.merged = true; message.success('合并成功')
      } catch (e: any) { message.error('合并失败: ' + (e.message || e)) }
    }
  })
}

function resetDuplicate() { dupStep.value = 1; dupResults.value = [] }
/* ──────────────────── Card 4: ExtractTool ──────────────────── */
const extContent = ref('')
const extLoading = ref(false)
const extResult = ref<ExtractResult | null>(null)
const extStep = ref<1 | 2 | 3>(1)
const extExpanded = ref<Record<string, boolean>>({})

async function extractContent() {
  if (!extContent.value.trim()) { message.error('请输入待提取的内容'); return }
  extStep.value = 2; extLoading.value = true; extResult.value = null
  try {
    const res = await request({ url: '/knowledge/ai/extract', method: 'post', data: { content: extContent.value, kid: kid.value } })
    extResult.value = res.data ?? null
    extStep.value = 3
  } catch (e: any) { message.error('提取失败: ' + (e.message || e)); extStep.value = 1 }
  finally { extLoading.value = false }
}

function createItemFromExtract() {
  if (!extResult.value) return
  const payload = JSON.stringify(extResult.value)
  sessionStorage.setItem('ai_extract_prefill', payload)
  router.push({ path: `/knowledge-v2/${kid.value}/items/new`, query: { prefill: '1' } })
}

function toggleExpand(key: string) {
  const sel = window.getSelection?.()
  if (sel?.type === 'Range' && sel.toString().length > 0) return
  extExpanded.value[key] = !extExpanded.value[key]
}
function resetExtract() { extStep.value = 1; extResult.value = null; extContent.value = '' }

function truncate(text: string, len: number) {
  return text && text.length > len ? text.slice(0, len) + '...' : text || ''
}

/* ──────────────────── Lifecycle ──────────────────── */
onMounted(() => {
  loadUnassociatedFragments()
  loadItems()
})
</script>

<template>
  <div class="ai-workbench">
    <div class="wb-grid">

      <!-- ═══════ Card 1: SuggestionTool ═══════ -->
      <div class="wb-card">
        <div class="wb-card-header">
          <SvgIcon icon="mdi:lightbulb-on" style="font-size: 20px; color: #0078D4" />
          <div class="wb-card-title-group">
            <span class="wb-card-title">从片段生成条目建议</span>
            <span class="wb-card-desc">选择未关联片段，AI 自动生成条目建议</span>
          </div>
          <n-button v-if="sugStep === 3" quaternary size="tiny" @click="resetSuggestion">重置</n-button>
        </div>
        <div class="wb-card-body">
          <!-- Step 1: Fragment selection -->
          <template v-if="sugStep === 1">
            <n-spin :show="sugFragLoading" description="加载片段中...">
              <div v-if="sugFragments.length === 0 && !sugFragLoading" class="wb-empty">
                <n-empty description="暂无未关联片段" />
              </div>
              <div v-else class="wb-checkbox-list">
                <n-checkbox-group v-model:value="sugSelectedIds">
                  <div v-for="f in sugFragments" :key="f.uuid" class="wb-checkbox-item">
                    <n-checkbox :value="f.uuid">
                      <NTooltip trigger="hover" :width="400" :disabled="(f.content || f.title || '').length <= 100">
                        <template #trigger>
                          <span class="wb-frag-preview">{{ truncate(f.content || f.title || '', 100) }}</span>
                        </template>
                        {{ f.content || f.title || '' }}
                      </NTooltip>
                    </n-checkbox>
                  </div>
                </n-checkbox-group>
              </div>
            </n-spin>
            <div class="wb-actions" v-if="sugFragments.length > 0">
              <n-button type="primary" @click="generateSuggestions" :disabled="sugSelectedIds.length === 0">
                生成建议 ({{ sugSelectedIds.length }})
              </n-button>
            </div>
          </template>
          <!-- Step 2: Loading -->
          <template v-if="sugStep === 2">
            <div class="wb-loading-center">
              <n-spin size="large" />
              <span class="wb-loading-text">AI 正在分析片段内容...</span>
            </div>
          </template>
          <!-- Step 3: Results -->
          <template v-if="sugStep === 3">
            <div v-if="sugResults.length === 0" class="wb-empty"><n-empty description="未生成任何建议" /></div>
            <div v-else class="wb-suggestion-list">
              <div v-for="s in sugResults" :key="s.id" class="wb-suggestion-card" :class="{ 'is-accepted': s.status === 'accepted', 'is-rejected': s.status === 'rejected' }">
                <div class="wb-sug-header">
                  <span class="wb-sug-title">{{ s.suggestedTitle }}</span>
                  <n-tag :color="{ color: severityColor(s.suggestedSeverity) + '20', textColor: severityColor(s.suggestedSeverity), borderColor: severityColor(s.suggestedSeverity) }" size="small" round>{{ severityLabelMap[s.suggestedSeverity] || s.suggestedSeverity }}</n-tag>
                </div>
                <p class="wb-sug-summary">
                  <NTooltip trigger="hover" :width="450" :disabled="!s.suggestedSummary || s.suggestedSummary.length <= 120">
                    <template #trigger>
                      <span>{{ truncate(s.suggestedSummary, 120) }}</span>
                    </template>
                    {{ s.suggestedSummary }}
                  </NTooltip>
                </p>
                <div class="wb-sug-meta">
                  <span class="wb-sug-type">{{ s.suggestedVulnerabilityType }}</span>
                  <div class="wb-sug-confidence">
                    <span>置信度</span>
                    <n-progress type="line" :percentage="Math.round(s.confidence * 100)" :height="6" :show-indicator="false" :color="s.confidence > 0.7 ? '#107C10' : '#FFB900'" />
                    <span>{{ Math.round(s.confidence * 100) }}%</span>
                  </div>
                </div>
                <div class="wb-sug-actions" v-if="!s.status">
                  <n-button type="primary" size="small" :loading="sugAcceptingId === s.id" @click="handleSuggestionAction(s, 'accept')">接受</n-button>
                  <n-button size="small" :loading="sugRejectingId === s.id" @click="handleSuggestionAction(s, 'reject')">拒绝</n-button>
                </div>
                <div v-else class="wb-sug-status">
                  <SvgIcon :icon="s.status === 'accepted' ? 'mdi:check-circle' : 'mdi:close-circle'" :style="{ fontSize: '18px', color: s.status === 'accepted' ? '#107C10' : '#D13438' }" />
                  <span>{{ s.status === 'accepted' ? '已接受' : '已拒绝' }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ═══════ Card 2: MatchingTool ═══════ -->
      <div class="wb-card">
        <div class="wb-card-header">
          <SvgIcon icon="mdi:link-variant" style="font-size: 20px; color: #0078D4" />
          <div class="wb-card-title-group">
            <span class="wb-card-title">智能匹配</span>
            <span class="wb-card-desc">为已有条目推荐相关的未关联片段</span>
          </div>
          <n-button v-if="matchStep === 3" quaternary size="tiny" @click="resetMatching">重置</n-button>
        </div>
        <div class="wb-card-body">
          <!-- Step 1 -->
          <template v-if="matchStep === 1">
            <div class="wb-match-controls">
              <n-select v-model:value="matchSelectedItem" :options="matchItemOptions" placeholder="选择条目..." filterable clearable :loading="matchItemsLoading" />
              <div class="wb-match-btns">
                <n-button type="primary" @click="startMatching(false)" :disabled="!matchSelectedItem">开始匹配</n-button>
                <n-button @click="startMatching(true)" :disabled="matchItems.length === 0">批量匹配</n-button>
              </div>
            </div>
            <div v-if="matchItems.length === 0 && !matchItemsLoading" class="wb-empty"><n-empty description="暂无条目" /></div>
          </template>
          <!-- Step 2 -->
          <template v-if="matchStep === 2">
            <div class="wb-loading-center">
              <n-spin size="large" />
              <span class="wb-loading-text">AI 正在匹配片段...</span>
            </div>
          </template>
          <!-- Step 3 -->
          <template v-if="matchStep === 3">
            <div v-if="matchResults.length === 0" class="wb-empty"><n-empty description="未找到匹配结果" /></div>
            <div v-else class="wb-match-list">
              <div v-for="m in matchResults" :key="m.itemUuid + m.fragmentId" class="wb-match-item" :class="{ 'is-linked': m.linked, 'is-dismissed': m.dismissed }">
                <div class="wb-match-pair">
                  <span class="wb-match-item-title">{{ m.itemTitle }}</span>
                  <span class="wb-match-arrow">↔</span>
                  <NTooltip trigger="hover" :width="400" :disabled="!m.fragmentContent || m.fragmentContent.length <= 80">
                    <template #trigger>
                      <span class="wb-match-frag-preview">{{ truncate(m.fragmentContent, 80) }}</span>
                    </template>
                    {{ m.fragmentContent }}
                  </NTooltip>
                </div>
                <div class="wb-match-score">
                  <n-progress type="line" :percentage="Math.round(m.vectorSimilarity * 100)" :height="6" :show-indicator="false" color="#0078D4" />
                  <span>{{ Math.round(m.vectorSimilarity * 100) }}%</span>
                </div>
                <p class="wb-match-reason">{{ m.matchReason }}</p>
                <div class="wb-match-actions" v-if="!m.linked && !m.dismissed">
                  <n-button type="primary" size="small" :loading="linkingKey === m.itemUuid + '_' + m.fragmentId" @click="confirmLink(m)">确认关联</n-button>
                  <n-button size="small" :loading="dismissingKey === m.itemUuid + '_' + m.fragmentId" @click="dismissMatch(m)">忽略</n-button>
                </div>
                <div v-else class="wb-match-status">
                  <SvgIcon :icon="m.linked ? 'mdi:check-circle' : 'mdi:close-circle-outline'" :style="{ fontSize: '16px', color: m.linked ? '#107C10' : '#A19F9D' }" />
                  <span>{{ m.linked ? '已关联' : '已忽略' }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ═══════ Card 3: DuplicateTool ═══════ -->
      <div class="wb-card">
        <div class="wb-card-header">
          <SvgIcon icon="mdi:content-duplicate" style="font-size: 20px; color: #0078D4" />
          <div class="wb-card-title-group">
            <span class="wb-card-title">去重检测</span>
            <span class="wb-card-desc">检测知识库中相似度过高的重复条目</span>
          </div>
          <n-button v-if="dupStep === 3" quaternary size="tiny" @click="resetDuplicate">重置</n-button>
        </div>
        <div class="wb-card-body">
          <!-- Step 1 -->
          <template v-if="dupStep === 1">
            <div class="wb-dup-controls">
              <div class="wb-slider-row">
                <span class="wb-slider-label">相似度阈值</span>
                <n-slider v-model:value="dupThreshold" :min="0.5" :max="1" :step="0.05" :tooltip="true" style="flex:1" />
                <n-tag size="small" type="info">{{ dupThreshold.toFixed(2) }}</n-tag>
              </div>
              <n-button type="primary" @click="detectDuplicates" block>开始检测</n-button>
            </div>
          </template>
          <!-- Step 2 -->
          <template v-if="dupStep === 2">
            <div class="wb-loading-center">
              <n-spin size="large" />
              <span class="wb-loading-text">AI 正在检测重复条目...</span>
            </div>
          </template>
          <!-- Step 3 -->
          <template v-if="dupStep === 3">
            <div v-if="dupResults.length === 0" class="wb-empty"><n-empty description="未检测到重复条目" /></div>
            <div v-else class="wb-dup-list">
              <div v-for="(pair, idx) in dupResults" :key="idx" class="wb-dup-pair" :class="{ 'is-merged': pair.merged }">
                <div class="wb-dup-titles">
                  <span class="wb-dup-title-a">{{ pair.titleA }}</span>
                  <span class="wb-dup-vs">VS</span>
                  <span class="wb-dup-title-b">{{ pair.titleB }}</span>
                </div>
                <div class="wb-dup-score-row">
                  <n-progress type="line" :percentage="Math.round(pair.overallScore * 100)" :height="8" :show-indicator="false" :color="scoreColor(pair.overallScore)" />
                  <span class="wb-dup-score-val" :style="{ color: scoreColor(pair.overallScore) }">{{ Math.round(pair.overallScore * 100) }}%</span>
                </div>
                <p class="wb-dup-reason">{{ pair.reason }}</p>
                <div class="wb-dup-badges">
                  <n-tag v-if="pair.sameCwe" size="small" type="warning">相同 CWE</n-tag>
                  <n-tag v-if="pair.sameVulnType" size="small" type="info">相同漏洞类型</n-tag>
                </div>
                <div class="wb-dup-actions" v-if="!pair.merged">
                  <n-button type="warning" size="small" @click="openMergeDialog(pair)">合并</n-button>
                </div>
                <div v-else class="wb-dup-merged-badge">
                  <SvgIcon icon="mdi:check-circle" style="font-size: 16px; color: #107C10" />
                  <span>已合并</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ═══════ Card 4: ExtractTool ═══════ -->
      <div class="wb-card">
        <div class="wb-card-header">
          <SvgIcon icon="mdi:text-recognition" style="font-size: 20px; color: #0078D4" />
          <div class="wb-card-title-group">
            <span class="wb-card-title">LLM 提取测试</span>
            <span class="wb-card-desc">粘贴文本，AI 自动提取结构化漏洞信息</span>
          </div>
          <n-button v-if="extStep === 3" quaternary size="tiny" @click="resetExtract">重置</n-button>
        </div>
        <div class="wb-card-body">
          <!-- Step 1 -->
          <template v-if="extStep === 1">
            <n-input v-model:value="extContent" type="textarea" :rows="8" placeholder="粘贴漏洞描述、安全公告或代码片段..." />
            <div class="wb-actions">
              <n-button type="primary" @click="extractContent" :disabled="!extContent.trim()">提取</n-button>
            </div>
          </template>
          <!-- Step 2 -->
          <template v-if="extStep === 2">
            <div class="wb-loading-center">
              <n-spin size="large" />
              <span class="wb-loading-text">AI 正在提取结构化信息...</span>
            </div>
          </template>
          <!-- Step 3 -->
          <template v-if="extStep === 3 && extResult">
            <div class="wb-extract-result">
              <div class="wb-ext-row">
                <span class="wb-ext-label">标题</span>
                <span class="wb-ext-value wb-ext-title">{{ extResult.title }}</span>
              </div>
              <div class="wb-ext-row">
                <span class="wb-ext-label">摘要</span>
                <span class="wb-ext-value">{{ extResult.summary }}</span>
              </div>
              <div class="wb-ext-row">
                <span class="wb-ext-label">漏洞类型</span>
                <span class="wb-ext-value">{{ extResult.vulnerabilityType }}</span>
              </div>
              <div class="wb-ext-row">
                <span class="wb-ext-label">严重程度</span>
                <n-tag :color="{ color: severityColor(extResult.severity) + '20', textColor: severityColor(extResult.severity), borderColor: severityColor(extResult.severity) }" size="small" round>{{ severityLabelMap[extResult.severity] || extResult.severity }}</n-tag>
              </div>
              <div class="wb-ext-row">
                <span class="wb-ext-label">CVSS</span>
                <span class="wb-ext-value">{{ extResult.cvssScore }}</span>
              </div>
              <div class="wb-ext-row">
                <span class="wb-ext-label">语言</span>
                <span class="wb-ext-value">{{ extResult.language }}</span>
              </div>
              <div class="wb-ext-row wb-ext-expandable" @click="toggleExpand('problem')">
                <span class="wb-ext-label">问题描述 {{ extExpanded.problem ? '▾' : '▸' }}</span>
                <span class="wb-ext-value">{{ extExpanded.problem ? extResult.problemDescription : truncate(extResult.problemDescription, 100) }}</span>
              </div>
              <div class="wb-ext-row wb-ext-expandable" @click="toggleExpand('fix')">
                <span class="wb-ext-label">修复建议 {{ extExpanded.fix ? '▾' : '▸' }}</span>
                <span class="wb-ext-value">{{ extExpanded.fix ? extResult.fixSuggestion : truncate(extResult.fixSuggestion, 100) }}</span>
              </div>
              <div v-if="extResult.exampleCode" class="wb-ext-code">
                <span class="wb-ext-label">示例代码</span>
                <pre class="wb-code-block"><code>{{ extResult.exampleCode }}</code></pre>
              </div>
              <div v-if="extResult.suggestedTags?.length" class="wb-ext-tags">
                <span class="wb-ext-label">标签</span>
                <div class="wb-tag-list">
                  <n-tag v-for="tag in extResult.suggestedTags" :key="tag" size="small" type="info">{{ tag }}</n-tag>
                </div>
              </div>
              <div class="wb-actions">
                <n-button type="primary" @click="createItemFromExtract">创建为条目</n-button>
              </div>
            </div>
          </template>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.ai-workbench {
  padding: 20px;
  background: #FAF9F8;
  min-height: 100%;
}
.wb-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 1100px) {
  .wb-grid { grid-template-columns: 1fr; }
}

/* ── Card ── */
.wb-card {
  background: #fff;
  border: 1px solid #EDEBE9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 380px;
  transition: box-shadow 0.2s;
}
.wb-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.wb-card-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #F3F2F1;
}
.wb-card-title-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wb-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #323130;
}
.wb-card-desc {
  font-size: 12px;
  color: #605E5C;
}
.wb-card-body {
  flex: 1;
  padding: 16px 20px 20px;
  overflow-y: auto;
  max-height: 500px;
}

/* ── Common ── */
.wb-actions {
  margin-top: 14px;
  display: flex;
  gap: 8px;
}
.wb-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
}
.wb-loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 180px;
}
.wb-loading-text {
  font-size: 13px;
  color: #605E5C;
}

/* ── Card 1: Suggestion ── */
.wb-checkbox-list {
  max-height: 260px;
  overflow-y: auto;
}
.wb-checkbox-item {
  padding: 6px 0;
  border-bottom: 1px solid #F3F2F1;
}
.wb-checkbox-item:last-child { border-bottom: none; }
.wb-frag-preview {
  font-size: 13px;
  color: #323130;
  word-break: break-all;
}
.wb-suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wb-suggestion-card {
  border: 1px solid #EDEBE9;
  border-radius: 6px;
  padding: 12px 14px;
  transition: border-color 0.2s, opacity 0.2s;
}
.wb-suggestion-card.is-accepted { border-color: #107C10; opacity: 0.85; }
.wb-suggestion-card.is-rejected { border-color: #D13438; opacity: 0.6; }
.wb-sug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.wb-sug-title {
  font-weight: 600;
  font-size: 14px;
  color: #323130;
}
.wb-sug-summary {
  font-size: 13px;
  color: #605E5C;
  margin: 6px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wb-sug-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.wb-sug-type {
  font-size: 12px;
  color: #0078D4;
  background: #0078D410;
  padding: 2px 8px;
  border-radius: 4px;
}
.wb-sug-confidence {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #605E5C;
  flex: 1;
  max-width: 200px;
}
.wb-sug-actions {
  display: flex;
  gap: 8px;
}
.wb-sug-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #605E5C;
}

/* ── Card 2: Matching ── */
.wb-match-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wb-match-btns {
  display: flex;
  gap: 8px;
}
.wb-match-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wb-match-item {
  border: 1px solid #EDEBE9;
  border-radius: 6px;
  padding: 10px 14px;
  transition: opacity 0.2s, border-color 0.2s;
}
.wb-match-item.is-linked { border-color: #107C10; opacity: 0.85; }
.wb-match-item.is-dismissed { opacity: 0.5; }
.wb-match-pair {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wb-match-item-title {
  font-weight: 600;
  font-size: 13px;
  color: #323130;
}
.wb-match-arrow {
  color: #0078D4;
  font-weight: 600;
}
.wb-match-frag-preview {
  font-size: 12px;
  color: #605E5C;
  word-break: break-all;
}
.wb-match-score {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  font-size: 12px;
  color: #605E5C;
}
.wb-match-reason {
  font-size: 12px;
  color: #605E5C;
  margin: 4px 0 8px;
}
.wb-match-actions {
  display: flex;
  gap: 8px;
}
.wb-match-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #605E5C;
}

/* ── Card 3: Duplicate ── */
.wb-dup-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.wb-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.wb-slider-label {
  font-size: 13px;
  color: #323130;
  white-space: nowrap;
}
.wb-dup-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wb-dup-pair {
  border: 1px solid #EDEBE9;
  border-radius: 6px;
  padding: 12px 14px;
  transition: opacity 0.2s;
}
.wb-dup-pair.is-merged { opacity: 0.6; }
.wb-dup-titles {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.wb-dup-title-a, .wb-dup-title-b {
  font-weight: 600;
  font-size: 13px;
  color: #323130;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-dup-vs {
  color: #D13438;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}
.wb-dup-score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.wb-dup-score-val {
  font-weight: 600;
  font-size: 13px;
  min-width: 40px;
}
.wb-dup-reason {
  font-size: 12px;
  color: #605E5C;
  margin: 4px 0 8px;
}
.wb-dup-badges {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.wb-dup-actions {
  display: flex;
  gap: 8px;
}
.wb-dup-merged-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #107C10;
}

/* ── Card 4: Extract ── */
.wb-extract-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wb-ext-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.wb-ext-label {
  font-size: 12px;
  color: #605E5C;
  min-width: 70px;
  flex-shrink: 0;
  padding-top: 2px;
}
.wb-ext-value {
  font-size: 13px;
  color: #323130;
  word-break: break-all;
}
.wb-ext-title {
  font-weight: 600;
  font-size: 14px;
}
.wb-ext-expandable {
  cursor: pointer;
  border-radius: 4px;
  padding: 4px 0;
}
.wb-ext-expandable:hover {
  background: #FAF9F8;
}
.wb-ext-code {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wb-code-block {
  background: #F3F2F1;
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  overflow-x: auto;
  color: #323130;
  white-space: pre-wrap;
  word-break: break-all;
}
.wb-ext-tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wb-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>

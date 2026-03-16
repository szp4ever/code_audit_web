<script setup lang="ts">
import { ref, computed, inject, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NSpin, NSkeleton, NButton, NSpace, NEmpty,
  NCard, NTag, NDivider,
  useMessage,
} from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import { getKnowledgeStorageStats } from '@/api/v2/knowledgeBase'
import type { KnowledgeStorageStatsVo } from '@/api/v2/knowledgeBase'
import request from '@/utils/request/req'
import echarts from '@/utils/echarts'
import type { ECharts } from 'echarts/core'

const message = useMessage()
const router = useRouter()
const route = useRoute()
const kid = inject<Ref<string>>('kid')!

// ========== 状态 ==========
const loading = ref(true)
const loadError = ref(false)
const stats = ref<KnowledgeStorageStatsVo | null>(null)
const lastRefreshTime = ref('')

// ========== 文档列表（用于环图 + Top 表，实时查 MinIO） ==========
const docList = ref<any[]>([])
const docListLoading = ref(false)

async function loadDocList() {
  if (!kid.value) return
  docListLoading.value = true
  try {
    // 复用已有的文档列表接口，一次拿全部（pageSize 大一点）
    const res: any = await request({
      url: '/knowledge/document/attach/list',
      method: 'get',
      params: { kid: kid.value, pageNum: 1, pageSize: 200 },
    })
    const rows = res.rows ?? res.data?.rows ?? []
    docList.value = rows
  } catch { /* silent */ } finally {
    docListLoading.value = false
  }
}

// 按 fileSize 降序排列的 Top 10
const topDocs = computed(() => {
  return [...docList.value]
    .filter(d => d.fileSize && d.fileSize > 0)
    .sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0))
    .slice(0, 10)
})
// 模板别名
const topDocItems = topDocs

// 按 docType 分组的字节构成（真实 MinIO 数据）
const docTypeComposition = computed(() => {
  const map = new Map<string, number>()
  for (const doc of docList.value) {
    if (!doc.fileSize || doc.fileSize <= 0) continue
    const type = doc.docType || '未知'
    map.set(type, (map.get(type) ?? 0) + doc.fileSize)
  }
  return Array.from(map.entries())
    .map(([type, bytes]) => ({ type, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
})
// 模板别名
const compositionData = docTypeComposition

// ========== 图表 DOM refs ==========
const trendChartEl = ref<HTMLElement | null>(null)
const compositionChartEl = ref<HTMLElement | null>(null)
const updateFreqChartEl = ref<HTMLElement | null>(null)
const heatmapChartEl = ref<HTMLElement | null>(null)

let trendInst: ECharts | null = null
let compositionInst: ECharts | null = null
let updateFreqInst: ECharts | null = null
let heatmapInst: ECharts | null = null

// ========== 数据加载 ==========
async function loadStats() {
  if (!kid.value) return
  loading.value = true
  loadError.value = false
  try {
    const res: any = await getKnowledgeStorageStats(kid.value)
    if (res.code === 200 && res.data) {
      stats.value = res.data
      lastRefreshTime.value = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } else {
      loadError.value = true
      message.error('加载存储统计失败：' + (res.msg || ''))
    }
  } catch (e: any) {
    loadError.value = true
    message.error('加载失败：' + (e.message || '网络错误'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadDocList()
})

function refreshAll() {
  loadStats()
  loadDocList()
}
watch(kid, () => {
  loadStats()
  loadDocList()
})

// ========== 数据就绪后渲染图表 ==========
watch(stats, (s) => {
  if (!s) return
  nextTick(() => {
    renderTrend(s)
    renderUpdateFreq(s)
    renderHeatmap(s)
    requestAnimationFrame(() => {
      trendInst?.resize()
      updateFreqInst?.resize()
      heatmapInst?.resize()
    })
  })
})

// 文档列表加载完后渲染环图
watch(docTypeComposition, (comp) => {
  if (comp.length > 0) {
    nextTick(() => {
      renderComposition(comp)
      requestAnimationFrame(() => compositionInst?.resize())
    })
  }
})

function onWindowResize() {
  trendInst?.resize()
  compositionInst?.resize()
  updateFreqInst?.resize()
  heatmapInst?.resize()
}
onMounted(() => window.addEventListener('resize', onWindowResize))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  trendInst?.dispose()
  compositionInst?.dispose()
  updateFreqInst?.dispose()
  heatmapInst?.dispose()
})

// ========== 图表工具 ==========
function getOrInit(el: HTMLElement | null, inst: ECharts | null): ECharts | null {
  if (!el) return null
  if (inst && !inst.isDisposed()) return inst
  return echarts.init(el)
}

// ========== 渲染：文档新增趋势 ==========
function renderTrend(s: KnowledgeStorageStatsVo) {
  trendInst = getOrInit(trendChartEl.value, trendInst)
  if (!trendInst) return
  const dates = (s.storageGrowth ?? []).map(p => p.date)
  const counts = (s.storageGrowth ?? []).map(p => p.count)
  trendInst.setOption({
    tooltip: {
      trigger: 'axis', backgroundColor: '#fff', borderColor: '#e1dfdd', borderWidth: 1,
      textStyle: { color: '#323130', fontSize: 12 },
      formatter: (params: any) => `<b>${params[0].axisValue}</b><br/>新增文档：${params[0].value} 个`,
    },
    grid: { left: 48, right: 16, top: 20, bottom: 36 },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { fontSize: 11, color: '#605e5c', rotate: 45 },
      axisLine: { lineStyle: { color: '#e1dfdd' } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', minInterval: 1,
      axisLabel: { fontSize: 11, color: '#605e5c' },
      splitLine: { lineStyle: { color: '#f3f2f1', type: 'dashed' } },
    },
    series: [{
      type: 'bar', data: counts, barMaxWidth: 24,
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#0078d4' }, { offset: 1, color: '#c7e0f4' }] },
        borderRadius: [3, 3, 0, 0],
      },
      emphasis: { itemStyle: { color: '#005a9e' } },
    }],
    animationDuration: 600,
  }, true)

  // 点击柱子 → 跳到文档 Tab，筛选该日创建的文档
  trendInst.off('click')
  trendInst.on('click', (params: any) => {
    if (params.componentType === 'series' && params.name) {
      const date = params.name
      navigateToTab('documents', {
        createTimeStart: date + ' 00:00:00',
        createTimeEnd: date + ' 23:59:59',
      })
    }
  })
}

// ========== 渲染：存储构成（真实 MinIO 字节，按 docType 分组） ==========
const typeColors: Record<string, string> = {
  pdf: '#d13438', doc: '#0078d4', docx: '#0078d4', xls: '#107c10', xlsx: '#107c10',
  ppt: '#ca5010', pptx: '#ca5010', txt: '#605e5c', md: '#8764b8', csv: '#498205',
  jpg: '#b4009e', jpeg: '#b4009e', png: '#b4009e', gif: '#b4009e', svg: '#b4009e',
  zip: '#004e8c', rar: '#004e8c', '7z': '#004e8c',
}

function renderComposition(comp: { type: string; bytes: number }[]) {
  compositionInst = getOrInit(compositionChartEl.value, compositionInst)
  if (!compositionInst) return
  const data = comp.map(c => ({
    value: c.bytes,
    name: c.type.toUpperCase(),
    itemStyle: { color: typeColors[c.type.toLowerCase()] || '#a19f9d' },
  }))
  compositionInst.setOption({
    tooltip: {
      trigger: 'item', backgroundColor: '#fff', borderColor: '#e1dfdd', borderWidth: 1,
      textStyle: { color: '#323130', fontSize: 12 },
      formatter: (params: any) => `<b>${params.name}</b><br/>${formatBytes(params.value)}（${params.percent}%）`,
    },
    legend: {
      orient: 'vertical', right: 16, top: 'center',
      textStyle: { fontSize: 12, color: '#605e5c' },
      itemWidth: 12, itemHeight: 12, itemGap: 12,
    },
    series: [{
      type: 'pie', radius: ['50%', '72%'], center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 600, color: '#323130', formatter: '{b}\n{d}%' },
        scaleSize: 6,
      },
      data,
    }],
    animationDuration: 600,
  }, true)

  // 点击扇区 → 跳到文档 Tab，按 docType 筛选
  compositionInst.off('click')
  compositionInst.on('click', (params: any) => {
    if (params.componentType === 'series' && params.name) {
      navigateToTab('documents', { docType: params.name.toLowerCase() })
    }
  })
}

// ========== 渲染：更新频率柱图 ==========
function renderUpdateFreq(s: KnowledgeStorageStatsVo) {
  updateFreqInst = getOrInit(updateFreqChartEl.value, updateFreqInst)
  if (!updateFreqInst) return
  const dates = (s.updateFrequency ?? []).map(p => p.date)
  const counts = (s.updateFrequency ?? []).map(p => p.count)
  updateFreqInst.setOption({
    tooltip: {
      trigger: 'axis', backgroundColor: '#fff', borderColor: '#e1dfdd', borderWidth: 1,
      textStyle: { color: '#323130', fontSize: 12 },
      formatter: (params: any) => `<b>${params[0].axisValue}</b><br/>更新条目：${params[0].value} 条`,
    },
    grid: { left: 48, right: 16, top: 20, bottom: 36 },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { fontSize: 11, color: '#605e5c', rotate: 45 },
      axisLine: { lineStyle: { color: '#e1dfdd' } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', minInterval: 1,
      axisLabel: { fontSize: 11, color: '#605e5c' },
      splitLine: { lineStyle: { color: '#f3f2f1', type: 'dashed' } },
    },
    series: [{
      type: 'bar', data: counts, barMaxWidth: 24,
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#ca5010' }, { offset: 1, color: '#ffe7c6' }] },
        borderRadius: [3, 3, 0, 0],
      },
      emphasis: { itemStyle: { color: '#a33d0b' } },
    }],
    animationDuration: 600,
  }, true)

  // 点击柱子 → 跳到条目 Tab，筛选该日更新的条目
  updateFreqInst.off('click')
  updateFreqInst.on('click', (params: any) => {
    if (params.componentType === 'series' && params.name) {
      navigateToTab('items', {
        updateTimeStart: params.name + ' 00:00:00',
        updateTimeEnd: params.name + ' 23:59:59',
      })
    }
  })
}

// ========== 渲染：日历热力图 ==========
function renderHeatmap(s: KnowledgeStorageStatsVo) {
  heatmapInst = getOrInit(heatmapChartEl.value, heatmapInst)
  if (!heatmapInst) return
  const freq = (s.updateFrequency90d?.length ? s.updateFrequency90d : s.updateFrequency) ?? []
  const heatData = freq.map(p => [p.date, p.count ?? 0])
  const maxCount = Math.max(...freq.map(p => p.count ?? 0), 1)
  const endDate = freq.length > 0 ? freq[freq.length - 1].date : new Date().toISOString().slice(0, 10)
  const startDate = freq.length > 0 ? freq[0].date : new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10)

  heatmapInst.setOption({
    tooltip: {
      formatter: (params: any) => `<b>${params.value[0]}</b><br/>更新 ${params.value[1]} 条`,
    },
    visualMap: {
      show: false, min: 0, max: maxCount,
      inRange: { color: ['#f3f2f1', '#c7e0f4', '#5ba3d9', '#0078d4', '#005a9e'] },
    },
    calendar: {
      top: 30, left: 50, right: 16, bottom: 8,
      cellSize: [14, 14],
      range: [startDate, endDate],
      itemStyle: { borderWidth: 3, borderColor: '#fff', borderRadius: 3 },
      yearLabel: { show: false },
      monthLabel: { fontSize: 11, color: '#605e5c', nameMap: 'ZH' },
      dayLabel: {
        firstDay: 1, fontSize: 10, color: '#a19f9d',
        nameMap: ['日', '一', '二', '三', '四', '五', '六'],
      },
      splitLine: { show: false },
    },
    series: [{
      type: 'heatmap', coordinateSystem: 'calendar', data: heatData,
      emphasis: { itemStyle: { borderColor: '#323130', borderWidth: 1 } },
    }],
    animationDuration: 400,
  }, true)

  // 点击某天格子 → 跳到条目 Tab，筛选该日更新的条目
  heatmapInst.off('click')
  heatmapInst.on('click', (params: any) => {
    if (params.value && params.value[0]) {
      const date = params.value[0]
      const count = params.value[1] ?? 0
      if (count > 0) {
        navigateToTab('items', {
          updateTimeStart: date + ' 00:00:00',
          updateTimeEnd: date + ' 23:59:59',
        })
      }
    }
  })
}

// ========== 格式化 ==========
function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let idx = 0, val = bytes
  while (val >= 1024 && idx < units.length - 1) { val /= 1024; idx++ }
  return val.toFixed(idx === 0 ? 0 : 2) + ' ' + units[idx]
}

function formatTime(val: any): string {
  if (!val) return '—'
  const d = typeof val === 'number' ? new Date(val) : new Date(String(val))
  if (isNaN(d.getTime())) return String(val)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

// ========== 跨 Tab 导航（核心） ==========
// 通过 URL query 驱动 Tab 切换 + 筛选恢复
// KnowledgeDetailPage watch route.query.tab → activeTab
// ItemTab/DocumentTab onActivated → restoreFromQuery()

function navigateToTab(tab: string, extra: Record<string, string> = {}) {
  const query: Record<string, string> = { ...route.query as Record<string, string>, tab, ...extra }
  // 清除旧的筛选参数，避免残留
  const filterKeys = ['severity', 'status', 'vulnType', 'lang', 'tags', 'updateTimeStart', 'updateTimeEnd', 'q', 'sort', 'dir', 'docType', 'docId', 'createTimeStart', 'createTimeEnd']
  for (const key of filterKeys) {
    if (!(key in extra)) delete query[key]
  }
  console.log('[MonitorTab] navigateToTab:', tab, 'extra:', extra, 'final query:', JSON.parse(JSON.stringify(query)))
  router.replace({ query })
}

// 日期工具
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

// ========== KPI 卡片点击 ==========
interface KpiCard {
  key: string; label: string; value: string; subLabel?: string
  icon: string; color: string; bgColor: string
  clickable: boolean
  onClick?: () => void
}

const kpiCards = computed<KpiCard[]>(() => {
  const s = stats.value
  if (!s) return []
  return [
    {
      key: 'used', label: '已用空间', value: formatBytes(s.usedBytes),
      icon: 'mdi:harddisk', color: '#0078d4', bgColor: '#eff6fc',
      clickable: true,
      onClick: () => navigateToTab('documents'),
    },
    {
      key: 'growth7d', label: '近7日增长', value: formatBytes(s.growth7dBytes),
      subLabel: '日均 ' + formatBytes(s.avgDailyGrowthBytes),
      icon: 'mdi:trending-up', color: '#8764b8', bgColor: '#f3f0f9',
      clickable: true,
      onClick: () => navigateToTab('documents', { sort: 'createTime', dir: 'desc' }),
    },
    {
      key: 'items', label: '条目数', value: String(s.itemCount ?? 0),
      subLabel: '片段 ' + (s.fragmentCount ?? 0),
      icon: 'mdi:file-document-edit-outline', color: '#107c10', bgColor: '#dff6dd',
      clickable: true,
      onClick: () => navigateToTab('items'),
    },
    {
      key: 'attaches', label: '文档数', value: String(s.attachCount ?? 0),
      icon: 'mdi:file-document-multiple-outline', color: '#ca5010', bgColor: '#fff4ce',
      clickable: true,
      onClick: () => navigateToTab('documents'),
    },
    {
      key: 'today', label: '今日更新', value: String(s.todayUpdates ?? 0) + ' 条',
      subLabel: '本周 ' + (s.weekUpdates ?? 0) + ' 条',
      icon: 'mdi:pencil-box-multiple', color: '#ca5010', bgColor: '#fff4ce',
      clickable: (s.todayUpdates ?? 0) > 0,
      onClick: () => navigateToTab('items', {
        updateTimeStart: todayStr() + ' 00:00:00',
        updateTimeEnd: todayStr() + ' 23:59:59',
      }),
    },
    {
      key: 'month', label: '近30天更新', value: String(s.monthUpdates ?? 0) + ' 条',
      subLabel: '日均 ' + (s.avgDailyUpdates?.toFixed(1) ?? '0') + ' 条',
      icon: 'mdi:chart-bar', color: '#0078d4', bgColor: '#eff6fc',
      clickable: (s.monthUpdates ?? 0) > 0,
      onClick: () => navigateToTab('items', {
        updateTimeStart: daysAgoStr(30) + ' 00:00:00',
        updateTimeEnd: todayStr() + ' 23:59:59',
      }),
    },
  ]
})
</script>
<template>
  <div class="monitor-tab">

    <!-- 加载态 -->
    <div v-if="loading && !stats" class="monitor-skeleton">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        <NSkeleton v-for="i in 6" :key="i" :height="88" style="border-radius:8px" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <NSkeleton :height="260" style="border-radius:8px" />
        <NSkeleton :height="260" style="border-radius:8px" />
      </div>
    </div>

    <!-- 错误态 -->
    <div v-else-if="loadError && !stats" class="monitor-error">
      <NEmpty description="加载存储统计失败">
        <template #extra>
          <NButton type="primary" @click="loadStats">
            <template #icon><SvgIcon icon="mdi:refresh" /></template>
            重试
          </NButton>
        </template>
      </NEmpty>
    </div>

    <!-- 正常态 -->
    <template v-else-if="stats">

      <!-- 顶部工具栏 -->
      <div class="monitor-toolbar">
        <span class="monitor-toolbar__time">
          <SvgIcon icon="mdi:clock-outline" />
          最近刷新：{{ lastRefreshTime || '—' }}
        </span>
        <NButton size="tiny" quaternary @click="refreshAll" :loading="loading">
          <template #icon><SvgIcon icon="mdi:refresh" style="font-size:14px" /></template>
          刷新
        </NButton>
      </div>

      <!-- KPI 六卡 -->
      <div class="kpi-grid">
        <div
          v-for="card in kpiCards"
          :key="card.key"
          class="kpi-card"
          :class="{ 'kpi-card--clickable': card.clickable }"
          :style="{ '--kpi-color': card.color, '--kpi-bg': card.bgColor }"
          @click="card.clickable && card.onClick?.()"
        >
          <div class="kpi-card__icon">
            <SvgIcon :icon="card.icon" />
          </div>
          <div class="kpi-card__body">
            <div class="kpi-card__label">{{ card.label }}</div>
            <div class="kpi-card__value">{{ card.value }}</div>
            <div v-if="card.subLabel" class="kpi-card__sub">{{ card.subLabel }}</div>
          </div>
          <SvgIcon v-if="card.clickable" icon="mdi:chevron-right" class="kpi-card__arrow" />
        </div>
      </div>

      <NDivider style="margin:16px 0" />

      <!-- 双图区：文档新增趋势 + 存储构成（真实字节） -->
      <div class="chart-row">
        <NCard title="文档新增趋势（近30天）" size="small" class="chart-card" :bordered="true">
          <template #header-extra>
            <NTag size="small" :bordered="false" type="info">按日</NTag>
          </template>
          <div v-if="!(stats.storageGrowth?.some(p => p.count > 0))" class="chart-empty">
            <NEmpty description="暂无数据" />
          </div>
          <div v-else ref="trendChartEl" class="chart-container" />
        </NCard>

        <NCard title="存储构成（按文档类型）" size="small" class="chart-card" :bordered="true">
          <template #header-extra>
            <NTag size="small" :bordered="false" type="info">占比</NTag>
          </template>
          <NSpin :show="docListLoading" style="min-height:260px">
            <div v-if="compositionData.length === 0 && !docListLoading" class="chart-empty">
              <NEmpty description="暂无文档" />
            </div>
            <div v-else ref="compositionChartEl" class="chart-container" />
          </NSpin>
        </NCard>
      </div>

      <!-- 更新频率 -->
      <div class="chart-row" style="margin-top:16px">
        <NCard title="条目更新频率（近30天）" size="small" class="chart-card chart-card--full" :bordered="true">
          <template #header-extra>
            <NSpace :size="8" align="center">
              <NTag size="small" :bordered="false" type="warning">今日 {{ stats.todayUpdates ?? 0 }} 条</NTag>
              <NTag size="small" :bordered="false" type="info">本周 {{ stats.weekUpdates ?? 0 }} 条</NTag>
            </NSpace>
          </template>
          <div v-if="!(stats.updateFrequency?.some(p => p.count > 0))" class="chart-empty">
            <NEmpty description="暂无更新数据" />
          </div>
          <div v-else ref="updateFreqChartEl" class="chart-container" />
        </NCard>
      </div>

      <!-- 日历热力图 -->
      <div class="chart-row" style="margin-top:16px">
        <NCard title="更新活跃度（近90天）" size="small" class="chart-card chart-card--full" :bordered="true">
          <template #header-extra>
            <span class="heatmap-legend">
              <span style="color:#a19f9d;font-size:11px;margin-right:4px">少</span>
              <span class="heatmap-legend__cell" style="background:#f3f2f1" />
              <span class="heatmap-legend__cell" style="background:#c7e0f4" />
              <span class="heatmap-legend__cell" style="background:#5ba3d9" />
              <span class="heatmap-legend__cell" style="background:#0078d4" />
              <span class="heatmap-legend__cell" style="background:#005a9e" />
              <span style="color:#a19f9d;font-size:11px;margin-left:4px">多</span>
            </span>
          </template>
          <div v-if="!((stats.updateFrequency90d ?? stats.updateFrequency)?.some(p => p.count > 0))" class="chart-empty" style="height:160px">
            <NEmpty description="近90天无更新活动" />
          </div>
          <div v-else ref="heatmapChartEl" class="chart-container" style="height:160px" />
        </NCard>
      </div>

      <!-- Top 占用文档 -->
      <div class="chart-row" style="margin-top:16px">
        <NCard title="Top 占用文档" size="small" class="chart-card chart-card--full" :bordered="true">
          <template #header-extra>
            <NTag size="small" :bordered="false" type="info">按文件大小排序</NTag>
          </template>
          <NSpin :show="docListLoading">
            <div v-if="topDocItems.length === 0 && !docListLoading" style="padding:24px 0;text-align:center">
              <NEmpty description="暂无文档数据" />
            </div>
            <table v-else class="top-table">
              <thead>
                <tr>
                  <th style="width:40px">#</th>
                  <th>文档名称</th>
                  <th style="width:80px">类型</th>
                  <th style="width:100px;text-align:right">大小</th>
                  <th style="width:140px">更新时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in topDocItems" :key="item.docId || idx" class="top-table__row top-table__row--clickable" @click="navigateToTab('documents', { q: item.docName || item.fileName })">
                  <td class="top-table__rank">{{ idx + 1 }}</td>
                  <td class="top-table__title">{{ item.docName || item.fileName || '—' }}</td>
                  <td><NTag size="small" :bordered="false">{{ item.docType || '—' }}</NTag></td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">{{ formatBytes(item.fileSize) }}</td>
                  <td style="color:#a19f9d;font-size:12px">{{ formatTime(item.updateTime || item.createTime) }}</td>
                </tr>
              </tbody>
            </table>
          </NSpin>
        </NCard>
      </div>

    </template>
  </div>
</template>
<style scoped>
.monitor-tab { padding: 0; }
.monitor-skeleton { padding: 0; }
.monitor-error { padding: 80px 0; text-align: center; }

/* 工具栏 */
.monitor-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}
.monitor-toolbar__time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #a19f9d;
  line-height: 1;
}

/* KPI 六卡 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px)  { .kpi-grid { grid-template-columns: 1fr; } }

.kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--kpi-bg, #f3f2f1);
  border-radius: 10px;
  border: 1px solid #edebe9;
  transition: transform 140ms ease, box-shadow 140ms ease;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.06); }
@media (prefers-reduced-motion: reduce) { .kpi-card:hover { transform: none; box-shadow: none; } }

.kpi-card--clickable { cursor: pointer; position: relative; }
.kpi-card__arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--kpi-color, #a19f9d);
  opacity: 0;
  transition: opacity 180ms ease, transform 180ms ease;
}
.kpi-card--clickable:hover .kpi-card__arrow {
  opacity: 0.7;
  transform: translateY(-50%) translateX(2px);
}

.kpi-card__icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--kpi-color, #0078d4);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.kpi-card__label { font-size: 12px; color: #605e5c; line-height: 1.4; }
.kpi-card__value {
  font-size: 20px; font-weight: 700; color: #323130; line-height: 1.3;
  font-variant-numeric: tabular-nums;
  animation: kpi-enter 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes kpi-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) { .kpi-card__value { animation: none; } }
.kpi-card__sub { font-size: 11px; color: #a19f9d; margin-top: 2px; }

/* 图表区 */
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 1000px) { .chart-row { grid-template-columns: 1fr; } }

.chart-card { border-radius: 10px; }
.chart-card--full { grid-column: 1 / -1; }
.chart-container { width: 100%; height: 260px; }
.chart-empty { height: 260px; display: flex; align-items: center; justify-content: center; }

/* Top 占用表格 */
.top-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.top-table th {
  text-align: left;
  font-weight: 600;
  color: #605e5c;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 6px 8px;
  border-bottom: 1px solid #edebe9;
}
.top-table td {
  padding: 8px 8px;
  border-bottom: 1px solid #f3f2f1;
  color: #323130;
}
.top-table__row:hover { background: #faf9f8; }
.top-table__row--clickable { cursor: pointer; transition: background 140ms ease; }
.top-table__row--clickable:hover { background: #eff6fc; }
.top-table__rank {
  color: #a19f9d;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.top-table__title {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 热力图图例 */
.heatmap-legend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.heatmap-legend__cell {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid #edebe9;
}
</style>

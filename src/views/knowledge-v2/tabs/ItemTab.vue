<template>
  <div class="item-tab" :style="{ background: '#FAF9F8', minHeight: '100%' }">
    <div class="item-tab__layout">
      <!-- LEFT PANEL: Facet Filters -->
      <transition name="slide-left">
        <aside v-show="facetVisible" class="item-tab__facet" :style="{ width: '240px' }">
          <div class="facet-header">
            <span class="facet-header__title">筛选条件</span>
            <NButton quaternary size="tiny" @click="facetVisible = false">
              <template #icon><span style="font-size:16px">«</span></template>
            </NButton>
          </div>

          <!-- Severity Facet -->
          <div class="facet-section">
            <div class="facet-section__title">严重程度</div>
            <div
              v-for="s in severityOptions"
              :key="s.value"
              class="facet-item"
              :class="{ 'facet-item--active': filters.severity.includes(s.value) }"
              @click="toggleFacet('severity', s.value)"
            >
              <span class="severity-dot" :style="{ background: s.color }"></span>
              <span class="facet-item__label">{{ s.label }}</span>
              <span class="facet-item__count">{{ facetCounts.severity[s.value] ?? 0 }}</span>
            </div>
          </div>

          <!-- Status Facet -->
          <div class="facet-section">
            <div class="facet-section__title">状态</div>
            <div
              v-for="st in statusOptions"
              :key="st.value"
              class="facet-item"
              :class="{ 'facet-item--active': filters.status.includes(st.value) }"
              @click="toggleFacet('status', st.value)"
            >
              <NTag :type="st.tagType" size="small" round>{{ st.label }}</NTag>
              <span class="facet-item__count">{{ facetCounts.status[st.value] ?? 0 }}</span>
            </div>
          </div>

          <!-- Vulnerability Type Facet -->
          <div class="facet-section">
            <div class="facet-section__title">漏洞类型</div>
            <div
              v-for="vt in displayedVulnTypes"
              :key="vt.value"
              class="facet-item"
              :class="{ 'facet-item--active': filters.vulnerabilityType.includes(vt.value) }"
              @click="toggleFacet('vulnerabilityType', vt.value)"
            >
              <span class="facet-item__label">{{ vt.label }}</span>
              <span class="facet-item__count">{{ vt.count }}</span>
            </div>
            <NButton
              v-if="allVulnTypes.length > 10 && !vulnTypeExpanded"
              text size="tiny" type="primary"
              @click="vulnTypeExpanded = true"
            >更多 ({{ allVulnTypes.length - 10 }})</NButton>
            <NButton
              v-if="vulnTypeExpanded"
              text size="tiny" type="primary"
              @click="vulnTypeExpanded = false"
            >收起</NButton>
          </div>

          <!-- Language Facet -->
          <div class="facet-section">
            <div class="facet-section__title">语言</div>
            <NSelect
              v-model:value="filters.language"
              multiple filterable clearable
              size="small"
              placeholder="选择语言"
              :options="languageOptions"
              @update:value="onFiltersChange"
            />
          </div>

          <!-- Tags Facet -->
          <div class="facet-section">
            <div class="facet-section__title">标签</div>
            <div class="facet-tags-wrap">
              <NTag
                v-for="t in tagFacetList"
                :key="t.value"
                size="small"
                :checked="filters.tags.includes(t.value)"
                checkable
                @update:checked="toggleFacet('tags', t.value)"
              >{{ t.label }} ({{ t.count }})</NTag>
            </div>
          </div>
        </aside>
      </transition>

      <!-- RIGHT PANEL -->
      <div class="item-tab__main">
        <!-- Active filter chips -->
        <div v-if="hasActiveFilters" class="active-filters">
          <NButton v-if="!facetVisible" quaternary size="tiny" @click="facetVisible = true" style="margin-right:8px">
            <template #icon><span style="font-size:16px">»</span></template>
            筛选
          </NButton>
          <NTag
            v-for="chip in activeFilterChips"
            :key="chip.key"
            closable size="small"
            :style="{ marginRight: '4px', marginBottom: '4px' }"
            @close="removeFilter(chip)"
          >{{ chip.label }}</NTag>
          <NButton text size="tiny" type="primary" @click="clearAllFilters" style="margin-left:4px">清除全部筛选</NButton>
        </div>

        <!-- Toolbar -->
        <div class="item-tab__toolbar">
          <NSpace align="center" :wrap="false">
            <NButton v-if="!facetVisible && !hasActiveFilters" quaternary size="small" @click="facetVisible = true">
              <template #icon><span style="font-size:16px">»</span></template>
            </NButton>
            <NInput
              v-model:value="searchText"
              placeholder="搜索条目标题或内容..."
              clearable
              maxlength="100"
              style="width:280px"
              @update:value="onSearchInput"
            >
              <template #prefix><SvgIcon icon="mdi:magnify" /></template>
            </NInput>
            <NDatePicker
              v-model:value="dateRangeValue"
              type="daterange"
              size="small"
              clearable
              close-on-select
              :shortcuts="dateShortcuts"
              start-placeholder="更新起始"
              end-placeholder="更新截止"
              style="width:260px"
              format="yyyy-MM-dd"
            />
            <NSelect
              v-model:value="sortField"
              :options="sortOptions"
              size="small"
              style="width:140px"
              @update:value="onSortChange"
            />
            <NButton quaternary size="small" @click="toggleSortDir">
              <span style="font-size:16px">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
            </NButton>
          </NSpace>
          <NSpace align="center" :wrap="false">
            <span style="font-size:12px;color:#a19f9d;margin-right:4px">
              可通过左侧复选框选择条目后导出
            </span>
            <NButton size="small" @click="openExportDialog(false)">
              <template #icon><SvgIcon icon="mdi:download" style="font-size:16px" /></template>
              导出
            </NButton>
            <NButton size="small" quaternary :type="vulnChartVisible ? 'primary' : 'default'" @click="vulnChartVisible = !vulnChartVisible">
              <template #icon><SvgIcon icon="mdi:chart-pie" style="font-size:16px" /></template>
              分布
            </NButton>
            <NButton size="small" @click="openTagManage">标签管理</NButton>
            <NButton type="primary" size="small" @click="createItem">新建条目</NButton>
          </NSpace>
        </div>

        <!-- Vulnerability Distribution Panel (collapsible) -->
        <transition name="slide-down">
          <div v-if="vulnChartVisible" class="vuln-dist-panel">
            <div class="vuln-dist-panel__header">
              <NSpace align="center" :size="8">
                <SvgIcon icon="mdi:chart-pie" style="font-size:16px; color:#8764b8" />
                <span class="vuln-dist-panel__title">漏洞类型分布</span>
                <NTag v-if="vulnDistData" size="small" :bordered="false" type="info">
                  CWE 覆盖率 {{ vulnDistData.coveragePercent?.toFixed(1) ?? 0 }}%
                </NTag>
              </NSpace>
              <NButton quaternary size="tiny" @click="vulnChartVisible = false">
                <template #icon><SvgIcon icon="mdi:chevron-up" style="font-size:16px" /></template>
              </NButton>
            </div>
            <NSpin :show="vulnDistLoading" style="min-height: 200px">
              <div v-if="vulnDistData" class="vuln-dist-panel__body">
                <!-- 左：Pareto 组合图（柱+累计折线+80%参考线） -->
                <div ref="vulnPieChartEl" class="vuln-dist-chart" />
                <!-- 右：严重级别分布 -->
                <div class="vuln-dist-severity">
                  <div class="vuln-dist-severity__title">按严重级别</div>
                  <div
                    v-for="sev in vulnDistData.bySeverity"
                    :key="sev.severity"
                    class="vuln-dist-severity__row vuln-dist-severity__row--clickable"
                    @click="onSeverityClick(sev.severity)"
                  >
                    <span class="severity-dot" :style="{ background: vulnSeverityColorMap[sev.severity] || '#a19f9d' }" />
                    <span class="vuln-dist-severity__label">{{ sev.severity }}</span>
                    <span class="vuln-dist-severity__count">{{ sev.count }}</span>
                    <div class="vuln-dist-severity__bar-bg">
                      <div
                        class="vuln-dist-severity__bar-fill"
                        :style="{
                          width: (sev.percentage ?? 0) + '%',
                          background: vulnSeverityColorMap[sev.severity] || '#a19f9d',
                        }"
                      />
                    </div>
                    <span class="vuln-dist-severity__pct">{{ (sev.percentage ?? 0).toFixed(1) }}%</span>
                  </div>
                  <div v-if="!vulnDistData.bySeverity?.length" style="color:#a19f9d; font-size:12px; padding:8px 0">暂无数据</div>
                </div>
              </div>
              <!-- Others 可展开区域 -->
              <div v-if="vulnDistData?.othersItem && vulnDistData.othersItem.count > 0" class="vuln-others-section">
                <div class="vuln-others-toggle" @click="othersExpanded = !othersExpanded">
                  <SvgIcon :icon="othersExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" style="font-size:14px;color:#605e5c" />
                  <span>其他 ({{ vulnDistData.othersItem.count }} 条，{{ vulnDistData.othersItem.typeCount ?? '多' }}种类型)</span>
                </div>
                <transition name="slide-down">
                  <div v-if="othersExpanded" class="vuln-others-list">
                    <NSpin :show="othersLoading">
                      <table v-if="othersFullList.length > 0" class="vuln-others-table">
                        <thead>
                          <tr>
                            <th>CWE ID</th>
                            <th>名称</th>
                            <th style="text-align:right">数量</th>
                            <th style="text-align:right">占比</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in othersFullList" :key="row.cweId" class="vuln-others-table__row" @click="onCweClick(row.cweId)">
                            <td style="color:#0078d4;font-weight:500">{{ row.cweId }}</td>
                            <td>{{ row.cweNameZh || row.cweName || '—' }}</td>
                            <td style="text-align:right;font-variant-numeric:tabular-nums">{{ row.count }}</td>
                            <td style="text-align:right;color:#a19f9d;font-variant-numeric:tabular-nums">{{ (row.percentage ?? 0).toFixed(1) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                      <NEmpty v-else-if="!othersLoading" description="无更多数据" style="padding:16px 0" />
                    </NSpin>
                  </div>
                </transition>
              </div>
              <NEmpty v-else-if="!vulnDistLoading && !vulnDistData" description="暂无漏洞分布数据" style="padding:40px 0" />
            </NSpin>
          </div>
        </transition>

        <!-- Batch Actions Bar -->
        <transition name="slide-down">
          <div v-if="selectedRowKeys.length > 0" class="batch-bar">
            <span class="batch-bar__text">已选 {{ selectedRowKeys.length }} 项</span>
            <NButton size="small" @click="openBatchUpdate">批量更新</NButton>
            <NPopconfirm
              :positive-text="'确认删除'"
              :negative-text="'取消'"
              @positive-click="doBatchDelete"
            >
              <template #trigger>
                <NButton size="small" type="error">批量删除</NButton>
              </template>
              确定要删除选中的 {{ selectedRowKeys.length }} 个条目吗？此操作不可撤销。
            </NPopconfirm>
            <NButton size="small" @click="openExportDialog(true)">导出选中</NButton>
            <NButton size="small" quaternary @click="selectedRowKeys = []">取消选择</NButton>
          </div>
        </transition>

        <!-- Data Table -->
        <NSpin :show="tableLoading">
          <NDataTable
            v-if="tableData.length > 0 || tableLoading"
            :columns="columns"
            :data="tableData"
            :row-key="(row: any) => row.itemUuid ?? row.uuid"
            :checked-row-keys="selectedRowKeys"
            :row-props="getRowProps"
            :scroll-x="1200"
            :bordered="false"
            :single-line="false"
            striped
            size="small"
            @update:checked-row-keys="onCheckedChange"
          />
          <NEmpty v-if="!tableLoading && tableData.length === 0" :description="emptyDescription" style="padding:80px 0" />
        </NSpin>

        <!-- Pagination（无数据时不显示） -->
        <div v-if="pagination.total > 0" class="item-tab__pagination">
          <NPagination
            v-model:page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :item-count="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            show-size-picker
            :prefix="() => `共 ${pagination.total} 条`"
            @update:page="onPageChange"
            @update:page-size="onPageSizeChange"
          />
        </div>
      </div>
    </div>

    <!-- Tag Manage Modal -->
    <TagManageModal v-model="tagManageVisible" @refresh="fetchFacetStats" />

    <!-- Export Dialog (成熟版) -->
    <ItemExportDialog
      ref="exportDialogRef"
      v-model:visible="exportVisible"
      :selected-items="selectedItemsSet"
      :table-data="tableData"
      :pagination="{ page: pagination.page, pageSize: pagination.pageSize, itemCount: pagination.total }"
      :filter-state="buildQueryParams()"
      :search-keyword="searchText"
    />

    <!-- Batch Update Dialog -->
    <NModal
      v-model:show="batchUpdateVisible"
      preset="card"
      title="批量更新"
      style="width:480px"
      :mask-closable="false"
    >
      <div class="batch-update-dialog">
        <div class="batch-field">
          <label>状态</label>
          <NSelect
            v-model:value="batchForm.status"
            clearable
            placeholder="不修改"
            :options="statusOptions.map(s => ({ label: s.label, value: s.value }))"
          />
        </div>
        <div class="batch-field">
          <label>严重程度</label>
          <NSelect
            v-model:value="batchForm.severity"
            clearable
            placeholder="不修改"
            :options="severityOptions.map(s => ({ label: s.label, value: s.value }))"
          />
        </div>
        <div class="batch-field">
          <label>添加标签</label>
          <NSelect
            v-model:value="batchForm.addTags"
            multiple filterable clearable
            placeholder="选择要添加的标签"
            :options="allTagOptions"
          />
        </div>
        <div class="batch-field">
          <label>移除标签</label>
          <NSelect
            v-model:value="batchForm.removeTags"
            multiple filterable clearable
            placeholder="选择要移除的标签"
            :options="allTagOptions"
          />
        </div>
        <NSpace justify="end" style="margin-top:16px">
          <NButton @click="batchUpdateVisible = false">取消</NButton>
          <NButton type="primary" :loading="batchUpdateLoading" :disabled="!batchHasChanges" @click="doBatchUpdate">确认更新</NButton>
        </NSpace>
      </div>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onActivated, inject, h, type VNodeChild, type Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NButton, NDataTable, NSelect, NTag, NPagination, NInput, NSpace,
  NModal, NPopconfirm, NTooltip, NSpin,
  NEmpty, NDatePicker, useMessage, useDialog
} from 'naive-ui'
import SvgIcon from '@/components/common/SvgIcon/index.vue'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import request from '@/utils/request/req'
import TagManageModal from '@/components/knowledge/TagManageModal.vue'
import ItemExportDialog from '@/components/knowledge/export/ItemExportDialog.vue'
import { extractKeywords, highlightTextForRender } from '@/utils/searchHighlight'
import { getCweReferenceListAll, type CweReference } from '@/api/cwe'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()

const kidRef = inject<Ref<string>>('kid')!
const kid = computed(() => kidRef.value)
const knowledgeBase = inject<Ref<any>>('knowledgeBase')!

// ─── Constants ───
// 严重程度选项（value为后端存储值，label为界面显示中文）
const severityOptions = [
  { value: 'Critical', label: '严重', color: '#D13438' },
  { value: 'High', label: '高危', color: '#CA5010' },
  { value: 'Medium', label: '中危', color: '#FFB900' },
  { value: 'Low', label: '低危', color: '#0078D4' },
  { value: 'None', label: '无风险', color: '#8A8886' },
]
// 严重程度值到中文标签的映射
const severityLabelMap: Record<string, string> = Object.fromEntries(severityOptions.map(s => [s.value, s.label]))
const severityColorMap: Record<string, string> = Object.fromEntries(severityOptions.map(s => [s.value, s.color]))

const statusOptions = [
  { value: 'draft', label: '草稿', tagType: 'default' as const },
  { value: 'published', label: '已发布', tagType: 'success' as const },
  { value: 'archived', label: '已归档', tagType: 'warning' as const },
]
const statusLabelMap: Record<string, string> = Object.fromEntries(statusOptions.map(s => [s.value, s.label]))
const statusTypeMap: Record<string, string> = Object.fromEntries(statusOptions.map(s => [s.value, s.tagType]))

const baseSortOptions = [
  { label: '更新时间', value: 'updateTime' },
  { label: '创建时间', value: 'createTime' },
  { label: '严重程度', value: 'severity' },
  { label: '标题', value: 'title' },
  { label: 'CVSS评分', value: 'cvssScore' },
]
/** 有搜索时在首位加入「相关程度」 */
const sortOptions = computed(() =>
  searchText.value.trim()
    ? [{ label: '相关程度', value: 'relevance' }, ...baseSortOptions]
    : baseSortOptions
)

// ─── State ───
const facetVisible = ref(true)
const vulnTypeExpanded = ref(false)
const searchText = ref('')
const sortField = ref('updateTime')
const sortDir = ref<'asc' | 'desc'>('desc')
/** 清空搜索时恢复的排序状态 */
const previousSortState = ref<{ sortField: string; sortDir: 'asc' | 'desc' }>({
  sortField: 'updateTime',
  sortDir: 'desc',
})
/** 上一次 debounce 执行时的搜索状态（用于判断进入/退出搜索） */
const prevSearchHadKeyword = ref(false)
const tableLoading = ref(false)
const tableData = ref<any[]>([])
const cweList = ref<CweReference[]>([])
const selectedRowKeys = ref<DataTableRowKey[]>([])
const tagManageVisible = ref(false)

// ─── Vulnerability Distribution ───
const vulnChartVisible = ref(false)
const vulnDistLoading = ref(false)
const vulnDistData = ref<any>(null)
const vulnPieChartEl = ref<HTMLElement | null>(null)

const vulnSeverityColorMap: Record<string, string> = {
  Critical: '#d13438',
  High: '#ca5010',
  Medium: '#ffaa44',
  Low: '#107c10',
  None: '#a19f9d',
}

async function fetchVulnDistribution() {
  if (!kid?.value) return
  vulnDistLoading.value = true
  try {
    const res: any = await request({ url: '/knowledge/item/vulnerability-distribution', method: 'get', params: { kid: kid.value, topN: 10 } })
    const data = res.data ?? res
    vulnDistData.value = data
    renderVulnPieChart(data)
  } catch (e: any) {
    // silent
  } finally {
    vulnDistLoading.value = false
  }
}

function renderVulnPieChart(data: any) {
  if (!data?.distribution?.length) return
  setTimeout(() => {
    if (!vulnPieChartEl.value) return
    import('@/utils/echarts').then((mod) => {
      const ec = mod.default
      const existing = ec.getInstanceByDom(vulnPieChartEl.value!)
      const chart = existing || ec.init(vulnPieChartEl.value!)

      // Build Pareto data: bars (count) + cumulative line (%)
      const items = [...data.distribution]
      if (data.othersItem) {
        items.push({
          ...data.othersItem,
          cweNameZh: data.othersItem.cweNameZh || data.othersItem.cweName || '其他',
          cweId: 'OTHERS',
        })
      }
      const total = items.reduce((s: number, i: any) => s + (i.count ?? 0), 0)
      const names: string[] = []
      const counts: number[] = []
      const cumPcts: number[] = []
      let cumSum = 0
      for (const item of items) {
        const label = item.cweNameZh || item.cweName || item.cweId
        names.push(label.length > 10 ? label.slice(0, 10) + '…' : label)
        counts.push(item.count ?? 0)
        cumSum += item.count ?? 0
        cumPcts.push(total > 0 ? Math.round((cumSum / total) * 1000) / 10 : 0)
      }

      const colors = ['#0078d4', '#8764b8', '#ca5010', '#107c10', '#d13438', '#005a9e', '#b4009e', '#498205', '#c239b3', '#004e8c', '#a19f9d']

      chart.setOption({
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#fff',
          borderColor: '#e1dfdd',
          borderWidth: 1,
          textStyle: { color: '#323130', fontSize: 12 },
          formatter: (params: any) => {
            const bar = params.find((p: any) => p.seriesType === 'bar')
            const line = params.find((p: any) => p.seriesType === 'line')
            if (!bar) return ''
            const idx = bar.dataIndex
            const orig = items[idx]
            const cweId = orig?.cweId ?? ''
            const pct = total > 0 ? ((bar.value / total) * 100).toFixed(1) : '0'
            let html = `<div style="font-weight:600;margin-bottom:4px">${bar.name}</div>`
            if (cweId && cweId !== 'OTHERS') html += `<div style="color:#605e5c;font-size:11px;margin-bottom:2px">${cweId}</div>`
            html += `${bar.value} 条（${pct}%）`
            if (line) html += `<br/>累计 ${line.value}%`
            return html
          },
        },
        grid: { left: 48, right: 48, top: 24, bottom: 48 },
        xAxis: {
          type: 'category',
          data: names,
          axisLabel: { fontSize: 10, color: '#605e5c', rotate: 30, interval: 0 },
          axisLine: { lineStyle: { color: '#e1dfdd' } },
          axisTick: { show: false },
        },
        yAxis: [
          {
            type: 'value',
            name: '数量',
            nameTextStyle: { fontSize: 11, color: '#a19f9d' },
            minInterval: 1,
            axisLabel: { fontSize: 11, color: '#605e5c' },
            splitLine: { lineStyle: { color: '#f3f2f1', type: 'dashed' } },
          },
          {
            type: 'value',
            name: '累计%',
            nameTextStyle: { fontSize: 11, color: '#a19f9d' },
            min: 0,
            max: 100,
            axisLabel: { fontSize: 11, color: '#a19f9d', formatter: '{value}%' },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            type: 'bar',
            data: counts,
            yAxisIndex: 0,
            barMaxWidth: 28,
            itemStyle: {
              color: (params: any) => colors[params.dataIndex % colors.length],
              borderRadius: [3, 3, 0, 0],
            },
            emphasis: { itemStyle: { opacity: 0.85 } },
          },
          {
            type: 'line',
            data: cumPcts,
            yAxisIndex: 1,
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { color: '#ca5010', width: 2 },
            itemStyle: { color: '#ca5010' },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#d13438', type: 'dashed', width: 1 },
              label: { formatter: '80%', position: 'end', fontSize: 10, color: '#d13438' },
              data: [{ yAxis: 80 }],
            },
          },
        ],
        animationDuration: 600,
        animationEasing: 'cubicOut',
      }, true)

      // Click to filter
      chart.off('click')
      chart.on('click', (params: any) => {
        if (params.seriesType === 'bar') {
          const idx = params.dataIndex
          const orig = items[idx]
          if (orig?.cweId && orig.cweId !== 'OTHERS') {
            onCweClick(orig.cweId)
          }
        }
      })
    })
  }, 50)
}

// ─── Others 展开 ───
const othersExpanded = ref(false)
const othersLoading = ref(false)
const othersFullList = ref<any[]>([])

watch(othersExpanded, async (expanded) => {
  if (expanded && othersFullList.value.length === 0) {
    othersLoading.value = true
    try {
      const res: any = await request({
        url: '/knowledge/item/vulnerability-distribution',
        method: 'get',
        params: { kid: kid?.value, topN: 999 },
      })
      const data = res.data ?? res
      // 排除已在 TopN 中展示的
      const topIds = new Set((vulnDistData.value?.distribution ?? []).map((d: any) => d.cweId))
      othersFullList.value = (data?.distribution ?? []).filter((d: any) => !topIds.has(d.cweId))
    } catch { /* silent */ } finally {
      othersLoading.value = false
    }
  }
})

// ─── 图表联动筛选 ───
function onCweClick(cweId: string) {
  if (!cweId) return
  filters.vulnerabilityType = [cweId]
  fetchList()
}

function onSeverityClick(severity: string) {
  if (!severity) return
  filters.severity = [severity]
  fetchList()
}

// Watch vulnChartVisible to load data on first open
watch(vulnChartVisible, (visible) => {
  if (visible && !vulnDistData.value) {
    fetchVulnDistribution()
  }
})

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const filters = reactive<{
  severity: string[]
  status: string[]
  vulnerabilityType: string[]
  language: string[]
  tags: string[]
  updateTimeStart: string
  updateTimeEnd: string
}>({
  severity: [],
  status: [],
  vulnerabilityType: [],
  language: [],
  tags: [],
  updateTimeStart: '',
  updateTimeEnd: '',
})

// 日期范围选择器双向绑定（NDatePicker daterange 用 [startTs, endTs] 毫秒时间戳）
const dateRangeValue = ref<[number, number] | null>(null)

const dateShortcuts = {
  '今天': () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return [start, Date.now()] as [number, number]
  },
  '近7天': () => {
    const now = Date.now()
    return [now - 7 * 86400000, now] as [number, number]
  },
  '近30天': () => {
    const now = Date.now()
    return [now - 30 * 86400000, now] as [number, number]
  },
  '本月': () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return [start, Date.now()] as [number, number]
  },
}

watch(dateRangeValue, (val) => {
  if (val && val[0] && val[1]) {
    const fmt = (ts: number, end?: boolean) => {
      const d = new Date(ts)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}` + (end ? ' 23:59:59' : ' 00:00:00')
    }
    filters.updateTimeStart = fmt(val[0])
    filters.updateTimeEnd = fmt(val[1], true)
  } else {
    filters.updateTimeStart = ''
    filters.updateTimeEnd = ''
  }
  pagination.page = 1
  fetchList()
})

const facetCounts = reactive<{
  severity: Record<string, number>
  status: Record<string, number>
  vulnerabilityType: { value: string; label: string; count: number }[]
  language: { value: string; label: string; count: number }[]
  tags: { value: string; label: string; count: number }[]
}>({
  severity: {},
  status: {},
  vulnerabilityType: [],
  language: [],
  tags: [],
})

// Export state (使用成熟版导出组件)
const exportVisible = ref(false)
const exportDialogRef = ref<InstanceType<typeof ItemExportDialog> | null>(null)
const selectedItemsSet = computed(() => new Set(selectedRowKeys.value.map(String)))

// Batch update state
const batchUpdateVisible = ref(false)
const batchUpdateLoading = ref(false)
const batchForm = reactive({
  status: null as string | null,
  severity: null as string | null,
  addTags: [] as string[],
  removeTags: [] as string[],
})
/** 批量更新至少需要修改一个字段 */
const batchHasChanges = computed(() =>
  !!batchForm.status || !!batchForm.severity || batchForm.addTags.length > 0 || batchForm.removeTags.length > 0
)

// ─── Computed ───
const allVulnTypes = computed(() => facetCounts.vulnerabilityType)
const displayedVulnTypes = computed(() => {
  const list = vulnTypeExpanded.value ? allVulnTypes.value : allVulnTypes.value.slice(0, 10)
  return list.map(vt => ({ ...vt, label: getCweShortDisplay(vt.value).short || vt.value }))
})
const languageOptions = computed(() =>
  facetCounts.language.map(l => ({ label: `${l.label} (${l.count})`, value: l.value }))
)
const tagFacetList = computed(() => facetCounts.tags)
const allTagOptions = computed(() =>
  facetCounts.tags.map(t => ({ label: t.label, value: t.value }))
)

const hasActiveFilters = computed(() =>
  filters.severity.length > 0 ||
  filters.status.length > 0 ||
  filters.vulnerabilityType.length > 0 ||
  filters.language.length > 0 ||
  filters.tags.length > 0 ||
  !!filters.updateTimeStart ||
  !!filters.updateTimeEnd
)

interface FilterChip { key: string; label: string; facet: keyof typeof filters | 'dateRange'; value: string }
const activeFilterChips = computed<FilterChip[]>(() => {
  const chips: FilterChip[] = []
  filters.severity.forEach(v => chips.push({ key: `severity-${v}`, label: `严重程度: ${severityLabelMap[v] || v}`, facet: 'severity', value: v }))
  filters.status.forEach(v => chips.push({ key: `status-${v}`, label: `状态: ${statusLabelMap[v] || v}`, facet: 'status', value: v }))
  filters.vulnerabilityType.forEach(v => chips.push({ key: `vt-${v}`, label: `类型: ${getCweShortDisplay(v).short}`, facet: 'vulnerabilityType', value: v }))
  filters.language.forEach(v => chips.push({ key: `lang-${v}`, label: `语言: ${v}`, facet: 'language', value: v }))
  filters.tags.forEach(v => chips.push({ key: `tag-${v}`, label: `标签: ${v}`, facet: 'tags', value: v }))
  if (filters.updateTimeStart || filters.updateTimeEnd) {
    const start = filters.updateTimeStart ? filters.updateTimeStart.slice(0, 10) : '...'
    const end = filters.updateTimeEnd ? filters.updateTimeEnd.slice(0, 10) : '...'
    chips.push({ key: 'dateRange', label: `更新时间: ${start} ~ ${end}`, facet: 'dateRange', value: '' })
  }
  return chips
})

const emptyDescription = computed(() =>
  searchText.value || hasActiveFilters.value ? '没有匹配的搜索结果，请调整筛选条件' : '暂无条目数据'
)

// ─── Search debounce ───
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const wasSearching = prevSearchHadKeyword.value
    const isSearching = !!searchText.value.trim()
    if (!wasSearching && isSearching) {
      previousSortState.value = { sortField: sortField.value, sortDir: sortDir.value }
      sortField.value = 'relevance'
      sortDir.value = 'desc'
    } else if (wasSearching && !isSearching) {
      sortField.value = previousSortState.value.sortField
      sortDir.value = previousSortState.value.sortDir
    } else if (wasSearching && isSearching && sortField.value !== 'relevance') {
      sortField.value = 'relevance'
      sortDir.value = 'desc'
    }
    prevSearchHadKeyword.value = isSearching
    pagination.page = 1
    fetchList()
    fetchFacetStats()
    syncQueryParams()
  }, 300)
}

// ─── URL sync ───
function syncQueryParams() {
  const query: Record<string, string> = {}
  if (searchText.value) query.q = searchText.value
  if (filters.severity.length) query.severity = filters.severity.join(',')
  if (filters.status.length) query.status = filters.status.join(',')
  if (filters.vulnerabilityType.length) query.vulnType = filters.vulnerabilityType.join(',')
  if (filters.language.length) query.lang = filters.language.join(',')
  if (filters.tags.length) query.tags = filters.tags.join(',')
  if (sortField.value !== 'updateTime') query.sort = sortField.value
  if (sortDir.value !== 'desc') query.dir = sortDir.value
  if (pagination.page !== 1) query.page = String(pagination.page)
  if (pagination.pageSize !== 20) query.size = String(pagination.pageSize)
  router.replace({ query })
}

function restoreFromQuery() {
  const q = route.query
  if (q.q) searchText.value = String(q.q)
  if (q.severity) filters.severity = String(q.severity).split(',')
  if (q.status) filters.status = String(q.status).split(',')
  if (q.vulnType) filters.vulnerabilityType = String(q.vulnType).split(',')
  if (q.lang) filters.language = String(q.lang).split(',')
  if (q.tags) filters.tags = String(q.tags).split(',')
  if (q.updateTimeStart) filters.updateTimeStart = String(q.updateTimeStart)
  if (q.updateTimeEnd) filters.updateTimeEnd = String(q.updateTimeEnd)
  // 同步日期选择器 UI
  if (filters.updateTimeStart && filters.updateTimeEnd) {
    dateRangeValue.value = [
      new Date(filters.updateTimeStart).getTime(),
      new Date(filters.updateTimeEnd).getTime(),
    ]
  } else {
    dateRangeValue.value = null
  }
  if (q.sort) sortField.value = String(q.sort)
  if (q.dir) sortDir.value = q.dir === 'asc' ? 'asc' : 'desc'
  if (q.page) pagination.page = Number(q.page) || 1
  if (q.size) pagination.pageSize = Number(q.size) || 20
}

// ─── API helpers ───
function buildQueryParams() {
  const params: Record<string, any> = {
    kid: kid.value,
    pageNum: pagination.page,
    pageSize: pagination.pageSize,
    orderByColumn: sortField.value === 'relevance' ? 'updateTime' : sortField.value,
    isAsc: sortDir.value === 'asc' ? 'asc' : 'desc',
  }
  if (searchText.value) params.searchKeyword = searchText.value
  // 后端 KnowledgeItemBo 使用 List 字段：severities, statuses, vulnerabilityTypes, languages, tags（tag 名称）
  if (filters.severity.length) params.severities = filters.severity
  if (filters.status.length) params.statuses = filters.status
  if (filters.vulnerabilityType.length) params.vulnerabilityTypes = filters.vulnerabilityType
  if (filters.language.length) params.languages = filters.language
  if (filters.tags.length) params.tags = filters.tags
  if (filters.updateTimeStart) params.updateTimeStart = filters.updateTimeStart
  if (filters.updateTimeEnd) params.updateTimeEnd = filters.updateTimeEnd
  return params
}

async function fetchList() {
  tableLoading.value = true
  try {
    const res = await request({ url: '/knowledge/item/list', method: 'post', data: buildQueryParams() })
    const data = res.data ?? res
    tableData.value = data.records ?? data.rows ?? data.list ?? data.items ?? []
    pagination.total = data.total ?? 0
  } catch (e: any) {
    message.error(e?.message || '加载列表失败')
  } finally {
    tableLoading.value = false
  }
}

async function fetchFacetStats() {
  try {
    const res = await request({ url: '/knowledge/item/facetStats', method: 'post', data: buildQueryParams() })
    const data = res.data ?? res
    // 后端 FacetStatsVo 字段：severities, statuses, languages, vulnerabilityTypes, tags（均为 Map<String, Long>）
    const toRecord = (map: Record<string, number> | undefined) => {
      if (!map || typeof map !== 'object' || Array.isArray(map)) return {} as Record<string, number>
      const out: Record<string, number> = {}
      Object.entries(map).forEach(([k, v]) => { out[k] = Number(v) ?? 0 })
      return out
    }
    const toFacetList = (map: Record<string, number> | undefined) => {
      if (!map || typeof map !== 'object' || Array.isArray(map)) return []
      return Object.entries(map).map(([value, count]) => ({
        value,
        label: value,
        count: Number(count) ?? 0,
      }))
    }
    facetCounts.severity = toRecord(data.severities)
    facetCounts.status = toRecord(data.statuses)
    facetCounts.vulnerabilityType = toFacetList(data.vulnerabilityTypes)
    facetCounts.language = toFacetList(data.languages)
    facetCounts.tags = toFacetList(data.tags)
  } catch (_) { /* silent */ }
}

// ─── Filter actions ───
function toggleFacet(facet: keyof typeof filters, value: string) {
  const arr = filters[facet] as string[]
  const idx = arr.indexOf(value)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(value)
  onFiltersChange()
}

function removeFilter(chip: FilterChip) {
  if (chip.facet === 'dateRange') {
    filters.updateTimeStart = ''
    filters.updateTimeEnd = ''
    dateRangeValue.value = null
    onFiltersChange()
    return
  }
  const arr = filters[chip.facet as keyof typeof filters] as string[]
  const idx = arr.indexOf(chip.value)
  if (idx >= 0) arr.splice(idx, 1)
  onFiltersChange()
}

function clearAllFilters() {
  filters.severity = []
  filters.status = []
  filters.vulnerabilityType = []
  filters.language = []
  filters.tags = []
  filters.updateTimeStart = ''
  filters.updateTimeEnd = ''
  dateRangeValue.value = null
  onFiltersChange()
}

function onFiltersChange() {
  pagination.page = 1
  fetchList()
  fetchFacetStats()
  syncQueryParams()
}

// ─── Sort ───
function onSortChange() {
  pagination.page = 1
  fetchList()
  syncQueryParams()
}

function toggleSortDir() {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  pagination.page = 1
  fetchList()
  syncQueryParams()
}

// ─── Pagination ───
function onPageChange() {
  fetchList()
  syncQueryParams()
}
function onPageSizeChange() {
  pagination.page = 1
  fetchList()
  syncQueryParams()
}

// ─── Row interaction ───
function onCheckedChange(keys: DataTableRowKey[]) {
  selectedRowKeys.value = keys
}

function getRowProps(row: any) {
  const uuid = row.itemUuid ?? row.uuid
  return {
    style: 'cursor:pointer',
    onClick: (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('.n-checkbox') || target.closest('.n-popconfirm')) return
      if (!uuid) return
      router.push(`/knowledge-v2/${kid.value}/items/${uuid}`)
    },
  }
}

// ─── Navigation ───
function createItem() {
  router.push(`/knowledge-v2/${kid.value}/items/new`)
}
function openTagManage() {
  tagManageVisible.value = true
}

// ─── CWE 显示名称（表格空间有限：短文本 + 完整名 tooltip） ───
function normalizeCweId(id: string): string {
  if (!id) return ''
  return id.startsWith('CWE-') ? id : `CWE-${id}`
}
function getCweShortDisplay(cweId: string): { short: string; full: string } {
  const norm = normalizeCweId(cweId)
  const cwe = cweList.value.find(c => {
    const cNorm = normalizeCweId(c.cweId)
    return cNorm === norm || c.cweId === cweId || c.cweId === norm
  })
  const name = cwe?.nameZh || cwe?.nameEn || ''
  const short = name ? `${norm} ${name.slice(0, 4)}` : norm
  const full = name ? `${norm}: ${name}` : norm
  return { short, full }
}
function getVulnTypeDisplay(row: any): { short: string; full: string } | null {
  const ids: string[] = row.vulnerabilityTypes ?? (row.vulnerabilityType ? [row.vulnerabilityType] : [])
  if (!ids.length) return null
  const first = getCweShortDisplay(ids[0])
  if (ids.length === 1) return first
  return { short: `${first.short}等${ids.length}`, full: ids.map(id => getCweShortDisplay(id).full).join('；') }
}

// ─── CVSS color ───
function cvssColor(score: number): string {
  if (score >= 9) return '#D13438'
  if (score >= 7) return '#CA5010'
  if (score >= 4) return '#FFB900'
  return '#107C10'
}

// ─── Highlight search keyword ───
function highlightText(text: string): VNodeChild {
  if (!searchText.value || !text) return text
  const keywords = extractKeywords(searchText.value)
  if (!keywords.length) return text
  const content = highlightTextForRender(text, keywords, h)
  return content.length === 1 ? content[0] : h('span', {}, content)
}

// ─── Table columns ───
const columns = computed<DataTableColumns<any>>(() => [
  { type: 'selection' },
  {
    title: '标题',
    key: 'title',
    minWidth: 200,
    resizable: true,
    ellipsis: { tooltip: true },
    render(row) {
      return h('span', {
        style: 'color:#0078D4;cursor:pointer;font-weight:500',
      }, highlightText(row.title))
    },
  },
  {
    title: '漏洞类型',
    key: 'vulnerabilityType',
    width: 130,
    resizable: true,
    ellipsis: { tooltip: true },
    render(row) {
      const d = getVulnTypeDisplay(row)
      if (!d) return '—'
      return h(NTooltip, {}, {
        trigger: () => h('span', { style: 'color:#505050' }, d.short),
        default: () => d.full,
      })
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row) {
      return h(NTag, { size: 'small', type: (statusTypeMap[row.status] || 'default') as any }, { default: () => statusLabelMap[row.status] || row.status })
    },
  },
  {
    title: '标签',
    key: 'tags',
    width: 180,
    resizable: true,
    render(row) {
      const tags: string[] = row.tags ?? []
      if (!tags.length) return '—'
      return h(NSpace, { size: 4, wrap: true }, {
        default: () => tags.slice(0, 3).map(t =>
          h(NTag, { size: 'tiny', round: true }, { default: () => t })
        ).concat(tags.length > 3 ? [h(NTooltip, {}, {
          trigger: () => h(NTag, { size: 'tiny', round: true }, { default: () => `+${tags.length - 3}` }),
          default: () => tags.slice(3).join(', '),
        })] : [])
      })
    },
  },
  {
    title: 'CVSS',
    key: 'cvssScore',
    width: 80,
    sorter: true,
    render(row) {
      const score = row.cvssScore
      if (score == null) return '—'
      return h('span', { style: `color:${cvssColor(score)};font-weight:600` }, String(score))
    },
  },
  {
    title: '创建人',
    key: 'createByName',
    width: 100,
    ellipsis: { tooltip: true },
    render(row: any) {
      return h('span', { style: 'color: #666' }, row.createByName || row.createBy || '-')
    },
  },
  {
    title: '创建时间',
    key: 'createTime',
    width: 160,
    resizable: true,
    render(row) {
      if (!row.createTime) return '—'
      try {
        const d = new Date(row.createTime)
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      } catch { return row.createTime }
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 4 }, {
        default: () => [
          h(NButton, { size: 'tiny', quaternary: true, type: 'primary', onClick: (e: Event) => { e.stopPropagation(); router.push(`/knowledge-v2/${kid.value}/items/${row.itemUuid ?? row.uuid}?edit=1`) } }, { default: () => '编辑' }),
          h(NPopconfirm, { onPositiveClick: () => deleteItem(row.itemUuid ?? row.uuid) }, {
            trigger: () => h(NButton, { size: 'tiny', quaternary: true, type: 'error', onClick: (e: Event) => e.stopPropagation() }, { default: () => '删除' }),
            default: () => `确定要删除「${row.title}」吗？`,
          }),
        ],
      })
    },
  },
])

// ─── Single delete ───
async function deleteItem(uuid: string) {
  try {
    await request({ url: '/knowledge/item/delete/batch', method: 'post', data: [uuid] })
    message.success('删除成功')
    fetchList()
    fetchFacetStats()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

// ─── Batch delete ───
async function doBatchDelete() {
  try {
    await request({ url: '/knowledge/item/delete/batch', method: 'post', data: selectedRowKeys.value })
    message.success(`成功删除 ${selectedRowKeys.value.length} 个条目`)
    selectedRowKeys.value = []
    fetchList()
    fetchFacetStats()
  } catch (e: any) {
    message.error(e?.message || '批量删除失败')
  }
}

// ─── Batch update ───
function openBatchUpdate() {
  batchForm.status = null
  batchForm.severity = null
  batchForm.addTags = []
  batchForm.removeTags = []
  batchUpdateVisible.value = true
}

async function doBatchUpdate() {
  batchUpdateLoading.value = true
  try {
    const updates: Array<{ field: string; value: any }> = []
    if (batchForm.status) updates.push({ field: 'status', value: batchForm.status })
    if (batchForm.severity) updates.push({ field: 'severity', value: batchForm.severity })
    if (batchForm.addTags.length) updates.push({ field: 'addTags', value: batchForm.addTags })
    if (batchForm.removeTags.length) updates.push({ field: 'removeTags', value: batchForm.removeTags })
    for (const u of updates) {
      await request({
        url: '/knowledge/item/batch-update',
        method: 'post',
        data: { itemUuids: selectedRowKeys.value, field: u.field, value: u.value },
      })
    }
    message.success('批量更新成功')
    batchUpdateVisible.value = false
    selectedRowKeys.value = []
    fetchList()
    fetchFacetStats()
  } catch (e: any) {
    message.error(e?.message || '批量更新失败')
  } finally {
    batchUpdateLoading.value = false
  }
}

// ─── Export ───
function openExportDialog(onlySelected = false) {
  exportDialogRef.value?.open(onlySelected)
}

// ─── Init ───
async function loadCweList() {
  try {
    const res: any = await getCweReferenceListAll()
    cweList.value = res?.data ?? res ?? []
  } catch {
    cweList.value = []
  }
}

onMounted(() => {
  loadCweList()
  restoreFromQuery()
  fetchList()
  fetchFacetStats()
})

// KeepAlive 激活时重新从 URL query 恢复筛选（支持从 MonitorTab 跳转带参数）
onActivated(() => {
  const q = route.query
  if (q.severity || q.status || q.vulnType || q.lang || q.tags || q.updateTimeStart || q.updateTimeEnd || q.q) {
    restoreFromQuery()
    fetchList()
  }
})

// 监听 route.query 变化（最可靠的跨 Tab 联动方式，覆盖 v-show/KeepAlive 各种时序）
watch(() => route.query, (newQ) => {
  // 只在当前 Tab 是 items 时才响应
  if (newQ.tab !== 'items') return
  const hasFilterParams = newQ.severity || newQ.status || newQ.vulnType || newQ.lang || newQ.tags || newQ.updateTimeStart || newQ.updateTimeEnd || newQ.q
  if (hasFilterParams) {
    restoreFromQuery()
    fetchList()
  }
}, { deep: true })
</script>

<style scoped>
.item-tab {
  padding: 0;
  height: 100%;
}
.item-tab__layout {
  display: flex;
  gap: 0;
  height: 100%;
}

/* ─── Left Facet Panel ─── */
.item-tab__facet {
  flex-shrink: 0;
  border-right: 1px solid #EDEBE9;
  background: #fff;
  padding: 16px 12px;
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}
.facet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.facet-header__title {
  font-size: 14px;
  font-weight: 600;
  color: #323130;
}
.facet-section {
  margin-bottom: 16px;
}
.facet-section__title {
  font-size: 12px;
  font-weight: 600;
  color: #605E5C;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.facet-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
  color: #323130;
}
.facet-item:hover {
  background: #F3F2F1;
}
.facet-item--active {
  background: #DEECF9;
}
.facet-item__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.facet-item__count {
  font-size: 11px;
  color: #8A8886;
  background: #F3F2F1;
  border-radius: 8px;
  padding: 0 6px;
  min-width: 20px;
  text-align: center;
}
.severity-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.facet-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ─── Right Main Panel ─── */
.item-tab__main {
  flex: 1;
  min-width: 0;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Active filters */
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #EFF6FC;
  border-radius: 6px;
}

/* Toolbar */
.item-tab__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* Batch bar */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f3f2f1;
  border: 1px solid #e1dfdd;
  border-radius: 6px;
  color: #323130;
}
.batch-bar__text {
  font-size: 13px;
  font-weight: 500;
  color: #605e5c;
  margin-right: 4px;
}

/* Pagination */
.item-tab__pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

/* Batch update dialog */
.batch-update-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.batch-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #323130;
  margin-bottom: 4px;
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.25s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-240px);
  width: 0 !important;
  padding: 0 !important;
  overflow: hidden;
}
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  overflow: hidden;
  padding: 0 16px !important;
}

/* 表格行 hover 高亮 */
:deep(.n-data-table .n-data-table-tr) {
  transition: background-color 0.15s ease;
}
:deep(.n-data-table .n-data-table-tr:hover) {
  background-color: #f3f2f1 !important;
}

/* ─── Vulnerability Distribution Panel ─── */
.vuln-dist-panel {
  background: #fff;
  border: 1px solid #edebe9;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}
.vuln-dist-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #f3f2f1;
  background: #faf9f8;
}
.vuln-dist-panel__title {
  font-size: 13px;
  font-weight: 600;
  color: #323130;
}
.vuln-dist-panel__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  min-height: 200px;
}
.vuln-dist-chart {
  width: 100%;
  height: 220px;
  padding: 8px;
}
.vuln-dist-severity {
  padding: 12px 16px;
  border-left: 1px solid #f3f2f1;
}
.vuln-dist-severity__title {
  font-size: 12px;
  font-weight: 600;
  color: #605e5c;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.vuln-dist-severity__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}
.vuln-dist-severity__label {
  width: 56px;
  color: #323130;
  font-weight: 500;
}
.vuln-dist-severity__count {
  width: 32px;
  text-align: right;
  color: #605e5c;
  font-variant-numeric: tabular-nums;
}
.vuln-dist-severity__bar-bg {
  flex: 1;
  height: 6px;
  background: #f3f2f1;
  border-radius: 3px;
  overflow: hidden;
}
.vuln-dist-severity__bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.vuln-dist-severity__pct {
  width: 40px;
  text-align: right;
  color: #a19f9d;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .vuln-dist-panel__body {
    grid-template-columns: 1fr;
  }
  .vuln-dist-severity {
    border-left: none;
    border-top: 1px solid #f3f2f1;
  }
}

/* Severity row clickable */
.vuln-dist-severity__row--clickable {
  cursor: pointer;
  border-radius: 4px;
  padding: 4px 4px;
  margin: 0 -4px;
  transition: background 140ms ease;
}
.vuln-dist-severity__row--clickable:hover {
  background: #f3f2f1;
}

/* Others expandable section */
.vuln-others-section {
  border-top: 1px solid #f3f2f1;
}
.vuln-others-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  color: #605e5c;
  cursor: pointer;
  transition: background 140ms ease;
}
.vuln-others-toggle:hover {
  background: #faf9f8;
  color: #323130;
}
.vuln-others-list {
  padding: 0 14px 12px;
}
.vuln-others-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.vuln-others-table th {
  text-align: left;
  font-weight: 600;
  color: #605e5c;
  font-size: 11px;
  padding: 4px 8px;
  border-bottom: 1px solid #edebe9;
}
.vuln-others-table td {
  padding: 5px 8px;
  border-bottom: 1px solid #f3f2f1;
  color: #323130;
}
.vuln-others-table__row {
  cursor: pointer;
  transition: background 140ms ease;
}
.vuln-others-table__row:hover {
  background: #f3f2f1;
}

/* 数字列等宽 */
:deep(.n-data-table-td) {
  font-variant-numeric: tabular-nums;
}

/* 列宽拖拽手柄更明显 */
:deep(.n-data-table-resize-button) {
  width: 3px;
}
:deep(.n-data-table-resize-button:hover),
:deep(.n-data-table-resize-button--active) {
  background-color: #0078D4 !important;
}
</style>

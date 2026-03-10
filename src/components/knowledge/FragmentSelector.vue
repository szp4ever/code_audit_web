<template>
  <n-modal
    :show="props.modelValue"
    preset="card"
    :title="title"
    :style="{ width: '960px', maxWidth: '95vw' }"
    @update:show="handleModalShowChange"
    class="fragment-selector-modal"
  >
    <div class="fragment-selector">
      <!-- 搜索栏 -->
      <div class="selector-header">
        <div class="search-row">
          <n-input
            v-model:value="searchKeyword"
            placeholder="搜索片段内容、来源文档、索引编号..."
            clearable
            size="large"
            @update:value="handleSearchInput"
            class="search-input"
          >
            <template #prefix>
              <SvgIcon icon="ri:search-line" />
            </template>
          </n-input>
          
          <div class="sort-controls">
            <n-select
              v-model:value="sortField"
              :options="sortOptions"
              size="small"
              style="width: 140px;"
              @update:value="handleSortFieldChange"
            />
            <n-button
              size="small"
              quaternary
              @click="toggleSortOrder"
            >
              {{ sortOrder === 'asc' ? '升序' : '降序' }}
            </n-button>
          </div>
        </div>
        
        <!-- 已选摘要 -->
        <div v-show="selectedFragments.length > 0" class="selected-summary">
          <div class="selected-count-row">
            <span class="count-text">
              <n-tag type="success" size="small" round>{{ selectedFragments.length }}</n-tag>
              <span style="margin-left: 8px;">已选择</span>
            </span>
            <n-space :size="8">
              <n-button text type="info" size="small" @click="showSelectedDetailModal = true">
                查看全部
              </n-button>
              <n-button text type="error" size="small" @click="clearAllSelection">
                清空
              </n-button>
            </n-space>
          </div>
          <div class="selected-tags-container">
            <n-space :size="6" wrap>
              <n-tag
                v-for="fragment in visibleSelectedFragments"
                :key="fragment.id"
                closable
                size="small"
                :type="fragment.isAssociated ? 'warning' : 'default'"
                @close="removeSelection(fragment)"
              >
                {{ getFragmentDisplayName(fragment) }}
              </n-tag>
              <n-tag
                v-show="selectedFragments.length > compactThreshold"
                size="small"
                @click="showSelectedDetailModal = true"
                class="more-tag"
              >
                +{{ selectedFragments.length - compactThreshold }}
              </n-tag>
            </n-space>
          </div>
        </div>
        
        <!-- 筛选栏 -->
        <div class="filter-bar">
          <n-checkbox-group v-model:value="filterStatuses" @update:value="handleFilterChange">
            <n-space :size="12">
              <n-checkbox value="all">全部 ({{ statusCounts.all }})</n-checkbox>
              <n-checkbox value="unassociated">未关联 ({{ statusCounts.unassociated }})</n-checkbox>
              <n-checkbox value="associated">已关联 ({{ statusCounts.associated }})</n-checkbox>
            </n-space>
          </n-checkbox-group>
          
          <n-select
            v-model:value="filterDocIds"
            :options="documentOptions"
            placeholder="来源文档"
            size="small"
            multiple
            filterable
            clearable
            style="width: 160px;"
            @update:value="handleFilterChange"
          />
        </div>
      </div>
      
      <!-- 视图切换 -->
      <div class="view-mode-tabs">
        <n-space>
          <n-button 
            :type="viewMode === 'list' ? 'primary' : 'default'" 
            @click="viewMode = 'list'"
          >列表视图</n-button>
          <n-button 
            :type="viewMode === 'group-by-doc' ? 'primary' : 'default'" 
            @click="viewMode = 'group-by-doc'"
          >按文档分组</n-button>
          <n-button 
            :type="viewMode === 'group-by-time' ? 'primary' : 'default'" 
            @click="viewMode = 'group-by-time'"
          >按时间分组</n-button>
        </n-space>
      </div>
      
      <!-- 主内容区 -->
      <div class="selector-content">
        <n-spin :show="loading" description="加载中...">
          <!-- 列表视图 -->
          <div v-show="viewMode === 'list'" class="list-view">
            <n-empty v-if="showListEmpty" description="暂无数据">
              <template #icon>
                <SvgIcon icon="ri:file-search-line" style="font-size: 48px; color: #d1d1d1;" />
              </template>
            </n-empty>
            
            <div v-show="!showListEmpty" class="fragment-list">
              <div
                v-for="fragment in displayFragments"
                :key="fragment.id"
                class="fragment-item"
                :class="{ 'is-selected': isSelected(fragment), 'is-associated': fragment.isAssociated }"
                @click="toggleSelection(fragment)"
              >
                <div class="item-selector">
                  <n-checkbox 
                    :checked="isSelected(fragment)"
                    @click.stop
                    @update:checked="() => toggleSelection(fragment)"
                  />
                </div>
                <div class="item-content">
                  <div class="content-text" v-html="highlightContent(fragment.content, searchKeyword)"></div>
                  <div class="item-meta">
                    <n-space :size="12" align="center">
                      <n-tag size="tiny">{{ fragment.docName }}</n-tag>
                      <n-tag size="tiny" type="info">#{{ fragment.chunkIndex }}</n-tag>
                      <n-tag size="tiny" :type="fragment.isAssociated ? 'warning' : 'success'">
                        {{ fragment.isAssociated ? '已关联' : '未关联' }}
                      </n-tag>
                      <span class="meta-time">{{ formatTime(fragment.createTime) }}</span>
                    </n-space>
                  </div>
                </div>
                <div class="item-actions">
                  <n-button text size="tiny" @click.stop="openPreviewDrawer(fragment)">
                    预览
                  </n-button>
                </div>
              </div>
              
              <div v-show="showPagination" class="pagination-wrapper">
                <n-pagination
                  v-model:page="pagination.page"
                  :page-count="totalPages"
                  :page-sizes="[20, 50, 100]"
                  show-size-picker
                  @update:page="handlePageChange"
                  @update:page-size="handlePageSizeChange"
                />
              </div>
            </div>
          </div>
          
          <!-- 分组视图：按文档分组 -->
          <div v-show="viewMode === 'group-by-doc'" class="group-view">
            <n-empty v-if="groupedByDoc.length === 0" description="暂无数据">
              <template #icon>
                <SvgIcon icon="ri:file-search-line" style="font-size: 48px; color: #d1d1d1;" />
              </template>
            </n-empty>
            
            <n-collapse v-show="groupedByDoc.length > 0" :default-expanded-names="docGroupExpandedNames">
              <n-collapse-item
                v-for="group in groupedByDoc"
                :key="group.key"
                :name="group.key"
              >
                <template #header>
                  <div class="group-header">
                    <n-checkbox
                      :indeterminate="isGroupPartiallySelected(group)"
                      :checked="isGroupAllSelected(group)"
                      @click.stop
                      @update:checked="(checked: boolean) => toggleGroupSelection(group, checked)"
                    />
                    <span class="group-title-text">{{ group.name }}</span>
                    <n-tag size="tiny" :type="getGroupSelectedCount(group) > 0 ? 'success' : 'default'">
                      {{ getGroupSelectedCount(group) }}/{{ group.fragments.length }}
                    </n-tag>
                  </div>
                </template>
                
                <div class="group-fragments">
                  <div
                    v-for="fragment in group.fragments"
                    :key="fragment.id"
                    class="fragment-item group-fragment-item"
                    :class="{ 'is-selected': isSelected(fragment), 'is-associated': fragment.isAssociated }"
                    @click="toggleSelection(fragment)"
                  >
                    <n-checkbox 
                      :checked="isSelected(fragment)"
                      @click.stop
                      @update:checked="() => toggleSelection(fragment)"
                    />
                    <div class="group-fragment-content">
                      <div class="fragment-text" v-html="highlightContent(fragment.content, searchKeyword)"></div>
                      <div class="fragment-meta">
                        <n-tag size="tiny" type="info">#{{ fragment.chunkIndex }}</n-tag>
                        <n-tag size="tiny" :type="fragment.isAssociated ? 'warning' : 'success'">
                          {{ fragment.isAssociated ? '已关联' : '未关联' }}
                        </n-tag>
                        <span class="meta-time">{{ formatTime(fragment.createTime) }}</span>
                      </div>
                    </div>
                    <n-button text size="tiny" @click.stop="openPreviewDrawer(fragment)">
                      预览
                    </n-button>
                  </div>
                </div>
              </n-collapse-item>
            </n-collapse>
          </div>
          
          <!-- 分组视图：按时间分组 -->
          <div v-show="viewMode === 'group-by-time'" class="group-view">
            <n-empty v-if="groupedByTime.length === 0" description="暂无数据">
              <template #icon>
                <SvgIcon icon="ri:file-search-line" style="font-size: 48px; color: #d1d1d1;" />
              </template>
            </n-empty>
            
            <n-collapse v-show="groupedByTime.length > 0" :default-expanded-names="timeGroupExpandedNames">
              <n-collapse-item
                v-for="group in groupedByTime"
                :key="group.key"
                :name="group.key"
              >
                <template #header>
                  <div class="group-header">
                    <n-checkbox
                      :indeterminate="isGroupPartiallySelected(group)"
                      :checked="isGroupAllSelected(group)"
                      @click.stop
                      @update:checked="(checked: boolean) => toggleGroupSelection(group, checked)"
                    />
                    <span class="group-title-text">{{ group.name }}</span>
                    <n-tag size="tiny" :type="getGroupSelectedCount(group) > 0 ? 'success' : 'default'">
                      {{ getGroupSelectedCount(group) }}/{{ group.fragments.length }}
                    </n-tag>
                  </div>
                </template>
                
                <div class="group-fragments">
                  <div
                    v-for="fragment in group.fragments"
                    :key="fragment.id"
                    class="fragment-item group-fragment-item"
                    :class="{ 'is-selected': isSelected(fragment), 'is-associated': fragment.isAssociated }"
                    @click="toggleSelection(fragment)"
                  >
                    <n-checkbox 
                      :checked="isSelected(fragment)"
                      @click.stop
                      @update:checked="() => toggleSelection(fragment)"
                    />
                    <div class="group-fragment-content">
                      <div class="fragment-text" v-html="highlightContent(fragment.content, searchKeyword)"></div>
                      <div class="fragment-meta">
                        <n-tag size="tiny">{{ fragment.docName }}</n-tag>
                        <n-tag size="tiny" type="info">#{{ fragment.chunkIndex }}</n-tag>
                        <n-tag size="tiny" :type="fragment.isAssociated ? 'warning' : 'success'">
                          {{ fragment.isAssociated ? '已关联' : '未关联' }}
                        </n-tag>
                      </div>
                    </div>
                    <n-button text size="tiny" @click.stop="openPreviewDrawer(fragment)">
                      预览
                    </n-button>
                  </div>
                </div>
              </n-collapse-item>
            </n-collapse>
          </div>
        </n-spin>
      </div>
      
      <!-- 底部操作栏（编辑模式：应用 / 重置 / 清空） -->
      <div v-show="selectedFragments.length > 0 || isDirty" class="batch-bar">
        <div class="batch-info">
          <n-checkbox
            :indeterminate="isPartiallySelected"
            :checked="isAllSelected"
            @update:checked="toggleSelectAll"
          >
            已选 {{ selectedFragments.length }}/{{ filteredFragments.length }} 项
          </n-checkbox>
          <n-tag v-if="isDirty && changeSummary" type="warning" size="small" round style="margin-left: 8px;">
            {{ changeSummary }}
          </n-tag>
          <span v-if="isDirty" class="dirty-hint">有未保存的更改</span>
        </div>
        <div class="batch-actions">
          <n-button
            type="primary"
            size="small"
            :loading="associating"
            :disabled="!canApply"
            @click="handleApply"
          >
            应用{{ changeSummary ? ` (${changeSummary})` : '' }}
          </n-button>
          <n-button size="small" :disabled="!isDirty" @click="handleReset">重置</n-button>
          <n-button size="small" quaternary @click="clearAllSelection">清空</n-button>
          <n-button size="small" secondary @click="requestClose">关闭</n-button>
        </div>
      </div>
    </div>
    
    <!-- 已选详情模态框 -->
    <n-modal
      v-model:show="showSelectedDetailModal"
      preset="card"
      title="已选择的片段"
      :style="{ width: '600px', maxWidth: '90vw' }"
    >
      <n-input
        v-model:value="selectedDetailSearchKeyword"
        placeholder="搜索..."
        clearable
        size="small"
        style="margin-bottom: 12px;"
      />
      <n-scrollbar style="max-height: 400px">
        <n-space :size="8" wrap>
          <n-tag
            v-for="fragment in filteredSelectedFragments"
            :key="fragment.id"
            closable
            :type="fragment.isAssociated ? 'warning' : 'default'"
            @close="removeSelection(fragment)"
          >
            {{ getFragmentDisplayName(fragment) }}
          </n-tag>
        </n-space>
      </n-scrollbar>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSelectedDetailModal = false">关闭</n-button>
          <n-button type="error" @click="clearAllSelection">清空全部</n-button>
        </n-space>
      </template>
    </n-modal>
    
    <!-- 预览抽屉 -->
    <n-drawer
      v-model:show="showPreviewDrawer"
      :width="520"
      placement="right"
    >
      <n-drawer-content v-if="previewFragment" :title="previewFragment.docName || '片段详情'">
        <div class="preview-content">
          <n-descriptions :column="2" size="small" bordered>
            <n-descriptions-item label="索引">#{{ previewFragment.chunkIndex }}</n-descriptions-item>
            <n-descriptions-item label="状态">
              <n-tag :type="previewFragment.isAssociated ? 'warning' : 'success'">
                {{ previewFragment.isAssociated ? '已关联' : '未关联' }}
              </n-tag>
            </n-descriptions-item>
          </n-descriptions>
          <pre class="preview-text">{{ previewFragment.content }}</pre>
          <div class="preview-actions">
            <n-button
              v-show="!previewFragment.isAssociated"
              type="primary"
              @click="handleAssociateSingle(previewFragment)"
            >
              关联此片段
            </n-button>
            <n-button
              v-show="previewFragment.isAssociated"
              type="warning"
              @click="handleDisassociateSingle(previewFragment)"
            >
              取消关联
            </n-button>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, toRaw } from 'vue';
import {
  NModal, NInput, NButton, NTag, NSpace, NSpin, NEmpty,
  NCheckbox, NCheckboxGroup, NSelect, NPagination,
  NDrawer, NDrawerContent, NDescriptions, NDescriptionsItem,
  NScrollbar, NCollapse, NCollapseItem, useMessage, useDialog
} from 'naive-ui';
import { SvgIcon } from '@/components/common';
import { extractKeywords, highlightTextHtml, extractSnippetAroundKeyword } from '@/utils/searchHighlight';
import { listFragments, listFragmentsByItem, associateFragmentToItem, disassociateFragmentFromItem } from '@/api/v2/fragment';

export interface Fragment {
  id: string;
  content: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  createTime: string;
  isAssociated?: boolean;
  relevanceScore?: number;
}

interface Props {
  modelValue?: boolean;
  kid: string;
  itemUuid?: string;
  title?: string;
  initialSelectedIds?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  title: '选择并关联片段',
  initialSelectedIds: () => []
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [fragments: Fragment[]];
  'associate': [fragmentIds: string[]];
  'disassociate': [fragmentIds: string[]];
  'cancel': [];
}>();

const message = useMessage();
const dialogInst = useDialog();

const showModal = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const loading = ref(false);
const associating = ref(false);
const allFragments = ref<Fragment[]>([]);
const selectedFragments = ref<Fragment[]>([]);

const searchKeyword = ref('');
const filterStatuses = ref<string[]>(['all']);
const filterDocIds = ref<string[]>([]);

const sortField = ref<'relevance' | 'createTime' | 'docName' | 'chunkIndex'>('createTime');
const sortOrder = ref<'asc' | 'desc'>('desc');

const viewMode = ref<'list' | 'group-by-doc' | 'group-by-time'>('list');
const pagination = ref({ page: 1, pageSize: 20 });

const showSelectedDetailModal = ref(false);
const selectedDetailSearchKeyword = ref('');
const compactThreshold = 5;

const showPreviewDrawer = ref(false);
const previewFragment = ref<Fragment | null>(null);

/** 编辑模式：打开弹窗时的已关联 ID 快照（用于脏数据检测、重置） */
const initialSnapshotIds = ref<Set<string>>(new Set());

const baseSortOptions = [
  { label: '创建时间', value: 'createTime' },
  { label: '文档名称', value: 'docName' },
  { label: '索引编号', value: 'chunkIndex' }
];

const sortOptions = computed(() => {
  if (searchKeyword.value.trim()) {
    return [{ label: '相关程度', value: 'relevance' }, ...baseSortOptions];
  }
  return baseSortOptions;
});

const documentOptions = computed(() => {
  const docMap = new Map<string, string>();
  allFragments.value.forEach(f => {
    if (!docMap.has(f.docId)) {
      docMap.set(f.docId, f.docName || '未知文档');
    }
  });
  return Array.from(docMap.entries()).map(([id, name]) => ({ label: name, value: id }));
});

const statusCounts = computed(() => {
  const all = allFragments.value.length;
  const associated = allFragments.value.filter(f => f.isAssociated).length;
  return { all, associated, unassociated: all - associated };
});

const filteredFragments = computed(() => {
  console.log('[FragmentSelector] 开始筛选 - 状态筛选:', filterStatuses.value, '文档筛选:', filterDocIds.value, '搜索词:', searchKeyword.value);
  let result = [...allFragments.value];
  
  if (filterStatuses.value.length > 0 && !filterStatuses.value.includes('all')) {
    result = result.filter(f => {
      if (filterStatuses.value.includes('associated') && f.isAssociated) return true;
      if (filterStatuses.value.includes('unassociated') && !f.isAssociated) return true;
      return false;
    });
    console.log('[FragmentSelector] 状态筛选后数量:', result.length);
  }
  
  if (filterDocIds.value.length > 0) {
    result = result.filter(f => filterDocIds.value.includes(f.docId));
    console.log('[FragmentSelector] 文档筛选后数量:', result.length);
  }
  
  if (searchKeyword.value.trim()) {
    const keywords = extractKeywords(searchKeyword.value.toLowerCase());
    result = result.filter(f => {
      const content = (f.content || '').toLowerCase();
      const docName = (f.docName || '').toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (content.includes(kw)) score += 10;
        if (docName.includes(kw)) score += 5;
      }
      f.relevanceScore = score;
      return score > 0;
    });
    console.log('[FragmentSelector] 搜索筛选后数量:', result.length);
  }
  
  result.sort((a, b) => {
    let comparison = 0;
    switch (sortField.value) {
      case 'relevance': comparison = (b.relevanceScore || 0) - (a.relevanceScore || 0); break;
      case 'createTime': comparison = new Date(a.createTime).getTime() - new Date(b.createTime).getTime(); break;
      case 'docName': comparison = (a.docName || '').localeCompare(b.docName || '', 'zh-CN'); break;
      case 'chunkIndex': comparison = a.chunkIndex - b.chunkIndex; break;
    }
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
  
  return result;
});

const displayFragments = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.pageSize;
  return filteredFragments.value.slice(start, start + pagination.value.pageSize);
});

const totalPages = computed(() => Math.ceil(filteredFragments.value.length / pagination.value.pageSize));

const isAllSelected = computed(() => {
  if (filteredFragments.value.length === 0) return false;
  return filteredFragments.value.every(f => selectedFragments.value.some(sf => sf.id === f.id));
});

const isPartiallySelected = computed(() => {
  if (filteredFragments.value.length === 0) return false;
  const count = filteredFragments.value.filter(f => selectedFragments.value.some(sf => sf.id === f.id)).length;
  return count > 0 && count < filteredFragments.value.length;
});

const unassociatedSelectedCount = computed(() => selectedFragments.value.filter(f => !f.isAssociated).length);

/** 编辑模式：当前选中的 ID 集合 */
const currentSelectedIds = computed(() => new Set(selectedFragments.value.map(f => f.id)));

/** 编辑模式：待关联（选中但初始未关联） */
const toAddIds = computed(() =>
  selectedFragments.value.filter(f => !initialSnapshotIds.value.has(f.id)).map(f => f.id)
);

/** 编辑模式：待解除（初始已关联但当前未选中） */
const toRemoveIds = computed(() => {
  const selected = currentSelectedIds.value;
  return Array.from(initialSnapshotIds.value).filter(id => !selected.has(id));
});

/** 编辑模式：是否有未保存的变更 */
const isDirty = computed(() => toAddIds.value.length > 0 || toRemoveIds.value.length > 0);

/** 编辑模式：是否可以应用（有变更且非加载中） */
const canApply = computed(() => isDirty.value && !associating.value);

/** 编辑模式：变更摘要文案，如 "+2 -1" 或 "关联 2 个，解除 1 个" */
const changeSummary = computed(() => {
  const add = toAddIds.value.length;
  const remove = toRemoveIds.value.length;
  if (add === 0 && remove === 0) return '';
  const parts: string[] = [];
  if (add > 0) parts.push(`+${add}`);
  if (remove > 0) parts.push(`-${remove}`);
  return parts.join(' ');
});

const visibleSelectedFragments = computed(() => selectedFragments.value.slice(0, compactThreshold));

const filteredSelectedFragments = computed(() => {
  if (!selectedDetailSearchKeyword.value.trim()) return selectedFragments.value;
  const kw = selectedDetailSearchKeyword.value.toLowerCase();
  return selectedFragments.value.filter(f => 
    f.content?.toLowerCase().includes(kw) || f.docName?.toLowerCase().includes(kw)
  );
});

const showListEmpty = computed(() => !loading.value && displayFragments.value.length === 0);
const showGroupEmpty = computed(() => !loading.value && displayFragments.value.length === 0);
const showPagination = computed(() => viewMode.value === 'list' && totalPages.value > 1);

// ========== 分组视图 computed ==========

interface FragmentGroup {
  key: string;
  name: string;
  fragments: Fragment[];
}

// 按文档分组
const groupedByDoc = computed((): FragmentGroup[] => {
  const groups = new Map<string, Fragment[]>();
  filteredFragments.value.forEach(f => {
    const key = f.docId || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  });
  return Array.from(groups.entries()).map(([key, fragments]) => ({
    key,
    name: fragments[0]?.docName || '未知文档',
    fragments: fragments.sort((a, b) => a.chunkIndex - b.chunkIndex)
  })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
});

// 按时间分组（今天/昨天/本周/本月/更早）
const groupedByTime = computed((): FragmentGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = today - 30 * 24 * 60 * 60 * 1000;
  
  const groups: Record<string, Fragment[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: []
  };
  
  filteredFragments.value.forEach(f => {
    const time = new Date(f.createTime).getTime();
    if (time >= today) groups.today.push(f);
    else if (time >= yesterday) groups.yesterday.push(f);
    else if (time >= weekAgo) groups.thisWeek.push(f);
    else if (time >= monthAgo) groups.thisMonth.push(f);
    else groups.older.push(f);
  });
  
  const result: FragmentGroup[] = [];
  if (groups.today.length) result.push({ key: 'today', name: '今天', fragments: groups.today });
  if (groups.yesterday.length) result.push({ key: 'yesterday', name: '昨天', fragments: groups.yesterday });
  if (groups.thisWeek.length) result.push({ key: 'thisWeek', name: '本周', fragments: groups.thisWeek });
  if (groups.thisMonth.length) result.push({ key: 'thisMonth', name: '本月', fragments: groups.thisMonth });
  if (groups.older.length) result.push({ key: 'older', name: '更早', fragments: groups.older });
  return result;
});

// 分组展开状态（默认展开所有）
const docGroupExpandedNames = computed(() => groupedByDoc.value.map(g => g.key));
const timeGroupExpandedNames = computed(() => groupedByTime.value.map(g => g.key));

// 分组选择相关方法
function isGroupAllSelected(group: FragmentGroup): boolean {
  if (group.fragments.length === 0) return false;
  return group.fragments.every(f => selectedFragments.value.some(sf => sf.id === f.id));
}

function isGroupPartiallySelected(group: FragmentGroup): boolean {
  const count = group.fragments.filter(f => selectedFragments.value.some(sf => sf.id === f.id)).length;
  return count > 0 && count < group.fragments.length;
}

function getGroupSelectedCount(group: FragmentGroup): number {
  return group.fragments.filter(f => selectedFragments.value.some(sf => sf.id === f.id)).length;
}

function toggleGroupSelection(group: FragmentGroup, checked: boolean) {
  if (checked) {
    const newSel = group.fragments.filter(f => !selectedFragments.value.some(sf => sf.id === f.id));
    selectedFragments.value.push(...newSel);
  } else {
    const ids = new Set(group.fragments.map(f => f.id));
    selectedFragments.value = selectedFragments.value.filter(f => !ids.has(f.id));
  }
}

async function loadFragments() {
  loading.value = true;
  console.log('[FragmentSelector] 开始加载片段数据...', { kid: props.kid, itemUuid: props.itemUuid });
  try {
    // 并行加载：1) 所有片段 2) 当前条目已关联的片段
    const [allRes, associatedRes] = await Promise.all([
      listFragments({ kid: props.kid, pageSize: 1000 }),
      props.itemUuid ? listFragmentsByItem(props.itemUuid, props.kid, { pageSize: 1000 }) : Promise.resolve({ data: { rows: [] } })
    ]);
    
    console.log('[FragmentSelector] listFragments 返回:', allRes);
    console.log('[FragmentSelector] listFragmentsByItem 返回:', associatedRes);
    
    // 解析所有片段 - listFragments 直接返回 TableDataInfo，包含 rows 字段
    const allRows = (allRes as any)?.rows ?? [];
    console.log('[FragmentSelector] 解析后的所有片段数量:', allRows.length);
    if (allRows.length > 0) {
      console.log('[FragmentSelector] 第一条片段数据:', allRows[0]);
    }
    
    // 解析已关联片段ID集合 - listFragmentsByItem 返回 R<...>，数据在 data.rows 中
    const assocRes = associatedRes as any;
    const associatedRows = assocRes?.data?.rows ?? [];
    console.log('[FragmentSelector] 解析后的已关联片段数量:', associatedRows.length);
    
    const associatedIds = new Set(associatedRows.map((row: any) => String(row.id)));
    console.log('[FragmentSelector] 已关联片段ID集合:', Array.from(associatedIds));
    
    allFragments.value = allRows.map((row: any) => ({
      id: String(row.id || row.fragmentId),
      content: row.content || '',
      docId: String(row.docId || row.documentId || ''),
      docName: row.docName || row.documentName || '未知文档',
      chunkIndex: row.idx ?? row.chunkIndex ?? 0,
      createTime: row.createTime || new Date().toISOString(),
      isAssociated: associatedIds.has(String(row.id || row.fragmentId))
    }));
    
    console.log('[FragmentSelector] 处理后的片段数据:', {
      total: allFragments.value.length,
      associated: allFragments.value.filter(f => f.isAssociated).length,
      unassociated: allFragments.value.filter(f => !f.isAssociated).length
    });
    
    // 编辑模式：初始快照 = 当前已关联的 ID（复用上方 associatedIds）
    initialSnapshotIds.value = associatedIds;
    
    // 初始选中：优先用 initialSelectedIds，否则（编辑条目时）用已关联的
    if (props.initialSelectedIds?.length > 0) {
      selectedFragments.value = allFragments.value.filter(f => props.initialSelectedIds!.includes(f.id));
    } else if (props.itemUuid) {
      selectedFragments.value = allFragments.value.filter(f => f.isAssociated);
    } else {
      selectedFragments.value = [];
    }
    console.log('[FragmentSelector] 初始选中片段数量:', selectedFragments.value.length, '快照:', Array.from(initialSnapshotIds.value));
  } catch (e: any) {
    message.error('加载失败: ' + (e?.message || '未知错误'));
    console.error('[FragmentSelector] 加载片段失败:', e);
  } finally {
    loading.value = false;
  }
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function handleSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    pagination.value.page = 1;
  }, 300);
}

function handleSortFieldChange(value: any) {
  sortField.value = value;
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
}

function handleFilterChange() {
  pagination.value.page = 1;
}

function handlePageChange(page: number) {
  pagination.value.page = page;
}

function handlePageSizeChange(size: number) {
  pagination.value.pageSize = size;
  pagination.value.page = 1;
}

function isSelected(fragment: Fragment): boolean {
  return selectedFragments.value.some(f => f.id === fragment.id);
}

function toggleSelection(fragment: Fragment) {
  const index = selectedFragments.value.findIndex(f => f.id === fragment.id);
  if (index >= 0) {
    selectedFragments.value.splice(index, 1);
    console.log('[FragmentSelector] 取消选择片段:', fragment.id);
  } else {
    selectedFragments.value.push(fragment);
    console.log('[FragmentSelector] 选择片段:', fragment.id, fragment.docName, fragment.chunkIndex);
  }
}

function removeSelection(fragment: Fragment) {
  const index = selectedFragments.value.findIndex(f => f.id === fragment.id);
  if (index >= 0) {
    selectedFragments.value.splice(index, 1);
    console.log('[FragmentSelector] 移除已选片段:', fragment.id);
  }
}

function clearAllSelection() {
  selectedFragments.value = [];
}

function toggleSelectAll(checked: boolean) {
  if (checked) {
    const newSel = filteredFragments.value.filter(f => !selectedFragments.value.some(sf => sf.id === f.id));
    selectedFragments.value.push(...newSel);
  } else {
    const ids = new Set(filteredFragments.value.map(f => f.id));
    selectedFragments.value = selectedFragments.value.filter(f => !ids.has(f.id));
  }
}

function openPreviewDrawer(fragment: Fragment) {
  previewFragment.value = fragment;
  showPreviewDrawer.value = true;
}

/** 编辑模式：重置勾选为初始快照状态 */
function handleReset() {
  if (!isDirty.value) return;
  dialogInst.warning({
    title: '确认重置',
    content: '确定要放弃所有未保存的更改吗？',
    positiveText: '确定重置',
    negativeText: '取消',
    onPositiveClick: () => {
      selectedFragments.value = allFragments.value.filter(f => initialSnapshotIds.value.has(f.id));
      message.info('已重置为打开时的关联状态');
    },
  });
}

/** 编辑模式：应用变更（关联新增 + 解除移除） */
async function handleApply() {
  if (associating.value || !canApply.value) return;
  if (!props.itemUuid) {
    message.warning('未指定条目，无法应用');
    return;
  }

  const toAdd = toAddIds.value.filter(id => !!id);
  const toRemove = toRemoveIds.value.filter(id => !!id);

  console.log('[FragmentSelector] ====== 应用变更 ======');
  console.log('[FragmentSelector] 待关联:', toAdd);
  console.log('[FragmentSelector] 待解除:', toRemove);

  if (toAdd.length === 0 && toRemove.length === 0) {
    message.info('没有需要应用的变更');
    return;
  }

  associating.value = true;
  try {
    const assocResults: { id: string; status: string }[] = [];
    const disassocResults: { id: string; status: string }[] = [];

    // 1. 先执行解除关联
    if (toRemove.length > 0) {
      const disPromises = toRemove.map(id =>
        disassociateFragmentFromItem(id, props.itemUuid!)
          .then(() => ({ id, status: 'success' }))
          .catch((e: any) => ({ id, status: 'error', error: e?.message || String(e) }))
      );
      const dr = await Promise.all(disPromises);
      disassocResults.push(...dr);
    }

    // 2. 再执行关联
    if (toAdd.length > 0) {
      const addPromises = toAdd.map(id =>
        associateFragmentToItem(id, props.itemUuid!)
          .then(() => ({ id, status: 'success' }))
          .catch((e: any) => ({ id, status: 'error', error: e?.message || String(e) }))
      );
      const ar = await Promise.all(addPromises);
      assocResults.push(...ar);
    }

    const assocSuccess = assocResults.filter(r => r.status === 'success').map(r => r.id);
    const assocFailed = assocResults.filter(r => r.status === 'error');
    const disassocSuccess = disassocResults.filter(r => r.status === 'success').map(r => r.id);
    const disassocFailed = disassocResults.filter(r => r.status === 'error');

    // 更新本地状态
    disassocSuccess.forEach(id => {
      const f = allFragments.value.find(x => x.id === id);
      if (f) f.isAssociated = false;
    });
    assocSuccess.forEach(id => {
      const f = allFragments.value.find(x => x.id === id);
      if (f) f.isAssociated = true;
    });
    // 同步 selectedFragments 中的 isAssociated
    selectedFragments.value.forEach(f => {
      if (disassocSuccess.includes(f.id)) f.isAssociated = false;
      if (assocSuccess.includes(f.id)) f.isAssociated = true;
    });

    // 更新快照为当前最终状态
    const newSnapshot = new Set(selectedFragments.value.filter(f => f.isAssociated).map(f => f.id));
    initialSnapshotIds.value = newSnapshot;

    if (assocSuccess.length > 0) emit('associate', assocSuccess);
    if (disassocSuccess.length > 0) emit('disassociate', disassocSuccess);

    const totalFailed = assocFailed.length + disassocFailed.length;
    if (totalFailed === 0) {
      const parts: string[] = [];
      if (assocSuccess.length > 0) parts.push(`关联 ${assocSuccess.length} 个`);
      if (disassocSuccess.length > 0) parts.push(`解除 ${disassocSuccess.length} 个`);
      message.success('变更已应用：' + parts.join('，'));
      showModal.value = false;
    } else {
      message.warning(`${totalFailed} 个操作失败，请重试`);
    }
  } catch (e: any) {
    message.error('应用失败: ' + (e?.message || '未知错误'));
  } finally {
    associating.value = false;
  }
}

async function handleAssociateSingle(fragment: Fragment) {
  console.log('[FragmentSelector] ====== 单条关联开始 ======');
  console.log('[FragmentSelector] 条目UUID:', props.itemUuid);
  console.log('[FragmentSelector] 片段信息:', { id: fragment.id, name: fragment.docName + '#' + fragment.chunkIndex, isAssociated: fragment.isAssociated });
  
  try {
    if (!fragment.id) throw new Error('无效的片段ID');
    
    console.log(`[FragmentSelector] 发送关联请求: fragmentId=${fragment.id}, itemUuid=${props.itemUuid}`);
    const result = await associateFragmentToItem(fragment.id, props.itemUuid!);
    
    console.log('[FragmentSelector] 关联请求成功:', result);
    fragment.isAssociated = true;
    
    // 同时更新 selectedFragments 中的对应项
    const selectedItem = selectedFragments.value.find(f => f.id === fragment.id);
    if (selectedItem) {
      console.log('[FragmentSelector] 同步更新 selectedFragments 中的状态');
      selectedItem.isAssociated = true;
    }
    
    message.success('关联成功');
    console.log('[FragmentSelector] ====== 单条关联结束 ======');
  } catch (e: any) {
    console.error('[FragmentSelector] 单条关联失败:', e);
    message.error('关联失败: ' + (e?.message || '未知错误'));
  }
}

async function handleDisassociateSingle(fragment: Fragment) {
  try {
    if (!fragment.id) throw new Error('无效的片段ID');
    await disassociateFragmentFromItem(fragment.id, props.itemUuid!);
    fragment.isAssociated = false;
    message.success('已取消关联');
  } catch (e: any) {
    message.error('取消关联失败: ' + (e?.message || '未知错误'));
  }
}

/** 获取展示文本：有搜索词时以关键词为中心截取（三个点机制），否则截取前 N 字 */
function getPreviewText(content: string, maxLen: number): string {
  if (!content) return '';
  const kws = extractKeywords(searchKeyword.value.trim());
  if (content.length <= maxLen) return content;
  return kws.length
    ? extractSnippetAroundKeyword(content, kws, maxLen)
    : (content.substring(0, maxLen) + '…');
}

/** 高亮并截取展示：有搜索词时以关键词为中心截取 + 高亮，否则截取前 N 字 */
function highlightContent(content: string, keyword: string): string {
  const maxLen = 200;
  const preview = getPreviewText(content || '', maxLen);
  if (!keyword.trim()) return escapeHtml(preview);
  return highlightTextHtml(preview, extractKeywords(keyword));
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    return new Date(timeStr).toLocaleString('zh-CN', { month: 'short', day: 'numeric' });
  } catch { return timeStr; }
}

function getFragmentDisplayName(fragment: Fragment): string {
  return `${fragment.docName} #${fragment.chunkIndex}`;
}

/** 请求关闭弹窗（含脏数据确认） */
function requestClose() {
  if (isDirty.value) {
    dialogInst.warning({
      title: '未保存的更改',
      content: '关联状态已修改但尚未应用，确定要关闭吗？',
      positiveText: '放弃更改',
      negativeText: '继续编辑',
      onPositiveClick: () => {
        emit('update:modelValue', false);
        emit('cancel');
        document.removeEventListener('keydown', handleKeydown);
      },
    });
  } else {
    emit('update:modelValue', false);
    emit('cancel');
    document.removeEventListener('keydown', handleKeydown);
  }
}

function handleModalShowChange(show: boolean) {
  console.log('[FragmentSelector] ====== 弹窗状态变更 ======');
  console.log('[FragmentSelector] 显示状态:', show);
  console.log('[FragmentSelector] 当前条目UUID:', props.itemUuid);
  console.log('[FragmentSelector] 知识库ID:', props.kid);
  
  if (show) {
    console.log('[FragmentSelector] 弹窗打开，初始化状态并加载数据...');
    loadFragments();
    selectedFragments.value = [];
    searchKeyword.value = '';
    filterStatuses.value = ['all'];
    filterDocIds.value = [];
    sortField.value = 'createTime';
    sortOrder.value = 'desc';
    pagination.value.page = 1;
    viewMode.value = 'list';
    nextTick(() => document.addEventListener('keydown', handleKeydown));
  } else {
    console.log('[FragmentSelector] 用户请求关闭');
    requestClose();
  }
  console.log('[FragmentSelector] ====== 弹窗状态变更结束 ======');
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    requestClose();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    if (document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      toggleSelectAll(true);
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    // emit select on ctrl+enter
  }
}

watch(() => props.modelValue, (show) => {
  if (show) nextTick(() => loadFragments());
});
</script>

<style scoped lang="scss">
.fragment-selector {
  display: flex;
  flex-direction: column;
  height: 70vh;
  max-height: 800px;
}

.selector-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  flex-shrink: 0;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  flex: 1;
  max-width: 500px;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-summary {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e8e8e8;
  margin-top: 12px;
}

.selected-count-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.count-text {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #666;
}

.selected-tags-container {
  max-height: 80px;
  overflow-y: auto;
}

.more-tag {
  cursor: pointer;
  background: #f0f0f0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #d9d9d9;
}

.view-mode-tabs {
  padding: 12px 20px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.selector-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

/* ========== 分组视图样式 ========== */
.group-view {
  :deep(.n-collapse) {
    .n-collapse-item {
      margin-bottom: 8px;
      
      .n-collapse-item__header {
        padding: 12px 16px;
        background: #fafafa;
        border-radius: 8px;
        border: 1px solid #e8e8e8;
        
        &:hover {
          background: #f0f0f0;
        }
      }
      
      .n-collapse-item__content-wrapper {
        .n-collapse-item__content {
          padding: 8px 0 0 0;
        }
      }
    }
  }
}

.group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.group-title-text {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.group-fragments {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-fragment-item {
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #fff;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #1890ff;
    background: #f6fffe;
  }
  
  &.is-selected {
    border-color: #1890ff;
    background: #e6f7ff;
  }
}

.group-fragment-content {
  flex: 1;
  min-width: 0;
}

.fragment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  align-items: center;
}

.fragment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fragment-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #1890ff;
  }
  
  &.is-selected {
    border-color: #1890ff;
    background: #e6f7ff;
  }
  
  &.is-associated {
    border-left: 3px solid #faad14;
  }
}

.item-selector {
  flex-shrink: 0;
  padding-top: 2px;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.content-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  margin-bottom: 8px;

  :deep(.search-hl) {
    background: linear-gradient(120deg, rgba(255, 235, 59, 0.35) 0%, rgba(255, 235, 59, 0.55) 100%);
    padding: 0 1px;
    border-radius: 2px;
  }
}

.fragment-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #333;

  :deep(.search-hl) {
    background: linear-gradient(120deg, rgba(255, 235, 59, 0.35) 0%, rgba(255, 235, 59, 0.55) 100%);
    padding: 0 1px;
    border-radius: 2px;
  }
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-time {
  font-size: 12px;
  color: #999;
}

.item-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.fragment-item:hover .item-actions {
  opacity: 1;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
}

.batch-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.batch-info {
  font-size: 14px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dirty-hint {
  font-size: 12px;
  color: #fa8c16;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  background: #fafafa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  max-height: 400px;
  overflow-y: auto;
}

.preview-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e8e8e8;
}
</style>
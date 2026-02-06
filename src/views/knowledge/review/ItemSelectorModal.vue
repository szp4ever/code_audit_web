<template>
	<n-modal
		v-model:show="showModal"
		preset="card"
		title="选择知识条目归属"
		:mask-closable="true"
		:close-on-esc="true"
		style="width: 1200px; max-width: 95vw;"
		:show-footer="true"
		class="item-selector-modal"
	>
		<template #header-extra>
			<n-radio-group v-model:value="selectionMode" size="small">
				<n-radio-button value="create_new">创建新条目</n-radio-button>
				<n-radio-button value="select_existing">选择已有条目</n-radio-button>
			</n-radio-group>
		</template>

		<div class="modal-content-wrapper">
			<!-- 左侧主内容区 -->
			<div class="modal-main-content">
				<!-- 创建新条目模式 -->
				<div v-if="selectionMode === 'create_new'" class="create-new-mode">
					<n-space vertical :size="16">
						<n-alert type="info">
							<template #header>创建新知识条目</template>
							选择此选项将为当前片段创建一个新的知识条目。新条目将在该文档的审阅被确认后由LLM自动创建。
						</n-alert>
					</n-space>
				</div>

				<!-- 选择已有条目模式 -->
				<div v-else class="select-existing-mode">
			<!-- 搜索栏 -->
			<div class="search-bar">
				<n-space :size="12" align="center">
					<n-input
						v-model:value="searchKeyword"
						placeholder="搜索标题、摘要、问题描述..."
						clearable
						style="flex: 1; max-width: 500px;"
						@update:value="handleSearch"
					>
						<template #prefix>
							<SvgIcon :icon="isSearching ? 'ri:loader-4-line' : 'ri:search-line'" :class="{ 'search-loading': isSearching }" />
						</template>
					</n-input>
					<n-button @click="showFilterPanel = !showFilterPanel" quaternary size="small">
						<template #icon>
							<SvgIcon :icon="showFilterPanel ? 'ri:filter-3-fill' : 'ri:filter-3-line'" />
						</template>
						筛选
					</n-button>
					<n-select
						v-model:value="sortBy"
						:options="sortOptions"
						:placeholder="getSortPlaceholder()"
						style="width: 180px"
						size="small"
						@update:value="handleSortChange"
					/>
					<n-popover trigger="hover" placement="bottom">
						<template #trigger>
							<n-button
								@click="toggleSortOrder"
								quaternary
								size="small"
								:aria-label="`切换排序方向，当前为${sortOrder === 'asc' ? '升序' : '降序'}`"
							>
								<template #icon>
									<SvgIcon :icon="sortOrder === 'asc' ? 'ri:arrow-up-line' : 'ri:arrow-down-line'" />
								</template>
							</n-button>
						</template>
						<div style="padding: 4px 0;">
							<div style="font-weight: 500; margin-bottom: 4px;">当前排序方向</div>
							<div style="color: var(--n-text-color-2); font-size: 12px;">
								{{ sortOrder === 'asc' ? '升序 ↑' : '降序 ↓' }}
							</div>
						</div>
					</n-popover>
				</n-space>
			</div>

			<!-- 筛选面板 -->
			<div v-if="showFilterPanel" class="filter-panel">
				<n-tabs v-model:value="activeFilterTab" type="line" size="small">
					<!-- 风险等级 -->
					<n-tab-pane name="severity" :tab="`风险等级${filterSeverities.length > 0 ? ` (${filterSeverities.length})` : ''}`" v-if="availableSeverityOptions.length > 0">
						<div class="filter-tab-content">
							<div style="padding-bottom: 8px; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
								<n-checkbox 
									:checked="severitySelectAllState === true"
									:indeterminate="severitySelectAllState === null"
									@update:checked="toggleSeveritySelectAll"
									size="small"
								>
									<span style="font-weight: 500; color: #262626;">全选</span>
								</n-checkbox>
							</div>
							<n-checkbox-group v-model:value="filterSeverities" @update:value="() => { if (!fetchItemsLock) { pagination.page = 1; fetchItems(); } }">
								<n-space :size="8" wrap>
									<n-checkbox
										v-for="option in availableSeverityOptions"
										:key="option.value"
										:value="option.value"
										size="small"
									>
										<span class="facet-option-label">{{ option.label }}</span>
										<span class="facet-option-count">{{ facetStats?.severities?.[option.value] || 0 }}</span>
									</n-checkbox>
								</n-space>
							</n-checkbox-group>
						</div>
					</n-tab-pane>

					<!-- 语言 -->
					<n-tab-pane name="language" :tab="`语言${filterLanguages.length > 0 ? ` (${filterLanguages.length})` : ''}`" v-if="availableLanguageOptions.length > 0">
						<div class="filter-tab-content">
							<div style="padding-bottom: 8px; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
								<n-checkbox 
									:checked="languageSelectAllState === true"
									:indeterminate="languageSelectAllState === null"
									@update:checked="toggleLanguageSelectAll"
									size="small"
								>
									<span style="font-weight: 500; color: #262626;">全选</span>
								</n-checkbox>
							</div>
							<n-checkbox-group v-model:value="filterLanguages" @update:value="() => { if (!fetchItemsLock) { pagination.page = 1; fetchItems(); } }">
								<n-space :size="8" wrap>
									<n-checkbox
										v-for="option in availableLanguageOptions"
										:key="option.value"
										:value="option.value"
										size="small"
									>
										<span class="facet-option-label">{{ option.label }}</span>
										<span class="facet-option-count">{{ facetStats?.languages?.[option.value] || 0 }}</span>
									</n-checkbox>
								</n-space>
							</n-checkbox-group>
						</div>
					</n-tab-pane>

					<!-- 状态 -->
					<n-tab-pane name="status" :tab="`状态${filterStatuses.length > 0 ? ` (${filterStatuses.length})` : ''}`" v-if="availableStatusOptions.length > 0">
						<div class="filter-tab-content">
							<div style="padding-bottom: 8px; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
								<n-checkbox 
									:checked="statusSelectAllState === true"
									:indeterminate="statusSelectAllState === null"
									@update:checked="toggleStatusSelectAll"
									size="small"
								>
									<span style="font-weight: 500; color: #262626;">全选</span>
								</n-checkbox>
							</div>
							<n-checkbox-group v-model:value="filterStatuses" @update:value="() => { if (!fetchItemsLock) { pagination.page = 1; fetchItems(); } }">
								<n-space :size="8" wrap>
									<n-checkbox
										v-for="option in availableStatusOptions"
										:key="option.value"
										:value="option.value"
										size="small"
									>
										<span class="facet-option-label">{{ option.label }}</span>
										<span class="facet-option-count">{{ facetStats?.statuses?.[option.value] || 0 }}</span>
									</n-checkbox>
								</n-space>
							</n-checkbox-group>
						</div>
					</n-tab-pane>

					<!-- 漏洞类型 -->
					<n-tab-pane name="vulnerabilityType" :tab="`漏洞类型${filterVulnerabilityTypes.length > 0 ? ` (${filterVulnerabilityTypes.length})` : ''}`" v-if="Object.keys(facetStats?.vulnerabilityTypes || {}).length > 0">
						<div class="filter-tab-content">
							<div class="facet-group-toolbar">
								<n-input 
									v-model:value="facetSearchKeywords.vulnerabilityType" 
									placeholder="搜索漏洞类型..." 
									size="small" 
									clearable
								>
									<template #prefix>
										<SvgIcon icon="ri:search-line" />
									</template>
								</n-input>
								<n-space v-if="groupedByClusters.length > 0" :size="6" justify="space-between" style="margin-top: 8px;">
									<n-button 
										text 
										size="tiny"
										@click="expandedVulnClusters = groupedByClusters.map(c => `${c.clusterId}-${c.clusterMethod}`)"
									>
										<template #icon>
											<SvgIcon icon="ri:arrow-down-s-line" />
										</template>
										全部展开
									</n-button>
									<n-button 
										text 
										size="tiny"
										@click="expandedVulnClusters = []"
									>
										<template #icon>
											<SvgIcon icon="ri:arrow-up-s-line" />
										</template>
										全部收起
									</n-button>
								</n-space>
							</div>
							<div style="padding: 8px 0; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
								<n-checkbox 
									:checked="vulnerabilityTypeSelectAllState === true"
									:indeterminate="vulnerabilityTypeSelectAllState === null"
									@update:checked="toggleVulnerabilityTypeSelectAll"
									size="small"
								>
									<span style="font-weight: 500; color: #262626;">全选</span>
								</n-checkbox>
							</div>
							<div class="facet-group-content">
								<div v-if="groupedByClusters.length > 0" class="vuln-type-by-cluster">
									<n-collapse v-model:expanded-names="expandedVulnClusters">
										<n-collapse-item
											v-for="cluster in groupedByClusters"
											:key="`${cluster.clusterId}-${cluster.clusterMethod}`"
											:name="`${cluster.clusterId}-${cluster.clusterMethod}`"
										>
											<template #header>
												<div class="cluster-header">
													<n-checkbox
														:checked="getClusterCheckState(cluster).checked"
														:indeterminate="getClusterCheckState(cluster).indeterminate"
														size="small"
														@click.stop="toggleClusterSelectAll(cluster)"
													/>
													<span class="cluster-name">{{ cluster.clusterNameZh || cluster.clusterNameEn || '未命名分组' }}</span>
													<n-tag size="tiny" :bordered="false" style="padding: 0 6px; font-size: 11px;">{{ getClusterDisplayCount(cluster) }}</n-tag>
												</div>
											</template>
											<n-checkbox-group v-model:value="filterVulnerabilityTypes" @update:value="() => { if (!fetchItemsLock) { pagination.page = 1; fetchItems(); } }">
												<n-space :size="4" wrap style="padding: 2px 0;">
													<n-checkbox
														v-for="type in cluster.cwes"
														:key="type"
														:value="type"
														size="small"
													>
														<span class="facet-option-label" style="font-size: 12px;">{{ getCweDisplayName(type) }}</span>
														<span class="facet-option-count" style="font-size: 11px;">{{ facetStats?.vulnerabilityTypes?.[type] || 0 }}</span>
													</n-checkbox>
												</n-space>
											</n-checkbox-group>
										</n-collapse-item>
									</n-collapse>
								</div>
								<div v-else>
									<n-checkbox-group v-model:value="filterVulnerabilityTypes" @update:value="() => { if (!fetchItemsLock) { pagination.page = 1; fetchItems(); } }">
										<n-space :size="8" wrap>
											<n-checkbox
												v-for="cweId in Object.keys(facetStats?.vulnerabilityTypes || {}).filter(cweId => {
													if (!facetSearchKeywords.vulnerabilityType.trim()) return true
													const keyword = facetSearchKeywords.vulnerabilityType.toLowerCase()
													const displayName = getCweDisplayName(cweId).toLowerCase()
													return displayName.includes(keyword)
												})"
												:key="cweId"
												:value="cweId"
												size="small"
											>
												<span class="facet-option-label">{{ getCweDisplayName(cweId) }}</span>
												<span class="facet-option-count">{{ facetStats?.vulnerabilityTypes?.[cweId] || 0 }}</span>
											</n-checkbox>
										</n-space>
									</n-checkbox-group>
								</div>
							</div>
						</div>
					</n-tab-pane>

					<!-- 标签 -->
					<n-tab-pane name="tag" :tab="`标签${filterTags.length > 0 ? ` (${filterTags.length})` : ''}`" v-if="systemTags.length > 0 || userTags.length > 0">
						<div class="filter-tab-content">
							<div class="facet-group-toolbar">
								<n-input 
									v-model:value="facetSearchKeywords.tag" 
									placeholder="搜索标签..." 
									size="small" 
									clearable
								>
									<template #prefix>
										<SvgIcon icon="ri:search-line" />
									</template>
								</n-input>
							</div>
							<div style="padding: 8px 0; border-bottom: 1px solid #F0F0F0; margin-bottom: 8px;">
								<n-checkbox 
									:checked="tagSelectAllState === true"
									:indeterminate="tagSelectAllState === null"
									@update:checked="toggleTagSelectAll"
									size="small"
								>
									<span style="font-weight: 500; color: #262626;">全选</span>
								</n-checkbox>
							</div>
							<div class="facet-group-content">
								<n-checkbox-group v-model:value="filterTags" @update:value="() => { if (!fetchItemsLock) { pagination.page = 1; fetchItems(); } }">
									<div v-if="filteredSystemTags.length > 0" style="margin-bottom: 12px;">
										<div class="tag-group-title">
											<SvgIcon icon="ri:shield-check-line" style="color: #52C41A; margin-right: 4px;" />
											预设标签
										</div>
										<n-space :size="8" wrap style="margin-top: 6px;">
											<n-checkbox
												v-for="tag in displayedSystemTags"
												:key="tag.name"
												:value="tag.name"
												size="small"
											>
												<span class="facet-option-label">{{ tag.name }}</span>
												<span class="facet-option-count">{{ facetStats?.tags?.[tag.name] || 0 }}</span>
											</n-checkbox>
										</n-space>
										<n-button 
											v-if="filteredSystemTags.length > 6"
											text 
											size="small" 
											@click="facetShowAll.systemTag = !facetShowAll.systemTag"
											style="margin-top: 6px; width: 100%;"
										>
											{{ facetShowAll.systemTag ? '收起' : `显示更多 (${filteredSystemTags.length - 6})` }}
											<template #icon>
												<SvgIcon :icon="facetShowAll.systemTag ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" />
											</template>
										</n-button>
									</div>
									<div v-if="filteredUserTags.length > 0">
										<div class="tag-group-title">
											<SvgIcon icon="ri:user-line" style="color: #52C41A; margin-right: 4px;" />
											自定义标签
										</div>
										<n-space :size="8" wrap style="margin-top: 6px;">
											<n-checkbox
												v-for="tag in displayedUserTags"
												:key="tag.name"
												:value="tag.name"
												size="small"
											>
												<span class="facet-option-label">{{ tag.name }}</span>
												<span class="facet-option-count">{{ facetStats?.tags?.[tag.name] || 0 }}</span>
											</n-checkbox>
										</n-space>
										<n-button 
											v-if="filteredUserTags.length > 6"
											text 
											size="small" 
											@click="facetShowAll.userTag = !facetShowAll.userTag"
											style="margin-top: 6px; width: 100%;"
										>
											{{ facetShowAll.userTag ? '收起' : `显示更多 (${filteredUserTags.length - 6})` }}
											<template #icon>
												<SvgIcon :icon="facetShowAll.userTag ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" />
											</template>
										</n-button>
									</div>
								</n-checkbox-group>
							</div>
						</div>
					</n-tab-pane>
				</n-tabs>

				<!-- 清除筛选 -->
				<div v-if="hasActiveFilters" class="filter-actions">
					<n-button @click="clearFilters" quaternary size="small" style="width: 100%;">
						清除所有筛选
					</n-button>
				</div>
			</div>

			<!-- 条目列表 -->
			<div class="item-list-container">
				<n-spin :show="loading">
					<n-list v-if="itemList.length > 0" hoverable>
						<n-list-item
							v-for="item in itemList"
							:key="item.itemUuid"
							:class="{ 'item-selected': selectedItemUuid === item.itemUuid }"
						>
							<n-thing>
								<template #header>
									<div class="item-header">
										<div class="severity-indicator" :style="{ backgroundColor: getSeverityColor(item.severity) }"></div>
										<span class="item-title" v-html="getHighlightedTitle(item)"></span>
										<n-space :size="8">
											<n-tag
												v-if="item.severity"
												size="small"
												:type="getSeverityTagType(item.severity)"
												:style="item.cvssScore !== null && item.cvssScore !== undefined ? {
													backgroundColor: getSeverityColor(item.severity),
													color: '#fff'
												} : {}"
											>
												{{ item.cvssScore !== null && item.cvssScore !== undefined 
													? `${item.cvssScore.toFixed(1)} ${getSeverityLabel(item.severity)}`
													: getSeverityLabel(item.severity) }}
											</n-tag>
											<n-tag v-if="item.language" size="small" type="default">
												{{ getLanguageLabel(item.language) }}
											</n-tag>
										</n-space>
									</div>
								</template>
								<template #description>
									<div class="item-description">
										<div v-if="item.summary" class="item-summary" v-html="getHighlightedSummary(item)"></div>
										<div v-if="item.vulnerabilityTypes && item.vulnerabilityTypes.length > 0" class="item-tags">
											<n-space :size="4" wrap>
												<n-tag
													v-for="vulnType in item.vulnerabilityTypes.slice(0, 3)"
													:key="vulnType"
													size="small"
													:bordered="false"
												>
													{{ getCweDisplayName(vulnType) }}
												</n-tag>
												<n-tag v-if="item.vulnerabilityTypes.length > 3" size="small" bordered style="background-color: #E0E0E0; color: #606060;">
													+{{ item.vulnerabilityTypes.length - 3 }}
												</n-tag>
											</n-space>
										</div>
										<div class="meta-time-row" style="margin-top: 8px;">
											<span class="time-item time-create" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #666;">
												<SvgIcon icon="ri:add-circle-line" style="font-size: 14px;" />
												<span>创建于</span>
												<span>{{ formatTimeAgo(item.createTime) }}</span>
											</span>
											<span v-if="item.updateTime && item.updateTime !== item.createTime" class="time-item time-update" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #666; margin-left: 12px;">
												<SvgIcon icon="ri:edit-circle-line" style="font-size: 14px;" />
												<span>更新于</span>
												<span>{{ formatTimeAgo(item.updateTime) }}</span>
											</span>
										</div>
									</div>
								</template>
								<template #action>
									<n-space :size="8">
										<n-button size="small" @click="openDetailDrawer(item)">
											查看详情
										</n-button>
										<n-button type="primary" size="small" @click="handleSelectItem(item)">
											选择
										</n-button>
									</n-space>
								</template>
							</n-thing>
						</n-list-item>
					</n-list>
					<n-empty v-else description="暂无匹配的知识条目" />
				</n-spin>
			</div>

			<!-- 分页 -->
			<div v-if="total > 0" class="pagination-container">
				<n-pagination
					v-model:page="pagination.page"
					:item-count="total"
					:page-size="pagination.pageSize"
					:page-sizes="pagination.pageSizes"
					show-size-picker
					@update:page="handlePageChange"
					@update:page-size="handlePageSizeChange"
				/>
			</div>
			</div>
			</div>

			<!-- 右侧片段内容预览（常驻） -->
			<div class="fragment-preview-sidebar">
				<div class="preview-sidebar-header">
					<div style="font-weight: 600; color: #202020; font-size: 14px;">片段内容预览</div>
				</div>
				<div class="preview-sidebar-content">
					{{ fragmentContent || '无内容' }}
				</div>
			</div>
		</div>

		<template #footer>
			<n-space justify="end">
				<n-button @click="handleCancel">取消</n-button>
				<n-button
					type="primary"
					@click="handleConfirm"
					:disabled="!canConfirm"
				>
					确认
				</n-button>
			</n-space>
		</template>
	</n-modal>

	<!-- 详情抽屉 -->
	<n-drawer
		v-model:show="showDetailDrawer"
		:width="600"
		placement="right"
		:mask-closable="true"
	>
		<n-drawer-content :title="detailItem?.title || '知识条目详情'" closable>
			<n-spin :show="detailLoading">
				<template v-if="detailItem">
					<!-- 元信息标签 -->
					<div class="detail-meta-tags" style="margin-bottom: 16px;">
						<n-space :size="8" wrap>
							<n-tag
								v-if="detailItem.severity"
								:style="{
									backgroundColor: getSeverityColor(detailItem.severity),
									color: '#FFFFFF'
								}"
							>
								{{ detailItem.cvssScore !== null && detailItem.cvssScore !== undefined
									? `${detailItem.cvssScore.toFixed(1)} ${getSeverityLabel(detailItem.severity)}`
									: getSeverityLabel(detailItem.severity) }}
							</n-tag>
							<n-tag v-if="detailItem.language" size="small" bordered>
								{{ getLanguageLabel(detailItem.language) }}
							</n-tag>
							<n-tag
								v-for="vulnType in detailItem.vulnerabilityTypes || []"
								:key="vulnType"
								size="small"
								bordered
								style="background-color: #F5F5F5; color: #606060;"
							>
								{{ getCweDisplayName(vulnType) }}
							</n-tag>
						</n-space>
					</div>

					<!-- 时间信息 -->
					<div v-if="detailItem.createTime || detailItem.updateTime" class="detail-section" style="margin-top: 16px; margin-bottom: 16px;">
						<div style="display: flex; gap: 16px; font-size: 13px; color: #666;">
							<div v-if="detailItem.createTime" style="display: flex; align-items: center; gap: 4px;">
								<span style="font-weight: 500;">创建时间：</span>
								<span>{{ formatTimeAgo(detailItem.createTime) }}</span>
							</div>
							<div v-if="detailItem.updateTime" style="display: flex; align-items: center; gap: 4px;">
								<span style="font-weight: 500;">更新时间：</span>
								<span>{{ formatTimeAgo(detailItem.updateTime) }}</span>
							</div>
						</div>
					</div>

					<!-- 摘要 -->
					<div v-if="detailItem.summary" class="detail-section">
						<h3 class="detail-section-title">摘要</h3>
						<p class="detail-text">{{ detailItem.summary }}</p>
					</div>

					<!-- 问题描述 -->
					<div v-if="detailItem.problemDescription" class="detail-section">
						<h3 class="detail-section-title">问题描述</h3>
						<div class="detail-text markdown-content" v-html="detailItem.problemDescription.replace(/\n/g, '<br>')"></div>
					</div>

					<!-- 修复方案 -->
					<div v-if="detailItem.fixSolution" class="detail-section">
						<h3 class="detail-section-title">修复方案</h3>
						<div class="detail-text markdown-content" v-html="detailItem.fixSolution.replace(/\n/g, '<br>')"></div>
					</div>

					<!-- 示例代码 -->
					<div v-if="detailItem.exampleCode" class="detail-section">
						<h3 class="detail-section-title">示例代码</h3>
						<div class="code-display-wrapper">
							<div class="code-toolbar">
								<span class="code-label">代码</span>
								<n-button text size="small" @click="handleCopyCode(detailItem.exampleCode || '')">
									<template #icon>
										<SvgIcon icon="ri:file-copy-line" />
									</template>
									复制
								</n-button>
							</div>
							<CodeEditor
								:model-value="detailItem.exampleCode || ''"
								:readonly="true"
								:show-toolbar="false"
								:show-line-numbers="true"
								:min-height="200"
								:max-height="400"
							/>
						</div>
					</div>

					<!-- 标签 -->
					<div v-if="detailItem.tags && detailItem.tags.length > 0" class="detail-section">
						<h3 class="detail-section-title">标签</h3>
						<n-space :size="8" wrap>
							<n-tag
								v-for="tagName in detailItem.tags"
								:key="tagName"
								size="small"
								bordered
								style="background-color: #F6FFED; color: #52C41A;"
							>
								{{ tagName }}
							</n-tag>
						</n-space>
					</div>
				</template>
				<n-empty v-else description="加载中..." />
			</n-spin>

			<template #footer>
				<n-space justify="end">
					<n-button @click="showDetailDrawer = false">关闭</n-button>
					<n-button type="primary" @click="handleSelectItem(detailItem)" :disabled="!detailItem">
						选择此条目
					</n-button>
				</n-space>
			</template>
		</n-drawer-content>
	</n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import {
	NModal, NRadioGroup, NRadioButton, NAlert, NSpace, NInput, NButton,
	NList, NListItem, NThing, NTag, NEmpty, NSpin, NPagination, NCollapse,
	NCollapseItem, NCheckboxGroup, NCheckbox, NDrawer, NDrawerContent, NTabs, NTabPane, useMessage, NSelect, NPopover
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import CodeEditor from '@/components/knowledge/CodeEditor.vue'
import { getKnowledgeItemList, getKnowledgeItemDetail } from '@/api/knowledgeItem'
import type { KnowledgeItemListQuery } from '@/api/knowledgeItem'
import { getDictDataByType } from '@/api/dict'
import { getCweReferenceListAll } from '@/api/cwe'
import type { CweReference } from '@/api/cwe'

interface Props {
	show: boolean
	kid: string
	fragmentContent?: string
	currentFragment?: any
}

const props = defineProps<Props>()
const emit = defineEmits<{
	'update:show': [value: boolean]
	confirm: [value: { mode: 'create_new' | 'select_existing'; itemUuid?: string; itemTitle?: string }]
}>()

const message = useMessage()

const showModal = computed({
	get: () => props.show,
	set: (val) => emit('update:show', val)
})

const selectionMode = ref<'create_new' | 'select_existing'>('select_existing')
const searchKeyword = ref('')
const isSearching = ref(false)
const showFilterPanel = ref(false)
const activeFilterTab = ref<'severity' | 'language' | 'status' | 'vulnerabilityType' | 'tag'>('severity')

const filterSeverities = ref<string[]>([])
const filterLanguages = ref<string[]>([])
const filterVulnerabilityTypes = ref<string[]>([])
const filterStatuses = ref<string[]>([])
const filterTags = ref<string[]>([])
const filterCvssScoreRange = ref<[number, number]>([0, 10])
const filterCvssScoreBands = ref<string[]>([])

const sortBy = ref<'create_time' | 'update_time' | 'severity' | 'cvss_score' | 'title'>('create_time')
const sortOrder = ref<'asc' | 'desc'>('desc')

const itemList = ref<any[]>([])
const allItemsForStats = ref<any[]>([])
const loading = ref(false)
const total = ref(0)
let fetchItemsLock = false
let isInitializing = false

const pagination = reactive({
	page: 1,
	pageSize: 20,
	pageSizes: [10, 20, 30, 50],
})

const selectedItemUuid = ref<string | null>(null)
const showDetailDrawer = ref(false)
const detailItem = ref<any>(null)
const detailLoading = ref(false)

const severityOptions = ref<any[]>([])
const languageOptions = ref<any[]>([])
const statusOptions = ref<any[]>([])
const vulnerabilityTypeOptions = ref<any[]>([])
const systemTags = ref<Array<{ name: string; description?: string }>>([])
const userTags = ref<Array<{ name: string; description?: string }>>([])
const backendGroupedByClusters = ref<any[]>([])

const backendFacetStats = ref<any>(null)

const groupedByClusters = computed(() => backendGroupedByClusters.value)
const facetSearchKeywords = reactive({
	vulnerabilityType: '',
	tag: ''
})
const expandedVulnClusters = ref<string[]>([])
const facetShowAll = reactive({
	systemTag: false,
	userTag: false
})

const facetGroupCollapsed = reactive({
	severity: false,
	language: false,
	status: false,
	advanced: true,
	vulnerabilityType: false,
	tag: false,
	cvss: false,
	cvssMetrics: true,
	date: false,
})

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

function extractKeywords(query: string): string[] {
	if (!query || !query.trim()) return []
	return query.trim().split(/\s+/).filter(w => w.length > 0)
}

function highlightText(text: string, keywords: string[]): string {
	if (!text || !keywords || keywords.length === 0) {
		return text
	}
	const lowerText = text.toLowerCase()
	let result = ''
	let lastIndex = 0
	const matches: Array<{ start: number; end: number; keyword: string }> = []
	for (const keyword of keywords) {
		const lowerKeyword = keyword.toLowerCase().trim()
		if (!lowerKeyword) continue
		let searchIndex = 0
		while (true) {
			const index = lowerText.indexOf(lowerKeyword, searchIndex)
			if (index === -1) break
			const overlap = matches.some(m =>
				(index >= m.start && index < m.end) ||
				(index + lowerKeyword.length > m.start && index + lowerKeyword.length <= m.end) ||
				(index <= m.start && index + lowerKeyword.length >= m.end)
			)
			if (!overlap) {
				matches.push({
					start: index,
					end: index + lowerKeyword.length,
					keyword: lowerKeyword
				})
			}
			searchIndex = index + 1
		}
	}
	matches.sort((a, b) => a.start - b.start)
	for (const match of matches) {
		if (lastIndex < match.start) {
			result += escapeHtml(text.substring(lastIndex, match.start))
		}
		result += `<mark style="background-color: #fff4ce; color: #000; padding: 0 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(text.substring(match.start, match.end))}</mark>`
		lastIndex = match.end
	}
	if (lastIndex < text.length) {
		result += escapeHtml(text.substring(lastIndex))
	}
	return result
}

function escapeHtml(text: string): string {
	const div = document.createElement('div')
	div.textContent = text
	return div.innerHTML
}

function getHighlightedTitle(item: any): string {
	if (!searchKeyword.value.trim()) return item.title || '-'
	return highlightText(item.title || '-', extractKeywords(searchKeyword.value))
}

function getHighlightedSummary(item: any): string {
	if (!item.summary) return ''
	if (!searchKeyword.value.trim()) return item.summary
	return highlightText(item.summary, extractKeywords(searchKeyword.value))
}

const facetStats = computed(() => {
	if (!backendFacetStats.value) {
		console.log('[ItemSelectorModal] facetStats 为空，返回默认值')
		return {
			severities: {} as Record<string, number>,
			languages: {} as Record<string, number>,
			statuses: {} as Record<string, number>,
			vulnerabilityTypes: {} as Record<string, number>,
			tags: {} as Record<string, number>,
		}
	}
	console.log('[ItemSelectorModal] facetStats 计算:', {
		severities: Object.keys(backendFacetStats.value.severities || {}).length,
		languages: Object.keys(backendFacetStats.value.languages || {}).length,
		statuses: Object.keys(backendFacetStats.value.statuses || {}).length,
		vulnerabilityTypes: Object.keys(backendFacetStats.value.vulnerabilityTypes || {}).length,
		tags: Object.keys(backendFacetStats.value.tags || {}).length,
		severitiesDetail: backendFacetStats.value.severities,
		languagesDetail: backendFacetStats.value.languages,
		statusesDetail: backendFacetStats.value.statuses,
	})
	return backendFacetStats.value
})

const availableSeverityOptions = computed(() => {
	if (!severityOptions.value || !Array.isArray(severityOptions.value)) return []
	const result = severityOptions.value.filter(opt => facetStats.value.severities?.[opt.value] > 0)
	console.log('[ItemSelectorModal] availableSeverityOptions:', {
		allSeverityOptions: severityOptions.value.length,
		facetStatsSeverities: facetStats.value.severities,
		availableCount: result.length,
		available: result.map(opt => ({ value: opt.value, label: opt.label, count: facetStats.value.severities?.[opt.value] }))
	})
	return result
})

const availableLanguageOptions = computed(() => {
	if (!languageOptions.value || !Array.isArray(languageOptions.value)) return []
	const result = languageOptions.value.filter(opt => facetStats.value.languages?.[opt.value] > 0)
	console.log('[ItemSelectorModal] availableLanguageOptions:', {
		allLanguageOptions: languageOptions.value.length,
		facetStatsLanguages: facetStats.value.languages,
		availableCount: result.length,
		available: result.map(opt => ({ value: opt.value, label: opt.label, count: facetStats.value.languages?.[opt.value] }))
	})
	return result
})

const availableStatusOptions = computed(() => {
	if (!statusOptions.value || !Array.isArray(statusOptions.value)) return []
	const result = statusOptions.value.filter(opt => facetStats.value.statuses?.[opt.value] > 0)
	console.log('[ItemSelectorModal] availableStatusOptions:', {
		allStatusOptions: statusOptions.value.length,
		facetStatsStatuses: facetStats.value.statuses,
		availableCount: result.length,
		available: result.map(opt => ({ value: opt.value, label: opt.label, count: facetStats.value.statuses?.[opt.value] }))
	})
	return result
})

const filteredSystemTags = computed(() => {
	if (!facetSearchKeywords.tag.trim()) return systemTags.value
	const keyword = facetSearchKeywords.tag.toLowerCase()
	return systemTags.value.filter(tag => 
		tag.name.toLowerCase().includes(keyword) || 
		(tag.description && tag.description.toLowerCase().includes(keyword))
	)
})

const filteredUserTags = computed(() => {
	if (!facetSearchKeywords.tag.trim()) return userTags.value
	const keyword = facetSearchKeywords.tag.toLowerCase()
	return userTags.value.filter(tag => 
		tag.name.toLowerCase().includes(keyword) || 
		(tag.description && tag.description.toLowerCase().includes(keyword))
	)
})

const displayedSystemTags = computed(() => {
	const filtered = filteredSystemTags.value
	return facetShowAll.systemTag ? filtered : filtered.slice(0, 6)
})

const displayedUserTags = computed(() => {
	const filtered = filteredUserTags.value
	return facetShowAll.userTag ? filtered : filtered.slice(0, 6)
})

const severitySelectAllState = computed(() => {
	const selected = filterSeverities.value || []
	if (selected.length === 0) return false
	if (availableSeverityOptions.value.length > 0 && selected.length === availableSeverityOptions.value.length) return true
	return null
})

const languageSelectAllState = computed(() => {
	const selected = filterLanguages.value || []
	if (selected.length === 0) return false
	if (availableLanguageOptions.value.length > 0 && selected.length === availableLanguageOptions.value.length) return true
	return null
})

const statusSelectAllState = computed(() => {
	const selected = filterStatuses.value || []
	if (selected.length === 0) return false
	if (availableStatusOptions.value.length > 0 && selected.length === availableStatusOptions.value.length) return true
	return null
})

const vulnerabilityTypeSelectAllState = computed(() => {
	const selected = filterVulnerabilityTypes.value || []
	if (selected.length === 0) return false
	const availableTypes = Object.keys(facetStats.value?.vulnerabilityTypes || {})
	if (availableTypes.length > 0 && selected.length === availableTypes.length) return true
	return null
})

const tagSelectAllState = computed(() => {
	const selected = filterTags.value || []
	if (selected.length === 0) return false
	const allTags = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)]
	if (allTags.length > 0 && selected.length === allTags.length) return true
	return null
})

const hasActiveFilters = computed(() => {
	return filterSeverities.value.length > 0 ||
		filterLanguages.value.length > 0 ||
		filterVulnerabilityTypes.value.length > 0 ||
		filterStatuses.value.length > 0 ||
		filterTags.value.length > 0 ||
		(filterCvssScoreRange.value[0] > 0 || filterCvssScoreRange.value[1] < 10) ||
		filterCvssScoreBands.value.length > 0
})

const sortOptions = computed(() => [
	{ label: '按创建时间', value: 'create_time' },
	{ label: '按更新时间', value: 'update_time' },
	{ label: '按风险等级', value: 'severity' },
	{ label: '按CVSS评分', value: 'cvss_score' },
	{ label: '按标题', value: 'title' },
])

function getSortPlaceholder(): string {
	const currentOption = sortOptions.value.find(opt => opt.value === sortBy.value)
	return currentOption ? currentOption.label : '按创建时间'
}

function handleSortChange(value?: string) {
	if (value) {
		sortBy.value = value as any
		if (!fetchItemsLock) {
			fetchItems()
		}
	}
}

function toggleSortOrder() {
	sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
	fetchItems()
}

function handleSearch() {
	if (searchDebounceTimer) {
		clearTimeout(searchDebounceTimer)
	}
	isSearching.value = true
	searchDebounceTimer = setTimeout(() => {
		pagination.page = 1
		fetchItems()
		isSearching.value = false
	}, 300)
}

function clearFilters() {
	filterSeverities.value = []
	filterLanguages.value = []
	filterVulnerabilityTypes.value = []
	filterStatuses.value = []
	filterTags.value = []
	filterCvssScoreRange.value = [0, 10]
	filterCvssScoreBands.value = []
	expandedVulnClusters.value = []
	facetSearchKeywords.vulnerabilityType = ''
	facetSearchKeywords.tag = ''
	facetShowAll.systemTag = false
	facetShowAll.userTag = false
	pagination.page = 1
	fetchItems()
}

async function fetchItems() {
	if (!props.kid) return
	if (!props.show) return
	if (fetchItemsLock) return

	fetchItemsLock = true
	loading.value = true
	try {
		const params: KnowledgeItemListQuery = {
			kid: props.kid,
			searchKeyword: searchKeyword.value.trim() || undefined,
			severities: filterSeverities.value.length > 0 ? filterSeverities.value : undefined,
			languages: filterLanguages.value.length > 0 ? filterLanguages.value : undefined,
			vulnerabilityTypes: filterVulnerabilityTypes.value.length > 0 ? filterVulnerabilityTypes.value : undefined,
			statuses: filterStatuses.value.length > 0 ? filterStatuses.value : undefined,
			tags: filterTags.value.length > 0 ? filterTags.value : undefined,
			orderBy: sortBy.value,
			order: sortOrder.value,
			pageNum: pagination.page,
			pageSize: pagination.pageSize,
		}

		const response: any = await getKnowledgeItemList(params)
		if (response.code === 200) {
			itemList.value = response.rows || []
			total.value = response.total || 0
			backendFacetStats.value = response.facetStats || null
			backendGroupedByClusters.value = response.groupedByClusters || []
			console.log('[ItemSelectorModal] fetchItems 返回数据:', {
				itemCount: response.rows?.length || 0,
				total: response.total || 0,
				facetStats: response.facetStats,
				groupedByClusters: response.groupedByClusters?.length || 0,
				severityOptions: severityOptions.value.length,
				languageOptions: languageOptions.value.length,
				statusOptions: statusOptions.value.length,
			})
			if (!searchKeyword.value.trim() && filterSeverities.value.length === 0 && filterLanguages.value.length === 0 && 
				filterVulnerabilityTypes.value.length === 0 && filterStatuses.value.length === 0 && filterTags.value.length === 0) {
				allItemsForStats.value = response.rows || []
			}
		} else {
			message.error(response.msg || '获取知识条目列表失败')
		}
	} catch (error: any) {
		message.error('获取知识条目列表失败: ' + (error.message || '未知错误'))
	} finally {
		loading.value = false
		fetchItemsLock = false
	}
}

function handlePageChange(page: number) {
	pagination.page = page
	fetchItems()
}

function handlePageSizeChange(pageSize: number) {
	pagination.pageSize = pageSize
	pagination.page = 1
	fetchItems()
}

async function openDetailDrawer(item: any) {
	selectedItemUuid.value = item.itemUuid
	detailItem.value = null
	detailLoading.value = true
	showDetailDrawer.value = true

	try {
		const response: any = await getKnowledgeItemDetail(item.itemUuid)
		if (response.code === 200) {
			detailItem.value = response.data
		} else {
			message.error(response.msg || '获取详情失败')
		}
	} catch (error: any) {
		message.error('获取详情失败: ' + (error.message || '未知错误'))
	} finally {
		detailLoading.value = false
	}
}

function handleSelectItem(item: any) {
	selectedItemUuid.value = item.itemUuid
	showDetailDrawer.value = false
	emit('confirm', {
		mode: 'select_existing',
		itemUuid: item.itemUuid,
		itemTitle: item.title
	})
	showModal.value = false
}

function handleConfirm() {
	if (selectionMode.value === 'create_new') {
		emit('confirm', {
			mode: 'create_new'
		})
		showModal.value = false
	} else {
		if (!selectedItemUuid.value) {
			message.warning('请先选择一个知识条目')
			return
		}
		const item = itemList.value.find(i => i.itemUuid === selectedItemUuid.value)
		if (item) {
			handleSelectItem(item)
		}
	}
}

function handleCancel() {
	showModal.value = false
}

const canConfirm = computed(() => {
	if (selectionMode.value === 'create_new') {
		return true
	}
	return selectedItemUuid.value !== null
})

function getSeverityColor(severity?: string): string {
	const colors: Record<string, string> = {
		'高危': '#F5222D',
		'中危': '#FA8C16',
		'低危': '#FAAD14',
		'信息': '#52C41A',
	}
	return colors[severity || ''] || '#808080'
}

function getSeverityTagType(severity?: string): 'default' | 'success' | 'warning' | 'error' {
	const types: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
		'高危': 'error',
		'中危': 'warning',
		'低危': 'warning',
		'信息': 'success',
	}
	return types[severity || ''] || 'default'
}

function getDictLabel(options: any[], value?: string): string {
	if (!value) return '-'
	const option = options.find((opt: any) => opt.value === value)
	return option ? option.label : value
}

function getSeverityLabel(severity?: string): string {
	return getDictLabel(severityOptions.value, severity)
}

function getLanguageLabel(language?: string): string {
	return getDictLabel(languageOptions.value, language)
}

function getCweDisplayName(cweId: string): string {
	const option = vulnerabilityTypeOptions.value.find((opt: any) => opt.value === cweId)
	return option ? option.label : cweId
}

function formatTimeAgo(timestamp?: number | string): string {
	if (!timestamp) return '-'
	try {
		const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)
		const now = new Date()
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
		if (diffInSeconds < 60) return '刚刚'
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
		if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		const hours = String(date.getHours()).padStart(2, '0')
		const minutes = String(date.getMinutes()).padStart(2, '0')
		return `${year}-${month}-${day} ${hours}:${minutes}`
	} catch (e) {
		return '-'
	}
}

async function handleCopyCode(code: string) {
	try {
		await navigator.clipboard.writeText(code || '')
		message.success('复制成功')
	} catch (e) {
		message.error('复制失败')
	}
}

async function loadDictOptions() {
	try {
		const [severityRes, languageRes, statusRes, cweRes]: any[] = await Promise.all([
			getDictDataByType('knowledge_severity'),
			getDictDataByType('knowledge_language'),
			getDictDataByType('knowledge_item_status'),
			getCweReferenceListAll(),
		])
		console.log('[ItemSelectorModal] loadDictOptions API 返回:', {
			severityRes: severityRes,
			languageRes: languageRes,
			statusRes: statusRes,
		})
		severityOptions.value = (severityRes.data || []).map((item: any) => ({
			label: item.dictLabel,
			value: item.dictValue,
			listClass: item.listClass,
			cssClass: item.cssClass,
		}))
		languageOptions.value = (languageRes.data || []).map((item: any) => ({
			label: item.dictLabel,
			value: item.dictValue,
		}))
		statusOptions.value = (statusRes.data || []).map((item: any) => ({
			label: item.dictLabel,
			value: item.dictValue,
		}))
		console.log('[ItemSelectorModal] loadDictOptions 完成:', {
			severityOptions: severityOptions.value.length,
			languageOptions: languageOptions.value.length,
			statusOptions: statusOptions.value.length,
			severityValues: severityOptions.value.map(opt => opt.value),
			languageValues: languageOptions.value.map(opt => opt.value),
			statusValues: statusOptions.value.map(opt => opt.value),
		})
		if (cweRes.code === 200 && Array.isArray(cweRes.data)) {
			vulnerabilityTypeOptions.value = cweRes.data.map((item: CweReference) => ({
				label: `${item.cweId}${item.nameZh ? ': ' + item.nameZh : ''}`,
				value: item.cweId,
				cweId: item.cweId,
				nameZh: item.nameZh,
				nameEn: item.nameEn,
			}))
			console.log('[ItemSelectorModal] CWE选项加载:', {
				count: vulnerabilityTypeOptions.value.length,
				firstFew: vulnerabilityTypeOptions.value.slice(0, 5).map(opt => opt.value)
			})
		} else {
			vulnerabilityTypeOptions.value = []
			console.warn('[ItemSelectorModal] CWE选项加载失败:', cweRes)
		}
	} catch (error: any) {
		console.error('[ItemSelectorModal] 加载字典选项失败:', error)
	}
}

async function loadTags() {
	if (!props.kid) return
	try {
		const response: any = await getKnowledgeItemList({ kid: props.kid, pageNum: 1, pageSize: 1000 })
		if (response.code === 200 && response.rows) {
			const allTags = new Set<string>()
			response.rows.forEach((item: any) => {
				if (item.tags && Array.isArray(item.tags)) {
					item.tags.forEach((tag: string) => allTags.add(tag))
				}
			})
			systemTags.value = []
			userTags.value = Array.from(allTags).map(tag => ({ name: tag }))
		}
	} catch (error: any) {
		console.error('[ItemSelectorModal] 加载标签失败:', error)
	}
}

function toggleSeveritySelectAll(checked: boolean) {
	if (checked) {
		filterSeverities.value = availableSeverityOptions.value.map(opt => opt.value)
	} else {
		filterSeverities.value = []
	}
	pagination.page = 1
	fetchItems()
}

function toggleLanguageSelectAll(checked: boolean) {
	if (checked) {
		filterLanguages.value = availableLanguageOptions.value.map(opt => opt.value)
	} else {
		filterLanguages.value = []
	}
	pagination.page = 1
	fetchItems()
}

function toggleStatusSelectAll(checked: boolean) {
	if (checked) {
		filterStatuses.value = availableStatusOptions.value.map(opt => opt.value)
	} else {
		filterStatuses.value = []
	}
	pagination.page = 1
	fetchItems()
}

function toggleVulnerabilityTypeSelectAll(checked: boolean) {
	if (checked) {
		filterVulnerabilityTypes.value = Object.keys(facetStats.value?.vulnerabilityTypes || {})
	} else {
		filterVulnerabilityTypes.value = []
	}
	pagination.page = 1
	fetchItems()
}

function toggleTagSelectAll(checked: boolean) {
	if (checked) {
		filterTags.value = [...systemTags.value.map(t => t.name), ...userTags.value.map(t => t.name)]
	} else {
		filterTags.value = []
	}
	pagination.page = 1
	fetchItems()
}

function getClusterCheckState(cluster: any) {
	const cwes = cluster.cwes || []
	if (cwes.length === 0) return { checked: false, indeterminate: false }
	const selectedCwes = filterVulnerabilityTypes.value || []
	const selectedCount = cwes.filter((cwe: string) => selectedCwes.includes(cwe)).length
	if (selectedCount === 0) return { checked: false, indeterminate: false }
	if (selectedCount === cwes.length) return { checked: true, indeterminate: false }
	return { checked: false, indeterminate: true }
}

function toggleClusterSelectAll(cluster: any) {
	const cwes = cluster.cwes || []
	const current = filterVulnerabilityTypes.value || []
	const selectedCount = cwes.filter((cwe: string) => current.includes(cwe)).length
	if (selectedCount === cwes.length) {
		filterVulnerabilityTypes.value = current.filter((cwe: string) => !cwes.includes(cwe))
	} else {
		const newSelection = [...new Set([...current, ...cwes])]
		filterVulnerabilityTypes.value = newSelection
	}
	pagination.page = 1
	fetchItems()
}

function getClusterDisplayCount(cluster: any): number {
	const cwes = cluster.cwes || []
	let totalCount = 0
	cwes.forEach((cwe: string) => {
		const count = facetStats.value?.vulnerabilityTypes?.[cwe] || 0
		totalCount += Number(count)
	})
	return totalCount
}

watch(() => props.show, async (newVal) => {
	if (newVal) {
		isInitializing = true
		const fragment = props.currentFragment
		if (fragment && (fragment.matchedItemUuid === null || fragment.matchedItemUuid === '__create_new__' || !fragment.matchedItemUuid)) {
			selectionMode.value = 'create_new'
			selectedItemUuid.value = null
		} else {
			selectionMode.value = 'select_existing'
			if (fragment && fragment.matchedItemUuid) {
				selectedItemUuid.value = fragment.matchedItemUuid
			} else {
				selectedItemUuid.value = null
			}
		}
		searchKeyword.value = ''
		showDetailDrawer.value = false
		filterSeverities.value = []
		filterLanguages.value = []
		filterVulnerabilityTypes.value = []
		filterStatuses.value = []
		filterTags.value = []
		pagination.page = 1
		if (props.kid) {
			await Promise.all([loadDictOptions(), loadTags()])
			if (selectionMode.value === 'select_existing') {
				await fetchItems()
				if (availableSeverityOptions.value.length > 0) {
					activeFilterTab.value = 'severity'
				} else if (availableLanguageOptions.value.length > 0) {
					activeFilterTab.value = 'language'
				} else if (availableStatusOptions.value.length > 0) {
					activeFilterTab.value = 'status'
				} else if (Object.keys(facetStats.value?.vulnerabilityTypes || {}).length > 0) {
					activeFilterTab.value = 'vulnerabilityType'
				} else if (systemTags.value.length > 0 || userTags.value.length > 0) {
					activeFilterTab.value = 'tag'
				} else {
					activeFilterTab.value = 'severity'
				}
			}
		}
		isInitializing = false
	} else {
		fetchItemsLock = false
		isInitializing = false
	}
})

watch([filterSeverities, filterLanguages, filterVulnerabilityTypes, filterStatuses, filterTags], () => {
	if (!props.show) return
	if (isInitializing) return
	if (fetchItemsLock) return
	pagination.page = 1
	fetchItems()
}, { deep: true })

watch(() => selectionMode.value, async (newMode) => {
	if (!props.show) return
	if (isInitializing) return
	if (newMode === 'create_new') {
		selectedItemUuid.value = null
	} else if (newMode === 'select_existing' && props.kid) {
		if (fetchItemsLock) return
		await fetchItems()
	}
})
</script>

<style scoped>
.create-new-mode {
	padding: 16px 0;
}

.create-new-preview {
	margin-top: 16px;
}

.search-bar {
	padding: 12px 0;
	border-bottom: 1px solid #F0F0F0;
	margin-bottom: 16px;
}

.item-list-container {
	flex: 1;
	overflow-y: auto;
	min-height: 0;
	margin-bottom: 16px;
}

.item-selected {
	background-color: #F0F7FF;
}

.item-header {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
}

.severity-indicator {
	width: 4px;
	height: 16px;
	border-radius: 2px;
	flex-shrink: 0;
}

.item-title {
	font-weight: 500;
	flex: 1;
}

.item-description {
	margin-top: 8px;
}

.item-summary {
	font-size: 13px;
	color: #666;
	line-height: 1.6;
	margin-bottom: 8px;
}

.item-tags {
	margin-top: 8px;
}

.pagination-container {
	padding-top: 16px;
	border-top: 1px solid #F0F0F0;
	display: flex;
	justify-content: center;
	flex-shrink: 0;
	margin-top: 16px;
}

.detail-meta-tags {
	padding-bottom: 16px;
	border-bottom: 1px solid #F0F0F0;
}

.detail-section {
	margin-top: 24px;
}

.detail-section-title {
	font-size: 16px;
	font-weight: 600;
	color: #202020;
	margin: 0 0 12px 0;
}

.detail-text {
	font-size: 14px;
	color: #404040;
	line-height: 1.8;
	margin: 0;
}

.markdown-content {
	white-space: pre-wrap;
}

.code-display-wrapper {
	border: 1px solid #E5E7EB;
	border-radius: 4px;
	overflow: hidden;
}

.code-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	background-color: #F9FAFB;
	border-bottom: 1px solid #E5E7EB;
}

.code-label {
	font-size: 12px;
	color: #666;
	font-weight: 500;
}

.search-loading {
	animation: spin 1s linear infinite;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.item-selector-modal :deep(.n-card) {
	display: flex;
	flex-direction: column;
	max-height: 85vh;
}

.item-selector-modal :deep(.n-card-body) {
	flex: 1;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.modal-content-wrapper {
	flex: 1;
	overflow: hidden;
	display: flex;
	gap: 16px;
	min-height: 0;
}

.modal-main-content {
	flex: 1;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}

.fragment-preview-sidebar {
	width: 350px;
	flex-shrink: 0;
	background: #fafafa;
	border-radius: 4px;
	border: 1px solid #e8e8e8;
	display: flex;
	flex-direction: column;
	max-height: 100%;
}

.preview-sidebar-header {
	padding: 12px 16px;
	border-bottom: 1px solid #e8e8e8;
	background: #fff;
	flex-shrink: 0;
}

.preview-sidebar-content {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
	font-size: 13px;
	line-height: 1.8;
	color: #323130;
	white-space: pre-wrap;
	word-break: break-word;
}

.preview-sidebar-content::-webkit-scrollbar {
	width: 6px;
}

.preview-sidebar-content::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.preview-sidebar-content::-webkit-scrollbar-thumb {
	background: #D0D0D0;
	border-radius: 3px;
	transition: background 0.2s ease;
}

.preview-sidebar-content::-webkit-scrollbar-thumb:hover {
	background: #A8A8A8;
}

.create-new-mode,
.select-existing-mode {
	flex: 1;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.select-existing-mode .search-bar {
	flex-shrink: 0;
}

.select-existing-mode .filter-collapse {
	flex-shrink: 0;
}

.filter-panel {
	flex-shrink: 0;
	margin-bottom: 12px;
	display: flex;
	flex-direction: column;
	max-height: 60vh;
}

.filter-panel :deep(.n-tabs) {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
}

.filter-panel :deep(.n-tabs-nav) {
	flex-shrink: 0;
}

.filter-panel :deep(.n-tab-pane) {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
}

.filter-tab-content {
	flex: 1;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 8px 4px 8px 0;
	min-height: 0;
}

.filter-tab-content::-webkit-scrollbar {
	width: 6px;
}

.filter-tab-content::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.filter-tab-content::-webkit-scrollbar-thumb {
	background: #D0D0D0;
	border-radius: 3px;
	transition: background 0.2s ease;
}

.filter-tab-content::-webkit-scrollbar-thumb:hover {
	background: #A8A8A8;
}

.filter-actions {
	flex-shrink: 0;
	padding-top: 12px;
	border-top: 1px solid #e8e8e8;
	margin-top: 8px;
}

.facet-group {
	display: flex;
	flex-direction: column;
	gap: 8px;
	border: 1px solid #EDEBE9;
	border-radius: 4px;
	padding: 8px;
	background: #fff;
}

.facet-group-header {
	display: flex;
	align-items: center;
	cursor: pointer;
	padding: 4px 0;
	user-select: none;
}

.facet-group-header:hover {
	color: #FA8C16;
}

.facet-label {
	font-weight: 500;
	font-size: 13px;
	color: #262626;
}

.facet-label-advanced {
	font-weight: 600;
	font-size: 13px;
	color: #262626;
}

.facet-group-content {
	padding: 4px 0;
}

.facet-option-label {
	font-size: 12px;
	color: #595959;
	margin-right: 4px;
}

.facet-option-count {
	font-size: 11px;
	color: #8C8C8C;
	background: #F5F5F5;
	padding: 1px 6px;
	border-radius: 10px;
	margin-left: 4px;
}

.facet-group-advanced {
	border: 1px solid #EDEBE9;
	border-radius: 4px;
	padding: 8px;
	background: #fff;
}

.facet-group-advanced-header {
	display: flex;
	align-items: center;
	cursor: pointer;
	padding: 4px 0;
	user-select: none;
}

.facet-group-advanced-header:hover {
	color: #FA8C16;
}

.facet-group-advanced-content {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-top: 8px;
}

.facet-group-nested {
	border: 1px solid #E8E8E8;
	border-radius: 4px;
	padding: 8px;
	background: #FAFAFA;
}

.facet-nested-body {
	padding: 8px 0;
}

.facet-group-toolbar {
	margin-bottom: 8px;
}


.cluster-header {
	display: flex;
	align-items: center;
	gap: 8px;
}

.cluster-name {
	font-size: 12px;
	font-weight: 500;
	color: #262626;
}

.tag-group-title {
	font-size: 12px;
	font-weight: 500;
	color: #595959;
	margin-bottom: 4px;
	display: flex;
	align-items: center;
}

.filter-collapse-content {
	max-height: 400px;
	overflow-y: auto;
	padding: 4px 0;
}

.filter-collapse-content::-webkit-scrollbar {
	width: 6px;
}

.filter-collapse-content::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.filter-collapse-content::-webkit-scrollbar-thumb {
	background: #D0D0D0;
	border-radius: 3px;
	transition: background 0.2s ease;
}

.filter-collapse-content::-webkit-scrollbar-thumb:hover {
	background: #A8A8A8;
}

.vulnerability-type-filter-container {
	max-height: 300px;
	overflow-y: auto;
	padding: 4px;
	border: 1px solid #e8e8e8;
	border-radius: 4px;
	background: #fafafa;
}

.vulnerability-type-filter-container::-webkit-scrollbar {
	width: 6px;
}

.vulnerability-type-filter-container::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.vulnerability-type-filter-container::-webkit-scrollbar-thumb {
	background: #D0D0D0;
	border-radius: 3px;
	transition: background 0.2s ease;
}

.vulnerability-type-filter-container::-webkit-scrollbar-thumb:hover {
	background: #A8A8A8;
}

.item-list-container {
	flex: 1;
	overflow-y: auto;
	min-height: 0;
}

.item-list-container::-webkit-scrollbar {
	width: 6px;
}

.item-list-container::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.item-list-container::-webkit-scrollbar-thumb {
	background: #D0D0D0;
	border-radius: 3px;
	transition: background 0.2s ease;
}

.item-list-container::-webkit-scrollbar-thumb:hover {
	background: #A8A8A8;
}
</style>

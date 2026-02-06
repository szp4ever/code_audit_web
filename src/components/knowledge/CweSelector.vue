<template>
	<n-modal
		v-model:show="showModal"
		:mask-closable="true"
		:close-on-esc="true"
		preset="card"
		:style="{ width: '900px', maxWidth: '90vw' }"
		title="选择漏洞类型"
		:closable="true"
		@update:show="handleModalShowChange"
	>
		<div class="cwe-selector">
			<!-- 顶部：搜索栏和已选项 -->
			<div class="selector-header">
				<n-input
					v-model:value="searchKeyword"
					placeholder="搜索CWE编号、中文名称或英文名称..."
					clearable
					size="large"
					@update:value="handleSearch"
				>
					<template #prefix>
						<SvgIcon icon="ri:search-line" />
					</template>
				</n-input>
				<div v-if="selectedCweIds.length > 0" class="selected-tags">
					<div class="selected-count">
						<span class="count-text">已选择 {{ selectedCweIds.length }} 项</span>
						<n-space :size="8" style="margin-left: 12px;">
							<n-button
								text
								type="info"
								size="small"
								@click="showSelectedDetailModal = true"
							>
								<template #icon>
									<SvgIcon icon="ri:list-check" />
								</template>
								查看全部已选
							</n-button>
						</n-space>
					</div>
					<div class="selected-tags-container">
						<n-space :size="8" wrap>
							<n-tag
								v-for="cweId in visibleSelectedTags"
								:key="cweId"
								closable
								@close="removeSelection(cweId)"
								:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
							>
								{{ getCweDisplayName(cweId) }}
							</n-tag>
						</n-space>
					</div>
				</div>
			</div>

			<!-- 状态筛选 -->
			<div class="status-filter">
				<div class="status-filter-label">
					<SvgIcon icon="ri:filter-line" class="filter-icon" />
					<span>CWE标准制定的状态筛选</span>
				</div>
				<n-checkbox-group v-model:value="selectedStatuses" @update:value="handleStatusChange">
					<n-space :size="12">
						<n-checkbox value="Stable" class="status-checkbox status-stable">
							<span class="status-label">稳定</span>
						</n-checkbox>
						<n-checkbox value="Draft" class="status-checkbox status-draft">
							<span class="status-label">草案</span>
						</n-checkbox>
						<n-checkbox value="Incomplete" class="status-checkbox status-incomplete">
							<span class="status-label">不完整</span>
						</n-checkbox>
						<n-checkbox value="Deprecated" class="status-checkbox status-deprecated">
							<span class="status-label">已弃用</span>
						</n-checkbox>
					</n-space>
				</n-checkbox-group>
				<n-spin v-if="statusFilterLoading" size="small" style="margin-left: 8px;" />
			</div>

			<!-- 分组方式切换 -->
			<div class="group-mode-tabs">
				<n-tabs v-model:value="groupMode" type="line" animated size="large">
					<n-tab-pane name="cluster" tab="按分组查看">
						<template #tab>
							<span class="tab-label">
								<SvgIcon icon="ri:group-line" class="tab-icon" />
								按分组查看
								<n-badge v-if="getSelectedCountInMode('cluster') > 0" :value="getSelectedCountInMode('cluster')" :max="99" />
							</span>
						</template>
					</n-tab-pane>
					<n-tab-pane name="abstraction" tab="按抽象层级">
						<template #tab>
							<span class="tab-label">
								<SvgIcon icon="ri:stack-line" class="tab-icon" />
								按抽象层级
								<n-badge v-if="getSelectedCountInMode('abstraction') > 0" :value="getSelectedCountInMode('abstraction')" :max="99" />
							</span>
						</template>
					</n-tab-pane>
					<n-tab-pane name="flat" tab="平铺列表">
						<template #tab>
							<span class="tab-label">
								<SvgIcon icon="ri:list-check" class="tab-icon" />
								平铺列表
								<n-badge v-if="getSelectedCountInMode('flat') > 0" :value="getSelectedCountInMode('flat')" :max="99" />
							</span>
						</template>
					</n-tab-pane>
				</n-tabs>
			</div>

			<!-- 主要内容区域 -->
			<div class="selector-content">
				<!-- 按分组查看 -->
				<div v-if="groupMode === 'cluster'">
					<n-collapse v-model:expanded-names="expandedClusters" accordion>
						<n-collapse-item
							v-for="cluster in filteredClusters"
							:key="`${cluster.clusterId}-${cluster.clusterMethod}`"
							:name="`${cluster.clusterId}-${cluster.clusterMethod}`"
							:title="getClusterDisplayTitle(cluster)"
						>
							<template #header-extra>
								<n-checkbox
									:checked="isClusterAllSelected(cluster)"
									:indeterminate="isClusterPartiallySelected(cluster)"
									@click.stop
									@update:checked="(val) => toggleClusterSelection(cluster, val)"
								/>
							</template>
							<div class="cluster-cwe-list">
								<n-checkbox-group
									:value="selectedCweIds"
									@update:value="handleCweSelectionChange"
								>
									<div
										v-for="cwe in getFilteredClusterCwes(cluster)"
										:key="cwe.cweId"
										class="cwe-item"
										:class="{ 'cwe-item-selected': selectedCweIds.includes(cwe.cweId) }"
									>
										<n-checkbox :value="cwe.cweId">
											<template #default>
												<div class="cwe-item-content">
													<div class="cwe-item-main">
														<span class="cwe-id">{{ cwe.cweId }}</span>
														<span class="cwe-name">{{ getCweName(cwe.cweId) }}</span>
														<n-tag
															v-if="selectionHistoryMap.has(cwe.cweId) && selectionHistoryMap.get(cwe.cweId) !== 'cluster'"
															size="small"
															type="info"
															:style="{ marginLeft: '8px', fontSize: '11px' }"
														>
															{{ getModeLabel(selectionHistoryMap.get(cwe.cweId)!) }}
														</n-tag>
													</div>
													<n-popover
														trigger="click"
														placement="right"
														:style="{ maxWidth: '400px' }"
														:show="activeDetailPopover === cwe.cweId"
														@update:show="(show) => activeDetailPopover = show ? cwe.cweId : null"
													>
														<template #trigger>
															<n-button
																text
																size="small"
																class="info-button"
																:class="{ 'info-button-active': activeDetailPopover === cwe.cweId }"
																@click.stop
															>
																<template #icon>
																	<SvgIcon icon="ri:information-line" />
																</template>
															</n-button>
														</template>
														<div class="cwe-detail-popover">
															<div class="detail-header">
																<div class="detail-title">{{ cwe.cweId }}</div>
																<div class="detail-name">{{ getCweName(cwe.cweId) }}</div>
															</div>
															<div class="detail-meta">
																<n-space :size="6" wrap>
																	<n-tooltip v-if="getCweAbstraction(cwe.cweId)" trigger="hover" placement="top">
																		<template #trigger>
																			<n-tag size="small" type="info">
																				{{ getAbstractionLabel(getCweAbstraction(cwe.cweId)!) }}
																			</n-tag>
																		</template>
																		{{ getAbstractionTooltip(getCweAbstraction(cwe.cweId)!) }}
																	</n-tooltip>
																	<n-tooltip v-if="getCweStatus(cwe.cweId)" trigger="hover" placement="top">
																		<template #trigger>
																			<n-tag size="small" :type="getStatusType(getCweStatus(cwe.cweId)!)">
																				{{ getStatusLabel(getCweStatus(cwe.cweId)!) }}
																			</n-tag>
																		</template>
																		{{ getStatusTooltip(getCweStatus(cwe.cweId)!) }}
																	</n-tooltip>
																</n-space>
															</div>
															<div v-if="getCweDescription(cwe.cweId)" class="detail-description">
																{{ getCweDescription(cwe.cweId) }}
															</div>
														</div>
													</n-popover>
												</div>
											</template>
										</n-checkbox>
									</div>
								</n-checkbox-group>
							</div>
						</n-collapse-item>
					</n-collapse>
				</div>

				<!-- 按抽象层级分组 -->
				<div v-else-if="groupMode === 'abstraction'">
					<n-collapse v-model:expanded-names="expandedAbstractions" accordion>
						<n-collapse-item
							v-for="(cwes, abstraction) in groupedByAbstraction"
							:key="abstraction"
							:name="abstraction"
							:title="`${getAbstractionLabel(abstraction)} (${cwes.length})`"
						>
							<template #header-extra>
								<n-checkbox
									:checked="isAbstractionAllSelected(abstraction)"
									:indeterminate="isAbstractionPartiallySelected(abstraction)"
									@click.stop
									@update:checked="(val) => toggleAbstractionSelection(abstraction, val)"
								/>
							</template>
							<div class="abstraction-cwe-list">
								<n-checkbox-group
									:value="selectedCweIds"
									@update:value="handleCweSelectionChange"
								>
									<div
										v-for="cwe in cwes"
										:key="cwe.cweId"
										class="cwe-item"
										:class="{ 'cwe-item-selected': selectedCweIds.includes(cwe.cweId) }"
									>
										<n-checkbox :value="cwe.cweId">
											<template #default>
												<div class="cwe-item-content">
													<div class="cwe-item-main">
														<span class="cwe-id">{{ cwe.cweId }}</span>
														<span class="cwe-name">{{ cwe.nameZh || cwe.nameEn }}</span>
														<n-tag
															v-if="selectionHistoryMap.has(cwe.cweId) && selectionHistoryMap.get(cwe.cweId) !== 'abstraction'"
															size="small"
															type="info"
															:style="{ marginLeft: '8px', fontSize: '11px' }"
														>
															{{ getModeLabel(selectionHistoryMap.get(cwe.cweId)!) }}
														</n-tag>
													</div>
													<n-popover
														trigger="click"
														placement="right"
														:style="{ maxWidth: '400px' }"
														:show="activeDetailPopover === cwe.cweId"
														@update:show="(show) => activeDetailPopover = show ? cwe.cweId : null"
													>
														<template #trigger>
															<n-button
																text
																size="small"
																class="info-button"
																:class="{ 'info-button-active': activeDetailPopover === cwe.cweId }"
																@click.stop
															>
																<template #icon>
																	<SvgIcon icon="ri:information-line" />
																</template>
															</n-button>
														</template>
														<div class="cwe-detail-popover">
															<div class="detail-header">
																<div class="detail-title">{{ cwe.cweId }}</div>
																<div class="detail-name">{{ cwe.nameZh || cwe.nameEn }}</div>
															</div>
															<div class="detail-meta">
																<n-space :size="6" wrap>
																	<n-tooltip v-if="cwe.weaknessAbstraction" trigger="hover" placement="top">
																		<template #trigger>
																			<n-tag size="small" type="info">
																				{{ getAbstractionLabel(cwe.weaknessAbstraction) }}
																			</n-tag>
																		</template>
																		{{ getAbstractionTooltip(cwe.weaknessAbstraction) }}
																	</n-tooltip>
																	<n-tooltip v-if="cwe.status" trigger="hover" placement="top">
																		<template #trigger>
																			<n-tag size="small" :type="getStatusType(cwe.status)">
																				{{ getStatusLabel(cwe.status) }}
																			</n-tag>
																		</template>
																		{{ getStatusTooltip(cwe.status) }}
																	</n-tooltip>
																</n-space>
															</div>
															<div v-if="cwe.descriptionZh || cwe.descriptionEn" class="detail-description">
																{{ cwe.descriptionZh || cwe.descriptionEn }}
															</div>
														</div>
													</n-popover>
												</div>
											</template>
										</n-checkbox>
									</div>
								</n-checkbox-group>
							</div>
						</n-collapse-item>
					</n-collapse>
				</div>

				<!-- 平铺列表（搜索结果） -->
				<div v-else>
					<div class="flat-cwe-list">
						<n-checkbox-group
							:value="selectedCweIds"
							@update:value="handleCweSelectionChange"
						>
							<div
								v-for="cwe in filteredCweList"
								:key="cwe.cweId"
								class="cwe-item"
								:class="{ 'cwe-item-selected': selectedCweIds.includes(cwe.cweId) }"
							>
								<n-checkbox :value="cwe.cweId">
									<template #default>
										<div class="cwe-item-content">
											<div class="cwe-item-main">
												<span class="cwe-id">{{ cwe.cweId }}</span>
												<span class="cwe-name">{{ cwe.nameZh || cwe.nameEn }}</span>
												<n-tag
													v-if="cwe.weaknessAbstraction"
													size="small"
													:style="{ backgroundColor: '#F0F0F0', color: '#707070', marginLeft: '8px' }"
												>
													{{ cwe.weaknessAbstraction }}
												</n-tag>
												<n-tag
													v-if="selectionHistoryMap.has(cwe.cweId) && selectionHistoryMap.get(cwe.cweId) !== 'flat'"
													size="small"
													type="info"
													:style="{ marginLeft: '8px', fontSize: '11px' }"
												>
													{{ getModeLabel(selectionHistoryMap.get(cwe.cweId)!) }}
												</n-tag>
											</div>
											<n-popover
												trigger="click"
												placement="right"
												:style="{ maxWidth: '400px' }"
												:show="activeDetailPopover === cwe.cweId"
												@update:show="(show) => activeDetailPopover = show ? cwe.cweId : null"
											>
												<template #trigger>
													<n-button
														text
														size="small"
														class="info-button"
														:class="{ 'info-button-active': activeDetailPopover === cwe.cweId }"
														@click.stop
													>
														<template #icon>
															<SvgIcon icon="ri:information-line" />
														</template>
													</n-button>
												</template>
												<div class="cwe-detail-popover">
													<div class="detail-header">
														<div class="detail-title">{{ cwe.cweId }}</div>
														<div class="detail-name">{{ cwe.nameZh || cwe.nameEn }}</div>
													</div>
													<div class="detail-meta">
														<n-space :size="6" wrap>
															<n-tooltip v-if="cwe.weaknessAbstraction" trigger="hover" placement="top">
																<template #trigger>
																	<n-tag size="small" type="info">
																		{{ getAbstractionLabel(cwe.weaknessAbstraction) }}
																	</n-tag>
																</template>
																{{ getAbstractionTooltip(cwe.weaknessAbstraction) }}
															</n-tooltip>
															<n-tooltip v-if="cwe.status" trigger="hover" placement="top">
																<template #trigger>
																	<n-tag size="small" :type="getStatusType(cwe.status)">
																		{{ getStatusLabel(cwe.status) }}
																	</n-tag>
																</template>
																{{ getStatusTooltip(cwe.status) }}
															</n-tooltip>
														</n-space>
													</div>
													<div v-if="cwe.descriptionZh || cwe.descriptionEn" class="detail-description">
														{{ cwe.descriptionZh || cwe.descriptionEn }}
													</div>
												</div>
											</n-popover>
										</div>
									</template>
								</n-checkbox>
							</div>
						</n-checkbox-group>
					</div>
				</div>
			</div>
		</div>

		<!-- 底部操作栏 -->
		<template #footer>
			<div class="selector-footer">
				<n-space>
					<n-button @click="handleSelectAll">全选</n-button>
					<n-button @click="handleClearAll">清空</n-button>
					<n-button @click="handleCancel">取消</n-button>
					<n-button type="primary" @click="handleConfirm">确定</n-button>
				</n-space>
			</div>
		</template>
	</n-modal>

	<!-- 已选择项详情模态框 -->
	<n-modal
		v-model:show="showSelectedDetailModal"
		preset="card"
		:style="{ width: '600px', maxWidth: '90vw' }"
		title="已选择的漏洞类型"
		:closable="true"
	>
		<div class="selected-detail-modal">
			<div class="detail-header">
				<n-input
					v-model:value="selectedDetailSearchKeyword"
					placeholder="搜索已选择的漏洞类型"
					clearable
					size="medium"
				>
					<template #prefix>
						<SvgIcon icon="ri:search-line" />
					</template>
				</n-input>
				<div class="detail-count">共 {{ filteredSelectedItems.length }} 项</div>
			</div>
			<div class="detail-content">
				<n-empty v-if="filteredSelectedItems.length === 0" description="没有匹配的项" />
				<n-space v-else :size="8" wrap>
					<n-tag
						v-for="cweId in filteredSelectedItems"
						:key="cweId"
						closable
						@close="removeSelection(cweId)"
						:style="{ backgroundColor: '#F5F5F5', color: '#606060' }"
					>
						{{ getCweDisplayName(cweId) }}
					</n-tag>
				</n-space>
			</div>
		</div>
		<template #footer>
			<div class="detail-footer">
				<n-space>
					<n-button @click="handleClearAll">清空全部</n-button>
					<n-button type="primary" @click="showSelectedDetailModal = false">关闭</n-button>
				</n-space>
			</div>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
	import { ref, computed, watch, onMounted, nextTick } from "vue";
	import {
		NModal,
		NInput,
		NSpace,
		NTag,
		NButton,
		NTabs,
		NTabPane,
		NBadge,
		NCollapse,
		NCollapseItem,
		NCheckbox,
		NCheckboxGroup,
		NTooltip,
		NPopover,
		NEmpty,
		NSpin,
	} from "naive-ui";
	import { SvgIcon } from "@/components/common";
	import {
		getCweReferenceListAll,
		getCweClusterListAll,
		getCweClusterMappingsByCluster,
		type CweReference,
		type CweCluster,
		type CweClusterMapping,
	} from "@/api/cwe";

	interface Props {
		modelValue: boolean;
		selectedValues?: string[];
	}

	interface Emits {
		(e: "update:modelValue", value: boolean): void;
		(e: "confirm", values: string[]): void;
		(e: "cancel"): void;
	}

	const props = withDefaults(defineProps<Props>(), {
		selectedValues: () => [],
	});

	const emit = defineEmits<Emits>();

	const showModal = computed({
		get: () => props.modelValue,
		set: (val) => emit("update:modelValue", val),
	});

	const searchKeyword = ref("");
	const groupMode = ref<"cluster" | "abstraction" | "flat">("cluster");
	const selectedCweIds = ref<string[]>([]);
	const expandedClusters = ref<string[]>([]);
	const expandedAbstractions = ref<string[]>([]);
	const selectionHistory = ref<Map<string, string>>(new Map());

	const selectionHistoryMap = computed(() => selectionHistory.value);

	const visibleSelectedTags = computed(() => {
		return selectedCweIds.value.slice(0, compactThreshold);
	});

	const filteredSelectedItems = computed(() => {
		if (!selectedDetailSearchKeyword.value.trim()) {
			return selectedCweIds.value;
		}
		const keyword = selectedDetailSearchKeyword.value.toLowerCase();
		return selectedCweIds.value.filter(cweId => {
			const displayName = getCweDisplayName(cweId).toLowerCase();
			return displayName.includes(keyword);
		});
	});

	const allCweList = ref<CweReference[]>([]);
	const allClusters = ref<CweCluster[]>([]);
	const clusterMappings = ref<Map<string, CweClusterMapping[]>>(new Map());
	const loading = ref(false);
	const showSelectedDetailModal = ref(false);
	const selectedDetailSearchKeyword = ref("");
	const compactThreshold = 5;
	const activeDetailPopover = ref<string | null>(null);
	const selectedStatuses = ref<string[]>(["Stable", "Draft"]);
	const statusFilterLoading = ref(false);

	onMounted(async () => {
		await loadData();
	});

	watch(() => props.selectedValues, (newVal) => {
		selectedCweIds.value = [...(newVal || [])];
		updateSelectionHistory();
	}, { immediate: true });

	watch(() => props.modelValue, (newVal) => {
		if (newVal) {
			groupMode.value = "cluster";
			selectedCweIds.value = [...(props.selectedValues || [])];
			updateSelectionHistory();
		}
	});

	async function loadData() {
		loading.value = true;
		try {
			const [cweRes, clusterRes] = await Promise.all([
				getCweReferenceListAll(),
				getCweClusterListAll("kmeans"),
			]);
			if (cweRes.code === 200) {
				allCweList.value = cweRes.data || [];
			}
			if (clusterRes.code === 200) {
				allClusters.value = clusterRes.data || [];
				await loadClusterMappings();
			}
		} catch (error) {
			console.error("加载CWE数据失败:", error);
		} finally {
			loading.value = false;
		}
	}

	async function loadClusterMappings() {
		for (const cluster of allClusters.value) {
			if (cluster.clusterId !== undefined && cluster.clusterMethod) {
				try {
					const res = await getCweClusterMappingsByCluster(cluster.clusterId, cluster.clusterMethod);
					if (res.code === 200) {
						const key = `${cluster.clusterId}-${cluster.clusterMethod}`;
						clusterMappings.value.set(key, res.data || []);
					}
				} catch (error) {
					console.error(`加载分组映射失败: ${cluster.clusterId}`, error);
				}
			}
		}
	}

	const filteredCweList = computed(() => {
		if (selectedStatuses.value.length === 0) {
			return [];
		}
		let result = allCweList.value.filter(cwe => {
			if (!cwe.status) return false;
			return selectedStatuses.value.includes(cwe.status);
		});
		if (searchKeyword.value.trim()) {
			const keyword = searchKeyword.value.toLowerCase();
			result = result.filter(cwe => {
				return cwe.cweId?.toLowerCase().includes(keyword) ||
					cwe.nameZh?.toLowerCase().includes(keyword) ||
					cwe.nameEn?.toLowerCase().includes(keyword) ||
					cwe.descriptionZh?.toLowerCase().includes(keyword) ||
					cwe.descriptionEn?.toLowerCase().includes(keyword);
			});
		}
		return result;
	});

	const filteredClusters = computed(() => {
		if (selectedStatuses.value.length === 0) {
			return [];
		}
		const keyword = searchKeyword.value.trim() ? searchKeyword.value.toLowerCase() : "";
		return allClusters.value.filter(cluster => {
			const clusterCwes = getClusterCwes(cluster);
			return clusterCwes.some(cwe => {
				const cweData = allCweList.value.find(c => c.cweId === cwe.cweId);
				if (!cweData || !cweData.status) return false;
				if (!selectedStatuses.value.includes(cweData.status)) {
					return false;
				}
				if (keyword) {
					return cweData.cweId?.toLowerCase().includes(keyword) ||
						cweData.nameZh?.toLowerCase().includes(keyword) ||
						cweData.nameEn?.toLowerCase().includes(keyword);
				}
				return true;
			});
		});
	});

	const groupedByAbstraction = computed(() => {
		const groups: Record<string, CweReference[]> = {};
		filteredCweList.value.forEach(cwe => {
			const key = cwe.weaknessAbstraction || "未分类";
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(cwe);
		});
		return groups;
	});

	function getClusterCwes(cluster: CweCluster): CweClusterMapping[] {
		if (cluster.clusterId === undefined || !cluster.clusterMethod) {
			return [];
		}
		const key = `${cluster.clusterId}-${cluster.clusterMethod}`;
		return clusterMappings.value.get(key) || [];
	}

	function getFilteredClusterCwes(cluster: CweCluster): CweClusterMapping[] {
		const clusterCwes = getClusterCwes(cluster);
		if (selectedStatuses.value.length === 0) {
			return [];
		}
		return clusterCwes.filter(cwe => {
			const cweData = allCweList.value.find(c => c.cweId === cwe.cweId);
			if (!cweData || !cweData.status) return false;
			return selectedStatuses.value.includes(cweData.status);
		});
	}

	function getCweDisplayName(cweId: string): string {
		const cwe = allCweList.value.find(c => c.cweId === cweId);
		if (!cwe) return cweId;
		return `${cweId}${cwe.nameZh ? ': ' + cwe.nameZh : cwe.nameEn ? ': ' + cwe.nameEn : ''}`;
	}

	function getCweName(cweId: string): string {
		const cwe = allCweList.value.find(c => c.cweId === cweId);
		return cwe?.nameZh || cwe?.nameEn || "";
	}

	function getCweDescription(cweId: string): string {
		const cwe = allCweList.value.find(c => c.cweId === cweId);
		return cwe?.descriptionZh || cwe?.descriptionEn || "";
	}

	function getCweDetailInfo(cweId: string): boolean {
		const cwe = allCweList.value.find(c => c.cweId === cweId);
		return !!(cwe?.descriptionZh || cwe?.descriptionEn || cwe?.status || cwe?.weaknessAbstraction);
	}

	function getCweAbstraction(cweId: string): string | null {
		const cwe = allCweList.value.find(c => c.cweId === cweId);
		return cwe?.weaknessAbstraction || null;
	}

	function getCweStatus(cweId: string): string | null {
		const cwe = allCweList.value.find(c => c.cweId === cweId);
		return cwe?.status || null;
	}

	function getAbstractionLabel(abstraction: string): string {
		const labels: Record<string, string> = {
			Base: "基础弱点",
			Variant: "变体",
			Class: "类",
			Compound: "复合",
		};
		return labels[abstraction] || abstraction;
	}

	function getAbstractionTooltip(abstraction: string): string {
		const tooltips: Record<string, string> = {
			Base: "基础弱点：描述特定漏洞类型的核心问题",
			Variant: "变体：基础弱点的具体实现变体",
			Class: "类：一组相关的弱点类型集合",
			Compound: "复合：由多个弱点组合而成的复杂漏洞",
		};
		return tooltips[abstraction] || abstraction;
	}

	function getStatusLabel(status: string): string {
		const labels: Record<string, string> = {
			Draft: "草案",
			Incomplete: "不完整",
			Stable: "稳定",
			Deprecated: "已弃用",
		};
		return labels[status] || status;
	}

	function getStatusTooltip(status: string): string {
		const tooltips: Record<string, string> = {
			Draft: "草案：该弱点定义仍在开发中，可能不完整",
			Incomplete: "不完整：该弱点定义缺少部分信息，需要进一步完善",
			Stable: "稳定：该弱点定义已完成，内容相对完整和准确",
			Deprecated: "已弃用：该弱点定义已被废弃，不再推荐使用",
		};
		return tooltips[status] || status;
	}

	function getStatusType(status: string): "default" | "info" | "success" | "warning" | "error" {
		const typeMap: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
			Draft: "default",
			Incomplete: "warning",
			Stable: "success",
			Deprecated: "error",
		};
		return typeMap[status] || "default";
	}

	function getClusterDisplayTitle(cluster: CweCluster): string {
		let name = cluster.clusterNameZh || cluster.clusterNameEn || "未命名分组";
		name = fixEncoding(name);
		const filteredCwes = getFilteredClusterCwes(cluster);
		const count = filteredCwes.length;
		const selectedCount = filteredCwes.filter(cwe => selectedCweIds.value.includes(cwe.cweId)).length;
		if (selectedCount > 0) {
			return `${name} (${selectedCount}/${count})`;
		}
		return `${name} (${count})`;
	}

	function fixEncoding(text: string | undefined): string {
		if (!text) return "";
		// 如果已经是正确的中文，直接返回
		if (/[\u4e00-\u9fa5]/.test(text)) {
			return text;
		}
		// 尝试修复 Latin-1 被误读为 UTF-8 的情况
		// 这种情况通常发生在：UTF-8 字节被当作 Latin-1 字符存储，然后又被当作 UTF-8 读取
		try {
			// 将字符串的每个字符转换为字节（假设当前是 Latin-1 编码的字符）
			const bytes = new Uint8Array(
				text.split('').map(c => {
					const code = c.charCodeAt(0);
					// 如果字符码超过 255，取模（这种情况不应该发生，但保险起见）
					return code > 255 ? code % 256 : code;
				})
			);
			// 将字节重新解释为 UTF-8
			const decoder = new TextDecoder('utf-8', { fatal: false });
			const fixed = decoder.decode(bytes);
			// 检查是否包含中文字符
			if (/[\u4e00-\u9fa5]/.test(fixed)) {
				return fixed;
			}
		} catch (e) {
			// 忽略错误
		}
		// 如果修复失败，返回原文本
		return text;
	}

	function getModeLabel(mode: string): string {
		const labels: Record<string, string> = {
			cluster: "分组",
			abstraction: "层级",
			flat: "列表",
		};
		return labels[mode] || mode;
	}

	function isClusterAllSelected(cluster: CweCluster): boolean {
		const clusterCwes = getFilteredClusterCwes(cluster);
		return clusterCwes.length > 0 && clusterCwes.every(cwe => selectedCweIds.value.includes(cwe.cweId));
	}

	function isClusterPartiallySelected(cluster: CweCluster): boolean {
		const clusterCwes = getFilteredClusterCwes(cluster);
		const selectedCount = clusterCwes.filter(cwe => selectedCweIds.value.includes(cwe.cweId)).length;
		return selectedCount > 0 && selectedCount < clusterCwes.length;
	}

	function toggleClusterSelection(cluster: CweCluster, checked: boolean) {
		const clusterCwes = getFilteredClusterCwes(cluster);
		const cweIds = clusterCwes.map(cwe => cwe.cweId);
		if (checked) {
			selectedCweIds.value = [...new Set([...selectedCweIds.value, ...cweIds])];
		} else {
			selectedCweIds.value = selectedCweIds.value.filter(id => !cweIds.includes(id));
		}
		updateSelectionHistory();
	}

	function isAbstractionAllSelected(abstraction: string): boolean {
		const cwes = groupedByAbstraction.value[abstraction] || [];
		return cwes.length > 0 && cwes.every(cwe => selectedCweIds.value.includes(cwe.cweId));
	}

	function isAbstractionPartiallySelected(abstraction: string): boolean {
		const cwes = groupedByAbstraction.value[abstraction] || [];
		const selectedCount = cwes.filter(cwe => selectedCweIds.value.includes(cwe.cweId)).length;
		return selectedCount > 0 && selectedCount < cwes.length;
	}

	function toggleAbstractionSelection(abstraction: string, checked: boolean) {
		const cwes = groupedByAbstraction.value[abstraction] || [];
		const cweIds = cwes.map(cwe => cwe.cweId);
		if (checked) {
			selectedCweIds.value = [...new Set([...selectedCweIds.value, ...cweIds])];
		} else {
			selectedCweIds.value = selectedCweIds.value.filter(id => !cweIds.includes(id));
		}
		updateSelectionHistory();
	}

	function handleCweSelectionChange(values: (string | number)[]) {
		selectedCweIds.value = values.map(v => String(v));
		updateSelectionHistory();
	}

	function updateSelectionHistory() {
		selectedCweIds.value.forEach(cweId => {
			if (!selectionHistory.value.has(cweId)) {
				selectionHistory.value.set(cweId, groupMode.value);
			}
		});
	}

	function getSelectedCountInMode(mode: "cluster" | "abstraction" | "flat"): number {
		if (mode === "cluster") {
			return filteredClusters.value.reduce((count, cluster) => {
				const clusterCwes = getFilteredClusterCwes(cluster);
				return count + clusterCwes.filter(cwe => selectedCweIds.value.includes(cwe.cweId)).length;
			}, 0);
		} else if (mode === "abstraction") {
			return Object.values(groupedByAbstraction.value).reduce((count, cwes) => {
				return count + cwes.filter(cwe => selectedCweIds.value.includes(cwe.cweId)).length;
			}, 0);
		} else {
			return filteredCweList.value.filter(cwe => selectedCweIds.value.includes(cwe.cweId)).length;
		}
	}

	function handleStatusChange() {
		statusFilterLoading.value = true;
		nextTick(() => {
			setTimeout(() => {
				statusFilterLoading.value = false;
			}, 100);
		});
	}

	function handleSearch() {
		// 搜索时保持当前视图，不自动切换
	}

	function removeSelection(cweId: string) {
		selectedCweIds.value = selectedCweIds.value.filter(id => id !== cweId);
		selectionHistory.value.delete(cweId);
	}

	function handleSelectAll() {
		selectedCweIds.value = filteredCweList.value.map(cwe => cwe.cweId);
		updateSelectionHistory();
	}

	function handleClearAll() {
		selectedCweIds.value = [];
		selectionHistory.value.clear();
	}

	function handleCancel() {
		selectedCweIds.value = [...(props.selectedValues || [])];
		searchKeyword.value = "";
		selectionHistory.value.clear();
		emit("cancel");
		showModal.value = false;
	}

	function handleConfirm() {
		emit("confirm", selectedCweIds.value);
		searchKeyword.value = "";
		selectionHistory.value.clear();
		showModal.value = false;
	}

	function handleModalShowChange(show: boolean) {
		if (!show) {
			selectedCweIds.value = [...(props.selectedValues || [])];
			searchKeyword.value = "";
			selectionHistory.value.clear();
			showSelectedDetailModal.value = false;
			selectedDetailSearchKeyword.value = "";
			activeDetailPopover.value = null;
		} else {
			groupMode.value = "cluster";
			updateSelectionHistory();
			showSelectedDetailModal.value = false;
			selectedDetailSearchKeyword.value = "";
			activeDetailPopover.value = null;
		}
	}
</script>

<style scoped lang="scss">
	.cwe-selector {
		display: flex;
		flex-direction: column;
		height: 600px;
	}

	.selector-header {
		margin-bottom: 16px;
	}

	.selected-tags {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid #E0E0E0;
	}

	.selected-count {
		font-size: 12px;
		color: #808080;
		margin-bottom: 8px;
		display: flex;
		align-items: center;
	}

	.selected-tags-container {
		max-height: 80px;
		overflow-y: auto;
		padding: 4px 0;
	}

	.count-text {
		font-weight: 500;
		color: #202020;
	}

	.selected-detail-modal {
		display: flex;
		flex-direction: column;
		height: 500px;
	}

	.detail-header {
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.detail-count {
		font-size: 12px;
		color: #808080;
		white-space: nowrap;
	}

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		border: 1px solid #E0E0E0;
		border-radius: 4px;
		background-color: #FAFAFA;
	}

	.detail-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 16px;
		border-top: 1px solid #E0E0E0;
	}

	.status-filter {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		margin-bottom: 12px;
		background-color: #FAFAFA;
		border: 1px solid #E8E8E8;
		border-radius: 6px;
		.status-filter-label {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 13px;
			color: #606060;
			font-weight: 500;
			white-space: nowrap;
			.filter-icon {
				font-size: 16px;
				color: #808080;
			}
			margin-right: 12px;
		}
		.status-checkbox {
			:deep(.n-checkbox__label) {
				padding-left: 6px;
			}
			.status-label {
				font-size: 13px;
				transition: color 0.2s;
			}
			&.status-stable {
				:deep(.n-checkbox-box--checked) {
					background-color: #18A058;
					border-color: #18A058;
				}
				.status-label {
					color: #606060;
				}
			}
			&.status-draft {
				:deep(.n-checkbox-box--checked) {
					background-color: #2080F0;
					border-color: #2080F0;
				}
				.status-label {
					color: #606060;
				}
			}
			&.status-incomplete {
				:deep(.n-checkbox-box--checked) {
					background-color: #F0A020;
					border-color: #F0A020;
				}
				.status-label {
					color: #606060;
				}
			}
			&.status-deprecated {
				:deep(.n-checkbox-box--checked) {
					background-color: #D03050;
					border-color: #D03050;
				}
				.status-label {
					color: #606060;
				}
			}
		}
	}

	.group-mode-tabs {
		margin-bottom: 16px;
		:deep(.n-tabs-nav) {
			margin-bottom: 0;
		}
		.tab-label {
			display: flex;
			align-items: center;
			gap: 6px;
			.tab-icon {
				font-size: 16px;
			}
		}
	}

	.selector-content {
		flex: 1;
		overflow-y: auto;
		border: 1px solid #E0E0E0;
		border-radius: 4px;
		padding: 8px;
	}

	.cluster-cwe-list,
	.abstraction-cwe-list,
	.flat-cwe-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cwe-item {
		padding: 8px;
		border-radius: 4px;
		transition: background-color 0.2s;

		&:hover {
			background-color: #F5F5F5;
		}

		&.cwe-item-selected {
			background-color: #F0F7FF;
			border-left: 3px solid #2080F0;
		}
	}

	.cwe-item-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	.cwe-item-main {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.cwe-id {
		font-weight: 500;
		color: #202020;
		font-family: 'Courier New', monospace;
	}

	.cwe-name {
		color: #606060;
	}

	.info-button {
		flex-shrink: 0;
		margin-left: 8px;
		padding: 4px;
		min-width: 24px;
		height: 24px;
		display: inline-flex;
		align-items: center;
		justify-content: center;

		:deep(.n-button__icon) {
			font-size: 18px;
			color: #808080;
			transition: color 0.2s;
		}

		&:hover :deep(.n-button__icon) {
			color: #1890ff;
		}

		&.info-button-active :deep(.n-button__icon) {
			color: #1890ff;
		}
	}

	.cwe-detail-popover {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.detail-header {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding-bottom: 6px;
		border-bottom: 1px solid #E0E0E0;
	}

	.detail-title {
		font-weight: 600;
		font-size: 14px;
		color: #202020;
	}

	.detail-name {
		font-size: 13px;
		color: #606060;
		line-height: 1.4;
	}

	.detail-meta {
		display: flex;
		align-items: center;
		margin-top: 2px;
	}

	.detail-description {
		font-size: 12px;
		color: #707070;
		line-height: 1.6;
		max-height: 200px;
		overflow-y: auto;
		word-break: break-word;
		margin-top: 2px;
	}

	.selector-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 16px;
		border-top: 1px solid #E0E0E0;
	}
</style>

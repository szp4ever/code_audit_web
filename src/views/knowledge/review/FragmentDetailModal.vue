<template>
	<n-modal
		v-model:show="showModal"
		preset="card"
		title="片段详情"
		:mask-closable="true"
		:close-on-esc="true"
		style="width: 900px; max-width: 95vw; max-height: 85vh;"
		:show-footer="false"
	>
		<n-spin :show="!props.fragment">
			<template v-if="props.fragment">
				<n-space vertical :size="20">
					<!-- 基本信息 -->
					<div class="detail-section">
						<h3 class="section-title">基本信息</h3>
						<n-descriptions :column="2" bordered size="small">
							<n-descriptions-item label="片段索引">
								片段#{{ (props.fragment.chunkIndex ?? props.fragment.idx ?? 0) + 1 }}
							</n-descriptions-item>
							<n-descriptions-item label="片段ID" v-if="props.fragment.fid">
								{{ props.fragment.fid }}
							</n-descriptions-item>
							<n-descriptions-item label="相似度" v-if="props.fragment.similarity !== null && props.fragment.similarity !== undefined">
								<n-tag
									:type="props.fragment.similarity >= 0.85 ? 'success' : props.fragment.similarity >= 0.7 ? 'warning' : 'default'"
									size="small"
								>
									{{ (props.fragment.similarity * 100).toFixed(1) }}%
								</n-tag>
							</n-descriptions-item>
							<n-descriptions-item label="创建时间" v-if="props.fragment.createTime">
								{{ formatDateTime(props.fragment.createTime) }}
							</n-descriptions-item>
						</n-descriptions>
					</div>

					<!-- 匹配信息 -->
					<div class="detail-section" v-if="props.fragment.matchedItemUuid || props.fragment.matchedItemTitle">
						<h3 class="section-title">匹配信息</h3>
						<n-descriptions :column="1" bordered size="small">
							<n-descriptions-item label="匹配到的条目" v-if="props.fragment.matchedItemTitle">
								{{ props.fragment.matchedItemTitle }}
							</n-descriptions-item>
							<n-descriptions-item label="条目UUID" v-if="props.fragment.matchedItemUuid">
								{{ props.fragment.matchedItemUuid }}
							</n-descriptions-item>
							<n-descriptions-item label="用户决策" v-if="props.fragment.userDecision">
								<n-tag size="small" :type="getDecisionTagType(props.fragment.userDecision)">
									{{ getDecisionLabel(props.fragment.userDecision) }}
								</n-tag>
							</n-descriptions-item>
						</n-descriptions>
					</div>

					<!-- 片段内容 -->
					<div class="detail-section">
						<h3 class="section-title">片段内容</h3>
						<div class="content-display">
							{{ props.fragment.content || '无内容' }}
						</div>
					</div>

					<!-- 元数据 -->
					<div class="detail-section" v-if="hasMetadata">
						<h3 class="section-title">元数据</h3>
						<n-descriptions :column="1" bordered size="small">
							<n-descriptions-item label="漏洞类型" v-if="props.fragment.vulnerabilityType">
								{{ props.fragment.vulnerabilityType }}
							</n-descriptions-item>
							<n-descriptions-item label="适用语言" v-if="props.fragment.language">
								{{ props.fragment.language }}
							</n-descriptions-item>
							<n-descriptions-item label="备注" v-if="props.fragment.remark">
								{{ props.fragment.remark }}
							</n-descriptions-item>
							<n-descriptions-item label="更新时间" v-if="props.fragment.updateTime">
								{{ formatDateTime(props.fragment.updateTime) }}
							</n-descriptions-item>
						</n-descriptions>
					</div>
				</n-space>
			</template>
		</n-spin>
	</n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NSpace, NDescriptions, NDescriptionsItem, NTag, NSpin } from 'naive-ui'

interface Props {
	show: boolean
	fragment: any | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
	'update:show': [value: boolean]
}>()

const showModal = computed({
	get: () => props.show,
	set: (val) => emit('update:show', val)
})

const hasMetadata = computed(() => {
	return !!(props.fragment?.vulnerabilityType || props.fragment?.language || props.fragment?.remark || props.fragment?.updateTime)
})

function formatDateTime(date: string | Date): string {
	if (!date) return '-'
	try {
		const d = typeof date === 'string' ? new Date(date) : date
		return d.toLocaleString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
	} catch {
		return String(date)
	}
}

function getDecisionTagType(decision: string): 'default' | 'success' | 'warning' | 'error' {
	const types: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
		keep: 'success',
		change: 'warning',
		create_new: 'default'
	}
	return types[decision] || 'default'
}

function getDecisionLabel(decision: string): string {
	const labels: Record<string, string> = {
		keep: '保持',
		change: '更改',
		create_new: '创建新条目'
	}
	return labels[decision] || decision
}
</script>

<style scoped>
.detail-section {
	padding: 0;
}

.section-title {
	margin: 0 0 12px 0;
	font-size: 16px;
	font-weight: 600;
	color: #202020;
}

.content-display {
	padding: 16px;
	background: #fafafa;
	border: 1px solid #e8e8e8;
	border-radius: 4px;
	max-height: 400px;
	overflow-y: auto;
	font-size: 13px;
	line-height: 1.8;
	color: #323130;
	white-space: pre-wrap;
	word-break: break-word;
}
</style>

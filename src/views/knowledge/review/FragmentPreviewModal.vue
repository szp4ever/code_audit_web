<template>
	<n-modal
		v-model:show="showModal"
		preset="card"
		title="片段内容预览"
		:mask-closable="true"
		:close-on-esc="true"
		style="width: 700px; max-width: 90vw;"
		:show-footer="false"
	>
		<template v-if="props.fragment">
			<n-space vertical :size="16">
				<div class="fragment-info-row">
					<n-space :size="16">
						<span style="font-size: 13px; color: #666;">片段索引：</span>
						<n-tag size="small" type="info">片段#{{ (props.fragment.chunkIndex ?? props.fragment.idx ?? 0) + 1 }}</n-tag>
						<span v-if="props.fragment.similarity" style="font-size: 13px; color: #666;">相似度：</span>
						<n-tag v-if="props.fragment.similarity" size="small" :type="props.fragment.similarity >= 0.85 ? 'success' : props.fragment.similarity >= 0.7 ? 'warning' : 'default'">
							{{ (props.fragment.similarity * 100).toFixed(1) }}%
						</n-tag>
					</n-space>
				</div>
				<div class="content-display">
					{{ props.fragment.content || '无内容' }}
				</div>
			</n-space>
		</template>
	</n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NSpace, NTag } from 'naive-ui'

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
</script>

<style scoped>
.fragment-info-row {
	padding-bottom: 12px;
	border-bottom: 1px solid #e8e8e8;
}

.content-display {
	padding: 16px;
	background: #fafafa;
	border: 1px solid #e8e8e8;
	border-radius: 4px;
	max-height: 60vh;
	overflow-y: auto;
	font-size: 13px;
	line-height: 1.8;
	color: #323130;
	white-space: pre-wrap;
	word-break: break-word;
}

.content-display::-webkit-scrollbar {
	width: 6px;
}

.content-display::-webkit-scrollbar-track {
	background: #F5F5F5;
	border-radius: 3px;
}

.content-display::-webkit-scrollbar-thumb {
	background: #D0D0D0;
	border-radius: 3px;
	transition: background 0.2s ease;
}

.content-display::-webkit-scrollbar-thumb:hover {
	background: #A8A8A8;
}
</style>

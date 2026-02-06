<template>
	<div class="fragment-info-panel">
		<div v-if="fragmentInfo.loading" class="loading-container">
			<n-spin size="large" />
		</div>
		<n-space v-else-if="fragmentInfo.error" vertical :size="16" style="padding: 20px;">
			<div style="color: #f5222d; font-size: 14px;">加载片段信息失败：{{ fragmentInfo.error }}</div>
		</n-space>
		<n-space v-else-if="fragmentInfo.data" vertical :size="16">
			<div class="fragment-info-item">
				<span class="fragment-label">片段索引：</span>
				<span class="fragment-value">{{ fragmentInfo.data.idx ?? fragmentInfo.data.chunkIndex ?? '-' }}</span>
			</div>
			<div v-if="fragmentInfo.data.docName" class="fragment-info-item">
				<span class="fragment-label">来源文档：</span>
				<span class="fragment-value">{{ fragmentInfo.data.docName }}</span>
			</div>
			<div v-if="fragmentInfo.data.content" class="fragment-content-section">
				<div class="fragment-label" style="margin-bottom: 8px;">片段内容：</div>
				<div class="fragment-content">
					{{ fragmentInfo.data.content }}
				</div>
			</div>
		</n-space>
		<div v-else-if="props.item.chunkIndex !== undefined || props.item.fid !== undefined" style="padding: 20px; color: #999; font-size: 14px;">
			无法获取片段信息（缺少文档ID）
		</div>
		<div v-else style="padding: 20px; color: #999; font-size: 14px;">
			该条目没有对应的原始片段信息
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { NSpace, NSpin } from 'naive-ui'
import { getFragmentBatch } from '@/api/knowledge'

interface Props {
	item: any
	docId?: string
}

const props = defineProps<Props>()

const fragmentInfo = ref<{
	loading: boolean
	data: any | null
	error: string | null
}>({
	loading: false,
	data: null,
	error: null
})

async function loadFragmentInfo() {
	if (!props.item || !props.docId) {
		fragmentInfo.value = { loading: false, data: null, error: null }
		return
	}
	
	const chunkIndex = props.item.chunkIndex
	if (chunkIndex === undefined && props.item.fid === undefined) {
		fragmentInfo.value = { loading: false, data: null, error: null }
		return
	}
	
	fragmentInfo.value = { loading: true, data: null, error: null }
	
	try {
		const response = await getFragmentBatch([{
			docId: props.docId,
			idx: chunkIndex ?? 0
		}])
		
		if (response.code === 200 && response.data && response.data.length > 0) {
			fragmentInfo.value = { loading: false, data: response.data[0], error: null }
		} else {
			fragmentInfo.value = { loading: false, data: null, error: '未找到片段信息' }
		}
	} catch (error: any) {
		fragmentInfo.value = { loading: false, data: null, error: error.message || '加载失败' }
	}
}

watch(() => [props.item, props.docId], () => {
	loadFragmentInfo()
}, { immediate: true })

onMounted(() => {
	loadFragmentInfo()
})
</script>

<style scoped>
.fragment-info-panel {
	padding: 8px 0;
	min-height: 100px;
	position: relative;
}

.loading-container {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40px 20px;
}

.fragment-info-item {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
}

.fragment-label {
	font-weight: 500;
	color: #666;
	min-width: 100px;
}

.fragment-value {
	color: #333;
}

.fragment-content-section {
	margin-top: 12px;
}

.fragment-content {
	padding: 12px;
	background: #f5f5f5;
	border-radius: 4px;
	font-size: 13px;
	line-height: 1.6;
	color: #333;
	white-space: pre-wrap;
	word-break: break-word;
	max-height: 400px;
	overflow-y: auto;
}
</style>

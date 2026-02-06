<template>
	<div class="upload-stats-bar">
		<n-space :size="16" align="center" justify="space-between">
			<div class="stat-item">
				<span class="stat-label">进行中</span>
				<span class="stat-value" :style="{ color: '#FA8C16' }">{{ activeCount }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">等待</span>
				<span class="stat-value" :style="{ color: '#808080' }">{{ waitingCount }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">待审阅</span>
				<span class="stat-value" :style="{ color: '#FA8C16' }">{{ pendingReviewCount }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">成功</span>
				<span class="stat-value" :style="{ color: '#52C41A' }">{{ successCount }}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">失败</span>
				<span class="stat-value" :style="{ color: '#F5222D' }">{{ errorCount }}</span>
			</div>
		</n-space>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSpace } from 'naive-ui'
import { useUploadStore } from '@/store/modules/upload'

const store = useUploadStore()

const activeCount = computed(() => store.activeTaskCount)
const waitingCount = computed(() => store.waitingTasks.length)
const pendingReviewCount = computed(() => store.pendingReviewTasks.length)
const successCount = computed(() => store.successTasks.length)
const errorCount = computed(() => store.errorTasks.length)
</script>

<style scoped>
.upload-stats-bar {
	padding: 12px 16px;
	background: #FAF9F8;
	border-bottom: 1px solid #EDEBE9;
}

.stat-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
}

.stat-label {
	font-size: 12px;
	color: #605E5C;
}

.stat-value {
	font-size: 16px;
	font-weight: 600;
}
</style>

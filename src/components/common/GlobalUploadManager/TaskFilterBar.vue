<template>
	<div class="task-filter-bar">
		<n-space :size="12" align="center" wrap>
			<span class="filter-label">筛选：</span>
			<n-select
				v-model:value="statusFilter"
				:options="statusOptions"
				placeholder="全部状态"
				clearable
				style="width: 120px;"
				size="small"
				@update:value="handleStatusChange"
			/>
			<n-select
				v-model:value="timeFilter"
				:options="timeOptions"
				placeholder="全部时间"
				clearable
				style="width: 120px;"
				size="small"
				@update:value="handleTimeChange"
			/>
			<n-input
				v-model:value="searchKeyword"
				placeholder="搜索文件名..."
				clearable
				style="width: 180px;"
				size="small"
				@update:value="handleSearchChange"
			>
				<template #prefix>
					<SvgIcon icon="ri:search-line" style="font-size: 14px; color: #8C8C8C;" />
				</template>
			</n-input>
			<n-button
				v-if="hasActiveFilters"
				quaternary
				size="small"
				@click="handleClearFilters"
			>
				清除筛选
			</n-button>
		</n-space>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NSelect, NButton, NSpace, NInput } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useUploadStore } from '@/store/modules/upload'

const store = useUploadStore()

const statusFilter = ref<string>(store.filters.status)
const timeFilter = ref<string>(store.filters.time)
const searchKeyword = ref<string>(store.filters.searchKeyword)

const statusOptions = [
	{ label: '全部状态', value: 'all' },
	{ label: '进行中', value: 'active' },
	{ label: '待审阅', value: 'pending' },
	{ label: '已完成', value: 'completed' },
	{ label: '失败', value: 'failed' },
]

const timeOptions = [
	{ label: '全部时间', value: 'all' },
	{ label: '今天', value: 'today' },
	{ label: '本周', value: 'week' },
	{ label: '本月', value: 'month' },
]

const hasActiveFilters = computed(() => {
	return statusFilter.value !== 'all' 
		|| timeFilter.value !== 'all' 
		|| (searchKeyword.value && searchKeyword.value.trim().length > 0)
})

const handleStatusChange = (value: string | null) => {
	statusFilter.value = value || 'all'
	store.setFilters({ status: statusFilter.value as any })
}

const handleTimeChange = (value: string | null) => {
	timeFilter.value = value || 'all'
	store.setFilters({ time: timeFilter.value as any })
}

const handleSearchChange = (value: string | null) => {
	searchKeyword.value = value || ''
	store.setFilters({ searchKeyword: searchKeyword.value })
}

const handleClearFilters = () => {
	statusFilter.value = 'all'
	timeFilter.value = 'all'
	searchKeyword.value = ''
	store.clearFilters()
}

watch(() => store.filters, (newFilters) => {
	if (newFilters.status !== statusFilter.value) {
		statusFilter.value = newFilters.status
	}
	if (newFilters.time !== timeFilter.value) {
		timeFilter.value = newFilters.time
	}
	if (newFilters.searchKeyword !== searchKeyword.value) {
		searchKeyword.value = newFilters.searchKeyword
	}
}, { deep: true })
</script>

<style scoped>
.task-filter-bar {
	padding: 12px 16px;
	background: #FAF9F8;
	border-bottom: 1px solid #EDEBE9;
}

.filter-label {
	font-size: 13px;
	color: #605E5C;
	font-weight: 500;
}
</style>

<template>
	<div class="global-upload-trigger">
		<n-tooltip>
			<template #trigger>
				<n-badge :value="activeCount" :show-zero="false" :max="99">
					<n-button
						quaternary
						:type="activeCount > 0 ? 'primary' : 'default'"
						@click="handleClick"
						class="trigger-button"
					>
						<template #icon>
							<SvgIcon icon="ri:upload-cloud-2-line" :style="{ fontSize: '18px' }" />
						</template>
						<span v-if="showLabel" class="trigger-label">上传</span>
					</n-button>
				</n-badge>
			</template>
			{{ tooltipText }}
		</n-tooltip>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NBadge, NTooltip } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useUploadStore } from '@/store/modules/upload'

interface Props {
	showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	showLabel: false,
})

const emit = defineEmits<{
	click: []
}>()

const store = useUploadStore()
const activeCount = computed(() => store.activeTaskCount)

const tooltipText = computed(() => {
	if (activeCount.value > 0) {
		return `上传任务管理器 (${activeCount.value} 个进行中)`
	}
	return '上传任务管理器'
})

function handleClick() {
	emit('click')
}
</script>

<style scoped>
.global-upload-trigger {
	position: relative;
}

.trigger-button {
	transition: all 0.2s;
}

.trigger-button:hover {
	transform: translateY(-1px);
}

.trigger-label {
	margin-left: 4px;
}
</style>

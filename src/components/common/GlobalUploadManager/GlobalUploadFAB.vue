<template>
	<transition name="fab">
		<n-tooltip v-if="activeCount > 0 || showAlways">
			<template #trigger>
				<div
					class="global-upload-fab"
					:class="{ 'fab-pulse': activeCount > 0 }"
					@click="handleClick"
				>
					<n-badge :value="activeCount" :show-zero="false" :max="99">
						<div class="fab-button">
							<SvgIcon icon="ri:upload-cloud-2-line" :style="{ fontSize: '24px', color: '#FFFFFF' }" />
						</div>
					</n-badge>
				</div>
			</template>
			{{ tooltipText }}
		</n-tooltip>
	</transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NBadge, NTooltip } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useUploadStore } from '@/store/modules/upload'

interface Props {
	showAlways?: boolean
}

const props = withDefaults(defineProps<Props>(), {
	showAlways: false,
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
.global-upload-fab {
	position: fixed;
	bottom: 24px;
	right: 24px;
	z-index: 1000;
	cursor: pointer;
}

.fab-button {
	width: 56px;
	height: 56px;
	border-radius: 50%;
	background: #1a1a1a;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-button:hover {
	background: #2d2d2d;
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	transform: translateY(-2px);
}

.fab-button:active {
	transform: translateY(0);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fab-pulse .fab-button {
	animation: pulse 2s infinite;
}

@keyframes pulse {
	0%, 100% {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}
	50% {
		box-shadow: 0 4px 12px rgba(250, 140, 22, 0.4);
	}
}

.fab-enter-active,
.fab-leave-active {
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-enter-from {
	opacity: 0;
	transform: scale(0.8) translateY(20px);
}

.fab-leave-to {
	opacity: 0;
	transform: scale(0.8) translateY(20px);
}
</style>

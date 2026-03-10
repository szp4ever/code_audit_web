<template>
	<transition name="fab">
		<n-tooltip v-if="hasTasks || showAlways">
			<template #trigger>
				<div
					class="global-upload-fab"
					:class="{ 'fab-pulse': activeCount > 0, 'fab-error': errorCount > 0 }"
					@click="handleClick"
				>
<n-badge 
					:value="badgeValue" 
					:show-zero="false" 
					:max="99"
					:type="badgeType"
				>
					<div class="fab-button" :class="{ 'has-badge': badgeValue > 0 }">
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
const activeCount = computed(() => store.activeTaskCount ?? 0)
const errorCount = computed(() => (store.errorTasks ?? []).length)
const unreadCompletedCount = computed(() => store.unreadCompletedCount ?? 0)
const waitingCount = computed(() => (store.waitingTasks ?? []).length)

const hasTasks = computed(() =>
	activeCount.value > 0 || errorCount.value > 0 || unreadCompletedCount.value > 0 || waitingCount.value > 0
)

/** 
 * 角标类型优先级：错误(红色) > 未读完成(蓝色) > 进行中/等待(默认)
 * 用于决定角标的样式
 */
const badgeType = computed(() => {
	if (errorCount.value > 0) return 'error'      // 红色 - 有失败任务
	if (unreadCompletedCount.value > 0) return 'info'  // 蓝色 - 有新完成的任务未查看
	return 'default'  // 默认 - 进行中或等待
})

/** 角标显示值 */
const badgeValue = computed(() => {
	if (errorCount.value > 0) return errorCount.value
	if (unreadCompletedCount.value > 0) return unreadCompletedCount.value
	if (activeCount.value > 0) return activeCount.value
	if (waitingCount.value > 0) return waitingCount.value
	return 0
})

const tooltipText = computed(() => {
	if (!hasTasks.value) return '上传任务管理器'
	const parts: string[] = []
	if (activeCount.value > 0) parts.push(`${activeCount.value} 进行中`)
	if (waitingCount.value > 0) parts.push(`${waitingCount.value} 等待`)
	if (errorCount.value > 0) parts.push(`${errorCount.value} 失败`)
	if (successCount.value > 0) parts.push(`${successCount.value} 完成`)
	return `上传任务管理器${parts.length ? ` · ${parts.join('、')}` : ''}`
})

function handleClick() {
	emit('click')
}
</script>

<style scoped>
.global-upload-fab {
	position: fixed;
	bottom: var(--global-upload-fab-margin, 24px);
	right: var(--global-upload-fab-margin, 24px);
	z-index: 1000;
	cursor: pointer;
}

.fab-button {
	width: var(--global-upload-fab-size, 56px);
	height: var(--global-upload-fab-size, 56px);
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

.fab-error .fab-button {
	box-shadow: 0 4px 12px rgba(245, 34, 45, 0.35);
}
.fab-error.fab-pulse .fab-button {
	animation: pulse-error 2s infinite;
}
@keyframes pulse-error {
	0%, 100% {
		box-shadow: 0 4px 12px rgba(245, 34, 45, 0.35);
	}
	50% {
		box-shadow: 0 4px 16px rgba(245, 34, 45, 0.55);
	}
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

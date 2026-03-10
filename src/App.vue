<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { NaiveProvider, GlobalUploadManager, GlobalUploadFAB } from '@/components/common'
import RouteProgress from '@/components/common/RouteProgress/index.vue'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import { useUploadStore } from '@/store/modules/upload'
import { uploadService } from '@/services/uploadService'

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()
const uploadStore = useUploadStore()
const uploadManagerRef = ref<InstanceType<typeof GlobalUploadManager> | null>(null)

onMounted(() => {
	uploadStore.restoreTasks()
	uploadStore.waitingTasks.forEach(task => {
		if ((task.status === 'waiting' || task.status === 'pending') && !task.xhr && task.file) {
			uploadService.uploadTask(task.id)
		}
	})
	uploadStore.processingTasks.forEach(task => {
		if (task.docId || task.attachId) {
			uploadService.startProcessingPolling(task.id, String(task.docId || task.attachId))
		}
	})
	uploadService.requestNotificationPermission()
})

onUnmounted(() => {
	uploadService.stopAllPolling()
})

function handleFABClick() {
	uploadManagerRef.value?.show()
}
</script>

<template>
  <NConfigProvider
    class="h-full"
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="language"
  >
    <NaiveProvider>
      <RouteProgress />
      <RouterView />
      <GlobalUploadManager ref="uploadManagerRef" />
      <GlobalUploadFAB show-always @click="handleFABClick" />
    </NaiveProvider>
  </NConfigProvider>
</template>

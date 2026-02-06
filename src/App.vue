<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { NaiveProvider, GlobalUploadManager, GlobalUploadFAB } from '@/components/common'
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
		if (task.status === 'waiting' && !task.xhr) {
			uploadService.uploadTask(task.id)
		}
	})
	uploadStore.processingTasks.forEach(task => {
		if (task.attachId) {
			uploadService.startProcessingPolling(task.id, task.attachId)
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
      <RouterView />
      <GlobalUploadManager ref="uploadManagerRef" />
      <GlobalUploadFAB @click="handleFABClick" />
    </NaiveProvider>
  </NConfigProvider>
</template>

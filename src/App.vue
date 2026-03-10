<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { NaiveProvider } from '@/components/common'
import RouteProgress from '@/components/common/RouteProgress/index.vue'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import { useUploadStore } from '@/store/modules/upload'
import { uploadService } from '@/services/uploadService'
import UploadTaskDrawer from '@/components/knowledge/upload/UploadTaskDrawer.vue'
import UploadTrigger from '@/components/knowledge/upload/UploadTrigger.vue'

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()
const uploadStore = useUploadStore()

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
      <!-- 全局上传任务抽屉（新 v2 版本） -->
      <UploadTaskDrawer />
      <!-- 全局浮动上传入口，使用新的 UploadTrigger（fab 模式），始终可见 -->
      <UploadTrigger type="fab" :show-always="true" />
    </NaiveProvider>
  </NConfigProvider>
</template>

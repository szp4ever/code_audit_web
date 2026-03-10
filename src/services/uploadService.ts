import { useUploadStore, type UploadTask } from '@/store/modules/upload'
import request from '@/utils/request/req'
import { getToken } from '@/store/modules/auth/helper'

/**
 * 上传进度回调
 */
export interface UploadProgressCallbacks {
  onProgress?: (progress: number, uploadedBytes: number, totalBytes: number) => void
  onSpeedUpdate?: (speed: number, eta: number) => void
}

/**
 * 上传服务
 */
class UploadService {
  private store = useUploadStore()
  private speedTrackers = new Map<string, SpeedTracker>()
  private pollingTimers = new Map<string, ReturnType<typeof setInterval>>()

  /**
   * 添加上传任务
   */
  addTasks(files: File[], kid: string, knowledgeBaseName?: string): UploadTask[] {
    const tasks = this.store.createTasks(files, kid, knowledgeBaseName)

    if (this.store.settings.autoOpenDrawer && tasks.length > 0) {
      this.store.openDrawer()
    }

    this.processQueue()
    return tasks
  }

  /**
   * 处理上传队列（公开方法，供重试和恢复时调用）
   */
  async processQueue(): Promise<void> {
    while (this.store.hasAvailableSlot && this.store.pendingTasks.length > 0) {
      const task = this.store.pendingTasks[0]
      if (!task.file) {
        this.store.removeTask(task.id)
        continue
      }
      this.uploadTask(task.id)
    }
  }

  /**
   * 上传单个任务（公开方法，供恢复/重试时调用）
   */
  async uploadTask(taskId: string): Promise<void> {
    const task = this.store.getTask(taskId)
    if (!task || !task.file) return

    // 检查是否启用分片上传
    if (this.store.settings.chunkedUpload && task.file.size > this.store.settings.chunkSize) {
      await this.uploadWithChunks(taskId)
    } else {
      await this.uploadSingle(taskId)
    }
  }

  /**
   * 单文件上传
   */
  private uploadSingle(taskId: string): Promise<void> {
    return new Promise((resolve) => {
      const task = this.store.getTask(taskId)
      if (!task || !task.file) {
        resolve()
        return
      }

      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', task.file)
      formData.append('kid', task.kid)

      // 初始化速度追踪器
      const speedTracker = new SpeedTracker()
      this.speedTrackers.set(taskId, speedTracker)

      // 上传进度监听
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          const speed = speedTracker.update(e.loaded)
          const eta = speed > 0 ? Math.ceil((e.total - e.loaded) / speed) : 0

          this.store.updateProgress(taskId, progress, e.loaded, speed, eta)
        }
      })

      // 状态监听
      xhr.addEventListener('load', () => {
        this.speedTrackers.delete(taskId)

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText)
            if (res.code === 200) {
              this.handleUploadSuccess(taskId, res.data)
            } else {
              this.handleUploadError(taskId, res.msg || '上传失败')
            }
          } catch {
            this.handleUploadError(taskId, '响应解析失败')
          }
        } else {
          this.handleUploadError(taskId, `HTTP ${xhr.status}: ${xhr.statusText}`)
        }
        resolve()
      })

      xhr.addEventListener('error', () => {
        this.speedTrackers.delete(taskId)
        this.handleUploadError(taskId, '网络请求失败')
        resolve()
      })

      xhr.addEventListener('abort', () => {
        this.speedTrackers.delete(taskId)
        resolve()
      })

      // 开始上传
      this.store.startUpload(taskId, xhr)

      const baseUrl = import.meta.env.VITE_GLOB_API_URL || ''
      xhr.open('POST', `${baseUrl}/knowledge/document/upload`)

      // 使用项目统一的 getToken() 获取 token
      const token = getToken()
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      xhr.send(formData)
    })
  }

  /**
   * 分片上传
   */
  private async uploadWithChunks(taskId: string): Promise<void> {
    const task = this.store.getTask(taskId)
    if (!task || !task.file) return

    const chunkSize = this.store.settings.chunkSize
    const totalChunks = Math.ceil(task.file.size / chunkSize)

    this.store.updateTask(taskId, {
      totalChunks,
      chunkSize,
      completedChunks: [],
    })

    // 分片上传实现（简化版，实际需后端支持）
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, task.file.size)
      const chunk = task.file.slice(start, end)

      // 上传单个分片
      await this.uploadChunk(taskId, chunk, i, totalChunks)
    }
  }

  /**
   * 上传单个分片
   */
  private uploadChunk(taskId: string, chunk: Blob, chunkIndex: number, totalChunks: number): Promise<void> {
    return new Promise((resolve) => {
      // 分片上传逻辑（需后端支持）
      // 简化实现，实际应调用分片上传API
      setTimeout(() => {
        const task = this.store.getTask(taskId)
        if (!task) {
          resolve()
          return
        }

        const completedChunks = task.completedChunks || []
        completedChunks.push(chunkIndex)

        const progress = Math.round((completedChunks.length / totalChunks) * 100)
        this.store.updateProgress(taskId, progress, completedChunks.length * (task.chunkSize || 0))

        if (completedChunks.length >= totalChunks) {
          this.handleUploadSuccess(taskId, { attachId: 0, docId: '' })
        }

        resolve()
      }, 500)
    })
  }

  /**
   * 处理上传成功
   */
  private handleUploadSuccess(taskId: string, data: { attachId: number; docId?: string; processId?: string }): void {
    const task = this.store.getTask(taskId)
    if (!task) return

    this.store.startProcessing(taskId, data.attachId, data.docId || '', data.processId)

    // 开始轮询处理状态（使用 processId）
    if (data.processId) {
      this.startProcessingPolling(taskId, data.processId)
    } else if (data.docId) {
      // 兼容：如果没有 processId，直接标记完成
      this.store.completeTask(taskId)
      this.showNotification(task.fileName, 'success')
      this.refreshKnowledgeBase(task.kid)
    }

    // 处理队列中的下一个任务
    this.processQueue()
  }

  /**
   * 处理上传错误
   */
  private handleUploadError(taskId: string, error: string): void {
    const task = this.store.getTask(taskId)
    if (!task) return

    // 检查是否需要自动重试
    if (
      this.store.settings.autoRetry &&
      task.retryCount < this.store.settings.maxRetryCount &&
      this.isRetryableError(error)
    ) {
      setTimeout(() => {
        this.store.retryTask(taskId)
        this.processQueue()
      }, 2000 * (task.retryCount + 1)) // 指数退避
      return
    }

    this.store.setTaskError(taskId, error)
    this.showNotification(task.fileName, 'error')

    // 处理队列中的下一个任务
    this.processQueue()
  }

  /**
   * 判断是否可重试的错误
   */
  private isRetryableError(error: string): boolean {
    const retryableErrors = ['网络', 'timeout', '500', '503', '502']
    return retryableErrors.some(e => error.includes(e))
  }

  /**
   * 开始处理状态轮询
   */
  startProcessingPolling(taskId: string, processId: string): void {
    const timer = setInterval(async () => {
      try {
        const res: any = await request({
          url: `/knowledge/document/process/${processId}?skipLock=true`,
          method: 'get',
        })

        if (res.code === 200) {
          const status = res.data?.currentStatus
          const progress = res.data?.progress

          // 更新处理阶段和进度
          if (status === 'PARSING') {
            this.store.updateProcessingStage(taskId, 'parsing', progress)
          } else if (status === 'CHUNKING') {
            this.store.updateProcessingStage(taskId, 'chunking', progress)
          } else if (status === 'VECTORIZING') {
            this.store.updateProcessingStage(taskId, 'vectorizing', progress)
          } else if (status === 'COMPLETED') {
            this.store.completeTask(taskId)
            this.stopProcessingPolling(taskId)
            this.showNotification(this.store.getTask(taskId)?.fileName || '', 'success')
            this.refreshKnowledgeBase(this.store.getTask(taskId)?.kid || '')
            // 触发 eventBus 事件通知相关页面刷新
            const task = this.store.getTask(taskId)
            if (task?.attachId) {
              import('@/utils/eventBus').then(({ eventBus }) => {
                eventBus.emit('upload:task-completed', {
                  taskId,
                  kid: task.kid,
                  attachId: task.attachId!
                })
              })
            }
          } else if (status === 'FAILED') {
            this.store.setTaskError(taskId, res.data?.errorMessage || '处理失败')
            this.stopProcessingPolling(taskId)
            this.showNotification(this.store.getTask(taskId)?.fileName || '', 'error')
          }
        }
      } catch {
        // 忽略轮询错误
      }
    }, 2000)

    this.pollingTimers.set(taskId, timer)
  }

  /**
   * 停止处理状态轮询
   */
  stopProcessingPolling(taskId: string): void {
    const timer = this.pollingTimers.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.pollingTimers.delete(taskId)
    }
  }

  /**
   * 停止所有轮询
   */
  stopAllPolling(): void {
    this.pollingTimers.forEach(timer => clearInterval(timer))
    this.pollingTimers.clear()
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): void {
    this.store.pauseTask(taskId)
    this.processQueue()
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): void {
    this.store.resumeTask(taskId)
    this.processQueue()
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): void {
    this.store.cancelTask(taskId)
    this.stopProcessingPolling(taskId)
    this.processQueue()
  }

  /**
   * 重试任务
   */
  retryTask(taskId: string): void {
    this.store.retryTask(taskId)
    this.processQueue()
  }

  /**
   * 重试所有失败任务
   */
  retryAllFailed(): void {
    this.store.failedTasks.forEach(task => {
      this.store.retryTask(task.id)
    })
    this.processQueue()
  }

  /**
   * 显示浏览器通知
   */
  private showNotification(fileName: string, type: 'success' | 'error'): void {
    if (!this.store.settings.enableNotification) return

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(type === 'success' ? '上传完成' : '上传失败', {
        body: fileName,
        icon: '/favicon.ico',
      })
    }
  }

  /**
   * 刷新知识库数据
   */
  private refreshKnowledgeBase(kid: string): void {
    // 触发自定义事件通知知识库列表刷新
    window.dispatchEvent(new CustomEvent('knowledge-base-updated', {
      detail: { kid, timestamp: Date.now() }
    }))
  }

  /**
   * 请求通知权限
   */
  async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  /**
   * 清理所有资源
   */
  destroy(): void {
    this.pollingTimers.forEach(timer => clearInterval(timer))
    this.pollingTimers.clear()
    this.speedTrackers.clear()
  }
}

/**
 * 速度追踪器
 */
class SpeedTracker {
  private samples: Array<{ time: number; bytes: number }> = []
  private maxSamples = 10

  update(uploadedBytes: number): number {
    const now = Date.now()
    this.samples.push({ time: now, bytes: uploadedBytes })

    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    if (this.samples.length < 2) return 0

    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const timeDiff = (last.time - first.time) / 1000
    const bytesDiff = last.bytes - first.bytes

    if (timeDiff <= 0) return 0

    return Math.round(bytesDiff / timeDiff)
  }
}

export const uploadService = new UploadService()

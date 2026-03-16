import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 上传任务状态
 */
export type TaskStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'
  | 'paused'
  | 'cancelled'

/**
 * 处理子阶段
 */
export type ProcessingStage = 'parsing' | 'chunking' | 'vectorizing'

/**
 * 上传任务
 */
export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  file?: File
  status: TaskStatus
  progress: number
  kid: string
  knowledgeBaseName?: string
  uploadedBytes: number
  uploadSpeed?: number
  eta?: number
  xhr?: XMLHttpRequest
  chunkSize?: number
  totalChunks?: number
  completedChunks?: number[]
  processingStage?: ProcessingStage
  attachId?: number
  docId?: string
  processId?: string
  error?: string
  retryCount: number
  createdAt: number
  updatedAt: number
  completedAt?: number
}

/**
 * 上传设置
 */
export interface UploadSettings {
  maxConcurrent: number
  autoRetry: boolean
  maxRetryCount: number
  chunkedUpload: boolean
  chunkSize: number
  enableNotification: boolean
  autoOpenDrawer: boolean
}

const STORAGE_KEY = 'uploadTasks'
const SETTINGS_KEY = 'uploadSettings'
const TASK_EXPIRY_TIME = 24 * 60 * 60 * 1000

const defaultSettings: UploadSettings = {
  maxConcurrent: 3,
  autoRetry: true,
  maxRetryCount: 3,
  chunkedUpload: false,
  chunkSize: 2 * 1024 * 1024,
  enableNotification: true,
  autoOpenDrawer: true,
}

export const useUploadStore = defineStore('upload', () => {
  const tasks = ref<Map<string, UploadTask>>(new Map())
  const settings = ref<UploadSettings>({ ...defaultSettings })
  const drawerVisible = ref(false)
  const activeFilter = ref<'all' | 'active' | 'completed' | 'error'>('all')

  const filters = ref<{
    status: 'all' | 'active' | 'pending' | 'completed' | 'failed'
    time: 'all' | 'today' | 'week' | 'month'
    searchKeyword: string
  }>({
    status: 'all',
    time: 'all',
    searchKeyword: '',
  })

  // 未读完成的任务ID集合（用于角标提醒）
  const unreadCompletedTaskIds = ref<Set<string>>(new Set())

  function setFilters(updates: Partial<{ status: string; time: string; searchKeyword: string }>) {
    if (updates.status !== undefined) filters.value.status = updates.status as any
    if (updates.time !== undefined) filters.value.time = updates.time as any
    if (updates.searchKeyword !== undefined) filters.value.searchKeyword = updates.searchKeyword
  }

  function clearFilters() {
    filters.value = { status: 'all', time: 'all', searchKeyword: '' }
  }

  /**
   * 将所有已完成的任务标记为已读（用户打开传输列表时调用）
   */
  function markAllCompletedAsRead(): void {
    unreadCompletedTaskIds.value.clear()
  }

  const taskList = computed(() => Array.from(tasks.value.values()))

  const groupedByKid = computed(() => {
    const groups = new Map<string, UploadTask[]>()
    tasks.value.forEach((task) => {
      const list = groups.get(task.kid) || []
      list.push(task)
      groups.set(task.kid, list)
    })
    return groups
  })

  const pendingTasks = computed(() =>
    taskList.value.filter(t => t.status === 'pending')
  )

  const uploadingTasks = computed(() =>
    taskList.value.filter(t => t.status === 'uploading')
  )

  const processingTasks = computed(() =>
    taskList.value.filter(t => t.status === 'processing')
  )

  const activeTasks = computed(() =>
    taskList.value.filter(t => t.status === 'uploading' || t.status === 'processing')
  )

  const completedTasks = computed(() =>
    taskList.value.filter(t => t.status === 'completed')
  )

  // 未读完成的任务计数
  const unreadCompletedCount = computed(() =>
    completedTasks.value.filter(t => unreadCompletedTaskIds.value.has(t.id)).length
  )

  const failedTasks = computed(() =>
    taskList.value.filter(t => t.status === 'error')
  )

  /** 待审阅任务（当前 store 无此状态，预留兼容） */
  const pendingReviewTasks = computed(() => [])

  const activeCount = computed(() => activeTasks.value.length)

  const hasActiveTasks = computed(() => activeCount.value > 0)

  const currentConcurrent = computed(() => uploadingTasks.value.length)

  const hasAvailableSlot = computed(() =>
    currentConcurrent.value < settings.value.maxConcurrent
  )

  const stats = computed(() => ({
    total: tasks.value.size,
    pending: pendingTasks.value.length,
    uploading: uploadingTasks.value.length,
    processing: processingTasks.value.length,
    active: activeTasks.value.length,
    completed: completedTasks.value.length,
    error: failedTasks.value.length,
  }))

  function generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  function createTask(file: File, kid: string, knowledgeBaseName?: string): UploadTask {
    const now = Date.now()
    const task: UploadTask = {
      id: generateTaskId(),
      fileName: file.name,
      fileSize: file.size,
      file,
      status: 'pending',
      progress: 0,
      kid,
      knowledgeBaseName,
      uploadedBytes: 0,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    tasks.value.set(task.id, task)
    saveToStorage()
    return task
  }

  function createTasks(files: File[], kid: string, knowledgeBaseName?: string): UploadTask[] {
    return files.map(file => createTask(file, kid, knowledgeBaseName))
  }

  function updateTask(taskId: string, updates: Partial<UploadTask>): UploadTask | null {
    const task = tasks.value.get(taskId)
    if (!task) return null

    Object.assign(task, updates, { updatedAt: Date.now() })
    tasks.value.set(taskId, task)
    saveToStorage()
    return task
  }

  function startUpload(taskId: string, xhr?: XMLHttpRequest): boolean {
    return !!updateTask(taskId, { status: 'uploading', xhr })
  }

  function updateProgress(
    taskId: string,
    progress: number,
    uploadedBytes: number,
    uploadSpeed?: number,
    eta?: number
  ): boolean {
    return !!updateTask(taskId, { progress, uploadedBytes, uploadSpeed, eta })
  }

  function startProcessing(taskId: string, attachId: number, docId: string, processId?: string): boolean {
    return !!updateTask(taskId, {
      status: 'processing',
      attachId,
      docId,
      processId,
      processingStage: 'parsing',
      progress: 100,
    })
  }

  function updateProcessingStage(taskId: string, stage: ProcessingStage, progress?: number): boolean {
    return !!updateTask(taskId, { 
      processingStage: stage,
      ...(progress !== undefined && { processingProgress: progress })
    })
  }

  function completeTask(taskId: string): boolean {
    const result = updateTask(taskId, {
      status: 'completed',
      progress: 100,
      completedAt: Date.now(),
    })
    if (result) {
      // 将新完成的任务标记为未读
      unreadCompletedTaskIds.value.add(taskId)
    }
    return !!result
  }

  function setTaskError(taskId: string, error: string): boolean {
    return !!updateTask(taskId, { status: 'error', error })
  }

  function pauseTask(taskId: string): boolean {
    const task = tasks.value.get(taskId)
    if (!task || task.status !== 'uploading') return false

    task.xhr?.abort()
    return !!updateTask(taskId, { status: 'paused' })
  }

  function resumeTask(taskId: string): boolean {
    const task = tasks.value.get(taskId)
    if (!task || task.status !== 'paused') return false

    return !!updateTask(taskId, { status: 'pending' })
  }

  function cancelTask(taskId: string): boolean {
    const task = tasks.value.get(taskId)
    if (!task) return false

    if (task.status === 'uploading' && task.xhr) {
      task.xhr.abort()
    }

    return !!updateTask(taskId, { status: 'cancelled' })
  }

  function retryTask(taskId: string): boolean {
    const task = tasks.value.get(taskId)
    if (!task) return false

    return !!updateTask(taskId, {
      status: 'pending',
      progress: 0,
      uploadedBytes: 0,
      error: undefined,
      retryCount: task.retryCount + 1,
      xhr: undefined,
    })
  }

  function removeTask(taskId: string): boolean {
    const result = tasks.value.delete(taskId)
    if (result) saveToStorage()
    return result
  }

  function clearCompleted(): void {
    taskList.value
      .filter(t => t.status === 'completed')
      .forEach(t => tasks.value.delete(t.id))
    saveToStorage()
  }

  function clearFailed(): void {
    taskList.value
      .filter(t => t.status === 'error' || t.status === 'cancelled')
      .forEach(t => tasks.value.delete(t.id))
    saveToStorage()
  }

  function clearAll(): void {
    tasks.value.clear()
    saveToStorage()
  }

  function getTask(taskId: string): UploadTask | undefined {
    return tasks.value.get(taskId)
  }

  function updateSettings(newSettings: Partial<UploadSettings>): void {
    Object.assign(settings.value, newSettings)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
  }

  function resetSettings(): void {
    settings.value = { ...defaultSettings }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
  }

  function loadSettings(): void {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        settings.value = { ...defaultSettings, ...parsed }
      }
    } catch {
      settings.value = { ...defaultSettings }
    }
  }

  function saveToStorage(): void {
    try {
      const storageData = {
        tasks: taskList.value.map(task => ({
          ...task,
          file: undefined,
          xhr: undefined,
        })),
        lastUpdated: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
    } catch {
      // 忽略存储错误
    }
  }

  function restoreFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const data = JSON.parse(stored)
      if (!data.tasks || !Array.isArray(data.tasks)) return

      if (data.lastUpdated && Date.now() - data.lastUpdated > TASK_EXPIRY_TIME) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }

      data.tasks.forEach((taskData: any) => {
        if (taskData.status === 'completed' || taskData.status === 'cancelled') {
          return
        }

        const task: UploadTask = {
          ...taskData,
          status: taskData.status === 'uploading' ? 'pending' : taskData.status,
          progress: taskData.status === 'uploading' ? 0 : taskData.progress,
          uploadedBytes: 0,
          xhr: undefined,
          retryCount: taskData.retryCount || 0,
          updatedAt: Date.now(),
        }
        tasks.value.set(task.id, task)
      })
    } catch {
      // 忽略恢复错误
    }
  }

  function cleanupExpiredTasks(): void {
    const now = Date.now()
    taskList.value.forEach(task => {
      if (task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') {
        if (task.completedAt && now - task.completedAt > TASK_EXPIRY_TIME) {
          tasks.value.delete(task.id)
        }
      }
    })
    saveToStorage()
  }

  function groupStats(kid: string): { total: number; active: number; completed: number; failed: number; pending: number } {
    const list = groupedByKid.value.get(kid) || []
    return {
      total: list.length,
      active: list.filter(t => t.status === 'uploading' || t.status === 'processing').length,
      completed: list.filter(t => t.status === 'completed').length,
      failed: list.filter(t => t.status === 'error').length,
      pending: list.filter(t => t.status === 'pending').length,
    }
  }

  function getKnowledgeBaseName(kid: string): string {
    const first = (groupedByKid.value.get(kid) || [])[0]
    return first?.knowledgeBaseName || ''
  }

  function openDrawer(): void {
    drawerVisible.value = true
  }

  function closeDrawer(): void {
    drawerVisible.value = false
  }

  function toggleDrawer(): void {
    drawerVisible.value = !drawerVisible.value
  }

  loadSettings()
  restoreFromStorage()
  cleanupExpiredTasks()

  return {
    tasks,
    settings,
    drawerVisible,
    activeFilter,
    filters,
    setFilters,
    clearFilters,
    taskList,
    groupedByKid,
    groupedTasksByKnowledgeBase: groupedByKid,
    pendingTasks,
    waitingTasks: pendingTasks,
    pendingReviewTasks,
    uploadingTasks,
    processingTasks,
    activeTasks,
    completedTasks,
    failedTasks,
    successTasks: completedTasks,
    errorTasks: failedTasks,
    activeCount,
    activeTaskCount: activeCount,
    unreadCompletedCount,
    markAllCompletedAsRead,
    hasActiveTasks,
    currentConcurrent,
    hasAvailableSlot,
    stats,
    createTask,
    createTasks,
    updateTask,
    startUpload,
    updateProgress,
    startProcessing,
    updateProcessingStage,
    completeTask,
    setTaskError,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    removeTask,
    clearCompleted,
    clearFailed,
    clearCompletedTasks: clearCompleted,
    clearErrorTasks: clearFailed,
    clearAll,
    getTask,
    groupStats,
    getKnowledgeBaseName,
    updateSettings,
    resetSettings,
    loadSettings,
    saveToStorage,
    restoreFromStorage,
    restoreTasks: restoreFromStorage,
    cleanupExpiredTasks,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  }
})

/**
 * 自动保存草稿组合式函数
 * 
 * 创新设计：「隐形保险」
 * - 无感知自动保存，不影响用户操作
 * - 本地+服务端双备份策略
 * - 冲突检测与恢复提示
 */
import { ref, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useThrottleFn, useTimeoutFn } from '@vueuse/core'
import { savePreference, getPreference } from '@/services/userPreference'

export interface AutoSaveOptions<T> {
  key: string  // 草稿唯一标识（如条目UUID或页面路径）
  data: Ref<T>  // 要保存的数据
  interval?: number  // 保存间隔，默认5000ms
  maxDrafts?: number  // 最大草稿数，默认10
  onConflict?: (local: T, server: T) => void  // 冲突回调
  onSave?: (data: T) => void  // 保存成功回调
  onRestore?: (data: T) => void  // 恢复草稿回调
  compareFn?: (a: T, b: T) => boolean  // 自定义比较函数
}

export interface Draft<T> {
  id: string
  data: T
  timestamp: number
  auto: boolean  // 是否为自动保存
}

export function useAutoSave<T extends object>(options: AutoSaveOptions<T>) {
  const {
    key,
    data,
    interval = 5000,
    maxDrafts = 10,
    onConflict,
    onSave,
    onRestore,
    compareFn = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  } = options

  // ========== 状态 ==========
  const isSaving = ref(false)
  const lastSaved = ref<number | null>(null)
  const hasDraft = ref(false)
  const draftData = ref<T | null>(null)
  const conflictDetected = ref(false)
  const saveCount = ref(0)  // 保存次数计数

  const STORAGE_KEY = `draft-${key}`
  const DRAFTS_LIST_KEY = `drafts-list-${key.split('-')[0]}`  // 草稿列表

  // ========== 草稿管理 ==========
  
  // 获取草稿列表
  async function getDraftsList(): Promise<Draft<T>[]> {
    return await getPreference<Draft<T>[]>('table_sort', DRAFTS_LIST_KEY) || []
  }

  // 保存草稿
  async function saveDraft(auto = true) {
    const currentData = data.value
    if (!currentData) return

    // 检查是否有变化
    if (draftData.value && compareFn(currentData, draftData.value)) {
      return  // 无变化，不保存
    }

    isSaving.value = true
    
    try {
      const draft: Draft<T> = {
        id: `${key}-${Date.now()}`,
        data: { ...currentData },
        timestamp: Date.now(),
        auto
      }

      // 保存到本地
      await savePreference('filter_state', STORAGE_KEY, draft)
      draftData.value = draft.data
      lastSaved.value = draft.timestamp
      hasDraft.value = true
      saveCount.value++

      // 更新草稿列表
      const drafts = await getDraftsList()
      const newDrafts = [draft, ...drafts].slice(0, maxDrafts)
      await savePreference('filter_state', DRAFTS_LIST_KEY, newDrafts)

      onSave?.(currentData)
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      isSaving.value = false
    }
  }

  // 节流保存（避免频繁触发）
  const throttledSave = useThrottleFn(() => saveDraft(true), interval)

  // 立即保存
  async function saveNow() {
    await saveDraft(false)
  }

  // ========== 恢复草稿 ==========
  
  async function restoreDraft(): Promise<T | null> {
    try {
      const draft = await getPreference<Draft<T>>('filter_state', STORAGE_KEY)
      if (draft && draft.data) {
        draftData.value = draft.data
        hasDraft.value = true
        lastSaved.value = draft.timestamp
        onRestore?.(draft.data)
        return draft.data
      }
    } catch (error) {
      console.error('Restore draft failed:', error)
    }
    return null
  }

  // 检查是否有可恢复的草稿
  async function checkDraft(): Promise<{ exists: boolean; timestamp?: number }> {
    const draft = await getPreference<Draft<T>>('filter_state', STORAGE_KEY)
    return {
      exists: !!(draft && draft.data),
      timestamp: draft?.timestamp
    }
  }

  // ========== 草稿清理 ==========
  
  async function clearDraft() {
    try {
      localStorage.removeItem(`user-pref-filter_state-${STORAGE_KEY}`)
      draftData.value = null
      hasDraft.value = false
      lastSaved.value = null
    } catch (error) {
      console.error('Clear draft failed:', error)
    }
  }

  // 获取所有历史草稿
  async function getAllDrafts(): Promise<Draft<T>[]> {
    return await getDraftsList()
  }

  // 恢复到指定草稿
  async function restoreSpecificDraft(draftId: string): Promise<T | null> {
    const drafts = await getDraftsList()
    const draft = drafts.find(d => d.id === draftId)
    if (draft) {
      draftData.value = draft.data
      onRestore?.(draft.data)
      return draft.data
    }
    return null
  }

  // ========== 监听数据变化自动保存 ==========
  
  const stopWatch = watch(
    data,
    () => {
      throttledSave()
    },
    { deep: true }
  )

  // ========== 冲突检测 ==========
  
  // 检查是否与最新版本冲突（预留接口，可扩展服务端版本对比）
  async function checkConflict(serverVersion: T): Promise<boolean> {
    if (!draftData.value) return false
    
    const hasConflict = !compareFn(draftData.value, serverVersion)
    conflictDetected.value = hasConflict
    
    if (hasConflict && onConflict) {
      onConflict(draftData.value, serverVersion)
    }
    
    return hasConflict
  }

  // ========== 生命周期 ==========
  
  // 页面关闭前强制保存
  const handleBeforeUnload = () => {
    if (data.value && (!draftData.value || !compareFn(data.value, draftData.value))) {
      // 使用同步方式保存（localStorage是同步的）
      const draft: Draft<T> = {
        id: `${key}-${Date.now()}`,
        data: { ...data.value },
        timestamp: Date.now(),
        auto: true
      }
      localStorage.setItem(
        `user-pref-filter_state-${STORAGE_KEY}`,
        JSON.stringify({ type: 'filter_state', key: STORAGE_KEY, value: draft, updatedAt: Date.now() })
      )
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // 页面加载时自动恢复草稿
    nextTick(async () => {
      const draft = await restoreDraft()
      if (draft) {
        // 如果有草稿，触发恢复回调，由调用方决定如何处理
        console.log(`[AutoSave] Draft restored for ${key}`)
      }
    })
  })

  onBeforeUnmount(() => {
    stopWatch()
    window.removeEventListener('beforeunload', handleBeforeUnload)
    // 离开时保存一次
    saveNow()
  })

  // ========== 返回 ==========
  return {
    // 状态
    isSaving,
    lastSaved,
    hasDraft,
    draftData,
    conflictDetected,
    saveCount,
    
    // 方法
    saveDraft,
    saveNow,
    restoreDraft,
    checkDraft,
    clearDraft,
    getAllDrafts,
    restoreSpecificDraft,
    checkConflict
  }
}

// ========== 辅助Hook：草稿恢复提示 ==========

export function useDraftRestorePrompt<T>(key: string, onRestore: (data: T) => void) {
  const showRestorePrompt = ref(false)
  const draftTimestamp = ref<number | null>(null)

  onMounted(async () => {
    const { useAutoSave } = await import('./useAutoSave')
    const { checkDraft } = useAutoSave<T>({
      key,
      data: ref({} as T)
    })
    
    const { exists, timestamp } = await checkDraft()
    if (exists && timestamp) {
      const hoursAgo = (Date.now() - timestamp) / (1000 * 60 * 60)
      // 如果草稿在24小时内，显示恢复提示
      if (hoursAgo < 24) {
        showRestorePrompt.value = true
        draftTimestamp.value = timestamp
      }
    }
  })

  async function confirmRestore() {
    const { useAutoSave } = await import('./useAutoSave')
    const { restoreDraft } = useAutoSave<T>({
      key,
      data: ref({} as T)
    })
    
    const data = await restoreDraft()
    if (data) {
      onRestore(data)
    }
    showRestorePrompt.value = false
  }

  function dismissRestore() {
    showRestorePrompt.value = false
  }

  return {
    showRestorePrompt,
    draftTimestamp,
    confirmRestore,
    dismissRestore
  }
}

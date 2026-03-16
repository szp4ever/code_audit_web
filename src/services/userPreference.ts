/**
 * 用户偏好服务
 * 
 * 策略：渐进式持久化
 * - 阶段1：localStorage 本地存储（当前实现）
 * - 阶段2：后端API持久化（待后端建表后，修改此文件即可全局切换）
 * 
 * 优势：
 * 1. 接口层屏蔽存储细节，组件无感知
 * 2. 支持离线使用（localStorage始终可用）
 * 3. 登录后自动同步到云端（可扩展）
 */

import request from '@/utils/request/req'

export type PreferenceType = 'table_column' | 'table_sort' | 'filter_state' | 'view_mode' | 'theme_settings'

export interface UserPreference {
  type: PreferenceType
  key: string
  value: any
  updatedAt: number
}

const STORAGE_PREFIX = 'user-pref-'
const API_ENABLED = false  // 阶段2设为true，启用后端API

/**
 * 保存用户偏好
 */
export async function savePreference(
  type: PreferenceType,
  key: string,
  value: any
): Promise<void> {
  const data: UserPreference = {
    type,
    key,
    value,
    updatedAt: Date.now()
  }
  
  // 始终保存到本地
  localStorage.setItem(`${STORAGE_PREFIX}${type}-${key}`, JSON.stringify(data))
  
  // 阶段2：同时同步到后端
  if (API_ENABLED) {
    try {
      await request({
        url: '/system/user-preference',
        method: 'post',
        data: {
          preferenceType: type,
          preferenceKey: key,
          preferenceValue: JSON.stringify(value)
        }
      })
    } catch {
      // API失败不影响本地使用
    }
  }
}

/**
 * 获取用户偏好
 */
export async function getPreference<T = any>(
  type: PreferenceType,
  key: string,
  defaultValue?: T
): Promise<T | undefined> {
  // 阶段2优先从后端获取
  if (API_ENABLED) {
    try {
      const res: any = await request({
        url: `/system/user-preference/${type}/${key}`,
        method: 'get'
      })
      if (res?.code === 200 && res.data) {
        return JSON.parse(res.data.preferenceValue)
      }
    } catch {
      // 后端失败时降级到本地
    }
  }
  
  // 从本地获取
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${type}-${key}`)
  if (raw) {
    try {
      const data: UserPreference = JSON.parse(raw)
      return data.value
    } catch {
      return defaultValue
    }
  }
  
  return defaultValue
}

/**
 * 批量获取某类型的所有偏好
 */
export function getPreferencesByType(type: PreferenceType): Record<string, any> {
  const result: Record<string, any> = {}
  const prefix = `${STORAGE_PREFIX}${type}-`
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) {
      const raw = localStorage.getItem(key)
      if (raw) {
        try {
          const data: UserPreference = JSON.parse(raw)
          result[data.key] = data.value
        } catch {
          // 忽略解析失败
        }
      }
    }
  }
  
  return result
}

/**
 * 删除用户偏好
 */
export async function removePreference(type: PreferenceType, key: string): Promise<void> {
  localStorage.removeItem(`${STORAGE_PREFIX}${type}-${key}`)
  
  if (API_ENABLED) {
    try {
      await request({
        url: `/system/user-preference/${type}/${key}`,
        method: 'delete'
      })
    } catch {
      // 忽略API失败
    }
  }
}

/**
 * 同步本地偏好到后端（登录后调用）
 */
export async function syncLocalPreferencesToServer(): Promise<void> {
  if (!API_ENABLED) return
  
  const allTypes: PreferenceType[] = ['table_column', 'table_sort', 'filter_state', 'view_mode', 'theme_settings']
  
  for (const type of allTypes) {
    const prefs = getPreferencesByType(type)
    for (const [key, value] of Object.entries(prefs)) {
      try {
        await savePreference(type, key, value)
      } catch {
        // 单条失败不影响其他
      }
    }
  }
}

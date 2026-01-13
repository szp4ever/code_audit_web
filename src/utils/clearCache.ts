import { ss } from '@/utils/storage'

// 清理跨账号可能读取到的本地/会话缓存，但保留 TOKEN
export function clearAppCachesExceptToken() {
  // 使用 ss 存储的键（不含 TOKEN）
  const ssKeys = [
    'chatStorage',
    'settingsStorage',
    'userStorage',
    'appSetting',
    'promptStore',
    'gpts-use-list',
    'suno-store',
    'luma-store',
  ]
  try {
    ssKeys.forEach((key) => ss.remove(key))
  } catch (e) {
    // ignore
  }

  // 直接使用 localStorage 的键
  const localKeys = ['gptConfigStore', 'gptServerStore']
  try {
    localKeys.forEach((key) => window.localStorage.removeItem(key))
  } catch (e) {
    // ignore
  }

  // 会话级标记，避免自动复用旧会话
  try {
    window.sessionStorage.removeItem('chat:autoNewCreated')
  } catch (e) {
    // ignore
  }
}
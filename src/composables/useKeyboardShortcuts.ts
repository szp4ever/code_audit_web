/**
 * 键盘快捷键组合式函数
 * 
 * 借鉴旧前端精华：
 * - 跨平台快捷键适配（Windows/Mac）
 * - 快捷键提示显示
 * - 阻止浏览器默认行为
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'

export type ShortcutKey = 'ctrl' | 'alt' | 'shift' | 'meta' | string
export type ShortcutHandler = (event: KeyboardEvent) => void | boolean

export interface KeyboardShortcut {
  key: string           // 按键，如 'k', 's', 'Enter'
  modifiers?: ShortcutKey[]  // 修饰键，如 ['ctrl', 'shift']
  handler: ShortcutHandler
  description: string     // 描述，用于快捷键帮助面板
  preventDefault?: boolean  // 是否阻止默认行为
  scope?: string          // 作用域，如 'global' | 'editor'
}

export interface ShortcutState {
  isEnabled: boolean
  shortcuts: Map<string, KeyboardShortcut>
}

// 检测操作系统
export function isMac(): boolean {
  return /mac|darwin/i.test(navigator.userAgent)
}

export function isWindows(): boolean {
  return /win32|win64|windows/i.test(navigator.userAgent)
}

// 格式化快捷键显示
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const { key, modifiers = [] } = shortcut
  const modMap: Record<string, string> = {
    ctrl: isMac() ? '⌘' : 'Ctrl',
    alt: isMac() ? '⌥' : 'Alt',
    shift: isMac() ? '⇧' : 'Shift',
    meta: isMac() ? '⌘' : 'Win'
  }
  
  const modStr = modifiers.map(m => modMap[m] || m).join(' + ')
  const keyStr = key.length === 1 ? key.toUpperCase() : key
  
  return modStr ? `${modStr} + ${keyStr}` : keyStr
}

// 创建快捷键唯一键
function createShortcutKey(shortcut: KeyboardShortcut): string {
  const { key, modifiers = [] } = shortcut
  const sortedMods = [...modifiers].sort().join('+')
  return sortedMods ? `${sortedMods}+${key.toLowerCase()}` : key.toLowerCase()
}

/**
 * 使用键盘快捷键
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: { scope?: string; enabled?: boolean } = {}
) {
  const { scope = 'global', enabled = true } = options
  const isEnabled = ref(enabled)
  const shortcutsMap = new Map<string, KeyboardShortcut>()
  const pressedKeys = ref<Set<string>>(new Set())
  
  // 注册快捷键
  function register(shortcut: KeyboardShortcut) {
    const key = createShortcutKey(shortcut)
    shortcutsMap.set(key, { ...shortcut, scope: shortcut.scope || scope })
  }
  
  // 注销快捷键
  function unregister(shortcut: KeyboardShortcut) {
    const key = createShortcutKey(shortcut)
    shortcutsMap.delete(key)
  }
  
  // 批量注册
  shortcuts.forEach(register)
  
  // 处理键盘事件
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isEnabled.value) return
    
    // 忽略输入框内的快捷键（除非是全局快捷键）
    const target = event.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable
    
    // 构建当前按键组合
    const modifiers: string[] = []
    if (event.ctrlKey) modifiers.push('ctrl')
    if (event.altKey) modifiers.push('alt')
    if (event.shiftKey) modifiers.push('shift')
    if (event.metaKey) modifiers.push('meta')
    
    const shortcutKey = createShortcutKey({
      key: event.key,
      modifiers
    })
    
    const shortcut = shortcutsMap.get(shortcutKey)
    
    if (shortcut) {
      // 非全局快捷键在输入框内忽略
      if (isInput && shortcut.scope !== 'global') {
        return
      }
      
      // 阻止默认行为
      if (shortcut.preventDefault !== false) {
        event.preventDefault()
      }
      
      // 执行处理函数
      const result = shortcut.handler(event)
      
      // 如果返回false，停止冒泡
      if (result === false) {
        event.stopPropagation()
      }
    }
    
    // 记录按下的键
    pressedKeys.value.add(event.key.toLowerCase())
  }
  
  const handleKeyUp = (event: KeyboardEvent) => {
    pressedKeys.value.delete(event.key.toLowerCase())
  }
  
  // 启用/禁用
  function enable() {
    isEnabled.value = true
  }
  
  function disable() {
    isEnabled.value = false
  }
  
  // 获取所有快捷键列表（用于快捷键帮助面板）
  const allShortcuts = computed(() => {
    return Array.from(shortcutsMap.values()).map(s => ({
      ...s,
      display: formatShortcut(s)
    }))
  })
  
  // 生命周期
  onMounted(() => {
    if (scope === 'global') {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keyup', handleKeyUp)
    }
  })
  
  onBeforeUnmount(() => {
    if (scope === 'global') {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  })
  
  return {
    isEnabled,
    pressedKeys,
    allShortcuts,
    register,
    unregister,
    enable,
    disable,
    handleKeyDown,
    handleKeyUp
  }
}

/**
 * 常用快捷键预设
 */
export const commonShortcuts = {
  // 保存
  save: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 's',
    modifiers: ['ctrl'],
    handler,
    description: '保存',
    preventDefault: true
  }),
  
  // 搜索
  search: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'k',
    modifiers: ['ctrl'],
    handler,
    description: '搜索',
    preventDefault: true
  }),
  
  // 新建
  create: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'n',
    modifiers: ['ctrl'],
    handler,
    description: '新建',
    preventDefault: true
  }),
  
  // 删除
  delete: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'Delete',
    handler,
    description: '删除'
  }),
  
  // 刷新
  refresh: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'r',
    modifiers: ['ctrl'],
    handler,
    description: '刷新',
    preventDefault: true
  }),
  
  // 撤销
  undo: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'z',
    modifiers: ['ctrl'],
    handler,
    description: '撤销',
    preventDefault: true
  }),
  
  // 全选
  selectAll: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'a',
    modifiers: ['ctrl'],
    handler,
    description: '全选'
  }),
  
  // ESC关闭
  escape: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'Escape',
    handler,
    description: '关闭/取消'
  }),
  
  // 方向键导航
  arrowUp: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'ArrowUp',
    handler,
    description: '向上'
  }),
  
  arrowDown: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'ArrowDown',
    handler,
    description: '向下'
  }),
  
  // Enter确认
  enter: (handler: ShortcutHandler): KeyboardShortcut => ({
    key: 'Enter',
    handler,
    description: '确认'
  })
}

/**
 * 快捷键帮助面板数据
 */
export function useShortcutHelpPanel() {
  const visible = ref(false)
  
  function show() {
    visible.value = true
  }
  
  function hide() {
    visible.value = false
  }
  
  function toggle() {
    visible.value = !visible.value
  }
  
  // 注册显示/隐藏快捷键（Cmd/Ctrl + ?）
  const { register, unregister } = useKeyboardShortcuts([
    {
      key: '?',
      modifiers: ['ctrl'],
      handler: () => {
        toggle()
        return false
      },
      description: '快捷键帮助',
      preventDefault: true
    }
  ])
  
  return {
    visible,
    show,
    hide,
    toggle,
    register,
    unregister
  }
}

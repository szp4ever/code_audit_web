import type { GlobalThemeOverrides } from 'naive-ui'
import { computed, watch } from 'vue'
import { darkTheme, useOsTheme } from 'naive-ui'
import { useAppStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'

export function useTheme() {
  const appStore = useAppStore()

  const OsTheme = useOsTheme()

  const isDark = computed(() => {
    if (appStore.theme === 'auto')
      return OsTheme.value === 'dark'
    else
      return appStore.theme === 'dark'
  })

  const theme = computed(() => {
    return isDark.value ? darkTheme : undefined
  })

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    const baseOverrides: GlobalThemeOverrides = {
      common: {
        // 全局主色系（影响所有组件）
        primaryColor: '#1a1a1a',
        primaryColorHover: '#2d2d2d',
        primaryColorPressed: '#0f0f0f',
        primaryColorSuppl: '#3a3a3a',
      },
      Button: {
        // 基础状态 - 深灰色，更有质感
        colorPrimary: '#1a1a1a',
        textColorPrimary: '#ffffff',
        borderPrimary: '1px solid #1a1a1a',
        
        // 悬停状态 - 注意变量名是 colorHoverPrimary（不是 colorPrimaryHover）
        colorHoverPrimary: '#2d2d2d',
        textColorHoverPrimary: '#ffffff',
        borderHoverPrimary: '1px solid #2d2d2d',
        
        // 按下状态 - 更深的灰色
        colorPressedPrimary: '#0f0f0f',
        textColorPressedPrimary: '#f5f5f5',
        borderPressedPrimary: '1px solid #0f0f0f',
        
        // 激活状态
        colorActivePrimary: '#1a1a1a',
        textColorActivePrimary: '#ffffff',
        borderActivePrimary: '1px solid #1a1a1a',
        
        // 聚焦状态 - 带微妙的边框高亮
        colorFocusPrimary: '#2d2d2d',
        textColorFocusPrimary: '#ffffff',
        borderFocusPrimary: '1px solid #2d2d2d',
        
        // 禁用状态 - 浅灰背景，中灰文字
        colorDisabledPrimary: '#e5e5e5',
        textColorDisabledPrimary: '#999999',
        borderDisabledPrimary: '1px solid #e5e5e5',
        opacityDisabled: 1,
        
        // text/ghost 变体的文字颜色
        textColorTextPrimary: '#1a1a1a',
        textColorTextHoverPrimary: '#2d2d2d',
        textColorTextPressedPrimary: '#0f0f0f',
        textColorGhostPrimary: '#1a1a1a',
        textColorGhostHoverPrimary: '#2d2d2d',
        textColorGhostPressedPrimary: '#0f0f0f',
        
        // 波纹效果 - 柔和的白色波纹
        rippleColorPrimary: 'rgba(255, 255, 255, 0.2)',
        waveOpacity: 0.2,
        
        // Loading 状态
        colorLoadingPrimary: '#1a1a1a',
        textColorLoadingPrimary: '#ffffff',
      },
    }
    
    if (isDark.value) {
      return {
        ...baseOverrides,
      }
    }
    return baseOverrides
  })
  const { isMobile } = useBasicLayout()
  watch(
    () => isDark.value,
    (dark) => {
      if (dark)
        document.documentElement.classList.add('dark')
      else
        document.documentElement.classList.remove('dark')
    },
    { immediate: true },
  )
  watch(
    () => isMobile.value,
    (dark) => {
      if (dark)
        document.documentElement.classList.add('is-mobile')
      else
        document.documentElement.classList.remove('is-mobile')
    },
    { immediate: true },
  )

  return { theme, themeOverrides }
}

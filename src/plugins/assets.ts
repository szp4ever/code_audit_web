import 'katex/dist/katex.min.css'
import '@/styles/lib/tailwind.css'
import '@/styles/lib/highlight.less'
import '@/styles/lib/github-markdown.less'
import '@/styles/global.less'
import '@/styles/animations.css'
import {
  AI_SIDER_WIDTH,
  ACTION_BAR_LEFT_BUFFER,
  GLOBAL_UPLOAD_FAB_SIZE,
  GLOBAL_UPLOAD_FAB_MARGIN,
  ACTION_BAR_SIDE_GAP,
} from '@/config/layout'

/** 注入布局相关 CSS 变量，供 aiSider、底栏、FAB 等组件使用 */
function injectLayoutVariables() {
  document.documentElement.style.setProperty('--ai-sider-width', `${AI_SIDER_WIDTH}px`)
  document.documentElement.style.setProperty('--action-bar-left-buffer', `${ACTION_BAR_LEFT_BUFFER}px`)
  document.documentElement.style.setProperty('--global-upload-fab-size', `${GLOBAL_UPLOAD_FAB_SIZE}px`)
  document.documentElement.style.setProperty('--global-upload-fab-margin', `${GLOBAL_UPLOAD_FAB_MARGIN}px`)
  document.documentElement.style.setProperty('--action-bar-side-gap', `${ACTION_BAR_SIDE_GAP}px`)
}

/** Tailwind's Preflight Style Override */
function naiveStyleOverride() {
  const meta = document.createElement('meta')
  meta.name = 'naive-ui-style'
  document.head.appendChild(meta)
}

function setupAssets() {
  injectLayoutVariables()
  naiveStyleOverride()
}

export default setupAssets

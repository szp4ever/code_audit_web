<script setup lang="ts">
/**
 * 路由进度条
 * 
 * 借鉴旧前端精华：
 * - 页面切换时显示进度条
 * - 模拟渐进加载效果
 * - 完成时快速消失
 */
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const progress = ref(0)
const visible = ref(false)
let progressTimer: ReturnType<typeof setInterval> | null = null

// 开始加载
function start() {
  visible.value = true
  progress.value = 0
  
  // 模拟渐进加载
  progressTimer = setInterval(() => {
    if (progress.value < 90) {
      // 前90%渐进增长，越接近90增长越慢
      const increment = Math.max(1, (90 - progress.value) * 0.1)
      progress.value = Math.min(90, progress.value + increment)
    }
  }, 200)
}

// 完成加载
function finish() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  
  progress.value = 100
  
  // 延迟隐藏
  setTimeout(() => {
    visible.value = false
    setTimeout(() => {
      progress.value = 0
    }, 200)
  }, 300)
}

// 监听路由变化
let routeChangeStart = false

router.beforeEach(() => {
  routeChangeStart = true
  start()
})

router.afterEach(() => {
  if (routeChangeStart) {
    routeChangeStart = false
    // 短暂延迟确保页面基本渲染完成
    setTimeout(finish, 100)
  }
})

router.onError(() => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  visible.value = false
  progress.value = 0
})
</script>

<template>
  <Transition name="progress-fade">
    <div
      v-show="visible"
      class="route-progress"
      :style="{ width: `${progress}%` }"
    />
  </Transition>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, #0078d4 0%, #40a9ff 100%);
  z-index: 9999;
  box-shadow: 0 0 10px rgba(0, 120, 212, 0.5);
  transition: width 0.2s ease-out;
}

.progress-fade-leave-active {
  transition: opacity 0.3s ease;
}

.progress-fade-leave-to {
  opacity: 0;
}
</style>

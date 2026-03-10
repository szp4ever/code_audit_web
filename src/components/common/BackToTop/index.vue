<script setup lang="ts">
/**
 * 滚动到顶部按钮
 * 
 * 借鉴旧前端精华：
 * - 滚动到一定位置后显示
 * - 平滑滚动动画
 * - 可自定义触发阈值
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NTooltip } from 'naive-ui'
import { useWindowScroll } from '@vueuse/core'
import SvgIcon from '@/components/common/SvgIcon/index.vue'

const props = defineProps<{
  threshold?: number  // 显示阈值，默认300px
  right?: number      // 右边距，默认24
  bottom?: number     // 底边距，默认24
}>()

const { y } = useWindowScroll()

const visible = computed(() => y.value > (props.threshold || 300))

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}
</script>

<template>
  <Transition name="back-to-top">
    <div
      v-show="visible"
      class="back-to-top"
      :style="{
        right: `${props.right || 24}px`,
        bottom: `${props.bottom || 24}px`
      }"
    >
      <NTooltip trigger="hover" placement="left">
        <template #trigger>
          <NButton
            circle
            type="primary"
            size="large"
            class="back-to-top-btn"
            @click="scrollToTop"
          >
            <template #icon>
              <SvgIcon icon="mdi:arrow-up" />
            </template>
          </NButton>
        </template>
        回到顶部
      </NTooltip>
    </div>
  </Transition>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  z-index: 100;
}

.back-to-top-btn {
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.3);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.back-to-top-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 120, 212, 0.4);
}

/* 入场/退场动画 */
.back-to-top-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.back-to-top-leave-active {
  transition: all 0.2s ease-in;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}
</style>

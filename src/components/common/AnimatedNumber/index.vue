<script setup lang="ts">
/**
 * 数字滚动动画组件
 * 
 * 借鉴旧前端 count-to-animator 精华：
 * - 数字递增动画
 * - 可配置缓动效果
 * - 格式化显示
 */
import { ref, watch, computed } from 'vue'
import { useTransition, TransitionPresets } from '@vueuse/core'

const props = defineProps<{
  value: number
  duration?: number        // 动画时长，默认1000ms
  precision?: number       // 小数精度，默认0
  prefix?: string          // 前缀
  suffix?: string          // 后缀
  separator?: string       // 千分位分隔符，默认','
  decimal?: string         // 小数点，默认'.'
  easing?: keyof typeof TransitionPresets  // 缓动函数
}>()

// 动画值
const source = ref(props.value)
const outputValue = useTransition(source, {
  duration: props.duration || 1000,
  transition: TransitionPresets[props.easing || 'easeOutExpo']
})

// 监听值变化
watch(() => props.value, (newVal) => {
  source.value = newVal
})

// 格式化显示
const displayValue = computed(() => {
  let val = outputValue.value
  
  // 处理精度
  if (props.precision && props.precision > 0) {
    val = parseFloat(val.toFixed(props.precision))
  } else {
    val = Math.round(val)
  }
  
  // 转换为字符串并添加千分位
  let str = val.toString()
  
  if (props.separator) {
    const parts = str.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, props.separator)
    str = parts.join(props.decimal || '.')
  }
  
  return `${props.prefix || ''}${str}${props.suffix || ''}`
})
</script>

<template>
  <span class="animated-number">{{ displayValue }}</span>
</template>

<style scoped>
.animated-number {
  font-variant-numeric: tabular-nums;
  display: inline-block;
}
</style>

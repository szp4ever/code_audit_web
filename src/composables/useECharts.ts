import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import echarts from '@/utils/echarts'

interface UseEChartsOptions {
  /** 跟随深色模式切换 */
  autoResize?: boolean
}

export function useECharts(
  elRef: Ref<HTMLElement | null>,
  optionRef: Ref<EChartsCoreOption>,
  options: UseEChartsOptions = {}
) {
  const chartRef = ref<ECharts | null>(null)
  const autoResize = options.autoResize !== false

  const initChart = () => {
    if (!elRef.value) return
    if (chartRef.value) {
      chartRef.value.dispose()
      chartRef.value = null
    }
    chartRef.value = echarts.init(elRef.value)
    chartRef.value.setOption(optionRef.value, true)
  }

  const setOption = (option: EChartsCoreOption) => {
    optionRef.value = option
    if (!chartRef.value) {
      initChart()
      return
    }
    chartRef.value.setOption(option, true)
  }

  const resize = () => {
    chartRef.value?.resize()
  }

  const dispose = () => {
    if (chartRef.value) {
      chartRef.value.dispose()
      chartRef.value = null
    }
  }

  watch(
    optionRef,
    (option) => {
      if (!chartRef.value) {
        initChart()
        return
      }
      chartRef.value.setOption(option, true)
    },
    { deep: true }
  )

  onMounted(() => {
    initChart()
    if (autoResize) {
      window.addEventListener('resize', resize)
    }
  })

  onBeforeUnmount(() => {
    if (autoResize) {
      window.removeEventListener('resize', resize)
    }
    dispose()
  })

  return {
    chartRef,
    initChart,
    setOption,
    resize,
    dispose,
  }
}

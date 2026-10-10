<script setup lang="ts">
/** 近 7 日订单量趋势图。数据全部来自 DashboardVO.orderTrend。 */
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { TrendPoint } from '@/types/admin'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{ points: TrendPoint[] | null }>()

const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render(): void {
  if (!chartEl.value) return
  const points = props.points ?? []
  chart ??= echarts.init(chartEl.value)
  chart.setOption({
    grid: { top: 24, right: 16, bottom: 28, left: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.date),
      axisLabel: { color: '#8a94a6' },
      axisLine: { lineStyle: { color: '#e4e8ef' } }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#8a94a6' },
      splitLine: { lineStyle: { color: '#f0f2f6' } }
    },
    series: [
      {
        type: 'bar',
        name: '订单量',
        barMaxWidth: 28,
        data: points.map((p) => p.count),
        itemStyle: { color: '#2f6fed', borderRadius: [3, 3, 0, 0] }
      }
    ]
  })
}

function resize(): void {
  chart?.resize()
}

onMounted(async () => {
  await nextTick()
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})

watch(() => props.points, () => void nextTick(render), { deep: true })
</script>

<template>
  <div ref="chartEl" style="width: 100%; height: 260px" />
</template>

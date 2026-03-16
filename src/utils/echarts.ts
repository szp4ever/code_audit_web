import * as echarts from 'echarts/core'
import { LineChart, PieChart, BarChart, HeatmapChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  CalendarComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  CalendarComponent,
  TitleComponent,
  CanvasRenderer,
])

export default echarts

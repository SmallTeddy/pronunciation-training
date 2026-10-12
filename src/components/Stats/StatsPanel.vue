<template>
  <div class="stats-panel">
    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-label">今日答题</div>
        <div class="stat-value">{{ todayStats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日正确率</div>
        <div class="stat-value">{{ todayAccuracy }}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">累计练习</div>
        <div class="stat-value">{{ totalPractice }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">连续天数</div>
        <div class="stat-value">{{ streakDays }}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="chart-card">
        <h3>正确率趋势（近 14 天）</h3>
        <div ref="trendChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <h3>最常错的音 Top 10</h3>
        <div ref="errorChart" class="chart"></div>
      </div>
    </div>

    <div class="chart-card full">
      <h3>各音掌握热力图</h3>
      <div ref="heatmapChart" class="chart heatmap"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { usePracticeStore } from '../../stores/practice.js'
import { midiToNoteName, makeNoteId } from '../../utils/musicTheory.js'

const store = usePracticeStore()
const trendChart = ref(null)
const errorChart = ref(null)
const heatmapChart = ref(null)
let trendInstance = null
let errorInstance = null
let heatmapInstance = null

const today = new Date().toISOString().slice(0, 10)

const todayStats = computed(() => {
  const list = store.history.filter((h) => h.date === today)
  return {
    total: list.reduce((s, h) => s + h.total, 0),
    correct: list.reduce((s, h) => s + h.correct, 0),
  }
})

const todayAccuracy = computed(() => {
  if (todayStats.value.total === 0) return 0
  return Math.round((todayStats.value.correct / todayStats.value.total) * 100)
})

const totalPractice = computed(() => store.history.reduce((s, h) => s + h.total, 0))

const streakDays = computed(() => {
  const dates = [...new Set(store.history.map((h) => h.date))].sort().reverse()
  if (dates.length === 0) return 0
  let streak = 0
  let cursor = new Date()
  for (const d of dates) {
    const dStr = cursor.toISOString().slice(0, 10)
    if (d === dStr) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else if (d < dStr) {
      break
    }
  }
  return streak
})

function getLast14Days() {
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function renderTrend() {
  if (!trendChart.value) return
  const days = getLast14Days()
  const accuracy = days.map((day) => {
    const list = store.history.filter((h) => h.date === day)
    const total = list.reduce((s, h) => s + h.total, 0)
    const correct = list.reduce((s, h) => s + h.correct, 0)
    return total === 0 ? 0 : Math.round((correct / total) * 100)
  })

  trendInstance = echarts.init(trendChart.value)
  trendInstance.setOption({
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: days.map((d) => d.slice(5)),
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#9ca3af', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    series: [
      {
        type: 'line',
        data: accuracy,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#6366f1', width: 3 },
        itemStyle: { color: '#6366f1' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(99,102,241,0.4)' },
            { offset: 1, color: 'rgba(99,102,241,0)' },
          ]),
        },
      },
    ],
  })
}

function renderErrorTop() {
  if (!errorChart.value) return
  const stats = store.noteStats
  const errors = Object.entries(stats)
    .map(([id, s]) => ({ id, wrong: s.wrong, total: s.total, errorRate: s.total ? s.wrong / s.total : 0 }))
    .filter((x) => x.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 10)

  const names = errors.map((e) => e.id.split('_')[1])
  const values = errors.map((e) => e.wrong)

  errorInstance = echarts.init(errorChart.value)
  errorInstance.setOption({
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: 'axis', formatter: '{b}<br/>错误次数: {c}' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#e5e7eb' },
    },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#f87171' },
            { offset: 1, color: '#ef4444' },
          ]),
          borderRadius: [0, 6, 6, 0],
        },
        label: { show: true, position: 'right', color: '#fca5a5' },
      },
    ],
  })
}

function renderHeatmap() {
  if (!heatmapChart.value) return
  const stats = store.noteStats
  const settings = store.settings
  // 遍历范围内所有音
  const { noteRange, includeAccidentals } = settings
  const low = noteNameToMidiSimple(noteRange[0])
  const high = noteNameToMidiSimple(noteRange[1])
  const notes = []
  for (let m = low; m <= high; m++) {
    if (includeAccidentals || [0, 2, 4, 5, 7, 9, 11].includes(m % 12)) {
      const id = `${settings.clefMode}_${midiToNoteName(m)}`
      const stat = stats[id] || { total: 0, wrong: 0 }
      const errorRate = stat.total ? stat.wrong / stat.total : 0
      notes.push({ name: midiToNoteName(m), errorRate, total: stat.total })
    }
  }

  const names = notes.map((n) => n.name)
  const data = notes.map((n, i) => [i, 0, n.errorRate])

  heatmapInstance = echarts.init(heatmapChart.value)
  heatmapInstance.setOption({
    grid: { left: 60, right: 20, top: 20, bottom: 60 },
    tooltip: {
      formatter: (p) => `${notes[p.data[0]].name}<br/>错误率: ${Math.round(p.data[2] * 100)}%<br/>练习次数: ${notes[p.data[0]].total}`,
    },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#9ca3af', rotate: 45, fontSize: 10 },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: ['掌握度'],
      axisLabel: { color: '#9ca3af' },
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#10b981', '#fbbf24', '#ef4444'],
      },
      textStyle: { color: '#9ca3af' },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          formatter: (p) => (notes[p.data[0]].total > 0 ? Math.round(p.data[2] * 100) + '%' : ''),
          color: '#111',
          fontSize: 10,
        },
        itemStyle: { borderRadius: 4, borderColor: '#1f2937', borderWidth: 2 },
      },
    ],
  })
}

// 简易 MIDI 转换（避免循环引用导入问题）
function noteNameToMidiSimple(name) {
  const match = name.match(/^([A-G])([#b]?)(\d+)$/)
  if (!match) return 60
  const [, letter, acc, oct] = match
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
  let m = (parseInt(oct) + 1) * 12 + base
  if (acc === '#') m += 1
  if (acc === 'b') m -= 1
  return m
}

function renderAll() {
  nextTick(() => {
    renderTrend()
    renderErrorTop()
    renderHeatmap()
  })
}

function handleResize() {
  trendInstance?.resize()
  errorInstance?.resize()
  heatmapInstance?.resize()
}

onMounted(() => {
  renderAll()
  window.addEventListener('resize', handleResize)
})

watch(
  () => [store.history, store.noteStats],
  renderAll,
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendInstance?.dispose()
  errorInstance?.dispose()
  heatmapInstance?.dispose()
})
</script>

<style scoped>
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--accent);
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
.chart-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.chart-card h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: var(--text);
}
.chart {
  width: 100%;
  height: 260px;
}
.chart.heatmap {
  height: 220px;
}
.chart-card.full {
  grid-column: 1 / -1;
}
</style>

<template>
  <div class="staff-container" :class="{ 'staff-both': clefMode === 'both' }">
    <transition name="fade">
      <div v-if="showHint && currentNote" class="hint-label">
        {{ hintText }}
      </div>
    </transition>
    <div ref="staffEl" class="staff-svg-wrapper"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { Renderer, Stave, StaveNote, Formatter, Voice, StaveConnector, Annotation } from 'vexflow'
import {
  midiToVexKey,
  getStemDirection,
  midiToNoteName,
  midiToNoteNameFlat,
  getSolfege,
} from '../../utils/musicTheory.js'

const props = defineProps({
  clefMode: { type: String, default: 'both' },
  // 题目数组 [{ midi, clef, status }]
  questions: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 },
  showNoteName: { type: Boolean, default: false },
  showSolfege: { type: Boolean, default: false },
  useFlat: { type: Boolean, default: false },
})

const staffEl = ref(null)

const currentNote = computed(() =>
  props.questions[props.currentIndex] || null
)

const hintText = computed(() => {
  if (!currentNote.value) return ''
  const { midi } = currentNote.value
  const parts = []
  if (props.showNoteName) {
    parts.push(props.useFlat ? midiToNoteNameFlat(midi) : midiToNoteName(midi))
  }
  if (props.showSolfege) parts.push(getSolfege(midi))
  return parts.join(' · ')
})

const showHint = computed(() => props.showNoteName || props.showSolfege)

const COLORS = {
  pending: '#6366f1',
  correct: '#10b981',
  wrong: '#ef4444',
  current: '#f59e0b',
}

// 布局：一次显示 4 行五线谱，每行 2 小节，每小节 4 个音符 → 共 32 个音
const SYSTEMS_PER_GROUP = 4
const MEASURES_PER_SYSTEM = 2
const BEATS_PER_MEASURE = 4
const NOTES_PER_SYSTEM = MEASURES_PER_SYSTEM * BEATS_PER_MEASURE // 8
const TOTAL_NOTES = SYSTEMS_PER_GROUP * NOTES_PER_SYSTEM // 32

// 谱面设计尺寸（虚拟坐标，最终按容器等比缩放）
const SVG_NS = 'http://www.w3.org/2000/svg'
const STAVE_SPAN = 40 // 五线谱可视高度（5 条线的跨度 = 4 × 线距）
const STAVE_HEADROOM = 40 // 谱表顶部预留空间（space_above_staff_ln × 线距 = 4 × 10）
const STAVE_FULL_H = STAVE_HEADROOM + STAVE_SPAN // 从 Stave.y 到最底一条线的距离
const TOP_MARGIN = 34
const BOTTOM_PAD = 34

// 大谱表（高音 + 低音）
const GRAND_ABOVE = 16
const GRAND_BASS_OFFSET = 74
const GRAND_BELOW = 26
const GRAND_SYS_H = GRAND_ABOVE + GRAND_BASS_OFFSET + STAVE_SPAN + GRAND_BELOW
const GRAND_GAP = 8

// 单谱表（高音或低音）
const SINGLE_ABOVE = 36
const SINGLE_BELOW = 40
const SINGLE_SYS_H = SINGLE_ABOVE + STAVE_SPAN + SINGLE_BELOW
const SINGLE_GAP = 6

const GRAND_DESIGN_H =
  TOP_MARGIN + SYSTEMS_PER_GROUP * GRAND_SYS_H + (SYSTEMS_PER_GROUP - 1) * GRAND_GAP + BOTTOM_PAD
const SINGLE_DESIGN_H =
  TOP_MARGIN + SYSTEMS_PER_GROUP * SINGLE_SYS_H + (SYSTEMS_PER_GROUP - 1) * SINGLE_GAP + BOTTOM_PAD

// 用于估算渲染宽度（贴近真实内容高度，减小等比缩放后的留白）
const GRAND_EST_H = 720
const SINGLE_EST_H = 560

function makeRest(clef) {
  // 四分休止符：居中于五线谱第三线（中间线）
  // 高音谱表第三线 = B4 (b/4)，低音谱表第三线 = D3 (d/3)
  const restKey = clef === 'treble' ? 'b/4' : 'd/3'
  return new StaveNote({ keys: [restKey], duration: 'qr' })
}

/**
 * 创建单个音符
 * @param {Object} item 题目 { midi, clef, status, originalIndex }
 * @param {string} clef 当前谱表
 * @param {boolean} forceClef 单谱表模式下，忽略题目自身谱表，强制按当前谱表绘制
 */
function makeNote(item, clef, forceClef = false) {
  // 大谱表模式下，对侧谱表的拍位绘制为四分休止符
  if (!forceClef && item.clef !== clef) return makeRest(clef)

  const globalIdx = item.originalIndex
  const key = midiToVexKey(item.midi)
  const stemDir = getStemDirection(item.midi, clef)
  const note = new StaveNote({
    keys: [key],
    duration: 'q',
    stem_direction: stemDir === 'up' ? 1 : -1,
  })
  let color = COLORS.pending
  if (item.status === 'correct') color = COLORS.correct
  else if (item.status === 'wrong') color = COLORS.wrong
  if (globalIdx === props.currentIndex) color = COLORS.current
  note.setStyle({ fillStyle: color, strokeStyle: color })
  // 当前音添加 ▲ 标记
  if (globalIdx === props.currentIndex) {
    const ann = new Annotation('▲')
    ann.setVerticalJustification(Annotation.VerticalJustify.TOP)
    note.addModifier(ann, 0)
  }
  return note
}

/**
 * 取某小节的 4 拍（不足则用 null 占位），保留全局 originalIndex
 */
function takeMeasure(questions, start) {
  const items = []
  for (let i = 0; i < BEATS_PER_MEASURE; i++) {
    const q = questions[start + i]
    items.push(q ? { ...q, originalIndex: start + i } : null)
  }
  return items
}

function createMeasureNotes(items, clef, forceClef = false) {
  return items.map((item) => {
    if (!item) return makeRest(clef)
    return makeNote(item, clef, forceClef)
  })
}

function drawVoice(context, stave, tickables, formatWidth) {
  const voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  voice.addTickables(tickables)
  new Formatter().joinVoices([voice]).format([voice], formatWidth)
  voice.draw(context, stave)
}

/**
 * 绘制当前音的粉色高亮列
 */
function insertHighlight(container, x, prevX, nextX, topY, bottomY) {
  const colW = (nextX - prevX) / 2
  const svgEl = container.querySelector('svg')
  if (!svgEl) return
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', x - colW * 0.6)
  rect.setAttribute('y', topY - 10)
  rect.setAttribute('width', colW * 1.2)
  rect.setAttribute('height', bottomY - topY + 20)
  rect.setAttribute('fill', 'rgba(244, 114, 182, 0.25)')
  rect.setAttribute('rx', '4')
  svgEl.insertBefore(rect, svgEl.firstChild)
}

/**
 * 记录某个 voice 各拍的 x 坐标
 */
function collectXs(tickables, beatXs, offset) {
  for (let i = 0; i < tickables.length && i < BEATS_PER_MEASURE; i++) {
    beatXs[offset + i] = tickables[i].getAbsoluteX()
  }
}

/**
 * 渲染大谱表（4 行 × 2 小节，每小节 4 拍）
 */
function renderGrandStaff(container, questions, width, height) {
  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const braceX = 40
  const clefWidth = 45
  const timeSigWidth = 30
  const innerPadding = 20
  const availableWidth = width - braceX - innerPadding

  // 第 1 小节需要容纳谱号 + 拍号，第 2 小节不需要
  const m1ExtraWidth = clefWidth + timeSigWidth
  const measureWidth = (availableWidth - m1ExtraWidth) / MEASURES_PER_SYSTEM
  const m1X = braceX + 10
  const m2X = m1X + measureWidth + m1ExtraWidth

  const beatXs = new Array(TOTAL_NOTES)
  const systemTops = []

  for (let s = 0; s < SYSTEMS_PER_GROUP; s++) {
    const trebleY = TOP_MARGIN + GRAND_ABOVE + s * (GRAND_SYS_H + GRAND_GAP)
    const bassY = trebleY + GRAND_BASS_OFFSET
    systemTops.push({ trebleY, bassY })

    // 第 1 小节
    const trebleStave1 = new Stave(m1X, trebleY, measureWidth + m1ExtraWidth)
    trebleStave1.addClef('treble').addTimeSignature('4/4')
    trebleStave1.setContext(context).draw()

    const bassStave1 = new Stave(m1X, bassY, measureWidth + m1ExtraWidth)
    bassStave1.addClef('bass').addTimeSignature('4/4')
    bassStave1.setContext(context).draw()

    // 大谱表括号连接
    const brace = new StaveConnector(trebleStave1, bassStave1)
    brace.setType(StaveConnector.type.BRACE)
    brace.setContext(context).draw()

    // 第 2 小节
    const trebleStave2 = new Stave(m2X, trebleY, measureWidth)
    trebleStave2.setContext(context).draw()

    const bassStave2 = new Stave(m2X, bassY, measureWidth)
    bassStave2.setContext(context).draw()

    // 小节间 barline（同时连接高低音谱表）
    const midBarline = new StaveConnector(trebleStave2, bassStave2)
    midBarline.setType(StaveConnector.type.SINGLE)
    midBarline.setContext(context).draw()

    const base = s * NOTES_PER_SYSTEM
    const m1Items = takeMeasure(questions, base)
    const m2Items = takeMeasure(questions, base + BEATS_PER_MEASURE)

    const trebleM1 = createMeasureNotes(m1Items, 'treble')
    const trebleM2 = createMeasureNotes(m2Items, 'treble')
    const bassM1 = createMeasureNotes(m1Items, 'bass')
    const bassM2 = createMeasureNotes(m2Items, 'bass')

    drawVoice(context, trebleStave1, trebleM1, measureWidth + m1ExtraWidth - 20)
    drawVoice(context, bassStave1, bassM1, measureWidth + m1ExtraWidth - 20)
    drawVoice(context, trebleStave2, trebleM2, measureWidth - 20)
    drawVoice(context, bassStave2, bassM2, measureWidth - 20)

    collectXs(trebleM1, beatXs, base)
    collectXs(trebleM2, beatXs, base + BEATS_PER_MEASURE)
  }

  // 当前音的粉色高亮列
  const ci = props.currentIndex
  if (ci >= 0 && ci < TOTAL_NOTES && beatXs[ci] != null) {
    const { trebleY, bassY } = systemTops[Math.floor(ci / NOTES_PER_SYSTEM)]
    const x = beatXs[ci]
    const beatInMeasure = ci % BEATS_PER_MEASURE
    const prevX = beatInMeasure > 0 && beatXs[ci - 1] != null ? beatXs[ci - 1] : x - 25
    const nextX =
      beatInMeasure < BEATS_PER_MEASURE - 1 && beatXs[ci + 1] != null ? beatXs[ci + 1] : x + 25
    insertHighlight(container, x, prevX, nextX, trebleY + STAVE_HEADROOM, bassY + STAVE_FULL_H)
  }
}

/**
 * 渲染单谱表（高音或低音单独模式，4 行 × 2 小节）
 */
function renderSingle(container, clef, questions, width, height) {
  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const startX = 40
  const clefWidth = 45
  const timeSigWidth = 30
  const innerPadding = 20
  const availableWidth = width - startX - innerPadding

  const m1ExtraWidth = clefWidth + timeSigWidth
  const measureWidth = (availableWidth - m1ExtraWidth) / MEASURES_PER_SYSTEM
  const m1X = startX + 10
  const m2X = m1X + measureWidth + m1ExtraWidth

  const beatXs = new Array(TOTAL_NOTES)
  const systemTops = []

  for (let s = 0; s < SYSTEMS_PER_GROUP; s++) {
    const staveY = TOP_MARGIN + SINGLE_ABOVE + s * (SINGLE_SYS_H + SINGLE_GAP)
    systemTops.push({ staveY })

    const stave1 = new Stave(m1X, staveY, measureWidth + m1ExtraWidth)
    stave1.addClef(clef).addTimeSignature('4/4')
    stave1.setContext(context).draw()

    const stave2 = new Stave(m2X, staveY, measureWidth)
    stave2.setContext(context).draw()

    const midBarline = new StaveConnector(stave2, stave2)
    midBarline.setType(StaveConnector.type.SINGLE)
    midBarline.setContext(context).draw()

    const base = s * NOTES_PER_SYSTEM
    const m1Items = takeMeasure(questions, base)
    const m2Items = takeMeasure(questions, base + BEATS_PER_MEASURE)

    // 单谱表模式：所有拍位都按当前谱表绘制
    const m1Notes = createMeasureNotes(m1Items, clef, true)
    const m2Notes = createMeasureNotes(m2Items, clef, true)

    drawVoice(context, stave1, m1Notes, measureWidth + m1ExtraWidth - 20)
    drawVoice(context, stave2, m2Notes, measureWidth - 20)

    collectXs(m1Notes, beatXs, base)
    collectXs(m2Notes, beatXs, base + BEATS_PER_MEASURE)
  }

  const ci = props.currentIndex
  if (ci >= 0 && ci < TOTAL_NOTES && beatXs[ci] != null) {
    const { staveY } = systemTops[Math.floor(ci / NOTES_PER_SYSTEM)]
    const x = beatXs[ci]
    const beatInMeasure = ci % BEATS_PER_MEASURE
    const prevX = beatInMeasure > 0 && beatXs[ci - 1] != null ? beatXs[ci - 1] : x - 25
    const nextX =
      beatInMeasure < BEATS_PER_MEASURE - 1 && beatXs[ci + 1] != null ? beatXs[ci + 1] : x + 25
    insertHighlight(container, x, prevX, nextX, staveY + STAVE_HEADROOM, staveY + STAVE_FULL_H)
  }
}

/**
 * 按谱面实际内容边界设置 viewBox，使其等比缩放并完整适配容器（配合 CSS 的 100% 宽高）
 */
function fitSvg(container) {
  const svg = container.querySelector('svg')
  if (!svg) return
  try {
    const bbox = svg.getBBox()
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const pad = 6
      svg.setAttribute(
        'viewBox',
        `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`
      )
    }
  } catch (e) {
    // getBBox 不可用时退化为固定 viewBox
  }
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  // VexFlow 会在 SVG 上写入固定像素的 style 宽高，这里改为 100% 以随容器等比缩放
  svg.style.width = '100%'
  svg.style.height = '100%'
}

function render() {
  nextTick(() => {
    const container = staffEl.value
    if (!container) return
    container.innerHTML = ''

    const notes = props.questions
    if (notes.length === 0) return

    // 依据容器可用宽高比推导渲染宽度，保证 4 行谱表等比缩放后尽量铺满
    const cw = Math.max(container.clientWidth || 0, 320)
    const ch = Math.max(container.clientHeight || 0, 200)
    const isGrand = props.clefMode === 'both'
    const designHeight = isGrand ? GRAND_DESIGN_H : SINGLE_DESIGN_H
    const estHeight = isGrand ? GRAND_EST_H : SINGLE_EST_H
    const renderWidth = Math.max(700, Math.round((estHeight * cw) / ch))

    if (isGrand) {
      renderGrandStaff(container, notes, renderWidth, designHeight)
    } else {
      renderSingle(container, props.clefMode, notes, renderWidth, designHeight)
    }

    fitSvg(container)
  })
}

onMounted(render)
watch(
  () => [props.questions, props.currentIndex, props.clefMode],
  render,
  { deep: true }
)
</script>

<style scoped>
.staff-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.staff-svg-wrapper {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.staff-svg-wrapper :deep(svg) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
.hint-label {
  position: sticky;
  top: 8px;
  align-self: flex-end;
  margin-bottom: -36px;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.9);
  color: #ffffff;
  border: 1px solid var(--accent);
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

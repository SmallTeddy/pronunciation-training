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
  let parts = []
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

// 小节布局：8 个音 = 2 小节，每小节 4 拍 (4/4)
const BEATS_PER_MEASURE = 4
const TOTAL_MEASURES = 2

/**
 * 为某个谱表在某个小节内创建音符序列（混合音符与四分休止符）
 * @param {Array} items 该小节内的题目 [{ midi, clef, status, originalIndex }]
 * @param {string} clef 'treble' | 'bass'
 * @returns {Array} StaveNote 数组
 */
function createMeasureNotes(items, clef) {
  return items.map((item, idxInMeasure) => {
    // 全局原始索引（用于判断是否为当前音、着色）
    const globalIdx = item.originalIndex
    // 判断该拍是否是当前谱表的音符（否则为休止符）
    const isNote = item.clef === clef

    if (isNote) {
      const key = midiToVexKey(item.midi)
      const stemDir = getStemDirection(item.midi, clef)
      const note = new StaveNote({
        keys: [key],
        duration: 'q',
        stem_direction: stemDir === 'up' ? 1 : -1,
      })
      // 着色
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
    } else {
      // 四分休止符：高音谱表休止符放在 b/4（第三线），低音谱表放在 d/3（第三线）
      const restKey = clef === 'treble' ? 'b/4' : 'd/3'
      const rest = new StaveNote({
        keys: [restKey],
        duration: 'qr',
      })
      return rest
    }
  })
}

/**
 * 渲染大谱表（双小节 4/4 拍布局）
 */
function renderGrandStaff(container, questions) {
  const width = container.clientWidth || 640

  // 增大上下边距，确保过高/过低的音（含加线）完整显示
  const trebleY = 60
  const staveHeight = 66 // VexFlow 5 线谱表高度
  const gap = 30
  const bassY = trebleY + staveHeight + gap
  const bottomPad = 70
  const height = bassY + staveHeight + bottomPad

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
  const measureWidth = (availableWidth - m1ExtraWidth) / TOTAL_MEASURES

  // 第 1 小节
  const m1X = braceX + 10
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
  const m2X = m1X + measureWidth + m1ExtraWidth
  const trebleStave2 = new Stave(m2X, trebleY, measureWidth)
  trebleStave2.setContext(context).draw()

  const bassStave2 = new Stave(m2X, bassY, measureWidth)
  bassStave2.setContext(context).draw()

  // 小节间 barline（同时连接高低音谱表）
  const midBarline = new StaveConnector(trebleStave2, bassStave2)
  midBarline.setType(StaveConnector.type.SINGLE)
  midBarline.setContext(context).draw()

  // 收集当前音的 x 位置（用于粉色高亮列）
  let currentNoteX = null
  let currentNoteWidth = null

  // 构建每个小节每个谱表的题目
  const m1Questions = questions.slice(0, BEATS_PER_MEASURE).map((q, i) => ({ ...q, originalIndex: i }))
  const m2Questions = questions.slice(BEATS_PER_MEASURE, BEATS_PER_MEASURE * 2).map((q, i) => ({ ...q, originalIndex: i + BEATS_PER_MEASURE }))

  // 高音谱表
  const trebleM1Notes = createMeasureNotes(m1Questions, 'treble')
  const trebleM2Notes = createMeasureNotes(m2Questions, 'treble')
  // 低音谱表
  const bassM1Notes = createMeasureNotes(m1Questions, 'bass')
  const bassM2Notes = createMeasureNotes(m2Questions, 'bass')

  // 格式化并绘制
  const trebleM1Voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  trebleM1Voice.addTickables(trebleM1Notes)
  new Formatter().joinVoices([trebleM1Voice]).format([trebleM1Voice], measureWidth + m1ExtraWidth - 20)
  trebleM1Voice.draw(context, trebleStave1)

  const bassM1Voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  bassM1Voice.addTickables(bassM1Notes)
  new Formatter().joinVoices([bassM1Voice]).format([bassM1Voice], measureWidth + m1ExtraWidth - 20)
  bassM1Voice.draw(context, bassStave1)

  const trebleM2Voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  trebleM2Voice.addTickables(trebleM2Notes)
  new Formatter().joinVoices([trebleM2Voice]).format([trebleM2Voice], measureWidth - 20)
  trebleM2Voice.draw(context, trebleStave2)

  const bassM2Voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  bassM2Voice.addTickables(bassM2Notes)
  new Formatter().joinVoices([bassM2Voice]).format([bassM2Voice], measureWidth - 20)
  bassM2Voice.draw(context, bassStave2)

  // 找到当前音对应的 x：currentIndex 对应的拍位置
  if (props.currentIndex >= 0 && props.currentIndex < questions.length) {
    const beatXs = []
    // 从每个 voice 的 tickables 中按顺序取 x
    const m1Tickables = trebleM1Voice.getTickables()
    const m2Tickables = trebleM2Voice.getTickables()
    for (let i = 0; i < BEATS_PER_MEASURE; i++) {
      beatXs.push(m1Tickables[i].getAbsoluteX())
    }
    for (let i = 0; i < BEATS_PER_MEASURE; i++) {
      beatXs.push(m2Tickables[i].getAbsoluteX())
    }
    currentNoteX = beatXs[props.currentIndex]
    // 估算列宽：取相邻音的间距
    const prev = props.currentIndex > 0 ? beatXs[props.currentIndex - 1] : trebleStave1.getNoteStartX()
    const next = props.currentIndex < beatXs.length - 1 ? beatXs[props.currentIndex + 1] : trebleStave2.getWidth() + trebleStave2.getX()
    currentNoteWidth = (next - prev) / 2
  }

  // 绘制当前音的粉色高亮列
  if (currentNoteX !== null) {
    const colLeft = currentNoteX - currentNoteWidth * 0.6
    const colRight = currentNoteX + currentNoteWidth * 0.6
    const svgEl = container.querySelector('svg')
    if (svgEl) {
      const SVG_NS = 'http://www.w3.org/2000/svg'
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', colLeft)
      rect.setAttribute('y', trebleY - 10)
      rect.setAttribute('width', colRight - colLeft)
      rect.setAttribute('height', bassY + staveHeight - trebleY + 20)
      rect.setAttribute('fill', 'rgba(244, 114, 182, 0.25)')
      rect.setAttribute('rx', '4')
      // 插入到最底层（音符之前）
      svgEl.insertBefore(rect, svgEl.firstChild)
    }
  }
}

/**
 * 渲染单谱表（高音或低音单独模式），同样采用双小节布局
 */
function renderSingle(container, clef, questions) {
  const width = container.clientWidth || 640
  const staveY = 50
  const staveHeight = 66
  const height = staveY + staveHeight + 60

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const startX = 40
  const clefWidth = 45
  const timeSigWidth = 30
  const innerPadding = 20
  const availableWidth = width - startX - innerPadding
  const m1ExtraWidth = clefWidth + timeSigWidth
  const measureWidth = (availableWidth - m1ExtraWidth) / TOTAL_MEASURES

  const m1X = startX + 10
  const stave1 = new Stave(m1X, staveY, measureWidth + m1ExtraWidth)
  stave1.addClef(clef).addTimeSignature('4/4')
  stave1.setContext(context).draw()

  const m2X = m1X + measureWidth + m1ExtraWidth
  const stave2 = new Stave(m2X, staveY, measureWidth)
  stave2.setContext(context).draw()

  const midBarline = new StaveConnector(stave2, stave2)
  midBarline.setType(StaveConnector.type.SINGLE)
  midBarline.setContext(context).draw()

  const m1Questions = questions.slice(0, BEATS_PER_MEASURE).map((q, i) => ({ ...q, originalIndex: i }))
  const m2Questions = questions.slice(BEATS_PER_MEASURE, BEATS_PER_MEASURE * 2).map((q, i) => ({ ...q, originalIndex: i + BEATS_PER_MEASURE }))

  // 单谱表模式：所有拍位都是该谱表的音符（无对侧休止符）
  const m1Notes = m1Questions.map((item) => {
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
    if (item.originalIndex === props.currentIndex) color = COLORS.current
    note.setStyle({ fillStyle: color, strokeStyle: color })
    if (item.originalIndex === props.currentIndex) {
      const ann = new Annotation('▲')
      ann.setVerticalJustification(Annotation.VerticalJustify.TOP)
      note.addModifier(ann, 0)
    }
    return note
  })

  const m2Notes = m2Questions.map((item) => {
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
    if (item.originalIndex === props.currentIndex) color = COLORS.current
    note.setStyle({ fillStyle: color, strokeStyle: color })
    if (item.originalIndex === props.currentIndex) {
      const ann = new Annotation('▲')
      ann.setVerticalJustification(Annotation.VerticalJustify.TOP)
      note.addModifier(ann, 0)
    }
    return note
  })

  const voice1 = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  voice1.addTickables(m1Notes)
  new Formatter().joinVoices([voice1]).format([voice1], measureWidth + m1ExtraWidth - 20)
  voice1.draw(context, stave1)

  const voice2 = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 })
  voice2.addTickables(m2Notes)
  new Formatter().joinVoices([voice2]).format([voice2], measureWidth - 20)
  voice2.draw(context, stave2)

  // 当前音粉色高亮列
  if (props.currentIndex >= 0 && props.currentIndex < questions.length) {
    const beatXs = []
    for (const n of voice1.getTickables()) beatXs.push(n.getAbsoluteX())
    for (const n of voice2.getTickables()) beatXs.push(n.getAbsoluteX())
    const cx = beatXs[props.currentIndex]
    const prev = props.currentIndex > 0 ? beatXs[props.currentIndex - 1] : stave1.getNoteStartX()
    const next = props.currentIndex < beatXs.length - 1 ? beatXs[props.currentIndex + 1] : stave2.getX() + stave2.getWidth()
    const colW = (next - prev) / 2
    const svgEl = container.querySelector('svg')
    if (svgEl) {
      const SVG_NS = 'http://www.w3.org/2000/svg'
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', cx - colW * 0.6)
      rect.setAttribute('y', staveY - 10)
      rect.setAttribute('width', colW * 1.2)
      rect.setAttribute('height', staveHeight + 20)
      rect.setAttribute('fill', 'rgba(244, 114, 182, 0.25)')
      rect.setAttribute('rx', '4')
      svgEl.insertBefore(rect, svgEl.firstChild)
    }
  }
}

function render() {
  nextTick(() => {
    const container = staffEl.value
    if (!container) return
    container.innerHTML = ''

    const notes = props.questions
    if (notes.length === 0) return

    if (props.clefMode === 'both') {
      renderGrandStaff(container, notes)
    } else {
      renderSingle(container, props.clefMode, notes)
    }
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
  display: flex;
  flex-direction: column;
  align-items: center;
}
.staff-svg-wrapper {
  width: 100%;
  overflow: visible;
}
.staff-svg-wrapper :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
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

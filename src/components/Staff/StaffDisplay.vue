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

/**
 * 创建单谱表的音符序列 voice
 */
function createNotesVoice(noteList, clef) {
  if (!noteList || noteList.length === 0) return null
  const notes = noteList.map((item, idx) => {
    const key = midiToVexKey(item.midi)
    const stemDir = getStemDirection(item.midi, clef)
    const note = new StaveNote({
      keys: [key],
      duration: 'q',
      stem_direction: stemDir === 'up' ? 1 : -1,
    })
    // 设置颜色
    let color = COLORS.pending
    if (item.status === 'correct') color = COLORS.correct
    else if (item.status === 'wrong') color = COLORS.wrong
    if (idx === props.currentIndex) color = COLORS.current
    note.setStyle({ fillStyle: color, strokeStyle: color })
    // 当前音添加标记
    if (idx === props.currentIndex) {
      const ann = new Annotation('▲')
      ann.setVerticalJustification(Annotation.VerticalJustify.TOP)
      note.addModifier(ann, 0)
    }
    return note
  })
  const voice = new Voice({
    num_beats: noteList.length,
    beat_value: 4,
  })
  voice.addTickables(notes)
  return voice
}

/**
 * 渲染单谱表
 */
function renderSingle(container, clef, noteList) {
  const width = container.clientWidth || 640
  const height = 150
  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const staveX = 45
  const staveY = 30
  const staveWidth = width - 65

  const stave = new Stave(staveX, staveY, staveWidth)
  stave.addClef(clef)
  stave.setContext(context).draw()

  const voice = createNotesVoice(noteList, clef)
  if (voice) {
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 20)
    voice.draw(context, stave)
  }
}

/**
 * 渲染大谱表
 */
function renderGrandStaff(container, noteList) {
  const width = container.clientWidth || 640
  const trebleY = 20
  const staveHeight = 70
  const gap = 18
  const bassY = trebleY + staveHeight + gap
  const height = bassY + staveHeight + 20

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const staveX = 50
  const staveWidth = width - 70

  const trebleStave = new Stave(staveX, trebleY, staveWidth)
  trebleStave.addClef('treble')
  trebleStave.setContext(context).draw()

  const bassStave = new Stave(staveX, bassY, staveWidth)
  bassStave.addClef('bass')
  bassStave.setContext(context).draw()

  const connector = new StaveConnector(trebleStave, bassStave)
  connector.setType(StaveConnector.type.BRACE)
  connector.setContext(context).draw()

  // 按 clef 分配音符
  const trebleNotes = noteList.filter((n) => n.clef === 'treble')
  const bassNotes = noteList.filter((n) => n.clef === 'bass')

  const trebleVoice = createNotesVoice(trebleNotes, 'treble')
  if (trebleVoice) {
    new Formatter().joinVoices([trebleVoice]).format([trebleVoice], staveWidth - 20)
    trebleVoice.draw(context, trebleStave)
  }

  const bassVoice = createNotesVoice(bassNotes, 'bass')
  if (bassVoice) {
    new Formatter().joinVoices([bassVoice]).format([bassVoice], staveWidth - 20)
    bassVoice.draw(context, bassStave)
  }
}

function render() {
  nextTick(() => {
    const container = staffEl.value
    if (!container) return
    container.innerHTML = ''

    const notes = props.questions
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

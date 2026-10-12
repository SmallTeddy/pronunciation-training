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
import { Renderer, Stave, StaveNote, Formatter, Voice, StaveConnector } from 'vexflow'
import {
  midiToVexKey,
  getStemDirection,
  midiToNoteName,
  midiToNoteNameFlat,
  getSolfege,
} from '../../utils/musicTheory.js'

const props = defineProps({
  clefMode: { type: String, default: 'both' },
  currentNote: { type: Object, default: null },
  showNoteName: { type: Boolean, default: false },
  showSolfege: { type: Boolean, default: false },
  useFlat: { type: Boolean, default: false },
})

const staffEl = ref(null)

const hintText = computed(() => {
  if (!props.currentNote) return ''
  const { midi } = props.currentNote
  let parts = []
  if (props.showNoteName) {
    parts.push(props.useFlat ? midiToNoteNameFlat(midi) : midiToNoteName(midi))
  }
  if (props.showSolfege) parts.push(getSolfege(midi))
  return parts.join(' · ')
})

const showHint = computed(() => props.showNoteName || props.showSolfege)

/**
 * 创建一个带全音符/全休止符的 voice
 */
function createNoteVoice(midi, clef) {
  if (midi != null) {
    const key = midiToVexKey(midi)
    const stemDir = getStemDirection(midi, clef)
    const note = new StaveNote({
      keys: [key],
      duration: 'w',
      stem_direction: stemDir === 'up' ? 1 : -1,
    })
    return new Voice({ num_beats: 4, beat_value: 4 }).addTickable(note)
  }
  // 全休止符
  const rest = new StaveNote({ keys: ['b/4'], duration: 'wr' })
  return new Voice({ num_beats: 4, beat_value: 4 }).addTickable(rest)
}

/**
 * 渲染单谱表
 */
function renderSingle(container, clef, midi) {
  const width = container.clientWidth || 640
  const height = 170
  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const staveX = 50
  const staveY = 35
  const staveWidth = width - 70

  const stave = new Stave(staveX, staveY, staveWidth)
  stave.addClef(clef)
  stave.setContext(context).draw()

  const voice = createNoteVoice(midi, clef)
  new Formatter().joinVoices([voice]).format([voice], staveWidth - 30)
  voice.draw(context, stave)
}

/**
 * 渲染大谱表（高音 + 低音），单个 SVG，带括号连接
 */
function renderGrandStaff(container, note) {
  const width = container.clientWidth || 640
  // 动态计算高度：高音谱表 + 间距 + 低音谱表
  const staveYTop = 30
  const staveHeight = 80 // 约 5 线高度
  const gap = 24 // 两谱表间距（约 2 个线间）
  const trebleY = staveYTop
  const bassY = trebleY + staveHeight + gap
  const height = bassY + staveHeight + 20

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const staveX = 55
  const staveWidth = width - 75

  const trebleStave = new Stave(staveX, trebleY, staveWidth)
  trebleStave.addClef('treble')
  trebleStave.setContext(context).draw()

  const bassStave = new Stave(staveX, bassY, staveWidth)
  bassStave.addClef('bass')
  bassStave.setContext(context).draw()

  // 括号连接
  const connector = new StaveConnector(trebleStave, bassStave)
  connector.setType(StaveConnector.type.BRACE)
  connector.setContext(context).draw()

  // 音符归属：按题目指定的谱表放置，另一谱表显示全休止符
  const trebleMidi = note && note.clef === 'treble' ? note.midi : null
  const bassMidi = note && note.clef === 'bass' ? note.midi : null

  // 高音谱表 voice
  const trebleVoice = createNoteVoice(trebleMidi, 'treble')
  new Formatter().joinVoices([trebleVoice]).format([trebleVoice], staveWidth - 30)
  trebleVoice.draw(context, trebleStave)

  // 低音谱表 voice
  const bassVoice = createNoteVoice(bassMidi, 'bass')
  new Formatter().joinVoices([bassVoice]).format([bassVoice], staveWidth - 30)
  bassVoice.draw(context, bassStave)
}

function render() {
  nextTick(() => {
    const container = staffEl.value
    if (!container) return
    container.innerHTML = ''

    if (props.clefMode === 'both') {
      renderGrandStaff(container, props.currentNote)
    } else {
      const midi = props.currentNote ? props.currentNote.midi : null
      renderSingle(container, props.clefMode, midi)
    }
  })
}

onMounted(render)
watch(
  () => [props.currentNote, props.clefMode],
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
  padding: 6px 16px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.9);
  color: #ffffff;
  border: 1px solid var(--accent);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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

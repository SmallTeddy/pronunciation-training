<template>
  <div class="staff-container" :class="{ 'staff-both': clefMode === 'both' }">
    <div v-if="clefMode === 'both'" class="grand-staff">
      <div ref="trebleEl" class="staff-svg"></div>
      <div ref="bassEl" class="staff-svg"></div>
    </div>
    <div v-else ref="singleEl" class="staff-svg single"></div>
    <transition name="fade">
      <div v-if="showHint && currentNote" class="hint-label">
        {{ hintText }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { Renderer, Stave, StaveNote, Formatter, Voice, Barline } from 'vexflow'
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

const trebleEl = ref(null)
const bassEl = ref(null)
const singleEl = ref(null)

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
 * 使用 Renderer 直接渲染单谱表
 */
function renderStaff(container, clef, midi) {
  if (!container) return
  container.innerHTML = ''
  const width = container.clientWidth || 640
  const height = clef === 'both' ? 150 : 160

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()
  context.setFont('Arial', 10, '')

  const staveWidth = width - 60
  const staveX = 50
  const staveY = 30

  const stave = new Stave(staveX, staveY, staveWidth)
  stave.addClef(clef)
  stave.setContext(context).draw()

  if (midi != null) {
    const key = midiToVexKey(midi)
    const stemDir = getStemDirection(midi, clef)
    const note = new StaveNote({
      keys: [key],
      duration: 'w',
      stem_direction: stemDir === 'up' ? 1 : -1,
    })

    const voice = new Voice({ num_beats: 4, beat_value: 4 })
    voice.addTickable(note)

    new Formatter().joinVoices([voice]).format([voice], staveWidth - 20)
    voice.draw(context, stave)
  }
}

function render() {
  nextTick(() => {
    if (props.clefMode === 'both') {
      const note = props.currentNote
      const trebleMidi = note && note.clef === 'treble' ? note.midi : null
      const bassMidi = note && note.clef === 'bass' ? note.midi : null
      renderStaff(trebleEl.value, 'treble', trebleMidi)
      renderStaff(bassEl.value, 'bass', bassMidi)
    } else {
      const midi = props.currentNote ? props.currentNote.midi : null
      renderStaff(singleEl.value, props.clefMode, midi)
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
.grand-staff {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
}
.staff-svg {
  width: 100%;
  height: 150px;
  overflow: visible;
}
.staff-svg.single {
  height: 170px;
}
.staff-both .staff-svg {
  height: 140px;
}
.hint-label {
  position: absolute;
  top: 8px;
  right: 16px;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent);
  border: 1px solid var(--accent);
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

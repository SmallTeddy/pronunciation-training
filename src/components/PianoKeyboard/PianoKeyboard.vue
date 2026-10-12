<template>
  <div class="piano-wrapper" :class="{ 'feedback-correct': feedback === 'correct', 'feedback-wrong': feedback === 'wrong' }">
    <div class="piano-scroll">
      <div class="piano-keyboard" :style="keyboardStyle">
        <template v-for="key in keys" :key="key.midi">
          <!-- 白键 -->
          <div
            class="piano-key white-key"
            :class="[getKeyClass(key.midi), { 'is-c-key': key.isC, 'is-pressed': pressedMidi === key.midi }]"
            @mousedown="pressKey(key.midi)"
            @mouseup="releaseKey"
            @mouseleave="releaseKey"
            @touchstart.prevent="pressKey(key.midi)"
            @touchend.prevent="releaseKey"
            @touchcancel="releaseKey"
          >
            <span v-if="key.isC" class="octave-label">C{{ key.octave }}</span>
          </div>
        </template>
        <!-- 黑键层 -->
        <div class="black-keys-layer" :style="blackLayerStyle">
          <div
            v-for="key in blackKeys"
            :key="key.midi"
            class="piano-key black-key"
            :class="[getKeyClass(key.midi), { 'is-pressed': pressedMidi === key.midi }]"
            :style="{ left: key.left + 'px' }"
            @mousedown="pressKey(key.midi)"
            @mouseup="releaseKey"
            @mouseleave="releaseKey"
            @touchstart.prevent="pressKey(key.midi)"
            @touchend.prevent="releaseKey"
            @touchcancel="releaseKey"
          ></div>
        </div>
      </div>
    </div>
    <div v-if="showShortcutHint" class="shortcut-hint">
      💡 快捷键：白键 A S D F G H J K L ; &nbsp;|&nbsp; 黑键 W E T Y U O P &nbsp;|&nbsp; 空格/回车：下一题
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getPianoKeys, noteNameToMidi, midiToNoteName, isBlackKey } from '../../utils/musicTheory.js'

const props = defineProps({
  range: { type: Array, default: () => ['C3', 'C6'] },
  highlightMidi: { type: Number, default: null },
  feedbackMidi: { type: Number, default: null },
  feedback: { type: String, default: null },
  disabled: { type: Boolean, default: false },
  showLabel: { type: Boolean, default: false },
  showShortcutHint: { type: Boolean, default: true },
  activeMidi: { type: Number, default: null },
})

const emit = defineEmits(['note'])

const whiteKeyWidth = 46
const whiteKeyHeight = 190
const blackKeyWidth = 28
const blackKeyHeight = 115

const pressedMidi = ref(null)
let releaseTimer = null

const lowMidi = computed(() => noteNameToMidi(props.range[0]))
const highMidi = computed(() => noteNameToMidi(props.range[1]))

const allKeys = computed(() => getPianoKeys(lowMidi.value, highMidi.value))

const whiteKeys = computed(() =>
  allKeys.value
    .filter((k) => !k.isBlack)
    .map((k) => ({
      ...k,
      isC: k.name.startsWith('C'),
      octave: parseInt(k.name.slice(-1), 10),
    }))
)

// 黑键定位：黑键位于前一个白键与后一个白键的交界处
const blackKeys = computed(() => {
  let whiteIndex = 0
  const blacks = []
  for (const key of allKeys.value) {
    if (key.isBlack) {
      // 黑键中心位于第 whiteIndex 个白键的右边缘
      const left = whiteIndex * whiteKeyWidth - blackKeyWidth / 2
      blacks.push({ ...key, left })
    } else {
      whiteIndex++
    }
  }
  return blacks
})

const keys = computed(() => whiteKeys.value)

const keyboardWidth = computed(() => whiteKeys.value.length * whiteKeyWidth)

const keyboardStyle = computed(() => ({
  width: keyboardWidth.value + 'px',
  height: whiteKeyHeight + 'px',
}))

const blackLayerStyle = computed(() => ({
  width: keyboardWidth.value + 'px',
  height: blackKeyHeight + 'px',
}))

function pressKey(midi) {
  if (props.disabled) return
  pressedMidi.value = midi
  emit('note', midi)
}

function releaseKey() {
  pressedMidi.value = null
}

// 键盘快捷键按下时的视觉反馈
watch(
  () => props.activeMidi,
  (val) => {
    if (val != null) {
      pressedMidi.value = val
      clearTimeout(releaseTimer)
      releaseTimer = setTimeout(() => {
        pressedMidi.value = null
      }, 200)
    }
  }
)

function getKeyClass(midi) {
  const cls = []
  if (props.feedback === 'correct' && props.highlightMidi === midi) {
    cls.push('key-correct')
  } else if (props.feedback === 'wrong' && props.highlightMidi === midi) {
    cls.push('key-correct')
  }
  if (props.feedback === 'wrong' && props.feedbackMidi === midi) {
    cls.push('key-wrong')
  }
  return cls
}
</script>

<style scoped>
.piano-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.piano-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}
.piano-keyboard {
  position: relative;
  display: flex;
  flex-shrink: 0;
  border: 2px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a1a;
  margin: 0 auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.white-key {
  width: 46px;
  height: 190px;
  background: linear-gradient(to bottom, #ffffff 0%, #f5f5f5 90%, #e0e0e0 100%);
  border-right: 1px solid #c0c0c0;
  box-sizing: border-box;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10px;
  transition: background 0.08s, transform 0.05s;
  user-select: none;
}
.white-key:hover {
  background: linear-gradient(to bottom, #eef0ff 0%, #dde0ff 100%);
}
.white-key.is-pressed {
  background: linear-gradient(to bottom, #c7d2fe 0%, #a5b4fc 100%);
  transform: translateY(1px);
}
.white-key.is-c-key::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent);
  opacity: 0.5;
}
.octave-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 700;
  pointer-events: none;
}
.black-keys-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.black-key {
  position: absolute;
  top: 0;
  width: 28px;
  height: 115px;
  background: linear-gradient(to bottom, #2a2a2a 0%, #000000 100%);
  border-radius: 0 0 4px 4px;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2;
  transition: background 0.08s, transform 0.05s;
  user-select: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.black-key:hover {
  background: linear-gradient(to bottom, #3a3a3a 0%, #1a1a1a 100%);
}
.black-key.is-pressed {
  background: linear-gradient(to bottom, #6366f1 0%, #4338ca 100%);
  transform: translateY(1px);
}
.key-correct {
  background: linear-gradient(to bottom, #6ee7b7 0%, #34d399 100%) !important;
}
.black-key.key-correct {
  background: linear-gradient(to bottom, #10b981 0%, #059669 100%) !important;
}
.key-wrong {
  background: linear-gradient(to bottom, #fca5a5 0%, #f87171 100%) !important;
}
.black-key.key-wrong {
  background: linear-gradient(to bottom, #ef4444 0%, #b91c1c 100%) !important;
}
.shortcut-hint {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.6;
}
.feedback-correct .piano-keyboard {
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
}
.feedback-wrong .piano-keyboard {
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>

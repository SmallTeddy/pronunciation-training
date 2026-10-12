<template>
  <div class="piano-wrapper" :class="{ 'feedback-correct': feedback === 'correct', 'feedback-wrong': feedback === 'wrong' }">
    <div class="piano-keyboard" :style="keyboardStyle">
      <template v-for="key in keys" :key="key.midi">
        <!-- 白键 -->
        <div
          v-if="!key.isBlack"
          class="piano-key white-key"
          :class="getKeyClass(key.midi)"
          @mousedown="onKey(key.midi)"
          @touchstart.prevent="onKey(key.midi)"
        >
          <span v-if="showLabel" class="key-label">{{ key.whiteName }}</span>
        </div>
      </template>
      <!-- 黑键层 -->
      <div class="black-keys-layer" :style="blackLayerStyle">
        <div
          v-for="key in blackKeys"
          :key="key.midi"
          class="piano-key black-key"
          :class="getKeyClass(key.midi)"
          :style="{ left: key.left + 'px' }"
          @mousedown="onKey(key.midi)"
          @touchstart.prevent="onKey(key.midi)"
        ></div>
      </div>
    </div>
    <div v-if="showShortcutHint" class="shortcut-hint">
      💡 快捷键：白键 A S D F G H J K L ; 黑键 W E T Y U O P
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getPianoKeys, noteNameToMidi } from '../../utils/musicTheory.js'

const props = defineProps({
  range: { type: Array, default: () => ['C3', 'C6'] }, // [low, high]
  highlightMidi: { type: Number, default: null },      // 正确答案高亮
  feedbackMidi: { type: Number, default: null },       // 用户选错的音
  feedback: { type: String, default: null },           // 'correct' | 'wrong'
  disabled: { type: Boolean, default: false },
  showLabel: { type: Boolean, default: false },
  showShortcutHint: { type: Boolean, default: true },
})

const emit = defineEmits(['note'])

const whiteKeyWidth = 48
const whiteKeyHeight = 200
const blackKeyWidth = 30
const blackKeyHeight = 120

const lowMidi = computed(() => noteNameToMidi(props.range[0]))
const highMidi = computed(() => noteNameToMidi(props.range[1]))

// 所有按键
const allKeys = computed(() => getPianoKeys(lowMidi.value, highMidi.value))

// 白键
const whiteKeys = computed(() => allKeys.value.filter((k) => !k.isBlack))

// 黑键，并计算每个黑键在白键层中的 left 偏移
const blackKeys = computed(() => {
  let whiteIndex = 0
  const blacks = []
  for (const key of allKeys.value) {
    if (key.isBlack) {
      // 黑键位于前一个白键的右侧
      const left = (whiteIndex + 1) * whiteKeyWidth - blackKeyWidth / 2
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

function onKey(midi) {
  if (props.disabled) return
  emit('note', midi)
}
</script>

<style scoped>
.piano-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  width: 100%;
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
}
.white-key {
  width: 48px;
  height: 200px;
  background: linear-gradient(to bottom, #fff 0%, #f0f0f0 100%);
  border-right: 1px solid #ccc;
  box-sizing: border-box;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
  transition: background 0.1s;
  user-select: none;
}
.white-key:hover {
  background: linear-gradient(to bottom, #e8eaff 0%, #d0d4ff 100%);
}
.white-key:active,
.white-key.active {
  background: linear-gradient(to bottom, #c7d2fe 0%, #a5b4fc 100%);
}
.white-key:last-child {
  border-right: none;
}
.key-label {
  font-size: 11px;
  color: #888;
  font-weight: 600;
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
  width: 30px;
  height: 120px;
  background: linear-gradient(to bottom, #333 0%, #000 100%);
  border-radius: 0 0 4px 4px;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2;
  transition: background 0.1s;
  user-select: none;
}
.black-key:hover {
  background: linear-gradient(to bottom, #444 0%, #1a1a1a 100%);
}
.black-key:active,
.black-key.active {
  background: linear-gradient(to bottom, #6366f1 0%, #4338ca 100%);
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
}
.feedback-correct .piano-keyboard {
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.4);
}
.feedback-wrong .piano-keyboard {
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.4);
}
</style>

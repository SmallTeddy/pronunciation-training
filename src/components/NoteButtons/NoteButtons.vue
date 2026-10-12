<template>
  <div class="note-buttons">
    <button
      v-for="btn in buttons"
      :key="btn.letter"
      class="note-btn"
      :class="{
        'is-pressed': pressedLetter === btn.letter,
        'is-correct': feedbackLetter === btn.letter && feedbackCorrect,
        'is-wrong': feedbackLetter === btn.letter && !feedbackCorrect,
      }"
      @mousedown="press(btn.letter)"
      @mouseup="release"
      @mouseleave="release"
      @touchstart.prevent="press(btn.letter)"
      @touchend.prevent="release"
    >
      <span class="btn-letter">{{ btn.letter }}</span>
      <span class="btn-key">{{ btn.key }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  // 用户最近一次作答的字母（仅在作答后短暂高亮，不预先显示正确答案）
  feedbackLetter: { type: String, default: null },
  // 最近一次作答是否正确
  feedbackCorrect: { type: Boolean, default: false },
  // 键盘按下时触发的字母
  activeLetter: { type: String, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['answer'])

// 7 个音名按钮，映射到电脑键盘 dfghjkl
const buttons = [
  { letter: 'C', key: 'D' },
  { letter: 'D', key: 'F' },
  { letter: 'E', key: 'G' },
  { letter: 'F', key: 'H' },
  { letter: 'G', key: 'J' },
  { letter: 'A', key: 'K' },
  { letter: 'B', key: 'L' },
]

const pressedLetter = ref(null)
let releaseTimer = null

function press(letter) {
  if (props.disabled) return
  pressedLetter.value = letter
  emit('answer', letter)
}

function release() {
  pressedLetter.value = null
}

// 键盘快捷键按下时的视觉反馈
watch(
  () => props.activeLetter,
  (val) => {
    if (val) {
      pressedLetter.value = val
      clearTimeout(releaseTimer)
      releaseTimer = setTimeout(() => {
        pressedLetter.value = null
      }, 180)
    }
  }
)
</script>

<style scoped>
.note-buttons {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: center;
}
.note-btn {
  flex: 1;
  max-width: 80px;
  aspect-ratio: 3 / 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  transition: all 0.1s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.note-btn:hover {
  border-color: var(--accent);
}
.note-btn:active,
.note-btn.is-pressed {
  background: var(--accent);
  color: white;
  transform: translateY(2px);
}
.btn-letter {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}
.btn-key {
  font-size: 11px;
  opacity: 0.6;
  font-weight: 600;
}
.note-btn.is-correct {
  background: #34d399 !important;
  border-color: #059669 !important;
  color: white !important;
}
.note-btn.is-wrong {
  background: #f87171 !important;
  border-color: #b91c1c !important;
  color: white !important;
}
</style>

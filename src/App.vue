<template>
  <div class="app" :class="themeClass">
    <header class="app-header">
      <div class="brand">
        <span class="logo">🎼</span>
        <h1>五线谱识谱训练器</h1>
      </div>
      <nav class="tabs">
        <button :class="{ active: tab === 'practice' }" @click="switchTab('practice')">练习</button>
        <button :class="{ active: tab === 'stats' }" @click="switchTab('stats')">统计</button>
        <button :class="{ active: tab === 'settings' }" @click="switchTab('settings')">设置</button>
      </nav>
    </header>

    <main class="app-main">
      <!-- 练习页 -->
      <section v-if="tab === 'practice'" class="practice-page">
        <div class="practice-info-bar">
          <div class="info-item">
            <span class="info-label">进度</span>
            <span class="info-value">{{ practice.currentIndex + 1 }}/{{ practice.questions.length || 32 }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">组数</span>
            <span class="info-value">{{ practice.groupCount + (practice.questions.length ? 1 : 0) }}</span>
          </div>
          <div class="info-item">
            <span class="info-value correct">✓ {{ session.correct }}</span>
          </div>
          <div class="info-item">
            <span class="info-value wrong">✗ {{ session.wrong }}</span>
          </div>
          <div v-if="practice.isTimedMode" class="info-item timer">
            <span class="info-label">剩余</span>
            <span class="info-value" :class="{ 'timer-low': practice.timeLeft <= 10 }">{{ practice.timeLeft }}s</span>
          </div>
          <div class="info-item">
            <span class="info-label">正确率</span>
            <span class="info-value">{{ accuracy }}%</span>
          </div>
        </div>

        <div class="staff-area">
          <StaffDisplay
            :clef-mode="store.settings.clefMode"
            :questions="practice.questions"
            :current-index="practice.currentIndex"
            :show-note-name="store.settings.showNoteName"
            :show-solfege="store.settings.showSolfege"
            :use-flat="store.settings.useFlat"
          />
        </div>

        <div class="action-bar">
          <button v-if="!practice.questions.length" class="btn-primary" @click="start">
            {{ practice.practiceMode === 'timed' ? '开始限时挑战' : '开始练习' }}
          </button>
          <button v-else class="btn-secondary" @click="end">结束练习</button>
        </div>

        <div class="buttons-area">
          <NoteButtons
            :feedback-letter="feedbackLetter"
            :feedback-correct="feedbackCorrect"
            :active-letter="activeLetter"
            :disabled="!practice.questions.length || practice.isGroupComplete"
            @answer="handleAnswer"
          />
        </div>
      </section>

      <!-- 统计页 -->
      <section v-else-if="tab === 'stats'" class="stats-page">
        <StatsPanel />
      </section>

      <!-- 设置页 -->
      <section v-else class="settings-page">
        <SettingsPanel />
      </section>
    </main>

    <footer v-if="tab !== 'practice'" class="app-footer">
      <span>五线谱识谱训练器 · 数据存储在本地浏览器</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { usePracticeStore } from './stores/practice.js'
import StaffDisplay from './components/Staff/StaffDisplay.vue'
import NoteButtons from './components/NoteButtons/NoteButtons.vue'
import StatsPanel from './components/Stats/StatsPanel.vue'
import SettingsPanel from './components/Settings/SettingsPanel.vue'
import { getNoteLetter } from './utils/musicTheory.js'
import { resumeAudio } from './services/audio.js'

const store = usePracticeStore()
const practice = store

const tab = ref('practice')
const activeLetter = ref(null)
const lastAnswer = ref({ letter: null, correct: false })
const session = computed(() => practice.sessionStats)

const themeClass = computed(() => `theme-${store.settings.theme}`)

const accuracy = computed(() => {
  if (session.value.total === 0) return 0
  return Math.round((session.value.correct / session.value.total) * 100)
})

// 用户最近一次作答的字母（用于按钮反馈，不预先显示正确答案）
const feedbackLetter = computed(() => lastAnswer.value.letter)
// 最近一次作答是否正确
const feedbackCorrect = computed(() => lastAnswer.value.correct)

// 电脑键盘到音名的映射：D F G H J K L -> C D E F G A B
const KEY_MAP = {
  d: 'C', f: 'D', g: 'E', h: 'F', j: 'G', k: 'A', l: 'B',
}

function switchTab(t) {
  if (t === 'stats') store.refreshData()
  tab.value = t
}

function start() {
  resumeAudio()
  practice.startSession()
}

function end() {
  practice.endSession()
}

function handleAnswer(letter) {
  const q = practice.currentQuestion
  if (!q) return
  const correct = getNoteLetter(q.midi) === letter
  lastAnswer.value = { letter, correct }
  practice.answer(letter)
  // 短暂清除错误高亮
  if (correct) {
    setTimeout(() => { lastAnswer.value = { letter: null, correct: false } }, 200)
  } else {
    setTimeout(() => { lastAnswer.value = { letter: null, correct: false } }, 400)
  }
}

// 键盘快捷键
function onKeydown(e) {
  if (tab.value !== 'practice') return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
  const letter = KEY_MAP[e.key.toLowerCase()]
  if (letter) {
    e.preventDefault()
    activeLetter.value = letter
    handleAnswer(letter)
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (!practice.questions.length) {
      e.preventDefault()
      start()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  practice.endSession()
})

watch(
  () => store.settings.theme,
  (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
  },
  { immediate: true }
)
</script>

<style scoped>
.app {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand .logo {
  font-size: 24px;
}
.brand h1 {
  font-size: 18px;
  margin: 0;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.tabs {
  display: flex;
  gap: 4px;
}
.tabs button {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.tabs button:hover {
  color: var(--text);
}
.tabs button.active {
  background: var(--accent);
  color: white;
}
.app-main {
  flex: 1;
  min-height: 0;
  padding: 12px;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.practice-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.practice-info-bar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  padding: 8px 14px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  flex-shrink: 0;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.info-label {
  font-size: 10px;
  color: var(--text-muted);
}
.info-value {
  font-size: 15px;
  font-weight: 700;
}
.info-value.correct {
  color: #34d399;
}
.info-value.wrong {
  color: #f87171;
}
.timer .info-value.timer-low {
  color: #f87171;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.staff-area {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
}
.buttons-area {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  flex-shrink: 0;
}
.action-bar {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.btn-primary,
.btn-secondary,
.btn-ghost {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn-primary {
  background: var(--accent);
  color: white;
}
.btn-primary:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}
.btn-secondary {
  background: var(--card-bg);
  color: var(--text);
  border: 1px solid var(--border);
}
.btn-secondary:hover {
  border-color: #f87171;
  color: #f87171;
}
.btn-ghost {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.btn-ghost:hover {
  background: rgba(99, 102, 241, 0.1);
}
.stats-page,
.settings-page {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.app-footer {
  text-align: center;
  padding: 10px;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>

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
            <span class="info-label">模式</span>
            <span class="info-value">{{ modeLabel }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">已答</span>
            <span class="info-value">{{ session.total }}</span>
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
            :current-note="practice.currentQuestion"
            :show-note-name="store.settings.showNoteName"
            :show-solfege="store.settings.showSolfege"
            :use-flat="store.settings.useFlat"
          />
        </div>

        <div class="feedback-area">
          <transition name="pop">
            <div v-if="practice.feedback" class="feedback-msg" :class="practice.feedback">
              <template v-if="practice.feedback === 'correct'">✓ 正确！</template>
              <template v-else>✗ 错误！正确答案是 {{ correctName }}</template>
            </div>
          </transition>
        </div>

        <div class="keyboard-area">
          <PianoKeyboard
            :range="store.settings.noteRange"
            :highlight-midi="practice.currentQuestion?.midi"
            :feedback-midi="practice.feedbackMidi"
            :feedback="practice.feedback"
            :active-midi="activeMidi"
            :show-label="false"
            @note="handleNote"
          />
        </div>

        <div class="action-bar">
          <button v-if="!practice.currentQuestion" class="btn-primary" @click="start">
            {{ practice.practiceMode === 'timed' ? '开始限时挑战' : '开始练习' }}
          </button>
          <button v-else class="btn-secondary" @click="end">结束练习</button>
          <button v-if="practice.currentQuestion && practice.feedback" class="btn-ghost" @click="practice.nextQuestion()">
            下一题 →
          </button>
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

    <footer class="app-footer">
      <span>五线谱识谱训练器 · 数据存储在本地浏览器</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { usePracticeStore } from './stores/practice.js'
import StaffDisplay from './components/Staff/StaffDisplay.vue'
import PianoKeyboard from './components/PianoKeyboard/PianoKeyboard.vue'
import StatsPanel from './components/Stats/StatsPanel.vue'
import SettingsPanel from './components/Settings/SettingsPanel.vue'
import { keyToMidi, midiToNoteName, midiToNoteNameFlat } from './utils/musicTheory.js'
import { resumeAudio } from './services/audio.js'

const store = usePracticeStore()
const practice = store

const tab = ref('practice')
const activeMidi = ref(null)
const session = computed(() => practice.sessionStats)

const themeClass = computed(() => `theme-${store.settings.theme}`)

const modeLabel = computed(() => {
  const map = {
    free: '自由练习',
    treble: '高音谱表',
    bass: '低音谱表',
    mixed: '双谱表混合',
    wrong: '错题强化',
    timed: '限时挑战',
  }
  return map[practice.practiceMode] || '自由练习'
})

const accuracy = computed(() => {
  if (session.value.total === 0) return 0
  return Math.round((session.value.correct / session.value.total) * 100)
})

const correctName = computed(() => {
  if (!practice.currentQuestion) return ''
  const m = practice.currentQuestion.midi
  return store.settings.useFlat ? midiToNoteNameFlat(m) : midiToNoteName(m)
})

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

function handleNote(midi) {
  practice.answer(midi)
}

// 键盘快捷键
function onKeydown(e) {
  if (tab.value !== 'practice') return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
  const midi = keyToMidi(e.key)
  if (midi != null) {
    e.preventDefault()
    activeMidi.value = midi
    handleNote(midi)
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (practice.currentQuestion && practice.feedback) {
      e.preventDefault()
      practice.nextQuestion()
    } else if (!practice.currentQuestion) {
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

// 主题变化时更新 html class
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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand .logo {
  font-size: 28px;
}
.brand h1 {
  font-size: 20px;
  margin: 0;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.tabs {
  display: flex;
  gap: 6px;
}
.tabs button {
  padding: 8px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
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
  padding: 20px;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}
.practice-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.practice-info-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-label {
  font-size: 11px;
  color: var(--text-muted);
}
.info-value {
  font-size: 16px;
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
  border-radius: 12px;
  padding: 16px;
  overflow-x: auto;
}
.feedback-area {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.feedback-msg {
  padding: 8px 20px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 700;
}
.feedback-msg.correct {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.4);
}
.feedback-msg.wrong {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.4);
}
.keyboard-area {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  overflow-x: auto;
}
.action-bar {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-primary,
.btn-secondary,
.btn-ghost {
  padding: 12px 28px;
  border-radius: 10px;
  font-size: 15px;
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
}
.app-footer {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.25s;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

// 练习状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '../services/storage.js'
import { generateQuestion } from '../services/questionGenerator.js'
import { makeNoteId, getNoteLetter } from '../utils/musicTheory.js'
import { playCorrectSound, playWrongSound, playNote } from '../services/audio.js'

// 每组题目数量：4 行 × 2 小节 × 4 拍 = 32 个音符
const GROUP_SIZE = 32

export const usePracticeStore = defineStore('practice', () => {
  const settings = ref(storage.getSettings())
  const noteStats = ref(storage.getNoteStats())
  const history = ref(storage.getHistory())

  // 当前一组题目：[{ midi, clef, status: 'pending'|'correct'|'wrong' }]
  const questions = ref([])
  const currentIndex = ref(0)
  const sessionStats = ref({ total: 0, correct: 0, wrong: 0 })
  const sessionStartTime = ref(null)
  const isTimedMode = ref(false)
  const timeLeft = ref(0)
  const timedTimer = ref(null)
  const groupCount = ref(0) // 已完成的组数

  const practiceMode = computed(() => settings.value.practiceMode)

  const currentQuestion = computed(() =>
    questions.value[currentIndex.value] || null
  )

  const isGroupComplete = computed(() =>
    questions.value.length > 0 && currentIndex.value >= questions.value.length
  )

  function updateSettings(patch) {
    settings.value = storage.saveSettings(patch)
  }

  function refreshData() {
    noteStats.value = storage.getNoteStats()
    history.value = storage.getHistory()
  }

  /**
   * 生成一组题目（GROUP_SIZE 个）
   */
  function generateGroup() {
    const group = []
    for (let i = 0; i < GROUP_SIZE; i++) {
      const q = generateQuestion(settings.value, practiceMode.value, noteStats.value)
      if (q) {
        group.push({ ...q, status: 'pending' })
      }
    }
    questions.value = group
    currentIndex.value = 0
  }

  /**
   * 用户作答（按音名字母匹配，忽略八度）
   * @param {string} letter 音名字母 C/D/E/F/G/A/B
   */
  function answer(letter) {
    if (isGroupComplete.value) return
    const q = currentQuestion.value
    if (!q || q.status !== 'pending') return

    const correctLetter = getNoteLetter(q.midi)
    const correct = correctLetter === letter.toUpperCase()

    q.status = correct ? 'correct' : 'wrong'

    // 更新统计
    const noteId = makeNoteId(q.clef, q.midi)
    const stat = storage.updateNoteStat(noteId, correct)
    noteStats.value[noteId] = stat

    sessionStats.value.total += 1
    if (correct) {
      sessionStats.value.correct += 1
      if (settings.value.soundEnabled) {
        playNote(q.midi)
        setTimeout(playCorrectSound, 120)
      }
    } else {
      sessionStats.value.wrong += 1
      if (settings.value.soundEnabled) playWrongSound()
    }

    // 推进到下一个音
    currentIndex.value += 1

    // 一组结束，自动开始下一组
    if (isGroupComplete.value) {
      groupCount.value += 1
      setTimeout(() => {
        if (!isTimedMode.value) {
          generateGroup()
        }
      }, 600)
    }
  }

  function startTimedMode() {
    isTimedMode.value = true
    timeLeft.value = settings.value.timedDuration
    sessionStats.value = { total: 0, correct: 0, wrong: 0 }
    groupCount.value = 0
    generateGroup()
    timedTimer.value = setInterval(() => {
      timeLeft.value -= 1
      if (timeLeft.value <= 0) {
        endTimedMode()
      }
    }, 1000)
  }

  function endTimedMode() {
    if (timedTimer.value) {
      clearInterval(timedTimer.value)
      timedTimer.value = null
    }
    isTimedMode.value = false
    const duration = settings.value.timedDuration
    storage.addHistory({
      mode: 'timed',
      total: sessionStats.value.total,
      correct: sessionStats.value.correct,
      duration,
    })
    history.value = storage.getHistory()
  }

  function startSession() {
    sessionStats.value = { total: 0, correct: 0, wrong: 0 }
    groupCount.value = 0
    sessionStartTime.value = Date.now()
    if (practiceMode.value === 'timed') {
      startTimedMode()
    } else {
      generateGroup()
    }
  }

  function endSession() {
    if (sessionStats.value.total > 0 && !isTimedMode.value) {
      const duration = Math.round((Date.now() - sessionStartTime.value) / 1000)
      storage.addHistory({
        mode: practiceMode.value,
        total: sessionStats.value.total,
        correct: sessionStats.value.correct,
        duration,
      })
      history.value = storage.getHistory()
    }
    questions.value = []
    currentIndex.value = 0
    if (timedTimer.value) {
      clearInterval(timedTimer.value)
      timedTimer.value = null
    }
    isTimedMode.value = false
  }

  return {
    settings,
    noteStats,
    history,
    questions,
    currentIndex,
    currentQuestion,
    isGroupComplete,
    groupCount,
    sessionStats,
    isTimedMode,
    timeLeft,
    practiceMode,
    updateSettings,
    refreshData,
    generateGroup,
    answer,
    startSession,
    endSession,
    startTimedMode,
    endTimedMode,
  }
})

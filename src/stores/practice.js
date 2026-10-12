// 练习状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '../services/storage.js'
import { generateQuestion } from '../services/questionGenerator.js'
import { makeNoteId, midiToNoteName } from '../utils/musicTheory.js'
import { playCorrectSound, playWrongSound, playNote } from '../services/audio.js'

export const usePracticeStore = defineStore('practice', () => {
  const settings = ref(storage.getSettings())
  const noteStats = ref(storage.getNoteStats())
  const history = ref(storage.getHistory())

  const currentQuestion = ref(null)   // { midi, clef }
  const feedback = ref(null)           // 'correct' | 'wrong' | null
  const feedbackMidi = ref(null)       // 用户选择的 midi
  const sessionStats = ref({ total: 0, correct: 0, wrong: 0 })
  const sessionStartTime = ref(null)
  const isTimedMode = ref(false)
  const timeLeft = ref(0)
  const timedTimer = ref(null)

  const practiceMode = computed(() => settings.value.practiceMode)

  /**
   * 保存设置
   */
  function updateSettings(patch) {
    settings.value = storage.saveSettings(patch)
  }

  /**
   * 刷新本地数据
   */
  function refreshData() {
    noteStats.value = storage.getNoteStats()
    history.value = storage.getHistory()
  }

  /**
   * 生成下一题
   */
  function nextQuestion() {
    feedback.value = null
    feedbackMidi.value = null
    const q = generateQuestion(settings.value, practiceMode.value, noteStats.value)
    currentQuestion.value = q
    return q
  }

  /**
   * 用户作答
   * @param {number} midi 用户选择的音高
   */
  function answer(midi) {
    if (!currentQuestion.value || feedback.value) return

    const correct = midi === currentQuestion.value.midi
    const { clef } = currentQuestion.value
    const noteId = makeNoteId(clef, currentQuestion.value.midi)

    // 更新统计
    const stat = storage.updateNoteStat(noteId, correct)
    noteStats.value[noteId] = stat

    sessionStats.value.total += 1
    if (correct) {
      sessionStats.value.correct += 1
      feedback.value = 'correct'
      if (settings.value.soundEnabled) {
        playNote(currentQuestion.value.midi)
        setTimeout(playCorrectSound, 150)
      }
    } else {
      sessionStats.value.wrong += 1
      feedback.value = 'wrong'
      feedbackMidi.value = midi
      if (settings.value.soundEnabled) playWrongSound()
    }

    // 自动进入下一题
    if (settings.value.autoNextDelay > 0 && !isTimedMode.value) {
      setTimeout(() => {
        if (feedback.value) nextQuestion()
      }, settings.value.autoNextDelay)
    }
  }

  /**
   * 开始限时挑战
   */
  function startTimedMode() {
    isTimedMode.value = true
    timeLeft.value = settings.value.timedDuration
    sessionStats.value = { total: 0, correct: 0, wrong: 0 }
    nextQuestion()
    timedTimer.value = setInterval(() => {
      timeLeft.value -= 1
      if (timeLeft.value <= 0) {
        endTimedMode()
      }
    }, 1000)
  }

  /**
   * 结束限时挑战
   */
  function endTimedMode() {
    if (timedTimer.value) {
      clearInterval(timedTimer.value)
      timedTimer.value = null
    }
    isTimedMode.value = false
    // 记录历史
    const duration = settings.value.timedDuration
    storage.addHistory({
      mode: 'timed',
      total: sessionStats.value.total,
      correct: sessionStats.value.correct,
      duration,
    })
    history.value = storage.getHistory()
    feedback.value = null
  }

  /**
   * 开始练习会话
   */
  function startSession() {
    sessionStats.value = { total: 0, correct: 0, wrong: 0 }
    sessionStartTime.value = Date.now()
    if (practiceMode.value === 'timed') {
      startTimedMode()
    } else {
      nextQuestion()
    }
  }

  /**
   * 结束练习会话，记录历史
   */
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
    currentQuestion.value = null
    feedback.value = null
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
    currentQuestion,
    feedback,
    feedbackMidi,
    sessionStats,
    isTimedMode,
    timeLeft,
    practiceMode,
    updateSettings,
    refreshData,
    nextQuestion,
    answer,
    startSession,
    endSession,
    startTimedMode,
    endTimedMode,
  }
})

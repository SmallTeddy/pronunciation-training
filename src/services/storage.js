// 本地存储服务 - 基于 LocalStorage
// 存储内容：音符统计、练习历史、用户设置

const STORAGE_KEY = 'staff_trainer_data_v1'

const defaultData = {
  noteStats: {},      // noteId -> { total, correct, wrong, streakWrong, lastPractice }
  history: [],        // [{ date, mode, total, correct, duration, timestamp }]
  settings: {
    clefMode: 'both',          // treble | bass | both
    practiceMode: 'free',      // free | treble | bass | mixed | wrong | timed
    noteRange: ['C3', 'C6'],
    includeAccidentals: false,
    showNoteName: false,
    showSolfege: false,
    useFlat: false,
    autoNextDelay: 1200,      // ms
    theme: 'dark',
    soundEnabled: true,
    showHint: false,
    timedDuration: 60,        // 限时挑战秒数
  },
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return clone(defaultData)
    const data = JSON.parse(raw)
    // 合并默认设置，避免新字段缺失
    return {
      noteStats: data.noteStats || {},
      history: data.history || [],
      settings: { ...defaultData.settings, ...(data.settings || {}) },
    }
  } catch (e) {
    console.error('Failed to load data', e)
    return clone(defaultData)
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save data', e)
  }
}

export const storage = {
  getData() {
    return load()
  },
  getSettings() {
    return load().settings
  },
  saveSettings(settings) {
    const data = load()
    data.settings = { ...data.settings, ...settings }
    save(data)
    return data.settings
  },
  getNoteStats() {
    return load().noteStats
  },
  /**
   * 更新音符统计
   * @param {string} noteId
   * @param {boolean} correct
   */
  updateNoteStat(noteId, correct) {
    const data = load()
    const stat = data.noteStats[noteId] || {
      total: 0, correct: 0, wrong: 0, streakWrong: 0, lastPractice: null,
    }
    stat.total += 1
    if (correct) {
      stat.correct += 1
      stat.streakWrong = 0
    } else {
      stat.wrong += 1
      stat.streakWrong += 1
    }
    stat.lastPractice = Date.now()
    data.noteStats[noteId] = stat
    save(data)
    return stat
  },
  getHistory() {
    return load().history
  },
  addHistory(record) {
    const data = load()
    data.history.push({
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
      ...record,
    })
    // 最多保留 365 条
    if (data.history.length > 365) {
      data.history = data.history.slice(-365)
    }
    save(data)
  },
  /**
   * 导出全部数据为 JSON
   */
  exportData() {
    return JSON.stringify(load(), null, 2)
  },
  /**
   * 导入数据
   */
  importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr)
      if (!data || typeof data !== 'object') throw new Error('invalid')
      save({
        noteStats: data.noteStats || {},
        history: data.history || [],
        settings: { ...defaultData.settings, ...(data.settings || {}) },
      })
      return true
    } catch (e) {
      console.error('Import failed', e)
      return false
    }
  },
  /**
   * 重置全部数据
   */
  resetAll() {
    save(clone(defaultData))
  },
  /**
   * 重置统计数据（保留设置）
   */
  resetStats() {
    const data = load()
    data.noteStats = {}
    data.history = []
    save(data)
  },
}

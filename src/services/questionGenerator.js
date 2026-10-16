// 出题算法 - 基于错误率的加权随机
import {
  getWhiteKeysInRange,
  makeNoteId,
  isBlackKey,
} from '../utils/musicTheory.js'

/**
 * 计算每个音的错误率
 */
function getErrorRate(stat) {
  if (!stat || stat.total === 0) return 0
  return stat.wrong / stat.total
}

/**
 * 计算权重
 * weight = base + errorRate * boostFactor + streakWrong * streakBoost
 */
function computeWeight(stat) {
  const base = 1
  const boostFactor = 4
  const streakBoost = 1.5
  const errorRate = getErrorRate(stat)
  const streakWrong = stat ? stat.streakWrong : 0
  return base + errorRate * boostFactor + streakWrong * streakBoost
}

/**
 * 加权随机选择
 * @param {Array} items [{ midi, clef, weight }]
 */
function weightedPick(items) {
  const totalWeight = items.reduce((s, it) => s + it.weight, 0)
  let r = Math.random() * totalWeight
  for (const it of items) {
    r -= it.weight
    if (r <= 0) return it
  }
  return items[items.length - 1]
}

/**
 * 获取候选音符集合
 * @param {Object} settings
 * @param {string} practiceMode
 * @param {Object} noteStats
 */
export function getCandidates(settings, practiceMode, noteStats) {
  const { noteRange, includeAccidentals } = settings
  const [low, high] = noteRange
  let clefs = []

  if (practiceMode === 'treble') clefs = ['treble']
  else if (practiceMode === 'bass') clefs = ['bass']
  else if (practiceMode === 'mixed') {
    clefs = ['treble', 'bass']
  } else {
    // free / timed / wrong 等模式：尊重用户的谱表选择（clefMode）
    clefs = settings.clefMode === 'both' ? ['treble', 'bass'] : [settings.clefMode]
  }

  const candidates = []
  for (const clef of clefs) {
    const notes = getWhiteKeysInRange(low, high, includeAccidentals)
    for (const midi of notes) {
      candidates.push({ midi, clef })
    }
  }
  return candidates
}

/**
 * 生成一道题目
 * @param {Object} settings
 * @param {string} practiceMode
 * @param {Object} noteStats
 * @returns {{ midi, clef }} | null
 */
export function generateQuestion(settings, practiceMode, noteStats) {
  const candidates = getCandidates(settings, practiceMode, noteStats)
  if (candidates.length === 0) return null

  // 错题强化模式：只选错误率 > 0 的音
  let pool = candidates
  if (practiceMode === 'wrong') {
    pool = candidates.filter(({ midi, clef }) => {
      const stat = noteStats[makeNoteId(clef, midi)]
      return stat && getErrorRate(stat) > 0.15
    })
    // 如果没有错题，回退到全部
    if (pool.length === 0) pool = candidates
  }

  // 计算权重
  const weighted = pool.map(({ midi, clef }) => {
    const stat = noteStats[makeNoteId(clef, midi)]
    return { midi, clef, weight: computeWeight(stat) }
  })

  return weightedPick(weighted)
}

/**
 * 获取所有音符的掌握程度（用于热力图）
 * 返回 [{ midi, clef, errorRate, total }]
 */
export function getMasteryList(noteStats, settings) {
  const candidates = getCandidates(settings, 'free', noteStats)
  return candidates.map(({ midi, clef }) => {
    const stat = noteStats[makeNoteId(clef, midi)]
    return {
      midi,
      clef,
      total: stat ? stat.total : 0,
      correct: stat ? stat.correct : 0,
      wrong: stat ? stat.wrong : 0,
      errorRate: getErrorRate(stat),
      mastery: stat ? Math.max(0, 1 - getErrorRate(stat)) : 1,
    }
  })
}

// 乐理工具 - 音高转换、音名计算、谱表位置等

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const DIATONIC_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']

// MIDI: C4 = 60
export const MIDI_C4 = 60

/**
 * 获取 MIDI 音高对应的音名（升号表示）
 * @param {number} midi
 * @returns {string} e.g. "C4"
 */
export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

/**
 * 获取 MIDI 音高对应的音名（降号表示）
 */
export function midiToNoteNameFlat(midi) {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return `${NOTE_NAMES_FLAT[noteIndex]}${octave}`
}

/**
 * 音名转 MIDI
 * @param {string} name e.g. "C4", "C#4", "Db4"
 * @returns {number}
 */
export function noteNameToMidi(name) {
  const match = name.match(/^([A-G])([#b]?)(\d+)$/)
  if (!match) return 0
  const [, letter, accidental, octaveStr] = match
  const octave = parseInt(octaveStr, 10)
  const baseIndex = NOTE_NAMES.indexOf(letter)
  let midi = (octave + 1) * 12 + baseIndex
  if (accidental === '#') midi += 1
  if (accidental === 'b') midi -= 1
  return midi
}

/**
 * 是否为黑键
 */
export function isBlackKey(midi) {
  const idx = midi % 12
  return [1, 3, 6, 8, 10].includes(idx)
}

/**
 * 是否为白键
 */
export function isWhiteKey(midi) {
  return !isBlackKey(midi)
}

/**
 * 获取白键的音名（无变音记号）
 */
export function getWhiteKeyName(midi) {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  const naturalNames = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B']
  const name = naturalNames[noteIndex]
  return name ? `${name}${octave}` : null
}

/**
 * 获取唱名（首调唱名法，以 C 为 Do）
 */
export function getSolfege(midi) {
  const idx = midi % 12
  // C major scale degrees
  const solfegeMap = {
    0: 'Do', 1: 'Do#', 2: 'Re', 3: 'Re#', 4: 'Mi',
    5: 'Fa', 6: 'Fa#', 7: 'Sol', 8: 'Sol#', 9: 'La', 10: 'La#', 11: 'Si'
  }
  return solfegeMap[idx] || ''
}

/**
 * 获取音名（用于显示，可选择升号或降号）
 */
export function getDisplayName(midi, useFlat = false) {
  return useFlat ? midiToNoteNameFlat(midi) : midiToNoteName(midi)
}

/**
 * 获取音名的字母部分（不含八度），用于在谱表上显示
 */
export function getNoteLetter(midi) {
  const idx = midi % 12
  return NOTE_NAMES[idx].replace('#', '')
}

/**
 * 判断一个音是否有升号/降号
 */
export function hasAccidental(midi) {
  return isBlackKey(midi)
}

/**
 * 获取 VexFlow 格式的音符 key
 * VexFlow 使用小写字母 + 八度，如 "c/4", "c#/4"
 */
export function midiToVexKey(midi) {
  const name = midiToNoteName(midi).toLowerCase()
  // "c#4" -> "c#/4"
  const match = name.match(/^([a-g][#b]?)(\d+)$/)
  if (match) {
    return `${match[1]}/${match[2]}`
  }
  return name
}

/**
 * 计算音符在谱表上的位置（以谱表第三线为 0，向上为正，向下为负，单位为"线间"）
 * 用于判断是否需要加线、符干方向等
 *
 * 高音谱号：第三线是 B4
 * 低音谱号：第三线是 D3
 */
export function getStaffPosition(midi, clef) {
  // 计算该音在 C 大调音阶中的度数（0-based，C=0, D=1, ... B=6）
  const octave = Math.floor(midi / 12) - 1
  const pitchClass = midi % 12
  // 映射到自然音级（0-6）
  const diatonicMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
  const diatonicDegree = diatonicMap[pitchClass]

  // 以 C4 为基准计算总音级数（包含八度）
  const totalStepsFromC4 = (octave - 4) * 7 + diatonicDegree

  if (clef === 'treble') {
    // B4 在高音谱号第三线，B4 的 diatonicDegree=6, octave=4
    // B4 相对 C4 的 steps = 6
    // 第三线位置 = 0，所以 position = totalStepsFromC4 - 6
    return totalStepsFromC4 - 6
  } else {
    // D3 在低音谱号第三线，D3 的 diatonicDegree=1, octave=3
    // D3 相对 C4 的 steps = (3-4)*7 + 1 = -6
    return totalStepsFromC4 - (-6)
  }
}

/**
 * 判断符干方向：音符在第三线及以下符干向上，以上符干向下
 */
export function getStemDirection(midi, clef) {
  const pos = getStaffPosition(midi, clef)
  return pos > 0 ? 'down' : 'up'
}

/**
 * 判断是否需要加线（上下加线）
 * 高音谱号范围：E4(position -4) 到 F5(position 4) 是五线范围内
 * 低音谱号范围：G2(position -4) 到 A3(position 4)
 */
export function getLedgerLines(midi, clef) {
  const pos = getStaffPosition(midi, clef)
  const ledgers = []
  // 低于第一线（pos < -4）
  if (pos < -4) {
    const count = Math.ceil((-4 - pos) / 2)
    for (let i = 0; i < count; i++) {
      ledgers.push(-5 - i * 2)
    }
  }
  // 高于第五线（pos > 4）
  if (pos > 4) {
    const count = Math.ceil((pos - 4) / 2)
    for (let i = 0; i < count; i++) {
      ledgers.push(5 + i * 2)
    }
  }
  return ledgers
}

/**
 * 获取某个谱表的音域建议
 */
export function getDefaultClefRange(clef) {
  if (clef === 'treble') return ['C4', 'G5']
  if (clef === 'bass') return ['F2', 'C4']
  return ['C3', 'C6']
}

/**
 * 获取指定范围内所有白键的 MIDI 值
 */
export function getWhiteKeysInRange(lowName, highName, includeAccidentals = false) {
  const low = noteNameToMidi(lowName)
  const high = noteNameToMidi(highName)
  const notes = []
  for (let m = low; m <= high; m++) {
    if (includeAccidentals || isWhiteKey(m)) {
      notes.push(m)
    }
  }
  return notes
}

/**
 * 获取钢琴键盘上的所有按键（含黑白键），用于键盘布局
 */
export function getPianoKeys(lowMidi, highMidi) {
  const keys = []
  for (let m = lowMidi; m <= highMidi; m++) {
    keys.push({
      midi: m,
      name: midiToNoteName(m),
      isBlack: isBlackKey(m),
      whiteName: getWhiteKeyName(m),
    })
  }
  return keys
}

/**
 * 键盘快捷键映射（电脑键盘 -> 白键 MIDI）
 * 两行布局：
 *  白键: A S D F G H J K L ; '  (对应 C4 起的白键)
 *  黑键: W E   T Y U   O P    (对应 C#4 D#4 F#4 G#4 A#4 C#5 D#5)
 */
export const KEYBOARD_MAP = {
  // 白键行
  'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 'g': 'G4', 'h': 'A4',
  'j': 'B4', 'k': 'C5', 'l': 'D5', ';': 'E5', "'": 'F5',
  // 黑键行
  'w': 'C#4', 'e': 'D#4', 't': 'F#4', 'y': 'G#4', 'u': 'A#4',
  'o': 'C#5', 'p': 'D#5',
  // 低八度（z x c v b n m）
  'z': 'C3', 'x': 'D3', 'c': 'E3', 'v': 'F3', 'b': 'G3', 'n': 'A3', 'm': 'B3',
}

/**
 * 根据电脑按键获取对应的 MIDI
 */
export function keyToMidi(key) {
  const lower = key.toLowerCase()
  if (KEYBOARD_MAP[lower]) {
    return noteNameToMidi(KEYBOARD_MAP[lower])
  }
  return null
}

/**
 * 生成统计用的 note ID（区分谱表）
 */
export function makeNoteId(clef, midi) {
  return `${clef}_${midiToNoteName(midi)}`
}

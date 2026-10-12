// 音频服务 - Web Audio API 播放音高和提示音

let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * 播放指定 MIDI 音高的音符（钢琴音色模拟）
 * @param {number} midi
 * @param {number} duration 秒
 */
export function playNote(midi, duration = 0.6) {
  const ctx = getCtx()
  const freq = 440 * Math.pow(2, (midi - 69) / 12)
  const now = ctx.currentTime

  // 主振荡器（三角波，接近钢琴）
  const osc1 = ctx.createOscillator()
  osc1.type = 'triangle'
  osc1.frequency.value = freq

  // 泛音振荡器
  const osc2 = ctx.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = freq * 2

  const gain1 = ctx.createGain()
  const gain2 = ctx.createGain()
  const master = ctx.createGain()

  // ADSR 包络
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(0.25, now + 0.01)
  master.gain.exponentialRampToValueAtTime(0.15, now + 0.1)
  master.gain.exponentialRampToValueAtTime(0.001, now + duration)

  gain1.gain.value = 0.6
  gain2.gain.value = 0.2

  osc1.connect(gain1).connect(master)
  osc2.connect(gain2).connect(master)
  master.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + duration)
  osc2.stop(now + duration)
}

/**
 * 播放正确提示音（上升音阶）
 */
export function playCorrectSound() {
  playNote(72, 0.15)
  setTimeout(() => playNote(76, 0.15), 100)
  setTimeout(() => playNote(79, 0.3), 200)
}

/**
 * 播放错误提示音（低音短促）
 */
export function playWrongSound() {
  const ctx = getCtx()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.2)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.25)
}

/**
 * 恢复 AudioContext（用户首次交互后调用）
 */
export function resumeAudio() {
  getCtx()
}

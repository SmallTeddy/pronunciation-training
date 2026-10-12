<template>
  <div class="settings-panel">
    <h3>练习设置</h3>

    <div class="setting-group">
      <label>谱表模式</label>
      <div class="btn-group">
        <button :class="{ active: s.clefMode === 'treble' }" @click="set({ clefMode: 'treble' })">高音谱表</button>
        <button :class="{ active: s.clefMode === 'bass' }" @click="set({ clefMode: 'bass' })">低音谱表</button>
        <button :class="{ active: s.clefMode === 'both' }" @click="set({ clefMode: 'both' })">双谱表</button>
      </div>
    </div>

    <div class="setting-group">
      <label>练习模式</label>
      <select :value="s.practiceMode" @change="set({ practiceMode: $event.target.value })">
        <option value="free">自由练习</option>
        <option value="treble">高音谱表专项</option>
        <option value="bass">低音谱表专项</option>
        <option value="mixed">双谱表混合</option>
        <option value="wrong">错题强化</option>
        <option value="timed">限时挑战 ({{ s.timedDuration }}s)</option>
      </select>
    </div>

    <div class="setting-group">
      <label>音域范围</label>
      <div class="range-inputs">
        <select :value="s.noteRange[0]" @change="setRange(0, $event.target.value)">
          <option v-for="n in lowOptions" :key="n" :value="n">{{ n }}</option>
        </select>
        <span>~</span>
        <select :value="s.noteRange[1]" @change="setRange(1, $event.target.value)">
          <option v-for="n in highOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </div>

    <div class="setting-group inline">
      <label>包含变化音（升/降号）</label>
      <input type="checkbox" :checked="s.includeAccidentals" @change="set({ includeAccidentals: $event.target.checked })" />
    </div>

    <div class="setting-group inline">
      <label>显示音名提示</label>
      <input type="checkbox" :checked="s.showNoteName" @change="set({ showNoteName: $event.target.checked })" />
    </div>

    <div class="setting-group inline">
      <label>显示唱名提示</label>
      <input type="checkbox" :checked="s.showSolfege" @change="set({ showSolfege: $event.target.checked })" />
    </div>

    <div class="setting-group inline">
      <label>使用降号表示黑键</label>
      <input type="checkbox" :checked="s.useFlat" @change="set({ useFlat: $event.target.checked })" />
    </div>

    <div class="setting-group">
      <label>自动下一题延迟：{{ s.autoNextDelay }}ms（0 为不自动）</label>
      <input type="range" min="0" max="3000" step="100" :value="s.autoNextDelay"
        @input="set({ autoNextDelay: parseInt($event.target.value) })" />
    </div>

    <div class="setting-group">
      <label>限时挑战时长：{{ s.timedDuration }}秒</label>
      <input type="range" min="30" max="300" step="10" :value="s.timedDuration"
        @input="set({ timedDuration: parseInt($event.target.value) })" />
    </div>

    <div class="setting-group inline">
      <label>音效开关</label>
      <input type="checkbox" :checked="s.soundEnabled" @change="set({ soundEnabled: $event.target.checked })" />
    </div>

    <div class="setting-group inline">
      <label>深色主题</label>
      <input type="checkbox" :checked="s.theme === 'dark'" @change="toggleTheme" />
    </div>

    <div class="data-actions">
      <button class="btn-export" @click="exportData">导出数据</button>
      <button class="btn-import" @click="importData">导入数据</button>
      <button class="btn-reset" @click="resetData">重置统计</button>
      <input ref="fileInput" type="file" accept="application/json" style="display:none" @change="onFileChange" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePracticeStore } from '../../stores/practice.js'
import { storage } from '../../services/storage.js'

const store = usePracticeStore()
const s = computed(() => store.settings)
const fileInput = ref(null)

const lowOptions = ['C2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4']
const highOptions = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6']

function set(patch) {
  store.updateSettings(patch)
}

function setRange(idx, val) {
  const range = [...s.value.noteRange]
  range[idx] = val
  set({ noteRange: range })
}

function toggleTheme() {
  set({ theme: s.value.theme === 'dark' ? 'light' : 'dark' })
}

function exportData() {
  const data = storage.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `staff-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  fileInput.value?.click()
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const ok = storage.importData(ev.target.result)
    if (ok) {
      store.refreshData()
      store.updateSettings(storage.getSettings())
      alert('导入成功！')
    } else {
      alert('导入失败：文件格式错误')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function resetData() {
  if (confirm('确定要重置所有统计数据吗？此操作不可撤销。')) {
    storage.resetStats()
    store.refreshData()
    alert('统计数据已重置')
  }
}
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.settings-panel h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: var(--text);
}
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setting-group.inline {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
.setting-group label {
  font-size: 14px;
  color: var(--text-muted);
}
.setting-group select,
.setting-group input[type='range'] {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  font-size: 14px;
}
.setting-group input[type='checkbox'] {
  width: 20px;
  height: 20px;
  accent-color: var(--accent);
  cursor: pointer;
}
.btn-group {
  display: flex;
  gap: 6px;
}
.btn-group button {
  flex: 1;
  padding: 8px 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.btn-group button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
.range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}
.range-inputs select {
  flex: 1;
}
.data-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}
.data-actions button {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.data-actions button:hover {
  border-color: var(--accent);
}
.btn-reset {
  grid-column: 1 / -1;
  color: #f87171 !important;
  border-color: rgba(248, 113, 113, 0.4) !important;
}
.btn-reset:hover {
  background: rgba(248, 113, 113, 0.1) !important;
}
</style>

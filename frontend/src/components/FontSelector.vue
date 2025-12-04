<script lang="ts" setup>
import { ref, defineEmits } from 'vue'

// Emit selected font to parent
const emit = defineEmits<{
  (e: 'update:font', font: string): void
}>()

const selectedFont = ref('sans-serif')

// Emit whenever the font changes
function handleChange() {
  emit('update:font', selectedFont.value)
}

// List of fonts with label and value
const fonts = [
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Arial', value: "'Arial', sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
]
</script>

<template>
  <div class="flex items-center gap-2">
    <label for="fontSelect" class="font-medium">Select font:</label>
    <select
      id="fontSelect"
      v-model="selectedFont"
      @change="handleChange"
      class="border px-2 py-1 rounded"
      :style="{ fontFamily: selectedFont }"
    >
      <option
        v-for="font in fonts"
        :key="font.value"
        :value="font.value"
        :style="{ fontFamily: font.value }"
      >
        {{ font.label }}
      </option>
    </select>
  </div>
</template>



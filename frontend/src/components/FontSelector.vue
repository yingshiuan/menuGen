<script lang="ts" setup>
import { ref, watch } from 'vue'

const emit = defineEmits<{
  (e: 'update:font', font: string): void
}>()

interface FontOption {
  label: string
  value: string
}

const fonts: FontOption[] = [
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Arial', value: "'Arial', sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
]

const selectedFont = ref<string>(fonts[0]?.value || 'sans-serif')

// watch(selectedFont, (newFont) => emit('update:font', newFont))

function loadGoogleFont(fontName: string) {
  const normalized = fontName.replace(/\s+/g, '+')
  const url = `https://fonts.googleapis.com/css2?family=${normalized}&display=swap`

  if (document.querySelector(`link[href="${url}"]`)) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

// Parse font-family and get the real font name
function parseFontName(fontFamily: string) {
  return (
    fontFamily
      .split(',')
      .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)[0] || ''
  )
}

watch(selectedFont, (newFont) => {
  if (!newFont) return

  emit('update:font', newFont)

  const fontName = parseFontName(newFont)

  if (['sans-serif', 'serif', 'monospace'].includes(fontName)) return

  loadGoogleFont(fontName)
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex items-center gap-2">
      <label for="fontSelect" class="font-medium">Select Font</label>
      <select
        id="fontSelect"
        v-model="selectedFont"
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
  </div>
  <div class="flex items-center gap-2 mt-2">
    <label class="font-medium">Paste Font Name</label>
    <input
      v-model="selectedFont"
      placeholder="Paste Google Font name (e.g., Roboto, Poppins)"
      title="paste Google Font name here"
      class="border px-2 py-1 rounded text-sm"
      :style="{ fontFamily: selectedFont }"
    />
  </div>
</template>

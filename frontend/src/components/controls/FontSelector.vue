<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = defineProps<{
  font: string
}>()

const emit = defineEmits<{
  (e: 'update:font', font: string): void
}>()

interface FontOption {
  label: string
  value: string
}

const fonts: FontOption[] = [
  { label: 'Sans Serif', value: 'Sans-Serif' },
  { label: 'Serif', value: 'Serif' },
  { label: 'Monospace', value: 'Monospace' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
]

const selectedFont = ref<string>(props.font)

watch(
  () => props.font,
  (val) => {
    if (val !== selectedFont.value) {
      selectedFont.value = val
    }
  },
)

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
  <div class="flex flex-col gap-2 text-sm">
    <label class="flex items-center gap-2">
      <span class="w-24 shrink-0">Font</span>
      <select
        id="fontSelect"
        v-model="selectedFont"
        class="border px-2 py-1 rounded w-40"
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
    </label>
    <label class="flex items-center gap-2">
      <span class="w-24 shrink-0">Google font</span>
      <input
        v-model="selectedFont"
        placeholder="e.g. Roboto"
        title="paste Google Font name here"
        class="border px-2 py-1 rounded w-40"
        :style="{ fontFamily: selectedFont }"
      />
    </label>
  </div>

  <!-- Footer hint (the input's placeholder gives the example) -->
  <p class="pl-26 text-[0.8rem] text-gray-400 mt-1">
    From
    <a
      href="https://fonts.google.com"
      target="_blank"
      class="text-blue-400 underline hover:text-blue-600"
      >fonts.google.com</a
    >
  </p>
</template>
